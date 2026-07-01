<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { Car, Loader2, Plus, X } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import UniversalImporter from '@/components/Import/UniversalImporter.vue';
import VariantManager from '@/components/Products/VariantManager.vue';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import { useToast } from '@/composables/useToast';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import { importService, type ImporterConfig } from '@/services/import';

const toast = useToast();

const importConfig: ImporterConfig = {
    entity: 'products',
    title: 'Importacion de Productos',
    description:
        'Descarga la plantilla, sube tu archivo Excel, edita los datos y enriquece cada producto con atributos y variantes.',
    templateFilename: 'plantilla_productos.xlsx',
    fullFileImport: true,
    groupedProductPreview: true,
    columns: [
        { key: 'nombre', label: 'Nombre', type: 'text', required: true },
        { key: 'sku', label: 'SKU / Codigo', type: 'text' },
        { key: 'system_id', label: 'System ID', type: 'text' },
        { key: 'brand', label: 'Marca / Variante', type: 'text' },
        {
            key: 'categoria',
            label: 'Categoria',
            type: 'searchable',
            searchableEndpoint: '/categories/all',
        },
        { key: 'costo', label: 'Costo', type: 'number' },
        { key: 'precio', label: 'Precio', type: 'number' },
        { key: 'cantidad', label: 'Cantidad', type: 'number' },
        { key: 'descripcion', label: 'Descripcion', type: 'text' },
        {
            key: '__compatibility',
            label: 'Vehiculos',
            actionType: 'compatibility',
        },
        { key: '__attributes', label: 'Atributos', actionType: 'attributes' },
        { key: '__variants', label: 'Variantes', actionType: 'variants' },
    ],
};

type VehicleCreationCandidate = {
    make_id?: number | null;
    make?: string | null;
    model_id?: number | null;
    model?: string | null;
    chassis?: string | null;
    engine?: string | null;
    label?: string | null;
};

const importerRef = ref<any>(null);
const categories = ref<any[]>([]);
const loadingCategories = ref(false);
const categoryOptions = computed(() =>
    categories.value.map((c) => ({ value: c.id, label: c.name })),
);
const editingRowIdx = ref<number | null>(null);

const categoryModal = ref(false);
const categoryForm = ref({
    name: '',
    parent_id: null as number | null,
    default_attributes: [] as { name: string; required: boolean }[],
});
const categoryProcessing = ref(false);
const categoryError = ref('');

const attributesModal = ref(false);
const currentAttributes = ref<{ name: string; value: string; unit?: string }[]>(
    [],
);
const variantsModal = ref(false);
const creatingVehicleCandidates = ref<Record<string, boolean>>({});

const loadCategories = async () => {
    loadingCategories.value = true;
    try {
        const { data } = await apiClient.get('/categories/all');
        categories.value = data.data ?? data;
    } catch {
        categories.value = [];
    } finally {
        loadingCategories.value = false;
    }
};
loadCategories();

const getEditingRow = () => {
    const rows = importerRef.value?.editedRows;
    if (editingRowIdx.value === null || !rows) return null;
    return rows[editingRowIdx.value];
};

const currentVariantPreview = computed(() => {
    const row = getEditingRow();
    return row?.__variant_preview ?? null;
});

const currentVariantGroup = computed(() => {
    const row = getEditingRow();
    const groupKey = row?.__product_group_key;
    if (!groupKey) return null;

    return (
        importerRef.value?.previewSummary?.groups?.find(
            (group: any) => group.product_key === groupKey,
        ) ?? null
    );
});

const missingVehicleCandidates = computed<VehicleCreationCandidate[]>(() => {
    return (
        importerRef.value?.previewSummary?.missing_vehicle_candidates ?? []
    ).filter(
        (candidate: VehicleCreationCandidate) =>
            candidate?.make && candidate?.model,
    );
});

const vehicleCandidateKey = (candidate: VehicleCreationCandidate) =>
    [
        candidate.make_id ?? candidate.make ?? '',
        candidate.model_id ?? candidate.model ?? '',
        candidate.chassis ?? '',
        candidate.engine ?? '',
    ].join('|');

const getRowCategoryId = (rowIdx: number): number | undefined => {
    const rows = importerRef.value?.editedRows;
    if (!rows) return undefined;
    const value = rows[rowIdx]?.categoria;
    if (typeof value === 'number') return value;
    const found = categories.value.find(
        (category) =>
            category.name?.toLowerCase() === String(value).toLowerCase(),
    );
    return found?.id;
};

