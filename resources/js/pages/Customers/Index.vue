<script setup lang="ts">
import { Head, Link, usePage } from '@inertiajs/vue3';
import {
    Download,
    Eye,
    Pencil,
    Plus,
    Search,
    Trash2,
    Upload,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import CustomerDialog from '@/components/Customers/CustomerDialog.vue';
import Pagination from '@/components/Pagination.vue';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useCustomers } from '@/composables/useCustomers';
import {
    useVehicleCatalog,
    type VehicleConfigurationRow,
    type VehicleCatalogSummary,
} from '@/composables/useVehicleCatalog';
import AppLayout from '@/layouts/AppLayout.vue';
import { CustomersApiService } from '@/services/customers';
import type { Customer, CustomerType } from '@/types/customer';
import { canManageCatalog } from '@/utils/catalogPermissions';

const page = usePage();
const currentRole = computed(() => (page.props.auth?.user as any)?.role);
const canManageCustomers = computed(() => canManageCatalog(currentRole.value));
const canManageTypes = computed(() => canManageCatalog(currentRole.value));
const {
    customers,
    loading,
    error,
    filters,
    currentPage,
    lastPage,
    total,
    perPage,
    fetchCustomers,
    deleteCustomer,
    applyFilters,
} = useCustomers();
const activeTab = ref<'customers' | 'vehicles' | 'types'>('customers');
const vehicleCatalog = useVehicleCatalog();
const vehicleSummary = ref<VehicleCatalogSummary>({
    makes: 0,
    engines: 0,
    models: 0,
    vehicles: 0,
});
const vehicleRows = ref<VehicleConfigurationRow[]>([]);
const vehicleLoading = ref(false);
const customerTypes = ref<CustomerType[]>([]);
const customerDialogOpen = ref(false);
const editingCustomer = ref<Customer | null>(null);
const typeDialogOpen = ref(false);
const editingType = ref<CustomerType | null>(null);
const selectedCustomers = ref<number[]>([]);
const selectedTypes = ref<number[]>([]);
const typeForm = ref({
    name: '',
    base_kind: 'individual' as 'individual' | 'business',
    is_active: true,
});
const typeError = ref<string | null>(null);
const typeSaving = ref(false);
const pagination = computed(() => ({
    current_page: currentPage.value,
    last_page: lastPage.value,
    per_page: perPage.value,
    total: total.value,
}));
const money = (value: number) => `$${Number(value || 0).toFixed(2)}`;

async function loadTypes() {
    const response = await CustomersApiService.getCustomerTypes();
    customerTypes.value = response.data.data;
}

