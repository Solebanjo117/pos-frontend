<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Head, Link, router } from '@inertiajs/vue3';
import {
    AlertCircle,
    ArrowLeft,
    Banknote,
    Building2,
    CalendarDays,
    Car,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    Edit,
    ExternalLink,
    FileText,
    Hash,
    Mail,
    MapPin,
    Package,
    Phone,
    Plus,
    Receipt,
    RefreshCw,
    Search,
    Trash2,
    UserCircle2,
    Wrench,
    X,
} from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import CustomerProfileMetric from '@/components/Customers/CustomerProfileMetric.vue';
import { CustomersApiService } from '@/services/customers';
import { WorkOrdersApiService, type WorkOrder } from '@/services/workOrders';
import apiClient from '@/services/api/client';
import type { BreadcrumbItem } from '@/types';
import type {
    Customer,
    CustomerBalanceSummary,
    CustomerProfileSummary,
    CustomerPurchasedItem,
    CustomerSalesHistory,
    CustomerSalesHistoryFilters,
    CustomerSalesHistoryOrder,
    CustomerTransaction,
    CustomerVehicle,
    CustomerVehicleFormData,
} from '@/types/customer';

const props = defineProps<{
    customerId: number | string;
}>();

const customerIdNumber = computed(() => Number(props.customerId));

const tabs = [
    { key: 'invoices', label: 'Facturas' },
    { key: 'items', label: 'Items Comprados' },
    { key: 'vehicles', label: 'Vehiculos' },
    { key: 'work_orders', label: 'Ordenes de Trabajo' },
    { key: 'payments', label: 'Pagos' },
    { key: 'history', label: 'Historial' },
] as const;

type TabKey = (typeof tabs)[number]['key'];
type PurchasedHistoryItem = CustomerPurchasedItem & {
    order: CustomerSalesHistoryOrder;
};

const customer = ref<Customer | null>(null);
const balanceSummary = ref<CustomerBalanceSummary | null>(null);
const profileSummary = ref<CustomerProfileSummary | null>(null);
const salesHistory = ref<CustomerSalesHistory | null>(null);
const transactions = ref<CustomerTransaction[]>([]);
const customerVehicles = ref<CustomerVehicle[]>([]);
const customerWorkOrders = ref<WorkOrder[]>([]);
const activeTab = ref<TabKey>('invoices');
const expandedOrders = ref<Set<number>>(new Set());
const loading = ref(false);
const historyLoading = ref(false);
const transactionsLoading = ref(false);
const workOrdersLoading = ref(false);
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
    notes: '',
    status: 'active',
});

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Clientes', href: '/customers' },
    {
        title: customer.value?.name ?? 'Cliente',
        href: `/customers/${customerIdNumber.value}`,
    },
]);

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
const activeVehicles = computed(() =>
    customerVehicles.value.filter((vehicle) => vehicle.status === 'active'),
);
const operationalMechanic = computed(() => {
    const assignedOrders = customerWorkOrders.value.filter(
        (order) => order.assignee,
    );

    if (assignedOrders.length === 0) {
        return null;
    }

    const grouped = assignedOrders.reduce(
        (carry, order) => {
            const assignee = order.assignee!;
            const key = String(assignee.id);
            carry[key] ??= {
                id: assignee.id,
                name: assignee.name,
                orders_count: 0,
                last_order_date: order.created_at,
            };
            carry[key].orders_count += 1;
            carry[key].last_order_date =
                new Date(order.created_at) >
                new Date(carry[key].last_order_date)
                    ? order.created_at
                    : carry[key].last_order_date;

            return carry;
        },
        {} as Record<
            string,
            {
                id: number;
                name: string;
                orders_count: number;
                last_order_date: string;
            }
        >,
    );

    return Object.values(grouped).sort(
        (a, b) => b.orders_count - a.orders_count,
    )[0];
});
const customerInitials = computed(
    () =>
        (customer.value?.name ?? 'CL')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('') || 'CL',
);
const creditStatusClass = computed(() => {
    if (profileSummary.value?.credit_status === 'over_limit') {
        return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200';
    }

    if (profileSummary.value?.credit_status === 'pending') {
        return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200';
    }

    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200';
});
const canSaveVehicle = computed(
    () =>
        Boolean(vehicleForm.value.vehicle_model_id) &&
        Boolean(vehicleForm.value.vehicle_engine_id) &&
        !vehicleChassisResolutionError.value &&
        !vehicleSaving.value,
);
const vehicleChassisResolutionError = computed(() => {
    if (!vehicleForm.value.vehicle_model_id) {
        return null;
    }

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
    if (!date) {
        return '-';
    }

    return new Date(
        `${date}`.includes('T') ? date : `${date}T00:00:00`,
    ).toLocaleDateString('es-PA');
};

const formatDateTime = (date?: string | null): string => {
    if (!date) {
        return '-';
    }

    return new Date(date).toLocaleString('es-PA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const paymentStatusLabel = (status: string): string =>
    (
        ({
            paid: 'Pagada',
            partial: 'Parcial',
            pending: 'Pendiente',
            refunded: 'Reembolsada',
        }) as Record<string, string>
    )[status] ?? status;

const paymentStatusClass = (status: string): string =>
    (
        ({
            paid: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
            partial:
                'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
            pending:
                'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
            refunded:
                'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
        }) as Record<string, string>
    )[status] ??
    'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';

const transactionTypeLabel = (type: string): string =>
    (
        ({
            sale: 'Venta',
            payment: 'Pago',
            credit_note: 'Nota de credito',
            adjustment: 'Ajuste',
            store_credit_used: 'Saldo a favor',
        }) as Record<string, string>
    )[type] ?? type;

const transactionAmountClass = (type: string): string =>
    ['payment', 'credit_note', 'store_credit_used'].includes(type)
        ? 'text-emerald-600 dark:text-emerald-300'
        : 'text-rose-600 dark:text-rose-300';

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

const vehiclePrimaryLabel = (vehicle: CustomerVehicle): string => {
    const parts = [
        vehicle.model?.make?.name ?? vehicle.make?.name,
        vehicle.model?.name,
        vehicle.model?.generation,
        vehicle.chassis?.code,
        vehicle.engine?.engine_code,
        vehicle.engine?.displacement,
    ].filter(Boolean);

    return parts.join(' ') || vehicle.display_name || 'Carro sin datos';
};

const vehicleStatusLabel = (status: CustomerVehicle['status']): string =>
    status === 'active' ? 'Activo' : 'Inactivo';

const vehicleStatusClass = (status: CustomerVehicle['status']): string =>
    status === 'active'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';

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
            customerIdNumber.value,
        );
        customer.value = response.data.customer;
        balanceSummary.value = response.data.balance_summary;
        profileSummary.value = response.data.profile_summary;
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
            customerIdNumber.value,
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
            customerIdNumber.value,
            page,
        );
        transactions.value = response.data.data;
        transactionsPage.value = response.data.current_page;
        transactionsLastPage.value = response.data.last_page;
    } catch {
        transactions.value = [];
        transactionsPage.value = 1;
        transactionsLastPage.value = 1;
    } finally {
        transactionsLoading.value = false;
    }
};

