<script setup lang="ts">
import { ref } from 'vue';
import { AlertCircle, Banknote, LogIn } from 'lucide-vue-next';

const props = defineProps<{
    show: boolean;
    loading?: boolean;
    error?: string | null;
}>();

const emit = defineEmits<{
    (e: 'submit', amount: number): void;
}>();

const openingAmount = ref<number>(0);

const handleSubmit = () => {
    emit('submit', Number(openingAmount.value));
};
</script>

<template>
    <!-- Inline session banner — does NOT block navigation -->
    <Transition name="session-banner">
        <div
            v-if="show"
            class="border-b border-blue-200 bg-blue-50 px-5 py-3 dark:border-blue-800 dark:bg-blue-900/30"
        >
            <div class="flex flex-wrap items-center gap-4">
                <!-- Icon + text -->
                <div class="flex min-w-0 flex-1 items-center gap-2">
                    <LogIn
                        class="flex-shrink-0 text-blue-600 dark:text-blue-400 dark:text-primary"
                        :size="18"
                    />
                    <div>
                        <p
                            class="text-sm font-semibold text-blue-800 dark:text-blue-200"
                        >
                            Caja no iniciada
                        </p>
                        <p
                            class="text-xs text-blue-600 dark:text-blue-400 dark:text-primary"
                        >
                            Ingresa el fondo inicial para habilitar ventas.
                        </p>
                    </div>
                </div>

                <!-- Error -->
                <div
                    v-if="error"
                    class="flex items-center gap-1 text-xs text-red-600 dark:text-red-400"
                >
                    <AlertCircle :size="14" />
                    {{ error }}
                </div>

                <!-- Form inline -->
                <form
                    @submit.prevent="handleSubmit"
                    class="flex items-center gap-2"
                >
                    <div class="relative">
                        <div
                            class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5"
                        >
                            <Banknote class="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            v-model.number="openingAmount"
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            class="w-36 rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-8 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Fondo: 0.00"
                        />
                    </div>
                    <button
                        type="submit"
                        :disabled="loading || openingAmount < 0"
                        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                    >
                        {{ loading ? 'Abriendo...' : 'Abrir Caja' }}
                    </button>
                </form>
            </div>
        </div>
    </Transition>
</template>
