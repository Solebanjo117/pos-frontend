<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Head } from '@inertiajs/vue3';
import {
    AlertCircle,
    DollarSign,
    Pencil,
    Plus,
    RefreshCw,
    Trash2,
    X,
} from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { operationalExpensesService } from '@/services/operational-expenses';
import { InventoryApiService } from '@/services/inventory';
import type {
    OperationalExpense,
    OperationalExpenseCategory,
    OperationalExpensePayload,
    OperationalExpensePaymentMethod,
} from '@/types/operational-expense';

const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const expenses = ref<OperationalExpense[]>([]);
const warehouses = ref<any[]>([]);
const categories = ref<Record<string, string>>({
    electricity: 'Luz',
    accounting: 'Contador',
    rent: 'Alquiler',
    maintenance: 'Mantenimiento',
    software: 'Programa mensual',
    payroll: 'Planilla',
    utilities: 'Servicios',
    other: 'Otro',
});
const summary = ref({ total_amount: 0, count: 0 });
const showForm = ref(false);
const editingExpense = ref<OperationalExpense | null>(null);

const filters = ref({
    date_from: firstDayOfMonth.toISOString().split('T')[0],
    date_to: today.toISOString().split('T')[0],
    category: '' as OperationalExpenseCategory | '',
    warehouse_id: null as number | null,
    per_page: 50,
});

const form = ref<OperationalExpensePayload>({
    expense_date: today.toISOString().split('T')[0],
    category: 'other',
    description: '',
    amount: 0,
    payment_method: 'transfer',
    reference_number: '',
    warehouse_id: null,
    notes: '',
});

const categoryOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Todas' },
    ...Object.entries(categories.value).map(([value, label]) => ({
        value,
        label,
    })),
]);

const formCategoryOptions = computed<SelectOption[]>(() =>
    Object.entries(categories.value).map(([value, label]) => ({
        value,
        label,
    })),
);

const warehouseOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Global' },
    ...warehouses.value.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
    })),
]);

const filterWarehouseOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Globales' },
    ...warehouses.value.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
    })),
]);

const paymentMethods: Array<{
    value: OperationalExpensePaymentMethod;
    label: string;
}> = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'card', label: 'Tarjeta' },
    { value: 'transfer', label: 'Transferencia' },
    { value: 'other', label: 'Otro' },
];

function formatCurrency(value: number | string | null | undefined): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value || 0));
}

function formatDate(value?: string | null): string {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('es-PA');
}

async function loadWarehouses() {
    try {
        warehouses.value = await InventoryApiService.getWarehouses();
    } catch (e) {
        warehouses.value = [];
    }
}

async function loadExpenses() {
    loading.value = true;
    error.value = null;
    try {
        const response = await operationalExpensesService.list(filters.value);
        expenses.value = response.data;
        summary.value = response.summary;
        categories.value = response.categories || categories.value;
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'Error al cargar gastos operativos.';
    } finally {
        loading.value = false;
    }
}

function openCreateForm() {
    editingExpense.value = null;
    form.value = {
        expense_date: today.toISOString().split('T')[0],
        category: 'other',
        description: '',
        amount: 0,
        payment_method: 'transfer',
        reference_number: '',
        warehouse_id: null,
        notes: '',
    };
    showForm.value = true;
}

function openEditForm(expense: OperationalExpense) {
    editingExpense.value = expense;
    form.value = {
        expense_date: expense.expense_date,
        category: expense.category,
        description: expense.description || '',
        amount: Number(expense.amount || 0),
        payment_method: expense.payment_method || 'transfer',
        reference_number: expense.reference_number || '',
        warehouse_id: expense.warehouse_id ?? null,
        notes: expense.notes || '',
    };
    showForm.value = true;
}

async function saveExpense() {
    saving.value = true;
    error.value = null;
    try {
        if (editingExpense.value) {
            await operationalExpensesService.update(
                editingExpense.value.id,
                form.value,
            );
        } else {
            await operationalExpensesService.create(form.value);
        }
        showForm.value = false;
        await loadExpenses();
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'Error al guardar el gasto operativo.';
    } finally {
        saving.value = false;
    }
}

async function deleteExpense(expense: OperationalExpense) {
    if (!confirm(`Eliminar gasto ${expense.category_label}?`)) return;
    await operationalExpensesService.remove(expense.id);
    await loadExpenses();
}

