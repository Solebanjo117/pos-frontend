<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Head, Link } from '@inertiajs/vue3';
import {
    AlertCircle,
    Banknote,
    Clock,
    CreditCard,
    ExternalLink,
    ReceiptText,
    Search,
    Shield,
    TrendingUp,
    Users,
} from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import FinanceAgingBars from '@/components/Finance/FinanceAgingBars.vue';
import FinanceKpiCard from '@/components/Finance/FinanceKpiCard.vue';
import FinanceReportShell from '@/components/Finance/FinanceReportShell.vue';
import OperationalPaymentPanel from '@/components/POS/OperationalPaymentPanel.vue';
import { AccountsReceivableApiService } from '@/services/payments';
import type { BreadcrumbItem } from '@/types';

interface AgingBucket {
    label: string;
    amount: number;
    count: number;
}

interface Debtor {
    id: number;
    code?: string | null;
    name: string;
    email?: string | null;
    phone?: string | null;
    current_balance: number;
    credit_limit?: number;
    available_credit?: number;
    open_documents_count?: number;
    total_billed?: number;
    total_paid?: number;
    last_payment_days?: number | null;
    status?: 'Corriente' | 'Por Vencer' | 'Vencido';
    aging_buckets?: Record<string, AgingBucket>;
}

interface StatementDocument {
    id: number;
    document_type?: string;
    document_number: string;
    date?: string | null;
    due_date?: string | null;
    days_overdue?: number;
    status_label?: string;
    total: number;
    amount_paid: number;
    amount_due: number;
    payment_status: string;
    payment_summary?: Array<{
        method: string;
        method_label: string;
        amount: number;
        count: number;
    }>;
}

interface Statement {
    account: Debtor;
    summary?: {
        total_open_balance: number;
        total_billed: number;
        total_paid: number;
        open_documents_count: number;
        aging_buckets: Record<string, AgingBucket>;
    };
    documents: StatementDocument[];
    entries: Array<Record<string, any>>;
}

interface ReceivablesSummary {
    total_receivable: number;
    active_customers: number;
    open_documents_count: number;
    credits_granted: number;
    collections_received: number;
    aging_buckets: Record<string, AgingBucket>;
    over_90_amount: number;
    over_90_count: number;
}

interface Payment {
    method: string;
    amount: number;
}

interface PaymentMeta {
    reference_number?: string | null;
    notes?: string | null;
}

interface ReportFilters {
    date_from?: string;
    date_to?: string;
    warehouse_id?: number;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Cuentas por Cobrar', href: '/ar' },
];

const debtors = ref<Debtor[]>([]);
const summary = ref<ReceivablesSummary | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const searchQuery = ref('');
const reportFilters = ref<ReportFilters>({});

const selectedCustomer = ref<Debtor | null>(null);
const statement = ref<Statement | null>(null);
const loadingDetails = ref(false);
const showPaymentModal = ref(false);
const paymentLoading = ref(false);
const paymentError = ref<string | null>(null);
const manualApplications = ref<Record<number, number>>({});

const documents = computed<StatementDocument[]>(
    () => statement.value?.documents ?? [],
);
const entries = computed<Array<Record<string, any>>>(
    () => statement.value?.entries ?? [],
);
const recentMovements = computed(() => entries.value.slice(0, 8));
const selectedBalance = computed(() =>
    Number(
        statement.value?.account?.current_balance ??
            selectedCustomer.value?.current_balance ??
            0,
    ),
);
const selectedPaymentCustomer = computed(() => selectedCustomer.value as any);
const selectedAging = computed(
    () =>
        statement.value?.summary?.aging_buckets ??
        selectedCustomer.value?.aging_buckets,
);
const manualApplicationTotal = computed(() =>
    money(
        Object.values(manualApplications.value).reduce(
            (total, amount) => total + Number(amount || 0),
            0,
        ),
    ),
);
const activeReportFilters = computed(
    () =>
        Boolean(reportFilters.value.date_from) ||
        Boolean(reportFilters.value.date_to) ||
        Boolean(reportFilters.value.warehouse_id),
);
const reportFilterSummary = computed(() => {
    const labels: string[] = [];

    if (reportFilters.value.date_from || reportFilters.value.date_to) {
        labels.push(
            `${reportFilters.value.date_from || 'Inicio'} - ${reportFilters.value.date_to || 'Hoy'}`,
        );
    }

    if (reportFilters.value.warehouse_id) {
        labels.push(`Sucursal #${reportFilters.value.warehouse_id}`);
    }

    return labels.join(' · ');
});

