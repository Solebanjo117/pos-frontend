<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import apiClient from '@/services/api/client';

const props = withDefaults(
    defineProps<{
        show: boolean;
        orderId: number | null;
        orderNumber?: string;
        sourceRoute?: 'sales-orders' | 'sales-quotes';
    }>(),
    {
        sourceRoute: 'sales-orders',
    },
);

const emit = defineEmits<{
    close: [];
}>();

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Document type: 'ticket' (thermal), 'proforma' (half-letter landscape)
const docType = ref<'ticket' | 'proforma'>('ticket');

// Sub-type: internal (full SKU) vs client (masked)
const ticketFormat = ref<'internal' | 'client'>('internal');
const iframeRef = ref<HTMLIFrameElement | null>(null);
const previewObjectUrl = ref('');
const previewLoading = ref(false);
const previewReady = ref(false);
const previewError = ref<string | null>(null);
let previewRequest = 0;
let previewAbortController: AbortController | null = null;

// Reset when modal opens
watch(
    () => props.show,
    (newVal) => {
        if (newVal) {
            docType.value = 'ticket';
            ticketFormat.value = 'internal';
        } else {
            previewAbortController?.abort();
            previewRequest += 1;
            releasePreview();
        }
    },
);

const previewEndpoint = computed(() => {
    if (!props.orderId) return '';
    const endpoint = docType.value === 'proforma' ? 'proforma' : 'ticket';
    // Quotes API passes mode='standard'|'blind', Sales Orders passes type='internal'|'client'
    const queryParam =
        props.sourceRoute === 'sales-quotes'
            ? `mode=${ticketFormat.value === 'client' ? 'blind' : 'standard'}`
            : `type=${ticketFormat.value}`;

    return `/${props.sourceRoute}/${props.orderId}/${endpoint}?${queryParam}`;
});

const noteUrl = computed(() => {
    if (!props.orderId || props.sourceRoute !== 'sales-orders') return '';
    return `${apiBase}/sales-orders/${props.orderId}/note`;
});

const printTicket = () => {
    if (!previewReady.value || previewLoading.value) return;
    if (iframeRef.value?.contentWindow) {
        iframeRef.value.focus();
        iframeRef.value.contentWindow.print();
    }
};

function releasePreview() {
    if (previewObjectUrl.value) {
        URL.revokeObjectURL(previewObjectUrl.value);
        previewObjectUrl.value = '';
    }
    previewReady.value = false;
}

const loadPreview = async () => {
    if (!props.show || !previewEndpoint.value) return;

    const requestId = ++previewRequest;
    previewAbortController?.abort();
    previewAbortController = new AbortController();
    previewLoading.value = true;
    previewReady.value = false;
    previewError.value = null;

    try {
        const response = await apiClient.get(previewEndpoint.value, {
            responseType: 'blob',
            signal: previewAbortController.signal,
        });
        if (requestId !== previewRequest) return;

        releasePreview();
        previewObjectUrl.value = URL.createObjectURL(response.data);
    } catch (error: any) {
        if (requestId !== previewRequest || error?.code === 'ERR_CANCELED')
            return;
        const status = Number(error.response?.status || 0);
        previewError.value =
            status === 403
                ? 'No tienes permiso para consultar este documento.'
                : status === 404
                  ? 'El documento solicitado ya no existe.'
                  : status === 422
                    ? 'El formato seleccionado no es válido.'
                    : 'No se pudo cargar el documento para imprimir.';
    } finally {
        if (requestId === previewRequest) previewLoading.value = false;
    }
};

watch(
    [
        () => props.show,
        () => props.orderId,
        () => props.sourceRoute,
        docType,
        ticketFormat,
    ],
    loadPreview,
    { immediate: true },
);

onBeforeUnmount(() => {
    previewAbortController?.abort();
    releasePreview();
});
</script>

