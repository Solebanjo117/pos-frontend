<script setup lang="ts">
import { AlertCircle, Lock } from 'lucide-vue-next';
import { computed } from 'vue';
import { useAuth } from '@/composables/useAuth';

const { hasRole } = useAuth();
// Only admin, manager, and cashier can open/close the register
const canManageCashRegister = computed(() =>
    hasRole(['admin', 'manager', 'cashier']),
);

defineProps<{
    hasOpenSession: boolean;
}>();

const emit = defineEmits(['request-open']);
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
    </div>
</template>
