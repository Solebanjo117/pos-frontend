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
    Route,
    Send,
    Trash2,
    X,
} from 'lucide-vue-next';
import { computed, nextTick, onMounted, ref } from 'vue';
import BusinessDatetimeEditor from '@/components/BusinessDatetimeEditor.vue';
import TransactionTraceDrawer from '@/components/Traceability/TransactionTraceDrawer.vue';
import DateRangeInput from '@/components/ui/DateRangeInput.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { useStoreSettings } from '@/composables/useStoreSettings';
import AppLayout from '@/layouts/AppLayout.vue';
import { operationalExpensesService } from '@/services/operational-expenses';
import { ReportsApiService } from '@/services/reports';
import warehousesService from '@/services/warehouses';
import type {
    OperationalExpense,
    OperationalExpenseBeneficiary,
    OperationalExpenseCategory,
    OperationalExpenseCategoryRecord,
    OperationalExpensePayload,
    OperationalExpensePaymentMethod,
    OperationalExpensePaymentMethodOption,
    OperationalExpenseParty,
    OperationalExpensePartyType,
} from '@/types/operational-expense';
import type { AccountingAccountSummary } from '@/types/report';
import { formatCurrency, formatReportDate } from '@/utils/formatters';

const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const localDateTimeValue = () => {
    const value = new Date();
    value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
    return value.toISOString().slice(0, 16);
};

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const expenses = ref<OperationalExpense[]>([]);
const parties = ref<OperationalExpenseParty[]>([]);
const ledgerAccounts = ref<AccountingAccountSummary[]>([]);
const expenseCategories = ref<OperationalExpenseCategoryRecord[]>([]);
const expenseToDelete = ref<OperationalExpense | null>(null);
const traceExpenseId = ref<number | null>(null);
const traceOpen = ref(false);
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
const summary = ref<{
    total_amount: number;
    count: number;
    by_category?: Array<{
        category: string;
        total_amount: number;
        count: number;
    }>;
    by_party?: Array<{
        party_type: OperationalExpensePartyType | null;
        party_id: number | null;
        party_name: string;
        total_amount: number;
        count: number;
    }>;
}>({ total_amount: 0, count: 0, by_category: [], by_party: [] });
const statuses = ref<Record<string, string>>({
    draft: 'Borrador',
    paid: 'Pagado',
    pending: 'Pendiente',
    scheduled: 'Programado',
    queued: 'En Caja',
    cancelled: 'Cancelado',
    reversed: 'Reversado',
});
const recurrences = ref<Record<string, string>>({
    one_time: 'Unico',
    weekly: 'Semanal',
    monthly: 'Mensual',
    yearly: 'Anual',
});
const expenseKinds = ref<Record<string, string>>({
    operational: 'Operativo',
    administrative: 'Administrativo',
    financial: 'Financiero',
    other: 'Otro',
});
const showForm = ref(false);
const formDialog = ref<HTMLFormElement | null>(null);
const firstFormInput = ref<HTMLInputElement | null>(null);
const warehouses = ref<Array<{ id: number; name: string }>>([]);
const editingExpense = ref<OperationalExpense | null>(null);
const creatingCategory = ref(false);
const creatingBeneficiary = ref(false);
const showBeneficiaryForm = ref(false);
const viewMode = ref<'movements' | 'category' | 'party'>('movements');
const beneficiaryForm = ref({
    name: '',
    type: 'individual' as 'individual' | 'company',
    email: '',
    phone: '',
});
const setViewMode = (value: string) => {
    if (value === 'movements' || value === 'category' || value === 'party') {
        viewMode.value = value;
    }
};

async function openCategoryBreakdown(category: string) {
    filters.value.category = category;
    viewMode.value = 'party';
    await loadExpenses();
}

async function openPartyMovements(
    type: OperationalExpensePartyType | null,
    id: number | null,
) {
    filters.value.party_type = type ?? '';
    filters.value.party_id = id;
    viewMode.value = 'movements';
    await loadExpenses();
}
const { fetchSettings: fetchStoreSettings } = useStoreSettings();

const filters = ref({
    date_from: firstDayOfMonth.toISOString().split('T')[0],
    date_to: today.toISOString().split('T')[0],
    category: '' as OperationalExpenseCategory | '',
    warehouse_id: null as number | null,
    expense_kind: '' as '' | OperationalExpensePayload['expense_kind'],
    status: '' as '' | NonNullable<OperationalExpense['status']>,
    party_type: '' as '' | OperationalExpensePartyType,
    party_id: null as number | null,
    per_page: 50,
});

