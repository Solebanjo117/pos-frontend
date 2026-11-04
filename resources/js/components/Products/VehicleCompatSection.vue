<script setup lang="ts">
import { router } from '@inertiajs/vue3';
import { Check, Globe, Plus, RefreshCw, Search, X } from 'lucide-vue-next';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import QuickVehicleDialog from '@/components/Vehicles/QuickVehicleDialog.vue';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import type { VehicleConfigurationRow } from '@/composables/useVehicleCatalog';
import apiClient from '@/services/api/client';
import {
    fitmentFromConfiguration,
    fitmentKey,
    fitmentTitle,
    type DraftCompatData,
    type VehicleFitmentEntry,
} from '@/utils/vehicleFitment';

export type { DraftCompatData } from '@/utils/vehicleFitment';

const props = defineProps<{
    modelValue: DraftCompatData;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: DraftCompatData];
}>();

const PER_PAGE = 25;

const expanded = ref(true);
const search = ref('');
const results = ref<VehicleConfigurationRow[]>([]);
const total = ref(0);
const loading = ref(false);
const loadError = ref<string | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let requestId = 0;

const selectedKeys = computed(
    () => new Set(props.modelValue.vehicles.map(fitmentKey)),
);
const assignedCount = computed(
    () => props.modelValue.vehicles.length + props.modelValue.legacy.length,
);
const summary = computed(() => {
    if (props.modelValue.isUniversal) return 'Universal';
    if (assignedCount.value === 0) return '';
    return assignedCount.value === 1
        ? '1 vehículo'
        : `${assignedCount.value} vehículos`;
});
const unselectedResults = computed(() =>
    results.value.filter(
        (row) =>
            !selectedKeys.value.has(
                fitmentKey({
                    model_id: row.model.id,
                    engine_id: row.engine.id,
                }),
            ),
    ),
);

const update = (patch: Partial<DraftCompatData>) =>
    emit('update:modelValue', { ...props.modelValue, ...patch });

const fetchResults = async () => {
    const current = ++requestId;
    loading.value = true;
    loadError.value = null;
    try {
        const { data } = await apiClient.get('/vehicle-configurations', {
            params: {
                search: search.value.trim() || undefined,
                per_page: PER_PAGE,
                sort: 'make',
            },
        });
        if (current !== requestId) return;
        results.value = data.data ?? [];
        total.value = data.meta?.total ?? results.value.length;
    } catch {
        if (current !== requestId) return;
        results.value = [];
        total.value = 0;
        loadError.value = 'No se pudo cargar el catálogo de vehículos.';
    } finally {
        if (current === requestId) loading.value = false;
    }
};

watch(search, () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(fetchResults, 300);
});

watch(
    () => [expanded.value, props.modelValue.isUniversal],
    ([isExpanded, isUniversal]) => {
        if (isExpanded && !isUniversal && results.value.length === 0) {
            fetchResults();
        }
    },
    { immediate: true },
);

onBeforeUnmount(() => {
    ++requestId;
    if (searchTimer) clearTimeout(searchTimer);
});

const isSelected = (row: VehicleConfigurationRow) =>
    selectedKeys.value.has(
        fitmentKey({ model_id: row.model.id, engine_id: row.engine.id }),
    );

const toggleRow = (row: VehicleConfigurationRow) => {
    const key = fitmentKey({
        model_id: row.model.id,
        engine_id: row.engine.id,
    });
    update({
        vehicles: isSelected(row)
            ? props.modelValue.vehicles.filter(
                  (vehicle) => fitmentKey(vehicle) !== key,
              )
            : [...props.modelValue.vehicles, fitmentFromConfiguration(row)],
    });
};

const selectAllResults = () => {
    update({
        vehicles: [
            ...props.modelValue.vehicles,
            ...unselectedResults.value.map(fitmentFromConfiguration),
        ],
    });
};

const removeVehicle = (key: string) => {
    update({
        vehicles: props.modelValue.vehicles.filter(
            (vehicle) => fitmentKey(vehicle) !== key,
        ),
    });
};

const removeLegacy = (id: number) => {
    update({
        legacy: props.modelValue.legacy.filter((record) => record.id !== id),
    });
};

// Registrar vehículos en el catálogo requiere los mismos roles que el módulo Vehículos.
const { hasRole } = useAuth();
const canManageCatalog = computed(() => hasRole(['admin', 'manager']));
const toast = useToast();
const showQuickAdd = ref(false);

const onVehicleCreated = (vehicle: VehicleFitmentEntry) => {
    showQuickAdd.value = false;
    if (!selectedKeys.value.has(fitmentKey(vehicle))) {
        update({ vehicles: [...props.modelValue.vehicles, vehicle] });
    }
    toast.success(`${fitmentTitle(vehicle)} agregado y asignado al producto.`);
    fetchResults();
};

const goToCatalog = () => {
    if (
        window.confirm(
            'Vas a salir de esta página. Si tienes cambios sin guardar en el producto, se perderán. ¿Continuar?',
        )
    ) {
        router.visit('/vehicles?tab=vehicles');
    }
};

