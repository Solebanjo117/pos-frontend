<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import {
    AlertCircle,
    Banknote,
    CheckCircle2,
    DollarSign,
    Pencil,
    Plus,
    RefreshCw,
    Trash2,
    X,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import BusinessDatetimeEditor from '@/components/BusinessDatetimeEditor.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { InventoryApiService } from '@/services/inventory';
import { operationalExpensesService } from '@/services/operational-expenses';
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
    { value: null, label: 'Sucursal actual' },
    ...warehouses.value.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
    })),
]);

const filterWarehouseOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todas' },
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

const sessionLinkedCount = computed(
    () => expenses.value.filter((expense) => expense.pos_session_id).length,
);

const cashExpenseTotal = computed(() =>
    expenses.value
        .filter((expense) => expense.payment_method === 'cash')
        .reduce((total, expense) => total + Number(expense.amount || 0), 0),
);

const nonCashExpenseTotal = computed(() =>
    expenses.value
        .filter((expense) => expense.payment_method !== 'cash')
        .reduce((total, expense) => total + Number(expense.amount || 0), 0),
);

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

function updateExpenseBusinessDatetime(
    expenseId: number,
    value: string | null,
): void {
    const expense = expenses.value.find((row) => row.id === expenseId);
    if (expense) {
        expense.business_datetime = value;
    }
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

function readInitialFilters() {
    const params = new URLSearchParams(window.location.search);
    const warehouseId = Number(params.get('warehouse_id'));

    if (params.get('date_from')) {
        filters.value.date_from = params.get('date_from') as string;
    }

    if (params.get('date_to')) {
        filters.value.date_to = params.get('date_to') as string;
    }

    if (warehouseId > 0) {
        filters.value.warehouse_id = warehouseId;
    }
}

onMounted(async () => {
    readInitialFilters();
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
                            otros gastos de operación separados por impacto de
                            caja.
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
                            Ligados a caja
                        </p>
                        <p
                            class="mt-1 text-2xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ sessionLinkedCount }}
                        </p>
                        <p class="text-xs text-gray-500">
                            {{ summary.count }} registro(s) visibles
                        </p>
                    </div>
                    <div
                        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                    >
                        <div class="flex items-center justify-between">
                            <p
                                class="text-xs font-semibold text-gray-500 uppercase"
                            >
                                Caja
                            </p>
                            <Banknote :size="16" class="text-slate-400" />
                        </div>
                        <p
                            class="mt-1 text-sm font-semibold text-gray-900 dark:text-white"
                        >
                            Efectivo {{ formatCurrency(cashExpenseTotal) }}
                        </p>
                        <p class="text-xs text-gray-500">
                            Otros métodos
                            {{ formatCurrency(nonCashExpenseTotal) }}
                            no contado en efectivo
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
                                Sucursal
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
                                <th class="px-3 py-2 text-left">Operativa</th>
                                <th class="px-3 py-2 text-left">Descripcion</th>
                                <th class="px-3 py-2 text-left">Sucursal</th>
                                <th class="px-3 py-2 text-left">Metodo</th>
                                <th class="px-3 py-2 text-left">Caja</th>
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
                                    colspan="10"
                                    class="px-3 py-8 text-center text-gray-500"
                                >
                                    Cargando gastos...
                                </td>
                            </tr>
                            <tr v-else-if="expenses.length === 0">
                                <td
                                    colspan="10"
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
                                    <td class="px-3 py-2">
                                        <BusinessDatetimeEditor
                                            compact
                                            record-type="operational_expense"
                                            :record-id="expense.id"
                                            :created-at="expense.created_at"
                                            :business-datetime="
                                                expense.business_datetime
                                            "
                                            @updated="
                                                (value) =>
                                                    updateExpenseBusinessDatetime(
                                                        expense.id,
                                                        value,
                                                    )
                                            "
                                        />
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
                                    <td class="px-3 py-2">
                                        <span
                                            v-if="expense.pos_session_id"
                                            class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800"
                                        >
                                            <CheckCircle2 :size="12" />
                                            Caja #{{ expense.pos_session_id }}
                                        </span>
                                        <span
                                            v-else
                                            class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-muted dark:text-slate-300 dark:ring-border"
                                        >
                                            Sin caja
                                        </span>
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
                            Este registro afecta reportes financieros y se
                            separa entre efectivo de caja y otros métodos.
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
                            >Sucursal</label
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
