import { ref } from 'vue';
import apiClient from '@/services/api/client';
import { configureRegionalFormatters } from '@/utils/formatters';

const normalizeTaxRate = (value: unknown): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 7;
    return Math.max(0, Math.min(100, Math.round(parsed)));
};

const resolveTaxRate = (value: unknown): number => {
    if (value === null || value === undefined || value === '') {
        return normalizeTaxRate(settings.value.store_tax_rate);
    }

    return normalizeTaxRate(value);
};

const defaultTaxRate = (): number =>
    normalizeTaxRate(settings.value.store_tax_rate);

const calculateTaxAmount = (subtotal: number, rate?: unknown): number => {
    const parsedSubtotal = Number(subtotal);
    if (!Number.isFinite(parsedSubtotal)) return 0;
    return Number((parsedSubtotal * (resolveTaxRate(rate) / 100)).toFixed(2));
};

export interface StoreSettings {
    store_name: string;
    store_tagline: string;
    store_logo_url: string | null;
    store_owner_name: string;
    store_phone: string;
    store_email: string;
    store_address: string;
    store_tax_id: string;
    store_currency: string;
    store_ticket_footer: string;
    pricing_formula: string; // NEW: global Excel-like pricing formula
    price_rounding_increment: number; // 0.25 | 0.50 | 1.00 | 5.00 | 10.00
    sku_format: string[]; // Ordered list of fields for auto-SKU generation
    quote_expiration_days: number; // 0 = disabled, 15/30/60/90 days
    require_stock_for_quotes: boolean; // Require available stock to create a quote
    store_tax_rate: number;
    modules_work_orders_enabled: boolean;
    accounting_lock_date: string;
    regional_timezone: string;
    regional_date_format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
    regional_time_format: '12h' | '24h';
    regional_datetime_format: string;
    regional_country: string;
    regional_decimal_separator: '.' | ',';
    regional_settings_active: boolean;
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
    price_rounding_increment: 1.0,
    sku_format: ['category', 'brand'],
    quote_expiration_days: 0,
    require_stock_for_quotes: false,
    store_tax_rate: 7,
    modules_work_orders_enabled: false,
    accounting_lock_date: '',
    regional_timezone: 'America/Panama',
    regional_date_format: 'DD/MM/YYYY',
    regional_time_format: '24h',
    regional_datetime_format: 'DD/MM/YYYY HH:mm',
    regional_country: 'Panama',
    regional_decimal_separator: '.',
    regional_settings_active: true,
});

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
let fetched = false;

const syncRegionalFormatters = (): void => {
    configureRegionalFormatters({
        active: settings.value.regional_settings_active,
        timezone: settings.value.regional_timezone,
        dateFormat: settings.value.regional_date_format,
        timeFormat: settings.value.regional_time_format,
        datetimeFormat: settings.value.regional_datetime_format,
        currency: settings.value.store_currency,
        decimalSeparator: settings.value.regional_decimal_separator,
    });
};

syncRegionalFormatters();

export function useStoreSettings() {
    async function fetchSettings() {
        if (fetched) {
            loading.value = false;
            return settings.value;
        }
        loading.value = true;
        error.value = null;
        try {
            const res = await apiClient.get('/store-settings');
            Object.assign(settings.value, res.data.data);
            settings.value.store_tax_rate = normalizeTaxRate(
                settings.value.store_tax_rate,
            );
            syncRegionalFormatters();
            fetched = true;
        } catch (e: any) {
            error.value =
                e.response?.data?.message || 'Error al cargar configuración';
        } finally {
            loading.value = false;
        }
        return settings.value;
    }

    async function saveSettings(data: Partial<StoreSettings>) {
        saving.value = true;
        error.value = null;
        try {
            const payload: Partial<StoreSettings> = { ...data };
            if (payload.store_tax_rate !== undefined) {
                payload.store_tax_rate = normalizeTaxRate(
                    payload.store_tax_rate,
                );
            }

            const res = await apiClient.put('/store-settings', payload);
            Object.assign(settings.value, res.data.data);
            settings.value.store_tax_rate = normalizeTaxRate(
                settings.value.store_tax_rate,
            );
            syncRegionalFormatters();
            return true;
        } catch (e: any) {
            error.value =
                e.response?.data?.message || 'Error al guardar configuración';
            return false;
        } finally {
            saving.value = false;
        }
    }

    async function uploadLogo(file: File): Promise<string | null> {
        const formData = new FormData();
        formData.append('logo', file);
        try {
            const res = await apiClient.post('/store-settings/logo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            settings.value.store_logo_url = res.data.logo_url;
            return res.data.logo_url;
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error al subir logo';
            return null;
        }
    }

    return {
        settings,
        loading,
        saving,
        error,
        fetchSettings,
        saveSettings,
        uploadLogo,
        normalizeTaxRate,
        resolveTaxRate,
        defaultTaxRate,
        calculateTaxAmount,
    };
}
