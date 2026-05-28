<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { SalesReturnsApiService } from '@/services/sales-returns';
import type { SalesReturnOperationalDetail } from '@/types/sales-return';
import {
    ArrowLeft,
    CheckCircle2,
    ExternalLink,
    FileText,
    Package,
    RotateCcw,
    Wallet,
    XCircle,
} from 'lucide-vue-next';

defineOptions({ layout: AppLayout });

const props = defineProps<{ id: number }>();

type TabKey =
    | 'summary'
    | 'items'
    | 'refund'
    | 'inventory'
    | 'order'
    | 'activity';

const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'summary', label: 'Resumen' },
    { key: 'items', label: 'Items' },
    { key: 'refund', label: 'Reembolso/AR' },
    { key: 'inventory', label: 'Inventario' },
    { key: 'order', label: 'Factura origen' },
    { key: 'activity', label: 'Actividad' },
];

const detail = ref<SalesReturnOperationalDetail | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const processing = ref(false);
const activeTab = ref<TabKey>('summary');

const currentReturn = computed(() => detail.value?.return ?? null);
const order = computed(() => detail.value?.sales_order ?? null);
const items = computed(() => detail.value?.items ?? []);
const refund = computed(() => detail.value?.refund_context ?? null);
const inventory = computed(
    () => detail.value?.inventory_context.movements ?? [],
);
const arTransactions = computed(
    () => detail.value?.ar_context.customer_transactions ?? [],
);
const timeline = computed(() => detail.value?.timeline ?? []);

const loadDetail = async (): Promise<void> => {
    loading.value = true;
    error.value = null;
    try {
        detail.value = await SalesReturnsApiService.getOperationalDetail(
            props.id,
        );
    } catch (err: any) {
        error.value =
            err.response?.data?.message || 'Error cargando la devolución';
    } finally {
        loading.value = false;
    }
};

onMounted(loadDetail);

const formatCurrency = (value: number | string | null | undefined): string =>
    new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(Number(value || 0));

