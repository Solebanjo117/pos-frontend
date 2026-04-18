<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { useStoreSettings } from '@/composables/useStoreSettings'
import { usePaymentMethods } from '@/composables/usePaymentMethods'
import { useAuth } from '@/composables/useAuth'
import apiClient from '@/services/api/client'
import { type BreadcrumbItem } from '@/types'
import PricingFormula from '@/components/Products/PricingFormula.vue'
import { Store, Upload, Save, Building2, Phone, Mail, MapPin, CreditCard, FileText, Image, Calculator, Clock, Wrench, Percent, Plus, ChevronUp, ChevronDown, Trash2, Lock } from 'lucide-vue-next'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Configuración de Tienda', href: '/settings/store' },
]

const { settings, loading, saving, error, fetchSettings, saveSettings, uploadLogo } = useStoreSettings()
const {
    allMethods: paymentMethods,
    loading: paymentMethodsLoading,
    fetchAllMethods,
    createMethod,
    updateMethod,
    archiveMethod,
    reorderMethods
} = usePaymentMethods()

const logoPreview   = ref<string | null>(null)
const logoFile      = ref<File | null>(null)
const saveMsg       = ref<string | null>(null)
const { isAdmin } = useAuth()

// Transactional reset (danger zone)
const showResetModal = ref(false)
const resetPassword = ref('')
const resetConfirmation = ref('')
const resetNoBackup = ref(false)
const resetLoading = ref(false)
const resetError = ref<string | null>(null)
const resetSuccess = ref<string | null>(null)

// Payment methods
const showAddMethodModal = ref(false)
const newMethodName = ref('')
const newMethodRequiresRef = ref(false)
const addingMethod = ref(false)

onMounted(() => {
    fetchSettings()
    fetchAllMethods()
})

const handleLogoChange = (e: Event) => {
    const input = e.target as HTMLInputElement
    if (!input.files?.length) return
    logoFile.value = input.files[0]
    logoPreview.value = URL.createObjectURL(input.files[0])
}

const handleSave = async () => {
    saveMsg.value = null
    // Upload logo first if selected
    if (logoFile.value) {
        await uploadLogo(logoFile.value)
        logoFile.value = null
    }
    const normalizedTaxRate = Math.max(0, Math.min(100, Math.round(Number(settings.value.store_tax_rate ?? 7))))
    settings.value.store_tax_rate = normalizedTaxRate

    const ok = await saveSettings({ ...settings.value, store_tax_rate: normalizedTaxRate })
    saveMsg.value = ok ? '✓ Configuración guardada correctamente' : null
    if (ok) setTimeout(() => (saveMsg.value = null), 4000)
}

// Payment methods handlers
const handleAddMethod = async () => {
    if (!newMethodName.value.trim()) return
    addingMethod.value = true
    try {
        await createMethod({
            name: newMethodName.value.trim(),
            requires_reference: newMethodRequiresRef.value,
        })
        newMethodName.value = ''
        newMethodRequiresRef.value = false
        showAddMethodModal.value = false
        await fetchAllMethods()
    } catch (e) {
        console.error('Error adding method:', e)
    } finally {
        addingMethod.value = false
    }
}

const handleToggleActive = async (method: any) => {
    if (method.is_system) return
    try {
        await updateMethod(method.id, { is_active: !method.is_active })
    } catch (e) {
        console.error('Error toggling method:', e)
    }
}

const handleArchiveMethod = async (method: any) => {
    if (method.is_system) return
    if (!confirm(`¿Archivar el método "${method.name}"? Ya no aparecerá en el POS.`)) return
    try {
        await archiveMethod(method.id)
    } catch (e) {
        console.error('Error archiving method:', e)
    }
}

const moveMethodUp = async (index: number) => {
    if (index === 0) return
    const order = paymentMethods.value.map(m => m.id)
    ;[order[index], order[index - 1]] = [order[index - 1], order[index]]
    await reorderMethods(order)
    await fetchAllMethods()
}

