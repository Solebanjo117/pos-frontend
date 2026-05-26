<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Head, Link, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';
import {
    ArrowLeft,
    Edit,
    Building2,
    User,
    Mail,
    Phone,
    MapPin,
    CreditCard,
    Calendar,
    FileText,
    DollarSign,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    Gift,
    Car,
    Plus,
    Trash2,
    X,
} from 'lucide-vue-next';
import { useCustomers } from '@/composables/useCustomers';
import { CustomersApiService } from '@/services/customers';
import apiClient from '@/services/api/client';
import type {
    CustomerTransaction,
    CustomerVehicle,
    CustomerVehicleFormData,
} from '@/types/customer';

const props = defineProps<{
    customerId: number;
}>();

const {
    currentCustomer,
    balanceSummary,
    adjustBalance,
    fetchCustomer,
    loading,
    error,
} = useCustomers();

const transactions = ref<CustomerTransaction[]>([]);
const customerVehicles = ref<CustomerVehicle[]>([]);
const transactionsLoading = ref(false);
const transactionsPage = ref(1);
const transactionsLastPage = ref(1);

const breadcrumbs = ref<BreadcrumbItem[]>([
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Clientes', href: '/customers' },
]);

// Adjust balance modal
const showAdjustModal = ref(false);
const adjustForm = ref({
    amount: 0,
    reason: '',
});
const adjustLoading = ref(false);

const vehicleSaving = ref(false);
const vehicleError = ref<string | null>(null);
const editingVehicleId = ref<number | null>(null);
const vehicleMakes = ref<Array<{ id: number; name: string }>>([]);
const vehicleModels = ref<Array<any>>([]);
const vehicleChassis = ref<Array<any>>([]);
const vehicleEngines = ref<Array<any>>([]);
const vehicleForm = ref<CustomerVehicleFormData>({
    vehicle_model_id: 0,
    vehicle_chassis_id: null,
    vehicle_engine_id: 0,
    vin: '',
    label: '',
    notes: '',
    status: 'active',
});
const selectedMakeId = ref<number | null>(null);

const selectedVehicleModel = computed(() =>
    vehicleModels.value.find(
        (model) => Number(model.id) === vehicleForm.value.vehicle_model_id,
    ),
);

const formatVehicleModelOption = (model: any): string => {
    const generation = model.generation ? ` ${model.generation}` : '';
    const yearRange =
        model.year_from || model.year_to
            ? ` (${model.year_from || '?'}-${model.year_to || '?'})`
            : '';

    return `${model.name}${generation}${yearRange}`;
};

const vehicleChassisResolutionError = computed(() => {
    if (!vehicleForm.value.vehicle_model_id) return null;
    if (vehicleChassis.value.length > 1) {
        return 'Este modelo tiene más de un chasis configurado. Corrige el catálogo en Vehículos antes de agregarlo al cliente.';
    }
    return null;
});

const vehicleChassisResolutionLabel = computed(() => {
    if (
        !vehicleForm.value.vehicle_model_id ||
        vehicleChassisResolutionError.value
    ) {
        return null;
    }

    if (vehicleChassis.value.length === 0) {
        return 'Sin chasis configurado; se guardará solo con modelo y motor.';
    }

    return 'Chasis resuelto automáticamente.';
});

const canSaveVehicle = computed(
    () =>
        Boolean(vehicleForm.value.vehicle_model_id) &&
        Boolean(vehicleForm.value.vehicle_engine_id) &&
        Boolean(vehicleForm.value.vin.trim()) &&
        !vehicleChassisResolutionError.value &&
        !vehicleSaving.value,
);

onMounted(async () => {
    await fetchCustomer(props.customerId);
    if (currentCustomer.value) {
        breadcrumbs.value.push({
            title: currentCustomer.value.name,
            href: `/customers/${props.customerId}`,
        });
    }
    await loadTransactions();
    customerVehicles.value = currentCustomer.value?.vehicles ?? [];
    await loadVehicleMakes();
});

const loadTransactions = async (page = 1) => {
    transactionsLoading.value = true;
    try {
        const response = await CustomersApiService.getTransactions(
            props.customerId,
            page,
        );
        transactions.value = response.data.data;
        transactionsPage.value = response.data.current_page;
        transactionsLastPage.value = response.data.last_page;
    } catch (err) {
        console.error('Error loading transactions:', err);
    } finally {
        transactionsLoading.value = false;
    }
};

