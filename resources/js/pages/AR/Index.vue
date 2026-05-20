<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Head, Link } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import { AccountsReceivableApiService } from '@/services/payments';
import OperationalPaymentPanel from '@/components/POS/OperationalPaymentPanel.vue';
import {
    AlertCircle,
    Banknote,
    Clock,
    ExternalLink,
    FileText,
    ReceiptText,
    Search,
    TrendingUp,
    Users,
} from 'lucide-vue-next';

interface Debtor {
    id: number;
    code?: string | null;
    name: string;
    email?: string | null;
    phone?: string | null;
    current_balance: number;
    open_documents_count?: number;
}

interface StatementDocument {
    id: number;
    document_type?: string;
    document_number: string;
    date?: string | null;
    total: number;
    amount_paid: number;
    amount_due: number;
    payment_status: string;
}

interface Statement {
    account: Debtor;
    documents: StatementDocument[];
    entries: Array<Record<string, any>>;
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
const totalReceivable = computed(() =>
    debtors.value.reduce(
        (sum, customer) => sum + Number(customer.current_balance || 0),
        0,
    ),
);
const customersWithBalance = computed(() =>
    debtors.value.filter(
        (customer) => Number(customer.current_balance || 0) > 0,
    ),
);
const openDocumentsCount = computed(() =>
    debtors.value.reduce(
        (sum, customer) => sum + Number(customer.open_documents_count || 0),
        0,
    ),
);
const selectedBalance = computed(() =>
    Number(
        statement.value?.account?.current_balance ??
            selectedCustomer.value?.current_balance ??
            0,
    ),
);
const selectedDocumentsTotal = computed(() =>
    documents.value.reduce(
        (sum, document) => sum + Number(document.amount_due || 0),
        0,
    ),
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

    return new Date(date).toLocaleDateString('es-PA');
};

const extractDebtors = (response: any): Debtor[] => {
    const data = response?.data ?? response;

    return Array.isArray(data) ? data : [];
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

    searchTimeout = setTimeout(() => fetchDebtors(), 300);
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
        <div
            class="min-h-[calc(100vh-4.25rem)] bg-gray-50/60 p-4 dark:bg-background"
        >
            <div class="mx-auto max-w-7xl space-y-4">
                <div
                    class="flex flex-col gap-3 border-b border-gray-200 pb-4 lg:flex-row lg:items-center lg:justify-between dark:border-border"
                >
                    <div>
                        <p
                            class="text-xs font-semibold tracking-wide text-amber-600 uppercase dark:text-amber-400"
                        >
                            Crédito cliente
                        </p>
                        <h1
                            class="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white"
                        >
                            <TrendingUp :size="24" class="text-emerald-500" />
                            Cuentas por cobrar
                        </h1>
                        <p
                            class="mt-1 text-sm text-gray-500 dark:text-gray-400"
                        >
                            Clientes con ventas pendientes o parcialmente
                            cobradas.
                        </p>
                    </div>
                    <Link
                        href="/customers"
                        class="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-gray-200 dark:hover:bg-muted"
                    >
                        <ExternalLink :size="16" />
                        Ver clientes
                    </Link>
                </div>

                <div
                    v-if="activeReportFilters"
                    class="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100"
                >
                    Vista filtrada desde reportes:
                    <span class="font-semibold">{{ reportFilterSummary }}</span>
                </div>

                <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div
                        class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"
                    >
                        <p
                            class="text-xs font-semibold text-amber-700 uppercase dark:text-amber-300"
                        >
                            Total por cobrar
                        </p>
                        <p
                            class="mt-2 text-2xl font-bold text-amber-900 dark:text-amber-100"
                        >
                            {{ formatCurrency(totalReceivable) }}
                        </p>
                    </div>
                    <div
                        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                    >
                        <p
                            class="text-xs font-semibold text-gray-500 uppercase"
                        >
                            Clientes
                        </p>
                        <p
                            class="mt-2 text-2xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ customersWithBalance.length }}
                        </p>
                    </div>
                    <div
                        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                    >
                        <p
                            class="text-xs font-semibold text-gray-500 uppercase"
                        >
                            Docs. abiertos
                        </p>
                        <p
                            class="mt-2 text-2xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ openDocumentsCount }}
                        </p>
                    </div>
                    <div
                        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                    >
                        <p
                            class="text-xs font-semibold text-gray-500 uppercase"
                        >
                            Seleccionado
                        </p>
                        <p
                            class="mt-2 text-2xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ formatCurrency(selectedBalance) }}
                        </p>
                    </div>
                </div>

                <div
                    v-if="error"
                    class="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                >
                    <AlertCircle :size="18" />
                    {{ error }}
                </div>

                <div class="grid gap-4 xl:grid-cols-[25rem_1fr]">
                    <section
                        class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                    >
                        <div
                            class="space-y-3 border-b border-gray-200 px-4 py-3 dark:border-border"
                        >
                            <div class="flex items-center justify-between">
                                <div>
                                    <h2
                                        class="text-sm font-bold text-gray-900 dark:text-white"
                                    >
                                        Clientes con saldo
                                    </h2>
                                    <p class="text-xs text-gray-500">
                                        Ordenado por saldo pendiente
                                    </p>
                                </div>
                                <Users :size="18" class="text-gray-400" />
                            </div>
                            <div class="relative">
                                <Search
                                    class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                                />
                                <input
                                    v-model="searchQuery"
                                    type="text"
                                    placeholder="Buscar cliente..."
                                    class="w-full rounded-md border border-gray-300 bg-gray-50 py-2 pr-3 pl-9 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                    @input="onSearch"
                                />
                            </div>
                        </div>

                        <div
                            v-if="loading"
                            class="p-6 text-center text-sm text-gray-500"
                        >
                            Cargando clientes...
                        </div>
                        <div
                            v-else-if="debtors.length === 0"
                            class="p-8 text-center text-sm text-gray-500"
                        >
                            <ReceiptText
                                class="mx-auto mb-2 text-gray-300"
                                :size="36"
                            />
                            No hay cuentas por cobrar pendientes.
                        </div>
                        <div
                            v-else
                            class="max-h-[34rem] divide-y divide-gray-100 overflow-y-auto dark:divide-border"
                        >
                            <button
                                v-for="customer in debtors"
                                :key="customer.id"
                                type="button"
                                :class="[
                                    'w-full px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-muted/50',
                                    selectedCustomer?.id === customer.id
                                        ? 'bg-amber-50/80 dark:bg-amber-950/20'
                                        : '',
                                ]"
                                @click="loadStatement(customer)"
                            >
                                <div
                                    class="flex items-start justify-between gap-3"
                                >
                                    <div class="min-w-0">
                                        <p
                                            class="truncate text-sm font-semibold text-gray-900 dark:text-white"
                                        >
                                            {{ customer.name }}
                                        </p>
                                        <p
                                            class="truncate text-xs text-gray-500"
                                        >
                                            {{
                                                customer.email ||
                                                customer.phone ||
                                                'Sin contacto'
                                            }}
                                        </p>
                                        <p class="mt-1 text-xs text-gray-500">
                                            {{
                                                customer.open_documents_count ||
                                                0
                                            }}
                                            docs. abiertos
                                        </p>
                                    </div>
                                    <div class="text-right">
                                        <p
                                            class="font-mono text-sm font-bold text-amber-600 dark:text-amber-300"
                                        >
                                            {{
                                                formatCurrency(
                                                    customer.current_balance,
                                                )
                                            }}
                                        </p>
                                        <Link
                                            :href="`/customers/${customer.id}`"
                                            class="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                                            @click.stop
                                        >
                                            Ver cliente
                                            <ExternalLink :size="12" />
                                        </Link>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </section>