const openCategoryModal = () => {
    categoryForm.value = { name: '', parent_id: null, default_attributes: [] };
    categoryError.value = '';
    categoryModal.value = true;
};

const addDefaultAttr = () =>
    categoryForm.value.default_attributes.push({ name: '', required: false });
const removeDefaultAttr = (index: number) =>
    categoryForm.value.default_attributes.splice(index, 1);

const submitCategory = async () => {
    categoryProcessing.value = true;
    categoryError.value = '';
    try {
        const payload: any = {
            name: categoryForm.value.name,
            status: 'active',
        };
        if (categoryForm.value.parent_id)
            payload.parent_id = categoryForm.value.parent_id;
        const attrs = categoryForm.value.default_attributes.filter(
            (attribute) => attribute.name.trim(),
        );
        if (attrs.length) payload.default_attributes = attrs;
        const { data } = await apiClient.post('/categories', payload);
        const created = data.data ?? data;
        categories.value.push(created);
        toast.success('Categoria creada correctamente');
        categoryModal.value = false;
        if (importerRef.value?.reloadSearchableOptions)
            await importerRef.value.reloadSearchableOptions();
    } catch (error: any) {
        categoryError.value =
            error.response?.data?.message || 'Error al crear la categoria';
    } finally {
        categoryProcessing.value = false;
    }
};

const openAttributesModal = (rowIdx: number) => {
    editingRowIdx.value = rowIdx;
    const row = getEditingRow();
    currentAttributes.value = (row?.__attributes ?? []).map(
        (attribute: any) => ({
            name: attribute.name ?? '',
            value: attribute.value ?? '',
            unit: attribute.unit ?? '',
        }),
    );
    attributesModal.value = true;
};

const addAttr = () =>
    currentAttributes.value.push({ name: '', value: '', unit: '' });
const removeAttr = (index: number) => currentAttributes.value.splice(index, 1);

const saveAttributes = () => {
    const row = getEditingRow();
    if (row)
        row.__attributes = currentAttributes.value.filter((attribute) =>
            attribute.name.trim(),
        );
    if (editingRowIdx.value !== null)
        importerRef.value?.markPersistedRowDirty?.(editingRowIdx.value);
    attributesModal.value = false;
    toast.success('Atributos guardados');
};

const openVariantsModal = (rowIdx: number) => {
    editingRowIdx.value = rowIdx;
    variantsModal.value = true;
};

const onDraftVariantsChanged = (variants: any[]) => {
    const row = getEditingRow();
    if (row) {
        row.__variants = variants;
        if (editingRowIdx.value !== null)
            importerRef.value?.markPersistedRowDirty?.(editingRowIdx.value);
    }
};

const handleCreate = (columnKey: string) => {
    if (columnKey === 'categoria') openCategoryModal();
};

const handleRowAction = (actionType: string, rowIdx: number) => {
    if (actionType === 'attributes') openAttributesModal(rowIdx);
    if (actionType === 'variants') openVariantsModal(rowIdx);
};

const createVehicleCandidate = async (candidate: VehicleCreationCandidate) => {
    const key = vehicleCandidateKey(candidate);
    creatingVehicleCandidates.value[key] = true;

    try {
        const response = await importService.createVehicleCandidatesBatch(
            'products',
            [candidate],
        );
        const item = response.data.candidates[0];

        if (!item || item.status === 'error') {
            throw new Error(item?.message || 'No se pudo crear el vehiculo.');
        }

        if (importerRef.value?.refreshAfterReferenceBatch) {
            toast.success('Vehiculo creado. Actualizando mesa de importacion.');
            await importerRef.value.refreshAfterReferenceBatch();
        } else {
            toast.success('Vehiculo creado. Actualizando previsualizacion.');
            await importerRef.value?.refreshPreview?.();
        }
    } catch (error: any) {
        toast.error(
            error.response?.data?.message ||
                error.message ||
                'No se pudo crear el vehiculo detectado.',
        );
    } finally {
        creatingVehicleCandidates.value[key] = false;
    }
};
</script>