const loadVehicleMakes = async () => {
    const response = await apiClient.get('/vehicle-makes/all');
    vehicleMakes.value = response.data.data ?? response.data ?? [];
};

const loadVehicleModels = async () => {
    vehicleModels.value = [];
    vehicleChassis.value = [];
    vehicleEngines.value = [];
    vehicleForm.value.vehicle_model_id = 0;
    vehicleForm.value.vehicle_chassis_id = null;
    vehicleForm.value.vehicle_engine_id = 0;

    if (!selectedMakeId.value) return;

    const response = await apiClient.get(
        `/vehicle-makes/${selectedMakeId.value}/models`,
    );
    vehicleModels.value = response.data.data ?? response.data ?? [];
};

const loadVehicleConfiguration = async () => {
    vehicleChassis.value = [];
    vehicleEngines.value = [];
    vehicleForm.value.vehicle_chassis_id = null;
    vehicleForm.value.vehicle_engine_id = 0;

    if (!vehicleForm.value.vehicle_model_id) return;

    const [chassisResponse, enginesResponse] = await Promise.all([
        apiClient.get(
            `/vehicle-models/${vehicleForm.value.vehicle_model_id}/chassis`,
        ),
        apiClient.get(
            `/vehicle-models/${vehicleForm.value.vehicle_model_id}/engines`,
        ),
    ]);
    vehicleChassis.value =
        chassisResponse.data.data ?? chassisResponse.data ?? [];
    vehicleEngines.value =
        enginesResponse.data.data ?? enginesResponse.data ?? [];

    if (vehicleChassis.value.length === 1) {
        vehicleForm.value.vehicle_chassis_id = Number(
            vehicleChassis.value[0].id,
        );
    }
};

const resetVehicleForm = () => {
    editingVehicleId.value = null;
    selectedMakeId.value = null;
    vehicleModels.value = [];
    vehicleChassis.value = [];
    vehicleEngines.value = [];
    vehicleForm.value = {
        vehicle_model_id: 0,
        vehicle_chassis_id: null,
        vehicle_engine_id: 0,
        vin: '',
        label: '',
        notes: '',
        status: 'active',
    };
    vehicleError.value = null;
};

const editVehicle = async (vehicle: CustomerVehicle) => {
    editingVehicleId.value = vehicle.id;
    selectedMakeId.value = vehicle.make?.id ?? vehicle.model?.make?.id ?? null;
    vehicleForm.value = {
        vehicle_model_id: vehicle.vehicle_model_id,
        vehicle_chassis_id: vehicle.vehicle_chassis_id,
        vehicle_engine_id: vehicle.vehicle_engine_id,
        vin: vehicle.vin,
        label: vehicle.label ?? '',
        notes: vehicle.notes ?? '',
        status: vehicle.status,
    };
    if (selectedMakeId.value) {
        const modelsResponse = await apiClient.get(
            `/vehicle-makes/${selectedMakeId.value}/models`,
        );
        vehicleModels.value =
            modelsResponse.data.data ?? modelsResponse.data ?? [];
    }
    const [chassisResponse, enginesResponse] = await Promise.all([
        apiClient.get(`/vehicle-models/${vehicle.vehicle_model_id}/chassis`),
        apiClient.get(`/vehicle-models/${vehicle.vehicle_model_id}/engines`),
    ]);
    vehicleChassis.value =
        chassisResponse.data.data ?? chassisResponse.data ?? [];
    vehicleEngines.value =
        enginesResponse.data.data ?? enginesResponse.data ?? [];

    if (
        !vehicleForm.value.vehicle_chassis_id &&
        vehicleChassis.value.length === 1
    ) {
        vehicleForm.value.vehicle_chassis_id = Number(
            vehicleChassis.value[0].id,
        );
    }
};