                    <section
                        class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                    >
                        <div
                            class="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 md:flex-row md:items-center md:justify-between dark:border-border"
                        >
                            <div>
                                <h2
                                    class="text-sm font-bold text-gray-900 dark:text-white"
                                >
                                    {{
                                        selectedCustomer
                                            ? selectedCustomer.name
                                            : 'Selecciona un cliente'
                                    }}
                                </h2>
                                <p class="text-xs text-gray-500">
                                    Documentos abiertos, saldo y movimientos
                                    recientes.
                                </p>
                            </div>
                            <div
                                v-if="selectedCustomer"
                                class="flex items-center gap-2"
                            >
                                <Link
                                    :href="`/sales-orders?customer_id=${selectedCustomer.id}`"
                                    class="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200 dark:hover:bg-muted"
                                >
                                    <FileText :size="15" />
                                    Ver ventas
                                </Link>
                                <button
                                    type="button"
                                    :disabled="selectedBalance <= 0"
                                    class="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                                    @click="openPayment"
                                >
                                    <Banknote :size="15" />
                                    Registrar cobro
                                </button>
                            </div>
                        </div>

                        <div
                            v-if="!selectedCustomer"
                            class="p-10 text-center text-sm text-gray-500"
                        >
                            Selecciona un cliente para ver documentos
                            pendientes.
                        </div>
                        <div
                            v-else-if="loadingDetails"
                            class="p-6 text-sm text-gray-500"
                        >
                            Cargando estado de cuenta...
                        </div>
                        <div
                            v-else
                            class="grid gap-4 p-4 xl:grid-cols-[1fr_18rem]"
                        >
                            <div class="space-y-3">
                                <div class="grid grid-cols-3 gap-2">
                                    <div
                                        class="rounded-md bg-gray-50 p-3 dark:bg-muted/40"
                                    >
                                        <p class="text-xs text-gray-500">
                                            Documentos
                                        </p>
                                        <p
                                            class="mt-1 text-lg font-bold text-gray-900 dark:text-white"
                                        >
                                            {{ documents.length }}
                                        </p>
                                    </div>
                                    <div
                                        class="rounded-md bg-gray-50 p-3 dark:bg-muted/40"
                                    >
                                        <p class="text-xs text-gray-500">
                                            Saldo docs.
                                        </p>
                                        <p
                                            class="mt-1 text-lg font-bold text-amber-600 dark:text-amber-300"
                                        >
                                            {{
                                                formatCurrency(
                                                    selectedDocumentsTotal,
                                                )
                                            }}
                                        </p>
                                    </div>
                                    <div
                                        class="rounded-md bg-gray-50 p-3 dark:bg-muted/40"
                                    >
                                        <p class="text-xs text-gray-500">
                                            Movimientos
                                        </p>
                                        <p
                                            class="mt-1 text-lg font-bold text-gray-900 dark:text-white"
                                        >
                                            {{ recentMovements.length }}
                                        </p>
                                    </div>
                                </div>

