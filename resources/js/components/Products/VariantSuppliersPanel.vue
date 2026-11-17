<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorMessage from '@/components/ui/ErrorMessage.vue';
import LoadingState from '@/components/ui/LoadingState.vue';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import { suppliersService } from '@/services/suppliers';
import { variantSuppliersService } from '@/services/variantSuppliers';
import type { VariantSupplierRow } from '@/services/variantSuppliers';

/**
 * Proveedores de una marca (como "Vendor IDs" del sistema anterior): el código con que cada
 * proveedor conoce la pieza y lo que se le pagó en la última compra. El más barato queda como
 * proveedor por defecto al pedir; el sistema lo calcula y el costo se actualiza al recibir compras.
 */
const props = defineProps<{
    productId: number;
    variantId: number;
}>();

const rows = ref<VariantSupplierRow[]>([]);
const allSuppliers = ref<{ id: number; name: string }[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');

const newSupplierId = ref<number | null>(null);
const newCode = ref('');
const newCost = ref<number | null>(null);

const editingId = ref<number | null>(null);
const editCode = ref('');
const editCost = ref<number | null>(null);

const supplierOptions = computed(() =>
    (allSuppliers.value ?? [])
        .filter((s) => !rows.value.some((row) => row.supplier_id === s.id))
        .map((s) => ({ value: s.id, label: s.name })),
);

const money = (value: number) =>
    new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(value || 0);

const shortDate = (value: string | null) =>
    value
        ? new Intl.DateTimeFormat('es-PA', { dateStyle: 'medium' }).format(
              new Date(value),
          )
        : 'Sin compras';

const apiError = (e: any, fallback: string) =>
    e?.response?.data?.message || fallback;

const load = async () => {
    loading.value = true;
    error.value = '';
    try {
        const [list, suppliers] = await Promise.all([
            variantSuppliersService.list(props.productId, props.variantId),
            suppliersService.getAllActive(),
        ]);
        rows.value = list;
        allSuppliers.value = suppliers ?? [];
    } catch (e) {
        error.value = apiError(e, 'No se pudieron cargar los proveedores.');
    } finally {
        loading.value = false;
    }
};

const add = async () => {
    if (!newSupplierId.value || newCost.value === null || saving.value) return;
    saving.value = true;
    error.value = '';
    try {
        rows.value = await variantSuppliersService.save(
            props.productId,
            props.variantId,
            newSupplierId.value,
            {
                supplier_code: newCode.value.trim() || null,
                supplier_cost: Number(newCost.value),
            },
        );
        newSupplierId.value = null;
        newCode.value = '';
        newCost.value = null;
    } catch (e) {
        error.value = apiError(e, 'No se pudo agregar el proveedor.');
    } finally {
        saving.value = false;
    }
};

const startEdit = (row: VariantSupplierRow) => {
    editingId.value = row.supplier_id;
    editCode.value = row.supplier_code ?? '';
    editCost.value = row.supplier_cost;
};

const saveEdit = async (row: VariantSupplierRow) => {
    if (editCost.value === null || saving.value) return;
    saving.value = true;
    error.value = '';
    try {
        rows.value = await variantSuppliersService.save(
            props.productId,
            props.variantId,
            row.supplier_id,
            {
                supplier_code: editCode.value.trim() || null,
                supplier_cost: Number(editCost.value),
            },
        );
        editingId.value = null;
    } catch (e) {
        error.value = apiError(e, 'No se pudo guardar el proveedor.');
    } finally {
        saving.value = false;
    }
};

const remove = async (row: VariantSupplierRow) => {
    if (saving.value) return;
    saving.value = true;
    error.value = '';
    try {
        rows.value = await variantSuppliersService.remove(
            props.productId,
            props.variantId,
            row.supplier_id,
        );
    } catch (e) {
        error.value = apiError(e, 'No se pudo quitar el proveedor.');
    } finally {
        saving.value = false;
    }
};

onMounted(load);
</script>

<template>
    <section data-test="variant-suppliers" class="space-y-3">
        <div>
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
                Proveedores
            </h4>
            <p class="text-xs text-muted-foreground">
                El más barato se propone al hacer un pedido. Su costo se
                actualiza con cada compra recibida.
            </p>
        </div>

        <ErrorMessage v-if="error">{{ error }}</ErrorMessage>

        <LoadingState v-if="loading" label="Cargando proveedores..." />

        <template v-else>
            <EmptyState v-if="rows.length === 0" compact>
                Esta marca todavía no tiene proveedores.
            </EmptyState>

            <div
                v-else
                class="overflow-x-auto rounded-lg border border-gray-200 dark:border-border"
            >
                <table class="w-full text-left text-sm">
                    <thead
                        class="bg-gray-50 text-[11px] text-gray-500 uppercase dark:bg-muted"
                    >
                        <tr>
                            <th class="px-3 py-2">Proveedor</th>
                            <th class="px-3 py-2">Su código</th>
                            <th class="px-3 py-2 text-right">
                                Costo última compra
                            </th>
                            <th class="px-3 py-2">Última compra</th>
                            <th class="px-3 py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="row in rows"
                            :key="row.supplier_id"
                            data-test="variant-supplier-row"
                            class="border-t border-gray-100 dark:border-border"
                        >
                            <td class="px-3 py-2">
                                <div class="font-medium">
                                    {{ row.supplier_name }}
                                </div>
                                <span
                                    v-if="row.is_default"
                                    data-test="default-supplier"
                                    class="mt-0.5 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                    >Más barato · por defecto</span
                                >
                            </td>
                            <template v-if="editingId === row.supplier_id">
                                <td class="px-3 py-2">
                                    <input
                                        v-model="editCode"
                                        type="text"
                                        aria-label="Código del proveedor"
                                        class="h-8 w-36 rounded-md border border-input bg-transparent px-2 font-mono text-xs"
                                        @keydown.enter.prevent="saveEdit(row)"
                                    />
                                </td>
                                <td class="px-3 py-2 text-right">
                                    <input
                                        v-model.number="editCost"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        aria-label="Costo del proveedor"
                                        class="h-8 w-24 rounded-md border border-input bg-transparent px-2 text-right text-xs"
                                        @keydown.enter.prevent="saveEdit(row)"
                                    />
                                </td>
                                <td
                                    class="px-3 py-2 text-xs text-muted-foreground"
                                >
                                    {{ shortDate(row.last_purchased_at) }}
                                </td>
                                <td
                                    class="px-3 py-2 text-right whitespace-nowrap"
                                >
                                    <Button
                                        type="button"
                                        size="sm"
                                        :disabled="saving"
                                        @click="saveEdit(row)"
                                        >Guardar</Button
                                    >
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        @click="editingId = null"
                                        >Cancelar</Button
                                    >
                                </td>
                            </template>
                            <template v-else>
                                <td class="px-3 py-2 font-mono text-xs">
                                    {{ row.supplier_code || '—' }}
                                </td>
                                <td class="px-3 py-2 text-right tabular-nums">
                                    {{ money(row.supplier_cost) }}
                                </td>
                                <td
                                    class="px-3 py-2 text-xs text-muted-foreground"
                                >
                                    {{ shortDate(row.last_purchased_at) }}
                                </td>
                                <td
                                    class="px-3 py-2 text-right whitespace-nowrap"
                                >
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        :disabled="saving"
                                        @click="startEdit(row)"
                                        >Editar</Button
                                    >
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        class="text-red-600"
                                        :disabled="saving"
                                        @click="remove(row)"
                                        >Quitar</Button
                                    >
                                </td>
                            </template>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="grid grid-cols-1 items-end gap-2 md:grid-cols-12">
                <div class="min-w-0 md:col-span-5">
                    <label
                        class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300"
                        >Agregar proveedor</label
                    >
                    <SearchableSelect
                        :options="supplierOptions"
                        :model-value="newSupplierId"
                        placeholder="-- Selecciona proveedor --"
                        @update:model-value="
                            (v) => (newSupplierId = v ? Number(v) : null)
                        "
                    />
                </div>
                <div class="md:col-span-3">
                    <label
                        for="new-supplier-code"
                        class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300"
                        >Su código</label
                    >
                    <input
                        id="new-supplier-code"
                        v-model="newCode"
                        type="text"
                        placeholder="Ej: 726HAIQ7271"
                        class="h-9 w-full rounded-md border border-input bg-transparent px-2 font-mono text-sm"
                        @keydown.enter.prevent="add"
                    />
                </div>
                <div class="md:col-span-2">
                    <label
                        for="new-supplier-cost"
                        class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300"
                        >Costo</label
                    >
                    <input
                        id="new-supplier-cost"
                        v-model.number="newCost"
                        type="number"
                        min="0"
                        step="0.01"
                        class="h-9 w-full rounded-md border border-input bg-transparent px-2 text-right text-sm"
                        @keydown.enter.prevent="add"
                    />
                </div>
                <div class="md:col-span-2">
                    <button
                        type="button"
                        data-test="add-supplier"
                        class="h-9 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        :disabled="!newSupplierId || newCost === null || saving"
                        @click="add"
                    >
                        Agregar
                    </button>
                </div>
            </div>
        </template>
    </section>
</template>