const saveVehicle = async () => {
    if (!canSaveVehicle.value) {
        vehicleError.value =
            vehicleChassisResolutionError.value ||
            'Completa la marca, modelo, motor y VIN del carro.';
        return;
    }

    vehicleSaving.value = true;
    vehicleError.value = null;

    try {
        const payload = {
            ...vehicleForm.value,
            vin: vehicleForm.value.vin.trim().toUpperCase(),
            label: vehicleForm.value.label || null,
            notes: vehicleForm.value.notes || null,
        };

        if (editingVehicleId.value) {
            await CustomersApiService.updateVehicle(
                props.customerId,
                editingVehicleId.value,
                payload,
            );
        } else {
            await CustomersApiService.createVehicle(props.customerId, payload);
        }

        const response = await CustomersApiService.getVehicles(
            props.customerId,
        );
        customerVehicles.value = response.data.data;
        resetVehicleForm();
    } catch (err: any) {
        const firstValidationMessage = Object.values(
            err.response?.data?.errors ?? {},
        ).flat()[0] as string | undefined;
        vehicleError.value =
            err.response?.data?.message ||
            firstValidationMessage ||
            'No se pudo guardar el carro del cliente';
    } finally {
        vehicleSaving.value = false;
    }
};

const removeVehicle = async (vehicle: CustomerVehicle) => {
    if (!confirm('Desactivar este carro del cliente?')) return;

    await CustomersApiService.deleteVehicle(props.customerId, vehicle.id);
    const response = await CustomersApiService.getVehicles(props.customerId);
    customerVehicles.value = response.data.data;
};

const handleAdjustBalance = async () => {
    adjustLoading.value = true;
    try {
        await adjustBalance(
            props.customerId,
            adjustForm.value.amount,
            adjustForm.value.reason,
        );
        showAdjustModal.value = false;
        adjustForm.value = { amount: 0, reason: '' };
        await loadTransactions(); // Refresh transactions
    } catch (err) {
        // Error handled in composable
    } finally {
        adjustLoading.value = false;
    }
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
    }).format(value);
};

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
        sale: 'Venta',
        payment: 'Pago',
        credit_note: 'Nota de Crédito',
        adjustment: 'Ajuste',
        store_credit_used: 'Saldo a Favor',
    };
    return labels[type] || type;
};

