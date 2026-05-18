<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { Head, Link, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { usePurchaseOrders } from '@/composables/usePurchaseOrders';
import { useStoreSettings } from '@/composables/useStoreSettings';
import {
    Copy,
    DollarSign,
    FileText,
    Package,
    PackageCheck,
    Pencil,
    Plus,
    Send,
    Trash2,
    XCircle,
} from 'lucide-vue-next';
import apiClient from '@/services/api/client';
import { purchaseOrdersService } from '@/services/purchase-orders';
import PurchaseOrderSection from '@/components/PurchaseOrders/PurchaseOrderSection.vue';
import PurchaseOrderSideNav from '@/components/PurchaseOrders/PurchaseOrderSideNav.vue';
import PurchaseOrderToolbar from '@/components/PurchaseOrders/PurchaseOrderToolbar.vue';
import OperationalPaymentPanel from '@/components/POS/OperationalPaymentPanel.vue';

const props = defineProps<{ purchaseOrderId: number }>();
const {
    purchaseOrder,
    loading,
    error,
    fetchPurchaseOrderById,
    sendPurchaseOrder,
    cancelPurchaseOrder,
} = usePurchaseOrders();
const { fetchSettings: fetchStoreSettings, resolveTaxRate } =
    useStoreSettings();

const payments = ref<any[]>([]);
const paymentStatus = ref<string>('pending');
const amountPaid = ref<number>(0);
const amountDue = ref<number>(0);
const showPaymentModal = ref(false);
const paymentLoading = ref(false);
const paymentError = ref<string | null>(null);

const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-muted dark:text-gray-300',
    open: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    partial:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    received:
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const paymentStatusColors: Record<string, string> = {
    pending: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    partial:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

const paymentStatusLabels: Record<string, string> = {
    pending: 'Sin pagar',
    partial: 'Pago Parcial',
    paid: 'Pagado',
};

const methodLabels: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia',
    other: 'Otro',
    supplier_credit: 'Credito proveedor',
};

const orderedQuantity = computed(
    () =>
        purchaseOrder.value?.items?.reduce(
            (sum: number, item: any) =>
                sum + Number(item.quantity_ordered || 0),
            0,
        ) ?? 0,
);

const receivedQuantity = computed(
    () =>
        purchaseOrder.value?.items?.reduce(
            (sum: number, item: any) =>
                sum +
                Number(
                    item.effective_received_quantity ??
                        item.quantity_received ??
                        0,
                ),
            0,
        ) ?? 0,
);

const pendingQuantity = computed(() =>
    Math.max(0, orderedQuantity.value - receivedQuantity.value),
);

function isDailyPO(): boolean {
    return !purchaseOrder.value?.supplier;
}

function hasPreAppliedStock(): boolean {
    return !!purchaseOrder.value?.items?.some(
        (item: any) =>
            Number(
                (item.pre_applied_quantity ?? item.pre_stock_applied_qty) || 0,
            ) > 0,
    );
}

function formatDate(value?: string | null): string {
    if (!value) {
        return '-';
    }

    return new Date(value).toLocaleDateString('es-PA');
}

function itemLineTotal(item: any): number {
    return (
        Number(item.total ?? 0) ||
        Number(item.subtotal || 0) + Number(item.tax_amount || 0)
    );
}

function openPdf(mode: 'standard' | 'worksheet' = 'worksheet') {
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(
        /\/$/,
        '',
    );
    const url = `${baseUrl}/purchase-orders/${props.purchaseOrderId}/pdf?mode=${mode}`;
    window.open(url, '_blank');
}

async function loadPayments() {
    const res = await apiClient.get(
        `/purchase-orders/${props.purchaseOrderId}/payments`,
    );
    payments.value = res.data.data;
    amountPaid.value = res.data.amount_paid;
    amountDue.value = res.data.amount_due;
    paymentStatus.value = res.data.payment_status;
}

async function handlePurchasePaymentFinish(
    submittedPayments: { method: string; amount: number }[],
    meta: {
        reference_number?: string | null;
        notes?: string | null;
        supplier_credit_amount?: number;
    },
) {
    paymentLoading.value = true;
    paymentError.value = null;

    try {
        const realPayments = submittedPayments.filter(
            (payment) =>
                payment.amount > 0 && payment.method !== 'supplier_credit',
        );

        for (const payment of realPayments) {
            await apiClient.post(
                `/purchase-orders/${props.purchaseOrderId}/payments`,
                {
                    amount: payment.amount,
                    method: payment.method,
                    reference_number: meta.reference_number || null,
                    notes: meta.notes || null,
                },
            );
        }

        showPaymentModal.value = false;
        await loadPayments();
        await fetchPurchaseOrderById(props.purchaseOrderId);
    } catch (e: any) {
        paymentError.value =
            e.response?.data?.message || 'Error al registrar el pago.';
    } finally {
        paymentLoading.value = false;
    }
}

async function deletePayment(id: number) {
    if (!confirm('Eliminar este pago?')) return;
    await apiClient.delete(
        `/purchase-orders/${props.purchaseOrderId}/payments/${id}`,
    );
    await loadPayments();
}

async function handleSend() {
    if (!confirm('Enviar esta orden al proveedor?')) return;
    await sendPurchaseOrder(props.purchaseOrderId);
    await fetchPurchaseOrderById(props.purchaseOrderId);
}

async function handleCancel() {
    if (!confirm('Cancelar esta orden?')) return;
    await cancelPurchaseOrder(props.purchaseOrderId);
    await fetchPurchaseOrderById(props.purchaseOrderId);
}

async function handleDuplicate() {
    if (!confirm('Duplicar esta orden como borrador?')) return;
    const duplicated = await purchaseOrdersService.duplicate(
        props.purchaseOrderId,
    );
    router.visit(`/purchase-orders/${duplicated.id}`);
}

async function handleStatusAction(event: Event) {
    const action = (event.target as HTMLSelectElement).value;
    (event.target as HTMLSelectElement).value = '';

    if (action === 'send') {
        await handleSend();
    } else if (action === 'receive') {
        router.visit(`/purchase-orders/${props.purchaseOrderId}/receive`);
    } else if (action === 'cancel') {
        await handleCancel();
    }
}

onMounted(async () => {
    await Promise.all([
        fetchStoreSettings(),
        fetchPurchaseOrderById(props.purchaseOrderId),
    ]);
    await loadPayments();
});
</script>

<template>
    <Head :title="purchaseOrder?.po_number || 'Orden de Compra'" />
    <AppLayout>
        <PurchaseOrderToolbar
            :title="`Orden de compra ${purchaseOrder?.po_number || `#${purchaseOrderId}`}`"
            :subtitle="purchaseOrder?.supplier?.name || 'OC diaria general'"
            :status-label="purchaseOrder?.status_label"
            :total="purchaseOrder?.formatted_total"
        >
            <template #actions>
                <div class="group relative">
                    <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-border dark:bg-card dark:text-gray-200 dark:hover:bg-muted"
                        @click="openPdf('worksheet')"
                    >
                        <FileText :size="15" />
                        Imprimir
                    </button>
                    <div
                        class="invisible absolute top-full right-0 z-20 mt-1 w-44 border border-gray-200 bg-white py-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 dark:border-border dark:bg-card"
                    >
                        <button
                            type="button"
                            class="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-muted"
                            @click="openPdf('worksheet')"
                        >
                            Hoja de trabajo
                        </button>
                        <button
                            type="button"
                            class="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-muted"
                            @click="openPdf('standard')"
                        >
                            Formato estandar
                        </button>
                    </div>
                </div>
                <button
                    v-if="purchaseOrder && !isDailyPO()"
                    type="button"
                    class="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    @click="handleDuplicate"
                >
                    <Copy :size="15" />
                    Duplicar
                </button>
                <select
                    v-if="purchaseOrder"
                    class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 dark:border-border dark:bg-muted dark:text-white"
                    @change="handleStatusAction"
                >
                    <option value="">
                        Estado: {{ purchaseOrder.status_label }}
                    </option>
                    <option
                        v-if="purchaseOrder.status === 'draft'"
                        value="send"
                    >
                        Enviar
                    </option>
                    <option
                        v-if="
                            ['sent', 'partial', 'open'].includes(
                                purchaseOrder.status,
                            )
                        "
                        value="receive"
                    >
                        Recibir
                    </option>
                    <option
                        v-if="
                            !['received', 'cancelled'].includes(
                                purchaseOrder.status,
                            )
                        "
                        value="cancel"
                    >
                        Cancelar
                    </option>
                </select>
            </template>
        </PurchaseOrderToolbar>

        <div
            class="min-h-[calc(100vh-4.25rem)] bg-gray-50/60 dark:bg-background"
        >
            <main class="mx-auto max-w-7xl min-w-0 p-4">
                <PurchaseOrderSideNav
                    v-if="purchaseOrder"
                    :purchase-order-id="purchaseOrder.id"
                    active="details"
                    :can-edit="purchaseOrder.status === 'draft'"
                />
                <div v-if="loading" class="flex justify-center py-12">
                    <div
                        class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"
                    ></div>
                </div>

                <div
                    v-else-if="error"
                    class="border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
                >
                    {{ error }}
                </div>

                <template v-else-if="purchaseOrder">
                    <div
                        v-if="hasPreAppliedStock()"
                        class="mb-3 border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200"
                    >
                        Esta OC viene desde POS con stock preaplicado. En Check
                        In solo se sumara la diferencia si se incrementan
                        cantidades.
                    </div>

                    <div class="space-y-3">
                        <PurchaseOrderSection
                            title="Resumen de la orden"
                            subtitle="Proveedor, fechas, recepcion y costos principales"
                            default-open
                        >
                            <div
                                class="grid grid-cols-1 gap-3 p-3 xl:grid-cols-[1fr_1.35fr]"
                            >
                                <div
                                    class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                                >
                                    <div
                                        class="border-b border-gray-100 bg-emerald-50/60 px-3 py-2 text-sm font-semibold text-emerald-800 dark:border-border dark:bg-emerald-950/30 dark:text-emerald-200"
                                    >
                                        Datos de la orden
                                    </div>
                                    <div
                                        class="grid grid-cols-[9rem_1fr] text-sm"
                                    >
                                        <div
                                            class="border-r border-b border-gray-200 bg-gray-50 px-3 py-2 font-medium dark:border-border dark:bg-muted/30"
                                        >
                                            Estado
                                        </div>
                                        <div
                                            class="border-b border-gray-200 px-3 py-2 dark:border-border"
                                        >
                                            <span
                                                :class="[
                                                    'rounded px-2 py-1 text-xs font-semibold',
                                                    statusColors[
                                                        purchaseOrder.status
                                                    ],
                                                ]"
                                            >
                                                {{ purchaseOrder.status_label }}
                                            </span>
                                        </div>
                                        <div
                                            class="border-r border-b border-gray-200 bg-gray-50 px-3 py-2 font-medium dark:border-border dark:bg-muted/30"
                                        >
                                            Proveedor
                                        </div>
                                        <div
                                            class="border-b border-gray-200 px-3 py-2 dark:border-border"
                                        >
                                            <Link
                                                v-if="purchaseOrder.supplier"
                                                :href="`/suppliers/${purchaseOrder.supplier.id}`"
                                                class="font-semibold text-blue-700 hover:underline dark:text-blue-300"
                                            >
                                                {{
                                                    purchaseOrder.supplier.name
                                                }}
                                            </Link>
                                            <span v-else
                                                >OC diaria general</span
                                            >
                                        </div>
                                        <div
                                            class="border-r border-b border-gray-200 bg-gray-50 px-3 py-2 font-medium dark:border-border dark:bg-muted/30"
                                        >
                                            Factura
                                        </div>
                                        <div
                                            class="border-b border-gray-200 px-3 py-2 font-mono dark:border-border"
                                        >
                                            {{
                                                purchaseOrder.supplier_invoice_number ||
                                                '-'
                                            }}
                                        </div>
                                        <div
                                            class="border-r border-b border-gray-200 bg-gray-50 px-3 py-2 font-medium dark:border-border dark:bg-muted/30"
                                        >
                                            Creado por
                                        </div>
                                        <div
                                            class="border-b border-gray-200 px-3 py-2 dark:border-border"
                                        >
                                            {{
                                                purchaseOrder.user?.name || '-'
                                            }}
                                        </div>
                                        <div
                                            class="border-r border-b border-gray-200 bg-gray-50 px-3 py-2 font-medium dark:border-border dark:bg-muted/30"
                                        >
                                            Fecha
                                        </div>
                                        <div
                                            class="border-b border-gray-200 px-3 py-2 dark:border-border"
                                        >
                                            {{
                                                formatDate(
                                                    purchaseOrder.order_date,
                                                )
                                            }}
                                        </div>
                                        <div
                                            class="border-r border-gray-200 bg-gray-50 px-3 py-2 font-medium dark:border-border dark:bg-muted/30"
                                        >
                                            Almacen
                                        </div>
                                        <div class="px-3 py-2">
                                            {{
                                                purchaseOrder.warehouse?.name ||
                                                '-'
                                            }}
                                        </div>
                                    </div>
                                    <div
                                        class="border-t border-gray-100 dark:border-border"
                                    >
                                        <div
                                            class="bg-emerald-50/60 px-3 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                                        >
                                            Notas generales
                                        </div>
                                        <div
                                            class="min-h-24 px-3 py-3 text-sm whitespace-pre-wrap"
                                        >
                                            {{ purchaseOrder.notes || '-' }}
                                        </div>
                                    </div>
                                </div>

                                <div class="space-y-3">
                                    <div
                                        class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                                    >
                                        <div
                                            class="bg-emerald-50/60 px-3 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                                        >
                                            Resumen de recepcion
                                        </div>
                                        <table class="min-w-full text-sm">
                                            <tbody>
                                                <tr
                                                    class="border-t border-gray-200 dark:border-border"
                                                >
                                                    <td class="px-3 py-2">
                                                        Ordenado
                                                    </td>
                                                    <td
                                                        class="px-3 py-2 text-right font-semibold"
                                                    >
                                                        {{ orderedQuantity }}
                                                    </td>
                                                    <td
                                                        class="px-3 py-2 text-right font-mono"
                                                    >
                                                        {{
                                                            purchaseOrder.formatted_total
                                                        }}
                                                    </td>
                                                </tr>
                                                <tr
                                                    class="border-t border-gray-200 dark:border-border"
                                                >
                                                    <td class="px-3 py-2">
                                                        Recibido
                                                    </td>
                                                    <td
                                                        class="px-3 py-2 text-right font-semibold"
                                                    >
                                                        {{ receivedQuantity }}
                                                    </td>
                                                    <td
                                                        class="px-3 py-2 text-right font-mono"
                                                    >
                                                        Pendiente
                                                        {{ pendingQuantity }}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div
                                        id="costs"
                                        class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                                    >
                                        <div
                                            class="bg-emerald-50/60 px-3 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                                        >
                                            Costos
                                        </div>
                                        <div
                                            class="grid grid-cols-[1fr_10rem] text-sm"
                                        >
                                            <div
                                                class="border-b border-gray-200 px-3 py-2 dark:border-border"
                                            >
                                                Subtotal
                                            </div>
                                            <div
                                                class="border-b border-gray-200 px-3 py-2 text-right font-mono dark:border-border"
                                            >
                                                ${{
                                                    Number(
                                                        purchaseOrder.subtotal,
                                                    ).toFixed(2)
                                                }}
                                            </div>
                                            <div
                                                class="border-b border-gray-200 px-3 py-2 dark:border-border"
                                            >
                                                ITBM
                                            </div>
                                            <div
                                                class="border-b border-gray-200 px-3 py-2 text-right font-mono dark:border-border"
                                            >
                                                ${{
                                                    Number(
                                                        purchaseOrder.tax_amount,
                                                    ).toFixed(2)
                                                }}
                                            </div>
                                            <div
                                                class="border-b border-gray-200 px-3 py-2 dark:border-border"
                                            >
                                                Costo extra
                                            </div>
                                            <div
                                                class="border-b border-gray-200 px-3 py-2 text-right font-mono dark:border-border"
                                            >
                                                ${{
                                                    Number(
                                                        purchaseOrder.shipping_cost,
                                                    ).toFixed(2)
                                                }}
                                            </div>
                                            <div
                                                class="px-3 py-2 font-semibold"
                                            >
                                                Total ordenado
                                            </div>
                                            <div
                                                class="px-3 py-2 text-right font-mono font-semibold"
                                            >
                                                {{
                                                    purchaseOrder.formatted_total
                                                }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </PurchaseOrderSection>

                        <PurchaseOrderSection
                            id="items"
                            title="Articulos"
                            subtitle="Cantidades, costos y avance de recepcion"
                            :count="purchaseOrder.items.length"
                            default-open
                        >
                            <div class="overflow-x-auto">
                                <table class="min-w-full text-sm">
                                    <thead
                                        class="sticky top-0 bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/50 dark:text-gray-300"
                                    >
                                        <tr>
                                            <th
                                                class="w-12 px-3 py-2 text-left"
                                            >
                                                #
                                            </th>
                                            <th class="px-3 py-2 text-left">
                                                SKU
                                            </th>
                                            <th class="px-3 py-2 text-left">
                                                Marca
                                            </th>
                                            <th
                                                class="min-w-80 px-3 py-2 text-left"
                                            >
                                                Producto
                                            </th>
                                            <th class="px-3 py-2 text-left">
                                                Estado
                                            </th>
                                            <th class="px-3 py-2 text-right">
                                                Precio venta
                                            </th>
                                            <th class="px-3 py-2 text-right">
                                                Ordenado
                                            </th>
                                            <th class="px-3 py-2 text-right">
                                                Recibido
                                            </th>
                                            <th class="px-3 py-2 text-right">
                                                Costo
                                            </th>
                                            <th class="px-3 py-2 text-right">
                                                Subtotal
                                            </th>
                                            <th class="px-3 py-2 text-right">
                                                ITBM %
                                            </th>
                                            <th class="px-3 py-2 text-right">
                                                ITBM
                                            </th>
                                            <th class="px-3 py-2 text-right">
                                                Total
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for="(
                                                item, index
                                            ) in purchaseOrder.items"
                                            :key="item.id"
                                            class="border-t border-gray-100 hover:bg-emerald-50/50 dark:border-border dark:hover:bg-emerald-950/20"
                                        >
                                            <td class="px-3 py-2 text-gray-500">
                                                {{ index + 1 }}
                                            </td>
                                            <td
                                                class="px-3 py-2 font-mono text-xs"
                                            >
                                                {{
                                                    item.variant?.sku ||
                                                    item.product?.sku_base ||
                                                    '-'
                                                }}
                                            </td>
                                            <td class="px-3 py-2">
                                                {{
                                                    item.variant?.brand?.name ||
                                                    '-'
                                                }}
                                            </td>
                                            <td class="px-3 py-2">
                                                <Link
                                                    v-if="item.product"
                                                    :href="`/products/${item.product.id}`"
                                                    class="font-semibold text-green-700 hover:underline dark:text-green-300"
                                                >
                                                    {{ item.product.name }}
                                                </Link>
                                                <div
                                                    v-if="
                                                        (item.pre_applied_quantity ??
                                                            item.pre_stock_applied_qty ??
                                                            0) > 0
                                                    "
                                                    class="text-xs text-gray-500"
                                                >
                                                    <span
                                                        class="text-amber-600 dark:text-amber-300"
                                                    >
                                                        POS:
                                                        {{
                                                            item.pre_applied_quantity ??
                                                            item.pre_stock_applied_qty
                                                        }}
                                                        paq.
                                                    </span>
                                                </div>
                                            </td>
                                            <td class="px-3 py-2">
                                                <span
                                                    v-if="
                                                        item.is_fully_received ||
                                                        item.status ===
                                                            'received'
                                                    "
                                                    class="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                >
                                                    Recibido
                                                </span>
                                                <span
                                                    v-else-if="
                                                        item.quantity_received >
                                                            0 ||
                                                        item.status ===
                                                            'partial'
                                                    "
                                                    class="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                                >
                                                    Parcial
                                                </span>
                                                <span
                                                    v-else
                                                    class="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-muted dark:text-gray-300"
                                                >
                                                    Pendiente
                                                </span>
                                            </td>
                                            <td
                                                class="px-3 py-2 text-right font-mono"
                                            >
                                                ${{
                                                    Number(
                                                        item.product?.pricing
                                                            ?.base_price || 0,
                                                    ).toFixed(2)
                                                }}
                                            </td>
                                            <td class="px-3 py-2 text-right">
                                                {{ item.quantity_ordered }}
                                            </td>
                                            <td class="px-3 py-2 text-right">
                                                {{
                                                    item.effective_received_quantity ??
                                                    item.quantity_received
                                                }}
                                            </td>
                                            <td
                                                class="px-3 py-2 text-right font-mono"
                                            >
                                                ${{
                                                    Number(
                                                        item.unit_cost,
                                                    ).toFixed(2)
                                                }}
                                            </td>
                                            <td
                                                class="px-3 py-2 text-right font-mono font-semibold"
                                            >
                                                ${{
                                                    Number(
                                                        item.subtotal,
                                                    ).toFixed(2)
                                                }}
                                            </td>
                                            <td
                                                class="px-3 py-2 text-right font-mono"
                                            >
                                                {{
                                                    Number(
                                                        resolveTaxRate(
                                                            item.tax_rate ??
                                                                null,
                                                        ),
                                                    ).toFixed(0)
                                                }}%
                                            </td>
                                            <td
                                                class="px-3 py-2 text-right font-mono"
                                            >
                                                ${{
                                                    Number(
                                                        item.tax_amount || 0,
                                                    ).toFixed(2)
                                                }}
                                            </td>
                                            <td
                                                class="px-3 py-2 text-right font-mono font-semibold"
                                            >
                                                ${{
                                                    itemLineTotal(item).toFixed(
                                                        2,
                                                    )
                                                }}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </PurchaseOrderSection>

                        <PurchaseOrderSection
                            title="Pagos"
                            subtitle="Estado de pago, saldo y registros"
                            :count="payments.length"
                            default-open
                        >
                            <div class="p-3">
                                <div
                                    class="mb-3 flex items-center justify-between"
                                >
                                    <div class="flex items-center gap-2">
                                        <DollarSign
                                            :size="18"
                                            class="text-green-600"
                                        />
                                        <span
                                            :class="[
                                                'rounded px-2 py-1 text-xs font-semibold',
                                                paymentStatusColors[
                                                    paymentStatus
                                                ],
                                            ]"
                                        >
                                            {{
                                                paymentStatusLabels[
                                                    paymentStatus
                                                ] || paymentStatus
                                            }}
                                        </span>
                                        <span class="text-sm text-gray-500">
                                            Pagado ${{
                                                amountPaid.toFixed(2)
                                            }}
                                            / Saldo ${{ amountDue.toFixed(2) }}
                                        </span>
                                    </div>
                                    <button
                                        v-if="amountDue > 0"
                                        type="button"
                                        class="inline-flex items-center gap-2 rounded bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                                        @click="
                                            showPaymentModal = true;
                                            paymentError = null;
                                        "
                                    >
                                        <Plus :size="15" />
                                        Registrar Pago
                                    </button>
                                </div>
                                <p
                                    v-if="payments.length === 0"
                                    class="py-6 text-center text-sm text-gray-500"
                                >
                                    No hay pagos registrados.
                                </p>
                                <table v-else class="min-w-full text-sm">
                                    <thead
                                        class="border-b border-gray-200 text-xs text-gray-500 uppercase dark:border-border"
                                    >
                                        <tr>
                                            <th class="py-2 text-left">
                                                Fecha
                                            </th>
                                            <th class="py-2 text-left">
                                                Metodo
                                            </th>
                                            <th class="py-2 text-left">
                                                Numero de recibo
                                            </th>
                                            <th class="py-2 text-right">
                                                Monto
                                            </th>
                                            <th class="py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody
                                        class="divide-y divide-gray-100 dark:divide-border"
                                    >
                                        <tr v-for="p in payments" :key="p.id">
                                            <td
                                                class="py-2 text-gray-600 dark:text-gray-400"
                                            >
                                                {{ formatDate(p.paid_at) }}
                                            </td>
                                            <td class="py-2">
                                                {{
                                                    methodLabels[p.method] ||
                                                    p.method
                                                }}
                                            </td>
                                            <td
                                                class="py-2 font-mono text-gray-500"
                                            >
                                                {{ p.reference_number || '-' }}
                                            </td>
                                            <td
                                                class="py-2 text-right font-semibold"
                                            >
                                                {{ p.formatted_amount }}
                                            </td>
                                            <td class="py-2 text-right">
                                                <button
                                                    type="button"
                                                    class="p-1 text-gray-400 hover:text-red-500"
                                                    @click="deletePayment(p.id)"
                                                >
                                                    <Trash2 :size="14" />
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </PurchaseOrderSection>
                    </div>
                </template>
            </main>
        </div>

        <OperationalPaymentPanel
            mode="purchase"
            :show="showPaymentModal"
            :amount-to-charge="amountDue"
            :subtotal="amountDue"
            title="Registrar pago OC"
            primary-action-label="Registrar pago"
            cancel-label="Cancelar"
            allow-partial
            include-supplier-credit
            :allowed-method-codes="[
                'cash',
                'card',
                'transfer',
                'other',
                'supplier_credit',
            ]"
            show-reference-number
            show-notes
            reference-number-label="Numero de recibo"
            notes-label="Notas"
            :loading="paymentLoading"
            :error="paymentError"
            @finish="handlePurchasePaymentFinish"
            @cancel="
                showPaymentModal = false;
                paymentError = null;
            "
        />
    </AppLayout>
</template>
