<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import {
    useVehicleCatalog,
    type VehicleConfigurationRow,
} from '@/composables/useVehicleCatalog';
import type { VehicleEngine } from '@/composables/useVehicleEngines';
import type { VehicleMake } from '@/composables/useVehicleMakes';
import type { VehicleModel } from '@/composables/useVehicleModels';
import apiClient from '@/services/api/client';

const props = defineProps<{
    modelValue?: {
        make_id?: number;
        model_id?: number;
        engine_id?: number;
        year?: number;
    };
}>();

const emit = defineEmits(['update:modelValue', 'change']);

const makes = ref<VehicleMake[]>([]);
const models = ref<VehicleModel[]>([]);
const engines = ref<VehicleEngine[]>([]);
const loadingMakes = ref(false);
const loadingModels = ref(false);
const loadingEngines = ref(false);
const optionsError = ref('');
const catalog = useVehicleCatalog();

const selectedMakeId = ref<number | ''>(props.modelValue?.make_id || '');
const selectedModelId = ref<number | ''>(props.modelValue?.model_id || '');
const selectedEngineId = ref<number | ''>(props.modelValue?.engine_id || '');
const selectedYear = ref<number | ''>(props.modelValue?.year || '');
const search = ref('');
const searchResults = ref<VehicleConfigurationRow[]>([]);
const searchLoading = ref(false);
const searchError = ref('');
const moreSearchResults = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let searchRequest = 0;
let selectionRequest = 0;

const selectedModel = computed(() =>
    models.value.find((model) => model.id === selectedModelId.value),
);
const yearOptions = computed(() => {
    const model = selectedModel.value;
    if (!model?.year_from) return [];

    const lastYear = Math.min(
        model.year_to ?? new Date().getFullYear() + 2,
        new Date().getFullYear() + 2,
    );
    return Array.from(
        { length: Math.max(lastYear - model.year_from + 1, 0) },
        (_, index) => lastYear - index,
    );
});

const engineLabel = (engine: VehicleEngine): string =>
    [
        engine.engine_code,
        engine.displacement,
        engine.fuel_type,
        engine.aspiration,
    ]
        .filter(Boolean)
        .join(' · ');

const loadModels = async (makeId: number, request: number): Promise<void> => {
    loadingModels.value = true;
    try {
        const response = await apiClient.get(`/vehicle-makes/${makeId}/models`);
        if (request === selectionRequest) {
            models.value = response.data.data ?? [];
        }
    } finally {
        if (request === selectionRequest) loadingModels.value = false;
    }
};

const loadEngines = async (modelId: number, request: number): Promise<void> => {
    loadingEngines.value = true;
    try {
        const response = await apiClient.get(
            `/vehicle-models/${modelId}/engines`,
        );
        if (request === selectionRequest) {
            engines.value = response.data.data ?? [];
        }
    } finally {
        if (request === selectionRequest) loadingEngines.value = false;
    }
};

const restoreSelection = async (value = props.modelValue): Promise<void> => {
    const request = ++selectionRequest;
    optionsError.value = '';
    loadingModels.value = false;
    loadingEngines.value = false;
    selectedMakeId.value = value?.make_id || '';
    selectedModelId.value = '';
    selectedEngineId.value = '';
    selectedYear.value = '';
    models.value = [];
    engines.value = [];

    if (!value?.make_id) return;
    try {
        await loadModels(value.make_id, request);
        if (request !== selectionRequest || !value.model_id) return;
        if (!models.value.some((model) => model.id === value.model_id)) return;

        selectedModelId.value = value.model_id;
        selectedYear.value = yearOptions.value.includes(value.year ?? 0)
            ? (value.year ?? '')
            : '';
        await loadEngines(value.model_id, request);
        if (request !== selectionRequest || !value.engine_id) return;
        if (engines.value.some((engine) => engine.id === value.engine_id)) {
            selectedEngineId.value = value.engine_id;
        }
    } catch {
        if (request === selectionRequest) {
            optionsError.value =
                'No se pudieron cargar las opciones del vehículo.';
        }
    }
};

onMounted(async () => {
    loadingMakes.value = true;
    try {
        const response = await apiClient.get('/vehicle-makes/all');
        makes.value = response.data.data ?? [];
        await restoreSelection();
    } catch {
        optionsError.value = 'No se pudieron cargar las marcas.';
    } finally {
        loadingMakes.value = false;
    }
});

