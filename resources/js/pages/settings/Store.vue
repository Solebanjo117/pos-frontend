<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { useStoreSettings } from '@/composables/useStoreSettings'
import { type BreadcrumbItem } from '@/types'
import { Store, Upload, Save, Building2, Phone, Mail, MapPin, CreditCard, FileText, Image } from 'lucide-vue-next'

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Configuración de Tienda', href: '/settings/store' },
]

const { settings, loading, saving, error, fetchSettings, saveSettings, uploadLogo } = useStoreSettings()

const logoPreview   = ref<string | null>(null)
const logoFile      = ref<File | null>(null)
const saveMsg       = ref<string | null>(null)

onMounted(() => fetchSettings())

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
    const ok = await saveSettings({ ...settings.value })
    saveMsg.value = ok ? '✓ Configuración guardada correctamente' : null
    if (ok) setTimeout(() => (saveMsg.value = null), 4000)
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
            <div v-if="error" class="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                {{ error }}
            </div>

            <div v-if="loading" class="text-center py-12 text-gray-400">Cargando configuración...</div>

            <form v-else @submit.prevent="handleSave" class="space-y-6">
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

                <!-- Save button -->
                <div class="flex justify-end">
                    <button type="submit" :disabled="saving"
                            class="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-black font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition shadow-sm">
                        <Save :size="18" />
                        {{ saving ? 'Guardando...' : 'Guardar Configuración' }}
                    </button>
                </div>
            </form>
        </div>
    </AppLayout>
</template>
