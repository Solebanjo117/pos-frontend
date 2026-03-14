import { ref } from 'vue'
import apiClient from '@/services/api/client'

export interface StoreSettings {
    store_name: string
    store_tagline: string
    store_logo_url: string | null
    store_owner_name: string
    store_phone: string
    store_email: string
    store_address: string
    store_tax_id: string
    store_currency: string
    store_ticket_footer: string
    pricing_formula: string   // NEW: global Excel-like pricing formula
    quote_expiration_days: number // 0 = disabled, 15/30/60/90 days
}

const settings = ref<StoreSettings>({
    store_name: 'HermeX POS',
    store_tagline: '',
    store_logo_url: null,
    store_owner_name: '',
    store_phone: '',
    store_email: '',
    store_address: '',
    store_tax_id: '',
    store_currency: 'USD',
    store_ticket_footer: '¡Gracias por su compra!',
    pricing_formula: '',
    quote_expiration_days: 0,
})

const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
let fetched = false

export function useStoreSettings() {
    async function fetchSettings() {
        if (fetched) return settings.value
        loading.value = true
        error.value = null
        try {
            const res = await apiClient.get('/store-settings')
            Object.assign(settings.value, res.data.data)
            fetched = true
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al cargar configuración'
        } finally {
            loading.value = false
        }
        return settings.value
    }

    async function saveSettings(data: Partial<StoreSettings>) {
        saving.value = true
        error.value = null
        try {
            const res = await apiClient.put('/store-settings', data)
            Object.assign(settings.value, res.data.data)
            return true
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al guardar configuración'
            return false
        } finally {
            saving.value = false
        }
    }

    async function uploadLogo(file: File): Promise<string | null> {
        const formData = new FormData()
        formData.append('logo', file)
        try {
            const res = await apiClient.post('/store-settings/logo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            settings.value.store_logo_url = res.data.logo_url
            return res.data.logo_url
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al subir logo'
            return null
        }
    }

    return { settings, loading, saving, error, fetchSettings, saveSettings, uploadLogo }
}
