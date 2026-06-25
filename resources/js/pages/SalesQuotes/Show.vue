<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRightLeft,
    Calendar,
    CheckCircle,
    Clock,
    Download,
    Edit,
    FileCheck,
    FileText,
    Hash,
    MapPin,
    Package,
    Send,
    ShoppingCart,
    User,
    XCircle,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import PrintTicketModal from '@/components/POS/PrintTicketModal.vue';
import { usePOS } from '@/composables/usePOS';
import AppLayout from '@/layouts/AppLayout.vue';
import { SalesQuotesApiService } from '@/services/sales-quotes';
import type {
    SalesQuoteOperationalDetail,
    SalesQuoteOperationalItem,
} from '@/types/sales-quote';

defineOptions({ layout: AppLayout });

const props = defineProps<{ id: number }>();

const detail = ref<SalesQuoteOperationalDetail | null>(null);
const loading = ref(true);
const error = ref('');
const openingInPOS = ref(false);
const actionLoading = ref<string | null>(null);
const showPrintModal = ref(false);
const activeTab = ref('summary');

const tabs = [
    { id: 'summary', label: 'Resumen' },
    { id: 'items', label: 'Items' },
    { id: 'customer', label: 'Cliente' },
    { id: 'workflow', label: 'Flujo' },
    { id: 'stock', label: 'Disponibilidad' },
    { id: 'documents', label: 'Documentos' },
    { id: 'activity', label: 'Actividad' },
];

const statusColors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-800 ring-slate-200 dark:bg-muted dark:text-slate-300 dark:ring-border',
    sent: 'bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800',
    sent_to_deposit:
        'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800',
    sent_to_cashier:
        'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-800',
    accepted:
        'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800',
    collected:
        'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800',
    rejected:
        'bg-red-50 text-red-800 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800',
    expired:
        'bg-yellow-50 text-yellow-800 ring-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:ring-yellow-800',
    converted:
        'bg-indigo-50 text-indigo-800 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800',
};

const statusIcons: Record<string, any> = {
    draft: Clock,
    sent: Send,
    sent_to_deposit: Package,
    sent_to_cashier: ArrowRightLeft,
    accepted: CheckCircle,
    collected: CheckCircle,
    rejected: XCircle,
    expired: Clock,
    converted: FileCheck,
};

const quote = computed(() => detail.value?.quote ?? null);
const workflow = computed(() => detail.value?.workflow ?? null);
const items = computed(() => detail.value?.items ?? []);
const stockWarnings = computed(
    () => detail.value?.stock_context.warnings ?? [],
);

const { loadQuoteAsSession } = usePOS();

const moneyValue = (value: string | number | null | undefined): number => {
    const parsed =
        typeof value === 'string'
            ? Number.parseFloat(value)
            : Number(value ?? 0);

    return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value: string | number | null | undefined): string =>
    new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'USD',
    }).format(moneyValue(value));

