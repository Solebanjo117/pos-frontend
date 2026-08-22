<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { Plus, Trash2 } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import {
    Dialog,
    DialogFooter,
    DialogHeader,
    DialogScrollContent,
    DialogTitle,
} from '@/components/ui/dialog';
import apiClient from '@/services/api/client';
import { CustomersApiService } from '@/services/customers';
import type {
    Customer,
    CustomerFormData,
    CustomerType,
    CustomerVehicleFormData,
} from '@/types/customer';

interface VehicleRow extends CustomerVehicleFormData {
    requestVersion: number;
    make_id: number | null;
    models: Array<{
        id: number;
        name: string;
        year_from?: number;
        year_to?: number;
    }>;
    engines: Array<{ id: number; engine_code: string }>;
    chassisOptions: Array<{ id: number; code: string }>;
}

const props = defineProps<{
    open: boolean;
    customer?: Customer | null;
    customerTypes: CustomerType[];
}>();
const emit = defineEmits<{
    'update:open': [value: boolean];
    saved: [customer: Customer];
}>();

const saving = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});
const makes = ref<Array<{ id: number; name: string }>>([]);
const vehicles = ref<VehicleRow[]>([]);
const form = ref<CustomerFormData>({
    customer_type_id: 0,
    name: '',
    tax_name: '',
    tax_id: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    country: 'Panamá',
    credit_limit: 0,
    credit_days: 0,
    notes: '',
    status: 'active',
});

const title = computed(() =>
    props.customer ? 'Editar cliente' : 'Nuevo cliente',
);
const activeTypes = computed(() =>
    props.customerTypes.filter(
        (type) =>
            type.is_active || type.id === props.customer?.customer_type_id,
    ),
);

const emptyVehicle = (): VehicleRow => ({
    requestVersion: 0,
    make_id: null,
    vehicle_model_id: 0,
    vehicle_chassis_id: null,
    vehicle_engine_id: 0,
    vehicle_vin_id: null,
    vin: null,
    year: null,
    plate_number: null,
    notes: null,
    status: 'active',
    models: [],
    engines: [],
    chassisOptions: [],
});

async function loadMakes() {
    const response = await apiClient.get('/vehicle-makes/all');
    makes.value = response.data.data ?? response.data ?? [];
}

async function loadModels(row: VehicleRow, preserve = false) {
    const version = ++row.requestVersion;
    row.models = [];
    row.engines = [];
    row.chassisOptions = [];
    if (!preserve) {
        row.vehicle_model_id = 0;
        row.vehicle_engine_id = 0;
        row.vehicle_chassis_id = null;
    }
    if (!row.make_id) return;
    const response = await apiClient.get(
        `/vehicle-makes/${row.make_id}/models`,
    );
    if (version !== row.requestVersion) return;
    row.models = response.data.data ?? response.data ?? [];
}

async function loadConfiguration(row: VehicleRow, preserve = false) {
    const version = ++row.requestVersion;
    row.engines = [];
    row.chassisOptions = [];
    if (!preserve) {
        row.vehicle_engine_id = 0;
        row.vehicle_chassis_id = null;
    }
    if (!row.vehicle_model_id) return;
    const [engines, chassis] = await Promise.all([
        apiClient.get(`/vehicle-models/${row.vehicle_model_id}/engines`),
        apiClient.get(`/vehicle-models/${row.vehicle_model_id}/chassis`),
    ]);
    if (version !== row.requestVersion) return;
    row.engines = engines.data.data ?? engines.data ?? [];
    row.chassisOptions = chassis.data.data ?? chassis.data ?? [];
}

async function hydrate() {
    loading.value = true;
    error.value = null;
    fieldErrors.value = {};
    try {
        await loadMakes();
        const customer = props.customer;
        form.value = {
            customer_type_id:
                customer?.customer_type_id ?? activeTypes.value[0]?.id ?? 0,
            name: customer?.name ?? '',
            tax_name: customer?.tax_name ?? '',
            tax_id: customer?.tax_id ?? '',
            phone: customer?.phone ?? '',
            email: customer?.email ?? '',
            address: customer?.address ?? '',
            city: customer?.city ?? '',
            country: customer?.country ?? 'Panamá',
            credit_limit: customer?.credit_limit ?? 0,
            credit_days: customer?.credit_days ?? 0,
            notes: customer?.notes ?? '',
            status: customer?.status ?? 'active',
        };
        vehicles.value = (customer?.vehicles ?? [])
            .filter((vehicle) => vehicle.status === 'active')
            .map((vehicle) => ({
                ...emptyVehicle(),
                id: vehicle.id,
                make_id: vehicle.model?.make?.id ?? vehicle.make?.id ?? null,
                vehicle_model_id: vehicle.vehicle_model_id,
                vehicle_chassis_id: vehicle.vehicle_chassis_id,
                vehicle_engine_id: vehicle.vehicle_engine_id,
                vehicle_vin_id: vehicle.vehicle_vin_id,
                vin: vehicle.vin,
                year: vehicle.year,
                plate_number: vehicle.plate_number,
                notes: vehicle.notes,
            }));
        for (const row of vehicles.value) {
            await loadModels(row, true);
            await loadConfiguration(row, true);
        }
    } catch (exception: any) {
        error.value =
            exception.response?.data?.message ??
            'No se pudo cargar el formulario.';
    } finally {
        loading.value = false;
    }
}