function setUrl(action?: string, id?: number) {
    const url = new URL(window.location.href);
    if (action) url.searchParams.set('action', action);
    else url.searchParams.delete('action');
    if (id) url.searchParams.set('id', String(id));
    else url.searchParams.delete('id');
    window.history.replaceState({}, '', url);
}
function selectTab(tab: 'customers' | 'vehicles' | 'types') {
    activeTab.value = tab;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url);
    if (tab === 'vehicles' && vehicleRows.value.length === 0) loadVehicles();
}
async function loadVehicles() {
    vehicleLoading.value = true;
    try {
        const [summary, rows] = await Promise.all([
            vehicleCatalog.fetchSummary(),
            vehicleCatalog.fetchRows<VehicleConfigurationRow>('vehicles', {
                page: 1,
                per_page: 15,
                search: '',
                sort: 'model',
                direction: 'asc',
            }),
        ]);
        vehicleSummary.value = summary;
        vehicleRows.value = rows.data;
    } finally {
        vehicleLoading.value = false;
    }
}
function openCreate() {
    editingCustomer.value = null;
    customerDialogOpen.value = true;
    setUrl('create');
}
function openEdit(customer: Customer) {
    editingCustomer.value = customer;
    customerDialogOpen.value = true;
    setUrl('edit', customer.id);
}
function closeCustomerDialog(value: boolean) {
    customerDialogOpen.value = value;
    if (!value) setUrl();
}
async function customerSaved() {
    await Promise.all([fetchCustomers(currentPage.value), loadTypes()]);
}
async function bulkCustomers(action: 'delete' | 'deactivate') {
    if (
        !canManageCustomers.value ||
        selectedCustomers.value.length === 0 ||
        !confirm(
            `¿Aplicar la acción a ${selectedCustomers.value.length} cliente(s)?`,
        )
    )
        return;
    try {
        await CustomersApiService.bulkCustomers(
            action,
            selectedCustomers.value,
        );
        selectedCustomers.value = [];
        await customerSaved();
    } catch (exception: any) {
        alert(
            exception.response?.data?.message ?? 'No se aplicó ningún cambio.',
        );
    }
}
async function bulkTypes(action: 'delete' | 'deactivate') {
    if (
        !canManageTypes.value ||
        selectedTypes.value.length === 0 ||
        !confirm(`¿Aplicar la acción a ${selectedTypes.value.length} tipo(s)?`)
    )
        return;
    try {
        await CustomersApiService.bulkCustomerTypes(
            action,
            selectedTypes.value,
        );
        selectedTypes.value = [];
        await loadTypes();
    } catch (exception: any) {
        alert(
            exception.response?.data?.message ?? 'No se aplicó ningún cambio.',
        );
    }
}
async function removeCustomer(customer: Customer) {
    if (!canManageCustomers.value) return;
    if (!customer.can_delete) {
        alert(
            customer.delete_block_reason ??
                'Desactiva este cliente para conservar su historial.',
        );
        return;
    }
    if (confirm(`¿Eliminar a ${customer.name}?`))
        await deleteCustomer(customer.id);
}
function openType(type?: CustomerType) {
    editingType.value = type ?? null;
    typeForm.value = {
        name: type?.name ?? '',
        base_kind: type?.base_kind ?? 'individual',
        is_active: type?.is_active ?? true,
    };
    typeError.value = null;
    typeDialogOpen.value = true;
}
async function saveType() {
    typeSaving.value = true;
    typeError.value = null;
    try {
        if (editingType.value)
            await CustomersApiService.updateCustomerType(
                editingType.value.id,
                typeForm.value,
            );
        else await CustomersApiService.createCustomerType(typeForm.value);
        typeDialogOpen.value = false;
        await loadTypes();
    } catch (exception: any) {
        typeError.value =
            exception.response?.data?.errors?.name?.[0] ??
            exception.response?.data?.message ??
            'No se pudo guardar.';
    } finally {
        typeSaving.value = false;
    }
}
async function removeType(type: CustomerType) {
    if (!confirm(`¿Eliminar el tipo ${type.name}?`)) return;
    try {
        await CustomersApiService.deleteCustomerType(type.id);
        await loadTypes();
    } catch (exception: any) {
        alert(
            exception.response?.data?.message ??
                'No se puede eliminar este tipo.',
        );
    }
}
onMounted(async () => {
    await Promise.all([fetchCustomers(), loadTypes()]);
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get('tab');
    if (requestedTab === 'vehicles' || requestedTab === 'types')
        selectTab(requestedTab);
    const action = params.get('action');
    const id = Number(params.get('id'));
    if (action === 'create') openCreate();
    if (action === 'edit' && id) {
        let customer = customers.value.find((item) => item.id === id) ?? null;
        if (!customer)
            customer = (await CustomersApiService.getCustomer(id)).data
                .customer;
        openEdit(customer);
    }
});
</script>

