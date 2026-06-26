<script setup lang="ts">
import { X, AlertCircle, Save } from 'lucide-vue-next';
import { ref } from 'vue';
import apiClient from '@/services/api/client';

const props = defineProps<{
    show: boolean;
}>();

const emit = defineEmits<{
    (e: 'created', customer: any): void;
    (e: 'update:show', value: boolean): void;
}>();

const loading = ref(false);
const error = ref<string | null>(null);

const form = ref({
    name: '',
    phone: '',
    email: '',
    credit_limit: 0,
    initial_balance: 0,
});

const handleOpen = () => {
    form.value = {
        name: '',
        phone: '',
        email: '',
        credit_limit: 0,
        initial_balance: 0,
    };
    error.value = null;
};

const close = () => {
    emit('update:show', false);
};

const handleSubmit = async () => {
    if (!form.value.name.trim()) {
        error.value = 'El nombre es obligatorio';
        return;
    }

    loading.value = true;
    error.value = null;

    try {
        const payload = {
            type: 'individual',
            name: form.value.name.trim(),
            phone: form.value.phone.trim() || undefined,
            email: form.value.email.trim() || undefined,
            credit_limit: form.value.credit_limit || 0,
            initial_balance: form.value.initial_balance || 0,
        };

        const response = await apiClient.post('/customers', payload);
        const newCustomer = response.data.data ?? response.data;

        emit('created', newCustomer);
        close();
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error al crear el cliente';
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <Transition name="modal">
        <div
            v-if="show"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
            <div
                class="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-card"
                @vue:mounted="handleOpen"
            >
                <!-- Header -->
                <div
                    class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-border"
                >
                    <h2 class="text-lg font-bold text-gray-900 dark:text-white">
                        Nuevo Cliente Rápido
                    </h2>
                    <button
                        @click="close"
                        class="text-gray-400 transition-colors hover:text-gray-600"
                    >
                        <X class="h-5 w-5" />
                    </button>
                </div>

                <div class="space-y-4 p-6">
                    <!-- Error -->
                    <div
                        v-if="error"
                        class="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20"
                    >
                        <AlertCircle class="h-4 w-4 flex-shrink-0" />
                        {{ error }}
                    </div>

                    <!-- Name -->
                    <div>
                        <label
                            class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                        >
                            Nombre del Cliente *
                        </label>
                        <input
                            v-model="form.name"
                            type="text"
                            placeholder="Nombre completo"
                            @keyup.enter="handleSubmit"
                            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                            required
                        />
                    </div>

                    <!-- Phone -->
                    <div>
                        <label
                            class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                        >
                            Teléfono
                        </label>
                        <input
                            v-model="form.phone"
                            type="tel"
                            placeholder="(Opcional)"
                            @keyup.enter="handleSubmit"
                            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <!-- Email -->
                    <div>
                        <label
                            class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                        >
                            Correo Electrónico
                        </label>
                        <input
                            v-model="form.email"
                            type="email"
                            placeholder="(Opcional)"
                            @keyup.enter="handleSubmit"
                            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <!-- Credit & Balance -->
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label
                                class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                            >
                                Límite de Crédito
                            </label>
                            <input
                                v-model.number="form.credit_limit"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                            />
                        </div>
                        <div>
                            <label
                                class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                            >
                                Saldo Inicial
                            </label>
                            <input
                                v-model.number="form.initial_balance"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                            />
                            <p
                                class="mt-1 text-[10px] text-gray-500 dark:text-gray-400"
                            >
                                Puede ser negativo
                            </p>
                        </div>
                    </div>

                    <!-- Submit -->
                    <button
                        @click="handleSubmit"
                        :disabled="loading || !form.name.trim()"
                        class="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-40 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                    >
                        <Save v-if="!loading" class="h-4 w-4" />
                        {{ loading ? 'Guardando...' : 'Guardar Cliente' }}
                    </button>
                </div>
            </div>
        </div>
    </Transition>
</template>