const moveMethodDown = async (index: number) => {
    if (index >= paymentMethods.value.length - 1) return
    const order = paymentMethods.value.map(m => m.id)
    ;[order[index], order[index + 1]] = [order[index + 1], order[index]]
    await reorderMethods(order)
    await fetchAllMethods()
}

const openResetModal = () => {
    resetPassword.value = ''
    resetConfirmation.value = ''
    resetNoBackup.value = false
    resetError.value = null
    showResetModal.value = true
}

const closeResetModal = () => {
    showResetModal.value = false
    resetLoading.value = false
}

const handleResetData = async () => {
    resetError.value = null
    resetSuccess.value = null

    if (!resetPassword.value) {
        resetError.value = 'Debes ingresar tu contrasena actual.'
        return
    }

    if (resetConfirmation.value.trim() !== 'REINICIAR DATOS') {
        resetError.value = 'Debes escribir exactamente REINICIAR DATOS.'
        return
    }

    resetLoading.value = true
    try {
        const response = await apiClient.post('/data/reset', {
            password: resetPassword.value,
            confirmation_text: resetConfirmation.value,
            no_backup: resetNoBackup.value,
        })
        resetSuccess.value = response.data?.message || 'Reinicio completado correctamente.'
        showResetModal.value = false
    } catch (e: any) {
        resetError.value = e.response?.data?.message || 'No se pudo reiniciar la data transaccional.'
    } finally {
        resetLoading.value = false
    }
}
</script>

