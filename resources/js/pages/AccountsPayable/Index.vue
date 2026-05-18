<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Head, Link } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import {
    AlertCircle,
    Banknote,
    Building2,
    Clock,
    ExternalLink,
    FileText,
    ReceiptText,
    TrendingDown,
} from 'lucide-vue-next';
import apiClient from '@/services/api/client';
import OperationalPaymentPanel from '@/components/POS/OperationalPaymentPanel.vue';

interface Payment {
    method: string;
    amount: number;
}

interface PaymentMeta {
    reference_number?: string | null;
    notes?: string | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Cuentas por Pagar', href: '/accounts-payable' },
];

const suppliers = ref<any[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const selectedSupplier = ref<any | null>(null);
const supplierStatement = ref<any | null>(null);
const loadingStatement = ref(false);
const showPaymentModal = ref(false);
const paymentLoading = ref(false);
const paymentError = ref<string | null>(null);
const manualApplications = ref<Record<number, number>>({});

const documents = computed<any[]>(
    () => supplierStatement.value?.documents ?? [],
);
const ledgerEntries = computed<any[]>(
    () => supplierStatement.value?.entries ?? [],
);
const recentPayments = computed(() =>
    ledgerEntries.value
        .filter((entry: any) => Number(entry.credit || 0) > 0)
        .slice(0, 6),
);

const totalDebt = computed(() =>
    suppliers.value.reduce(
        (sum: number, supplier: any) => sum + Number(supplier.total_debt || 0),
        0,
    ),
);
const suppliersWithDebt = computed(() =>
    suppliers.value.filter((supplier: any) => supplier.total_debt > 0),
);
const pendingOrdersCount = computed(() =>
    suppliers.value.reduce(
        (sum: number, supplier: any) =>
            sum + Number(supplier.pending_orders_count || 0),
        0,
    ),
);
const selectedDebt = computed(() =>
    Number(selectedSupplier.value?.total_debt || 0),
);
const selectedDocumentsTotal = computed(() =>
    documents.value.reduce(
        (sum: number, document: any) => sum + Number(document.amount_due || 0),
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

const money = (value: number): number =>
    Math.round((Number(value) || 0) * 100) / 100;

const formatCurrency = (value: any) =>
    new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
    }).format(Number(value) || 0);

const formatDate = (value?: string | null): string => {
    if (!value) {
        return '-';
    }

    return new Date(value).toLocaleDateString('es-PA');
};

async function loadAccountsPayable() {
    loading.value = true;
    error.value = null;

    try {
        const res = await apiClient.get('/accounts-payable');
        suppliers.value = res.data.data || res.data;
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            'Error al cargar las cuentas por pagar.';
    } finally {
        loading.value = false;
    }
}

async function loadSupplierStatement(supplier: any) {
    selectedSupplier.value = supplier;
    supplierStatement.value = null;
    loadingStatement.value = true;

    try {
        const res = await apiClient.get(
            `/accounts-payable/${supplier.id}/statement`,
        );
        supplierStatement.value = res.data.data || res.data;
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            'Error al cargar el estado de cuenta del proveedor.';
    } finally {
        loadingStatement.value = false;
    }
}

const openPayment = () => {
    if (!selectedSupplier.value || selectedDebt.value <= 0) {
        return;
    }

    manualApplications.value = {};
    paymentError.value = null;
    showPaymentModal.value = true;
};

const closePayment = () => {
    showPaymentModal.value = false;
    paymentError.value = null;
};

const setApplicationAmount = (documentId: number, value: string) => {
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

async function handlePaymentFinish(payments: Payment[], meta: PaymentMeta) {
    if (!selectedSupplier.value) {
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
        paymentError.value = 'El monto aplicado excede el monto del pago.';
        return;
    }

    paymentLoading.value = true;

    try {
        const allocateApplications =
            createApplicationAllocator(buildApplications());

        for (const payment of realPayments) {
            await apiClient.post(
                `/accounts-payable/${selectedSupplier.value.id}/payments`,
                {
                    amount: money(payment.amount),
                    method: payment.method,
                    reference_number: meta.reference_number || undefined,
                    notes: meta.notes || undefined,
                    applications: allocateApplications(payment.amount),
                },
            );
        }

        showPaymentModal.value = false;
        const supplierId = selectedSupplier.value.id;
        await loadAccountsPayable();
        const refreshed = suppliers.value.find(
            (item: any) => item.id === supplierId,
        );

        if (refreshed) {
            await loadSupplierStatement(refreshed);
        } else {
            selectedSupplier.value = null;
            supplierStatement.value = null;
        }
    } catch (e: any) {
        paymentError.value =
            e.response?.data?.message || 'Error al registrar el pago.';
    } finally {
        paymentLoading.value = false;
    }
}

onMounted(loadAccountsPayable);
</script>

<template>
    <Head title="Cuentas por Pagar" />
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
                            class="text-xs font-semibold tracking-wide text-red-600 uppercase dark:text-red-400"
                        >
                            Credito compra
                        </p>
                        <h1
                            class="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white"
                        >
                            <TrendingDown :size="24" class="text-red-500" />
                            Cuentas por pagar
                        </h1>
                        <p
                            class="mt-1 text-sm text-gray-500 dark:text-gray-400"
                        >
                            Proveedores con OCs pendientes o parcialmente
                            pagadas.
                        </p>
                    </div>
                    <Link
                        href="/purchase-orders"
                        class="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-gray-200 dark:hover:bg-muted"
                    >
                        <ExternalLink :size="16" />
                        Ver ordenes de compra
                    </Link>
                </div>

                <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div
                        class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20"
                    >
                        <p
                            class="text-xs font-semibold text-red-700 uppercase dark:text-red-300"
                        >
                            Total adeudado
                        </p>
                        <p
                            class="mt-2 text-2xl font-bold text-red-900 dark:text-red-100"
                        >
                            {{ formatCurrency(totalDebt) }}
                        </p>
                    </div>
                    <div
                        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                    >
                        <p
                            class="text-xs font-semibold text-gray-500 uppercase"
                        >
                            Proveedores
                        </p>
                        <p
                            class="mt-2 text-2xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ suppliersWithDebt.length }}
                        </p>
                    </div>
                    <div
                        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                    >
                        <p
                            class="text-xs font-semibold text-gray-500 uppercase"
                        >
                            OCs abiertas
                        </p>
                        <p
                            class="mt-2 text-2xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ pendingOrdersCount }}
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
                            {{ formatCurrency(selectedDebt) }}
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
                            class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-border"
                        >
                            <div>
                                <h2
                                    class="text-sm font-bold text-gray-900 dark:text-white"
                                >
                                    Proveedores con saldo
                                </h2>
                                <p class="text-xs text-gray-500">
                                    Ordenado por deuda pendiente
                                </p>
                            </div>
                            <Building2 :size="18" class="text-gray-400" />
                        </div>

                        <div
                            v-if="loading"
                            class="p-6 text-center text-sm text-gray-500"
                        >
                            Cargando proveedores...
                        </div>
                        <div
                            v-else-if="suppliers.length === 0"
                            class="p-8 text-center text-sm text-gray-500"
                        >
                            <ReceiptText
                                class="mx-auto mb-2 text-gray-300"
                                :size="36"
                            />
                            No hay cuentas por pagar pendientes.
                        </div>
                        <div
                            v-else
                            class="max-h-[34rem] divide-y divide-gray-100 overflow-y-auto dark:divide-border"
                        >
                            <button
                                v-for="supplier in suppliers"
                                :key="supplier.id"
                                type="button"
                                :class="[
                                    'w-full px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-muted/50',
                                    selectedSupplier?.id === supplier.id
                                        ? 'bg-red-50/80 dark:bg-red-950/20'
                                        : '',
                                ]"
                                @click="loadSupplierStatement(supplier)"
                            >
                                <div
                                    class="flex items-start justify-between gap-3"
                                >
                                    <div class="min-w-0">
                                        <p
                                            class="truncate text-sm font-semibold text-gray-900 dark:text-white"
                                        >
                                            {{ supplier.name }}
                                        </p>
                                        <p
                                            class="truncate text-xs text-gray-500"
                                        >
                                            {{
                                                supplier.email ||
                                                supplier.phone ||
                                                'Sin contacto'
                                            }}
                                        </p>
                                        <p class="mt-1 text-xs text-gray-500">
                                            {{
                                                supplier.pending_orders_count ||
                                                0
                                            }}
                                            OC pendientes
                                        </p>
                                    </div>
                                    <div class="text-right">
                                        <p
                                            class="font-mono text-sm font-bold text-red-600 dark:text-red-300"
                                        >
                                            {{
                                                formatCurrency(
                                                    supplier.total_debt,
                                                )
                                            }}
                                        </p>
                                        <Link
                                            :href="`/purchase-orders?supplier_id=${supplier.id}`"
                                            class="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                                            @click.stop
                                        >
                                            Ver OCs
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
                                        selectedSupplier
                                            ? selectedSupplier.name
                                            : 'Selecciona un proveedor'
                                    }}
                                </h2>
                                <p class="text-xs text-gray-500">
                                    Documentos abiertos, saldo y pagos
                                    recientes.
                                </p>
                            </div>
                            <div
                                v-if="selectedSupplier"
                                class="flex items-center gap-2"
                            >
                                <Link
                                    :href="`/purchase-orders?supplier_id=${selectedSupplier.id}`"
                                    class="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200 dark:hover:bg-muted"
                                >
                                    <FileText :size="15" />
                                    Ver OCs
                                </Link>
                                <button
                                    type="button"
                                    :disabled="selectedDebt <= 0"
                                    class="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                                    @click="openPayment"
                                >
                                    <Banknote :size="15" />
                                    Registrar pago
                                </button>
                            </div>
                        </div>

                        <div
                            v-if="!selectedSupplier"
                            class="p-10 text-center text-sm text-gray-500"
                        >
                            Selecciona un proveedor para ver documentos
                            pendientes.
                        </div>
                        <div
                            v-else-if="loadingStatement"
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
                                            class="mt-1 text-lg font-bold text-red-600 dark:text-red-300"
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
                                            Pagos
                                        </p>
                                        <p
                                            class="mt-1 text-lg font-bold text-gray-900 dark:text-white"
                                        >
                                            {{ recentPayments.length }}
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
                                                    OC
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
                                                    Pagado
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
                                                    para este proveedor.
                                                </td>
                                            </tr>
                                            <tr
                                                v-for="document in documents"
                                                :key="document.id"
                                                class="hover:bg-gray-50 dark:hover:bg-muted/40"
                                            >
                                                <td class="px-3 py-2">
                                                    <Link
                                                        :href="`/purchase-orders/${document.id}`"
                                                        class="font-mono font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                                                    >
                                                        {{
                                                            document.document_number
                                                        }}
                                                    </Link>
                                                    <p
                                                        v-if="
                                                            document.supplier_invoice_number
                                                        "
                                                        class="mt-0.5 text-xs text-gray-500"
                                                    >
                                                        Factura:
                                                        {{
                                                            document.supplier_invoice_number
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
                                                    class="px-3 py-2 text-right font-mono font-bold text-red-600"
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
                                        Pagos recientes
                                    </h3>
                                </div>
                                <div
                                    v-if="recentPayments.length === 0"
                                    class="p-4 text-sm text-gray-500"
                                >
                                    Sin pagos registrados.
                                </div>
                                <div
                                    v-else
                                    class="divide-y divide-gray-100 dark:divide-border"
                                >
                                    <div
                                        v-for="entry in recentPayments"
                                        :key="entry.id"
                                        class="px-3 py-2"
                                    >
                                        <div
                                            class="flex items-center justify-between gap-2"
                                        >
                                            <p
                                                class="text-sm font-semibold text-gray-900 dark:text-white"
                                            >
                                                {{
                                                    entry.batch_number ||
                                                    entry.document_number ||
                                                    'Pago'
                                                }}
                                            </p>
                                            <p
                                                class="font-mono text-sm font-bold text-green-600"
                                            >
                                                {{
                                                    formatCurrency(entry.credit)
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
            mode="purchase"
            :show="showPaymentModal"
            :amount-to-charge="selectedDebt"
            :subtotal="selectedDebt"
            title="Registrar pago proveedor"
            primary-action-label="Registrar pago"
            cancel-label="Cancelar"
            allow-partial
            :allowed-method-codes="['cash', 'card', 'transfer', 'other']"
            show-reference-number
            show-notes
            reference-number-label="Numero de recibo"
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
                            Aplicacion manual opcional
                        </span>
                        <span class="text-xs text-gray-500">
                            {{
                                formatCurrency(manualApplicationTotal)
                            }}
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
