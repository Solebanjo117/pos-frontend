<script setup lang="ts">
import { Trash2, Save, Lock, CreditCard, FileText } from 'lucide-vue-next';
import { computed } from 'vue';
import { useAuth } from '@/composables/useAuth';

const props = defineProps<{
    hasOpenSession: boolean;
    canPay: boolean;
    isQuoteSession?: boolean;
    quoteMode?: boolean;
    canClear?: boolean;
    cashierMode?: boolean;
}>();

const emit = defineEmits([
    'clear',
    'save-quote',
    'save-quote-changes',
    'open-cash-register',
    'open-payment-modal',
]);

const { hasRole } = useAuth();
const canManageCashRegister = computed(() =>
    hasRole(['admin', 'manager', 'cashier']),
);
</script>

<template>
    <div class="flex flex-1 flex-col justify-end gap-3">
        <!-- Top Actions -->
        <div v-if="!props.cashierMode" class="grid grid-cols-2 gap-2">
            <button
                v-if="props.canClear !== false"
                @click="emit('clear')"
                class="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:border-border dark:bg-muted/80 dark:text-gray-300 dark:hover:bg-muted"
            >
                <Trash2 class="h-3.5 w-3.5" />
                Limpiar
            </button>

            <!-- Quote session: save changes -->
            <button
                v-if="props.isQuoteSession"
                @click="emit('save-quote-changes')"
                class="flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40"
            >
                <Save class="h-3.5 w-3.5" />
                Guardar Cambios
            </button>

            <!-- Cotizar: hidden when in a quote session (but always shown in quoteMode) -->
            <button
                v-if="!props.isQuoteSession || props.quoteMode"
                @click="emit('save-quote')"
                class="flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40"
            >
                <FileText class="h-3.5 w-3.5" />
                Cotizar
            </button>
        </div>

        <!-- Warning / Abre Caja Button (hidden in quoteMode) -->
        <button
            v-if="!props.quoteMode && !hasOpenSession && canManageCashRegister"
            @click="emit('open-cash-register')"
            class="flex w-full items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-500 transition-colors hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-900/20 dark:hover:bg-orange-900/40"
        >
            <Lock class="h-3.5 w-3.5" />
            Abre caja para cobrar
        </button>

        <!-- Payment Button (hidden in quoteMode) -->
        <div v-if="!props.quoteMode" class="mt-2">
            <button
                :disabled="!hasOpenSession || !canPay"
                @click="emit('open-payment-modal')"
                class="group relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-green-500 text-white shadow-sm transition-all hover:bg-green-600 hover:shadow-md active:scale-[0.98] disabled:bg-gray-300 dark:bg-green-600 dark:hover:bg-green-500 dark:disabled:bg-muted"
                :class="{
                    'cursor-not-allowed opacity-50': !hasOpenSession || !canPay,
                }"
            >
                <div
                    class="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100"
                ></div>
                <CreditCard
                    class="h-6 w-6 transition-transform group-hover:scale-110"
                />
                <span class="text-lg font-bold tracking-wide">Cobrar</span>
            </button>
        </div>
    </div>
</template>