const getTransactionTypeBadge = (type: string) => {
    const badges: Record<string, string> = {
        sale: 'bg-red-100 text-red-800 border-red-200',
        payment: 'bg-green-100 text-green-800 border-green-200',
        credit_note: 'bg-blue-100 text-blue-800 border-blue-200',
        adjustment: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        store_credit_used: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
    return badges[type] || 'bg-gray-100 text-gray-800 border-gray-200';
};

const goBack = () => {
    router.visit('/customers');
};
</script>

<template>
    <Head :title="currentCustomer?.name || 'Cliente'" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <!-- Header -->
        <div class="mb-6 flex items-center justify-between">
            <div class="flex items-center gap-4">
                <button
                    @click="goBack"
                    class="rounded-lg p-2 transition hover:bg-gray-100"
                    title="Volver"
                >
                    <ArrowLeft :size="24" />
                </button>
                <div>
                    <h1
                        class="text-3xl font-bold text-gray-900 dark:text-gray-100"
                    >
                        {{ currentCustomer?.name }}
                    </h1>
                    <p class="mt-1 text-gray-600 dark:text-gray-400">
                        {{ currentCustomer?.code }}
                    </p>
                </div>
            </div>
            <Link
                :href="`/customers/${customerId}/edit`"
                class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
            >
                <Edit :size="20" />
                Editar
            </Link>
        </div>

        <!-- Loading -->
        <div v-if="loading && !currentCustomer" class="py-12 text-center">
            Cargando cliente...
        </div>

        <!-- Error -->
        <div
            v-if="error"
            class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-700 dark:bg-red-900 dark:text-red-200"
        >
            {{ error }}
        </div>

        <!-- Content -->
        <div v-if="currentCustomer" class="grid gap-6 lg:grid-cols-3">
            <!-- Main Info (2 columns) -->
            <div class="space-y-6 lg:col-span-2">
                <!-- Basic Information -->
                <div class="rounded-lg bg-white p-6 shadow-sm dark:bg-card">
                    <h2
                        class="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100"
                    >
                        Información General
                    </h2>

                    <div class="grid gap-4 md:grid-cols-2">
                        <div class="flex items-start gap-3">
                            <div
                                class="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900/30"
                            >
                                <component
                                    :is="
                                        currentCustomer.type === 'business'
                                            ? Building2
                                            : User
                                    "
                                    :size="20"
                                    class="text-indigo-600 dark:text-indigo-400 dark:text-primary"
                                />
                            </div>
                            <div>
                                <p
                                    class="text-sm text-gray-600 dark:text-gray-400"
                                >
                                    Tipo
                                </p>
                                <p
                                    class="font-medium text-gray-900 dark:text-gray-100"
                                >
                                    {{
                                        currentCustomer.type === 'business'
                                            ? 'Empresa'
                                            : 'Individual'
                                    }}
                                </p>
                            </div>
                        </div>

                        <div class="flex items-start gap-3">
                            <div
                                class="rounded-lg bg-green-100 p-2 dark:bg-green-900/30"
                            >
                                <FileText
                                    :size="20"
                                    class="text-green-600 dark:text-green-400"
                                />
                            </div>
                            <div>
                                <p
                                    class="text-sm text-gray-600 dark:text-gray-400"
                                >
                                    Estado
                                </p>
                                <span
                                    class="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium"
                                    :class="
                                        currentCustomer.status === 'active'
                                            ? 'border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300'
                                            : currentCustomer.status ===
                                                'inactive'
                                              ? 'border-gray-200 bg-gray-100 text-gray-800 dark:border-border dark:bg-muted dark:text-gray-300'
                                              : 'border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300'
                                    "
                                >
                                    {{
                                        currentCustomer.status === 'active'
                                            ? 'Activo'
                                            : currentCustomer.status ===
                                                'inactive'
                                              ? 'Inactivo'
                                              : 'Bloqueado'
                                    }}
                                </span>
                            </div>
                        </div>

                        <div
                            v-if="currentCustomer.email"
                            class="flex items-start gap-3"
                        >
                            <div
                                class="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30"
                            >
                                <Mail
                                    :size="20"
                                    class="text-blue-600 dark:text-blue-400 dark:text-primary"
                                />
                            </div>
                            <div>
                                <p
                                    class="text-sm text-gray-600 dark:text-gray-400"
                                >
                                    Email
                                </p>
                                <a
                                    :href="`mailto:${currentCustomer.email}`"
                                    class="font-medium text-blue-600 hover:underline dark:text-blue-400 dark:text-primary"
                                >
                                    {{ currentCustomer.email }}
                                </a>
                            </div>
                        </div>

                        <div
                            v-if="currentCustomer.phone"
                            class="flex items-start gap-3"
                        >
                            <div
                                class="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30"
                            >
                                <Phone
                                    :size="20"
                                    class="text-purple-600 dark:text-purple-400"
                                />
                            </div>
                            <div>
                                <p
                                    class="text-sm text-gray-600 dark:text-gray-400"
                                >
                                    Teléfono
                                </p>
                                <a
                                    :href="`tel:${currentCustomer.phone}`"
                                    class="font-medium text-purple-600 hover:underline dark:text-purple-400"
                                >
                                    {{ currentCustomer.phone }}
                                </a>
                            </div>
                        </div>

                        <div
                            v-if="currentCustomer.address"
                            class="flex items-start gap-3 md:col-span-2"
                        >
                            <div
                                class="rounded-lg bg-orange-100 p-2 dark:bg-orange-900/30"
                            >
                                <MapPin
                                    :size="20"
                                    class="text-orange-600 dark:text-orange-400"
                                />
                            </div>
                            <div>
                                <p
                                    class="text-sm text-gray-600 dark:text-gray-400"
                                >
                                    Dirección
                                </p>
                                <p
                                    class="font-medium text-gray-900 dark:text-gray-100"
                                >
                                    {{ currentCustomer.address }}
                                </p>
                                <p
                                    class="text-sm text-gray-600 dark:text-gray-400"
                                >
                                    {{ currentCustomer.city
                                    }}{{
                                        currentCustomer.state
                                            ? `, ${currentCustomer.state}`
                                            : ''
                                    }}
                                    {{ currentCustomer.postal_code }}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Customer Vehicles -->
                <div class="rounded-lg bg-white p-6 shadow-sm dark:bg-card">
                    <div class="mb-4 flex items-center justify-between gap-3">
                        <h2
                            class="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100"
                        >
                            <Car :size="22" />
                            Carros
                        </h2>
                        <button
                            v-if="editingVehicleId"
                            type="button"
                            class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted"
                            @click="resetVehicleForm"
                        >
                            <X :size="16" />
                            Cancelar edición
                        </button>
                    </div>

                    <div
                        v-if="vehicleError"
                        class="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                    >
                        {{ vehicleError }}
                    </div>

                    <form
                        class="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-2 dark:border-border dark:bg-muted/40"
                        @submit.prevent="saveVehicle"
                    >
                        <div>
                            <label class="mb-1 block text-sm font-medium">
                                Marca
                            </label>
                            <select
                                v-model="selectedMakeId"
                                required
                                class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-card"
                                @change="loadVehicleModels"
                            >
                                <option :value="null">Seleccionar...</option>
                                <option
                                    v-for="make in vehicleMakes"
                                    :key="make.id"
                                    :value="make.id"
                                >
                                    {{ make.name }}
                                </option>
                            </select>
                        </div>

                        <div>
                            <label class="mb-1 block text-sm font-medium">
                                Modelo
                            </label>
                            <select
                                v-model.number="vehicleForm.vehicle_model_id"
                                required
                                class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-card"
                                @change="loadVehicleConfiguration"
                            >
                                <option :value="0">Seleccionar...</option>
                                <option
                                    v-for="model in vehicleModels"
                                    :key="model.id"
                                    :value="model.id"
                                >
                                    {{ formatVehicleModelOption(model) }}
                                </option>
                            </select>
                        </div>

                        <div>
                            <label class="mb-1 block text-sm font-medium">
                                Motor
                            </label>
                            <select
                                v-model.number="vehicleForm.vehicle_engine_id"
                                required
                                class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-card"
                            >
                                <option :value="0">Seleccionar...</option>
                                <option
                                    v-for="engine in vehicleEngines"
                                    :key="engine.id"
                                    :value="engine.id"
                                >
                                    {{ engine.engine_code }}
                                    {{ engine.displacement || '' }}
                                </option>
                            </select>
                        </div>

                        <div
                            v-if="
                                selectedVehicleModel ||
                                vehicleChassisResolutionError
                            "
                            class="md:col-span-2"
                        >
                            <div
                                class="rounded-md border px-3 py-2 text-sm"
                                :class="
                                    vehicleChassisResolutionError
                                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                                        : 'border-gray-200 bg-white text-gray-600 dark:border-border dark:bg-card dark:text-gray-300'
                                "
                            >
                                <span class="font-medium">Modelo:</span>
                                {{
                                    selectedVehicleModel
                                        ? formatVehicleModelOption(
                                              selectedVehicleModel,
                                          )
                                        : 'Selecciona un modelo'
                                }}
                                <span
                                    v-if="!vehicleChassisResolutionError"
                                    class="ml-2 text-gray-500"
                                >
                                    {{ vehicleChassisResolutionLabel }}
                                </span>
                                <span v-else class="ml-2">
                                    {{ vehicleChassisResolutionError }}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label class="mb-1 block text-sm font-medium">
                                VIN
                            </label>
                            <input
                                v-model="vehicleForm.vin"
                                required
                                maxlength="40"
                                class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm uppercase dark:border-border dark:bg-card"
                                placeholder="1234ASDF"
                            />
                        </div>

                        <div>
                            <label class="mb-1 block text-sm font-medium">
                                Alias
                            </label>
                            <input
                                v-model="vehicleForm.label"
                                class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-card"
                                placeholder="Yaris diario"
                            />
                        </div>

                        <div class="md:col-span-2">
                            <label class="mb-1 block text-sm font-medium">
                                Notas
                            </label>
                            <textarea
                                v-model="vehicleForm.notes"
                                rows="2"
                                class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-card"
                            />
                        </div>

                        <div class="flex justify-end md:col-span-2">
                            <button
                                type="submit"
                                :disabled="!canSaveVehicle"
                                class="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
                            >
                                <Plus :size="16" />
                                {{
                                    vehicleSaving
                                        ? 'Guardando...'
                                        : editingVehicleId
                                          ? 'Actualizar carro'
                                          : 'Agregar carro'
                                }}
                            </button>
                        </div>
                    </form>

                    <div
                        class="mt-4 divide-y divide-gray-100 dark:divide-border"
                    >
                        <div
                            v-if="customerVehicles.length === 0"
                            class="py-6 text-center text-sm text-gray-500"
                        >
                            Sin carros registrados
                        </div>
                        <div
                            v-for="vehicle in customerVehicles"
                            :key="vehicle.id"
                            class="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between"
                        >
                            <div>
                                <div
                                    class="font-medium text-gray-900 dark:text-gray-100"
                                >
                                    {{ vehicle.label || vehicle.display_name }}
                                </div>
                                <div class="text-sm text-gray-500">
                                    {{ vehicle.display_name }}
                                </div>
                                <div class="font-mono text-xs text-gray-500">
                                    VIN {{ vehicle.vin }}
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <span
                                    class="rounded-full px-2 py-1 text-xs"
                                    :class="
                                        vehicle.status === 'active'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-gray-100 text-gray-600'
                                    "
                                >
                                    {{
                                        vehicle.status === 'active'
                                            ? 'Activo'
                                            : 'Inactivo'
                                    }}
                                </span>
                                <button
                                    type="button"
                                    class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-border dark:hover:bg-muted"
                                    @click="editVehicle(vehicle)"
                                >
                                    Editar
                                </button>
                                <button
                                    type="button"
                                    class="rounded-md border border-red-200 px-2 py-1.5 text-red-600 hover:bg-red-50"
                                    title="Desactivar"
                                    @click="removeVehicle(vehicle)"
                                >
                                    <Trash2 :size="16" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Fiscal Info -->
                <div
                    v-if="currentCustomer.tax_id || currentCustomer.tax_name"
                    class="rounded-lg bg-white p-6 shadow-sm"
                >
                    <h2 class="mb-4 text-xl font-semibold text-gray-900">
                        Información Fiscal
                    </h2>
                    <div class="grid gap-4 md:grid-cols-2">
                        <div v-if="currentCustomer.tax_id">
                            <p class="text-sm text-gray-600">RFC / Tax ID</p>
                            <p class="font-medium text-gray-900">
                                {{ currentCustomer.tax_id }}
                            </p>
                        </div>
                        <div v-if="currentCustomer.tax_name">
                            <p class="text-sm text-gray-600">Razón Social</p>
                            <p class="font-medium text-gray-900">
                                {{ currentCustomer.tax_name }}
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Additional Contact -->
                <div
                    v-if="
                        currentCustomer.contact_person ||
                        currentCustomer.contact_phone
                    "
                    class="rounded-lg bg-white p-6 shadow-sm"
                >
                    <h2 class="mb-4 text-xl font-semibold text-gray-900">
                        Contacto Adicional
                    </h2>
                    <div class="grid gap-4 md:grid-cols-2">
                        <div v-if="currentCustomer.contact_person">
                            <p class="text-sm text-gray-600">
                                Persona de Contacto
                            </p>
                            <p class="font-medium text-gray-900">
                                {{ currentCustomer.contact_person }}
                            </p>
                        </div>
                        <div v-if="currentCustomer.contact_phone">
                            <p class="text-sm text-gray-600">
                                Teléfono de Contacto
                            </p>
                            <p class="font-medium text-gray-900">
                                {{ currentCustomer.contact_phone }}
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Notes -->
                <div
                    v-if="currentCustomer.notes"
                    class="rounded-lg bg-white p-6 shadow-sm"
                >
                    <h2 class="mb-4 text-xl font-semibold text-gray-900">
                        Notas
                    </h2>
                    <p class="whitespace-pre-wrap text-gray-700">
                        {{ currentCustomer.notes }}
                    </p>
                </div>

                <!-- Transactions -->
                <div class="rounded-lg bg-white p-6 shadow-sm">
                    <h2 class="mb-4 text-xl font-semibold text-gray-900">
                        Movimientos de Cuenta
                    </h2>

                    <div
                        v-if="transactionsLoading"
                        class="py-8 text-center text-gray-500"
                    >
                        Cargando movimientos...
                    </div>

                    <div
                        v-else-if="transactions.length === 0"
                        class="py-8 text-center text-gray-500"
                    >
                        No hay movimientos registrados
                    </div>

                    <div v-else class="space-y-3">
                        <div
                            v-for="transaction in transactions"
                            :key="transaction.id"
                            class="rounded-lg border border-gray-200 p-4 transition hover:bg-gray-50"
                        >
                            <div class="flex items-start justify-between">
                                <div class="flex-1">
                                    <div class="mb-1 flex items-center gap-2">
                                        <span
                                            class="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium"
                                            :class="
                                                getTransactionTypeBadge(
                                                    transaction.type,
                                                )
                                            "
                                        >
                                            {{
                                                getTransactionTypeLabel(
                                                    transaction.type,
                                                )
                                            }}
                                        </span>
                                        <span class="text-sm text-gray-500">{{
                                            formatDate(
                                                transaction.transaction_date,
                                            )
                                        }}</span>
                                    </div>
                                    <p
                                        v-if="transaction.description"
                                        class="text-sm text-gray-700"
                                    >
                                        {{ transaction.description }}
                                    </p>
                                </div>
                                <div class="ml-4 text-right">
                                    <p
                                        class="text-lg font-semibold"
                                        :class="
                                            transaction.type === 'payment' ||
                                            transaction.type === 'credit_note'
                                                ? 'text-green-600'
                                                : 'text-red-600'
                                        "
                                    >
                                        {{
                                            transaction.type === 'payment' ||
                                            transaction.type === 'credit_note'
                                                ? '-'
                                                : '+'
                                        }}
                                        {{ formatCurrency(transaction.amount) }}
                                    </p>
                                    <p class="text-sm text-gray-500">
                                        Saldo:
                                        {{
                                            formatCurrency(
                                                transaction.balance_after,
                                            )
                                        }}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- Pagination -->
                        <div
                            v-if="transactionsLastPage > 1"
                            class="flex justify-center gap-2 pt-4"
                        >
                            <button
                                @click="loadTransactions(transactionsPage - 1)"
                                :disabled="transactionsPage === 1"
                                class="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Anterior
                            </button>
                            <button
                                @click="loadTransactions(transactionsPage + 1)"
                                :disabled="
                                    transactionsPage === transactionsLastPage
                                "
                                class="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sidebar (1 column) -->
            <div class="space-y-6">
                <!-- Balance Summary -->
                <div
                    v-if="balanceSummary"
                    class="rounded-lg bg-white p-6 shadow-sm"
                >
                    <h2 class="mb-4 text-lg font-semibold text-gray-900">
                        Resumen Financiero
                    </h2>

                    <div class="space-y-4">
                        <div class="rounded-lg bg-gray-50 p-4 dark:bg-muted">
                            <div class="mb-1 flex items-center justify-between">
                                <span
                                    class="text-sm text-gray-600 dark:text-gray-300"
                                    >Saldo Actual</span
                                >
                                <component
                                    :is="
                                        currentCustomer.current_balance > 0
                                            ? TrendingUp
                                            : TrendingDown
                                    "
                                    :size="18"
                                    :class="
                                        currentCustomer.current_balance > 0
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-green-600 dark:text-green-400'
                                    "
                                />
                            </div>
                            <p
                                class="text-2xl font-bold"
                                :class="
                                    currentCustomer.current_balance > 0
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-green-600 dark:text-green-400'
                                "
                            >
                                {{
                                    formatCurrency(
                                        currentCustomer.current_balance,
                                    )
                                }}
                            </p>
                        </div>

                        <!-- Store Credit (Saldo a Favor) -->
                        <div
                            v-if="currentCustomer.has_store_credit"
                            class="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20"
                        >
                            <div class="mb-1 flex items-center gap-2">
                                <Gift
                                    :size="18"
                                    class="text-emerald-600 dark:text-emerald-400"
                                />
                                <span
                                    class="text-sm font-medium text-emerald-700 dark:text-emerald-300"
                                    >Saldo a Favor</span
                                >
                            </div>
                            <p
                                class="text-xl font-bold text-emerald-600 dark:text-emerald-400"
                            >
                                {{
                                    formatCurrency(currentCustomer.store_credit)
                                }}
                            </p>
                            <p
                                class="mt-1 text-xs text-emerald-600/70 dark:text-emerald-400/70"
                            >
                                Disponible para aplicar en compras
                            </p>
                        </div>

                        <div
                            class="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20"
                        >
                            <div class="mb-1 flex items-center gap-2">
                                <CreditCard
                                    :size="18"
                                    class="text-blue-600 dark:text-blue-400 dark:text-primary"
                                />
                                <span
                                    class="text-sm text-gray-600 dark:text-gray-300"
                                    >Límite de Crédito</span
                                >
                            </div>
                            <p
                                class="text-xl font-semibold text-gray-900 dark:text-gray-100"
                            >
                                {{
                                    formatCurrency(balanceSummary.credit_limit)
                                }}
                            </p>
                        </div>

                        <div
                            class="rounded-lg bg-green-50 p-4 dark:bg-green-900/20"
                        >
                            <div class="mb-1 flex items-center gap-2">
                                <DollarSign
                                    :size="18"
                                    class="text-green-600 dark:text-green-400"
                                />
                                <span
                                    class="text-sm text-gray-600 dark:text-gray-300"
                                    >Crédito Disponible</span
                                >
                            </div>
                            <p
                                class="text-xl font-semibold text-gray-900 dark:text-gray-100"
                            >
                                {{
                                    formatCurrency(
                                        balanceSummary.available_credit,
                                    )
                                }}
                            </p>
                        </div>

                        <div
                            class="rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20"
                        >
                            <div class="mb-1 flex items-center gap-2">
                                <Calendar
                                    :size="18"
                                    class="text-purple-600 dark:text-purple-400"
                                />
                                <span
                                    class="text-sm text-gray-600 dark:text-gray-300"
                                    >Días de Crédito</span
                                >
                            </div>
                            <p
                                class="text-xl font-semibold text-gray-900 dark:text-gray-100"
                            >
                                {{ balanceSummary.credit_days }} días
                            </p>
                        </div>

                        <!-- Over limit warning -->
                        <div
                            v-if="balanceSummary.is_over_limit"
                            class="rounded-lg border border-red-200 bg-red-50 p-4"
                        >
                            <div class="flex items-center gap-2 text-red-800">
                                <AlertCircle :size="20" />
                                <span class="text-sm font-medium"
                                    >Límite de crédito excedido</span
                                >
                            </div>
                        </div>

                        <!-- Adjust Balance Button -->
                        <button
                            @click="showAdjustModal = true"
                            class="w-full rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        >
                            Ajustar Saldo
                        </button>
                    </div>
                </div>

                <!-- Dates -->
                <div class="rounded-lg bg-white p-6 shadow-sm">
                    <h2 class="mb-4 text-lg font-semibold text-gray-900">
                        Fechas
                    </h2>
                    <div class="space-y-3">
                        <div>
                            <p class="text-sm text-gray-600">Creado</p>
                            <p class="font-medium text-gray-900">
                                {{ formatDate(currentCustomer.created_at) }}
                            </p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">
                                Última Actualización
                            </p>
                            <p class="font-medium text-gray-900">
                                {{ formatDate(currentCustomer.updated_at) }}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Adjust Balance Modal -->
        <div
            v-if="showAdjustModal"
            class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
            @click.self="showAdjustModal = false"
        >
            <div class="w-full max-w-md rounded-lg bg-white p-6 dark:bg-card">
                <h3
                    class="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100"
                >
                    Ajustar Saldo
                </h3>

                <form
                    @submit.prevent="handleAdjustBalance"
                    @keydown.enter="
                        (e: KeyboardEvent) => {
                            if ((e.target as HTMLElement)?.tagName === 'INPUT')
                                e.preventDefault();
                        }
                    "
                >
                    <div class="mb-4">
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Monto</label
                        >
                        <input
                            v-model.number="adjustForm.amount"
                            type="number"
                            step="0.01"
                            required
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-border dark:bg-muted dark:text-gray-100"
                            placeholder="0.00"
                        />
                        <p
                            class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                        >
                            Positivo para aumentar saldo (cargo), negativo para
                            disminuir (abono)
                        </p>
                    </div>

                    <div class="mb-6">
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Razón/Motivo *</label
                        >
                        <textarea
                            v-model="adjustForm.reason"
                            required
                            rows="3"
                            class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-border dark:bg-muted dark:text-gray-100"
                            placeholder="Describe el motivo del ajuste..."
                        ></textarea>
                    </div>

                    <div class="flex justify-end gap-3">
                        <button
                            type="button"
                            @click="showAdjustModal = false"
                            class="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                            :disabled="adjustLoading"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            class="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                            :disabled="adjustLoading"
                        >
                            {{
                                adjustLoading ? 'Guardando...' : 'Ajustar Saldo'
                            }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </AppLayout>
</template>