const form = ref<OperationalExpensePayload>({
    expense_date: today.toISOString().split('T')[0],
    category: 'other',
    category_id: null,
    custom_category_name: '',
    subcategory: '',
    description: '',
    amount: 0,
    estimated_amount: 0,
    final_amount: 0,
    payment_method: 'transfer',
    planned_payment_method: 'transfer',
    recurrence: 'one_time',
    status: 'paid',
    paid_at: null,
    due_at: null,
    affects_cash_flow: true,
    affects_income_statement: true,
    expense_kind: 'operational',
    supplier_id: null,
    customer_id: null,
    beneficiary_id: null,
    party_type: null,
    party_id: null,
    ledger_account_id: null,
    reference_number: '',
    warehouse_id: null,
    notes: '',
    business_datetime: localDateTimeValue(),
});

const categoryOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Todas' },
    ...(expenseCategories.value.length
        ? expenseCategories.value.map((category) => ({
              value: category.slug,
              label: category.name,
          }))
        : Object.entries(categories.value).map(([value, label]) => ({
              value,
              label,
          }))),
]);

const formCategoryOptions = computed<SelectOption[]>(() =>
    expenseCategories.value.map((category) => ({
        value: category.id,
        label: category.name,
    })),
);

const partyOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Sin persona asociada' },
    ...parties.value.map((party) => ({
        value: `${party.type}:${party.id}`,
        label: party.name,
        sublabel:
            party.type === 'customer'
                ? 'Cliente'
                : party.type === 'supplier'
                  ? 'Proveedor'
                  : party.type === 'staff'
                    ? 'Empleado / vendedor'
                    : 'Beneficiario',
    })),
]);

const selectedPartyValue = computed<string | null>({
    get: () =>
        form.value.party_type && form.value.party_id
            ? `${form.value.party_type}:${form.value.party_id}`
            : null,
    set: (value) => {
        const [type, id] = String(value ?? '').split(':');
        form.value.party_type = (type ||
            null) as OperationalExpensePartyType | null;
        form.value.party_id = id ? Number(id) : null;
    },
});

const filterPartyValue = computed<string | null>({
    get: () =>
        filters.value.party_type && filters.value.party_id
            ? `${filters.value.party_type}:${filters.value.party_id}`
            : null,
    set: (value) => {
        const [type, id] = String(value ?? '').split(':');
        filters.value.party_type = (type || '') as
            | OperationalExpensePartyType
            | '';
        filters.value.party_id = id ? Number(id) : null;
    },
});

const ledgerAccountOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Cuenta automatica' },
    ...ledgerAccounts.value.map((account) => ({
        value: account.id,
        label: `${account.code} - ${account.name}`,
    })),
]);

const statusOptions = computed<SelectOption[]>(() =>
    Object.entries(statuses.value)
        .filter(([value]) =>
            ['draft', 'pending', 'scheduled', 'paid'].includes(value),
        )
        .map(([value, label]) => ({ value, label })),
);

const recurrenceOptions = computed<SelectOption[]>(() =>
    Object.entries(recurrences.value).map(([value, label]) => ({
        value,
        label,
    })),
);

const fallbackPaymentMethods: OperationalExpensePaymentMethodOption[] = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'card', label: 'Tarjeta' },
    { value: 'transfer', label: 'Transferencia' },
    { value: 'yappy', label: 'Yappy' },
    { value: 'ach', label: 'ACH' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'other', label: 'Otro' },
];
const paymentMethods = ref<OperationalExpensePaymentMethodOption[]>([
    ...fallbackPaymentMethods,
]);

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

function formatDate(value?: string | null): string {
    return formatReportDate(value);
}

function categoryName(slug: string): string {
    return (
        expenseCategories.value.find((category) => category.slug === slug)
            ?.name ||
        categories.value[slug] ||
        slug
    );
}

function partyTypeLabel(type: OperationalExpensePartyType | null): string {
    if (type === 'customer') return 'Cliente';
    if (type === 'supplier') return 'Proveedor';
    if (type === 'beneficiary') return 'Beneficiario';
    if (type === 'staff') return 'Empleado / vendedor';
    return 'Sin relacion';
}

let partySearchTimer: ReturnType<typeof setTimeout> | null = null;
async function loadParties(q = '') {
    try {
        parties.value = await operationalExpensesService.searchParties(q);
    } catch {
        parties.value = [];
    }
}