const loadCustomerWorkOrders = async (): Promise<void> => {
    workOrdersLoading.value = true;

    try {
        const response = await WorkOrdersApiService.getWorkOrders({
            customer_id: customerIdNumber.value,
            per_page: 8,
        });
        customerWorkOrders.value = response.data;
    } catch {
        customerWorkOrders.value = [];
    } finally {
        workOrdersLoading.value = false;
    }
};

const applyHistoryFilters = (): void => {
    void fetchSalesHistory(1);
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
    void fetchSalesHistory(1);
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

    if (!selectedMakeId.value) {
        return;
    }

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

    if (!vehicleForm.value.vehicle_model_id) {
        return;
    }

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
        vin: vehicle.vin ?? '',
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
    const response = await CustomersApiService.getVehicles(
        customerIdNumber.value,
    );
    customerVehicles.value = response.data.data;
};

const saveVehicle = async (): Promise<void> => {
    if (!canSaveVehicle.value) {
        vehicleError.value =
            vehicleChassisResolutionError.value ||
            'Completa la marca, modelo y motor del carro.';
        return;
    }

    vehicleSaving.value = true;
    vehicleError.value = null;

    try {
        const normalizedVin = vehicleForm.value.vin?.trim().toUpperCase() ?? '';
        const payload: CustomerVehicleFormData = {
            vehicle_model_id: vehicleForm.value.vehicle_model_id,
            vehicle_chassis_id: vehicleForm.value.vehicle_chassis_id,
            vehicle_engine_id: vehicleForm.value.vehicle_engine_id,
            vin: normalizedVin || null,
            notes: vehicleForm.value.notes?.trim() || null,
            status: vehicleForm.value.status,
        };

        if (editingVehicleId.value) {
            await CustomersApiService.updateVehicle(
                customerIdNumber.value,
                editingVehicleId.value,
                payload,
            );
        } else {
            await CustomersApiService.createVehicle(
                customerIdNumber.value,
                payload,
            );
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
    if (!confirm('Desactivar este carro del cliente?')) {
        return;
    }

    await CustomersApiService.deleteVehicle(customerIdNumber.value, vehicle.id);
    await refreshVehicles();
};

const createWorkOrderUrl = (vehicle?: CustomerVehicle): string => {
    const params = new URLSearchParams({
        customer_id: String(customerIdNumber.value),
    });

    if (vehicle) {
        params.set('customer_vehicle_id', String(vehicle.id));
    }

    return `/work-orders/create?${params.toString()}`;
};

const handleAdjustBalance = async (): Promise<void> => {
    adjustLoading.value = true;

    try {
        await CustomersApiService.adjustBalance(
            customerIdNumber.value,
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
        loadCustomerWorkOrders(),
    ]);
    await loadVehicleMakes();
});
</script>

<template>
    <Head :title="customer?.name || 'Cliente'" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            class="min-h-[calc(100vh-4.25rem)] bg-slate-50 p-4 dark:bg-slate-950"
        >
            <div class="mx-auto max-w-[1500px] space-y-4">
                <div
                    v-if="error"
                    class="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
                >
                    <AlertCircle :size="18" class="mt-0.5 shrink-0" />
                    {{ error }}
                </div>

                <div
                    v-if="loading && !customer"
                    class="rounded-lg border border-slate-200 bg-white py-20 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                >
                    <RefreshCw :size="22" class="mx-auto mb-3 animate-spin" />
                    Cargando perfil del cliente...
                </div>

                <template v-else-if="customer">
                    <section
                        class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                    >
                        <div
                            class="flex flex-col gap-4 xl:flex-row xl:items-center"
                        >
                            <div class="flex min-w-0 flex-1 items-center gap-4">
                                <button
                                    type="button"
                                    class="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                                    title="Volver"
                                    @click="router.visit('/customers')"
                                >
                                    <ArrowLeft :size="17" />
                                </button>
                                <div
                                    class="flex size-16 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white"
                                >
                                    {{ customerInitials }}
                                </div>
                                <div class="min-w-0">
                                    <div
                                        class="flex flex-wrap items-center gap-2"
                                    >
                                        <h1
                                            class="truncate text-2xl font-bold text-slate-950 dark:text-slate-50"
                                        >
                                            {{ customer.name }}
                                        </h1>
                                        <span
                                            class="rounded-full border px-2.5 py-1 text-xs font-semibold"
                                            :class="
                                                customer.status === 'active'
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                                                    : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                                            "
                                        >
                                            {{
                                                customer.status === 'active'
                                                    ? 'Activo'
                                                    : customer.status
                                            }}
                                        </span>
                                        <span
                                            v-if="customer.type === 'business'"
                                            class="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200"
                                        >
                                            Empresa / Taller
                                        </span>
                                    </div>
                                    <div
                                        class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400"
                                    >
                                        <span
                                            >Cliente desde
                                            {{
                                                formatDate(customer.created_at)
                                            }}</span
                                        >
                                        <span
                                            class="inline-flex items-center gap-1.5"
                                        >
                                            <Building2 :size="14" />
                                            ID: {{ customer.code }}
                                        </span>
                                        <span v-if="customer.phone">{{
                                            customer.phone
                                        }}</span>
                                        <span v-if="customer.email">{{
                                            customer.email
                                        }}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <Link
                                    :href="`/customers/${customerIdNumber}/edit`"
                                    class="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                                >
                                    <Edit :size="15" />
                                    Editar
                                </Link>
                                <button
                                    type="button"
                                    class="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                                    @click="showAdjustModal = true"
                                >
                                    <CreditCard :size="15" />
                                    Ajustar Saldo
                                </button>
                                <Link
                                    :href="`/sales-orders/create?customer_id=${customerIdNumber}`"
                                    class="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                                >
                                    <Plus :size="15" />
                                    Nueva Venta
                                </Link>
                            </div>
                        </div>
                    </section>

                    <div class="grid gap-3 md:grid-cols-4">
                        <CustomerProfileMetric
                            label="Total Comprado"
                            :value="
                                formatCurrency(profileSummary?.total_purchased)
                            "
                            :detail="`${profileSummary?.invoices_count ?? 0} facturas`"
                            :icon="Receipt"
                            accent="emerald"
                        />
                        <CustomerProfileMetric
                            label="Ticket Promedio"
                            :value="
                                formatCurrency(profileSummary?.average_ticket)
                            "
                            :detail="`Ultima compra ${formatDate(profileSummary?.last_purchase_date)}`"
                            :icon="FileText"
                            accent="indigo"
                        />
                        <CustomerProfileMetric
                            label="Total Cobrado"
                            :value="formatCurrency(profileSummary?.total_paid)"
                            :detail="`Pendiente ${formatCurrency(profileSummary?.pending_amount)}`"
                            :icon="Banknote"
                            accent="sky"
                        />
                        <CustomerProfileMetric
                            label="Carros Activos"
                            :value="String(activeVehicles.length)"
                            :detail="`${customerVehicles.length} registrados`"
                            :icon="Car"
                            accent="violet"
                        />
                    </div>

                    <div class="grid gap-4 xl:grid-cols-[1fr_20rem]">
                        <main class="min-w-0 space-y-4">
                            <section class="grid gap-4 lg:grid-cols-3">
                                <article
                                    class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                                >
                                    <h2
                                        class="border-b border-slate-200 pb-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100"
                                    >
                                        Informacion General
                                    </h2>
                                    <div class="mt-4 space-y-3 text-sm">
                                        <div class="flex gap-3">
                                            <Phone
                                                :size="16"
                                                class="mt-0.5 text-indigo-500"
                                            />
                                            <div>
                                                <p
                                                    class="text-xs text-slate-500"
                                                >
                                                    Telefono
                                                </p>
                                                <p
                                                    class="text-slate-900 dark:text-slate-100"
                                                >
                                                    {{ customer.phone || '-' }}
                                                </p>
                                            </div>
                                        </div>
                                        <div class="flex gap-3">
                                            <Mail
                                                :size="16"
                                                class="mt-0.5 text-indigo-500"
                                            />
                                            <div>
                                                <p
                                                    class="text-xs text-slate-500"
                                                >
                                                    Email
                                                </p>
                                                <p
                                                    class="text-slate-900 dark:text-slate-100"
                                                >
                                                    {{ customer.email || '-' }}
                                                </p>
                                            </div>
                                        </div>
                                        <div class="flex gap-3">
                                            <MapPin
                                                :size="16"
                                                class="mt-0.5 text-indigo-500"
                                            />
                                            <div>
                                                <p
                                                    class="text-xs text-slate-500"
                                                >
                                                    Direccion
                                                </p>
                                                <p
                                                    class="text-slate-900 dark:text-slate-100"
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
                                                </p>
                                            </div>
                                        </div>
                                        <div class="flex gap-3">
                                            <Hash
                                                :size="16"
                                                class="mt-0.5 text-indigo-500"
                                            />
                                            <div>
                                                <p
                                                    class="text-xs text-slate-500"
                                                >
                                                    RUC / Cedula
                                                </p>
                                                <p
                                                    class="text-slate-900 dark:text-slate-100"
                                                >
                                                    {{ customer.tax_id || '-' }}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </article>

                                <article
                                    class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                                >
                                    <h2
                                        class="border-b border-slate-200 pb-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100"
                                    >
                                        Credito
                                    </h2>
                                    <div class="mt-4 space-y-3 text-sm">
                                        <div class="flex justify-between gap-3">
                                            <span class="text-slate-500"
                                                >Limite</span
                                            >
                                            <span
                                                class="font-semibold text-slate-900 dark:text-slate-100"
                                            >
                                                {{
                                                    formatCurrency(
                                                        balanceSummary?.credit_limit,
                                                    )
                                                }}
                                            </span>
                                        </div>
                                        <div class="flex justify-between gap-3">
                                            <span class="text-slate-500"
                                                >Saldo actual</span
                                            >
                                            <span
                                                class="font-semibold text-amber-600 dark:text-amber-300"
                                            >
                                                {{
                                                    formatCurrency(
                                                        balanceSummary?.current_balance,
                                                    )
                                                }}
                                            </span>
                                        </div>
                                        <div class="flex justify-between gap-3">
                                            <span class="text-slate-500"
                                                >Disponible</span
                                            >
                                            <span
                                                class="font-semibold text-slate-900 dark:text-slate-100"
                                            >
                                                {{
                                                    formatCurrency(
                                                        balanceSummary?.available_credit,
                                                    )
                                                }}
                                            </span>
                                        </div>
                                        <div class="flex justify-between gap-3">
                                            <span class="text-slate-500"
                                                >Dias</span
                                            >
                                            <span
                                                class="font-semibold text-slate-900 dark:text-slate-100"
                                            >
                                                {{
                                                    balanceSummary?.credit_days ??
                                                    0
                                                }}
                                                dias
                                            </span>
                                        </div>
                                        <div
                                            class="inline-flex rounded-md border px-2 py-1 text-xs font-semibold"
                                            :class="creditStatusClass"
                                        >
                                            {{
                                                profileSummary?.credit_status_label ??
                                                'Al dia'
                                            }}
                                        </div>
                                        <div>
                                            <div
                                                class="mb-1.5 flex justify-between text-xs"
                                            >
                                                <span class="text-slate-500"
                                                    >Credito usado</span
                                                >
                                                <span
                                                    class="font-semibold text-slate-700 dark:text-slate-200"
                                                >
                                                    {{
                                                        profileSummary?.credit_used_percent ??
                                                        0
                                                    }}%
                                                </span>
                                            </div>
                                            <div
                                                class="h-2 rounded-full bg-slate-100 dark:bg-slate-800"
                                            >
                                                <div
                                                    class="h-full rounded-full bg-emerald-500"
                                                    :style="{
                                                        width: `${profileSummary?.credit_used_percent ?? 0}%`,
                                                    }"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </article>

                                <article
                                    class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                                >
                                    <h2
                                        class="border-b border-slate-200 pb-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100"
                                    >
                                        Mecanico / Referido
                                    </h2>
                                    <div
                                        v-if="operationalMechanic"
                                        class="mt-4 space-y-3"
                                    >
                                        <div class="flex items-center gap-3">
                                            <div
                                                class="flex size-10 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200"
                                            >
                                                <Wrench :size="21" />
                                            </div>
                                            <div class="min-w-0">
                                                <p
                                                    class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
                                                >
                                                    {{
                                                        operationalMechanic.name
                                                    }}
                                                </p>
                                                <p
                                                    class="text-xs text-slate-500"
                                                >
                                                    Mecanico operativo
                                                </p>
                                            </div>
                                        </div>
                                        <div
                                            class="rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-900"
                                        >
                                            <div
                                                class="flex items-center gap-2 text-slate-500"
                                            >
                                                <CalendarDays :size="13" />
                                                Ultima orden
                                                {{
                                                    formatDate(
                                                        operationalMechanic.last_order_date,
                                                    )
                                                }}
                                            </div>
                                        </div>
                                        <div
                                            class="flex justify-between text-xs"
                                        >
                                            <span class="text-slate-500"
                                                >Ordenes asignadas</span
                                            >
                                            <span
                                                class="font-semibold text-slate-900 dark:text-slate-100"
                                            >
                                                {{
                                                    operationalMechanic.orders_count
                                                }}
                                            </span>
                                        </div>
                                    </div>
                                    <div
                                        v-else-if="profileSummary?.mechanic"
                                        class="mt-4 space-y-3"
                                    >
                                        <div class="flex items-center gap-3">
                                            <div
                                                class="flex size-10 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200"
                                            >
                                                <UserCircle2 :size="21" />
                                            </div>
                                            <div class="min-w-0">
                                                <p
                                                    class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
                                                >
                                                    {{
                                                        profileSummary.mechanic
                                                            .name
                                                    }}
                                                </p>
                                                <p
                                                    class="text-xs text-slate-500"
                                                >
                                                    {{
                                                        profileSummary.mechanic
                                                            .code ||
                                                        'Sin codigo'
                                                    }}
                                                </p>
                                            </div>
                                        </div>
                                        <div
                                            class="rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-900"
                                        >
                                            <div
                                                class="flex items-center gap-2 text-slate-500"
                                            >
                                                <CalendarDays :size="13" />
                                                Referencia comercial
                                                {{
                                                    formatDate(
                                                        profileSummary.mechanic
                                                            .last_order_date,
                                                    )
                                                }}
                                            </div>
                                        </div>
                                        <div
                                            class="flex justify-between text-xs"
                                        >
                                            <span class="text-slate-500"
                                                >Facturas referidas</span
                                            >
                                            <span
                                                class="font-semibold text-slate-900 dark:text-slate-100"
                                            >
                                                {{
                                                    profileSummary.mechanic
                                                        .orders_count
                                                }}
                                            </span>
                                        </div>
                                    </div>
                                    <div
                                        v-else
                                        class="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900"
                                    >
                                        Sin mecanico operativo ni referido
                                        comercial.
                                    </div>
                                </article>
                            </section>

                            <section
                                class="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
                            >
                                <div
                                    class="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-end lg:justify-between dark:border-slate-800"
                                >
                                    <div class="min-w-0">
                                        <div class="flex overflow-x-auto">
                                            <button
                                                v-for="tab in tabs"
                                                :key="tab.key"
                                                type="button"
                                                class="relative shrink-0 px-4 py-2 text-sm font-medium"
                                                :class="
                                                    activeTab === tab.key
                                                        ? 'text-indigo-600 dark:text-indigo-300'
                                                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                                                "
                                                @click="activeTab = tab.key"
                                            >
                                                {{ tab.label }}
                                                <span
                                                    v-if="activeTab === tab.key"
                                                    class="absolute right-3 bottom-0 left-3 h-0.5 rounded-full bg-indigo-600 dark:bg-indigo-300"
                                                />
                                            </button>
                                        </div>
                                    </div>
                                    <div
                                        class="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]"
                                    >
                                        <div class="relative">
                                            <Search
                                                class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                                            />
                                            <input
                                                v-model="historyFilters.search"
                                                type="search"
                                                placeholder="Buscar factura o item..."
                                                class="h-9 w-full rounded-md border border-slate-200 bg-white pr-3 pl-9 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                                @keyup.enter="
                                                    applyHistoryFilters
                                                "
                                            />
                                        </div>
                                        <select
                                            v-model="
                                                historyFilters.payment_status
                                            "
                                            class="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                            @change="applyHistoryFilters"
                                        >
                                            <option value="">
                                                Pago: todos
                                            </option>
                                            <option value="paid">Pagada</option>
                                            <option value="partial">
                                                Parcial
                                            </option>
                                            <option value="pending">
                                                Pendiente
                                            </option>
                                        </select>
                                        <button
                                            type="button"
                                            class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700"
                                            @click="applyHistoryFilters"
                                        >
                                            Filtrar
                                        </button>
                                        <button
                                            type="button"
                                            class="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                                            @click="clearHistoryFilters"
                                        >
                                            Limpiar
                                        </button>
                                    </div>
                                </div>

                                <div
                                    v-if="historyError"
                                    class="m-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
                                >
                                    {{ historyError }}
                                </div>

                                <div
                                    v-if="historyLoading"
                                    class="py-14 text-center text-sm text-slate-500 dark:text-slate-400"
                                >
                                    <RefreshCw
                                        :size="19"
                                        class="mx-auto mb-3 animate-spin"
                                    />
                                    Cargando historial...
                                </div>

                                <template v-else>
                                    <div
                                        v-if="activeTab === 'invoices'"
                                        class="overflow-x-auto"
                                    >
                                        <table
                                            class="min-w-full divide-y divide-slate-200 dark:divide-slate-800"
                                        >
                                            <thead
                                                class="bg-slate-50 dark:bg-slate-900/80"
                                            >
                                                <tr>
                                                    <th
                                                        class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                    >
                                                        Factura
                                                    </th>
                                                    <th
                                                        class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                    >
                                                        Fecha
                                                    </th>
                                                    <th
                                                        class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                    >
                                                        Metodos
                                                    </th>
                                                    <th
                                                        class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                    >
                                                        Total
                                                    </th>
                                                    <th
                                                        class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                    >
                                                        Pagado
                                                    </th>
                                                    <th
                                                        class="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                    >
                                                        Pendiente
                                                    </th>
                                                    <th
                                                        class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                    >
                                                        Estado
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody
                                                class="divide-y divide-slate-100 dark:divide-slate-800"
                                            >
                                                <template
                                                    v-for="order in orders"
                                                    :key="order.id"
                                                >
                                                    <tr
                                                        class="cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5"
                                                        @click="
                                                            toggleOrder(
                                                                order.id,
                                                            )
                                                        "
                                                    >
                                                        <td class="px-4 py-3">
                                                            <div
                                                                class="flex items-center gap-2"
                                                            >
                                                                <Link
                                                                    :href="`/sales-orders/${order.id}`"
                                                                    class="font-mono text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                                                                    @click.stop
                                                                >
                                                                    {{
                                                                        order.order_number
                                                                    }}
                                                                </Link>
                                                                <ExternalLink
                                                                    :size="13"
                                                                    class="text-slate-400"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td
                                                            class="px-4 py-3 text-sm text-slate-500"
                                                        >
                                                            {{
                                                                formatDate(
                                                                    order.date,
                                                                )
                                                            }}
                                                        </td>
                                                        <td
                                                            class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300"
                                                        >
                                                            {{
                                                                paymentMethodsLabel(
                                                                    order,
                                                                )
                                                            }}
                                                        </td>
                                                        <td
                                                            class="px-4 py-3 text-right text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100"
                                                        >
                                                            {{
                                                                formatCurrency(
                                                                    order.total,
                                                                )
                                                            }}
                                                        </td>
                                                        <td
                                                            class="px-4 py-3 text-right text-sm font-semibold text-emerald-600 tabular-nums dark:text-emerald-300"
                                                        >
                                                            {{
                                                                formatCurrency(
                                                                    order.amount_paid,
                                                                )
                                                            }}
                                                        </td>
                                                        <td
                                                            class="px-4 py-3 text-right text-sm font-semibold tabular-nums"
                                                            :class="
                                                                order.amount_due >
                                                                0
                                                                    ? 'text-amber-600 dark:text-amber-300'
                                                                    : 'text-slate-400'
                                                            "
                                                        >
                                                            {{
                                                                formatCurrency(
                                                                    order.amount_due,
                                                                )
                                                            }}
                                                        </td>
                                                        <td class="px-4 py-3">
                                                            <span
                                                                class="rounded-md border px-2 py-1 text-xs font-semibold"
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
                                                    </tr>
                                                    <tr
                                                        v-if="
                                                            expandedOrders.has(
                                                                order.id,
                                                            )
                                                        "
                                                    >
                                                        <td
                                                            colspan="7"
                                                            class="bg-slate-50 p-4 dark:bg-slate-900/60"
                                                        >
                                                            <div
                                                                class="grid gap-2 md:grid-cols-2"
                                                            >
                                                                <div
                                                                    v-for="item in order.items"
                                                                    :key="
                                                                        item.id
                                                                    "
                                                                    class="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                                                                >
                                                                    <p
                                                                        class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                                                                    >
                                                                        {{
                                                                            item.product_name
                                                                        }}
                                                                    </p>
                                                                    <p
                                                                        class="mt-1 text-xs text-slate-500"
                                                                    >
                                                                        {{
                                                                            item.quantity
                                                                        }}
                                                                        uds -
                                                                        {{
                                                                            item.product_sku ||
                                                                            item.variant_sku ||
                                                                            'Sin SKU'
                                                                        }}
                                                                    </p>
                                                                    <p
                                                                        class="mt-2 text-sm font-bold text-slate-900 tabular-nums dark:text-slate-100"
                                                                    >
                                                                        {{
                                                                            formatCurrency(
                                                                                item.total,
                                                                            )
                                                                        }}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </template>
                                                <tr v-if="orders.length === 0">
                                                    <td
                                                        colspan="7"
                                                        class="px-4 py-12 text-center text-sm text-slate-500"
                                                    >
                                                        Sin facturas para los
                                                        filtros actuales.
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div
                                        v-if="activeTab === 'items'"
                                        class="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3"
                                    >
                                        <article
                                            v-for="item in purchasedItems"
                                            :key="`${item.order.id}-${item.id}`"
                                            class="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                                        >
                                            <div class="flex items-start gap-3">
                                                <div
                                                    class="flex size-9 shrink-0 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200"
                                                >
                                                    <Package :size="17" />
                                                </div>
                                                <div class="min-w-0 flex-1">
                                                    <p
                                                        class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
                                                    >
                                                        {{ item.product_name }}
                                                    </p>
                                                    <p
                                                        class="text-xs text-slate-500"
                                                    >
                                                        {{ item.quantity }} uds
                                                        -
                                                        {{
                                                            item.product_sku ||
                                                            item.variant_sku ||
                                                            'Sin SKU'
                                                        }}
                                                    </p>
                                                    <Link
                                                        :href="`/sales-orders/${item.order.id}`"
                                                        class="mt-2 inline-flex text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                                                    >
                                                        {{
                                                            item.order
                                                                .order_number
                                                        }}
                                                    </Link>
                                                </div>
                                                <span
                                                    class="text-sm font-bold text-slate-900 tabular-nums dark:text-slate-100"
                                                >
                                                    {{
                                                        formatCurrency(
                                                            item.total,
                                                        )
                                                    }}
                                                </span>
                                            </div>
                                        </article>
                                        <div
                                            v-if="purchasedItems.length === 0"
                                            class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700"
                                        >
                                            Sin items comprados en el rango
                                            actual.
                                        </div>
                                    </div>

                                    <div
                                        v-if="activeTab === 'work_orders'"
                                        class="space-y-3 p-4"
                                    >
                                        <div
                                            class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-slate-900/60"
                                        >
                                            <div>
                                                <h3
                                                    class="text-sm font-bold text-slate-900 dark:text-slate-100"
                                                >
                                                    Ordenes de trabajo del
                                                    cliente
                                                </h3>
                                                <p
                                                    class="text-xs text-slate-500"
                                                >
                                                    Taller operativo por
                                                    vehiculo y mecanico
                                                    asignado.
                                                </p>
                                            </div>
                                            <Link
                                                :href="createWorkOrderUrl()"
                                                class="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                                            >
                                                <Plus :size="15" />
                                                Nueva orden
                                            </Link>
                                        </div>

                                        <div
                                            v-if="workOrdersLoading"
                                            class="rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800"
                                        >
                                            Cargando ordenes...
                                        </div>

                                        <article
                                            v-for="workOrder in customerWorkOrders"
                                            v-else
                                            :key="workOrder.id"
                                            class="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                                        >
                                            <div
                                                class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
                                            >
                                                <div class="min-w-0">
                                                    <div
                                                        class="flex flex-wrap items-center gap-2"
                                                    >
                                                        <Link
                                                            :href="`/work-orders/${workOrder.id}`"
                                                            class="font-mono text-sm font-bold text-indigo-600 hover:underline dark:text-indigo-300"
                                                        >
                                                            {{
                                                                workOrder.folio
                                                            }}
                                                        </Link>
                                                        <span
                                                            class="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                                                        >
                                                            {{
                                                                workOrder.status
                                                            }}
                                                        </span>
                                                    </div>
                                                    <p
                                                        class="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100"
                                                    >
                                                        {{
                                                            workOrder
                                                                .customer_vehicle
                                                                ?.display_name ||
                                                            workOrder.vehicle_description ||
                                                            'Vehiculo no registrado'
                                                        }}
                                                    </p>
                                                    <p
                                                        class="mt-1 text-xs text-slate-500"
                                                    >
                                                        Mecanico:
                                                        {{
                                                            workOrder.assignee
                                                                ?.name ||
                                                            'Sin asignar'
                                                        }}
                                                        · Entrega:
                                                        {{
                                                            formatDate(
                                                                workOrder.estimated_delivery_at,
                                                            )
                                                        }}
                                                    </p>
                                                </div>
                                                <div
                                                    class="text-right text-sm font-bold text-slate-900 tabular-nums dark:text-slate-100"
                                                >
                                                    {{
                                                        formatCurrency(
                                                            workOrder.total_amount,
                                                        )
                                                    }}
                                                </div>
                                            </div>
                                        </article>

                                        <div
                                            v-if="
                                                !workOrdersLoading &&
                                                customerWorkOrders.length === 0
                                            "
                                            class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700"
                                        >
                                            Sin ordenes de trabajo para este
                                            cliente.
                                        </div>
                                    </div>

                                    <div
                                        v-if="activeTab === 'payments'"
                                        class="space-y-3 p-4"
                                    >
                                        <article
                                            v-for="payment in orderPayments"
                                            :key="payment.id"
                                            class="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[8rem_1fr_8rem_8rem] dark:border-slate-800 dark:bg-slate-900/60"
                                        >
                                            <div
                                                class="text-xs font-semibold text-slate-500"
                                            >
                                                {{
                                                    formatDateTime(
                                                        payment.paid_at,
                                                    )
                                                }}
                                            </div>
                                            <div
                                                class="flex flex-wrap items-center gap-2"
                                            >
                                                <span
                                                    class="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                                                >
                                                    <Banknote :size="13" />
                                                    {{ payment.method_label }}
                                                </span>
                                                <span
                                                    class="text-xs text-slate-500"
                                                >
                                                    {{
                                                        payment.notes ||
                                                        'Sin notas'
                                                    }}
                                                </span>
                                            </div>
                                            <Link
                                                :href="`/sales-orders/${payment.order.id}`"
                                                class="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                                            >
                                                {{ payment.order.order_number }}
                                            </Link>
                                            <span
                                                class="text-right text-sm font-bold text-emerald-600 tabular-nums dark:text-emerald-300"
                                            >
                                                {{
                                                    formatCurrency(
                                                        payment.amount,
                                                    )
                                                }}
                                            </span>
                                        </article>
                                        <div
                                            v-if="orderPayments.length === 0"
                                            class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700"
                                        >
                                            Sin pagos en el rango actual.
                                        </div>
                                    </div>

                                    <div
                                        v-if="activeTab === 'history'"
                                        class="space-y-3 p-4"
                                    >
                                        <article
                                            v-for="transaction in transactions"
                                            :key="transaction.id"
                                            class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-slate-900/60"
                                        >
                                            <div>
                                                <p
                                                    class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                                                >
                                                    {{
                                                        transactionTypeLabel(
                                                            transaction.type,
                                                        )
                                                    }}
                                                </p>
                                                <p
                                                    class="text-xs text-slate-500"
                                                >
                                                    {{
                                                        transaction.description ||
                                                        'Movimiento de cuenta'
                                                    }}
                                                    -
                                                    {{
                                                        formatDateTime(
                                                            transaction.transaction_date,
                                                        )
                                                    }}
                                                </p>
                                            </div>
                                            <div class="text-right">
                                                <p
                                                    class="text-sm font-bold tabular-nums"
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
                                                <p
                                                    class="text-xs text-slate-500"
                                                >
                                                    Saldo
                                                    {{
                                                        formatCurrency(
                                                            transaction.balance_after,
                                                        )
                                                    }}
                                                </p>
                                            </div>
                                        </article>
                                        <div
                                            class="flex items-center justify-end gap-2"
                                        >
                                            <button
                                                type="button"
                                                :disabled="
                                                    transactionsPage <= 1 ||
                                                    transactionsLoading
                                                "
                                                class="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                                                @click="
                                                    loadTransactions(
                                                        transactionsPage - 1,
                                                    )
                                                "
                                            >
                                                <ChevronLeft :size="15" />
                                            </button>
                                            <span
                                                class="text-xs text-slate-500"
                                            >
                                                Pagina {{ transactionsPage }} de
                                                {{ transactionsLastPage }}
                                            </span>
                                            <button
                                                type="button"
                                                :disabled="
                                                    transactionsPage >=
                                                        transactionsLastPage ||
                                                    transactionsLoading
                                                "
                                                class="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                                                @click="
                                                    loadTransactions(
                                                        transactionsPage + 1,
                                                    )
                                                "
                                            >
                                                <ChevronRight :size="15" />
                                            </button>
                                        </div>
                                    </div>

                                    <div
                                        v-if="activeTab === 'vehicles'"
                                        class="grid gap-4 p-4 xl:grid-cols-[1fr_22rem]"
                                    >
                                        <div class="grid gap-3 md:grid-cols-2">
                                            <article
                                                v-for="vehicle in customerVehicles"
                                                :key="vehicle.id"
                                                class="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                                            >
                                                <div
                                                    class="flex items-start gap-3"
                                                >
                                                    <div
                                                        class="flex size-11 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200"
                                                    >
                                                        <Car :size="21" />
                                                    </div>
                                                    <div class="min-w-0 flex-1">
                                                        <div
                                                            class="flex flex-wrap items-center gap-2"
                                                        >
                                                            <p
                                                                class="font-semibold text-slate-900 dark:text-slate-100"
                                                            >
                                                                {{
                                                                    vehiclePrimaryLabel(
                                                                        vehicle,
                                                                    )
                                                                }}
                                                            </p>
                                                            <span
                                                                class="rounded-md border px-2 py-0.5 text-xs font-semibold"
                                                                :class="
                                                                    vehicleStatusClass(
                                                                        vehicle.status,
                                                                    )
                                                                "
                                                            >
                                                                {{
                                                                    vehicleStatusLabel(
                                                                        vehicle.status,
                                                                    )
                                                                }}
                                                            </span>
                                                        </div>
                                                        <p
                                                            class="mt-1 font-mono text-xs text-slate-500"
                                                        >
                                                            VIN:
                                                            {{
                                                                vehicle.vin ||
                                                                '-'
                                                            }}
                                                        </p>
                                                        <p
                                                            class="text-xs text-slate-500"
                                                        >
                                                            Motor:
                                                            {{
                                                                vehicle.engine
                                                                    ?.engine_code ||
                                                                '-'
                                                            }}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div class="mt-4 flex gap-2">
                                                    <Link
                                                        :href="
                                                            createWorkOrderUrl(
                                                                vehicle,
                                                            )
                                                        "
                                                        class="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50 dark:border-sky-500/30 dark:bg-slate-950 dark:text-sky-200 dark:hover:bg-sky-500/10"
                                                    >
                                                        <Wrench :size="14" />
                                                        Nueva orden
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        class="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                                                        @click="
                                                            editVehicle(vehicle)
                                                        "
                                                    >
                                                        <Edit :size="14" />
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        class="inline-flex items-center justify-center rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:bg-slate-950 dark:hover:bg-rose-500/10"
                                                        @click="
                                                            removeVehicle(
                                                                vehicle,
                                                            )
                                                        "
                                                    >
                                                        <Trash2 :size="14" />
                                                    </button>
                                                </div>
                                            </article>
                                            <div
                                                v-if="
                                                    customerVehicles.length ===
                                                    0
                                                "
                                                class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700"
                                            >
                                                Sin carros registrados.
                                            </div>
                                        </div>

                                        <aside
                                            class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                                        >
                                            <div
                                                class="mb-4 flex items-center justify-between gap-2"
                                            >
                                                <h3
                                                    class="text-sm font-bold text-slate-900 dark:text-slate-100"
                                                >
                                                    {{
                                                        editingVehicleId
                                                            ? 'Editar carro'
                                                            : 'Agregar carro'
                                                    }}
                                                </h3>
                                                <button
                                                    v-if="editingVehicleId"
                                                    type="button"
                                                    class="text-xs font-semibold text-slate-500 hover:text-slate-900"
                                                    @click="resetVehicleForm"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                            <form
                                                class="space-y-3"
                                                @submit.prevent="saveVehicle"
                                            >
                                                <div
                                                    v-if="vehicleError"
                                                    class="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
                                                >
                                                    {{ vehicleError }}
                                                </div>
                                                <div>
                                                    <label
                                                        class="mb-1 block text-xs font-semibold text-slate-500 uppercase"
                                                    >
                                                        Marca
                                                    </label>
                                                    <select
                                                        v-model.number="
                                                            selectedMakeId
                                                        "
                                                        class="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                                        @change="
                                                            loadVehicleModels
                                                        "
                                                    >
                                                        <option :value="null">
                                                            Seleccionar
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
                                                        class="mb-1 block text-xs font-semibold text-slate-500 uppercase"
                                                    >
                                                        Modelo
                                                    </label>
                                                    <select
                                                        v-model.number="
                                                            vehicleForm.vehicle_model_id
                                                        "
                                                        class="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                                        @change="
                                                            loadVehicleConfiguration
                                                        "
                                                    >
                                                        <option :value="0">
                                                            Seleccionar
                                                        </option>
                                                        <option
                                                            v-for="model in vehicleModels"
                                                            :key="model.id"
                                                            :value="model.id"
                                                        >
                                                            {{ model.name }}
                                                        </option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label
                                                        class="mb-1 block text-xs font-semibold text-slate-500 uppercase"
                                                    >
                                                        Motor
                                                    </label>
                                                    <select
                                                        v-model.number="
                                                            vehicleForm.vehicle_engine_id
                                                        "
                                                        class="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                                    >
                                                        <option :value="0">
                                                            Seleccionar
                                                        </option>
                                                        <option
                                                            v-for="engine in vehicleEngines"
                                                            :key="engine.id"
                                                            :value="engine.id"
                                                        >
                                                            {{
                                                                engine.engine_code
                                                            }}
                                                            {{
                                                                engine.displacement ||
                                                                ''
                                                            }}
                                                        </option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label
                                                        class="mb-1 block text-xs font-semibold text-slate-500 uppercase"
                                                    >
                                                        VIN
                                                    </label>
                                                    <input
                                                        v-model="
                                                            vehicleForm.vin
                                                        "
                                                        class="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm uppercase dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                                    />
                                                </div>
                                                <button
                                                    type="submit"
                                                    class="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                                                    :disabled="!canSaveVehicle"
                                                >
                                                    <Plus :size="15" />
                                                    {{
                                                        vehicleSaving
                                                            ? 'Guardando...'
                                                            : 'Guardar carro'
                                                    }}
                                                </button>
                                            </form>
                                        </aside>
                                    </div>
                                </template>

                                <footer
                                    v-if="activeTab === 'invoices'"
                                    class="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800"
                                >
                                    <span class="text-xs text-slate-500">
                                        Pagina
                                        {{ historyMeta?.current_page ?? 1 }} de
                                        {{ historyMeta?.last_page ?? 1 }}
                                    </span>
                                    <div class="flex gap-2">
                                        <button
                                            type="button"
                                            :disabled="
                                                (historyMeta?.current_page ??
                                                    1) <= 1
                                            "
                                            class="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                                            @click="
                                                fetchSalesHistory(
                                                    (historyMeta?.current_page ??
                                                        1) - 1,
                                                )
                                            "
                                        >
                                            <ChevronLeft :size="15" />
                                        </button>
                                        <button
                                            type="button"
                                            :disabled="
                                                (historyMeta?.current_page ??
                                                    1) >=
                                                (historyMeta?.last_page ?? 1)
                                            "
                                            class="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                                            @click="
                                                fetchSalesHistory(
                                                    (historyMeta?.current_page ??
                                                        1) + 1,
                                                )
                                            "
                                        >
                                            <ChevronRight :size="15" />
                                        </button>
                                    </div>
                                </footer>
                            </section>
                        </main>

                        <aside
                            class="space-y-4 xl:sticky xl:top-20 xl:self-start"
                        >
                            <section
                                class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                            >
                                <h2
                                    class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                                >
                                    Resumen del Cliente
                                </h2>
                                <p class="mt-1 text-xs text-slate-500">
                                    {{ customer.name }} - {{ customer.code }}
                                </p>
                                <div
                                    class="mt-4 divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800"
                                >
                                    <div
                                        class="flex items-center justify-between gap-3 py-3"
                                    >
                                        <span
                                            class="inline-flex items-center gap-2 text-sm text-slate-500"
                                        >
                                            <Receipt :size="15" />
                                            Total Comprado
                                        </span>
                                        <span
                                            class="text-sm font-bold text-slate-900 tabular-nums dark:text-slate-100"
                                        >
                                            {{
                                                formatCurrency(
                                                    profileSummary?.total_purchased,
                                                )
                                            }}
                                        </span>
                                    </div>
                                    <div
                                        class="flex items-center justify-between gap-3 py-3"
                                    >
                                        <span
                                            class="inline-flex items-center gap-2 text-sm text-slate-500"
                                        >
                                            <FileText :size="15" />
                                            Total Facturas
                                        </span>
                                        <span
                                            class="text-sm font-bold text-slate-900 tabular-nums dark:text-slate-100"
                                        >
                                            {{
                                                profileSummary?.invoices_count ??
                                                0
                                            }}
                                        </span>
                                    </div>
                                    <div
                                        class="flex items-center justify-between gap-3 py-3"
                                    >
                                        <span
                                            class="inline-flex items-center gap-2 text-sm text-slate-500"
                                        >
                                            <CheckCircle :size="15" />
                                            Ticket Promedio
                                        </span>
                                        <span
                                            class="text-sm font-bold text-slate-900 tabular-nums dark:text-slate-100"
                                        >
                                            {{
                                                formatCurrency(
                                                    profileSummary?.average_ticket,
                                                )
                                            }}
                                        </span>
                                    </div>
                                    <div
                                        class="flex items-center justify-between gap-3 py-3"
                                    >
                                        <span
                                            class="inline-flex items-center gap-2 text-sm text-slate-500"
                                        >
                                            <CalendarDays :size="15" />
                                            Ultima Compra
                                        </span>
                                        <span
                                            class="text-sm font-bold text-slate-900 dark:text-slate-100"
                                        >
                                            {{
                                                formatDate(
                                                    profileSummary?.last_purchase_date,
                                                )
                                            }}
                                        </span>
                                    </div>
                                </div>
                                <div class="mt-5">
                                    <p
                                        class="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                    >
                                        Items Mas Comprados
                                    </p>
                                    <div class="space-y-3">
                                        <div
                                            v-for="item in profileSummary?.top_items ??
                                            []"
                                            :key="`${item.product_id}-${item.variant_id}-${item.name}`"
                                        >
                                            <div
                                                class="mb-1 flex justify-between gap-3 text-xs"
                                            >
                                                <span
                                                    class="truncate text-slate-700 dark:text-slate-200"
                                                >
                                                    {{ item.name }}
                                                </span>
                                                <span
                                                    class="shrink-0 text-slate-500"
                                                >
                                                    {{ item.quantity }} uds
                                                </span>
                                            </div>
                                            <div
                                                class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"
                                            >
                                                <div
                                                    class="h-full rounded-full bg-indigo-600"
                                                    :style="{
                                                        width: `${Math.min(100, item.quantity * 12)}%`,
                                                    }"
                                                />
                                            </div>
                                        </div>
                                        <p
                                            v-if="
                                                (
                                                    profileSummary?.top_items ??
                                                    []
                                                ).length === 0
                                            "
                                            class="text-sm text-slate-500"
                                        >
                                            Sin items registrados.
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    v-if="profileSummary"
                                    :href="`/reports/sales-by-client?customer_id=${customerIdNumber}`"
                                    class="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                                >
                                    Ver analisis completo
                                    <ChevronRight :size="15" />
                                </Link>
                            </section>

                            <section
                                class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                            >
                                <h2
                                    class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                                >
                                    Ultimos Pagos
                                </h2>
                                <div class="mt-4 space-y-3">
                                    <div
                                        v-for="payment in profileSummary?.recent_payments ??
                                        []"
                                        :key="payment.id"
                                        class="rounded-md bg-slate-50 p-3 dark:bg-slate-900"
                                    >
                                        <div class="flex justify-between gap-3">
                                            <Link
                                                :href="`/sales-orders/${payment.order_id}`"
                                                class="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                                            >
                                                {{ payment.order_number }}
                                            </Link>
                                            <span
                                                class="text-xs font-bold text-emerald-600 tabular-nums dark:text-emerald-300"
                                            >
                                                {{
                                                    formatCurrency(
                                                        payment.amount,
                                                    )
                                                }}
                                            </span>
                                        </div>
                                        <p class="mt-1 text-xs text-slate-500">
                                            {{ payment.method_label }} -
                                            {{
                                                formatDateTime(payment.paid_at)
                                            }}
                                        </p>
                                    </div>
                                    <p
                                        v-if="
                                            (
                                                profileSummary?.recent_payments ??
                                                []
                                            ).length === 0
                                        "
                                        class="text-sm text-slate-500"
                                    >
                                        Sin pagos recientes.
                                    </p>
                                </div>
                            </section>
                        </aside>
                    </div>
                </template>
            </div>
        </div>

        <div
            v-if="showAdjustModal"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            @click.self="showAdjustModal = false"
        >
            <div
                class="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-slate-950"
            >
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h3
                            class="text-lg font-bold text-slate-900 dark:text-slate-100"
                        >
                            Ajustar saldo
                        </h3>
                        <p class="mt-1 text-sm text-slate-500">
                            Registra un ajuste manual en la cuenta del cliente.
                        </p>
                    </div>
                    <button
                        type="button"
                        class="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
                        @click="showAdjustModal = false"
                    >
                        <X :size="18" />
                    </button>
                </div>
                <form
                    class="mt-4 space-y-4"
                    @submit.prevent="handleAdjustBalance"
                >
                    <div>
                        <label
                            class="mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
                        >
                            Monto
                        </label>
                        <input
                            v-model.number="adjustForm.amount"
                            type="number"
                            step="0.01"
                            class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            required
                        />
                    </div>
                    <div>
                        <label
                            class="mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
                        >
                            Motivo
                        </label>
                        <textarea
                            v-model="adjustForm.reason"
                            rows="3"
                            class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            required
                        />
                    </div>
                    <div class="flex justify-end gap-2">
                        <button
                            type="button"
                            class="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                            @click="showAdjustModal = false"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            :disabled="adjustLoading"
                        >
                            {{
                                adjustLoading
                                    ? 'Guardando...'
                                    : 'Guardar ajuste'
                            }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </AppLayout>
</template>
