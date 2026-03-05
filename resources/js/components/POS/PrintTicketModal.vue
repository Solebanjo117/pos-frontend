<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
    show: boolean
    orderId: number | null
    orderNumber?: string
    sourceRoute?: 'sales-orders' | 'sales-quotes'
}>(), {
    sourceRoute: 'sales-orders'
})

const emit = defineEmits<{
    close: []
}>()

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api/v1'

// Document type: 'ticket' (thermal), 'proforma' (half-letter landscape)
const docType = ref<'ticket' | 'proforma'>('ticket')

// Sub-type: internal (full SKU) vs client (masked)
const ticketFormat = ref<'internal' | 'client'>('internal')

// Reset when modal opens
watch(() => props.show, (newVal) => {
    if (newVal) {
        docType.value = 'ticket'
        ticketFormat.value = 'internal'
    }
})

const previewUrl = computed(() => {
    if (!props.orderId) return ''
    const endpoint = docType.value === 'proforma' ? 'proforma' : 'ticket'
    // Quotes API passes mode='standard'|'blind', Sales Orders passes type='internal'|'client'
    const queryParam = props.sourceRoute === 'sales-quotes' 
        ? `mode=${ticketFormat.value === 'client' ? 'blind' : 'standard'}`
        : `type=${ticketFormat.value}`
        
    return `${apiBase}/${props.sourceRoute}/${props.orderId}/${endpoint}?${queryParam}`
})

const noteUrl = computed(() => {
    if (!props.orderId || props.sourceRoute !== 'sales-orders') return ''
    return `${apiBase}/sales-orders/${props.orderId}/note`
})

const printTicket = () => {
    const iframe = document.getElementById('ticket-iframe') as HTMLIFrameElement | null
    if (iframe?.contentWindow) {
        iframe.focus()
        iframe.contentWindow.print()
    }
}
</script>

<template>
    <div
        v-if="show && orderId"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        @click.self="emit('close')"
    >
        <div class="bg-white dark:bg-card rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden relative"
             :class="docType === 'proforma' ? 'max-w-4xl' : 'max-w-lg'"
             style="max-height: 90vh;">
            
            <!-- Close button -->
            <button @click="emit('close')" class="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-200 dark:border-border">
                <div class="flex flex-col md:flex-row md:items-center gap-3">
                    <div class="mr-auto">
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white">Imprimir Documento</h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400">{{ orderNumber || `Orden #${orderId}` }}</p>
                    </div>

                    <!-- Document Type Selector -->
                    <div class="flex items-center gap-2">
                        <!-- Doc Type Toggle -->
                        <div class="flex items-center p-1 bg-gray-100 dark:bg-muted/50 rounded-lg">
                            <button
                                @click="docType = 'ticket'"
                                :class="[
                                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                                    docType === 'ticket'
                                        ? 'bg-white dark:bg-muted text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                ]"
                            >
                                🧾 Ticket
                            </button>
                            <button
                                @click="docType = 'proforma'"
                                :class="[
                                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                                    docType === 'proforma'
                                        ? 'bg-white dark:bg-muted text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                ]"
                            >
                                📋 Proforma
                            </button>
                        </div>

                        <!-- Separator -->
                        <div class="w-px h-6 bg-gray-300 dark:bg-border"></div>

                        <!-- Internal/Client Toggle -->
                        <div class="flex items-center p-1 bg-gray-100 dark:bg-muted/50 rounded-lg">
                            <button
                                @click="ticketFormat = 'internal'"
                                :class="[
                                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                                    ticketFormat === 'internal'
                                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                ]"
                            >
                                🔒 Interno
                            </button>
                            <button
                                @click="ticketFormat = 'client'"
                                :class="[
                                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                                    ticketFormat === 'client'
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                ]"
                            >
                                👤 Cliente
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Preview (iframe) -->
            <div class="flex-1 overflow-hidden bg-gray-100 dark:bg-background p-4 border-b border-gray-200 dark:border-border">
                <iframe
                    id="ticket-iframe"
                    :src="previewUrl"
                    class="w-full h-full rounded-lg border border-gray-200 dark:border-border bg-white"
                    style="min-height: 400px;"
                />
            </div>

            <!-- Actions -->
            <div class="px-6 py-4 flex items-center justify-between gap-3 bg-white dark:bg-card">
                <a
                    v-if="sourceRoute === 'sales-orders'"
                    :href="noteUrl"
                    target="_blank"
                    class="px-4 py-2.5 text-sm font-medium text-indigo-600 dark:text-primary dark:text-indigo-400 border border-indigo-300 dark:border-indigo-600 dark:border-primary rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                    📄 Nota A4
                </a>
                <div v-else></div>
                <div class="flex gap-2">
                    <button
                        @click="emit('close')"
                        class="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-border rounded-xl hover:bg-gray-50 dark:hover:bg-muted transition-colors"
                    >
                        Cerrar
                    </button>
                    <button
                        @click="printTicket"
                        class="px-6 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors shadow-sm flex items-center gap-2"
                    >
                        🖨️ Imprimir
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