const onMakeChange = async (): Promise<void> => {
    const request = ++selectionRequest;
    const makeId = selectedMakeId.value;
    optionsError.value = '';
    loadingModels.value = false;
    loadingEngines.value = false;
    selectedEngineId.value = '';
    selectedModelId.value = '';
    selectedYear.value = '';
    models.value = [];
    engines.value = [];
    emitChange();
    if (makeId) {
        try {
            await loadModels(makeId, request);
        } catch {
            if (request === selectionRequest) {
                optionsError.value = 'No se pudieron cargar los modelos.';
            }
        }
    }
};

const onModelChange = async (): Promise<void> => {
    const request = ++selectionRequest;
    optionsError.value = '';
    loadingEngines.value = false;
    selectedEngineId.value = '';
    selectedYear.value = '';
    engines.value = [];
    emitChange();
    if (selectedModelId.value) {
        try {
            await loadEngines(selectedModelId.value, request);
        } catch {
            if (request === selectionRequest) {
                optionsError.value = 'No se pudieron cargar los motores.';
            }
        }
    }
};

watch(
    () => props.modelValue,
    (value) => {
        if (
            selectedMakeId.value !== (value?.make_id ?? '') ||
            selectedModelId.value !== (value?.model_id ?? '') ||
            selectedEngineId.value !== (value?.engine_id ?? '') ||
            selectedYear.value !== (value?.year ?? '')
        ) {
            void restoreSelection(value);
        }
    },
);

const runSearch = async (): Promise<void> => {
    const query = search.value.trim();
    const request = ++searchRequest;
    searchResults.value = [];
    searchError.value = '';
    moreSearchResults.value = false;
    if (query.length < 2) {
        searchLoading.value = false;
        return;
    }

    searchLoading.value = true;
    try {
        const response = await catalog.fetchRows<VehicleConfigurationRow>(
            'vehicles',
            {
                page: 1,
                per_page: 20,
                search: query,
                sort: 'make',
                direction: 'asc',
            },
        );
        if (request === searchRequest) {
            searchResults.value = response.data;
            moreSearchResults.value =
                response.meta.total > response.data.length;
        }
    } catch {
        if (request === searchRequest) {
            searchError.value =
                'No se pudo buscar en el catálogo de vehículos.';
        }
    } finally {
        if (request === searchRequest) searchLoading.value = false;
    }
};

const onSearchInput = (): void => {
    if (searchTimer) clearTimeout(searchTimer);
    if (search.value.trim().length < 2) {
        ++searchRequest;
        searchResults.value = [];
        searchLoading.value = false;
        moreSearchResults.value = false;
        return;
    }
    searchTimer = setTimeout(() => void runSearch(), 250);
};

const chooseResult = async (row: VehicleConfigurationRow): Promise<void> => {
    ++searchRequest;
    if (searchTimer) clearTimeout(searchTimer);
    searchLoading.value = false;
    const matchedYear = search.value
        .split(/\s+/u)
        .map(Number)
        .find(
            (year) =>
                Number.isInteger(year) &&
                year >= row.model.year_from &&
                (row.model.year_to === null || year <= row.model.year_to),
        );
    search.value = '';
    searchResults.value = [];
    await restoreSelection({
        make_id: row.make.id,
        model_id: row.model.id,
        engine_id: row.engine.id,
        year: matchedYear,
    });
    emitChange();
};

onBeforeUnmount(() => {
    ++searchRequest;
    ++selectionRequest;
    if (searchTimer) clearTimeout(searchTimer);
});

const emitChange = () => {
    const make = makes.value.find((m) => m.id === Number(selectedMakeId.value));
    const model = models.value.find(
        (m) => m.id === Number(selectedModelId.value),
    );
    const engine = engines.value.find(
        (e) => e.id === Number(selectedEngineId.value),
    );

    emit('update:modelValue', {
        make_id: Number(selectedMakeId.value) || undefined,
        make_name: make?.name,
        model_id: Number(selectedModelId.value) || undefined,
        model_name: model?.name,
        engine_id: Number(selectedEngineId.value) || undefined,
        engine_name: engine ? engineLabel(engine) : undefined,
        year: selectedYear.value || undefined,
    });
    emit('change', {
        make_id: Number(selectedMakeId.value) || undefined,
        model_id: Number(selectedModelId.value) || undefined,
        engine_id: Number(selectedEngineId.value) || undefined,
        year: selectedYear.value || undefined,
    });
};
</script>

