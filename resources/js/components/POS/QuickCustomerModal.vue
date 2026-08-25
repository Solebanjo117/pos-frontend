<script setup lang="ts">
import { X, AlertCircle, Save } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { CustomersApiService } from '@/services/customers';
import apiClient from '@/services/api/client';
import type { CustomerType } from '@/types/customer';

const props = defineProps<{
    show: boolean;
}>();

const emit = defineEmits<{
    (e: 'created', customer: any): void;
    (e: 'update:show', value: boolean): void;
}>();

const loading = ref(false);
const loadingTypes = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});
const customerTypes = ref<CustomerType[]>([]);

const form = ref({
    customer_type_id: null as number | null,
    name: '',
    phone: '',
    email: '',
    credit_limit: 0,
    initial_balance: 0,
});

const handleOpen = () => {
    form.value = {
        customer_type_id: null,
        name: '',
        phone: '',
        email: '',
        credit_limit: 0,
        initial_balance: 0,
    };
    error.value = null;
    fieldErrors.value = {};
};

const activeCustomerTypes = computed(() =>
    customerTypes.value.filter((type) => type.is_active),
);

const loadCustomerTypes = async () => {
    loadingTypes.value = true;
    try {
        const response = await CustomersApiService.getCustomerTypes();
        customerTypes.value = response.data.data;
        const individual = activeCustomerTypes.value.find(
            (type) => type.base_kind === 'individual',
        );
        form.value.customer_type_id =
            individual?.id ?? activeCustomerTypes.value[0]?.id ?? null;
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            'No se pudieron cargar los tipos de cliente';
    } finally {
        loadingTypes.value = false;
    }
};

watch(
    () => props.show,
    async (visible) => {
        if (!visible) return;
        handleOpen();
        await loadCustomerTypes();
    },
    { immediate: true },
);

const close = () => {
    emit('update:show', false);
};

const handleSubmit = async () => {
    if (loading.value) return;

    if (!form.value.name.trim()) {
        error.value = 'El nombre es obligatorio';
        return;
    }

    if (!form.value.customer_type_id) {
        error.value = 'Selecciona un tipo de cliente';
        return;
    }

    loading.value = true;
    error.value = null;
    fieldErrors.value = {};

    try {
        const payload = {
            customer_type_id: form.value.customer_type_id,
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
        fieldErrors.value = e.response?.data?.errors ?? {};
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

                    <div>
                        <label
                            class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                        >
                            Tipo de cliente *
                        </label>
                        <select
                            v-model.number="form.customer_type_id"
                            :disabled="loadingTypes"
                            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option :value="null" disabled>
                                {{
                                    loadingTypes
                                        ? 'Cargando...'
                                        : 'Selecciona un tipo'
                                }}
                            </option>
                            <option
                                v-for="type in activeCustomerTypes"
                                :key="type.id"
                                :value="type.id"
                            >
                                {{ type.name }}
                            </option>
                        </select>
                        <p
                            v-if="fieldErrors.customer_type_id?.[0]"
                            class="mt-1 text-xs text-red-600 dark:text-red-300"
                        >
                            {{ fieldErrors.customer_type_id[0] }}
                        </p>
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
                        <p
                            v-if="fieldErrors.name?.[0]"
                            class="mt-1 text-xs text-red-600 dark:text-red-300"
                        >
                            {{ fieldErrors.name[0] }}
                        </p>
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
                        :disabled="
                            loading ||
                            loadingTypes ||
                            !form.name.trim() ||
                            !form.customer_type_id
                        "
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
