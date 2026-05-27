<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Head, Link, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';
import {
    AlertCircle,
    ArrowLeft,
    Banknote,
    Car,
    ChevronDown,
    ChevronRight,
    Edit,
    FileText,
    FilterX,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-vue-next';
import { CustomersApiService } from '@/services/customers';
import apiClient from '@/services/api/client';
import type {
    Customer,
    CustomerBalanceSummary,
    CustomerPurchasedItem,
    CustomerSalesHistory,
    CustomerSalesHistoryFilters,
    CustomerSalesHistoryOrder,
    CustomerTransaction,
    CustomerVehicle,
    CustomerVehicleFormData,
} from '@/types/customer';

const props = defineProps<{
    customerId: number;
}>();

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Clientes', href: '/customers' },
    {
        title: customer.value?.name ?? 'Cliente',
        href: `/customers/${props.customerId}`,
    },
]);

const tabs = [
    { key: 'summary', label: 'Resumen' },
    { key: 'invoices', label: 'Facturas' },
    { key: 'items', label: 'Items comprados' },
    { key: 'payments', label: 'Pagos/Movimientos' },
    { key: 'vehicles', label: 'Carros' },
] as const;

type TabKey = (typeof tabs)[number]['key'];
type PurchasedHistoryItem = CustomerPurchasedItem & {
    order: CustomerSalesHistoryOrder;
};

const customer = ref<Customer | null>(null);
const balanceSummary = ref<CustomerBalanceSummary | null>(null);
const transactions = ref<CustomerTransaction[]>([]);
const salesHistory = ref<CustomerSalesHistory | null>(null);
const customerVehicles = ref<CustomerVehicle[]>([]);
const activeTab = ref<TabKey>('invoices');
const expandedOrders = ref<Set<number>>(new Set());
const loading = ref(false);
const historyLoading = ref(false);
const transactionsLoading = ref(false);
const error = ref<string | null>(null);
const historyError = ref<string | null>(null);
const transactionsPage = ref(1);
const transactionsLastPage = ref(1);

const historyFilters = ref<CustomerSalesHistoryFilters>({
    search: '',
    date_from: '',
    date_to: '',
    status: '',
    payment_status: '',
    page: 1,
    per_page: 15,
});

const showAdjustModal = ref(false);
const adjustForm = ref({ amount: 0, reason: '' });
const adjustLoading = ref(false);

const vehicleSaving = ref(false);
const vehicleError = ref<string | null>(null);
const editingVehicleId = ref<number | null>(null);
const vehicleMakes = ref<Array<{ id: number; name: string }>>([]);
const vehicleModels = ref<Array<any>>([]);
const vehicleChassis = ref<Array<any>>([]);
const vehicleEngines = ref<Array<any>>([]);
const selectedMakeId = ref<number | null>(null);
const vehicleForm = ref<CustomerVehicleFormData>({
    vehicle_model_id: 0,
    vehicle_chassis_id: null,
    vehicle_engine_id: 0,
    vin: '',
    label: '',
    notes: '',
    status: 'active',
});

const orders = computed(() => salesHistory.value?.data ?? []);
const historyMeta = computed(() => salesHistory.value?.meta);
const purchasedItems = computed<PurchasedHistoryItem[]>(() =>
    orders.value.flatMap((order) =>
        order.items.map((item) => ({ ...item, order })),
    ),
);
const orderPayments = computed(() =>
    orders.value.flatMap((order) =>
        order.payments.map((payment) => ({ ...payment, order })),
    ),
);
const totalPurchased = computed(() =>
    orders.value.reduce((sum, order) => sum + Number(order.total || 0), 0),
);
const totalPaid = computed(() =>
    orders.value.reduce(
        (sum, order) => sum + Number(order.amount_paid || 0),
        0,
    ),
);
const totalDue = computed(() =>
    orders.value.reduce((sum, order) => sum + Number(order.amount_due || 0), 0),
);
const activeVehicles = computed(() =>
    customerVehicles.value.filter((vehicle) => vehicle.status === 'active'),
);
const canSaveVehicle = computed(
    () =>
        Boolean(vehicleForm.value.vehicle_model_id) &&
        Boolean(vehicleForm.value.vehicle_engine_id) &&
        Boolean(vehicleForm.value.vin.trim()) &&
        !vehicleChassisResolutionError.value &&
        !vehicleSaving.value,
);
const vehicleChassisResolutionError = computed(() => {
    if (!vehicleForm.value.vehicle_model_id) return null;
    if (vehicleChassis.value.length > 1) {
        return 'Este modelo tiene mas de un chasis configurado. Corrige el catalogo antes de agregarlo al cliente.';
    }

    return null;
});

const formatCurrency = (value: unknown): string =>
    new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value) || 0);

const formatDate = (date?: string | null): string => {
    if (!date) return '-';

    return new Date(date).toLocaleDateString('es-PA');
};

