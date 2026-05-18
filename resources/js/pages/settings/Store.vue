<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Head } from '@inertiajs/vue3';
import {
    Building2,
    Calculator,
    ChevronDown,
    ChevronUp,
    Clock,
    CreditCard,
    FileText,
    Image,
    Lock,
    Mail,
    MapPin,
    Percent,
    Phone,
    Plus,
    Save,
    Store,
    Trash2,
    Upload,
    Wrench,
} from 'lucide-vue-next';
import PricingFormula from '@/components/Products/PricingFormula.vue';
import { useAuth } from '@/composables/useAuth';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import { useStoreSettings } from '@/composables/useStoreSettings';
import AppLayout from '@/layouts/AppLayout.vue';
import SettingsLayout from '@/layouts/settings/Layout.vue';
import apiClient from '@/services/api/client';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Configuracion de tienda', href: '/settings/store' },
];

const { isAdmin } = useAuth();
const {
    settings,
    loading,
    saving,
    error,
    fetchSettings,
    saveSettings,
    uploadLogo,
    normalizeTaxRate,
    defaultTaxRate,
} = useStoreSettings();
const {
    allMethods: paymentMethods,
    loading: paymentMethodsLoading,
    fetchAllMethods,
    createMethod,
    updateMethod,
    archiveMethod,
    reorderMethods,
} = usePaymentMethods();

const logoPreview = ref<string | null>(null);
const logoFile = ref<File | null>(null);
const saveMsg = ref<string | null>(null);

const showResetModal = ref(false);
const resetPassword = ref('');
const resetConfirmation = ref('');
const resetNoBackup = ref(false);
const resetLoading = ref(false);
const resetError = ref<string | null>(null);
const resetSuccess = ref<string | null>(null);

const showAddMethodModal = ref(false);
const newMethodName = ref('');
const newMethodRequiresRef = ref(false);
const addingMethod = ref(false);
const methodToArchive = ref<any | null>(null);

const sections = [
    { id: 'identity', label: 'Identidad' },
    { id: 'documents', label: 'Documentos' },
    { id: 'payments', label: 'Pagos' },
    { id: 'quotes', label: 'Cotizaciones' },
    { id: 'fiscal', label: 'Fiscal' },
    { id: 'modules', label: 'Modulos' },
    { id: 'risk', label: 'Riesgo' },
];

onMounted(() => {
    fetchSettings();
    fetchAllMethods();
});

const scrollToSection = (id: string) => {
    document
        .getElementById(id)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const handleLogoChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) {
        return;
    }

    logoFile.value = input.files[0];
    logoPreview.value = URL.createObjectURL(input.files[0]);
};

const handleSave = async () => {
    saveMsg.value = null;

    if (logoFile.value) {
        await uploadLogo(logoFile.value);
        logoFile.value = null;
    }

    const normalizedTaxRate = normalizeTaxRate(settings.value.store_tax_rate);
    settings.value.store_tax_rate = normalizedTaxRate;

    const ok = await saveSettings({
        ...settings.value,
        store_tax_rate: normalizedTaxRate,
    });
    saveMsg.value = ok ? 'Configuracion guardada correctamente' : null;
    if (ok) {
        setTimeout(() => (saveMsg.value = null), 4000);
    }
};

const handleAddMethod = async () => {
    if (!newMethodName.value.trim()) {
        return;
    }

    addingMethod.value = true;
    try {
        await createMethod({
            name: newMethodName.value.trim(),
            requires_reference: newMethodRequiresRef.value,
        });
        newMethodName.value = '';
        newMethodRequiresRef.value = false;
        showAddMethodModal.value = false;
        await fetchAllMethods();
    } finally {
        addingMethod.value = false;
    }
};

const handleToggleActive = async (method: any) => {
    if (method.is_system) {
        return;
    }

    await updateMethod(method.id, { is_active: !method.is_active });
};

const confirmArchiveMethod = async () => {
    if (!methodToArchive.value || methodToArchive.value.is_system) {
        return;
    }

    await archiveMethod(methodToArchive.value.id);
    methodToArchive.value = null;
};

