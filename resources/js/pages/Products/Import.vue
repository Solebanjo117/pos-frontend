<script setup lang="ts">
import { computed, ref } from 'vue';
import { Head } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import UniversalImporter from '@/components/Import/UniversalImporter.vue';
import VariantManager from '@/components/Products/VariantManager.vue';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import type { ImporterConfig } from '@/services/import';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-vue-next';
import { useToast } from '@/composables/useToast';
import apiClient from '@/services/api/client';

const toast = useToast();

const importConfig: ImporterConfig = {
    entity: 'products',
    title: 'Importacion de Productos',
    description:
        'Descarga la plantilla, sube tu archivo Excel, edita los datos y enriquece cada producto con atributos y variantes.',
    templateFilename: 'plantilla_productos.xlsx',
    columns: [
        { key: 'nombre', label: 'Nombre', type: 'text', required: true },
        { key: 'sku', label: 'SKU', type: 'text' },
        { key: 'descripcion', label: 'Descripcion', type: 'text' },
        {
            key: 'categoria',
            label: 'Categoria',
            type: 'searchable',
            required: true,
            searchableEndpoint: '/categories/all',
            creatable: true,
        },
        {
            key: 'categorias_extra',
            label: 'Categorias Extra',
            type: 'text',
            placeholder: 'Motor, Servicio',
        },
        {
            key: 'atributos',
            label: 'Atributos Texto',
            type: 'text',
            placeholder: 'color:rojo,largo:15cm',
        },
        { key: '__attributes', label: 'Atributos', actionType: 'attributes' },
        { key: '__variants', label: 'Variantes', actionType: 'variants' },
    ],
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
const currentAttributes = ref<{ name: string; value: string; unit: string }[]>(
    [],
);
const variantsModal = ref(false);

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
    attributesModal.value = false;
    toast.success('Atributos guardados');
};

const openVariantsModal = (rowIdx: number) => {
    editingRowIdx.value = rowIdx;
    variantsModal.value = true;
};

const onDraftVariantsChanged = (variants: any[]) => {
    const row = getEditingRow();
    if (row) row.__variants = variants;
};

const handleCreate = (columnKey: string) => {
    if (columnKey === 'categoria') openCategoryModal();
};

const handleRowAction = (actionType: string, rowIdx: number) => {
    if (actionType === 'attributes') openAttributesModal(rowIdx);
    if (actionType === 'variants') openVariantsModal(rowIdx);
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
                </DialogHeader>
                <div class="space-y-3 py-2">
                    <div
                        class="grid grid-cols-3 gap-2 px-1 text-xs font-semibold text-gray-500 dark:text-gray-400"
                    >
                        <span>Nombre</span>
                        <span>Valor</span>
                        <span>Unidad</span>
                    </div>
                    <div
                        v-for="(attribute, index) in currentAttributes"
                        :key="index"
                        class="flex items-center gap-2"
                    >
                        <div class="grid flex-1 grid-cols-3 gap-2">
                            <Input
                                v-model="attribute.name"
                                placeholder="Ej: Amperaje"
                            />
                            <Input
                                v-model="attribute.value"
                                placeholder="Ej: 90"
                            />
                            <Input
                                v-model="attribute.unit"
                                placeholder="Ej: A"
                            />
                        </div>
                        <button
                            type="button"
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
                </DialogHeader>
                <div class="py-2">
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
