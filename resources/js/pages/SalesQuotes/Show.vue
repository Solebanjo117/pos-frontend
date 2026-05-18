<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Head, Link, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import { usePOS } from '@/composables/usePOS';
import {
    FileText,
    ArrowLeft,
    Edit,
    ArrowRightLeft,
    Download,
    Clock,
    CheckCircle,
    XCircle,
    Send,
    FileCheck,
    EyeOff,
    User,
    MapPin,
    Calendar,
    Package,
    Hash,
    ShoppingCart,
} from 'lucide-vue-next';

defineOptions({ layout: AppLayout });

const props = defineProps<{ id: number }>();

interface QuoteItem {
    id: number;
    product_id: number | null;
    product_name: string;
    product_sku: string;
    is_custom_line?: boolean;
    custom_description?: string | null;
    variant_id?: number;
    variant?: { id: number; sku: string; brand?: { name: string } } | null;
    warehouse_id: number;
    warehouse?: { name: string } | null;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    discount_amount: number;
    tax_percent: number;
    tax_amount: number;
    subtotal: number;
    total: number;
    notes?: string | null;
}

interface SalesQuote {
    id: number;
    quote_number: string;
    customer: {
        id: number;
        name: string;
        code?: string;
        phone?: string;
        email?: string;
    } | null;
    user: { id: number; name: string } | null;
    warehouse: { id: number; name: string } | null;
    date: string;
    valid_until: string | null;
    status: string;
    status_label: string;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    total: number;
    formatted_total: string;
    notes: string | null;
    converted_order_id: number | null;
    converted_order?: { id: number; order_number: string } | null;
    items: QuoteItem[];
}

const quote = ref<SalesQuote | null>(null);
const loading = ref(true);
const error = ref('');

const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-card dark:text-gray-300',
    sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    accepted:
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    expired:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    converted:
        'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
};

const statusIcons: Record<string, any> = {
    draft: Clock,
    sent: Send,
    accepted: CheckCircle,
    rejected: XCircle,
    expired: Clock,
    converted: FileCheck,
};

const fetchQuote = async () => {
    loading.value = true;
    try {
        const res = await apiClient.get(`/sales-quotes/${props.id}`);
        quote.value = res.data;
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'Error al cargar la cotización';
    } finally {
        loading.value = false;
    }
};

const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

import PrintTicketModal from '@/components/POS/PrintTicketModal.vue';

const formatCurrency = (v: number) => {
    return '$' + Number(v || 0).toFixed(2);
};

const openPdf = (
    format: 'ticket' | 'proforma',
    mode: 'standard' | 'blind' = 'standard',
) => {
    // Legacy fallback, kept just in case but we use the modal now.
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(
        /\/$/,
        '',
    );
    window.open(
        `${baseUrl}/sales-quotes/${props.id}/${format}?mode=${mode}`,
        '_blank',
    );
};

const showPrintModal = ref(false);
const canEdit = () =>
    quote.value && ['draft', 'sent'].includes(quote.value.status);

const handleTransition = async (
    action: 'send-to-deposit' | 'send-to-cashier' | 'mark-collected',
) => {
    const labels: Record<string, string> = {
        'send-to-deposit': 'enviar a Depósito',
        'send-to-cashier': 'enviar a Caja',
        'mark-collected': 'marcar como Cobrada',
    };
    if (!confirm(`¿Deseas ${labels[action]} esta cotización?`)) return;
    try {
        await apiClient.post(`/sales-quotes/${props.id}/${action}`);

        if (action === 'send-to-cashier') {
            handleOpenInPOS();
        } else {
            await fetchQuote();
        }
    } catch (e: any) {
        alert(e.response?.data?.message || 'Error al cambiar el estado');
    }
};

const { loadQuoteAsSession } = usePOS();

const openingInPOS = ref(false);
const canOpenInPOS = () =>
    quote.value &&
    !['converted', 'rejected', 'expired', 'collected'].includes(
        quote.value.status,
    );

const handleOpenInPOS = () => {
    if (!quote.value) return;
    openingInPOS.value = true;

    // Build a minimal quote object that matches loadQuoteAsSession's expected shape
    const quoteForSession = {
        id: quote.value.id,
        quote_number: quote.value.quote_number,
        customer_id: quote.value.customer?.id ?? null,
        items: quote.value.items.map((item) => ({
            product_id: item.product_id ?? null,
            product_name: item.product_name,
            product_sku: item.product_sku,
            variant_id: item.variant_id ?? null,
            warehouse_id: item.warehouse_id ?? null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent,
            tax_percent: item.tax_percent,
            subtotal: item.subtotal,
            tax_amount: item.tax_amount,
            total: item.total,
            is_custom_line: !!item.is_custom_line,
            custom_description: item.custom_description ?? null,
            variant: item.variant ?? null,
        })),
    };

    loadQuoteAsSession(quoteForSession);
    router.visit('/pos');
};

onMounted(fetchQuote);
</script>