const formatDate = (value?: string | null): string => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString('es-PA', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const statusClasses = (status?: string | null): string => {
    if (status === 'approved') {
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    }
    if (status === 'rejected') return 'bg-red-50 text-red-700 ring-red-200';
    return 'bg-amber-50 text-amber-700 ring-amber-200';
};

const methodLabel = (method?: string | null): string =>
    ({
        cash: 'Efectivo',
        card: 'Tarjeta',
        transfer: 'Transferencia',
        balance: 'Saldo a favor',
    })[method || ''] ||
    method ||
    'N/A';

const processReturn = async (action: 'approve' | 'reject'): Promise<void> => {
    if (!currentReturn.value) return;
    const message =
        action === 'approve'
            ? '¿Aprobar esta devolución?'
            : '¿Rechazar esta devolución?';
    if (!confirm(message)) return;

    processing.value = true;
    try {
        if (action === 'approve') {
            await SalesReturnsApiService.approve(currentReturn.value.id);
        } else {
            await SalesReturnsApiService.reject(currentReturn.value.id);
        }
        await loadDetail();
    } catch (err: any) {
        alert(
            err.response?.data?.message || 'No se pudo procesar la devolución',
        );
    } finally {
        processing.value = false;
    }
};
</script>

<template>
    <Head
        :title="
            currentReturn
                ? `Devolución ${currentReturn.return_number}`
                : 'Devolución'
        "
    />

    <div class="space-y-4">
        <button
            type="button"
            class="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-950"
            @click="router.visit('/returns')"
        >
            <ArrowLeft class="h-4 w-4" />
            Volver a devoluciones
        </button>

        <div v-if="loading" class="rounded-lg border bg-white p-8 text-center">
            Cargando devolución...
        </div>

        <div
            v-else-if="error"
            class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
        >
            {{ error }}
        </div>

        <template v-else-if="detail && currentReturn">
            <header class="rounded-lg border bg-white p-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div class="flex items-center gap-2">
                            <RotateCcw class="h-6 w-6 text-cyan-700" />
                            <h1 class="text-2xl font-semibold text-gray-950">
                                {{
                                    currentReturn.return_number ||
                                    `DEV-${currentReturn.id}`
                                }}
                            </h1>
                            <span
                                :class="[
                                    'rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
                                    statusClasses(currentReturn.status),
                                ]"
                            >
                                {{
                                    currentReturn.status_label ||
                                    currentReturn.status
                                }}
                            </span>
                        </div>
                        <p class="mt-1 text-sm text-gray-500">
                            {{
                                currentReturn.reason || 'Sin motivo registrado'
                            }}
                        </p>
                    </div>

                    <div class="flex flex-wrap gap-2">
                        <button
                            v-if="order"
                            type="button"
                            class="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                            @click="router.visit(order.href)"
                        >
                            <FileText class="h-4 w-4" />
                            Factura
                        </button>
                        <button
                            v-if="currentReturn.customer?.id"
                            type="button"
                            class="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                            @click="
                                router.visit(
                                    `/customers/${currentReturn.customer?.id}`,
                                )
                            "
                        >
                            Cliente
                        </button>
                        <button
                            v-if="detail.workflow.can_approve"
                            type="button"
                            class="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                            :disabled="processing"
                            @click="processReturn('approve')"
                        >
                            <CheckCircle2 class="h-4 w-4" />
                            Aprobar
                        </button>
                        <button
                            v-if="detail.workflow.can_reject"
                            type="button"
                            class="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                            :disabled="processing"
                            @click="processReturn('reject')"
                        >
                            <XCircle class="h-4 w-4" />
                            Rechazar
                        </button>
                    </div>
                </div>
            </header>

            <section class="grid gap-3 md:grid-cols-4">
                <div class="rounded-lg border bg-white p-3">
                    <p class="text-xs font-medium text-gray-500">Monto</p>
                    <p class="mt-1 text-2xl font-semibold text-gray-950">
                        {{ formatCurrency(currentReturn.total_amount) }}
                    </p>
                    <p class="text-xs text-gray-500">
                        {{ methodLabel(currentReturn.refund_method) }}
                    </p>
                </div>
                <div class="rounded-lg border bg-white p-3">
                    <p class="text-xs font-medium text-gray-500">Factura</p>
                    <p
                        class="mt-1 truncate text-lg font-semibold text-gray-950"
                    >
                        {{ order?.order_number || 'N/A' }}
                    </p>
                    <p class="text-xs text-gray-500">
                        {{ formatCurrency(order?.total) }}
                    </p>
                </div>
                <div class="rounded-lg border bg-white p-3">
                    <p class="text-xs font-medium text-gray-500">Cliente</p>
                    <p
                        class="mt-1 truncate text-lg font-semibold text-gray-950"
                    >
                        {{ currentReturn.customer?.name || 'Público general' }}
                    </p>
                    <p class="text-xs text-gray-500">
                        {{ currentReturn.customer?.code || 'Sin código' }}
                    </p>
                </div>
                <div class="rounded-lg border bg-white p-3">
                    <p class="text-xs font-medium text-gray-500">Sucursal</p>
                    <p
                        class="mt-1 truncate text-lg font-semibold text-gray-950"
                    >
                        {{ currentReturn.warehouse?.name || 'N/A' }}
                    </p>
                    <p class="text-xs text-gray-500">
                        {{ formatDate(currentReturn.created_at) }}
                    </p>
                </div>
            </section>

            <nav class="flex gap-1 overflow-x-auto border-b">
                <button
                    v-for="tab in tabs"
                    :key="tab.key"
                    type="button"
                    :class="[
                        'border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap',
                        activeTab === tab.key
                            ? 'border-cyan-600 text-cyan-700'
                            : 'border-transparent text-gray-500 hover:text-gray-900',
                    ]"
                    @click="activeTab = tab.key"
                >
                    {{ tab.label }}
                </button>
            </nav>

            <section
                v-if="activeTab === 'summary'"
                class="grid gap-3 md:grid-cols-2"
            >
                <div class="rounded-lg border bg-white p-4">
                    <h2 class="font-semibold text-gray-950">Datos generales</h2>
                    <dl class="mt-3 grid gap-2 text-sm">
                        <div class="flex justify-between gap-3">
                            <dt class="text-gray-500">Estado</dt>
                            <dd class="font-medium">
                                {{
                                    currentReturn.status_label ||
                                    currentReturn.status
                                }}
                            </dd>
                        </div>
                        <div class="flex justify-between gap-3">
                            <dt class="text-gray-500">Método</dt>
                            <dd class="font-medium">
                                {{ methodLabel(currentReturn.refund_method) }}
                            </dd>
                        </div>
                        <div class="flex justify-between gap-3">
                            <dt class="text-gray-500">Usuario</dt>
                            <dd class="font-medium">
                                {{ currentReturn.user?.name || 'Sistema' }}
                            </dd>
                        </div>
                        <div class="flex justify-between gap-3">
                            <dt class="text-gray-500">Notas</dt>
                            <dd class="text-right font-medium">
                                {{ currentReturn.refund_notes || 'Sin notas' }}
                            </dd>
                        </div>
                    </dl>
                </div>
                <div class="rounded-lg border bg-white p-4">
                    <h2 class="font-semibold text-gray-950">Flujo</h2>
                    <p class="mt-3 text-sm text-gray-600">
                        {{
                            detail.workflow.blocked_reason ||
                            'La devolución está pendiente de procesamiento.'
                        }}
                    </p>
                    <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <span class="rounded bg-gray-50 px-2 py-1">
                            Aprobar:
                            {{ detail.workflow.can_approve ? 'Sí' : 'No' }}
                        </span>
                        <span class="rounded bg-gray-50 px-2 py-1">
                            Rechazar:
                            {{ detail.workflow.can_reject ? 'Sí' : 'No' }}
                        </span>
                    </div>
                </div>
            </section>

            <section
                v-if="activeTab === 'items'"
                class="overflow-hidden rounded-lg border bg-white"
            >
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                    <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                            <th class="px-3 py-2 text-left">Producto</th>
                            <th class="px-3 py-2 text-left">SKU</th>
                            <th class="px-3 py-2 text-right">Vendido</th>
                            <th class="px-3 py-2 text-right">Devuelto</th>
                            <th class="px-3 py-2 text-right">Cantidad</th>
                            <th class="px-3 py-2 text-right">Subtotal</th>
                            <th class="px-3 py-2 text-right">ITBM</th>
                            <th class="px-3 py-2 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr v-for="item in items" :key="item.id">
                            <td class="px-3 py-2">
                                <button
                                    v-if="item.product_id"
                                    type="button"
                                    class="font-medium text-cyan-700 hover:underline"
                                    @click="
                                        router.visit(
                                            `/products/${item.product_id}`,
                                        )
                                    "
                                >
                                    {{ item.product_name || 'Producto' }}
                                </button>
                                <span v-else>{{ item.product_name }}</span>
                                <p class="text-xs text-gray-500">
                                    {{ item.brand_name || 'Sin marca' }}
                                </p>
                            </td>
                            <td class="px-3 py-2 text-gray-600">
                                {{
                                    item.variant_sku ||
                                    item.product_sku ||
                                    'N/A'
                                }}
                            </td>
                            <td class="px-3 py-2 text-right tabular-nums">
                                {{ item.quantity_sold }}
                            </td>
                            <td class="px-3 py-2 text-right tabular-nums">
                                {{ item.quantity_returned_total }}
                            </td>
                            <td class="px-3 py-2 text-right tabular-nums">
                                {{ item.quantity }}
                            </td>
                            <td class="px-3 py-2 text-right tabular-nums">
                                {{ formatCurrency(item.subtotal) }}
                            </td>
                            <td class="px-3 py-2 text-right tabular-nums">
                                {{ formatCurrency(item.tax_amount) }}
                            </td>
                            <td class="px-3 py-2 text-right font-semibold">
                                {{ formatCurrency(item.total) }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section
                v-if="activeTab === 'refund'"
                class="grid gap-3 md:grid-cols-2"
            >
                <div class="rounded-lg border bg-white p-4">
                    <h2
                        class="flex items-center gap-2 font-semibold text-gray-950"
                    >
                        <Wallet class="h-4 w-4" />
                        Reembolso
                    </h2>
                    <dl class="mt-3 grid gap-2 text-sm">
                        <div class="flex justify-between gap-3">
                            <dt class="text-gray-500">Método</dt>
                            <dd class="font-medium">
                                {{ methodLabel(refund?.method) }}
                            </dd>
                        </div>
                        <div class="flex justify-between gap-3">
                            <dt class="text-gray-500">Monto</dt>
                            <dd class="font-medium">
                                {{ formatCurrency(refund?.amount) }}
                            </dd>
                        </div>
                        <div class="flex justify-between gap-3">
                            <dt class="text-gray-500">Requiere caja</dt>
                            <dd class="font-medium">
                                {{
                                    refund?.requires_open_session ? 'Sí' : 'No'
                                }}
                            </dd>
                        </div>
                    </dl>
                    <div
                        v-if="refund?.refund_payment"
                        class="mt-4 rounded-md bg-gray-50 p-3 text-sm"
                    >
                        Pago negativo:
                        {{ formatCurrency(refund.refund_payment.amount) }}
                        · {{ refund.refund_payment.method_label }}
                    </div>
                </div>
                <div class="rounded-lg border bg-white p-4">
                    <h2 class="font-semibold text-gray-950">Movimientos AR</h2>
                    <div
                        v-if="arTransactions.length === 0"
                        class="mt-3 text-sm text-gray-500"
                    >
                        Sin transacciones de cliente para esta devolución.
                    </div>
                    <div
                        v-for="transaction in arTransactions"
                        :key="transaction.id"
                        class="mt-3 rounded-md bg-gray-50 p-3 text-sm"
                    >
                        <div class="flex justify-between gap-3">
                            <span>{{ transaction.type_label }}</span>
                            <span class="font-semibold">
                                {{ formatCurrency(transaction.amount) }}
                            </span>
                        </div>
                        <p class="mt-1 text-xs text-gray-500">
                            {{ transaction.description }}
                        </p>
                    </div>
                </div>
            </section>

            <section
                v-if="activeTab === 'inventory'"
                class="overflow-hidden rounded-lg border bg-white"
            >
                <div
                    v-if="inventory.length === 0"
                    class="p-6 text-sm text-gray-500"
                >
                    Sin movimientos de inventario para esta devolución.
                </div>
                <table
                    v-else
                    class="min-w-full divide-y divide-gray-200 text-sm"
                >
                    <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                            <th class="px-3 py-2 text-left">Movimiento</th>
                            <th class="px-3 py-2 text-left">Producto</th>
                            <th class="px-3 py-2 text-left">Sucursal</th>
                            <th class="px-3 py-2 text-right">Cantidad</th>
                            <th class="px-3 py-2 text-left">Fecha</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr v-for="movement in inventory" :key="movement.id">
                            <td class="px-3 py-2">
                                <button
                                    type="button"
                                    class="inline-flex items-center gap-1 text-cyan-700 hover:underline"
                                    @click="
                                        router.visit(
                                            `/inventory-movements/${movement.id}`,
                                        )
                                    "
                                >
                                    #{{ movement.id }}
                                    <ExternalLink class="h-3.5 w-3.5" />
                                </button>
                            </td>
                            <td class="px-3 py-2">
                                {{ movement.product_name || 'Producto' }}
                            </td>
                            <td class="px-3 py-2">
                                {{ movement.warehouse_name || 'N/A' }}
                            </td>
                            <td class="px-3 py-2 text-right tabular-nums">
                                {{ movement.quantity }}
                            </td>
                            <td class="px-3 py-2 text-gray-500">
                                {{ formatDate(movement.created_at) }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section
                v-if="activeTab === 'order' && order"
                class="rounded-lg border bg-white p-4"
            >
                <h2 class="font-semibold text-gray-950">Factura origen</h2>
                <div class="mt-3 grid gap-3 text-sm md:grid-cols-3">
                    <div>
                        <p class="text-xs text-gray-500">Número</p>
                        <button
                            type="button"
                            class="font-semibold text-cyan-700 hover:underline"
                            @click="router.visit(order.href)"
                        >
                            {{ order.order_number }}
                        </button>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Estado</p>
                        <p class="font-semibold">{{ order.status_label }}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Total</p>
                        <p class="font-semibold">
                            {{ formatCurrency(order.total) }}
                        </p>
                    </div>
                </div>
            </section>

            <section
                v-if="activeTab === 'activity'"
                class="rounded-lg border bg-white p-4"
            >
                <h2 class="font-semibold text-gray-950">Actividad</h2>
                <div class="mt-4 space-y-3">
                    <div
                        v-for="event in timeline"
                        :key="`${event.type}-${event.occurred_at}`"
                        class="flex items-start gap-3 border-l-2 border-gray-200 pl-3"
                    >
                        <Package class="mt-0.5 h-4 w-4 text-gray-400" />
                        <div>
                            <p class="text-sm font-medium text-gray-900">
                                {{ event.label }}
                            </p>
                            <p class="text-xs text-gray-500">
                                {{ formatDate(event.occurred_at) }}
                                <span v-if="event.amount !== null">
                                    · {{ formatCurrency(event.amount) }}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </template>
    </div>
</template>