const formatDate = (value: string | null | undefined): string => {
    if (!value) return 'Sin fecha';

    return new Date(value).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const formatDateTime = (value: string | null | undefined): string => {
    if (!value) return 'Sin registro';

    return new Date(value).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const itemTitle = (item: SalesQuoteOperationalItem): string =>
    item.is_custom_line
        ? item.custom_description || item.product_name
        : item.product?.name || item.product_name;

const fetchDetail = async (): Promise<void> => {
    loading.value = true;
    error.value = '';

    try {
        detail.value = await SalesQuotesApiService.getOperationalDetail(
            props.id,
        );
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'Error al cargar la cotizacion';
    } finally {
        loading.value = false;
    }
};

const handleOpenInPOS = (): void => {
    if (!detail.value || !workflow.value?.actions.can_open_in_pos) return;

    openingInPOS.value = true;
    loadQuoteAsSession({
        id: detail.value.quote.id,
        quote_number: detail.value.quote.quote_number,
        customer_id: detail.value.quote.customer?.id ?? null,
        items: detail.value.items.map((item) => ({
            product_id: item.product?.id ?? null,
            product_name: item.product_name,
            product_sku: item.product_sku,
            variant_id: item.variant?.id ?? null,
            warehouse_id: item.warehouse?.id ?? null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent,
            tax_percent: item.tax_percent,
            subtotal: item.subtotal,
            tax_amount: item.tax_amount,
            total: item.total,
            is_custom_line: item.is_custom_line,
            custom_description: item.custom_description,
            variant: item.variant,
        })),
    });
    router.visit('/pos');
};

const handleTransition = async (
    action: 'send-to-deposit' | 'send-to-cashier' | 'mark-collected',
): Promise<void> => {
    if (!quote.value) return;

    const labels: Record<string, string> = {
        'send-to-deposit': 'enviar a deposito',
        'send-to-cashier': 'enviar a caja',
        'mark-collected': 'marcar como cobrada',
    };

    if (!confirm(`Deseas ${labels[action]} esta cotizacion?`)) return;

    actionLoading.value = action;
    try {
        await SalesQuotesApiService.transition(quote.value.id, action);

        if (action === 'send-to-cashier') {
            handleOpenInPOS();
            return;
        }

        await fetchDetail();
    } catch (e: any) {
        alert(e.response?.data?.message || 'Error al cambiar el estado');
    } finally {
        actionLoading.value = null;
    }
};

const handleConvert = async (): Promise<void> => {
    if (!quote.value || !workflow.value?.actions.can_convert) return;

    if (!confirm('Convertir esta cotizacion a una orden de venta?')) return;

    actionLoading.value = 'convert';
    try {
        await SalesQuotesApiService.convert(quote.value.id, {
            payment_method: 'cash',
            payment_status: 'pending',
        });
        await fetchDetail();
    } catch (e: any) {
        alert(e.response?.data?.message || 'Error al convertir');
    } finally {
        actionLoading.value = null;
    }
};

const openDocument = (href: string): void => {
    window.open(href, '_blank');
};

onMounted(fetchDetail);
</script>

<template>
    <Head :title="`Cotizacion ${quote?.quote_number || ''}`" />

    <div class="mx-auto max-w-7xl space-y-5 p-4">
        <div
            v-if="loading"
            class="flex min-h-80 items-center justify-center text-sm font-medium text-slate-500 dark:text-slate-400"
        >
            Cargando cotizacion...
        </div>

        <div
            v-else-if="error"
            class="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
        >
            <p class="font-semibold">{{ error }}</p>
            <Link
                href="/sales-quotes"
                class="mt-2 inline-flex text-sm font-semibold text-red-700 underline-offset-2 hover:underline dark:text-red-300"
            >
                Volver al listado
            </Link>
        </div>

        <template v-else-if="detail && quote && workflow">
            <header
                class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
            >
                <div class="min-w-0">
                    <div class="flex items-center gap-3">
                        <Link
                            href="/sales-quotes"
                            class="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-muted"
                        >
                            <ArrowLeft :size="19" />
                        </Link>
                        <div>
                            <div class="flex flex-wrap items-center gap-2">
                                <h1
                                    class="text-2xl font-bold text-slate-950 dark:text-white"
                                >
                                    {{ quote.quote_number }}
                                </h1>
                                <span
                                    class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1"
                                    :class="
                                        statusColors[quote.status] ||
                                        statusColors.draft
                                    "
                                >
                                    <component
                                        :is="statusIcons[quote.status] || Clock"
                                        :size="13"
                                    />
                                    {{ quote.status_label }}
                                </span>
                            </div>
                            <p
                                class="mt-1 text-sm text-slate-500 dark:text-slate-400"
                            >
                                {{ quote.user?.name || 'Sistema' }} ·
                                {{ quote.warehouse?.name || 'Sin sucursal' }}
                            </p>
                        </div>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2">
                    <button
                        type="button"
                        class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-border dark:bg-card dark:text-slate-200 dark:hover:bg-muted"
                        @click="showPrintModal = true"
                    >
                        <Download :size="16" />
                        Imprimir
                    </button>
                    <Link
                        v-if="workflow.actions.can_edit"
                        :href="`/sales-quotes/${quote.id}/edit`"
                        class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-border dark:bg-card dark:text-slate-200 dark:hover:bg-muted"
                    >
                        <Edit :size="16" />
                        Editar
                    </Link>
                    <button
                        v-if="workflow.actions.can_open_in_pos"
                        type="button"
                        :disabled="openingInPOS"
                        class="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        @click="handleOpenInPOS"
                    >
                        <ShoppingCart :size="16" />
                        {{ openingInPOS ? 'Abriendo...' : 'Abrir en POS' }}
                    </button>
                </div>
            </header>

            <section class="grid gap-3 md:grid-cols-4">
                <div
                    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <p class="text-xs font-bold text-slate-500 uppercase">
                        Total
                    </p>
                    <p
                        class="mt-1 text-2xl font-bold text-slate-950 tabular-nums dark:text-white"
                    >
                        {{ formatCurrency(quote.total) }}
                    </p>
                </div>
                <div
                    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <p class="text-xs font-bold text-slate-500 uppercase">
                        Items
                    </p>
                    <p class="mt-1 text-2xl font-bold text-slate-950">
                        {{ items.length }}
                    </p>
                </div>
                <div
                    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <p class="text-xs font-bold text-slate-500 uppercase">
                        Vence
                    </p>
                    <p
                        class="mt-1 text-sm font-semibold text-slate-950 dark:text-white"
                    >
                        {{ formatDate(quote.valid_until) }}
                    </p>
                </div>
                <div
                    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <p class="text-xs font-bold text-slate-500 uppercase">
                        Disponibilidad
                    </p>
                    <p
                        class="mt-1 text-sm font-semibold"
                        :class="
                            stockWarnings.length
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-emerald-700 dark:text-emerald-300'
                        "
                    >
                        {{
                            stockWarnings.length
                                ? `${stockWarnings.length} alerta(s)`
                                : 'Sin faltantes'
                        }}
                    </p>
                </div>
            </section>

            <nav
                class="flex gap-1 overflow-x-auto border-b border-slate-200 pb-2 dark:border-border"
            >
                <button
                    v-for="tab in tabs"
                    :key="tab.id"
                    type="button"
                    class="shrink-0 rounded-md px-3 py-1.5 text-xs font-bold transition"
                    :class="
                        activeTab === tab.id
                            ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-muted'
                    "
                    @click="activeTab = tab.id"
                >
                    {{ tab.label }}
                </button>
            </nav>

            <section
                v-show="activeTab === 'summary'"
                class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]"
            >
                <div
                    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <h2
                        class="text-sm font-bold text-slate-950 dark:text-white"
                    >
                        Resumen financiero
                    </h2>
                    <div class="mt-4 grid gap-3 sm:grid-cols-2">
                        <div class="flex justify-between text-sm">
                            <span class="text-slate-500">Subtotal</span>
                            <span class="font-semibold">{{
                                formatCurrency(quote.subtotal)
                            }}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-slate-500">Descuento</span>
                            <span class="font-semibold">{{
                                formatCurrency(quote.discount_amount)
                            }}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-slate-500">ITBM</span>
                            <span class="font-semibold">{{
                                formatCurrency(quote.tax_amount)
                            }}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-slate-500">Total</span>
                            <span class="font-bold">{{
                                formatCurrency(quote.total)
                            }}</span>
                        </div>
                    </div>
                    <div
                        v-if="quote.notes || quote.internal_notes"
                        class="mt-4 grid gap-3 sm:grid-cols-2"
                    >
                        <div v-if="quote.notes">
                            <p
                                class="text-xs font-bold text-slate-500 uppercase"
                            >
                                Notas
                            </p>
                            <p
                                class="mt-1 text-sm whitespace-pre-line text-slate-700 dark:text-slate-300"
                            >
                                {{ quote.notes }}
                            </p>
                        </div>
                        <div v-if="quote.internal_notes">
                            <p
                                class="text-xs font-bold text-slate-500 uppercase"
                            >
                                Notas internas
                            </p>
                            <p
                                class="mt-1 text-sm whitespace-pre-line text-slate-700 dark:text-slate-300"
                            >
                                {{ quote.internal_notes }}
                            </p>
                        </div>
                    </div>
                </div>

                <div
                    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <h2
                        class="text-sm font-bold text-slate-950 dark:text-white"
                    >
                        Orden vinculada
                    </h2>
                    <div v-if="detail.converted_order_context" class="mt-3">
                        <Link
                            :href="detail.converted_order_context.href"
                            class="font-semibold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-300"
                        >
                            {{
                                detail.converted_order_context.order_number ||
                                `Orden #${detail.converted_order_context.id}`
                            }}
                        </Link>
                        <p class="mt-1 text-xs text-slate-500">
                            {{ detail.converted_order_context.status }} ·
                            {{ detail.converted_order_context.payment_status }}
                        </p>
                    </div>
                    <p v-else class="mt-3 text-sm text-slate-500">
                        Sin orden de venta convertida.
                    </p>
                </div>
            </section>

            <section
                v-show="activeTab === 'items'"
                class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-border dark:bg-card"
            >
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr
                                class="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase dark:border-border dark:bg-muted/50"
                            >
                                <th class="px-4 py-3 text-left">Item</th>
                                <th class="px-4 py-3 text-left">Bodega</th>
                                <th class="px-4 py-3 text-right">Cant.</th>
                                <th class="px-4 py-3 text-right">Precio</th>
                                <th class="px-4 py-3 text-right">ITBM</th>
                                <th class="px-4 py-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-slate-100 dark:divide-border/60"
                        >
                            <tr v-for="item in items" :key="item.id">
                                <td class="px-4 py-3">
                                    <Link
                                        v-if="
                                            item.product?.id &&
                                            !item.is_custom_line
                                        "
                                        :href="`/products/${item.product.id}`"
                                        class="font-semibold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-300"
                                    >
                                        {{ itemTitle(item) }}
                                    </Link>
                                    <span
                                        v-else
                                        class="font-semibold text-slate-950 dark:text-white"
                                    >
                                        {{ itemTitle(item) }}
                                    </span>
                                    <p class="mt-0.5 text-xs text-slate-500">
                                        {{
                                            item.variant?.sku ||
                                            item.product_sku ||
                                            'MISC'
                                        }}
                                        <span v-if="item.variant?.brand?.name">
                                            · {{ item.variant.brand.name }}
                                        </span>
                                    </p>
                                    <p
                                        v-if="item.notes"
                                        class="mt-1 text-xs text-amber-700 dark:text-amber-300"
                                    >
                                        {{ item.notes }}
                                    </p>
                                </td>
                                <td class="px-4 py-3 text-slate-600">
                                    {{ item.warehouse?.name || 'Sin bodega' }}
                                </td>
                                <td class="px-4 py-3 text-right font-semibold">
                                    {{ item.quantity }}
                                </td>
                                <td class="px-4 py-3 text-right">
                                    {{ formatCurrency(item.unit_price) }}
                                </td>
                                <td class="px-4 py-3 text-right">
                                    {{ formatCurrency(item.tax_amount) }}
                                </td>
                                <td class="px-4 py-3 text-right font-bold">
                                    {{ formatCurrency(item.total) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section
                v-show="activeTab === 'customer'"
                class="rounded-lg border border-slate-200 bg-white p-4 dark:border-border dark:bg-card"
            >
                <h2 class="flex items-center gap-2 text-sm font-bold">
                    <User :size="16" />
                    Cliente
                </h2>
                <div
                    v-if="quote.customer"
                    class="mt-4 grid gap-3 md:grid-cols-4"
                >
                    <div>
                        <p class="text-xs font-bold text-slate-500 uppercase">
                            Nombre
                        </p>
                        <Link
                            :href="`/customers/${quote.customer.id}`"
                            class="mt-1 inline-flex font-semibold text-indigo-600 underline-offset-2 hover:underline"
                        >
                            {{ quote.customer.name }}
                        </Link>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-slate-500 uppercase">
                            Codigo
                        </p>
                        <p class="mt-1 text-sm">
                            {{ quote.customer.code || '-' }}
                        </p>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-slate-500 uppercase">
                            Telefono
                        </p>
                        <p class="mt-1 text-sm">
                            {{ quote.customer.phone || '-' }}
                        </p>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-slate-500 uppercase">
                            Email
                        </p>
                        <p class="mt-1 text-sm">
                            {{ quote.customer.email || '-' }}
                        </p>
                    </div>
                </div>
                <p v-else class="mt-4 text-sm text-slate-500">
                    Publico general.
                </p>
            </section>

            <section
                v-show="activeTab === 'workflow'"
                class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]"
            >
                <div
                    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <h2 class="text-sm font-bold">Acciones disponibles</h2>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button
                            v-if="workflow.actions.can_send_to_deposit"
                            type="button"
                            :disabled="actionLoading === 'send-to-deposit'"
                            class="inline-flex h-9 items-center gap-2 rounded-md bg-amber-600 px-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                            @click="handleTransition('send-to-deposit')"
                        >
                            <Package :size="16" />
                            Enviar a deposito
                        </button>
                        <button
                            v-if="workflow.actions.can_send_to_cashier"
                            type="button"
                            :disabled="actionLoading === 'send-to-cashier'"
                            class="inline-flex h-9 items-center gap-2 rounded-md bg-sky-600 px-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                            @click="handleTransition('send-to-cashier')"
                        >
                            <ArrowRightLeft :size="16" />
                            Enviar a caja
                        </button>
                        <button
                            v-if="workflow.actions.can_mark_collected"
                            type="button"
                            :disabled="actionLoading === 'mark-collected'"
                            class="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            @click="handleTransition('mark-collected')"
                        >
                            <CheckCircle :size="16" />
                            Marcar cobrada
                        </button>
                        <button
                            v-if="workflow.actions.can_convert"
                            type="button"
                            :disabled="actionLoading === 'convert'"
                            class="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                            @click="handleConvert"
                        >
                            <FileCheck :size="16" />
                            Convertir
                        </button>
                    </div>
                </div>
                <div
                    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-border dark:bg-card"
                >
                    <h2 class="text-sm font-bold">Fechas</h2>
                    <div class="mt-3 space-y-2 text-sm">
                        <div class="flex justify-between gap-3">
                            <span class="text-slate-500">Creada</span>
                            <span>{{ formatDate(quote.date) }}</span>
                        </div>
                        <div class="flex justify-between gap-3">
                            <span class="text-slate-500">Valida hasta</span>
                            <span>{{ formatDate(quote.valid_until) }}</span>
                        </div>
                        <div class="flex justify-between gap-3">
                            <span class="text-slate-500">Caja</span>
                            <span>{{
                                formatDateTime(quote.sent_to_cashier_at)
                            }}</span>
                        </div>
                    </div>
                </div>
            </section>

            <section
                v-show="activeTab === 'stock'"
                class="rounded-lg border border-slate-200 bg-white p-4 dark:border-border dark:bg-card"
            >
                <h2 class="text-sm font-bold">Disponibilidad por item</h2>
                <div class="mt-4 divide-y divide-slate-100 dark:divide-border">
                    <div
                        v-for="item in items"
                        :key="`stock-${item.id}`"
                        class="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_180px_180px]"
                    >
                        <div>
                            <p class="font-semibold">{{ itemTitle(item) }}</p>
                            <p class="text-xs text-slate-500">
                                {{ item.warehouse?.name || 'Sin bodega' }}
                            </p>
                        </div>
                        <div class="text-sm">
                            <span class="text-slate-500">Solicitado:</span>
                            <span class="ml-1 font-semibold">{{
                                item.stock.requested_quantity
                            }}</span>
                        </div>
                        <div class="text-sm">
                            <span class="text-slate-500">Disponible:</span>
                            <span class="ml-1 font-semibold">{{
                                item.stock.available_quantity ?? 'N/A'
                            }}</span>
                            <p
                                v-if="item.stock.missing_quantity > 0"
                                class="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300"
                            >
                                Faltan {{ item.stock.missing_quantity }}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section
                v-show="activeTab === 'documents'"
                class="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
            >
                <button
                    v-for="document in detail.documents"
                    :key="`${document.type}-${document.mode}`"
                    type="button"
                    class="rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-border dark:bg-card dark:hover:bg-muted"
                    @click="openDocument(document.href)"
                >
                    <FileText :size="18" class="text-indigo-600" />
                    <p class="mt-2 font-semibold">{{ document.label }}</p>
                    <p class="text-xs text-slate-500">{{ document.mode }}</p>
                </button>
            </section>

            <section
                v-show="activeTab === 'activity'"
                class="rounded-lg border border-slate-200 bg-white p-4 dark:border-border dark:bg-card"
            >
                <h2 class="text-sm font-bold">Actividad</h2>
                <div class="mt-4 divide-y divide-slate-100 dark:divide-border">
                    <div
                        v-for="event in detail.timeline"
                        :key="`${event.type}-${event.occurred_at}`"
                        class="grid gap-2 py-3 md:grid-cols-[180px_minmax(0,1fr)_140px]"
                    >
                        <div
                            class="font-mono text-xs text-slate-500 dark:text-slate-400"
                        >
                            {{ formatDateTime(event.occurred_at) }}
                        </div>
                        <div class="font-semibold">
                            <Link
                                v-if="event.href"
                                :href="event.href"
                                class="text-indigo-600 underline-offset-2 hover:underline"
                            >
                                {{ event.label }}
                            </Link>
                            <span v-else>{{ event.label }}</span>
                        </div>
                        <div class="text-xs text-slate-500">
                            {{ event.source }}
                        </div>
                    </div>
                </div>
            </section>

            <PrintTicketModal
                :show="showPrintModal"
                :order-id="quote.id"
                :order-number="quote.quote_number"
                sourceRoute="sales-quotes"
                @close="showPrintModal = false"
            />
        </template>
    </div>
</template>