const money = (value: number): number =>
    Math.round((Number(value) || 0) * 100) / 100;

const formatCurrency = (value: unknown): string =>
    new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value) || 0);

const formatDate = (date?: string | null): string => {
    if (!date) {
        return '-';
    }

    return new Date(`${date}T00:00:00`).toLocaleDateString('es-PA');
};

const documentPaymentMethods = (document: StatementDocument): string => {
    if (!document.payment_summary?.length) {
        return document.payment_status === 'pending' ? 'Credito' : 'Sin pagos';
    }

    return document.payment_summary
        .map(
            (payment) =>
                `${payment.method_label} ${formatCurrency(payment.amount)}`,
        )
        .join(' / ');
};

const statusClass = (status?: string): string => {
    if (status === 'Vencido') {
        return 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30';
    }

    if (status === 'Por Vencer' || status === 'Por vencer') {
        return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30';
    }

    return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30';
};

const readReportFilters = (): ReportFilters => {
    const params = new URLSearchParams(window.location.search);
    const warehouseId = Number(params.get('warehouse_id'));

    return {
        date_from: params.get('date_from') || undefined,
        date_to: params.get('date_to') || undefined,
        warehouse_id: warehouseId > 0 ? warehouseId : undefined,
    };
};

const extractDebtors = (response: any): Debtor[] => {
    const data = response?.data ?? response;

    return Array.isArray(data) ? data : [];
};

const fetchDebtors = async (): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
        const response = await AccountsReceivableApiService.getDebtors({
            search: searchQuery.value || undefined,
            per_page: 50,
            ...reportFilters.value,
        });
        debtors.value = extractDebtors(response);
        summary.value = response?.summary ?? null;
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'Error al cargar clientes con deuda.';
    } finally {
        loading.value = false;
    }
};

const loadStatement = async (customer: Debtor): Promise<void> => {
    selectedCustomer.value = customer;
    statement.value = null;
    loadingDetails.value = true;
    paymentError.value = null;

    try {
        const response =
            await AccountsReceivableApiService.getCustomerStatement(
                customer.id,
                reportFilters.value,
            );
        statement.value = response.data ?? response;
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            'No se pudo cargar el estado de cuenta.';
    } finally {
        loadingDetails.value = false;
    }
};

const loadStatementByCustomerId = async (customerId: number): Promise<void> => {
    const existingCustomer = debtors.value.find(
        (customer) => customer.id === customerId,
    );

    if (existingCustomer) {
        await loadStatement(existingCustomer);
        return;
    }

    loadingDetails.value = true;
    paymentError.value = null;

    try {
        const response =
            await AccountsReceivableApiService.getCustomerStatement(
                customerId,
                reportFilters.value,
            );
        const loadedStatement = response.data ?? response;
        statement.value = loadedStatement;
        selectedCustomer.value = loadedStatement.account;
    } catch (e: any) {
        statement.value = null;
        error.value =
            e.response?.data?.message ||
            'No se pudo cargar el estado de cuenta.';
    } finally {
        loadingDetails.value = false;
    }
};

const openPayment = (): void => {
    if (!selectedCustomer.value || selectedBalance.value <= 0) {
        return;
    }

    manualApplications.value = {};
    paymentError.value = null;
    showPaymentModal.value = true;
};