                                <div
                                    class="overflow-hidden rounded-md border border-gray-200 dark:border-border"
                                >
                                    <table class="min-w-full text-sm">
                                        <thead
                                            class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/40"
                                        >
                                            <tr>
                                                <th class="px-3 py-2 text-left">
                                                    Venta
                                                </th>
                                                <th class="px-3 py-2 text-left">
                                                    Fecha
                                                </th>
                                                <th
                                                    class="px-3 py-2 text-right"
                                                >
                                                    Total
                                                </th>
                                                <th
                                                    class="px-3 py-2 text-right"
                                                >
                                                    Cobrado
                                                </th>
                                                <th
                                                    class="px-3 py-2 text-right"
                                                >
                                                    Saldo
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody
                                            class="divide-y divide-gray-100 dark:divide-border"
                                        >
                                            <tr v-if="documents.length === 0">
                                                <td
                                                    colspan="5"
                                                    class="px-3 py-8 text-center text-gray-500"
                                                >
                                                    No hay documentos pendientes
                                                    para este cliente.
                                                </td>
                                            </tr>
                                            <tr
                                                v-for="document in documents"
                                                :key="document.id"
                                                class="hover:bg-gray-50 dark:hover:bg-muted/40"
                                            >
                                                <td class="px-3 py-2">
                                                    <Link
                                                        v-if="
                                                            document.document_type ===
                                                                'sales_order' ||
                                                            !document.document_type
                                                        "
                                                        :href="`/sales-orders/${document.id}`"
                                                        class="font-mono font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                                                    >
                                                        {{
                                                            document.document_number
                                                        }}
                                                    </Link>
                                                    <span
                                                        v-else
                                                        class="font-mono font-semibold text-gray-900 dark:text-white"
                                                    >
                                                        {{
                                                            document.document_number
                                                        }}
                                                    </span>
                                                    <p
                                                        class="mt-0.5 text-xs text-gray-500"
                                                    >
                                                        {{
                                                            document.payment_status ===
                                                            'partial'
                                                                ? 'Cobro parcial'
                                                                : 'Pendiente'
                                                        }}
                                                    </p>
                                                </td>
                                                <td
                                                    class="px-3 py-2 text-gray-600 dark:text-gray-300"
                                                >
                                                    {{
                                                        formatDate(
                                                            document.date,
                                                        )
                                                    }}
                                                </td>
                                                <td
                                                    class="px-3 py-2 text-right font-mono"
                                                >
                                                    {{
                                                        formatCurrency(
                                                            document.total,
                                                        )
                                                    }}
                                                </td>
                                                <td
                                                    class="px-3 py-2 text-right font-mono text-green-600"
                                                >
                                                    {{
                                                        formatCurrency(
                                                            document.amount_paid,
                                                        )
                                                    }}
                                                </td>
                                                <td
                                                    class="px-3 py-2 text-right font-mono font-bold text-amber-600"
                                                >
                                                    {{
                                                        formatCurrency(
                                                            document.amount_due,
                                                        )
                                                    }}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <aside
                                class="rounded-md border border-gray-200 dark:border-border"
                            >
                                <div
                                    class="border-b border-gray-200 px-3 py-2 dark:border-border"
                                >
                                    <h3
                                        class="text-xs font-bold text-gray-500 uppercase"
                                    >
                                        Últimos movimientos
                                    </h3>
                                </div>
                                <div
                                    v-if="recentMovements.length === 0"
                                    class="p-4 text-sm text-gray-500"
                                >
                                    Sin movimientos registrados.
                                </div>
                                <div
                                    v-else
                                    class="divide-y divide-gray-100 dark:divide-border"
                                >
                                    <div
                                        v-for="entry in recentMovements"
                                        :key="entry.id"
                                        class="px-3 py-2"
                                    >
                                        <div
                                            class="flex items-center justify-between gap-2"
                                        >
                                            <p
                                                class="truncate text-sm font-semibold text-gray-900 dark:text-white"
                                            >
                                                {{
                                                    entry.batch_number ||
                                                    entry.reference_number ||
                                                    entry.document_number ||
                                                    'Movimiento'
                                                }}
                                            </p>
                                            <p
                                                class="font-mono text-sm font-bold text-green-600"
                                            >
                                                {{
                                                    formatCurrency(
                                                        entry.credit ||
                                                            entry.debit ||
                                                            0,
                                                    )
                                                }}
                                            </p>
                                        </div>
                                        <p
                                            class="mt-1 flex items-center gap-1 text-xs text-gray-500"
                                        >
                                            <Clock :size="12" />
                                            {{ formatDate(entry.occurred_at) }}
                                        </p>
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </section>
                </div>
            </div>
        </div>