function addVehicle() {
    vehicles.value.push(emptyVehicle());
}

function removeVehicle(index: number) {
    vehicles.value.splice(index, 1);
}

async function submit() {
    if (
        !form.value.name ||
        !form.value.customer_type_id ||
        saving.value ||
        vehicles.value.some(
            (vehicle) =>
                !vehicle.vehicle_model_id || !vehicle.vehicle_engine_id,
        )
    )
        return;
    saving.value = true;
    error.value = null;
    fieldErrors.value = {};
    const payload: CustomerFormData = {
        ...form.value,
        sync_vehicles: true,
        vehicles: vehicles.value.map((vehicle) => ({
            id: vehicle.id,
            vehicle_model_id: vehicle.vehicle_model_id,
            vehicle_chassis_id: vehicle.vehicle_chassis_id,
            vehicle_engine_id: vehicle.vehicle_engine_id,
            vehicle_vin_id: vehicle.vehicle_vin_id,
            vin: vehicle.vin,
            year: vehicle.year,
            plate_number: vehicle.plate_number,
            notes: vehicle.notes,
            status: vehicle.status,
        })),
    };
    try {
        const response = props.customer
            ? await CustomersApiService.updateCustomer(
                  props.customer.id,
                  payload,
              )
            : await CustomersApiService.createCustomer(payload);
        emit('saved', response.data);
        emit('update:open', false);
    } catch (exception: any) {
        fieldErrors.value = exception.response?.data?.errors ?? {};
        error.value =
            exception.response?.data?.message ??
            'No se pudo guardar el cliente.';
    } finally {
        saving.value = false;
    }
}