const closePayment = (): void => {
    showPaymentModal.value = false;
    paymentError.value = null;
};

const setApplicationAmount = (documentId: number, value: string): void => {
    const parsed = money(Number(value));
    manualApplications.value = {
        ...manualApplications.value,
        [documentId]: parsed > 0 ? parsed : 0,
    };
};

const onApplicationInput = (documentId: number, event: Event): void => {
    const target = event.target as HTMLInputElement | null;
    setApplicationAmount(documentId, target?.value ?? '0');
};

const buildApplications = ():
    | Array<{ document_id: number; amount: number }>
    | undefined => {
    const applications = Object.entries(manualApplications.value)
        .map(([documentId, amount]) => ({
            document_id: Number(documentId),
            amount: money(Number(amount)),
        }))
        .filter((application) => application.amount > 0);

    return applications.length > 0 ? applications : undefined;
};

const createApplicationAllocator = (
    applications: Array<{ document_id: number; amount: number }> | undefined,
) => {
    const remaining = applications?.map((application) => ({ ...application }));

    return (amount: number) => {
        if (!remaining?.length) {
            return undefined;
        }

        let left = money(amount);
        const chunk: Array<{ document_id: number; amount: number }> = [];

        for (const application of remaining) {
            if (left <= 0) {
                break;
            }

            const applied = money(Math.min(application.amount, left));
            if (applied <= 0) {
                continue;
            }

            chunk.push({
                document_id: application.document_id,
                amount: applied,
            });
            application.amount = money(application.amount - applied);
            left = money(left - applied);
        }

        return chunk.length > 0 ? chunk : undefined;
    };
};

const handlePaymentFinish = async (
    payments: Payment[],
    meta: PaymentMeta,
): Promise<void> => {
    if (!selectedCustomer.value) {
        return;
    }

    paymentError.value = null;
    const realPayments = payments.filter((payment) => payment.amount > 0);
    const totalPaid = money(
        realPayments.reduce(
            (total, payment) => total + Number(payment.amount || 0),
            0,
        ),
    );

    if (totalPaid <= 0) {
        paymentError.value = 'El monto debe ser mayor a cero.';
        return;
    }

    if (manualApplicationTotal.value > totalPaid + 0.01) {
        paymentError.value = 'El monto aplicado excede el monto del cobro.';
        return;
    }

    paymentLoading.value = true;

    try {
        const customerId = selectedCustomer.value.id;
        const allocateApplications =
            createApplicationAllocator(buildApplications());

        for (const payment of realPayments) {
            await AccountsReceivableApiService.recordReceipt(customerId, {
                amount: money(payment.amount),
                method: payment.method,
                reference_number: meta.reference_number || undefined,
                notes: meta.notes || undefined,
                applications: allocateApplications(payment.amount),
            });
        }

        showPaymentModal.value = false;
        await fetchDebtors();
        const refreshed = debtors.value.find(
            (customer) => customer.id === customerId,
        );

        if (refreshed) {
            await loadStatement(refreshed);
        } else {
            selectedCustomer.value = null;
            statement.value = null;
        }
    } catch (e: any) {
        paymentError.value =
            e.response?.data?.message || 'Error al registrar el cobro.';
    } finally {
        paymentLoading.value = false;
    }
};

let searchTimeout: ReturnType<typeof setTimeout> | undefined;
const onSearch = (): void => {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => void fetchDebtors(), 300);
};

onMounted(async () => {
    reportFilters.value = readReportFilters();
    await fetchDebtors();

    const customerId = Number(
        new URLSearchParams(window.location.search).get('customer_id'),
    );
    if (customerId > 0) {
        await loadStatementByCustomerId(customerId);
    }
});
</script>