        <OperationalPaymentPanel
            mode="sale"
            :show="showPaymentModal"
            :amount-to-charge="selectedBalance"
            :subtotal="selectedBalance"
            title="Registrar cobro cliente"
            primary-action-label="Registrar cobro"
            cancel-label="Cancelar"
            allow-partial
            :allowed-method-codes="['cash', 'card', 'transfer', 'other']"
            show-reference-number
            show-notes
            reference-number-label="Número de recibo"
            notes-label="Notas"
            :loading="paymentLoading"
            :error="paymentError"
            @finish="handlePaymentFinish"
            @cancel="closePayment"
        >
            <template #details>
                <div
                    v-if="documents.length > 0"
                    class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <div
                        class="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-border"
                    >
                        <span class="text-xs font-bold text-gray-500 uppercase">
                            Aplicación manual opcional
                        </span>
                        <span class="text-xs text-gray-500">
                            {{ formatCurrency(manualApplicationTotal) }}
                            aplicado
                        </span>
                    </div>
                    <div
                        class="max-h-48 divide-y divide-gray-100 overflow-y-auto dark:divide-border"
                    >
                        <div
                            v-for="document in documents"
                            :key="`application-${document.id}`"
                            class="grid grid-cols-[1fr_8rem] items-center gap-3 px-3 py-2"
                        >
                            <div class="min-w-0">
                                <p
                                    class="truncate text-sm font-medium text-gray-900 dark:text-white"
                                >
                                    {{ document.document_number }}
                                </p>
                                <p class="text-xs text-gray-500">
                                    Pendiente:
                                    {{ formatCurrency(document.amount_due) }}
                                </p>
                            </div>
                            <input
                                type="number"
                                min="0"
                                :max="document.amount_due"
                                step="0.01"
                                class="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-right text-sm dark:border-border dark:bg-muted dark:text-white"
                                :value="manualApplications[document.id] || ''"
                                @input="
                                    setApplicationAmount(
                                        document.id,
                                        ($event.target as HTMLInputElement)
                                            .value,
                                    )
                                "
                            />
                        </div>
                    </div>
                </div>
            </template>
        </OperationalPaymentPanel>
    </AppLayout>
</template>