<template>
    <div class="space-y-3">
        <p v-if="optionsError" role="alert" class="text-xs text-red-600">
            {{ optionsError }}
        </p>
        <div>
            <label
                class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300"
            >
                Buscar configuración
            </label>
            <input
                v-model="search"
                type="search"
                autocomplete="off"
                placeholder="Marca, modelo, año, motor, cilindrada, VIN, combustible o aspiración"
                class="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                @input="onSearchInput"
                @keydown.enter.prevent="runSearch"
            />
            <p v-if="searchLoading" class="mt-1 text-xs text-gray-500">
                Buscando vehículos…
            </p>
            <p
                v-if="searchError"
                role="alert"
                class="mt-1 text-xs text-red-600"
            >
                {{ searchError }}
            </p>
            <div
                v-if="searchResults.length"
                class="mt-2 max-h-56 overflow-y-auto rounded-md border border-gray-200 dark:border-border"
            >
                <button
                    v-for="row in searchResults"
                    :key="row.key"
                    type="button"
                    class="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-gray-50 focus:bg-gray-50 dark:border-border dark:hover:bg-muted dark:focus:bg-muted"
                    @click="chooseResult(row)"
                >
                    <span class="font-medium"
                        >{{ row.make.name }} {{ row.model.name }}</span
                    >
                    <span class="text-gray-600 dark:text-gray-300">
                        · {{ row.model.year_from }}–{{
                            row.model.year_to ?? 'Presente'
                        }}
                        ·
                        {{
                            [
                                row.engine.engine_code,
                                row.engine.displacement,
                                row.engine.fuel_type,
                                row.engine.aspiration,
                            ]
                                .filter(Boolean)
                                .join(' · ')
                        }}
                    </span>
                </button>
            </div>
            <p
                v-else-if="
                    search.trim().length >= 2 && !searchLoading && !searchError
                "
                class="mt-1 text-xs text-gray-500"
            >
                Sin coincidencias.
            </p>
            <p v-if="moreSearchResults" class="mt-1 text-xs text-gray-500">
                Se muestran las primeras 20 coincidencias. Agrega más términos
                para precisar.
            </p>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <!-- Marca -->
            <div>
                <label
                    class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                    >Marca</label
                >
                <select
                    v-model="selectedMakeId"
                    :disabled="loadingMakes"
                    @change="onMakeChange"
                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 sm:text-sm dark:border-border dark:bg-muted dark:text-white"
                >
                    <option value="">
                        {{ loadingMakes ? 'Cargando...' : 'Selecciona Marca' }}
                    </option>
                    <option
                        v-for="make in makes"
                        :key="make.id"
                        :value="make.id"
                    >
                        {{ make.name }}
                    </option>
                </select>
            </div>

            <!-- Modelo -->
            <div>
                <label
                    class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                    >Modelo</label
                >
                <select
                    v-model="selectedModelId"
                    :disabled="!selectedMakeId || loadingModels"
                    @change="onModelChange"
                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 sm:text-sm dark:border-border dark:bg-muted dark:text-white"
                >
                    <option value="">
                        {{
                            loadingModels ? 'Cargando...' : 'Selecciona Modelo'
                        }}
                    </option>
                    <option
                        v-for="model in models"
                        :key="model.id"
                        :value="model.id"
                    >
                        {{ model.name }}
                        <template v-if="model.year_from">
                            ({{ model.year_from }}–{{
                                model.year_to ?? 'Presente'
                            }})
                        </template>
                    </option>
                </select>
            </div>

            <!-- Año del modelo -->
            <div>
                <label
                    class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                    >Año</label
                >
                <select
                    v-model="selectedYear"
                    :disabled="!selectedModelId"
                    @change="emitChange"
                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 sm:text-sm dark:border-border dark:bg-muted dark:text-white"
                >
                    <option value="">Selecciona Año</option>
                    <option
                        v-for="year in yearOptions"
                        :key="year"
                        :value="year"
                    >
                        {{ year }}
                    </option>
                </select>
            </div>

            <!-- Motor de la configuración -->
            <div>
                <label
                    class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                    >Motor</label
                >
                <select
                    v-model="selectedEngineId"
                    :disabled="!selectedModelId || loadingEngines"
                    @change="emitChange"
                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 sm:text-sm dark:border-border dark:bg-muted dark:text-white"
                >
                    <option value="">Selecciona Motor</option>
                    <option
                        v-for="engine in engines"
                        :key="engine.id"
                        :value="engine.id"
                    >
                        {{ engineLabel(engine) }}
                    </option>
                </select>
            </div>
        </div>
    </div>
</template>