function searchParties(q: string) {
    if (partySearchTimer) clearTimeout(partySearchTimer);
    if (q.trim().length < 2) return;
    partySearchTimer = setTimeout(() => loadParties(q), 250);
}

async function loadLedgerAccounts() {
    try {
        const response = await ReportsApiService.getAccountingAccounts({});
        ledgerAccounts.value = response.data;
    } catch {
        ledgerAccounts.value = [];
    }
}

async function loadWarehouses() {
    try {
        warehouses.value = (await warehousesService.getAllWarehouses()).map(
            (warehouse) => ({ id: warehouse.id, name: warehouse.name }),
        );
    } catch {
        warehouses.value = [];
    }
}

async function loadExpenseCategories() {
    try {
        expenseCategories.value =
            await operationalExpensesService.listCategories();
    } catch {
        expenseCategories.value = [];
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
        expenseCategories.value =
            response.expense_categories || expenseCategories.value;
        statuses.value = response.statuses || statuses.value;
        recurrences.value = response.recurrences || recurrences.value;
        expenseKinds.value = response.expense_kinds || expenseKinds.value;
        paymentMethods.value = normalizePaymentMethods(
            response.payment_methods,
        );
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'Error al cargar gastos operativos.';
    } finally {
        loading.value = false;
    }
}

function normalizePaymentMethods(
    methods: Array<
        OperationalExpensePaymentMethod | OperationalExpensePaymentMethodOption
    > = [],
): OperationalExpensePaymentMethodOption[] {
    const normalized = methods
        .map((method) =>
            typeof method === 'string'
                ? {
                      value: method,
                      label:
                          fallbackPaymentMethods.find(
                              (item) => item.value === method,
                          )?.label ?? method,
                  }
                : method,
        )
        .filter((method) => method.value && method.label);

    return normalized.length > 0 ? normalized : [...fallbackPaymentMethods];
}

function defaultPaymentMethod(): OperationalExpensePaymentMethod {
    return (
        paymentMethods.value.find((method) => method.value === 'transfer')
            ?.value ??
        paymentMethods.value[0]?.value ??
        'transfer'
    );
}

function openCreateForm() {
    editingExpense.value = null;
    form.value = {
        expense_date: today.toISOString().split('T')[0],
        category: 'other',
        category_id: expenseCategories.value[0]?.id ?? null,
        custom_category_name: '',
        subcategory: '',
        description: '',
        amount: 0,
        estimated_amount: 0,
        final_amount: 0,
        payment_method: defaultPaymentMethod(),
        planned_payment_method: defaultPaymentMethod(),
        recurrence: 'one_time',
        status: 'paid',
        paid_at: null,
        due_at: null,
        affects_cash_flow: true,
        affects_income_statement: true,
        expense_kind: 'operational',
        supplier_id: null,
        customer_id: null,
        beneficiary_id: null,
        party_type: null,
        party_id: null,
        ledger_account_id: null,
        reference_number: '',
        warehouse_id: null,
        notes: '',
        business_datetime: localDateTimeValue(),
    };
    showForm.value = true;
    nextTick(() => firstFormInput.value?.focus());
}

function openEditForm(expense: OperationalExpense) {
    editingExpense.value = expense;
    if (
        expense.party &&
        !parties.value.some(
            (party) =>
                party.type === expense.party?.type &&
                party.id === expense.party?.id,
        )
    ) {
        parties.value.push(expense.party);
    }
    form.value = {
        expense_date: expense.expense_date,
        category: expense.category,
        category_id: expense.category_id ?? null,
        custom_category_name: '',
        subcategory: expense.subcategory || '',
        description: expense.description || '',
        amount: Number(expense.amount || 0),
        estimated_amount: Number(
            expense.estimated_amount ?? expense.amount ?? 0,
        ),
        payment_method: expense.payment_method || 'transfer',
        planned_payment_method:
            expense.planned_payment_method ||
            expense.payment_method ||
            'transfer',
        recurrence: expense.recurrence || 'one_time',
        status: expense.status || 'paid',
        paid_at: expense.paid_at || null,
        due_at: expense.due_at || null,
        affects_cash_flow: expense.affects_cash_flow ?? true,
        affects_income_statement: expense.affects_income_statement ?? true,
        expense_kind: expense.expense_kind || 'operational',
        supplier_id: expense.supplier_id ?? null,
        customer_id: expense.customer_id ?? null,
        beneficiary_id: expense.beneficiary_id ?? null,
        party_type: expense.party?.type ?? null,
        party_id: expense.party?.id ?? null,
        ledger_account_id: expense.ledger_account_id ?? null,
        reference_number: expense.reference_number || '',
        warehouse_id: expense.warehouse_id ?? null,
        notes: expense.notes || '',
        business_datetime: expense.business_datetime?.slice(0, 16) || null,
    };
    showForm.value = true;
    nextTick(() => firstFormInput.value?.focus());
}