const formatDateTime = (date?: string | null): string => {
    if (!date) return '-';

    return new Date(date).toLocaleString('es-PA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const paymentStatusLabel = (status: string): string =>
    ({
        paid: 'Pagada',
        partial: 'Parcial',
        pending: 'Pendiente',
        refunded: 'Reembolsada',
    })[status] ?? status;

const paymentStatusClass = (status: string): string =>
    ({
        paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        partial: 'border-amber-200 bg-amber-50 text-amber-700',
        pending: 'border-red-200 bg-red-50 text-red-700',
        refunded: 'border-blue-200 bg-blue-50 text-blue-700',
    })[status] ?? 'border-gray-200 bg-gray-50 text-gray-700';

const transactionTypeLabel = (type: string): string =>
    ({
        sale: 'Venta',
        payment: 'Pago',
        credit_note: 'Nota de credito',
        adjustment: 'Ajuste',
        store_credit_used: 'Saldo a favor',
    })[type] ?? type;

const transactionAmountClass = (type: string): string =>
    ['payment', 'credit_note', 'store_credit_used'].includes(type)
        ? 'text-emerald-600'
        : 'text-red-600';

const transactionSign = (type: string): string =>
    ['payment', 'credit_note', 'store_credit_used'].includes(type) ? '-' : '+';

const paymentMethodsLabel = (order: CustomerSalesHistoryOrder): string => {
    if (order.payment_summary.length === 0) {
        return order.payment_status === 'pending' ? 'Credito' : 'Sin pagos';
    }

    return order.payment_summary
        .map(
            (payment) =>
                `${payment.method_label} ${formatCurrency(payment.amount)}`,
        )
        .join(' / ');
};

const toggleOrder = (orderId: number): void => {
    const next = new Set(expandedOrders.value);
    if (next.has(orderId)) {
        next.delete(orderId);
    } else {
        next.add(orderId);
    }
    expandedOrders.value = next;
};

const fetchCustomer = async (): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
        const response = await CustomersApiService.getCustomer(
            props.customerId,
        );
        customer.value = response.data.customer;
        balanceSummary.value = response.data.balance_summary;
        customerVehicles.value = response.data.customer.vehicles ?? [];
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'No se pudo cargar el cliente.';
    } finally {
        loading.value = false;
    }
};

const fetchSalesHistory = async (page = 1): Promise<void> => {
    historyLoading.value = true;
    historyError.value = null;

    try {
        const filters = {
            ...historyFilters.value,
            page,
            search: historyFilters.value.search || undefined,
            date_from: historyFilters.value.date_from || undefined,
            date_to: historyFilters.value.date_to || undefined,
            status: historyFilters.value.status || undefined,
            payment_status: historyFilters.value.payment_status || undefined,
        };
        const response = await CustomersApiService.getSalesHistory(
            props.customerId,
            filters,
        );
        salesHistory.value = response.data;
        historyFilters.value.page = response.data.meta.current_page;
    } catch (e: any) {
        historyError.value =
            e.response?.data?.message || 'No se pudo cargar el historial.';
    } finally {
        historyLoading.value = false;
    }
};

const loadTransactions = async (page = 1): Promise<void> => {
    transactionsLoading.value = true;

    try {
        const response = await CustomersApiService.getTransactions(
            props.customerId,
            page,
        );
        transactions.value = response.data.data;
        transactionsPage.value = response.data.current_page;
        transactionsLastPage.value = response.data.last_page;
    } finally {
        transactionsLoading.value = false;
    }
};

const applyHistoryFilters = (): void => {
    fetchSalesHistory(1);
};

const clearHistoryFilters = (): void => {
    historyFilters.value = {
        search: '',
        date_from: '',
        date_to: '',
        status: '',
        payment_status: '',
        page: 1,
        per_page: 15,
    };
    fetchSalesHistory(1);
};

const loadVehicleMakes = async (): Promise<void> => {
    const response = await apiClient.get('/vehicle-makes/all');
    vehicleMakes.value = response.data.data ?? response.data ?? [];
};