<template>
    <Head title="Importar Productos" />
    <AppLayout>
        <div class="space-y-4 p-4">
            <UniversalImporter
                ref="importerRef"
                :config="importConfig"
                @create="handleCreate"
                @row-action="handleRowAction"
            />

            <div
                v-if="missingVehicleCandidates.length"
                class="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30"
            >
                <div class="mb-3 flex items-start gap-3">
                    <Car
                        class="mt-0.5 h-5 w-5 text-amber-700 dark:text-amber-300"
                    />
                    <div>
                        <h2
                            class="font-semibold text-amber-950 dark:text-amber-100"
                        >
                            Vehiculos detectados sin catalogo completo
                        </h2>
                        <p class="text-amber-800 dark:text-amber-200">
                            Puedes crear los chasis o motores faltantes para
                            completar el catalogo. El producto tambien puede
                            importarse sin compatibilidad vehicular.
                        </p>
                    </div>
                </div>
                <div class="grid gap-2 md:grid-cols-2">
                    <div
                        v-for="candidate in missingVehicleCandidates"
                        :key="vehicleCandidateKey(candidate)"
                        class="flex items-center justify-between gap-3 rounded border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-background"
                    >
                        <div class="min-w-0">
                            <p class="truncate font-medium text-foreground">
                                {{
                                    candidate.label ||
                                    `${candidate.make} ${candidate.model}`
                                }}
                            </p>
                            <p class="text-xs text-muted-foreground">
                                Chasis {{ candidate.chassis || '-' }} · Motor
                                {{ candidate.engine || '-' }}
                            </p>
                        </div>
                        <Button
                            size="sm"
                            :disabled="
                                creatingVehicleCandidates[
                                    vehicleCandidateKey(candidate)
                                ]
                            "
                            @click="createVehicleCandidate(candidate)"
                        >
                            <Loader2
                                v-if="
                                    creatingVehicleCandidates[
                                        vehicleCandidateKey(candidate)
                                    ]
                                "
                                class="mr-2 h-4 w-4 animate-spin"
                            />
                            <Plus v-else class="mr-2 h-4 w-4" />
                            Crear
                        </Button>
                    </div>
                </div>
            </div>
        </div>

        <Dialog
            :open="categoryModal"
            @update:open="
                (value) => {
                    if (!value) categoryModal = false;
                }
            "
        >
            <DialogContent class="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Nueva Categoria</DialogTitle>
                    <DialogDescription>
                        Crea una categoria faltante para resolver referencias
                        del importador.
                    </DialogDescription>
                </DialogHeader>
                <form @submit.prevent="submitCategory" class="space-y-4 py-2">
                    <div class="space-y-2">
                        <Label
                            >Nombre <span class="text-red-500">*</span></Label
                        >
                        <Input
                            v-model="categoryForm.name"
                            required
                            placeholder="Ej: Filtros, Frenos"
                        />
                    </div>
                    <div class="space-y-2">
                        <Label>Categoria Padre (Opcional)</Label>
                        <SearchableSelect
                            :options="categoryOptions"
                            :model-value="categoryForm.parent_id"
                            @update:model-value="
                                (value) =>
                                    (categoryForm.parent_id = value as
                                        | number
                                        | null)
                            "
                            placeholder="Sin categoria padre"
                            :loading="loadingCategories"
                        />
                    </div>

                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <Label>Atributos por defecto</Label>
                            <button
                                type="button"
                                @click="addDefaultAttr"
                                class="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                                <Plus class="h-3 w-3" /> Agregar
                            </button>
                        </div>
                        <div class="space-y-2">
                            <div
                                v-for="(
                                    attribute, index
                                ) in categoryForm.default_attributes"
                                :key="index"
                                class="flex items-center gap-2"
                            >
                                <Input
                                    v-model="attribute.name"
                                    placeholder="Nombre del atributo"
                                    class="flex-1"
                                />
                                <label
                                    class="flex items-center gap-1 text-xs whitespace-nowrap text-gray-600 dark:text-gray-400"
                                >
                                    <input
                                        type="checkbox"
                                        v-model="attribute.required"
                                        class="rounded"
                                    />
                                    Requerido
                                </label>
                                <button
                                    type="button"
                                    :aria-label="`Quitar atributo por defecto ${index + 1}`"
                                    @click="removeDefaultAttr(index)"
                                    class="text-red-400 hover:text-red-600"
                                >
                                    <X class="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <p
                            v-if="!categoryForm.default_attributes.length"
                            class="text-xs text-gray-400 italic"
                        >
                            Sin atributos por defecto
                        </p>
                    </div>

                    <div v-if="categoryError" class="text-sm text-red-600">
                        {{ categoryError }}
                    </div>
                    <div class="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            @click="categoryModal = false"
                            >Cancelar</Button
                        >
                        <Button type="submit" :disabled="categoryProcessing">
                            {{
                                categoryProcessing ? 'Guardando...' : 'Guardar'
                            }}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>

        <Dialog
            :open="attributesModal"
            @update:open="
                (value) => {
                    if (!value) attributesModal = false;
                }
            "
        >
            <DialogContent class="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle
                        >Atributos - Fila
                        {{
                            editingRowIdx !== null ? editingRowIdx + 1 : ''
                        }}</DialogTitle
                    >
                    <DialogDescription>
                        Edita los atributos tecnicos de la fila seleccionada.
                    </DialogDescription>
                </DialogHeader>
                <div class="space-y-3 py-2">
                    <div
                        class="grid grid-cols-2 gap-2 px-1 text-xs font-semibold text-gray-500 dark:text-gray-400"
                    >
                        <span>Nombre</span>
                        <span>Valor</span>
                    </div>
                    <div
                        v-for="(attribute, index) in currentAttributes"
                        :key="index"
                        class="flex items-center gap-2"
                    >
                        <div class="grid flex-1 grid-cols-2 gap-2">
                            <Input
                                v-model="attribute.name"
                                placeholder="Ej: Amperaje"
                            />
                            <Input
                                v-model="attribute.value"
                                placeholder="Ej: 90"
                            />
                        </div>
                        <button
                            type="button"
                            :aria-label="`Quitar atributo ${index + 1}`"
                            @click="removeAttr(index)"
                            class="text-red-400 hover:text-red-600"
                        >
                            <X class="h-4 w-4" />
                        </button>
                    </div>
                    <p
                        v-if="!currentAttributes.length"
                        class="py-4 text-center text-sm text-gray-400 italic"
                    >
                        Sin atributos. Agrega uno con el boton de abajo.
                    </p>
                    <button
                        type="button"
                        @click="addAttr"
                        class="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                        <Plus class="h-4 w-4" /> Agregar atributo
                    </button>
                </div>
                <div
                    class="flex justify-end gap-2 border-t pt-2 dark:border-border"
                >
                    <Button variant="outline" @click="attributesModal = false"
                        >Cancelar</Button
                    >
                    <Button @click="saveAttributes">Guardar</Button>
                </div>
            </DialogContent>
        </Dialog>

        <Dialog
            :open="variantsModal"
            @update:open="
                (value) => {
                    if (!value) variantsModal = false;
                }
            "
        >
            <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle
                        >Variantes - Fila
                        {{
                            editingRowIdx !== null ? editingRowIdx + 1 : ''
                        }}</DialogTitle
                    >
                    <DialogDescription>
                        Revisa y ajusta las variantes detectadas para esta fila.
                    </DialogDescription>
                </DialogHeader>
                <div class="space-y-4 py-2">
                    <div
                        v-if="currentVariantGroup"
                        class="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/30"
                    >
                        <div
                            class="mb-2 flex items-center justify-between gap-3"
                        >
                            <div>
                                <p
                                    class="font-semibold text-emerald-900 dark:text-emerald-100"
                                >
                                    Grupo detectado del Excel
                                </p>
                                <p
                                    class="text-xs text-emerald-700 dark:text-emerald-300"
                                >
                                    Estas filas se importaran como variantes del
                                    mismo producto.
                                </p>
                            </div>
                            <span
                                class="rounded bg-white px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
                            >
                                {{ currentVariantGroup.variant_count ?? 0 }}
                                variantes
                            </span>
                        </div>
                        <div
                            class="grid gap-2 text-xs text-emerald-950 sm:grid-cols-4 dark:text-emerald-100"
                        >
                            <div>
                                <span
                                    class="block text-emerald-700 dark:text-emerald-300"
                                    >Producto</span
                                >
                                {{ currentVariantGroup.product_name || '-' }}
                            </div>
                            <div>
                                <span
                                    class="block text-emerald-700 dark:text-emerald-300"
                                    >Nombre original</span
                                >
                                {{ currentVariantGroup.original_name || '-' }}
                            </div>
                            <div>
                                <span
                                    class="block text-emerald-700 dark:text-emerald-300"
                                    >Filas</span
                                >
                                {{ currentVariantGroup.rows ?? '-' }}
                            </div>
                            <div>
                                <span
                                    class="block text-emerald-700 dark:text-emerald-300"
                                    >SKUs</span
                                >
                                {{
                                    currentVariantGroup.variant_skus?.length
                                        ? currentVariantGroup.variant_skus.join(
                                              ', ',
                                          )
                                        : 'Sin SKU'
                                }}
                            </div>
                        </div>
                        <p
                            v-if="currentVariantGroup.sku_warning"
                            class="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                        >
                            {{ currentVariantGroup.sku_warning }}
                        </p>
                        <div class="mt-3 overflow-x-auto">
                            <table class="min-w-full text-left text-xs">
                                <caption class="sr-only">
                                    Variantes detectadas para la fila
                                </caption>
                                <thead
                                    class="border-b border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
                                >
                                    <tr>
                                        <th class="py-1 pr-3 font-semibold">
                                            Marca
                                        </th>
                                        <th class="py-1 pr-3 font-semibold">
                                            SKU
                                        </th>
                                        <th class="py-1 pr-3 font-semibold">
                                            System ID
                                        </th>
                                        <th
                                            class="py-1 pr-3 text-right font-semibold"
                                        >
                                            Cant.
                                        </th>
                                        <th
                                            class="py-1 pr-3 text-right font-semibold"
                                        >
                                            Costo
                                        </th>
                                        <th
                                            class="py-1 pr-3 text-right font-semibold"
                                        >
                                            Precio
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="variant in currentVariantGroup.variants ??
                                        []"
                                        :key="variant.variant_key"
                                        class="border-b border-emerald-100 last:border-0 dark:border-emerald-900"
                                    >
                                        <td class="py-1 pr-3">
                                            {{ variant.brand || 'Generica' }}
                                        </td>
                                        <td class="py-1 pr-3">
                                            {{ variant.sku || '-' }}
                                        </td>
                                        <td class="py-1 pr-3">
                                            {{ variant.system_id || '-' }}
                                        </td>
                                        <td class="py-1 pr-3 text-right">
                                            {{ variant.cantidad ?? '-' }}
                                        </td>
                                        <td class="py-1 pr-3 text-right">
                                            {{ variant.costo ?? '-' }}
                                        </td>
                                        <td class="py-1 pr-3 text-right">
                                            {{ variant.precio ?? '-' }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div
                        v-else-if="currentVariantPreview"
                        class="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/30"
                    >
                        <p
                            class="font-semibold text-emerald-900 dark:text-emerald-100"
                        >
                            Variante detectada del Excel
                        </p>
                        <div
                            class="mt-2 grid gap-2 text-xs text-emerald-950 sm:grid-cols-3 dark:text-emerald-100"
                        >
                            <div>
                                <span
                                    class="block text-emerald-700 dark:text-emerald-300"
                                    >Marca</span
                                >
                                {{ currentVariantPreview.brand || 'Generica' }}
                            </div>
                            <div>
                                <span
                                    class="block text-emerald-700 dark:text-emerald-300"
                                    >SKU</span
                                >
                                {{ currentVariantPreview.sku || 'Sin SKU' }}
                            </div>
                            <div>
                                <span
                                    class="block text-emerald-700 dark:text-emerald-300"
                                    >System ID</span
                                >
                                {{
                                    currentVariantPreview.system_id ||
                                    'Sin System ID'
                                }}
                            </div>
                        </div>
                    </div>
                    <VariantManager
                        v-if="variantsModal && editingRowIdx !== null"
                        :category-id="getRowCategoryId(editingRowIdx)"
                        :sku-base="
                            importerRef?.editedRows?.[editingRowIdx]?.sku ||
                            undefined
                        "
                        :product-name="
                            importerRef?.editedRows?.[editingRowIdx]?.nombre ||
                            undefined
                        "
                        @draft-variants-changed="onDraftVariantsChanged"
                    />
                </div>
                <div class="flex justify-end border-t pt-2 dark:border-border">
                    <Button @click="variantsModal = false">Listo</Button>
                </div>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>