onMounted(async () => {
    await Promise.all([loadWarehouses(), loadExpenses()]);
});
</script>

<template>
    <Head title="Gastos operativos" />
    <AppLayout>
        <div
            class="min-h-[calc(100vh-4rem)] bg-gray-50/60 p-4 dark:bg-background"
        >
            <div class="mx-auto max-w-7xl space-y-4">
                <div
                    class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                >
                    <div>
                        <h1
                            class="text-2xl font-bold text-gray-900 dark:text-white"
                        >
                            Gastos operativos
                        </h1>
                        <p class="text-sm text-gray-500">
                            Luz, alquiler, contador, mantenimiento, software y
                            otros gastos de operacion.
                        </p>
                    </div>
                    <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                        @click="openCreateForm"
                    >
                        <Plus :size="16" />
                        Nuevo gasto
                    </button>
                </div>

                <div
                    v-if="error"
                    class="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                >
                    <AlertCircle :size="16" />
                    {{ error }}
                </div>

                <div class="grid gap-3 md:grid-cols-3">
                    <div
                        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                    >
                        <p
                            class="text-xs font-semibold text-gray-500 uppercase"
                        >
                            Total periodo
                        </p>
                        <p
                            class="mt-1 text-2xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ formatCurrency(summary.total_amount) }}
                        </p>
                    </div>
                    <div
                        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                    >
                        <p
                            class="text-xs font-semibold text-gray-500 uppercase"
                        >
                            Registros
                        </p>
                        <p
                            class="mt-1 text-2xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ summary.count }}
                        </p>
                    </div>
                    <div
                        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                    >
                        <p
                            class="text-xs font-semibold text-gray-500 uppercase"
                        >
                            Alcance
                        </p>
                        <p
                            class="mt-1 text-sm font-semibold text-gray-900 dark:text-white"
                        >
                            Global o por almacen
                        </p>
                    </div>
                </div>

                <div
                    class="rounded-lg border border-gray-200 bg-white p-3 dark:border-border dark:bg-card"
                >
                    <div class="grid gap-3 md:grid-cols-5">
                        <div>
                            <label
                                class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                            >
                                Desde
                            </label>
                            <input
                                v-model="filters.date_from"
                                type="date"
                                class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-muted"
                            />
                        </div>
                        <div>
                            <label
                                class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                            >
                                Hasta
                            </label>
                            <input
                                v-model="filters.date_to"
                                type="date"
                                class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-muted"
                            />
                        </div>
                        <div>
                            <label
                                class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                            >
                                Categoria
                            </label>
                            <SearchableSelect
                                v-model="filters.category"
                                :options="categoryOptions"
                            />
                        </div>
                        <div>
                            <label
                                class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                            >
                                Almacen
                            </label>
                            <SearchableSelect
                                v-model="filters.warehouse_id"
                                :options="filterWarehouseOptions"
                            />
                        </div>
                        <div class="flex items-end">
                            <button
                                type="button"
                                class="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-muted dark:text-gray-200"
                                @click="loadExpenses"
                            >
                                <RefreshCw
                                    :size="16"
                                    :class="{ 'animate-spin': loading }"
                                />
                                Filtrar
                            </button>
                        </div>
                    </div>
                </div>

                <div
                    class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <table class="min-w-full text-sm">
                        <thead
                            class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/50"
                        >
                            <tr>
                                <th class="px-3 py-2 text-left">Fecha</th>
                                <th class="px-3 py-2 text-left">Categoria</th>
                                <th class="px-3 py-2 text-left">Descripcion</th>
                                <th class="px-3 py-2 text-left">Almacen</th>
                                <th class="px-3 py-2 text-left">Metodo</th>
                                <th class="px-3 py-2 text-left">Recibo</th>
                                <th class="px-3 py-2 text-right">Monto</th>
                                <th class="px-3 py-2 text-right"></th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-100 dark:divide-border"
                        >
                            <tr v-if="loading">
                                <td
                                    colspan="8"
                                    class="px-3 py-8 text-center text-gray-500"
                                >
                                    Cargando gastos...
                                </td>
                            </tr>
                            <tr v-else-if="expenses.length === 0">
                                <td
                                    colspan="8"
                                    class="px-3 py-8 text-center text-gray-500"
                                >
                                    No hay gastos para este filtro.
                                </td>
                            </tr>
                            <template v-else>
                                <tr
                                    v-for="expense in expenses"
                                    :key="expense.id"
                                    class="hover:bg-gray-50 dark:hover:bg-muted/40"
                                >
                                    <td class="px-3 py-2">
                                        {{ formatDate(expense.expense_date) }}
                                    </td>
                                    <td class="px-3 py-2">
                                        <span
                                            class="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-muted dark:text-gray-200"
                                        >
                                            {{ expense.category_label }}
                                        </span>
                                    </td>
                                    <td class="px-3 py-2 font-medium">
                                        {{ expense.description || '-' }}
                                    </td>
                                    <td class="px-3 py-2">
                                        {{
                                            expense.warehouse?.name || 'Global'
                                        }}
                                    </td>
                                    <td class="px-3 py-2">
                                        {{
                                            expense.payment_method_label || '-'
                                        }}
                                    </td>
                                    <td class="px-3 py-2 font-mono text-xs">
                                        {{ expense.reference_number || '-' }}
                                    </td>
                                    <td
                                        class="px-3 py-2 text-right font-mono font-semibold"
                                    >
                                        {{ formatCurrency(expense.amount) }}
                                    </td>
                                    <td class="px-3 py-2 text-right">
                                        <button
                                            type="button"
                                            class="p-1 text-gray-500 hover:text-emerald-600"
                                            @click="openEditForm(expense)"
                                        >
                                            <Pencil :size="15" />
                                        </button>
                                        <button
                                            type="button"
                                            class="p-1 text-gray-500 hover:text-red-600"
                                            @click="deleteExpense(expense)"
                                        >
                                            <Trash2 :size="15" />
                                        </button>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div
            v-if="showForm"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
            <form
                class="w-full max-w-2xl rounded-lg bg-white shadow-2xl dark:bg-card"
                @submit.prevent="saveExpense"
            >
                <div
                    class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-border"
                >
                    <div>
                        <h2 class="text-lg font-bold">
                            {{
                                editingExpense ? 'Editar gasto' : 'Nuevo gasto'
                            }}
                        </h2>
                        <p class="text-sm text-gray-500">
                            Este registro afecta reportes financieros, no caja.
                        </p>
                    </div>
                    <button
                        type="button"
                        class="rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-muted"
                        @click="showForm = false"
                    >
                        <X :size="18" />
                    </button>
                </div>

                <div class="grid gap-4 p-5 md:grid-cols-2">
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Fecha *</label
                        >
                        <input
                            v-model="form.expense_date"
                            type="date"
                            required
                            class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-border dark:bg-muted"
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Categoria *</label
                        >
                        <SearchableSelect
                            v-model="form.category"
                            :options="formCategoryOptions"
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Monto *</label
                        >
                        <input
                            v-model.number="form.amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                            class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-right dark:border-border dark:bg-muted"
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Almacen</label
                        >
                        <SearchableSelect
                            v-model="form.warehouse_id"
                            :options="warehouseOptions"
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Metodo</label
                        >
                        <select
                            v-model="form.payment_method"
                            class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-border dark:bg-muted"
                        >
                            <option
                                v-for="method in paymentMethods"
                                :key="method.value"
                                :value="method.value"
                            >
                                {{ method.label }}
                            </option>
                        </select>
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Numero de recibo</label
                        >
                        <input
                            v-model="form.reference_number"
                            type="text"
                            maxlength="100"
                            class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-border dark:bg-muted"
                        />
                    </div>
                    <div class="md:col-span-2">
                        <label class="mb-1 block text-sm font-medium"
                            >Descripcion</label
                        >
                        <input
                            v-model="form.description"
                            type="text"
                            maxlength="255"
                            placeholder="Ej: Alquiler local, luz, contador"
                            class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-border dark:bg-muted"
                        />
                    </div>
                    <div class="md:col-span-2">
                        <label class="mb-1 block text-sm font-medium"
                            >Notas</label
                        >
                        <textarea
                            v-model="form.notes"
                            rows="2"
                            class="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-border dark:bg-muted"
                        ></textarea>
                    </div>
                </div>

                <div
                    class="flex justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-border"
                >
                    <button
                        type="button"
                        class="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200 dark:hover:bg-muted"
                        @click="showForm = false"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        :disabled="saving || form.amount <= 0"
                        class="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                        <DollarSign :size="16" />
                        {{ saving ? 'Guardando...' : 'Guardar' }}
                    </button>
                </div>
            </form>
        </div>
    </AppLayout>
</template>