<template>
    <Head title="Cuentas por Cobrar" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="space-y-5 p-4">
            <FinanceReportShell
                eyebrow="Credito cliente"
                title="Cuentas por Cobrar"
                subtitle="Saldos, aging, documentos abiertos y registro de cobros."
                :icon="CreditCard"
            >
                <template #actions>
                    <Link
                        href="/customers"
                        class="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                    >
                        <ExternalLink :size="16" />
                        Ver clientes
                    </Link>
                </template>

                <div
                    v-if="activeReportFilters"
                    class="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
                >
                    Vista filtrada desde reportes:
                    <span class="font-semibold">{{ reportFilterSummary }}</span>
                </div>
            </FinanceReportShell>

            <div class="grid gap-3 md:grid-cols-5">
                <FinanceKpiCard
                    label="Total por Cobrar"
                    :value="formatCurrency(summary?.total_receivable ?? 0)"
                    :detail="`${summary?.active_customers ?? 0} clientes activos`"
                    accent="indigo"
                    :icon="CreditCard"
                />
                <FinanceKpiCard
                    label="Creditos Otorgados"
                    :value="formatCurrency(summary?.credits_granted ?? 0)"
                    detail="Ventas a credito del periodo"
                    accent="sky"
                    :icon="TrendingUp"
                />
                <FinanceKpiCard
                    label="Cobros del Periodo"
                    :value="formatCurrency(summary?.collections_received ?? 0)"
                    detail="Pagos reales registrados"
                    accent="emerald"
                    :icon="Banknote"
                />
                <FinanceKpiCard
                    label="Vencidos +90"
                    :value="formatCurrency(summary?.over_90_amount ?? 0)"
                    :detail="`${summary?.over_90_count ?? 0} documentos`"
                    accent="rose"
                    :icon="Clock"
                />
                <FinanceKpiCard
                    label="Docs. Abiertos"
                    :value="String(summary?.open_documents_count ?? 0)"
                    detail="Facturas pendientes"
                    accent="slate"
                    :icon="ReceiptText"
                />
            </div>

            <div
                v-if="error"
                class="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
            >
                <AlertCircle :size="18" />
                {{ error }}
            </div>

            <div class="grid gap-5 xl:grid-cols-[minmax(340px,420px)_1fr]">
                <aside class="space-y-4">
                    <section
                        class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
                    >
                        <div
                            class="space-y-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800"
                        >
                            <div class="flex items-center justify-between">
                                <div>
                                    <h2
                                        class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                                    >
                                        Saldos por cliente
                                    </h2>
                                    <p
                                        class="text-xs text-slate-500 dark:text-slate-400"
                                    >
                                        Ordenado por saldo pendiente
                                    </p>
                                </div>
                                <Users :size="18" class="text-slate-400" />
                            </div>
                            <div class="relative">
                                <Search
                                    class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                                />
                                <input
                                    v-model="searchQuery"
                                    type="text"
                                    placeholder="Buscar cliente..."
                                    class="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                    @input="onSearch"
                                />
                            </div>
                        </div>

                        <div
                            v-if="loading"
                            class="p-6 text-center text-sm text-slate-500"
                        >
                            Cargando clientes...
                        </div>
                        <div
                            v-else-if="debtors.length === 0"
                            class="p-8 text-center text-sm text-slate-500"
                        >
                            <ReceiptText
                                class="mx-auto mb-2 text-slate-300"
                                :size="36"
                            />
                            No hay cuentas por cobrar pendientes.
                        </div>
                        <div
                            v-else
                            class="max-h-[42rem] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800"
                        >
                            <button
                                v-for="customer in debtors"
                                :key="customer.id"
                                type="button"
                                :class="[
                                    'w-full px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/60',
                                    selectedCustomer?.id === customer.id
                                        ? 'bg-indigo-50 dark:bg-indigo-500/10'
                                        : '',
                                ]"
                                @click="loadStatement(customer)"
                            >
                                <div
                                    class="flex items-start justify-between gap-3"
                                >
                                    <div class="min-w-0">
                                        <div class="flex items-center gap-2">
                                            <p
                                                class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
                                            >
                                                {{ customer.name }}
                                            </p>
                                            <span
                                                class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1"
                                                :class="
                                                    statusClass(customer.status)
                                                "
                                            >
                                                {{
                                                    customer.status ??
                                                    'Corriente'
                                                }}
                                            </span>
                                        </div>
                                        <p
                                            class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400"
                                        >
                                            {{
                                                customer.email ||
                                                customer.phone ||
                                                customer.code ||
                                                'Sin contacto'
                                            }}
                                        </p>
                                        <div
                                            class="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-500 dark:text-slate-400"
                                        >
                                            <span
                                                >Fact.
                                                {{
                                                    formatCurrency(
                                                        customer.total_billed ??
                                                            0,
                                                    )
                                                }}</span
                                            >
                                            <span
                                                >Cob.
                                                {{
                                                    formatCurrency(
                                                        customer.total_paid ??
                                                            0,
                                                    )
                                                }}</span
                                            >
                                            <span
                                                >{{
                                                    customer.open_documents_count ??
                                                    0
                                                }}
                                                docs</span
                                            >
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <p
                                            class="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-300"
                                        >
                                            {{
                                                formatCurrency(
                                                    customer.current_balance,
                                                )
                                            }}
                                        </p>
                                        <p
                                            class="mt-1 text-[11px] text-slate-500"
                                        >
                                            Lim.
                                            {{
                                                formatCurrency(
                                                    customer.credit_limit ?? 0,
                                                )
                                            }}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </section>

                    <FinanceAgingBars
                        :buckets="summary?.aging_buckets"
                        :currency-formatter="formatCurrency"
                    />
                </aside>

                <main class="space-y-4">
                    <section
                        v-if="!selectedCustomer"
                        class="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-950"
                    >
                        <Shield class="mx-auto text-slate-300" :size="44" />
                        <h2
                            class="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100"
                        >
                            Selecciona un cliente
                        </h2>
                        <p
                            class="mt-1 text-sm text-slate-500 dark:text-slate-400"
                        >
                            El estado de cuenta, documentos y cobros apareceran
                            aqui.
                        </p>
                    </section>

                    <template v-else>
                        <section
                            class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                        >
                            <div
                                class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
                            >
                                <div>
                                    <p
                                        class="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                                    >
                                        Estado de cuenta
                                    </p>
                                    <h2
                                        class="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-50"
                                    >
                                        {{ selectedCustomer.name }}
                                    </h2>
                                    <p
                                        class="mt-1 text-sm text-slate-500 dark:text-slate-400"
                                    >
                                        {{
                                            selectedCustomer.email ||
                                            selectedCustomer.phone ||
                                            selectedCustomer.code ||
                                            'Sin contacto'
                                        }}
                                    </p>
                                </div>
                                <div class="flex flex-wrap items-center gap-2">
                                    <Link
                                        :href="`/customers/${selectedCustomer.id}`"
                                        class="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                                    >
                                        <ExternalLink :size="16" />
                                        Perfil
                                    </Link>
                                    <button
                                        type="button"
                                        :disabled="selectedBalance <= 0"
                                        class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                                        @click="openPayment"
                                    >
                                        <Banknote :size="16" />
                                        Registrar cobro
                                    </button>
                                </div>
                            </div>

                            <div class="mt-4 grid gap-3 md:grid-cols-4">
                                <FinanceKpiCard
                                    label="Saldo pendiente"
                                    :value="formatCurrency(selectedBalance)"
                                    :detail="`${documents.length} documentos`"
                                    accent="indigo"
                                    :icon="CreditCard"
                                />
                                <FinanceKpiCard
                                    label="Facturado"
                                    :value="
                                        formatCurrency(
                                            statement?.summary?.total_billed ??
                                                selectedCustomer.total_billed ??
                                                0,
                                        )
                                    "
                                    detail="Documentos abiertos"
                                    accent="sky"
                                    :icon="ReceiptText"
                                />
                                <FinanceKpiCard
                                    label="Cobrado"
                                    :value="
                                        formatCurrency(
                                            statement?.summary?.total_paid ??
                                                selectedCustomer.total_paid ??
                                                0,
                                        )
                                    "
                                    detail="Aplicado a documentos"
                                    accent="emerald"
                                    :icon="Banknote"
                                />
                                <FinanceKpiCard
                                    label="Credito disponible"
                                    :value="
                                        formatCurrency(
                                            selectedCustomer.available_credit ??
                                                0,
                                        )
                                    "
                                    :detail="`Limite ${formatCurrency(selectedCustomer.credit_limit ?? 0)}`"
                                    accent="amber"
                                    :icon="Shield"
                                />
                            </div>
                        </section>

                        <div class="grid gap-4 xl:grid-cols-[1fr_320px]">
                            <section
                                class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
                            >
                                <div
                                    class="border-b border-slate-200 px-4 py-3 dark:border-slate-800"
                                >
                                    <h3
                                        class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                                    >
                                        Documentos abiertos
                                    </h3>
                                </div>
                                <div
                                    v-if="loadingDetails"
                                    class="p-8 text-center text-sm text-slate-500"
                                >
                                    Cargando estado de cuenta...
                                </div>
                                <div v-else class="overflow-x-auto">
                                    <table
                                        class="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800"
                                    >
                                        <thead
                                            class="bg-slate-50 dark:bg-slate-900"
                                        >
                                            <tr>
                                                <th
                                                    class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                >
                                                    Factura
                                                </th>
                                                <th
                                                    class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                >
                                                    Fecha
                                                </th>
                                                <th
                                                    class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                >
                                                    Vence
                                                </th>
                                                <th
                                                    class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                >
                                                    Total
                                                </th>
                                                <th
                                                    class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                >
                                                    Pagado
                                                </th>
                                                <th
                                                    class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                >
                                                    Pendiente
                                                </th>
                                                <th
                                                    class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                >
                                                    Estado
                                                </th>
                                                <th
                                                    class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                >
                                                    Aplicar
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody
                                            class="divide-y divide-slate-100 dark:divide-slate-800"
                                        >
                                            <tr
                                                v-for="document in documents"
                                                :key="document.id"
                                                class="hover:bg-slate-50 dark:hover:bg-slate-900/60"
                                            >
                                                <td
                                                    class="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100"
                                                >
                                                    {{
                                                        document.document_number
                                                    }}
                                                    <p
                                                        class="mt-1 text-[11px] font-normal text-slate-500"
                                                    >
                                                        {{
                                                            documentPaymentMethods(
                                                                document,
                                                            )
                                                        }}
                                                    </p>
                                                </td>
                                                <td
                                                    class="px-4 py-3 text-slate-600 dark:text-slate-300"
                                                >
                                                    {{
                                                        formatDate(
                                                            document.date,
                                                        )
                                                    }}
                                                </td>
                                                <td
                                                    class="px-4 py-3 text-slate-600 dark:text-slate-300"
                                                >
                                                    {{
                                                        formatDate(
                                                            document.due_date,
                                                        )
                                                    }}
                                                </td>
                                                <td
                                                    class="px-4 py-3 text-right text-slate-600 tabular-nums dark:text-slate-300"
                                                >
                                                    {{
                                                        formatCurrency(
                                                            document.total,
                                                        )
                                                    }}
                                                </td>
                                                <td
                                                    class="px-4 py-3 text-right text-slate-600 tabular-nums dark:text-slate-300"
                                                >
                                                    {{
                                                        formatCurrency(
                                                            document.amount_paid,
                                                        )
                                                    }}
                                                </td>
                                                <td
                                                    class="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums dark:text-slate-100"
                                                >
                                                    {{
                                                        formatCurrency(
                                                            document.amount_due,
                                                        )
                                                    }}
                                                </td>
                                                <td class="px-4 py-3">
                                                    <span
                                                        class="rounded-full px-2 py-1 text-xs font-semibold ring-1"
                                                        :class="
                                                            statusClass(
                                                                document.status_label,
                                                            )
                                                        "
                                                    >
                                                        {{
                                                            document.status_label ??
                                                            'Corriente'
                                                        }}
                                                    </span>
                                                </td>
                                                <td
                                                    class="px-4 py-3 text-right"
                                                >
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        :max="
                                                            document.amount_due
                                                        "
                                                        step="0.01"
                                                        class="h-9 w-28 rounded-md border border-slate-200 bg-white px-2 text-right text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                                        :placeholder="
                                                            formatCurrency(
                                                                document.amount_due,
                                                            )
                                                        "
                                                        @input="
                                                            onApplicationInput(
                                                                document.id,
                                                                $event,
                                                            )
                                                        "
                                                    />
                                                </td>
                                            </tr>
                                            <tr v-if="documents.length === 0">
                                                <td
                                                    colspan="8"
                                                    class="px-4 py-10 text-center text-slate-500"
                                                >
                                                    Sin documentos abiertos.
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <aside class="space-y-4">
                                <FinanceAgingBars
                                    :buckets="selectedAging"
                                    :currency-formatter="formatCurrency"
                                />
                                <section
                                    class="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
                                >
                                    <div
                                        class="border-b border-slate-200 px-4 py-3 dark:border-slate-800"
                                    >
                                        <h3
                                            class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                                        >
                                            Movimientos recientes
                                        </h3>
                                    </div>
                                    <div
                                        class="divide-y divide-slate-100 dark:divide-slate-800"
                                    >
                                        <div
                                            v-for="movement in recentMovements"
                                            :key="movement.id"
                                            class="px-4 py-3"
                                        >
                                            <div
                                                class="flex items-start justify-between gap-3"
                                            >
                                                <div class="min-w-0">
                                                    <p
                                                        class="truncate text-sm font-medium text-slate-900 dark:text-slate-100"
                                                    >
                                                        {{
                                                            movement.batch_number ||
                                                            movement.document_number ||
                                                            movement.movement_type
                                                        }}
                                                    </p>
                                                    <p
                                                        class="mt-0.5 text-xs text-slate-500 dark:text-slate-400"
                                                    >
                                                        {{
                                                            formatDate(
                                                                String(
                                                                    movement.occurred_at ||
                                                                        '',
                                                                ).slice(0, 10),
                                                            )
                                                        }}
                                                    </p>
                                                </div>
                                                <p
                                                    class="text-right text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100"
                                                >
                                                    {{
                                                        formatCurrency(
                                                            Number(
                                                                movement.credit ||
                                                                    0,
                                                            ) ||
                                                                Number(
                                                                    movement.debit ||
                                                                        0,
                                                                ),
                                                        )
                                                    }}
                                                </p>
                                            </div>
                                        </div>
                                        <div
                                            v-if="recentMovements.length === 0"
                                            class="px-4 py-8 text-center text-sm text-slate-500"
                                        >
                                            Sin movimientos registrados.
                                        </div>
                                    </div>
                                </section>
                            </aside>
                        </div>
                    </template>
                </main>
            </div>
        </div>

        <OperationalPaymentPanel
            :show="showPaymentModal"
            :amount-to-charge="selectedBalance"
            mode="sale"
            :customer="selectedPaymentCustomer"
            title="Registrar cobro de cuenta"
            primary-action-label="Registrar cobro"
            cancel-label="Cancelar"
            :show-reference-number="true"
            :show-notes="true"
            reference-number-label="Referencia"
            notes-label="Notas del cobro"
            :loading="paymentLoading"
            :error="paymentError"
            :allow-partial="true"
            :allowed-method-codes="['cash', 'card', 'transfer', 'other']"
            @finish="handlePaymentFinish"
            @cancel="closePayment"
        />
    </AppLayout>
</template>