<template>
    <Head title="Configuración de Tienda" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="max-w-3xl mx-auto space-y-6 p-4 md:p-6">
            <!-- Page header -->
            <div class="flex items-center gap-3">
                <div class="p-2 bg-primary/10 rounded-xl border border-primary/20">
                    <Store :size="24" class="text-primary" />
                </div>
                <div>
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Configuración de la Tienda</h1>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Información empresarial que aparecerá en el sidebar y documentos impresos</p>
                </div>
            </div>

            <!-- Success message -->
            <div v-if="saveMsg" class="px-4 py-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm font-medium">
                {{ saveMsg }}
            </div>
            <div v-if="resetSuccess" class="px-4 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                {{ resetSuccess }}
            </div>
            <div v-if="error" class="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                {{ error }}
            </div>

            <div v-if="loading" class="text-center py-12 text-gray-400">Cargando configuración...</div>

            <form v-else @submit.prevent="handleSave" @keydown.enter="(e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') e.preventDefault() }" class="space-y-6">
                <!-- === LOGO === -->
                <section class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-6">
                    <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Image :size="18" class="text-primary" /> Logo de la Tienda
                    </h2>
                    <div class="flex items-center gap-6">
                        <!-- Preview -->
                        <div class="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-border flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-muted shrink-0">
                            <img v-if="logoPreview || settings.store_logo_url"
                                 :src="logoPreview || settings.store_logo_url!"
                                 alt="Logo"
                                 class="w-full h-full object-contain p-1" />
                            <span v-else class="text-gray-400 text-xs text-center px-2">Sin logo</span>
                        </div>
                        <div>
                            <label class="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-black dark:text-black font-medium text-sm rounded-lg hover:bg-primary/90 transition">
                                <Upload :size="16" />
                                Subir Imagen
                                <input type="file" accept="image/*" class="hidden" @change="handleLogoChange" />
                            </label>
                            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">PNG, JPG o SVG · Máx. 2 MB · Recomendado: cuadrado</p>
                            <p v-if="logoFile" class="mt-1 text-xs text-primary font-medium">📎 {{ logoFile.name }}</p>
                        </div>
                    </div>
                </section>

                <!-- === GENERAL INFO === -->
                <section class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-6">
                    <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Building2 :size="18" class="text-primary" /> Información General
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="md:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre de la Tienda *</label>
                            <input v-model="settings.store_name" type="text" required
                                   placeholder="Ej: HermeX Autopartes"
                                   class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition" />
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slogan / Descripción</label>
                            <input v-model="settings.store_tagline" type="text"
                                   placeholder="Ej: Especialistas en repuestos automotrices"
                                   class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Propietario</label>
                            <input v-model="settings.store_owner_name" type="text" placeholder="Juan Antonio Castillo"
                                   class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">RUC / ID Fiscal</label>
                            <input v-model="settings.store_tax_id" type="text" placeholder="8-123-4567"
                                   class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition" />
                        </div>
                    </div>
                </section>

                <!-- === CONTACT === -->
                <section class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-6">
                    <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Phone :size="18" class="text-primary" /> Contacto y Dirección
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                <Phone :size="13" class="inline mr-1" />Teléfono
                            </label>
                            <input v-model="settings.store_phone" type="text" placeholder="+507 6123-4567"
                                   class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                <Mail :size="13" class="inline mr-1" />Correo Electrónico
                            </label>
                            <input v-model="settings.store_email" type="email" placeholder="info@tienda.com"
                                   class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition" />
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                <MapPin :size="13" class="inline mr-1" />Dirección
                            </label>
                            <input v-model="settings.store_address" type="text" placeholder="Ciudad de Panamá, Panamá"
                                   class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition" />
                        </div>
                    </div>
                </section>

                <!-- === DOCUMENTS === -->
                <section class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-6">
                    <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <FileText :size="18" class="text-primary" /> Documentos e Impresión
                    </h2>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pie de Página en Tickets</label>
                            <input v-model="settings.store_ticket_footer" type="text"
                                   placeholder="¡Gracias por su compra!"
                                   class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition" />
                            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Aparece al final del ticket de venta y otros documentos</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                <CreditCard :size="13" class="inline mr-1" />Moneda
                            </label>
                            <select v-model="settings.store_currency"
                                    class="w-40 px-4 py-2 rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition">
                                <option value="USD">USD ($)</option>
                                <option value="PAB">PAB (B/.)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="MXN">MXN ($)</option>
                                <option value="COP">COP ($)</option>
                            </select>
                        </div>
                    </div>
                </section>

                <!-- === PAYMENT METHODS === -->
                <section class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <CreditCard :size="18" class="text-primary" /> Métodos de Pago
                        </h2>
                        <button
                            @click="showAddMethodModal = true"
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition"
                        >
                            <Plus :size="16" />
                            Agregar
                        </button>
                    </div>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Configura los métodos de pago disponibles en el POS. Puedes reordenarlos y activar/desactivar según necesites.
                    </p>

                    <div v-if="paymentMethodsLoading" class="text-sm text-gray-400 py-4">Cargando métodos...</div>

                    <div v-else class="space-y-2">
                        <div
                            v-for="(method, index) in paymentMethods"
                            :key="method.id"
                            class="flex items-center gap-3 p-3 rounded-lg border transition"
                            :class="method.is_active
                                ? 'border-gray-200 dark:border-border bg-gray-50 dark:bg-muted/30'
                                : 'border-gray-100 dark:border-border/50 bg-gray-100/50 dark:bg-muted/10 opacity-60'"
                        >
                            <!-- Reorder buttons -->
                            <div class="flex flex-col gap-0.5">
                                <button
                                    @click="moveMethodUp(index)"
                                    :disabled="index === 0"
                                    class="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronUp :size="14" />
                                </button>
                                <button
                                    @click="moveMethodDown(index)"
                                    :disabled="index >= paymentMethods.length - 1"
                                    class="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronDown :size="14" />
                                </button>
                            </div>

                            <!-- Method info -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <span class="font-medium text-gray-900 dark:text-white">{{ method.name }}</span>
                                    <span v-if="method.is_system" class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-200 dark:bg-muted rounded">
                                        <Lock :size="10" />
                                        Sistema
                                    </span>
                                    <span v-if="!method.is_active" class="px-1.5 py-0.5 text-[10px] font-medium text-orange-600 bg-orange-100 dark:bg-orange-900/20 rounded">
                                        Inactivo
                                    </span>
                                </div>
                                <p class="text-xs text-gray-400 dark:text-gray-500">código: {{ method.code }}</p>
                            </div>

                            <!-- Toggle active -->
                            <label class="relative inline-flex items-center cursor-pointer" :class="{ 'opacity-50 cursor-not-allowed': method.is_system }">
                                <input
                                    type="checkbox"
                                    :checked="method.is_active"
                                    :disabled="method.is_system"
                                    @change="handleToggleActive(method)"
                                    class="sr-only peer"
                                />
                                <div class="w-9 h-5 bg-gray-200 rounded-full peer dark:bg-muted peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                            </label>

                            <!-- Archive button -->
                            <button
                                v-if="!method.is_system"
                                @click="handleArchiveMethod(method)"
                                class="p-1.5 text-gray-400 hover:text-red-500 transition"
                                title="Archivar método"
                            >
                                <Trash2 :size="16" />
                            </button>
                        </div>
                    </div>
                </section>

                <!-- Add Method Modal -->
                <Teleport to="body">
                    <div v-if="showAddMethodModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div class="bg-white dark:bg-card rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
                            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Agregar Método de Pago</h3>
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del método</label>
                                    <input
                                        v-model="newMethodName"
                                        type="text"
                                        placeholder="Ej: Yappy, Nequi"
                                        class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition"
                                    />
                                    <p class="mt-1 text-xs text-gray-500">El código se generará automáticamente del nombre</p>
                                </div>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input
                                        v-model="newMethodRequiresRef"
                                        type="checkbox"
                                        class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/50"
                                    />
                                    <span class="text-sm text-gray-700 dark:text-gray-300">Requiere número de referencia</span>
                                </label>
                            </div>
                            <div class="flex justify-end gap-2 mt-6">
                                <button
                                    @click="showAddMethodModal = false; newMethodName = ''; newMethodRequiresRef = false"
                                    class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    @click="handleAddMethod"
                                    :disabled="!newMethodName.trim() || addingMethod"
                                    class="px-4 py-2 text-sm font-semibold text-black bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 transition"
                                >
                                    {{ addingMethod ? 'Agregando...' : 'Agregar Método' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </Teleport>

                <!-- === QUOTES === -->
                <section class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-6">
                    <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Clock :size="18" class="text-primary" /> Cotizaciones
                    </h2>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiración de Cotizaciones</label>
                            <select v-model.number="settings.quote_expiration_days"
                                    class="w-48 px-4 py-2 rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition">
                                <option :value="0">Deshabilitado</option>
                                <option :value="15">15 días</option>
                                <option :value="30">30 días</option>
                                <option :value="60">60 días</option>
                                <option :value="90">90 días</option>
                            </select>
                            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Fecha "válido hasta" auto-calculada al crear cotizaciones. 0 = sin expiración.</p>
                        </div>

                        <label class="flex items-start gap-3 cursor-pointer">
                            <input
                                v-model="settings.require_stock_for_quotes"
                                type="checkbox"
                                class="mt-1 h-4 w-4 rounded border-gray-300 dark:border-border text-primary focus:ring-primary/50"
                            />
                            <div>
                                <p class="text-sm font-medium text-gray-900 dark:text-white">Requerir stock para cotizar</p>
                                <p class="text-xs text-gray-500 dark:text-gray-400">Si está activo, no se podrán crear cotizaciones cuando algún producto no tenga stock suficiente en el almacén.</p>
                            </div>
                        </label>
                    </div>
                </section>

                <!-- === PRICING FORMULA === -->
                <section class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-6">
                    <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                        <Calculator :size="18" class="text-primary" /> Fórmula de Precio Global
                    </h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Fórmula por defecto para calcular el precio de venta a partir del costo.
                        Se puede sobreescribir por producto.
                    </p>
                    <PricingFormula
                        :cost="10"
                        :tax-rate="settings.store_tax_rate ?? 7"
                        :model-value="settings.pricing_formula"
                        @update:model-value="v => settings.pricing_formula = v"
                    />
                </section>

                <!-- === FISCAL === -->
                <section class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-6">
                    <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Percent :size="18" class="text-primary" /> Fiscal
                    </h2>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tasa de impuesto por defecto (%)</label>
                        <input
                            v-model.number="settings.store_tax_rate"
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            class="w-40 px-4 py-2 rounded-lg border border-gray-300 dark:border-border bg-white dark:bg-muted text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition"
                        />
                    </div>
                </section>

                <!-- === MÓDULOS === -->
                <section class="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-6">
                    <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Wrench :size="18" class="text-primary" /> Módulos
                    </h2>
                    <div class="space-y-2">
                        <label class="flex items-start gap-3 cursor-pointer">
                            <input
                                v-model="settings.modules_work_orders_enabled"
                                type="checkbox"
                                class="mt-1 h-4 w-4 rounded border-gray-300 dark:border-border text-primary focus:ring-primary/50"
                            />
                            <div>
                                <p class="text-sm font-medium text-gray-900 dark:text-white">Órdenes de trabajo (taller)</p>
                                <p class="text-xs text-gray-500 dark:text-gray-400">Activa el módulo de gestión de órdenes de trabajo para técnicos.</p>
                            </div>
                        </label>
                    </div>
                </section>

                <!-- === DANGER ZONE === -->
                <section v-if="isAdmin" class="bg-white dark:bg-card rounded-xl border border-red-300 dark:border-red-800 p-6">
                    <h2 class="text-base font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                        <Trash2 :size="18" /> Zona de Peligro
                    </h2>
                    <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        Reinicia datos transaccionales (ventas, cotizaciones, ordenes y sesiones de caja) conservando catalogos y configuraciones.
                    </p>
                    <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                        @click="openResetModal"
                    >
                        <Trash2 :size="15" /> Reiniciar Data Transaccional
                    </button>
                </section>

                <!-- Save button -->
                <div class="flex justify-end">
                    <button type="submit" :disabled="saving"
                            class="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-black font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition shadow-sm">
                        <Save :size="18" />
                        {{ saving ? 'Guardando...' : 'Guardar Configuración' }}
                    </button>
                </div>
            </form>

            <Teleport to="body">
                <div
                    v-if="showResetModal"
                    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    @click.self="closeResetModal"
                >
                    <div class="w-full max-w-lg rounded-xl border border-red-200 bg-white p-6 shadow-2xl dark:border-red-900 dark:bg-card">
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Confirmar reinicio de datos</h3>
                        <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
                            Esta accion elimina informacion transaccional. No se puede deshacer.
                        </p>

                        <div class="space-y-3">
                            <div>
                                <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Contrasena actual</label>
                                <input
                                    v-model="resetPassword"
                                    type="password"
                                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>
                            <div>
                                <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Escribe REINICIAR DATOS para confirmar</label>
                                <input
                                    v-model="resetConfirmation"
                                    type="text"
                                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>
                            <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                    v-model="resetNoBackup"
                                    type="checkbox"
                                    class="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                />
                                Ejecutar sin crear backup (solo si ya hiciste respaldo manual)
                            </label>
                        </div>

                        <p v-if="resetError" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                            {{ resetError }}
                        </p>

                        <div class="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-border dark:text-gray-300 dark:hover:bg-muted"
                                @click="closeResetModal"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                :disabled="resetLoading"
                                @click="handleResetData"
                            >
                                {{ resetLoading ? 'Reiniciando...' : 'Confirmar Reinicio' }}
                            </button>
                        </div>
                    </div>
                </div>
            </Teleport>
        </div>
    </AppLayout>
</template>