const moveMethodUp = async (index: number) => {
    if (index === 0) {
        return;
    }

    const order = paymentMethods.value.map((method) => method.id);
    [order[index], order[index - 1]] = [order[index - 1], order[index]];
    await reorderMethods(order);
    await fetchAllMethods();
};

const moveMethodDown = async (index: number) => {
    if (index >= paymentMethods.value.length - 1) {
        return;
    }

    const order = paymentMethods.value.map((method) => method.id);
    [order[index], order[index + 1]] = [order[index + 1], order[index]];
    await reorderMethods(order);
    await fetchAllMethods();
};

const openResetModal = () => {
    resetPassword.value = '';
    resetConfirmation.value = '';
    resetNoBackup.value = false;
    resetError.value = null;
    showResetModal.value = true;
};

const closeResetModal = () => {
    showResetModal.value = false;
    resetLoading.value = false;
};

const handleResetData = async () => {
    resetError.value = null;
    resetSuccess.value = null;

    if (!resetPassword.value) {
        resetError.value = 'Debes ingresar tu contrasena actual.';
        return;
    }

    if (resetConfirmation.value.trim() !== 'REINICIAR DATOS') {
        resetError.value = 'Debes escribir exactamente REINICIAR DATOS.';
        return;
    }

    resetLoading.value = true;
    try {
        const response = await apiClient.post('/data/reset', {
            password: resetPassword.value,
            confirmation_text: resetConfirmation.value,
            no_backup: resetNoBackup.value,
        });
        resetSuccess.value =
            response.data?.message || 'Reinicio completado correctamente.';
        showResetModal.value = false;
    } catch (e: any) {
        resetError.value =
            e.response?.data?.message ||
            'No se pudo reiniciar la data transaccional.';
    } finally {
        resetLoading.value = false;
    }
};
</script>