async function createBeneficiaryFromForm() {
    const name = beneficiaryForm.value.name.trim();
    if (!name) return;
    creatingBeneficiary.value = true;
    error.value = null;
    try {
        const beneficiary: OperationalExpenseBeneficiary =
            await operationalExpensesService.createBeneficiary({
                name,
                type: beneficiaryForm.value.type,
                email: beneficiaryForm.value.email || null,
                phone: beneficiaryForm.value.phone || null,
            });
        const party: OperationalExpenseParty = {
            type: 'beneficiary',
            id: beneficiary.id,
            name: beneficiary.name,
        };
        parties.value = [
            ...parties.value.filter(
                (item) => !(item.type === party.type && item.id === party.id),
            ),
            party,
        ].sort((a, b) => a.name.localeCompare(b.name));
        selectedPartyValue.value = `beneficiary:${beneficiary.id}`;
        beneficiaryForm.value = {
            name: '',
            type: 'individual',
            email: '',
            phone: '',
        };
        showBeneficiaryForm.value = false;
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'No se pudo crear el beneficiario.';
    } finally {
        creatingBeneficiary.value = false;
    }
}

function partyHref(expense: OperationalExpense): string | null {
    if (!expense.party) return null;
    if (expense.party.type === 'customer')
        return `/customers/${expense.party.id}`;
    if (expense.party.type === 'supplier')
        return `/suppliers/${expense.party.id}`;
    return `/operational-expense-beneficiaries/${expense.party.related_id ?? expense.party.id}`;
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

async function createCategoryFromForm() {
    const name = form.value.custom_category_name?.trim();
    if (!name) return;

    creatingCategory.value = true;
    error.value = null;

    try {
        const category = await operationalExpensesService.createCategory({
            name,
            subcategory: form.value.subcategory,
            default_ledger_account_id: form.value.ledger_account_id,
            expense_kind: form.value.expense_kind,
            affects_cash_flow: form.value.affects_cash_flow,
            affects_income_statement: form.value.affects_income_statement,
        });
        expenseCategories.value = [
            ...expenseCategories.value.filter(
                (item) => item.id !== category.id,
            ),
            category,
        ].sort((a, b) => a.name.localeCompare(b.name));
        form.value.category_id = category.id;
        form.value.category = category.slug;
        form.value.custom_category_name = '';
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'No se pudo crear la categoria.';
    } finally {
        creatingCategory.value = false;
    }
}

function closeForm() {
    if (saving.value) return;
    showForm.value = false;
}

function handleFormKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
        event.preventDefault();
        closeForm();
        return;
    }

    if (event.key !== 'Tab' || !formDialog.value) return;
    const focusable = Array.from(
        formDialog.value.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
    ).filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

async function saveExpense(action: 'close' | 'new' | 'queue' = 'close') {
    saving.value = true;
    error.value = null;
    try {
        const selectedCategory = expenseCategories.value.find(
            (category) => category.id === form.value.category_id,
        );
        const categoryKey = form.value.category ?? '';
        const isPaid = form.value.status === 'paid';
        const payload: OperationalExpensePayload = {
            ...form.value,
            status: action === 'queue' ? 'pending' : form.value.status,
            amount: Number(
                isPaid
                    ? form.value.final_amount ||
                          form.value.estimated_amount ||
                          form.value.amount
                    : form.value.estimated_amount || form.value.amount,
            ),
            estimated_amount: Number(
                form.value.estimated_amount || form.value.amount,
            ),
            payment_method:
                action === 'queue' ? null : form.value.payment_method,
            description:
                form.value.description?.trim() ||
                form.value.notes?.trim() ||
                selectedCategory?.name ||
                categories.value[categoryKey] ||
                'Gasto',
        };

        let savedExpense: OperationalExpense;
        if (editingExpense.value) {
            savedExpense = await operationalExpensesService.update(
                editingExpense.value.id,
                payload,
            );
        } else {
            savedExpense = await operationalExpensesService.create(payload);
        }

        if (action === 'queue') {
            await operationalExpensesService.sendToCashier(savedExpense.id);
        }

        if (action === 'new') {
            openCreateForm();
        } else {
            showForm.value = false;
        }
        await loadExpenses();
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'Error al guardar el gasto operativo.';
    } finally {
        saving.value = false;
    }
}

