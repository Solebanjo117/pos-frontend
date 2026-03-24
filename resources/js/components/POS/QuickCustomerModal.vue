<script setup lang="ts">
import { ref } from 'vue'
import { X, AlertCircle, Save } from 'lucide-vue-next'
import apiClient from '@/services/api/client'

const props = defineProps<{
    show: boolean
}>()

const emit = defineEmits<{
    (e: 'created', customer: any): void
    (e: 'update:show', value: boolean): void
}>()

const loading = ref(false)
const error = ref<string | null>(null)

const form = ref({
    name: '',
    phone: '',
    email: '',
    credit_limit: 0,
    initial_balance: 0
})

const handleOpen = () => {
    form.value = {
        name: '',
        phone: '',
        email: '',
        credit_limit: 0,
        initial_balance: 0
    }
    error.value = null
}

const close = () => {
    emit('update:show', false)
}

const handleSubmit = async () => {
    if (!form.value.name.trim()) {
        error.value = 'El nombre es obligatorio'
        return
    }

    loading.value = true
    error.value = null

    try {
        const payload = {
            type: 'individual',
            name: form.value.name.trim(),
            phone: form.value.phone.trim() || undefined,
            email: form.value.email.trim() || undefined,
            credit_limit: form.value.credit_limit || 0,
            initial_balance: form.value.initial_balance || 0
        }

        const response = await apiClient.post('/customers', payload)
        const newCustomer = response.data.data ?? response.data
        
        emit('created', newCustomer)
        close()
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error al crear el cliente'
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <Transition name="modal">
        <div
            v-if="show"
            class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
            <div class="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-md" @vue:mounted="handleOpen">
                <!-- Header -->
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-border">
                    <h2 class="text-lg font-bold text-gray-900 dark:text-white">Nuevo Cliente Rápido</h2>
                    <button @click="close" class="text-gray-400 hover:text-gray-600 transition-colors">
                        <X class="w-5 h-5" />
                    </button>
                </div>

                <div class="p-6 space-y-4">
                    <!-- Error -->
                    <div v-if="error" class="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                        <AlertCircle class="w-4 h-4 flex-shrink-0" />
                        {{ error }}
                    </div>

                    <!-- Name -->
                    <div>
                        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Nombre del Cliente *
                        </label>
                        <input
                            v-model="form.name"
                            type="text"
                            placeholder="Nombre completo"
                            @keyup.enter="handleSubmit"
                            class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            required
                        />
                    </div>

                    <!-- Phone -->
                    <div>
                        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Teléfono
                        </label>
                        <input
                            v-model="form.phone"
                            type="tel"
                            placeholder="(Opcional)"
                            @keyup.enter="handleSubmit"
                            class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>

                    <!-- Email -->
                    <div>
                        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Correo Electrónico
                        </label>
                        <input
                            v-model="form.email"
                            type="email"
                            placeholder="(Opcional)"
                            @keyup.enter="handleSubmit"
                            class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>

                    <!-- Credit & Balance -->
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                Límite de Crédito
                            </label>
                            <input
                                v-model.number="form.credit_limit"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                Saldo Inicial
                            </label>
                            <input
                                v-model.number="form.initial_balance"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                            <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Puede ser negativo</p>
                        </div>
                    </div>

                    <!-- Submit -->
                    <button
                        @click="handleSubmit"
                        :disabled="loading || !form.name.trim()"
                        class="w-full mt-2 py-3 rounded-xl font-bold text-white bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                    >
                        <Save v-if="!loading" class="w-4 h-4" />
                        {{ loading ? 'Guardando...' : 'Guardar Cliente' }}
                    </button>
                </div>
            </div>
        </div>
    </Transition>
</template>