<template>
    <div
        v-if="show && orderId"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        @click.self="emit('close')"
    >
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="print-document-title"
            class="relative flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-card"
            :class="docType === 'proforma' ? 'max-w-4xl' : 'max-w-lg'"
            style="max-height: 90vh"
        >
            <!-- Close button -->
            <button
                type="button"
                aria-label="Cerrar impresión"
                @click="emit('close')"
                class="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
                <svg
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                    />
                </svg>
            </button>

            <!-- Header -->
            <div class="border-b border-gray-200 px-6 py-4 dark:border-border">
                <div class="flex flex-col gap-3 md:flex-row md:items-center">
                    <div class="mr-auto">
                        <h2
                            id="print-document-title"
                            class="text-lg font-bold text-gray-900 dark:text-white"
                        >
                            Imprimir Documento
                        </h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                            {{ orderNumber || `Orden #${orderId}` }}
                        </p>
                    </div>

                    <!-- Document Type Selector -->
                    <div class="flex items-center gap-2">
                        <!-- Doc Type Toggle -->
                        <div
                            class="flex items-center rounded-lg bg-gray-100 p-1 dark:bg-muted/50"
                        >
                            <button
                                @click="docType = 'ticket'"
                                :class="[
                                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                                    docType === 'ticket'
                                        ? 'bg-white text-gray-900 shadow-sm dark:bg-muted dark:text-white'
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
                                ]"
                            >
                                🧾 Ticket
                            </button>
                            <button
                                @click="docType = 'proforma'"
                                :class="[
                                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                                    docType === 'proforma'
                                        ? 'bg-white text-gray-900 shadow-sm dark:bg-muted dark:text-white'
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
                                ]"
                            >
                                📋 Proforma
                            </button>
                        </div>

                        <!-- Separator -->
                        <div class="h-6 w-px bg-gray-300 dark:bg-border"></div>

                        <!-- Internal/Client Toggle -->
                        <div
                            class="flex items-center rounded-lg bg-gray-100 p-1 dark:bg-muted/50"
                        >
                            <button
                                @click="ticketFormat = 'internal'"
                                :class="[
                                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                                    ticketFormat === 'internal'
                                        ? 'bg-amber-100 text-amber-800 shadow-sm dark:bg-amber-900/30 dark:text-amber-300'
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
                                ]"
                            >
                                🔒 Interno
                            </button>
                            <button
                                @click="ticketFormat = 'client'"
                                :class="[
                                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                                    ticketFormat === 'client'
                                        ? 'bg-green-100 text-green-800 shadow-sm dark:bg-green-900/30 dark:text-green-300'
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
                                ]"
                            >
                                👤 Cliente
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Preview (iframe) -->
            <div
                class="relative flex-1 overflow-hidden border-b border-gray-200 bg-gray-100 p-4 dark:border-border dark:bg-background"
            >
                <iframe
                    v-if="previewObjectUrl"
                    ref="iframeRef"
                    :src="previewObjectUrl"
                    title="Vista previa del documento"
                    class="h-full w-full rounded-lg border border-gray-200 bg-white dark:border-border"
                    style="min-height: 400px"
                    @load="previewReady = true"
                />
                <div
                    v-if="previewLoading"
                    class="flex min-h-[400px] items-center justify-center text-sm text-gray-500 dark:text-gray-400"
                >
                    Cargando documento...
                </div>
                <div
                    v-else-if="previewError"
                    class="flex min-h-[400px] flex-col items-center justify-center gap-3 px-6 text-center"
                >
                    <p class="text-sm text-red-600 dark:text-red-300">
                        {{ previewError }}
                    </p>
                    <button
                        type="button"
                        class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium dark:border-border"
                        @click="loadPreview"
                    >
                        Reintentar
                    </button>
                </div>
            </div>

            <!-- Actions -->
            <div
                class="flex items-center justify-between gap-3 bg-white px-6 py-4 dark:bg-card"
            >
                <a
                    v-if="sourceRoute === 'sales-orders'"
                    :href="noteUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="rounded-xl border border-indigo-300 px-4 py-2.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:border-indigo-600 dark:border-primary dark:text-indigo-400 dark:text-primary dark:hover:bg-indigo-900/20"
                >
                    📄 Nota A4
                </a>
                <div v-else></div>
                <div class="flex gap-2">
                    <button
                        @click="emit('close')"
                        class="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted"
                    >
                        Cerrar
                    </button>
                    <button
                        @click="printTicket"
                        :disabled="!previewReady || previewLoading"
                        class="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        🖨️ Imprimir
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