const loadVehicleModels = async (): Promise<void> => {
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

const loadVehicleConfiguration = async (): Promise<void> => {
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

const resetVehicleForm = (): void => {
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

const editVehicle = async (vehicle: CustomerVehicle): Promise<void> => {
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
};

const refreshVehicles = async (): Promise<void> => {
    const response = await CustomersApiService.getVehicles(props.customerId);
    customerVehicles.value = response.data.data;
};

const saveVehicle = async (): Promise<void> => {
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

        await refreshVehicles();
        resetVehicleForm();
    } catch (e: any) {
        const firstValidationMessage = Object.values(
            e.response?.data?.errors ?? {},
        ).flat()[0] as string | undefined;
        vehicleError.value =
            e.response?.data?.message ||
            firstValidationMessage ||
            'No se pudo guardar el carro del cliente.';
    } finally {
        vehicleSaving.value = false;
    }
};

const removeVehicle = async (vehicle: CustomerVehicle): Promise<void> => {
    if (!confirm('Desactivar este carro del cliente?')) return;

    await CustomersApiService.deleteVehicle(props.customerId, vehicle.id);
    await refreshVehicles();
};

const handleAdjustBalance = async (): Promise<void> => {
    adjustLoading.value = true;

    try {
        await CustomersApiService.adjustBalance(
            props.customerId,
            adjustForm.value.amount,
            adjustForm.value.reason,
        );
        showAdjustModal.value = false;
        adjustForm.value = { amount: 0, reason: '' };
        await Promise.all([fetchCustomer(), loadTransactions()]);
    } finally {
        adjustLoading.value = false;
    }
};

onMounted(async () => {
    await Promise.all([
        fetchCustomer(),
        fetchSalesHistory(),
        loadTransactions(),
    ]);
    await loadVehicleMakes();
});
</script>

<template>
    <Head :title="customer?.name || 'Cliente'" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            class="min-h-[calc(100vh-4.25rem)] bg-gray-50/60 p-4 dark:bg-background"
        >
            <div class="mx-auto max-w-7xl space-y-4">
                <div
                    class="flex flex-col gap-3 border-b border-gray-200 pb-4 lg:flex-row lg:items-center lg:justify-between dark:border-border"
                >
                    <div class="flex min-w-0 items-start gap-3">
                        <button
                            type="button"
                            class="mt-1 rounded-md border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-gray-200"
                            title="Volver"
                            @click="router.visit('/customers')"
                        >
                            <ArrowLeft :size="18" />
                        </button>
                        <div class="min-w-0">
                            <p
                                class="text-xs font-semibold tracking-wide text-indigo-600 uppercase"
                            >
                                Ficha cliente
                            </p>
                            <h1
                                class="mt-1 truncate text-2xl font-bold text-gray-900 dark:text-white"
                            >
                                {{ customer?.name || 'Cliente' }}
                            </h1>
                            <div
                                class="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500"
                            >
                                <span class="font-mono">{{
                                    customer?.code
                                }}</span>
                                <span v-if="customer?.phone">{{
                                    customer.phone
                                }}</span>
                                <span v-if="customer?.email">{{
                                    customer.email
                                }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                        <Link
                            :href="`/ar?customer_id=${customerId}`"
                            class="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                        >
                            <Banknote :size="16" />
                            Ver cuenta
                        </Link>
                        <Link
                            :href="`/sales-orders?customer_id=${customerId}`"
                            class="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-gray-200"
                        >
                            <FileText :size="16" />
                            Ventas
                        </Link>
                        <Link
                            :href="`/customers/${customerId}/edit`"
                            class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        >
                            <Edit :size="16" />
                            Editar
                        </Link>
                    </div>
                </div>

                <div
                    v-if="error"
                    class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                    {{ error }}
                </div>

                <div
                    v-if="loading && !customer"
                    class="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500"
                >
                    Cargando cliente...
                </div>

                <template v-else-if="customer">
                    <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
                        <div
                            class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                        >
                            <p
                                class="text-xs font-semibold text-gray-500 uppercase"
                            >
                                Saldo actual
                            </p>
                            <p
                                class="mt-2 text-2xl font-bold"
                                :class="
                                    customer.current_balance > 0
                                        ? 'text-red-600'
                                        : 'text-emerald-600'
                                "
                            >
                                {{ formatCurrency(customer.current_balance) }}
                            </p>
                        </div>
                        <div
                            class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                        >
                            <p
                                class="text-xs font-semibold text-gray-500 uppercase"
                            >
                                Comprado
                            </p>
                            <p
                                class="mt-2 text-2xl font-bold text-gray-900 dark:text-white"
                            >
                                {{ formatCurrency(totalPurchased) }}
                            </p>
                        </div>
                        <div
                            class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                        >
                            <p
                                class="text-xs font-semibold text-gray-500 uppercase"
                            >
                                Cobrado
                            </p>
                            <p class="mt-2 text-2xl font-bold text-emerald-600">
                                {{ formatCurrency(totalPaid) }}
                            </p>
                        </div>
                        <div
                            class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                        >
                            <p
                                class="text-xs font-semibold text-gray-500 uppercase"
                            >
                                Pendiente
                            </p>
                            <p class="mt-2 text-2xl font-bold text-amber-600">
                                {{ formatCurrency(totalDue) }}
                            </p>
                        </div>
                        <div
                            class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                        >
                            <p
                                class="text-xs font-semibold text-gray-500 uppercase"
                            >
                                Carros activos
                            </p>
                            <p
                                class="mt-2 text-2xl font-bold text-gray-900 dark:text-white"
                            >
                                {{ activeVehicles.length }}
                            </p>
                        </div>
                    </div>

                    <div
                        class="overflow-x-auto border-b border-gray-200 dark:border-border"
                    >
                        <nav class="flex min-w-max gap-1">
                            <button
                                v-for="tab in tabs"
                                :key="tab.key"
                                type="button"
                                class="border-b-2 px-3 py-2 text-sm font-semibold"
                                :class="
                                    activeTab === tab.key
                                        ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                "
                                @click="activeTab = tab.key"
                            >
                                {{ tab.label }}
                            </button>
                        </nav>
                    </div>

                    <section
                        v-if="activeTab === 'summary'"
                        class="grid gap-4 lg:grid-cols-[1fr_22rem]"
                    >
                        <div
                            class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                        >
                            <div
                                class="border-b border-gray-200 px-4 py-3 dark:border-border"
                            >
                                <h2
                                    class="text-sm font-bold text-gray-900 dark:text-white"
                                >
                                    Datos del cliente
                                </h2>
                            </div>
                            <dl class="grid gap-4 p-4 md:grid-cols-2">
                                <div>
                                    <dt
                                        class="text-xs font-semibold text-gray-500 uppercase"
                                    >
                                        Tipo
                                    </dt>
                                    <dd
                                        class="mt-1 text-sm text-gray-900 dark:text-white"
                                    >
                                        {{
                                            customer.type === 'business'
                                                ? 'Empresa'
                                                : 'Individual'
                                        }}
                                    </dd>
                                </div>
                                <div>
                                    <dt
                                        class="text-xs font-semibold text-gray-500 uppercase"
                                    >
                                        Estado
                                    </dt>
                                    <dd
                                        class="mt-1 text-sm text-gray-900 dark:text-white"
                                    >
                                        {{ customer.status }}
                                    </dd>
                                </div>
                                <div>
                                    <dt
                                        class="text-xs font-semibold text-gray-500 uppercase"
                                    >
                                        RUC / Cedula
                                    </dt>
                                    <dd
                                        class="mt-1 text-sm text-gray-900 dark:text-white"
                                    >
                                        {{ customer.tax_id || '-' }}
                                    </dd>
                                </div>
                                <div>
                                    <dt
                                        class="text-xs font-semibold text-gray-500 uppercase"
                                    >
                                        Nombre fiscal
                                    </dt>
                                    <dd
                                        class="mt-1 text-sm text-gray-900 dark:text-white"
                                    >
                                        {{ customer.tax_name || '-' }}
                                    </dd>
                                </div>
                                <div class="md:col-span-2">
                                    <dt
                                        class="text-xs font-semibold text-gray-500 uppercase"
                                    >
                                        Direccion
                                    </dt>
                                    <dd
                                        class="mt-1 text-sm text-gray-900 dark:text-white"
                                    >
                                        {{
                                            [
                                                customer.address,
                                                customer.city,
                                                customer.state,
                                                customer.country,
                                            ]
                                                .filter(Boolean)
                                                .join(', ') || '-'
                                        }}
                                    </dd>
                                </div>
                                <div class="md:col-span-2">
                                    <dt
                                        class="text-xs font-semibold text-gray-500 uppercase"
                                    >
                                        Notas
                                    </dt>
                                    <dd
                                        class="mt-1 text-sm whitespace-pre-wrap text-gray-900 dark:text-white"
                                    >
                                        {{ customer.notes || '-' }}
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        <aside
                            class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                        >
                            <div
                                class="border-b border-gray-200 px-4 py-3 dark:border-border"
                            >
                                <h2
                                    class="text-sm font-bold text-gray-900 dark:text-white"
                                >
                                    Credito
                                </h2>
                            </div>
                            <div class="space-y-3 p-4">
                                <div
                                    class="rounded-md bg-gray-50 p-3 dark:bg-muted/40"
                                >
                                    <p class="text-xs text-gray-500">Limite</p>
                                    <p
                                        class="mt-1 text-lg font-bold text-gray-900 dark:text-white"
                                    >
                                        {{
                                            formatCurrency(
                                                balanceSummary?.credit_limit,
                                            )
                                        }}
                                    </p>
                                </div>
                                <div
                                    class="rounded-md bg-gray-50 p-3 dark:bg-muted/40"
                                >
                                    <p class="text-xs text-gray-500">
                                        Disponible
                                    </p>
                                    <p
                                        class="mt-1 text-lg font-bold text-emerald-600"
                                    >
                                        {{
                                            formatCurrency(
                                                balanceSummary?.available_credit,
                                            )
                                        }}
                                    </p>
                                </div>
                                <div
                                    class="rounded-md bg-gray-50 p-3 dark:bg-muted/40"
                                >
                                    <p class="text-xs text-gray-500">
                                        Dias credito
                                    </p>
                                    <p
                                        class="mt-1 text-lg font-bold text-gray-900 dark:text-white"
                                    >
                                        {{ balanceSummary?.credit_days ?? 0 }}
                                    </p>
                                </div>
                                <div
                                    v-if="balanceSummary?.is_over_limit"
                                    class="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                                >
                                    <AlertCircle :size="16" />
                                    Limite de credito excedido
                                </div>
                                <button
                                    type="button"
                                    class="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                                    @click="showAdjustModal = true"
                                >
                                    Ajustar saldo
                                </button>
                            </div>
                        </aside>
                    </section>

                    <section
                        v-if="activeTab === 'invoices'"
                        class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                    >
                        <div
                            class="space-y-3 border-b border-gray-200 p-4 dark:border-border"
                        >
                            <div
                                class="flex flex-col gap-3 lg:flex-row lg:items-end"
                            >
                                <div class="min-w-0 flex-1">
                                    <label
                                        class="text-xs font-semibold text-gray-500 uppercase"
                                        >Buscar</label
                                    >
                                    <div class="relative mt-1">
                                        <Search
                                            class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                                        />
                                        <input
                                            v-model="historyFilters.search"
                                            type="text"
                                            class="w-full rounded-md border border-gray-300 bg-white py-2 pr-3 pl-9 text-sm dark:border-border dark:bg-muted dark:text-white"
                                            placeholder="Factura, producto, SKU..."
                                            @keyup.enter="applyHistoryFilters"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label
                                        class="text-xs font-semibold text-gray-500 uppercase"
                                        >Desde</label
                                    >
                                    <input
                                        v-model="historyFilters.date_from"
                                        type="date"
                                        class="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label
                                        class="text-xs font-semibold text-gray-500 uppercase"
                                        >Hasta</label
                                    >
                                    <input
                                        v-model="historyFilters.date_to"
                                        type="date"
                                        class="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label
                                        class="text-xs font-semibold text-gray-500 uppercase"
                                        >Pago</label
                                    >
                                    <select
                                        v-model="historyFilters.payment_status"
                                        class="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                                    >
                                        <option value="">Todos</option>
                                        <option value="paid">Pagada</option>
                                        <option value="partial">Parcial</option>
                                        <option value="pending">
                                            Pendiente
                                        </option>
                                    </select>
                                </div>
                                <div class="flex gap-2">
                                    <button
                                        type="button"
                                        class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                                        @click="applyHistoryFilters"
                                    >
                                        <Search :size="15" />
                                        Filtrar
                                    </button>
                                    <button
                                        type="button"
                                        class="rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-600 hover:bg-gray-50"
                                        title="Limpiar filtros"
                                        @click="clearHistoryFilters"
                                    >
                                        <FilterX :size="16" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div
                            v-if="historyError"
                            class="m-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                        >
                            {{ historyError }}
                        </div>
                        <div
                            v-if="historyLoading"
                            class="p-8 text-center text-sm text-gray-500"
                        >
                            Cargando facturas...
                        </div>
                        <div v-else class="overflow-x-auto">
                            <table class="min-w-full text-sm">
                                <thead
                                    class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/40"
                                >
                                    <tr>
                                        <th class="w-10 px-3 py-2"></th>
                                        <th class="px-3 py-2 text-left">
                                            Factura
                                        </th>
                                        <th class="px-3 py-2 text-left">
                                            Fecha
                                        </th>
                                        <th class="px-3 py-2 text-left">
                                            Estado
                                        </th>
                                        <th class="px-3 py-2 text-left">
                                            Metodo
                                        </th>
                                        <th class="px-3 py-2 text-right">
                                            Total
                                        </th>
                                        <th class="px-3 py-2 text-right">
                                            Cobrado
                                        </th>
                                        <th class="px-3 py-2 text-right">
                                            Saldo
                                        </th>
                                    </tr>
                                </thead>
                                <tbody
                                    class="divide-y divide-gray-100 dark:divide-border"
                                >
                                    <tr v-if="orders.length === 0">
                                        <td
                                            colspan="8"
                                            class="px-3 py-8 text-center text-gray-500"
                                        >
                                            No hay facturas para este cliente.
                                        </td>
                                    </tr>
                                    <template
                                        v-for="order in orders"
                                        :key="order.id"
                                    >
                                        <tr
                                            class="hover:bg-gray-50 dark:hover:bg-muted/40"
                                        >
                                            <td class="px-3 py-2">
                                                <button
                                                    type="button"
                                                    class="rounded p-1 text-gray-500 hover:bg-gray-100"
                                                    @click="
                                                        toggleOrder(order.id)
                                                    "
                                                >
                                                    <ChevronDown
                                                        v-if="
                                                            expandedOrders.has(
                                                                order.id,
                                                            )
                                                        "
                                                        :size="16"
                                                    />
                                                    <ChevronRight
                                                        v-else
                                                        :size="16"
                                                    />
                                                </button>
                                            </td>
                                            <td class="px-3 py-2">
                                                <Link
                                                    :href="`/sales-orders/${order.id}`"
                                                    class="font-mono font-semibold text-indigo-600 hover:underline"
                                                >
                                                    {{ order.order_number }}
                                                </Link>
                                                <p
                                                    class="text-xs text-gray-500"
                                                >
                                                    {{ order.status_label }}
                                                </p>
                                            </td>
                                            <td class="px-3 py-2 text-gray-600">
                                                {{ formatDate(order.date) }}
                                            </td>
                                            <td class="px-3 py-2">
                                                <span
                                                    class="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold"
                                                    :class="
                                                        paymentStatusClass(
                                                            order.payment_status,
                                                        )
                                                    "
                                                >
                                                    {{
                                                        paymentStatusLabel(
                                                            order.payment_status,
                                                        )
                                                    }}
                                                </span>
                                            </td>
                                            <td
                                                class="max-w-xs px-3 py-2 text-gray-600"
                                            >
                                                <span class="line-clamp-2">{{
                                                    paymentMethodsLabel(order)
                                                }}</span>
                                            </td>
                                            <td
                                                class="px-3 py-2 text-right font-mono"
                                            >
                                                {{
                                                    formatCurrency(order.total)
                                                }}
                                            </td>
                                            <td
                                                class="px-3 py-2 text-right font-mono text-emerald-600"
                                            >
                                                {{
                                                    formatCurrency(
                                                        order.amount_paid,
                                                    )
                                                }}
                                            </td>
                                            <td
                                                class="px-3 py-2 text-right font-mono font-bold text-amber-600"
                                            >
                                                {{
                                                    formatCurrency(
                                                        order.amount_due,
                                                    )
                                                }}
                                            </td>
                                        </tr>
                                        <tr v-if="expandedOrders.has(order.id)">
                                            <td
                                                colspan="8"
                                                class="bg-gray-50 px-4 py-3 dark:bg-muted/30"
                                            >
                                                <div
                                                    class="grid gap-3 lg:grid-cols-[1fr_22rem]"
                                                >
                                                    <div
                                                        class="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-border dark:bg-card"
                                                    >
                                                        <div
                                                            class="border-b border-gray-200 px-3 py-2 text-xs font-bold text-gray-500 uppercase"
                                                        >
                                                            Items comprados
                                                        </div>
                                                        <table
                                                            class="min-w-full text-xs"
                                                        >
                                                            <thead
                                                                class="bg-gray-50 text-gray-500 uppercase"
                                                            >
                                                                <tr>
                                                                    <th
                                                                        class="px-3 py-2 text-left"
                                                                    >
                                                                        Producto
                                                                    </th>
                                                                    <th
                                                                        class="px-3 py-2 text-left"
                                                                    >
                                                                        Marca
                                                                    </th>
                                                                    <th
                                                                        class="px-3 py-2 text-right"
                                                                    >
                                                                        Cant.
                                                                    </th>
                                                                    <th
                                                                        class="px-3 py-2 text-right"
                                                                    >
                                                                        Precio
                                                                    </th>
                                                                    <th
                                                                        class="px-3 py-2 text-right"
                                                                    >
                                                                        ITBMS
                                                                    </th>
                                                                    <th
                                                                        class="px-3 py-2 text-right"
                                                                    >
                                                                        Total
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody
                                                                class="divide-y divide-gray-100"
                                                            >
                                                                <tr
                                                                    v-for="item in order.items"
                                                                    :key="
                                                                        item.id
                                                                    "
                                                                >
                                                                    <td
                                                                        class="px-3 py-2"
                                                                    >
                                                                        <Link
                                                                            v-if="
                                                                                item.product_id
                                                                            "
                                                                            :href="`/products/${item.product_id}`"
                                                                            class="font-semibold text-indigo-600 hover:underline"
                                                                        >
                                                                            {{
                                                                                item.product_name
                                                                            }}
                                                                        </Link>
                                                                        <span
                                                                            v-else
                                                                            class="font-semibold text-gray-900"
                                                                            >{{
                                                                                item.product_name
                                                                            }}</span
                                                                        >
                                                                        <p
                                                                            class="font-mono text-[11px] text-gray-500"
                                                                        >
                                                                            {{
                                                                                item.variant_sku ||
                                                                                item.product_sku ||
                                                                                'MISC'
                                                                            }}
                                                                        </p>
                                                                    </td>
                                                                    <td
                                                                        class="px-3 py-2 text-gray-600"
                                                                    >
                                                                        {{
                                                                            item.brand_name ||
                                                                            '-'
                                                                        }}
                                                                    </td>
                                                                    <td
                                                                        class="px-3 py-2 text-right font-mono"
                                                                    >
                                                                        {{
                                                                            item.quantity
                                                                        }}
                                                                    </td>
                                                                    <td
                                                                        class="px-3 py-2 text-right font-mono"
                                                                    >
                                                                        {{
                                                                            formatCurrency(
                                                                                item.unit_price,
                                                                            )
                                                                        }}
                                                                    </td>
                                                                    <td
                                                                        class="px-3 py-2 text-right font-mono"
                                                                    >
                                                                        {{
                                                                            formatCurrency(
                                                                                item.tax_amount,
                                                                            )
                                                                        }}
                                                                    </td>
                                                                    <td
                                                                        class="px-3 py-2 text-right font-mono font-semibold"
                                                                    >
                                                                        {{
                                                                            formatCurrency(
                                                                                item.total,
                                                                            )
                                                                        }}
                                                                    </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    <div
                                                        class="rounded-md border border-gray-200 bg-white dark:border-border dark:bg-card"
                                                    >
                                                        <div
                                                            class="border-b border-gray-200 px-3 py-2 text-xs font-bold text-gray-500 uppercase"
                                                        >
                                                            Pagos
                                                        </div>
                                                        <div
                                                            v-if="
                                                                order.payments
                                                                    .length ===
                                                                0
                                                            "
                                                            class="p-3 text-sm text-gray-500"
                                                        >
                                                            Sin pagos
                                                            registrados.
                                                        </div>
                                                        <div
                                                            v-else
                                                            class="divide-y divide-gray-100"
                                                        >
                                                            <div
                                                                v-for="payment in order.payments"
                                                                :key="
                                                                    payment.id
                                                                "
                                                                class="p-3"
                                                            >
                                                                <div
                                                                    class="flex items-center justify-between gap-3"
                                                                >
                                                                    <div>
                                                                        <p
                                                                            class="text-sm font-semibold text-gray-900"
                                                                        >
                                                                            {{
                                                                                payment.method_label
                                                                            }}
                                                                        </p>
                                                                        <p
                                                                            class="text-xs text-gray-500"
                                                                        >
                                                                            {{
                                                                                formatDateTime(
                                                                                    payment.paid_at,
                                                                                )
                                                                            }}
                                                                        </p>
                                                                    </div>
                                                                    <p
                                                                        class="font-mono text-sm font-bold text-emerald-600"
                                                                    >
                                                                        {{
                                                                            formatCurrency(
                                                                                payment.amount,
                                                                            )
                                                                        }}
                                                                    </p>
                                                                </div>
                                                                <p
                                                                    v-if="
                                                                        payment.notes
                                                                    "
                                                                    class="mt-1 text-xs text-gray-500"
                                                                >
                                                                    {{
                                                                        payment.notes
                                                                    }}
                                                                </p>
                                                                <p
                                                                    v-if="
                                                                        payment.creator_name
                                                                    "
                                                                    class="mt-1 text-xs text-gray-500"
                                                                >
                                                                    Por
                                                                    {{
                                                                        payment.creator_name
                                                                    }}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    </template>
                                </tbody>
                            </table>
                        </div>

                        <div
                            v-if="historyMeta && historyMeta.last_page > 1"
                            class="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm dark:border-border"
                        >
                            <span class="text-gray-500">
                                Pagina {{ historyMeta.current_page }} de
                                {{ historyMeta.last_page }} -
                                {{ historyMeta.total }} facturas
                            </span>
                            <div class="flex gap-2">
                                <button
                                    type="button"
                                    class="rounded-md border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 disabled:opacity-50"
                                    :disabled="historyMeta.current_page <= 1"
                                    @click="
                                        fetchSalesHistory(
                                            historyMeta.current_page - 1,
                                        )
                                    "
                                >
                                    Anterior
                                </button>
                                <button
                                    type="button"
                                    class="rounded-md border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 disabled:opacity-50"
                                    :disabled="
                                        historyMeta.current_page >=
                                        historyMeta.last_page
                                    "
                                    @click="
                                        fetchSalesHistory(
                                            historyMeta.current_page + 1,
                                        )
                                    "
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    </section>

                    <section
                        v-if="activeTab === 'items'"
                        class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                    >
                        <div
                            class="border-b border-gray-200 px-4 py-3 dark:border-border"
                        >
                            <h2
                                class="text-sm font-bold text-gray-900 dark:text-white"
                            >
                                Items comprados
                            </h2>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="min-w-full text-sm">
                                <thead
                                    class="bg-gray-50 text-xs text-gray-500 uppercase"
                                >
                                    <tr>
                                        <th class="px-3 py-2 text-left">
                                            Producto
                                        </th>
                                        <th class="px-3 py-2 text-left">
                                            Factura
                                        </th>
                                        <th class="px-3 py-2 text-left">
                                            Fecha
                                        </th>
                                        <th class="px-3 py-2 text-left">
                                            Marca
                                        </th>
                                        <th class="px-3 py-2 text-right">
                                            Cant.
                                        </th>
                                        <th class="px-3 py-2 text-right">
                                            Total
                                        </th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100">
                                    <tr v-if="purchasedItems.length === 0">
                                        <td
                                            colspan="6"
                                            class="px-3 py-8 text-center text-gray-500"
                                        >
                                            Sin items en el rango actual.
                                        </td>
                                    </tr>
                                    <tr
                                        v-for="item in purchasedItems"
                                        :key="`${item.order.id}-${item.id}`"
                                    >
                                        <td class="px-3 py-2">
                                            <Link
                                                v-if="item.product_id"
                                                :href="`/products/${item.product_id}`"
                                                class="font-semibold text-indigo-600 hover:underline"
                                            >
                                                {{ item.product_name }}
                                            </Link>
                                            <span
                                                v-else
                                                class="font-semibold text-gray-900"
                                                >{{ item.product_name }}</span
                                            >
                                            <p
                                                class="font-mono text-xs text-gray-500"
                                            >
                                                {{
                                                    item.variant_sku ||
                                                    item.product_sku ||
                                                    'MISC'
                                                }}
                                            </p>
                                        </td>
                                        <td class="px-3 py-2">
                                            <Link
                                                :href="`/sales-orders/${item.order.id}`"
                                                class="font-mono text-indigo-600 hover:underline"
                                            >
                                                {{ item.order.order_number }}
                                            </Link>
                                        </td>
                                        <td class="px-3 py-2 text-gray-600">
                                            {{ formatDate(item.order.date) }}
                                        </td>
                                        <td class="px-3 py-2 text-gray-600">
                                            {{ item.brand_name || '-' }}
                                        </td>
                                        <td
                                            class="px-3 py-2 text-right font-mono"
                                        >
                                            {{ item.quantity }}
                                        </td>
                                        <td
                                            class="px-3 py-2 text-right font-mono font-semibold"
                                        >
                                            {{ formatCurrency(item.total) }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section
                        v-if="activeTab === 'payments'"
                        class="grid gap-4 lg:grid-cols-[1fr_24rem]"
                    >
                        <div
                            class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                        >
                            <div
                                class="border-b border-gray-200 px-4 py-3 dark:border-border"
                            >
                                <h2
                                    class="text-sm font-bold text-gray-900 dark:text-white"
                                >
                                    Pagos por factura
                                </h2>
                            </div>
                            <div class="divide-y divide-gray-100">
                                <div
                                    v-if="orderPayments.length === 0"
                                    class="p-8 text-center text-sm text-gray-500"
                                >
                                    No hay pagos en el rango actual.
                                </div>
                                <div
                                    v-for="payment in orderPayments"
                                    :key="payment.id"
                                    class="grid gap-2 p-3 text-sm md:grid-cols-[1fr_9rem_8rem]"
                                >
                                    <div class="min-w-0">
                                        <Link
                                            :href="`/sales-orders/${payment.order.id}`"
                                            class="font-mono font-semibold text-indigo-600 hover:underline"
                                        >
                                            {{ payment.order.order_number }}
                                        </Link>
                                        <p class="truncate text-gray-500">
                                            {{ payment.method_label }} -
                                            {{ payment.notes || 'Sin notas' }}
                                        </p>
                                    </div>
                                    <div class="text-gray-600">
                                        {{ formatDateTime(payment.paid_at) }}
                                    </div>
                                    <div
                                        class="text-right font-mono font-bold text-emerald-600"
                                    >
                                        {{ formatCurrency(payment.amount) }}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <aside
                            class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                        >
                            <div
                                class="border-b border-gray-200 px-4 py-3 dark:border-border"
                            >
                                <h2
                                    class="text-sm font-bold text-gray-900 dark:text-white"
                                >
                                    Movimientos de cuenta
                                </h2>
                            </div>
                            <div
                                v-if="transactionsLoading"
                                class="p-6 text-sm text-gray-500"
                            >
                                Cargando movimientos...
                            </div>
                            <div
                                v-else-if="transactions.length === 0"
                                class="p-6 text-sm text-gray-500"
                            >
                                Sin movimientos registrados.
                            </div>
                            <div v-else class="divide-y divide-gray-100">
                                <div
                                    v-for="transaction in transactions"
                                    :key="transaction.id"
                                    class="p-3"
                                >
                                    <div
                                        class="flex items-start justify-between gap-3"
                                    >
                                        <div class="min-w-0">
                                            <p
                                                class="text-sm font-semibold text-gray-900"
                                            >
                                                {{
                                                    transactionTypeLabel(
                                                        transaction.type,
                                                    )
                                                }}
                                            </p>
                                            <p class="text-xs text-gray-500">
                                                {{
                                                    formatDateTime(
                                                        transaction.transaction_date,
                                                    )
                                                }}
                                            </p>
                                            <p
                                                v-if="transaction.description"
                                                class="mt-1 text-xs text-gray-500"
                                            >
                                                {{ transaction.description }}
                                            </p>
                                        </div>
                                        <div class="text-right">
                                            <p
                                                class="font-mono text-sm font-bold"
                                                :class="
                                                    transactionAmountClass(
                                                        transaction.type,
                                                    )
                                                "
                                            >
                                                {{
                                                    transactionSign(
                                                        transaction.type,
                                                    )
                                                }}{{
                                                    formatCurrency(
                                                        transaction.amount,
                                                    )
                                                }}
                                            </p>
                                            <p class="text-xs text-gray-500">
                                                {{
                                                    formatCurrency(
                                                        transaction.balance_after,
                                                    )
                                                }}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    v-if="transactionsLastPage > 1"
                                    class="flex justify-between gap-2 p-3 text-sm"
                                >
                                    <button
                                        type="button"
                                        class="rounded-md border border-gray-300 px-3 py-1.5 font-semibold disabled:opacity-50"
                                        :disabled="transactionsPage === 1"
                                        @click="
                                            loadTransactions(
                                                transactionsPage - 1,
                                            )
                                        "
                                    >
                                        Anterior
                                    </button>
                                    <button
                                        type="button"
                                        class="rounded-md border border-gray-300 px-3 py-1.5 font-semibold disabled:opacity-50"
                                        :disabled="
                                            transactionsPage ===
                                            transactionsLastPage
                                        "
                                        @click="
                                            loadTransactions(
                                                transactionsPage + 1,
                                            )
                                        "
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        </aside>
                    </section>

                    <section
                        v-if="activeTab === 'vehicles'"
                        class="grid gap-4 xl:grid-cols-[1fr_26rem]"
                    >
                        <div
                            class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                        >
                            <div
                                class="border-b border-gray-200 px-4 py-3 dark:border-border"
                            >
                                <h2
                                    class="text-sm font-bold text-gray-900 dark:text-white"
                                >
                                    Carros del cliente
                                </h2>
                            </div>
                            <div class="divide-y divide-gray-100">
                                <div
                                    v-if="customerVehicles.length === 0"
                                    class="p-8 text-center text-sm text-gray-500"
                                >
                                    <Car
                                        class="mx-auto mb-2 text-gray-300"
                                        :size="36"
                                    />
                                    Sin carros registrados.
                                </div>
                                <div
                                    v-for="vehicle in customerVehicles"
                                    :key="vehicle.id"
                                    class="flex items-start justify-between gap-3 p-4"
                                >
                                    <div class="min-w-0">
                                        <p
                                            class="font-semibold text-gray-900 dark:text-white"
                                        >
                                            {{ vehicle.display_name }}
                                        </p>
                                        <p
                                            class="font-mono text-sm text-gray-500"
                                        >
                                            VIN {{ vehicle.vin }}
                                        </p>
                                        <p class="text-sm text-gray-500">
                                            {{ vehicle.label || 'Sin alias' }} -
                                            {{ vehicle.status }}
                                        </p>
                                    </div>
                                    <div class="flex gap-2">
                                        <button
                                            type="button"
                                            class="rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
                                            @click="editVehicle(vehicle)"
                                        >
                                            <Edit :size="16" />
                                        </button>
                                        <button
                                            type="button"
                                            class="rounded-md border border-red-200 p-2 text-red-600 hover:bg-red-50"
                                            @click="removeVehicle(vehicle)"
                                        >
                                            <Trash2 :size="16" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <aside
                            class="rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                        >
                            <div
                                class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-border"
                            >
                                <h2
                                    class="text-sm font-bold text-gray-900 dark:text-white"
                                >
                                    {{
                                        editingVehicleId
                                            ? 'Editar carro'
                                            : 'Agregar carro'
                                    }}
                                </h2>
                                <button
                                    v-if="editingVehicleId"
                                    type="button"
                                    class="text-gray-500"
                                    @click="resetVehicleForm"
                                >
                                    <X :size="16" />
                                </button>
                            </div>
                            <form
                                class="space-y-3 p-4"
                                @submit.prevent="saveVehicle"
                            >
                                <div
                                    v-if="vehicleError"
                                    class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                                >
                                    {{ vehicleError }}
                                </div>
                                <div>
                                    <label
                                        class="text-xs font-semibold text-gray-500 uppercase"
                                        >Marca</label
                                    >
                                    <select
                                        v-model.number="selectedMakeId"
                                        class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                                        @change="loadVehicleModels"
                                    >
                                        <option :value="null">
                                            Selecciona marca
                                        </option>
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
                                    <label
                                        class="text-xs font-semibold text-gray-500 uppercase"
                                        >Modelo</label
                                    >
                                    <select
                                        v-model.number="
                                            vehicleForm.vehicle_model_id
                                        "
                                        class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                                        @change="loadVehicleConfiguration"
                                    >
                                        <option :value="0">
                                            Selecciona modelo
                                        </option>
                                        <option
                                            v-for="model in vehicleModels"
                                            :key="model.id"
                                            :value="model.id"
                                        >
                                            {{ model.name }}
                                            {{ model.generation || '' }}
                                        </option>
                                    </select>
                                </div>
                                <div>
                                    <label
                                        class="text-xs font-semibold text-gray-500 uppercase"
                                        >Motor</label
                                    >
                                    <select
                                        v-model.number="
                                            vehicleForm.vehicle_engine_id
                                        "
                                        class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                                    >
                                        <option :value="0">
                                            Selecciona motor
                                        </option>
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
                                <div>
                                    <label
                                        class="text-xs font-semibold text-gray-500 uppercase"
                                        >VIN</label
                                    >
                                    <input
                                        v-model="vehicleForm.vin"
                                        type="text"
                                        class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm uppercase dark:border-border dark:bg-muted dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label
                                        class="text-xs font-semibold text-gray-500 uppercase"
                                        >Alias</label
                                    >
                                    <input
                                        v-model="vehicleForm.label"
                                        type="text"
                                        class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                                    :disabled="!canSaveVehicle"
                                >
                                    <Plus :size="16" />
                                    {{
                                        vehicleSaving
                                            ? 'Guardando...'
                                            : 'Guardar carro'
                                    }}
                                </button>
                            </form>
                        </aside>
                    </section>
                </template>
            </div>
        </div>

        <div
            v-if="showAdjustModal"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            @click.self="showAdjustModal = false"
        >
            <div
                class="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-card"
            >
                <h3 class="text-lg font-bold text-gray-900 dark:text-white">
                    Ajustar saldo
                </h3>
                <form
                    class="mt-4 space-y-4"
                    @submit.prevent="handleAdjustBalance"
                >
                    <div>
                        <label
                            class="text-xs font-semibold text-gray-500 uppercase"
                            >Monto</label
                        >
                        <input
                            v-model.number="adjustForm.amount"
                            type="number"
                            step="0.01"
                            required
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>
                    <div>
                        <label
                            class="text-xs font-semibold text-gray-500 uppercase"
                            >Motivo</label
                        >
                        <textarea
                            v-model="adjustForm.reason"
                            required
                            rows="3"
                            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                        ></textarea>
                    </div>
                    <div class="flex justify-end gap-2">
                        <button
                            type="button"
                            class="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
                            :disabled="adjustLoading"
                            @click="showAdjustModal = false"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            :disabled="adjustLoading"
                        >
                            {{ adjustLoading ? 'Guardando...' : 'Guardar' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </AppLayout>
</template>