<template>
    <Head title="Configuracion de tienda" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <SettingsLayout>
            <div class="space-y-6">
                <header
                    class="flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between"
                >
                    <div class="flex items-start gap-3">
                        <div
                            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                        >
                            <Store class="h-5 w-5" />
                        </div>
                        <div>
                            <h2 class="text-lg font-semibold text-foreground">
                                Configuracion de tienda
                            </h2>
                            <p class="text-sm text-muted-foreground">
                                Identidad, documentos, pagos, cotizaciones y
                                parametros fiscales.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        :disabled="saving || loading"
                        class="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                        @click="handleSave"
                    >
                        <Save class="h-4 w-4" />
                        {{ saving ? 'Guardando...' : 'Guardar' }}
                    </button>
                </header>

                <div class="flex flex-wrap gap-2 rounded-lg border bg-card p-2">
                    <button
                        v-for="section in sections"
                        :key="section.id"
                        type="button"
                        class="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        @click="scrollToSection(section.id)"
                    >
                        {{ section.label }}
                    </button>
                </div>

                <div
                    v-if="saveMsg"
                    class="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                >
                    {{ saveMsg }}
                </div>
                <div
                    v-if="resetSuccess"
                    class="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                >
                    {{ resetSuccess }}
                </div>
                <div
                    v-if="error"
                    class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                >
                    {{ error }}
                </div>

                <div
                    v-if="loading"
                    class="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground"
                >
                    Cargando configuracion...
                </div>

                <form
                    v-else
                    @submit.prevent="handleSave"
                    @keydown.enter="
                        (e: KeyboardEvent) => {
                            if ((e.target as HTMLElement)?.tagName === 'INPUT')
                                e.preventDefault();
                        }
                    "
                    class="space-y-5"
                >
                    <section
                        id="identity"
                        class="scroll-mt-20 rounded-lg border bg-card p-4"
                    >
                        <div class="mb-4 flex items-center gap-2">
                            <Building2 class="h-4 w-4 text-primary" />
                            <h3 class="text-sm font-semibold text-foreground">
                                Identidad
                            </h3>
                        </div>

                        <div class="grid gap-5 lg:grid-cols-[180px_1fr]">
                            <div class="space-y-3">
                                <div
                                    class="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/40"
                                >
                                    <img
                                        v-if="
                                            logoPreview ||
                                            settings.store_logo_url
                                        "
                                        :src="
                                            logoPreview ||
                                            settings.store_logo_url!
                                        "
                                        alt="Logo"
                                        class="h-full w-full object-contain p-2"
                                    />
                                    <span
                                        v-else
                                        class="px-2 text-center text-xs text-muted-foreground"
                                    >
                                        Sin logo
                                    </span>
                                </div>
                                <label
                                    class="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                                >
                                    <Upload class="h-4 w-4" />
                                    Subir logo
                                    <input
                                        type="file"
                                        accept="image/*"
                                        class="hidden"
                                        @change="handleLogoChange"
                                    />
                                </label>
                                <p v-if="logoFile" class="text-xs text-primary">
                                    {{ logoFile.name }}
                                </p>
                            </div>

                            <div class="grid gap-4 md:grid-cols-2">
                                <div class="space-y-1.5 md:col-span-2">
                                    <label class="text-sm font-medium">
                                        Nombre de la tienda *
                                    </label>
                                    <input
                                        v-model="settings.store_name"
                                        type="text"
                                        required
                                        class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="Ej: HermeX Autopartes"
                                    />
                                </div>
                                <div class="space-y-1.5 md:col-span-2">
                                    <label class="text-sm font-medium">
                                        Slogan / descripcion
                                    </label>
                                    <input
                                        v-model="settings.store_tagline"
                                        type="text"
                                        class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="Especialistas en repuestos automotrices"
                                    />
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-sm font-medium">
                                        Propietario
                                    </label>
                                    <input
                                        v-model="settings.store_owner_name"
                                        type="text"
                                        class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-sm font-medium">
                                        RUC / ID fiscal
                                    </label>
                                    <input
                                        v-model="settings.store_tax_id"
                                        type="text"
                                        class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div class="space-y-1.5">
                                    <label
                                        class="flex items-center gap-1 text-sm font-medium"
                                    >
                                        <Phone class="h-3.5 w-3.5" />
                                        Telefono
                                    </label>
                                    <input
                                        v-model="settings.store_phone"
                                        type="text"
                                        class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div class="space-y-1.5">
                                    <label
                                        class="flex items-center gap-1 text-sm font-medium"
                                    >
                                        <Mail class="h-3.5 w-3.5" />
                                        Correo
                                    </label>
                                    <input
                                        v-model="settings.store_email"
                                        type="email"
                                        class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div class="space-y-1.5">
                                    <label
                                        class="flex items-center gap-1 text-sm font-medium"
                                    >
                                        <MapPin class="h-3.5 w-3.5" />
                                        Direccion
                                    </label>
                                    <input
                                        v-model="settings.store_address"
                                        type="text"
                                        class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section
                        id="documents"
                        class="scroll-mt-20 rounded-lg border bg-card p-4"
                    >
                        <div class="mb-4 flex items-center gap-2">
                            <FileText class="h-4 w-4 text-primary" />
                            <h3 class="text-sm font-semibold text-foreground">
                                Documentos e impresion
                            </h3>
                        </div>
                        <div class="grid gap-4 md:grid-cols-[1fr_180px]">
                            <div class="space-y-1.5">
                                <label class="text-sm font-medium">
                                    Pie de pagina en tickets
                                </label>
                                <input
                                    v-model="settings.store_ticket_footer"
                                    type="text"
                                    class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Gracias por su compra"
                                />
                            </div>
                            <div class="space-y-1.5">
                                <label class="text-sm font-medium"
                                    >Moneda</label
                                >
                                <select
                                    v-model="settings.store_currency"
                                    class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="USD">USD ($)</option>
                                    <option value="PAB">PAB (B/.)</option>
                                    <option value="EUR">EUR</option>
                                    <option value="MXN">MXN ($)</option>
                                    <option value="COP">COP ($)</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    <section
                        id="payments"
                        class="scroll-mt-20 rounded-lg border bg-card p-4"
                    >
                        <div
                            class="mb-4 flex items-center justify-between gap-3"
                        >
                            <div class="flex items-center gap-2">
                                <CreditCard class="h-4 w-4 text-primary" />
                                <h3
                                    class="text-sm font-semibold text-foreground"
                                >
                                    Metodos de pago
                                </h3>
                            </div>
                            <button
                                type="button"
                                class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                                @click="showAddMethodModal = true"
                            >
                                <Plus class="h-4 w-4" />
                                Agregar
                            </button>
                        </div>

                        <div
                            v-if="paymentMethodsLoading"
                            class="py-8 text-center text-sm text-muted-foreground"
                        >
                            Cargando metodos...
                        </div>

                        <div v-else class="overflow-hidden rounded-md border">
                            <table class="w-full text-sm">
                                <thead
                                    class="bg-muted/50 text-xs text-muted-foreground uppercase"
                                >
                                    <tr>
                                        <th class="px-3 py-2 text-left">
                                            Orden
                                        </th>
                                        <th class="px-3 py-2 text-left">
                                            Metodo
                                        </th>
                                        <th class="px-3 py-2 text-left">
                                            Codigo
                                        </th>
                                        <th class="px-3 py-2 text-left">
                                            Estado
                                        </th>
                                        <th class="px-3 py-2 text-right">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-border">
                                    <tr
                                        v-for="(
                                            method, index
                                        ) in paymentMethods"
                                        :key="method.id"
                                        class="hover:bg-muted/30"
                                    >
                                        <td class="px-3 py-2">
                                            <div
                                                class="flex items-center gap-1"
                                            >
                                                <button
                                                    type="button"
                                                    :disabled="index === 0"
                                                    class="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                                                    @click="moveMethodUp(index)"
                                                >
                                                    <ChevronUp
                                                        class="h-3.5 w-3.5"
                                                    />
                                                </button>
                                                <button
                                                    type="button"
                                                    :disabled="
                                                        index >=
                                                        paymentMethods.length -
                                                            1
                                                    "
                                                    class="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                                                    @click="
                                                        moveMethodDown(index)
                                                    "
                                                >
                                                    <ChevronDown
                                                        class="h-3.5 w-3.5"
                                                    />
                                                </button>
                                            </div>
                                        </td>
                                        <td class="px-3 py-2 font-medium">
                                            <span
                                                class="inline-flex items-center gap-2"
                                            >
                                                {{ method.name }}
                                                <span
                                                    v-if="method.is_system"
                                                    class="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                                                >
                                                    <Lock class="h-3 w-3" />
                                                    Sistema
                                                </span>
                                            </span>
                                        </td>
                                        <td
                                            class="px-3 py-2 font-mono text-xs text-muted-foreground"
                                        >
                                            {{ method.code }}
                                        </td>
                                        <td class="px-3 py-2">
                                            <label
                                                class="inline-flex items-center gap-2 text-xs font-medium"
                                                :class="{
                                                    'cursor-not-allowed opacity-50':
                                                        method.is_system,
                                                }"
                                            >
                                                <input
                                                    type="checkbox"
                                                    :checked="method.is_active"
                                                    :disabled="method.is_system"
                                                    class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                    @change="
                                                        handleToggleActive(
                                                            method,
                                                        )
                                                    "
                                                />
                                                {{
                                                    method.is_active
                                                        ? 'Activo'
                                                        : 'Inactivo'
                                                }}
                                            </label>
                                        </td>
                                        <td class="px-3 py-2 text-right">
                                            <button
                                                v-if="!method.is_system"
                                                type="button"
                                                class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                @click="
                                                    methodToArchive = method
                                                "
                                            >
                                                <Trash2 class="h-3.5 w-3.5" />
                                                Archivar
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section
                        id="quotes"
                        class="scroll-mt-20 rounded-lg border bg-card p-4"
                    >
                        <div class="mb-4 flex items-center gap-2">
                            <Clock class="h-4 w-4 text-primary" />
                            <h3 class="text-sm font-semibold text-foreground">
                                Cotizaciones
                            </h3>
                        </div>
                        <div class="grid gap-4 md:grid-cols-2">
                            <div class="space-y-1.5">
                                <label class="text-sm font-medium">
                                    Expiracion de cotizaciones
                                </label>
                                <select
                                    v-model.number="
                                        settings.quote_expiration_days
                                    "
                                    class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option :value="0">Deshabilitado</option>
                                    <option :value="15">15 dias</option>
                                    <option :value="30">30 dias</option>
                                    <option :value="60">60 dias</option>
                                    <option :value="90">90 dias</option>
                                </select>
                            </div>
                            <label
                                class="flex items-start gap-3 rounded-md border p-3"
                            >
                                <input
                                    v-model="settings.require_stock_for_quotes"
                                    type="checkbox"
                                    class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <span>
                                    <span class="block text-sm font-medium">
                                        Requerir stock para cotizar
                                    </span>
                                    <span class="text-xs text-muted-foreground">
                                        Bloquea cotizaciones sin disponibilidad
                                        suficiente.
                                    </span>
                                </span>
                            </label>
                        </div>
                    </section>

                    <section
                        id="fiscal"
                        class="scroll-mt-20 rounded-lg border bg-card p-4"
                    >
                        <div class="mb-4 flex items-center gap-2">
                            <Calculator class="h-4 w-4 text-primary" />
                            <h3 class="text-sm font-semibold text-foreground">
                                Formula y fiscal
                            </h3>
                        </div>
                        <div class="space-y-5">
                            <PricingFormula
                                :cost="10"
                                :tax-rate="defaultTaxRate()"
                                :model-value="settings.pricing_formula"
                                @update:model-value="
                                    (value) =>
                                        (settings.pricing_formula = value)
                                "
                            />
                            <div class="max-w-xs space-y-1.5">
                                <label
                                    class="flex items-center gap-1 text-sm font-medium"
                                >
                                    <Percent class="h-3.5 w-3.5" />
                                    Tasa de impuesto por defecto (%)
                                </label>
                                <input
                                    v-model.number="settings.store_tax_rate"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        </div>
                    </section>

                    <section
                        id="modules"
                        class="scroll-mt-20 rounded-lg border bg-card p-4"
                    >
                        <div class="mb-4 flex items-center gap-2">
                            <Wrench class="h-4 w-4 text-primary" />
                            <h3 class="text-sm font-semibold text-foreground">
                                Modulos
                            </h3>
                        </div>
                        <label
                            class="flex items-start gap-3 rounded-md border p-3"
                        >
                            <input
                                v-model="settings.modules_work_orders_enabled"
                                type="checkbox"
                                class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span>
                                <span class="block text-sm font-medium">
                                    Ordenes de trabajo
                                </span>
                                <span class="text-xs text-muted-foreground">
                                    Activa gestion de ordenes de trabajo para
                                    taller.
                                </span>
                            </span>
                        </label>
                    </section>

                    <section
                        v-if="isAdmin"
                        id="risk"
                        class="scroll-mt-20 rounded-lg border border-red-300 bg-red-50 p-4 shadow-sm dark:border-red-900/70 dark:bg-red-950/30"
                    >
                        <div
                            class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                        >
                            <div class="flex items-start gap-3">
                                <div
                                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                >
                                    <Trash2 class="h-4 w-4" />
                                </div>
                                <div>
                                    <h3
                                        class="text-sm font-bold text-red-950 dark:text-red-100"
                                    >
                                        Zona de peligro
                                    </h3>
                                    <p
                                        class="mt-1 max-w-2xl text-sm text-red-800 dark:text-red-200"
                                    >
                                        Reinicia ventas, compras, caja,
                                        inventario transaccional y movimientos.
                                        Conserva catalogos y configuraciones.
                                        Esta accion requiere confirmacion
                                        manual.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                class="inline-flex items-center justify-center gap-2 rounded-md border border-red-700 bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
                                @click="openResetModal"
                            >
                                <Trash2 class="h-4 w-4" />
                                Reiniciar data
                            </button>
                        </div>
                    </section>

                    <div
                        class="sticky bottom-0 z-10 -mx-4 flex justify-end border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-lg md:border"
                    >
                        <button
                            type="submit"
                            :disabled="saving"
                            class="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                            <Save class="h-4 w-4" />
                            {{
                                saving
                                    ? 'Guardando...'
                                    : 'Guardar configuracion'
                            }}
                        </button>
                    </div>
                </form>

                <Teleport to="body">
                    <div
                        v-if="showAddMethodModal"
                        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                        @click.self="showAddMethodModal = false"
                    >
                        <div
                            class="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl"
                        >
                            <h3 class="text-base font-semibold text-foreground">
                                Agregar metodo de pago
                            </h3>
                            <div class="mt-4 space-y-4">
                                <div class="space-y-1.5">
                                    <label class="text-sm font-medium"
                                        >Nombre</label
                                    >
                                    <input
                                        v-model="newMethodName"
                                        type="text"
                                        class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="Ej: Yappy, Nequi"
                                    />
                                </div>
                                <label class="flex items-center gap-2 text-sm">
                                    <input
                                        v-model="newMethodRequiresRef"
                                        type="checkbox"
                                        class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    Requiere numero de referencia
                                </label>
                            </div>
                            <div class="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                                    @click="
                                        showAddMethodModal = false;
                                        newMethodName = '';
                                        newMethodRequiresRef = false;
                                    "
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    :disabled="
                                        !newMethodName.trim() || addingMethod
                                    "
                                    class="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                    @click="handleAddMethod"
                                >
                                    {{
                                        addingMethod
                                            ? 'Agregando...'
                                            : 'Agregar'
                                    }}
                                </button>
                            </div>
                        </div>
                    </div>
                </Teleport>

                <Teleport to="body">
                    <div
                        v-if="methodToArchive"
                        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                        @click.self="methodToArchive = null"
                    >
                        <div
                            class="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl"
                        >
                            <h3 class="text-base font-semibold text-foreground">
                                Archivar metodo de pago
                            </h3>
                            <p class="mt-2 text-sm text-muted-foreground">
                                {{ methodToArchive.name }} ya no aparecera en el
                                POS.
                            </p>
                            <div class="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                                    @click="methodToArchive = null"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    class="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                                    @click="confirmArchiveMethod"
                                >
                                    Archivar
                                </button>
                            </div>
                        </div>
                    </div>
                </Teleport>

                <Teleport to="body">
                    <div
                        v-if="showResetModal"
                        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                        @click.self="closeResetModal"
                    >
                        <div
                            class="w-full max-w-lg rounded-lg border border-red-300 bg-white shadow-xl dark:border-red-900 dark:bg-card"
                        >
                            <div
                                class="border-b border-red-200 bg-red-50 px-5 py-4 dark:border-red-900 dark:bg-red-950/30"
                            >
                                <h3
                                    class="text-base font-bold text-red-950 dark:text-red-100"
                                >
                                    Confirmar reinicio de datos
                                </h3>
                                <p
                                    class="mt-2 text-sm text-red-800 dark:text-red-200"
                                >
                                    Esta accion elimina informacion
                                    transaccional y no se puede deshacer.
                                </p>
                            </div>

                            <div class="space-y-3 p-5">
                                <div class="space-y-1.5">
                                    <label class="text-sm font-medium">
                                        Contrasena actual
                                    </label>
                                    <input
                                        v-model="resetPassword"
                                        type="password"
                                        class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-sm font-medium">
                                        Escribe REINICIAR DATOS
                                    </label>
                                    <input
                                        v-model="resetConfirmation"
                                        type="text"
                                        class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                </div>
                                <label class="flex items-center gap-2 text-sm">
                                    <input
                                        v-model="resetNoBackup"
                                        type="checkbox"
                                        class="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                    />
                                    Ejecutar sin crear backup
                                </label>
                            </div>

                            <p
                                v-if="resetError"
                                class="mx-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                            >
                                {{ resetError }}
                            </p>

                            <div
                                class="flex justify-end gap-2 border-t border-red-100 px-5 py-4 dark:border-red-900/60"
                            >
                                <button
                                    type="button"
                                    class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                                    @click="closeResetModal"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    :disabled="resetLoading"
                                    class="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                    @click="handleResetData"
                                >
                                    {{
                                        resetLoading
                                            ? 'Reiniciando...'
                                            : 'Confirmar reinicio'
                                    }}
                                </button>
                            </div>
                        </div>
                    </div>
                </Teleport>
            </div>
        </SettingsLayout>
    </AppLayout>
</template>
