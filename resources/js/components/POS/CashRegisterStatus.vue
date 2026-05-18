<script setup lang="ts">
import { computed } from 'vue';
import { AlertCircle, Lock, LockOpen, ArrowDownUp } from 'lucide-vue-next';
import { usePosSession } from '@/composables/usePosSession';
import { formatCurrency } from '@/utils/formatters';
import { usePage } from '@inertiajs/vue3';
import { useAuth } from '@/composables/useAuth';

const page = usePage();
const userName = computed(
    () => (page.props.auth as any)?.user?.name || 'Vendedor',
);

const { hasRole } = useAuth();
// Only admin, manager, and cashier can open/close the register
const canManageCashRegister = computed(() =>
    hasRole(['admin', 'manager', 'cashier']),
);

const { session, openSession } = usePosSession();

const props = defineProps<{
    hasOpenSession: boolean;
}>();

const emit = defineEmits(['request-open', 'request-cash-movement']);
</script>

<template>
    <div>
        <!-- Session Closed Warning -->
        <div
            v-if="!hasOpenSession"
            class="flex items-center justify-between border-b border-blue-100 bg-blue-50 px-6 py-3 dark:border-blue-900/50 dark:bg-blue-900/20"
        >
            <div
                class="flex items-center gap-3 text-blue-700 dark:text-blue-400"
            >
                <AlertCircle class="h-5 w-5 flex-shrink-0" />
                <span class="text-sm font-medium md:text-base"
                    >Caja no iniciada – Debes abrir una sesión para habilitar
                    las ventas.</span
                >
            </div>

            <div v-if="canManageCashRegister" class="flex items-center gap-3">
                <button
                    @click="emit('request-open')"
                    class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-blue-600 dark:hover:bg-primary/90"
                >
                    <Lock class="h-4 w-4" />
                    Abrir Caja
                </button>
            </div>
        </div>

        <!-- Session Open Status -->
        <div
            v-else
            class="flex items-center justify-between border-b border-emerald-100 bg-emerald-50 px-6 py-3 dark:border-emerald-900/50 dark:bg-emerald-900/20"
        >
            <div
                class="flex items-center gap-3 text-emerald-800 dark:text-emerald-400"
            >
                <LockOpen class="h-5 w-5 flex-shrink-0" />
                <span class="text-sm font-medium md:text-base">
                    Caja Abierta (Usuario: {{ userName }})
                </span>
            </div>

            <div class="flex items-center gap-4">
                <div class="text-sm text-emerald-700 dark:text-emerald-300">
                    <span class="hidden md:inline">Fondo inicial:</span>
                    <span class="font-bold">{{
                        formatCurrency(session?.opening_amount || 0)
                    }}</span>
                </div>
                <template v-if="canManageCashRegister">
                    <button
                        @click="emit('request-cash-movement')"
                        class="flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
                        title="Registrar retiro o ingreso de efectivo"
                    >
                        <ArrowDownUp class="h-4 w-4" />
                        <span class="hidden md:inline">Mov. Caja</span>
                    </button>
                </template>
            </div>
        </div>
    </div>
</template>