<template>
    <Head title="Clientes" />
    <AppLayout :breadcrumbs="[{ title: 'Clientes', href: '/customers' }]">
        <div class="space-y-5 p-1">
            <header
                class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
                <div>
                    <h1 class="text-2xl font-bold">Clientes</h1>
                    <p class="text-sm text-muted-foreground">
                        Clientes, crédito y vehículos asociados.
                    </p>
                </div>
                <div
                    class="flex flex-wrap gap-2"
                    v-if="activeTab === 'customers'"
                >
                    <Link
                        v-if="canManageCustomers"
                        href="/customers/import"
                        class="inline-flex items-center gap-2 rounded-md border px-3 py-2"
                        ><Upload :size="17" /> Importar</Link
                    >
                    <button
                        class="inline-flex items-center gap-2 rounded-md border px-3 py-2"
                        @click="CustomersApiService.exportCustomers()"
                    >
                        <Download :size="17" /> Exportar
                    </button>
                    <button
                        class="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground"
                        @click="openCreate"
                    >
                        <Plus :size="18" /> Nuevo cliente
                    </button>
                </div>
                <button
                    v-else-if="canManageTypes"
                    class="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground"
                    @click="openType()"
                >
                    <Plus :size="18" /> Nuevo tipo
                </button>
            </header>
            <div class="flex gap-1 rounded-lg border bg-muted/30 p-1">
                <button
                    class="rounded-md px-4 py-2 text-sm"
                    :class="
                        activeTab === 'customers'
                            ? 'bg-background shadow-sm'
                            : ''
                    "
                    @click="selectTab('customers')"
                >
                    Clientes
                    <span class="ml-1 text-muted-foreground">{{ total }}</span>
                </button>
                <button
                    class="rounded-md px-4 py-2 text-sm"
                    :class="
                        activeTab === 'vehicles'
                            ? 'bg-background shadow-sm'
                            : ''
                    "
                    @click="selectTab('vehicles')"
                >
                    Vehículos
                    <span class="ml-1 text-muted-foreground">{{
                        vehicleSummary.vehicles
                    }}</span>
                </button>
                <button
                    class="rounded-md px-4 py-2 text-sm"
                    :class="
                        activeTab === 'types' ? 'bg-background shadow-sm' : ''
                    "
                    @click="selectTab('types')"
                >
                    Tipos
                    <span class="ml-1 text-muted-foreground">{{
                        customerTypes.length
                    }}</span>
                </button>
            </div>
            <template v-if="activeTab === 'customers'">
                <div
                    v-if="canManageCustomers && selectedCustomers.length"
                    class="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm"
                >
                    <span>{{ selectedCustomers.length }} seleccionado(s)</span>
                    <button
                        class="rounded-md border px-3 py-1.5"
                        @click="bulkCustomers('deactivate')"
                    >
                        Desactivar
                    </button>
                    <button
                        class="rounded-md border border-destructive/40 px-3 py-1.5 text-destructive"
                        @click="bulkCustomers('delete')"
                    >
                        Eliminar
                    </button>
                </div>
                <div
                    class="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row"
                >
                    <div class="relative flex-1">
                        <Search
                            class="absolute top-2.5 left-3 text-muted-foreground"
                            :size="18"
                        /><input
                            v-model="filters.search"
                            class="w-full rounded-md border bg-background py-2 pr-3 pl-10"
                            placeholder="Nombre, empresa, RUC, VIN o placa"
                            @keyup.enter="applyFilters"
                        />
                    </div>
                    <select
                        v-model="filters.customer_type_id"
                        class="rounded-md border bg-background px-3 py-2"
                        @change="applyFilters"
                    >
                        <option :value="undefined">Todos los tipos</option>
                        <option
                            v-for="type in customerTypes"
                            :key="type.id"
                            :value="type.id"
                        >
                            {{ type.name }}
                        </option>
                    </select>
                    <button
                        class="rounded-md border px-4 py-2"
                        :disabled="loading"
                        @click="applyFilters"
                    >
                        Buscar
                    </button>
                </div>
                <div
                    v-if="error"
                    class="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive"
                >
                    {{ error }}
                </div>
                <div class="overflow-hidden rounded-lg border bg-card">
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead
                                class="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase"
                            >
                                <tr>
                                    <th
                                        v-if="canManageCustomers"
                                        class="w-10 px-4 py-3"
                                    >
                                        <span class="sr-only">Seleccionar</span>
                                    </th>
                                    <th class="px-4 py-3">Cliente</th>
                                    <th class="px-4 py-3">Tipo</th>
                                    <th class="px-4 py-3">Contacto</th>
                                    <th class="px-4 py-3">Vehículos</th>
                                    <th class="px-4 py-3 text-right">Saldo</th>
                                    <th class="px-4 py-3 text-right">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
                                <tr v-if="loading">
                                    <td
                                        :colspan="canManageCustomers ? 7 : 6"
                                        class="px-4 py-10 text-center text-muted-foreground"
                                    >
                                        Cargando...
                                    </td>
                                </tr>
                                <tr v-else-if="customers.length === 0">
                                    <td
                                        :colspan="canManageCustomers ? 7 : 6"
                                        class="px-4 py-10 text-center text-muted-foreground"
                                    >
                                        No se encontraron clientes.
                                    </td>
                                </tr>
                                <tr
                                    v-for="customer in customers"
                                    v-else
                                    :key="customer.id"
                                    class="hover:bg-muted/30"
                                >
                                    <td
                                        v-if="canManageCustomers"
                                        class="px-4 py-3"
                                    >
                                        <input
                                            v-model="selectedCustomers"
                                            type="checkbox"
                                            :value="customer.id"
                                            :aria-label="`Seleccionar ${customer.name}`"
                                        />
                                    </td>
                                    <td class="px-4 py-3">
                                        <Link
                                            :href="`/customers/${customer.id}`"
                                            class="font-semibold hover:underline"
                                            >{{ customer.name }}</Link
                                        >
                                        <p
                                            class="text-xs text-muted-foreground"
                                        >
                                            {{
                                                customer.tax_name ||
                                                customer.tax_id ||
                                                customer.code
                                            }}
                                        </p>
                                    </td>
                                    <td class="px-4 py-3">
                                        {{
                                            customer.customer_type?.name ||
                                            (customer.type === 'business'
                                                ? 'Empresa'
                                                : 'Individual')
                                        }}
                                    </td>
                                    <td class="px-4 py-3">
                                        <p>{{ customer.phone || '-' }}</p>
                                        <p
                                            class="text-xs text-muted-foreground"
                                        >
                                            {{ customer.email || '-' }}
                                        </p>
                                    </td>
                                    <td class="px-4 py-3">
                                        {{
                                            customer.vehicles?.filter(
                                                (v) => v.status === 'active',
                                            ).length || 0
                                        }}
                                        asociado(s)
                                    </td>
                                    <td
                                        class="px-4 py-3 text-right font-mono"
                                        :class="
                                            customer.current_balance > 0
                                                ? 'text-destructive'
                                                : ''
                                        "
                                    >
                                        {{ money(customer.current_balance) }}
                                    </td>
                                    <td class="px-4 py-3">
                                        <div class="flex justify-end gap-1">
                                            <Link
                                                :href="`/customers/${customer.id}`"
                                                class="rounded-md p-2 hover:bg-muted"
                                                ><Eye :size="16" /></Link
                                            ><button
                                                class="rounded-md p-2 hover:bg-muted"
                                                @click="openEdit(customer)"
                                            >
                                                <Pencil :size="16" /></button
                                            ><button
                                                v-if="canManageCustomers"
                                                class="rounded-md p-2 text-destructive hover:bg-destructive/10"
                                                :title="
                                                    customer.delete_block_reason ||
                                                    'Eliminar'
                                                "
                                                @click="
                                                    removeCustomer(customer)
                                                "
                                            >
                                                <Trash2 :size="16" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        v-if="lastPage > 1"
                        :pagination="pagination"
                        :loading="loading"
                        @page-change="fetchCustomers"
                    />
                </div>
            </template>
            <div
                v-else-if="activeTab === 'vehicles'"
                class="overflow-hidden rounded-lg border bg-card"
            >
                <div class="flex items-center justify-between border-b p-4">
                    <div>
                        <h2 class="font-semibold">
                            Catálogo compartido de vehículos
                        </h2>
                        <p class="text-sm text-muted-foreground">
                            Configuraciones reales usadas por clientes, ventas y
                            compatibilidades.
                        </p>
                    </div>
                    <Link
                        href="/vehicles"
                        class="rounded-md border px-3 py-2 text-sm"
                        >Abrir administrador</Link
                    >
                </div>
                <div
                    v-if="vehicleLoading"
                    class="p-10 text-center text-muted-foreground"
                >
                    Cargando vehículos...
                </div>
                <div v-else class="divide-y">
                    <div
                        v-for="row in vehicleRows"
                        :key="row.key"
                        class="grid gap-2 p-4 sm:grid-cols-[1fr_1fr_auto]"
                    >
                        <div>
                            <p class="font-medium">
                                {{ row.make.name }} · {{ row.model.name }}
                            </p>
                            <p class="text-xs text-muted-foreground">
                                {{ row.model.year_from }}–{{
                                    row.model.year_to
                                }}
                                {{ row.model.generation || '' }}
                            </p>
                        </div>
                        <div>
                            <p>{{ row.engine.engine_code }}</p>
                            <p class="text-xs text-muted-foreground">
                                {{
                                    row.engine.displacement || 'Sin cilindrada'
                                }}
                            </p>
                        </div>
                        <span class="text-sm text-muted-foreground"
                            >{{ row.vins_count }} VIN</span
                        >
                    </div>
                    <p
                        v-if="vehicleRows.length === 0"
                        class="p-10 text-center text-muted-foreground"
                    >
                        No hay configuraciones registradas.
                    </p>
                </div>
            </div>
            <div v-else class="space-y-3">
                <div
                    v-if="canManageTypes && selectedTypes.length"
                    class="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm"
                >
                    <span>{{ selectedTypes.length }} seleccionado(s)</span>
                    <button
                        class="rounded-md border px-3 py-1.5"
                        @click="bulkTypes('deactivate')"
                    >
                        Desactivar
                    </button>
                    <button
                        class="rounded-md border border-destructive/40 px-3 py-1.5 text-destructive"
                        @click="bulkTypes('delete')"
                    >
                        Eliminar
                    </button>
                </div>
                <div class="overflow-hidden rounded-lg border bg-card">
                    <table class="w-full text-sm">
                        <thead
                            class="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase"
                        >
                            <tr>
                                <th
                                    v-if="canManageTypes"
                                    class="w-10 px-4 py-3"
                                >
                                    <span class="sr-only">Seleccionar</span>
                                </th>
                                <th class="px-4 py-3">Tipo</th>
                                <th class="px-4 py-3">Clasificación</th>
                                <th class="px-4 py-3">Clientes</th>
                                <th class="px-4 py-3">Estado</th>
                                <th class="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            <tr v-for="type in customerTypes" :key="type.id">
                                <td v-if="canManageTypes" class="px-4 py-3">
                                    <input
                                        v-model="selectedTypes"
                                        type="checkbox"
                                        :value="type.id"
                                        :aria-label="`Seleccionar ${type.name}`"
                                    />
                                </td>
                                <td class="px-4 py-3 font-medium">
                                    {{ type.name }}
                                </td>
                                <td class="px-4 py-3">
                                    {{
                                        type.base_kind === 'business'
                                            ? 'Empresa'
                                            : 'Persona'
                                    }}
                                </td>
                                <td class="px-4 py-3">
                                    {{ type.customers_count || 0 }}
                                </td>
                                <td class="px-4 py-3">
                                    {{ type.is_active ? 'Activo' : 'Inactivo' }}
                                </td>
                                <td class="px-4 py-3">
                                    <div
                                        v-if="canManageTypes"
                                        class="flex justify-end gap-1"
                                    >
                                        <button
                                            class="rounded-md p-2 hover:bg-muted"
                                            @click="openType(type)"
                                        >
                                            <Pencil :size="16" /></button
                                        ><button
                                            class="rounded-md p-2 text-destructive"
                                            @click="removeType(type)"
                                        >
                                            <Trash2 :size="16" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <CustomerDialog
            :open="customerDialogOpen"
            :customer="editingCustomer"
            :customer-types="customerTypes"
            @update:open="closeCustomerDialog"
            @saved="customerSaved"
        />
        <Dialog v-model:open="typeDialogOpen"
            ><DialogContent
                ><DialogHeader
                    ><DialogTitle>{{
                        editingType ? 'Editar tipo' : 'Nuevo tipo'
                    }}</DialogTitle></DialogHeader
                >
                <form class="space-y-4" @submit.prevent="saveType">
                    <div v-if="typeError" class="text-sm text-destructive">
                        {{ typeError }}
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Nombre</label
                        ><input
                            v-model="typeForm.name"
                            required
                            class="w-full rounded-md border bg-background px-3 py-2"
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Clasificación base</label
                        ><select
                            v-model="typeForm.base_kind"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        >
                            <option value="individual">Persona</option>
                            <option value="business">Empresa</option>
                        </select>
                    </div>
                    <label
                        v-if="editingType"
                        class="flex items-center gap-2 text-sm"
                        ><input v-model="typeForm.is_active" type="checkbox" />
                        Activo</label
                    ><DialogFooter
                        ><button
                            type="button"
                            class="rounded-md border px-4 py-2"
                            @click="typeDialogOpen = false"
                        >
                            Cancelar</button
                        ><button
                            type="submit"
                            class="rounded-md bg-primary px-4 py-2 text-primary-foreground"
                            :disabled="typeSaving"
                        >
                            {{ typeSaving ? 'Guardando...' : 'Guardar' }}
                        </button></DialogFooter
                    >
                </form></DialogContent
            ></Dialog
        >
    </AppLayout>
</template>