const toggleUniversal = () => {
    if (props.modelValue.isUniversal) {
        update({ isUniversal: false });
        return;
    }
    if (
        assignedCount.value > 0 &&
        !window.confirm(
            'Al marcar el producto como universal se quitarán los vehículos asignados. ¿Continuar?',
        )
    ) {
        return;
    }
    update({ isUniversal: true, vehicles: [], legacy: [] });
};

const rowYears = (row: VehicleConfigurationRow) =>
    row.model.year_from === row.model.year_to
        ? String(row.model.year_from)
        : `${row.model.year_from}-${row.model.year_to ?? ''}`;

const rowTitle = (row: VehicleConfigurationRow) =>
    [row.make.name, row.model.name, row.model.generation]
        .filter(Boolean)
        .join(' ');

const rowEngine = (row: VehicleConfigurationRow) =>
    row.engine.nickname
        ? `${row.engine.engine_code} (${row.engine.nickname})`
        : row.engine.engine_code;

const rowSheet = (row: VehicleConfigurationRow) =>
    [row.engine.displacement, row.engine.valves, row.engine.cam_type]
        .filter(Boolean)
        .join(' ');
</script>

<template>
    <div
        class="rounded-xl border border-l-4 border-gray-100 border-l-teal-500 bg-white shadow-sm dark:border-border dark:bg-card"
    >
        <button
            type="button"
            class="flex w-full items-center justify-between px-5 py-4 text-left"
            @click="expanded = !expanded"
        >
            <div class="flex items-center gap-2">
                <span
                    class="text-sm font-semibold text-gray-900 dark:text-white"
                    >Compatibilidad Vehicular</span
                >
                <span
                    v-if="summary"
                    class="rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                >
                    {{ summary }}
                </span>
            </div>
            <span class="text-xs text-gray-400">{{
                expanded ? '▲ Colapsar' : '▼ Expandir'
            }}</span>
        </button>

        <div
            v-show="expanded"
            class="space-y-4 border-t border-gray-100 px-5 pt-4 pb-5 dark:border-border"
        >
            <div class="flex flex-wrap items-center justify-between gap-2">
                <button
                    type="button"
                    class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
                    :class="
                        modelValue.isUniversal
                            ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                            : 'border-gray-300 text-gray-600 hover:border-teal-400 dark:border-border dark:text-gray-400'
                    "
                    @click="toggleUniversal"
                >
                    <Globe class="h-4 w-4" />
                    {{
                        modelValue.isUniversal
                            ? '✓ Compatible con TODOS los vehículos'
                            : 'Marcar como Universal (TODOS)'
                    }}
                </button>
                <div class="flex items-center gap-3">
                    <button
                        v-if="canManageCatalog && !modelValue.isUniversal"
                        type="button"
                        class="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
                        @click="showQuickAdd = true"
                    >
                        <Plus class="h-4 w-4" />
                        Agregar vehículo
                    </button>
                    <a
                        href="/vehicles?tab=vehicles"
                        class="text-xs text-teal-700 hover:underline dark:text-teal-300"
                        @click.prevent="goToCatalog"
                    >
                        Administrar catálogo de vehículos
                    </a>
                </div>
            </div>

            <template v-if="!modelValue.isUniversal">
                <!-- Asignados -->
                <div>
                    <p
                        class="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
                    >
                        Vehículos asignados ({{ assignedCount }})
                    </p>
                    <p
                        v-if="assignedCount === 0"
                        class="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-500 dark:border-border dark:text-gray-400"
                    >
                        Ningún vehículo asignado. Búscalos abajo y márcalos.
                    </p>
                    <ul v-else class="flex flex-wrap gap-2">
                        <li
                            v-for="vehicle in modelValue.vehicles"
                            :key="fitmentKey(vehicle)"
                            class="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 py-1 pr-1 pl-3 text-sm dark:border-teal-800 dark:bg-teal-900/20"
                        >
                            <span class="text-gray-900 dark:text-white">
                                {{ fitmentTitle(vehicle) }}
                                <span
                                    v-if="vehicle.years"
                                    class="text-gray-500 dark:text-gray-400"
                                    >({{ vehicle.years }})</span
                                >
                                <span
                                    class="ml-1 font-mono text-xs text-teal-700 dark:text-teal-300"
                                    >{{ vehicle.engine }}</span
                                >
                            </span>
                            <button
                                type="button"
                                class="rounded p-1 text-gray-400 hover:bg-white hover:text-red-600 dark:hover:bg-muted"
                                :aria-label="`Quitar ${fitmentTitle(vehicle)}`"
                                @click="removeVehicle(fitmentKey(vehicle))"
                            >
                                <X class="h-3.5 w-3.5" />
                            </button>
                        </li>
                        <li
                            v-for="record in modelValue.legacy"
                            :key="`legacy-${record.id}`"
                            class="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 py-1 pr-1 pl-3 text-sm dark:border-amber-800 dark:bg-amber-900/20"
                            title="Asignación anterior: se conserva tal cual. Puedes quitarla y volver a asignar el vehículo exacto."
                        >
                            <span class="text-gray-900 dark:text-white">{{
                                record.label
                            }}</span>
                            <span
                                class="rounded bg-amber-100 px-1.5 text-[10px] text-amber-800 uppercase dark:bg-amber-900/40 dark:text-amber-300"
                                >anterior</span
                            >
                            <button
                                type="button"
                                class="rounded p-1 text-gray-400 hover:bg-white hover:text-red-600 dark:hover:bg-muted"
                                :aria-label="`Quitar ${record.label}`"
                                @click="removeLegacy(record.id)"
                            >
                                <X class="h-3.5 w-3.5" />
                            </button>
                        </li>
                    </ul>
                </div>

                <!-- Buscador -->
                <div class="space-y-2">
                    <div class="flex items-center gap-2">
                        <div class="relative flex-1">
                            <Search
                                class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                            />
                            <input
                                v-model="search"
                                type="search"
                                placeholder="Buscar por marca, modelo, generación, motor o año (ej: 1ZZ, corolla e110, 2005)"
                                class="h-10 w-full rounded-lg border border-gray-300 bg-white pr-3 pl-9 text-sm dark:border-border dark:bg-background"
                                aria-label="Buscar vehículos"
                            />
                        </div>
                        <button
                            type="button"
                            class="rounded-lg border border-gray-300 p-2 text-gray-500 hover:text-gray-800 dark:border-border"
                            title="Actualizar lista"
                            aria-label="Actualizar lista"
                            @click="fetchResults"
                        >
                            <RefreshCw
                                class="h-4 w-4"
                                :class="{ 'animate-spin': loading }"
                            />
                        </button>
                    </div>

                    <div class="flex items-center justify-between text-xs">
                        <span class="text-gray-500 dark:text-gray-400">
                            <template v-if="loading">Buscando…</template>
                            <template v-else-if="loadError">{{
                                loadError
                            }}</template>
                            <template v-else-if="total > results.length">
                                Mostrando {{ results.length }} de {{ total }}.
                                Escribe más para afinar la búsqueda.
                            </template>
                            <template v-else
                                >{{ total }} vehículo(s) encontrado(s)</template
                            >
                        </span>
                        <button
                            v-if="unselectedResults.length > 0"
                            type="button"
                            class="font-medium text-teal-700 hover:underline dark:text-teal-300"
                            @click="selectAllResults"
                        >
                            Seleccionar los {{ unselectedResults.length }}
                            mostrados
                        </button>
                    </div>

                    <div
                        class="max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-border"
                    >
                        <table class="w-full text-sm">
                            <thead
                                class="sticky top-0 bg-gray-50 text-left text-xs text-gray-500 uppercase dark:bg-muted dark:text-gray-400"
                            >
                                <tr>
                                    <th class="w-10 px-3 py-2"></th>
                                    <th class="px-3 py-2">
                                        Marca / Modelo / Años
                                    </th>
                                    <th class="px-3 py-2">Motor</th>
                                </tr>
                            </thead>
                            <tbody
                                class="divide-y divide-gray-100 dark:divide-border"
                            >
                                <tr
                                    v-for="row in results"
                                    :key="row.key"
                                    class="cursor-pointer hover:bg-teal-50/60 dark:hover:bg-muted/60"
                                    :class="{
                                        'bg-teal-50 dark:bg-teal-900/20':
                                            isSelected(row),
                                    }"
                                    @click="toggleRow(row)"
                                >
                                    <td class="px-3 py-2">
                                        <span
                                            class="flex h-4 w-4 items-center justify-center rounded border"
                                            :class="
                                                isSelected(row)
                                                    ? 'border-teal-600 bg-teal-600 text-white'
                                                    : 'border-gray-300 dark:border-border'
                                            "
                                            role="checkbox"
                                            :aria-checked="isSelected(row)"
                                            :aria-label="rowTitle(row)"
                                        >
                                            <Check
                                                v-if="isSelected(row)"
                                                class="h-3 w-3"
                                            />
                                        </span>
                                    </td>
                                    <td class="px-3 py-2">
                                        <span
                                            class="font-medium text-gray-900 dark:text-white"
                                            >{{ rowTitle(row) }}</span
                                        >
                                        <span
                                            class="ml-1 text-gray-500 dark:text-gray-400"
                                            >({{ rowYears(row) }})</span
                                        >
                                    </td>
                                    <td class="px-3 py-2">
                                        <span
                                            class="font-mono text-teal-700 dark:text-teal-300"
                                            >{{ rowEngine(row) }}</span
                                        >
                                        <span
                                            v-if="rowSheet(row)"
                                            class="ml-1 text-xs text-gray-500 dark:text-gray-400"
                                            >{{ rowSheet(row) }}</span
                                        >
                                    </td>
                                </tr>
                                <tr v-if="!loading && results.length === 0">
                                    <td
                                        colspan="3"
                                        class="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                                    >
                                        No hay vehículos que coincidan.
                                        Regístralos en el catálogo de vehículos.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </template>
        </div>

        <QuickVehicleDialog
            :open="showQuickAdd"
            @close="showQuickAdd = false"
            @created="onVehicleCreated"
        />
    </div>
</template>