watch(
    () => props.open,
    (open) => {
        if (open) void hydrate();
    },
);
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogScrollContent class="max-h-[92vh] max-w-4xl">
            <DialogHeader>
                <DialogTitle>{{ title }}</DialogTitle>
            </DialogHeader>

            <div
                v-if="loading"
                class="py-10 text-center text-sm text-muted-foreground"
            >
                Cargando...
            </div>
            <form v-else class="space-y-6" @submit.prevent="submit">
                <div
                    v-if="error"
                    class="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                >
                    {{ error }}
                </div>

                <section class="grid gap-4 md:grid-cols-2">
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Nombre *</label
                        >
                        <input
                            v-model="form.name"
                            class="w-full rounded-md border bg-background px-3 py-2"
                            required
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Tipo de cliente *</label
                        >
                        <select
                            v-model.number="form.customer_type_id"
                            class="w-full rounded-md border bg-background px-3 py-2"
                            required
                        >
                            <option :value="0" disabled>Selecciona...</option>
                            <option
                                v-for="type in activeTypes"
                                :key="type.id"
                                :value="type.id"
                            >
                                {{ type.name }}
                            </option>
                        </select>
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Empresa / razón social</label
                        >
                        <input
                            v-model="form.tax_name"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >RUC</label
                        >
                        <input
                            v-model="form.tax_id"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Teléfono</label
                        >
                        <input
                            v-model="form.phone"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Email</label
                        >
                        <input
                            v-model="form.email"
                            type="email"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        />
                    </div>
                    <div class="md:col-span-2">
                        <label class="mb-1 block text-sm font-medium"
                            >Dirección</label
                        >
                        <textarea
                            v-model="form.address"
                            rows="2"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        />
                    </div>
                </section>

                <section class="space-y-3 border-t pt-5">
                    <div
                        class="flex flex-wrap items-center justify-between gap-2"
                    >
                        <div>
                            <h3 class="font-semibold">Vehículos asociados</h3>
                            <p class="text-xs text-muted-foreground">
                                Selecciona configuraciones del catálogo real de
                                HermeX.
                            </p>
                        </div>
                        <div class="flex gap-2">
                            <Link
                                href="/vehicles"
                                class="rounded-md border px-3 py-2 text-xs font-medium"
                                >Administrar catálogo</Link
                            >
                            <button
                                type="button"
                                class="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-medium"
                                @click="addVehicle"
                            >
                                <Plus :size="14" /> Agregar
                            </button>
                        </div>
                    </div>

                    <div
                        v-for="(vehicle, index) in vehicles"
                        :key="vehicle.id ?? `new-${index}`"
                        class="space-y-3 rounded-lg border p-4"
                    >
                        <div class="grid gap-3 md:grid-cols-3">
                            <select
                                v-model.number="vehicle.make_id"
                                class="rounded-md border bg-background px-3 py-2"
                                @change="loadModels(vehicle)"
                            >
                                <option :value="null">Marca...</option>
                                <option
                                    v-for="make in makes"
                                    :key="make.id"
                                    :value="make.id"
                                >
                                    {{ make.name }}
                                </option>
                            </select>
                            <select
                                v-model.number="vehicle.vehicle_model_id"
                                class="rounded-md border bg-background px-3 py-2"
                                :disabled="!vehicle.make_id"
                                @change="loadConfiguration(vehicle)"
                            >
                                <option :value="0">Modelo...</option>
                                <option
                                    v-for="model in vehicle.models"
                                    :key="model.id"
                                    :value="model.id"
                                >
                                    {{ model.name }} ({{ model.year_from }}-{{
                                        model.year_to
                                    }})
                                </option>
                            </select>
                            <select
                                v-model.number="vehicle.vehicle_engine_id"
                                class="rounded-md border bg-background px-3 py-2"
                                :disabled="!vehicle.vehicle_model_id"
                            >
                                <option :value="0">Motor...</option>
                                <option
                                    v-for="engine in vehicle.engines"
                                    :key="engine.id"
                                    :value="engine.id"
                                >
                                    {{ engine.engine_code }}
                                </option>
                            </select>
                            <select
                                v-model.number="vehicle.vehicle_chassis_id"
                                class="rounded-md border bg-background px-3 py-2"
                                :disabled="
                                    !vehicle.vehicle_model_id ||
                                    vehicle.chassisOptions.length === 0
                                "
                            >
                                <option :value="null">
                                    Chasis opcional...
                                </option>
                                <option
                                    v-for="chassis in vehicle.chassisOptions"
                                    :key="chassis.id"
                                    :value="chassis.id"
                                >
                                    {{ chassis.code }}
                                </option>
                            </select>
                            <input
                                v-model.number="vehicle.year"
                                type="number"
                                placeholder="Año"
                                class="rounded-md border bg-background px-3 py-2"
                            />
                            <input
                                v-model="vehicle.vin"
                                placeholder="VIN"
                                class="rounded-md border bg-background px-3 py-2 font-mono"
                            />
                            <div class="flex gap-2">
                                <input
                                    v-model="vehicle.plate_number"
                                    placeholder="Placa"
                                    class="min-w-0 flex-1 rounded-md border bg-background px-3 py-2"
                                />
                                <button
                                    type="button"
                                    class="rounded-md border p-2 text-destructive"
                                    title="Desasociar"
                                    @click="removeVehicle(index)"
                                >
                                    <Trash2 :size="17" />
                                </button>
                            </div>
                            <input
                                v-model="vehicle.notes"
                                placeholder="Notas del vehículo"
                                class="rounded-md border bg-background px-3 py-2 md:col-span-2"
                            />
                        </div>
                        <p
                            v-if="
                                fieldErrors[
                                    `vehicles.${index}.vehicle_model_id`
                                ] ||
                                fieldErrors[
                                    `vehicles.${index}.vehicle_engine_id`
                                ]
                            "
                            class="text-xs text-destructive"
                        >
                            {{
                                fieldErrors[
                                    `vehicles.${index}.vehicle_model_id`
                                ]?.[0] ||
                                fieldErrors[
                                    `vehicles.${index}.vehicle_engine_id`
                                ][0]
                            }}
                        </p>
                    </div>
                </section>

                <section class="grid gap-4 border-t pt-5 md:grid-cols-3">
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Límite de crédito</label
                        ><input
                            v-model.number="form.credit_limit"
                            type="number"
                            min="0"
                            step="0.01"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Días de crédito</label
                        ><input
                            v-model.number="form.credit_days"
                            type="number"
                            min="0"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Estado</label
                        ><select
                            v-model="form.status"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        >
                            <option value="active">Activo</option>
                            <option value="inactive">Inactivo</option>
                            <option value="blocked">Bloqueado</option>
                        </select>
                    </div>
                    <div class="md:col-span-3">
                        <label class="mb-1 block text-sm font-medium"
                            >Notas</label
                        ><textarea
                            v-model="form.notes"
                            rows="3"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        />
                    </div>
                </section>

                <DialogFooter>
                    <button
                        type="button"
                        class="rounded-md border px-4 py-2"
                        @click="emit('update:open', false)"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        class="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                        :disabled="
                            saving ||
                            !form.name ||
                            !form.customer_type_id ||
                            vehicles.some(
                                (vehicle) =>
                                    !vehicle.vehicle_model_id ||
                                    !vehicle.vehicle_engine_id,
                            )
                        "
                    >
                        {{ saving ? 'Guardando...' : 'Guardar cliente' }}
                    </button>
                </DialogFooter>
            </form>
        </DialogScrollContent>
    </Dialog>
</template>