async function deleteExpense(expense: OperationalExpense) {
    expenseToDelete.value = expense;
}

async function sendExpenseToCashier(expense: OperationalExpense) {
    error.value = null;
    try {
        await operationalExpensesService.sendToCashier(expense.id);
        await loadExpenses();
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'No se pudo enviar el gasto a Caja.';
    }
}

async function confirmDeleteExpense() {
    if (!expenseToDelete.value) return;

    const expense = expenseToDelete.value;
    expenseToDelete.value = null;
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
    await Promise.all([
        fetchStoreSettings(),
        loadParties(),
        loadLedgerAccounts(),
        loadWarehouses(),
        loadExpenseCategories(),
        loadExpenses(),
    ]);

    if (new URLSearchParams(window.location.search).get('new') === '1') {
        openCreateForm();
    }
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
                    <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                        <DateRangeInput
                            v-model:from="filters.date_from"
                            v-model:to="filters.date_to"
                            label="Rango de fechas"
                            @change="loadExpenses"
                        />
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
                                Estado
                            </label>
                            <SearchableSelect
                                v-model="filters.status"
                                :options="[
                                    { value: '', label: 'Todos' },
                                    ...statusOptions,
                                ]"
                            />
                        </div>
                        <div>
                            <label
                                class="mb-1 block text-xs font-semibold text-gray-500 uppercase"
                            >
                                Persona / empresa
                            </label>
                            <SearchableSelect
                                v-model="filterPartyValue"
                                :options="partyOptions"
                                clearable
                                @search="searchParties"
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
                    class="flex w-fit items-center rounded-md border border-gray-200 bg-white p-1 dark:border-border dark:bg-card"
                >
                    <button
                        v-for="option in [
                            { value: 'movements', label: 'Movimientos' },
                            { value: 'category', label: 'Por categoria' },
                            { value: 'party', label: 'Por persona' },
                        ]"
                        :key="option.value"
                        type="button"
                        class="rounded px-3 py-1.5 text-xs font-semibold transition"
                        :class="
                            viewMode === option.value
                                ? 'bg-emerald-600 text-white'
                                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-muted'
                        "
                        @click="setViewMode(option.value)"
                    >
                        {{ option.label }}
                    </button>
                </div>

                <div
                    v-if="viewMode === 'category'"
                    class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <table class="min-w-full text-sm">
                        <thead
                            class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/50"
                        >
                            <tr>
                                <th class="px-4 py-3 text-left">Categoria</th>
                                <th class="px-4 py-3 text-right">
                                    Movimientos
                                </th>
                                <th class="px-4 py-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-100 dark:divide-border"
                        >
                            <tr
                                v-for="row in summary.by_category || []"
                                :key="row.category"
                                class="cursor-pointer hover:bg-gray-50 dark:hover:bg-muted/40"
                                @click="openCategoryBreakdown(row.category)"
                            >
                                <td class="px-4 py-3 font-medium">
                                    {{ categoryName(row.category) }}
                                </td>
                                <td class="px-4 py-3 text-right">
                                    {{ row.count }}
                                </td>
                                <td
                                    class="px-4 py-3 text-right font-mono font-semibold"
                                >
                                    {{ formatCurrency(row.total_amount) }}
                                </td>
                            </tr>
                            <tr v-if="!(summary.by_category || []).length">
                                <td
                                    colspan="3"
                                    class="px-4 py-8 text-center text-gray-500"
                                >
                                    Sin gastos por categoria.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div
                    v-if="viewMode === 'party'"
                    class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <table class="min-w-full text-sm">
                        <thead
                            class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/50"
                        >
                            <tr>
                                <th class="px-4 py-3 text-left">
                                    Persona / empresa
                                </th>
                                <th class="px-4 py-3 text-left">Tipo</th>
                                <th class="px-4 py-3 text-right">
                                    Movimientos
                                </th>
                                <th class="px-4 py-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-100 dark:divide-border"
                        >
                            <tr
                                v-for="row in summary.by_party || []"
                                :key="`${row.party_type}:${row.party_id}`"
                                class="cursor-pointer hover:bg-gray-50 dark:hover:bg-muted/40"
                                @click="
                                    openPartyMovements(
                                        row.party_type,
                                        row.party_id,
                                    )
                                "
                            >
                                <td class="px-4 py-3 font-medium">
                                    {{ row.party_name }}
                                </td>
                                <td class="px-4 py-3 text-gray-500">
                                    {{ partyTypeLabel(row.party_type) }}
                                </td>
                                <td class="px-4 py-3 text-right">
                                    {{ row.count }}
                                </td>
                                <td
                                    class="px-4 py-3 text-right font-mono font-semibold"
                                >
                                    {{ formatCurrency(row.total_amount) }}
                                </td>
                            </tr>
                            <tr v-if="!(summary.by_party || []).length">
                                <td
                                    colspan="4"
                                    class="px-4 py-8 text-center text-gray-500"
                                >
                                    Sin gastos por persona.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div
                    v-if="viewMode === 'movements'"
                    class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <table class="min-w-full text-sm">
                        <thead
                            class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/50"
                        >
                            <tr>
                                <th class="px-3 py-2 text-left">Fecha</th>
                                <th class="px-3 py-2 text-left">Categoria</th>
                                <th class="px-3 py-2 text-left">Fecha/Hora</th>
                                <th class="px-3 py-2 text-left">
                                    Persona / empresa
                                </th>
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
                                    colspan="9"
                                    class="px-3 py-8 text-center text-gray-500"
                                >
                                    Cargando gastos...
                                </td>
                            </tr>
                            <tr v-else-if="expenses.length === 0">
                                <td
                                    colspan="9"
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
                                    <td class="px-3 py-2">
                                        <a
                                            v-if="partyHref(expense)"
                                            :href="
                                                partyHref(expense) || undefined
                                            "
                                            class="font-medium text-emerald-700 hover:underline dark:text-emerald-300"
                                        >
                                            {{ expense.party?.name }}
                                        </a>
                                        <span v-else>-</span>
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
                                            class="p-1 text-gray-500 hover:text-cyan-700"
                                            title="Ver trazabilidad"
                                            @click="
                                                traceExpenseId = expense.id;
                                                traceOpen = true;
                                            "
                                        >
                                            <Route :size="15" />
                                        </button>
                                        <button
                                            v-if="
                                                expense.capabilities
                                                    ?.can_send_to_cashier
                                            "
                                            type="button"
                                            class="p-1 text-gray-500 hover:text-sky-600"
                                            title="Enviar a Caja"
                                            @click="
                                                sendExpenseToCashier(expense)
                                            "
                                        >
                                            <Send :size="15" />
                                        </button>
                                        <button
                                            v-if="
                                                expense.capabilities?.can_edit
                                            "
                                            type="button"
                                            class="p-1 text-gray-500 hover:text-emerald-600"
                                            @click="openEditForm(expense)"
                                        >
                                            <Pencil :size="15" />
                                        </button>
                                        <button
                                            v-if="
                                                expense.capabilities
                                                    ?.can_cancel ||
                                                expense.capabilities
                                                    ?.can_reverse
                                            "
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

        <TransactionTraceDrawer
            :open="traceOpen"
            type="operational_expense"
            :id="traceExpenseId"
            @close="traceOpen = false"
        />

        <div
            v-if="showForm"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
            <form
                ref="formDialog"
                class="w-full max-w-2xl rounded-lg bg-white shadow-2xl dark:bg-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="expense-dialog-title"
                @keydown="handleFormKeydown"
                @submit.prevent="saveExpense('close')"
            >
                <div
                    class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-border"
                >
                    <div>
                        <h2 id="expense-dialog-title" class="text-lg font-bold">
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
                        @click="closeForm"
                    >
                        <X :size="18" />
                    </button>
                </div>

                <div
                    class="grid max-h-[70vh] gap-4 overflow-y-auto p-5 md:grid-cols-2"
                >
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Fecha y hora *</label
                        >
                        <input
                            ref="firstFormInput"
                            v-model="form.business_datetime"
                            type="datetime-local"
                            required
                            class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-border dark:bg-muted"
                            @change="
                                form.expense_date = String(
                                    form.business_datetime || '',
                                ).slice(0, 10)
                            "
                        />
                    </div>
                    <div>
                        <div
                            class="mb-1 flex items-center justify-between gap-2"
                        >
                            <label class="block text-sm font-medium"
                                >Cliente / proveedor / beneficiario</label
                            >
                            <button
                                type="button"
                                class="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                                @click="
                                    showBeneficiaryForm = !showBeneficiaryForm
                                "
                            >
                                Nuevo beneficiario
                            </button>
                        </div>
                        <SearchableSelect
                            v-model="selectedPartyValue"
                            :options="partyOptions"
                            clearable
                            @search="searchParties"
                        />
                    </div>
                    <div
                        v-if="showBeneficiaryForm"
                        class="grid gap-3 rounded-md border border-emerald-200 bg-emerald-50/60 p-3 md:col-span-2 md:grid-cols-4 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                    >
                        <input
                            v-model="beneficiaryForm.name"
                            type="text"
                            maxlength="150"
                            placeholder="Nombre del beneficiario"
                            class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-muted"
                        />
                        <select
                            v-model="beneficiaryForm.type"
                            class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-muted"
                        >
                            <option value="individual">Persona</option>
                            <option value="company">Empresa</option>
                        </select>
                        <input
                            v-model="beneficiaryForm.phone"
                            type="text"
                            placeholder="Telefono opcional"
                            class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-muted"
                        />
                        <button
                            type="button"
                            :disabled="
                                creatingBeneficiary ||
                                !beneficiaryForm.name.trim()
                            "
                            class="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            @click="createBeneficiaryFromForm"
                        >
                            {{
                                creatingBeneficiary
                                    ? 'Creando...'
                                    : 'Crear y seleccionar'
                            }}
                        </button>
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Categoria</label
                        >
                        <SearchableSelect
                            v-model="form.category_id"
                            :options="formCategoryOptions"
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Monto estimado *</label
                        >
                        <input
                            v-model.number="form.estimated_amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                            class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-right dark:border-border dark:bg-muted"
                            @input="
                                form.amount = Number(form.estimated_amount || 0)
                            "
                        />
                    </div>
                    <div v-if="form.status === 'paid'">
                        <label class="mb-1 block text-sm font-medium"
                            >Monto final *</label
                        >
                        <input
                            v-model.number="form.final_amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                            class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-right dark:border-border dark:bg-muted"
                            @input="
                                form.amount = Number(
                                    form.final_amount ||
                                        form.estimated_amount ||
                                        0,
                                )
                            "
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Nueva categoria</label
                        >
                        <div class="flex gap-2">
                            <input
                                v-model="form.custom_category_name"
                                type="text"
                                maxlength="100"
                                placeholder="ERP, Hosting, Subscripciones"
                                class="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-border dark:bg-muted"
                            />
                            <button
                                type="button"
                                class="rounded-md border border-gray-300 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:text-gray-200 dark:hover:bg-muted"
                                :disabled="
                                    creatingCategory ||
                                    !form.custom_category_name
                                "
                                @click="createCategoryFromForm"
                            >
                                Crear
                            </button>
                        </div>
                    </div>
                    <div class="md:col-span-2">
                        <label class="mb-1 block text-sm font-medium"
                            >Descripcion</label
                        >
                        <input
                            v-model="form.description"
                            type="text"
                            maxlength="255"
                            placeholder="Concepto del gasto"
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

                    <details
                        class="rounded-md border border-gray-200 bg-gray-50/80 p-3 md:col-span-2 dark:border-border dark:bg-muted/40"
                    >
                        <summary
                            class="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-200"
                        >
                            Opciones avanzadas
                        </summary>
                        <div class="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                                <label class="mb-1 block text-sm font-medium"
                                    >Estado</label
                                >
                                <SearchableSelect
                                    v-model="form.status"
                                    :options="statusOptions"
                                />
                            </div>
                            <div>
                                <label class="mb-1 block text-sm font-medium"
                                    >Sucursal</label
                                >
                                <select
                                    v-model.number="form.warehouse_id"
                                    class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-border dark:bg-muted"
                                >
                                    <option :value="null">
                                        Sucursal actual
                                    </option>
                                    <option
                                        v-for="warehouse in warehouses"
                                        :key="warehouse.id"
                                        :value="warehouse.id"
                                    >
                                        {{ warehouse.name }}
                                    </option>
                                </select>
                            </div>
                            <div>
                                <label class="mb-1 block text-sm font-medium">
                                    {{
                                        form.status === 'paid'
                                            ? 'Metodo final'
                                            : 'Metodo previsto'
                                    }}
                                </label>
                                <select
                                    v-if="form.status === 'paid'"
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
                                <select
                                    v-else
                                    v-model="form.planned_payment_method"
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
                            <div v-if="form.status !== 'paid'">
                                <label class="mb-1 block text-sm font-medium"
                                    >Fecha de pago</label
                                >
                                <input
                                    v-model="form.due_at"
                                    type="datetime-local"
                                    class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-border dark:bg-muted"
                                />
                            </div>
                            <div>
                                <label class="mb-1 block text-sm font-medium"
                                    >Subcategoria</label
                                >
                                <input
                                    v-model="form.subcategory"
                                    type="text"
                                    maxlength="100"
                                    placeholder="Mensualidad, software, servicios digitales"
                                    class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-border dark:bg-muted"
                                />
                            </div>
                            <div>
                                <label class="mb-1 block text-sm font-medium"
                                    >Recurrencia</label
                                >
                                <SearchableSelect
                                    v-model="form.recurrence"
                                    :options="recurrenceOptions"
                                />
                            </div>
                            <div>
                                <label class="mb-1 block text-sm font-medium"
                                    >Cuenta contable</label
                                >
                                <SearchableSelect
                                    v-model="form.ledger_account_id"
                                    :options="ledgerAccountOptions"
                                />
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
                            <div
                                class="flex items-center gap-5 rounded-md border border-gray-200 p-3 dark:border-border"
                            >
                                <label
                                    class="inline-flex items-center gap-2 text-sm"
                                >
                                    <input
                                        v-model="form.affects_cash_flow"
                                        type="checkbox"
                                        class="rounded border-gray-300"
                                    />
                                    Afecta caja/banco
                                </label>
                                <label
                                    class="inline-flex items-center gap-2 text-sm"
                                >
                                    <input
                                        v-model="form.affects_income_statement"
                                        type="checkbox"
                                        class="rounded border-gray-300"
                                    />
                                    Afecta resultados
                                </label>
                            </div>
                        </div>
                    </details>
                </div>

                <div
                    class="flex justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-border"
                >
                    <button
                        type="button"
                        class="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200 dark:hover:bg-muted"
                        @click="closeForm"
                    >
                        Cancelar
                    </button>
                    <button
                        v-if="!editingExpense"
                        type="button"
                        :disabled="
                            saving ||
                            Number(form.estimated_amount || form.amount) <= 0
                        "
                        class="rounded-md border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                        @click="saveExpense('new')"
                    >
                        Guardar y crear otro
                    </button>
                    <button
                        v-if="
                            !editingExpense ||
                            editingExpense.capabilities?.can_send_to_cashier
                        "
                        type="button"
                        :disabled="
                            saving ||
                            Number(form.estimated_amount || form.amount) <= 0
                        "
                        class="inline-flex items-center gap-2 rounded-md border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
                        @click="saveExpense('queue')"
                    >
                        <Send :size="16" />
                        Guardar y enviar a Caja
                    </button>
                    <button
                        type="submit"
                        :disabled="
                            saving ||
                            Number(form.estimated_amount || form.amount) <= 0
                        "
                        class="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                        <DollarSign :size="16" />
                        {{ saving ? 'Guardando...' : 'Guardar' }}
                    </button>
                </div>
            </form>
        </div>

        <div
            v-if="expenseToDelete"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
            <div
                class="w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-border dark:bg-card"
            >
                <div
                    class="border-b border-gray-200 px-5 py-4 dark:border-border"
                >
                    <h3
                        class="text-base font-bold text-gray-900 dark:text-white"
                    >
                        Eliminar gasto operativo
                    </h3>
                    <p class="mt-1 text-sm text-gray-500">
                        Esta accion quitara el gasto del listado y registrara la
                        reversa contable si aplica.
                    </p>
                </div>
                <div class="space-y-2 px-5 py-4 text-sm">
                    <p class="font-semibold text-gray-900 dark:text-white">
                        {{ expenseToDelete.category_label }}
                    </p>
                    <p class="text-gray-500">
                        {{ expenseToDelete.description || 'Sin descripcion' }}
                    </p>
                    <p class="font-mono text-sm font-semibold">
                        {{ formatCurrency(expenseToDelete.amount) }}
                    </p>
                </div>
                <div
                    class="flex justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-border"
                >
                    <button
                        type="button"
                        class="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200 dark:hover:bg-muted"
                        @click="expenseToDelete = null"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                        @click="confirmDeleteExpense"
                    >
                        Eliminar
                    </button>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