<template>
    <Head :title="`Cotización ${quote?.quote_number || ''}`" />

    <div class="mx-auto max-w-5xl space-y-6">
        <!-- Loading -->
        <div v-if="loading" class="py-20 text-center text-gray-500">
            <div
                class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"
            ></div>
            Cargando cotización...
        </div>

        <!-- Error -->
        <div
            v-else-if="error"
            class="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20"
        >
            <p class="font-medium text-red-600 dark:text-red-400">
                {{ error }}
            </p>
            <Link
                href="/sales-quotes"
                class="mt-2 inline-block text-sm text-indigo-600 hover:underline dark:text-primary"
                >← Volver al listado</Link
            >
        </div>

        <!-- Content -->
        <template v-else-if="quote">
            <!-- Header -->
            <div
                class="flex flex-col justify-between gap-4 md:flex-row md:items-center"
            >
                <div class="flex items-center gap-4">
                    <Link
                        href="/sales-quotes"
                        class="rounded-lg p-2 transition hover:bg-gray-100 dark:hover:bg-muted/50"
                    >
                        <ArrowLeft :size="20" class="text-gray-500" />
                    </Link>
                    <div>
                        <h1
                            class="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-white"
                        >
                            <FileText
                                class="h-7 w-7 text-indigo-600 dark:text-primary"
                            />
                            {{ quote.quote_number }}
                        </h1>
                        <div class="mt-1 flex items-center gap-2">
                            <span
                                :class="[
                                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                                    statusColors[quote.status] ||
                                        statusColors.draft,
                                ]"
                            >
                                <component
                                    :is="statusIcons[quote.status] || Clock"
                                    :size="12"
                                />
                                {{ quote.status_label }}
                            </span>
                            <span class="text-xs text-gray-500"
                                >por {{ quote.user?.name || 'Sistema' }}</span
                            >
                        </div>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    <!-- Print Modal Trigger -->
                    <button
                        @click="showPrintModal = true"
                        class="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                    >
                        <Download :size="16" /> Imprimir Documento
                    </button>

                    <!-- Editar en POS -->
                    <button
                        v-if="canOpenInPOS()"
                        @click="handleOpenInPOS"
                        :disabled="openingInPOS"
                        class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        title="Carga esta cotización como una nueva pestaña en el POS para editar"
                    >
                        <ShoppingCart :size="16" />
                        {{ openingInPOS ? 'Abriendo...' : 'Editar en POS' }}
                    </button>
                </div>
            </div>

            <!-- Info cards -->
            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                <!-- Customer -->
                <div
                    class="rounded-xl border border-gray-200 bg-white p-5 dark:border-border dark:bg-card"
                >
                    <h3
                        class="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-gray-500 uppercase"
                    >
                        <User :size="14" /> Cliente
                    </h3>
                    <p class="font-medium text-gray-900 dark:text-white">
                        {{ quote.customer?.name || 'Público General' }}
                    </p>
                    <p
                        v-if="quote.customer?.code"
                        class="mt-1 text-xs text-gray-500"
                    >
                        Código: {{ quote.customer.code }}
                    </p>
                    <p
                        v-if="quote.customer?.phone"
                        class="text-xs text-gray-500"
                    >
                        {{ quote.customer.phone }}
                    </p>
                    <p
                        v-if="quote.customer?.email"
                        class="text-xs text-gray-500"
                    >
                        {{ quote.customer.email }}
                    </p>
                </div>

                <!-- Dates -->
                <div
                    class="rounded-xl border border-gray-200 bg-white p-5 dark:border-border dark:bg-card"
                >
                    <h3
                        class="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-gray-500 uppercase"
                    >
                        <Calendar :size="14" /> Fechas
                    </h3>
                    <div class="space-y-1.5">
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-500">Creada</span>
                            <span class="text-gray-900 dark:text-white">{{
                                formatDate(quote.date)
                            }}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-500">Válida hasta</span>
                            <span class="text-gray-900 dark:text-white">{{
                                formatDate(quote.valid_until ?? '')
                            }}</span>
                        </div>
                    </div>
                </div>

                <!-- Warehouse / OV link -->
                <div
                    class="rounded-xl border border-gray-200 bg-white p-5 dark:border-border dark:bg-card"
                >
                    <h3
                        class="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-gray-500 uppercase"
                    >
                        <MapPin :size="14" /> Almacén
                    </h3>
                    <p class="font-medium text-gray-900 dark:text-white">
                        {{ quote.warehouse?.name || '—' }}
                    </p>
                    <div
                        v-if="quote.converted_order_id"
                        class="mt-3 border-t border-gray-200 pt-3 dark:border-border"
                    >
                        <p class="mb-1 text-xs text-gray-500">Convertida a:</p>
                        <Link
                            :href="`/sales-orders/${quote.converted_order_id}`"
                            class="text-sm font-semibold text-indigo-600 transition hover:text-indigo-800 dark:text-primary"
                        >
                            OV #{{
                                quote.converted_order?.order_number ||
                                quote.converted_order_id
                            }}
                        </Link>
                    </div>
                </div>
            </div>

            <!-- Items table -->
            <div
                class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-border dark:bg-card"
            >
                <div
                    class="border-b border-gray-200 px-6 py-4 dark:border-border"
                >
                    <h2
                        class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        <Package :size="18" /> Productos ({{
                            quote.items.length
                        }})
                    </h2>
                </div>
                <div class="overflow-x-auto">
                    <table
                        class="min-w-full divide-y divide-gray-200 dark:divide-border"
                    >
                        <thead class="bg-gray-50 dark:bg-background">
                            <tr>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    #
                                </th>
                                <th
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Producto
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Cant.
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Precio U.
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Total
                                </th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-200 dark:divide-border"
                        >
                            <tr
                                v-for="(item, idx) in quote.items"
                                :key="item.id"
                                class="dark:hover:bg-muted/50/30 hover:bg-gray-50"
                            >
                                <td
                                    class="px-6 py-4 font-mono text-sm text-gray-400"
                                >
                                    {{ idx + 1 }}
                                </td>
                                <td class="px-6 py-4">
                                    <div class="flex items-center gap-2">
                                        <div
                                            class="text-sm font-medium text-gray-900 dark:text-white"
                                        >
                                            {{
                                                item.is_custom_line
                                                    ? item.custom_description ||
                                                      item.product_name
                                                    : item.product_name
                                            }}
                                        </div>
                                        <span
                                            v-if="item.is_custom_line"
                                            class="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                        >
                                            Miscelaneo
                                        </span>
                                    </div>
                                    <div class="text-xs text-gray-500">
                                        {{
                                            item.variant?.sku ||
                                            item.product_sku ||
                                            (item.is_custom_line ? 'MISC' : '')
                                        }}
                                        <span
                                            v-if="item.variant?.brand?.name"
                                            class="ml-1 text-indigo-500"
                                            >&bull;
                                            {{ item.variant.brand.name }}</span
                                        >
                                    </div>
                                    <!-- Nota interna (no aparece en ticket) -->
                                    <div
                                        v-if="item.notes"
                                        class="mt-1 flex items-center gap-1"
                                    >
                                        <span
                                            class="inline-flex items-center gap-1 rounded border border-yellow-200 bg-yellow-50 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:border-yellow-700/40 dark:bg-yellow-900/20 dark:text-yellow-400"
                                        >
                                            📋 {{ item.notes }}
                                        </span>
                                    </div>
                                </td>
                                <td
                                    class="px-6 py-4 text-right text-sm text-gray-900 dark:text-white"
                                >
                                    {{ item.quantity }}
                                </td>
                                <td
                                    class="px-6 py-4 text-right text-sm text-gray-900 dark:text-white"
                                >
                                    {{ formatCurrency(item.unit_price) }}
                                </td>
                                <td
                                    class="px-6 py-4 text-right text-sm font-bold text-gray-900 dark:text-white"
                                >
                                    {{ formatCurrency(item.total) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Totals -->
                <div
                    class="border-t border-gray-200 px-6 py-5 dark:border-border"
                >
                    <div class="flex justify-end">
                        <div class="w-72 space-y-2">
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-500">Subtotal</span>
                                <span class="text-gray-900 dark:text-white">{{
                                    formatCurrency(quote.subtotal)
                                }}</span>
                            </div>
                            <div
                                v-if="quote.discount_amount > 0"
                                class="flex justify-between text-sm"
                            >
                                <span class="text-gray-500">Descuento</span>
                                <span class="text-green-600"
                                    >-{{
                                        formatCurrency(quote.discount_amount)
                                    }}</span
                                >
                            </div>
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-500">Impuestos</span>
                                <span class="text-gray-900 dark:text-white">{{
                                    formatCurrency(quote.tax_amount)
                                }}</span>
                            </div>
                            <div
                                class="mt-2 flex justify-between border-t border-gray-200 pt-2 text-lg font-bold dark:border-border"
                            >
                                <span class="text-gray-900 dark:text-white"
                                    >Total</span
                                >
                                <span
                                    class="text-indigo-600 dark:text-primary"
                                    >{{ quote.formatted_total }}</span
                                >
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Notes -->
            <div
                v-if="quote.notes"
                class="rounded-xl border border-gray-200 bg-white p-5 dark:border-border dark:bg-card"
            >
                <h3
                    class="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase"
                >
                    Notas
                </h3>
                <p
                    class="text-sm whitespace-pre-line text-gray-700 dark:text-gray-300"
                >
                    {{ quote.notes }}
                </p>
            </div>

            <PrintTicketModal
                :show="showPrintModal"
                :order-id="quote.id ?? null"
                :order-number="quote.quote_number"
                sourceRoute="sales-quotes"
                @close="showPrintModal = false"
            />
        </template>
    </div>
</template>
