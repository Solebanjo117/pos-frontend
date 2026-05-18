<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import apiClient from '@/services/api/client';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import { Plus, Globe, Car } from 'lucide-vue-next';

interface VehicleMake {
    id: number;
    name: string;
}
interface VehicleModelItem {
    id: number;
    name: string;
    year_from?: number;
    year_to?: number;
    generation?: string;
}
interface VehicleEngineItem {
    id: number;
    engine_code: string;
    displacement?: string;
}
interface VehicleChassisCatalogItem {
    id: number;
    code: string;
    name?: string | null;
    model?: {
        id?: number;
        name?: string;
        make?: { id?: number; name?: string };
    } | null;
}

export interface EngineCompatibilityEntry {
    engine_id: number;
    make: string;
    model: string;
    engine: string;
    year: string;
    chassis: string;
}

export interface ChassisCompatibilityEntry {
    chassis_id: number;
    make: string;
    model: string;
    year: string;
    chassis: string;
}

export interface DraftCompatData {
    engines: EngineCompatibilityEntry[];
    chassis: ChassisCompatibilityEntry[];
    allEngines: boolean;
    allChassis: boolean;
    isUniversal: boolean;
    modelId?: number | null;
    makeId?: number | null;
}

interface CompatibleEngine {
    id: number;
    compat_id: number;
    engine_code: string;
    displacement?: string;
    model?: {
        id: number;
        name: string;
        year_from?: number;
        year_to?: number;
        make?: { id: number; name: string };
        generation?: string;
    };
}

interface CompatibleChassis {
    id: number;
    compat_id: number;
    code: string;
    name?: string;
    model?: {
        id: number;
        name: string;
        year_from?: number;
        year_to?: number;
        make?: { id: number; name: string };
        generation?: string;
    };
}

const props = withDefaults(
    defineProps<{
        mode?: 'draft' | 'live';
        productId?: number;
        modelValue?: DraftCompatData;
    }>(),
    {
        mode: 'live',
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: DraftCompatData];
    'open-inline': [
        type:
            | 'vehicleMake'
            | 'vehicleModel'
            | 'vehicleEngine'
            | 'vehicleChassis',
    ];
}>();

const toast = useToast();

// === Shared state ===
const compatTab = ref<'engines' | 'chassis'>('engines');
const vehicleMakes = ref<VehicleMake[]>([]);
const vehicleModels = ref<VehicleModelItem[]>([]);
const vehicleEnginesList = ref<VehicleEngineItem[]>([]);
const vehicleChassisList = ref<any[]>([]);

const selectedMakeId = ref<number | null>(null);
const selectedModelId = ref<number | null>(null);
const selectedEngineIds = ref<number[]>([]);
const selectedChassisIds = ref<number[]>([]);

const loadingMakes = ref(false);
const loadingModelsV = ref(false);
const loadingEnginesV = ref(false);

// === Live mode state ===
const compatibleEngines = ref<CompatibleEngine[]>([]);
const compatibleChassis = ref<CompatibleChassis[]>([]);
const loadingCompat = ref(false);
const addingCompat = ref(false);
const allEnginesFlag = ref(false);
const allChassisFlag = ref(false);

// === Draft mode state ===
const addedEngines = ref<EngineCompatibilityEntry[]>([]);
const addedChassis = ref<ChassisCompatibilityEntry[]>([]);
const draftAllEngines = ref(false);
const draftAllChassis = ref(false);
const draftIsUniversal = ref(false);

const isUniversal = computed({
    get: () =>
        props.mode === 'draft'
            ? draftIsUniversal.value
            : (props.modelValue?.isUniversal ?? false),
    set: (val: boolean) => {
        if (props.mode === 'draft') {
            draftIsUniversal.value = val;
            if (val) {
                addedEngines.value = [];
                addedChassis.value = [];
                draftAllEngines.value = false;
                draftAllChassis.value = false;
                selectedMakeId.value = null;
            }
            emitDraft();
        }
    },
});

// Sync draft model value on mount
watch(
    () => props.modelValue,
    (val) => {
        if (props.mode === 'draft' && val) {
            addedEngines.value = val.engines;
            addedChassis.value = val.chassis;
            draftAllEngines.value = val.allEngines;
            draftAllChassis.value = val.allChassis;
            draftIsUniversal.value = val.isUniversal;
        }
    },
    { immediate: true },
);

const emitDraft = () => {
    if (props.mode !== 'draft') return;
    emit('update:modelValue', {
        engines: addedEngines.value,
        chassis: addedChassis.value,
        allEngines: draftAllEngines.value,
        allChassis: draftAllChassis.value,
        isUniversal: draftIsUniversal.value,
        modelId: selectedModelId.value,
        makeId: selectedMakeId.value,
    });
};

// === Helpers ===
const formatModelYears = (
    model?: { year_from?: number; year_to?: number } | null,
): string => {
    const from = model?.year_from;
    const to = model?.year_to;
    if (from && to) return from === to ? `${from}` : `${from}-${to}`;
    if (from) return `${from}`;
    if (to) return `${to}`;
    return '';
};

const selectedModelMeta = computed(
    () =>
        vehicleModels.value.find((m) => m.id === selectedModelId.value) || null,
);

const getChassisOptionDetail = (chassis: any): string => {
    const modelContext = (chassis?.model ??
        selectedModelMeta.value) as VehicleModelItem | null;
    const modelName = String(
        chassis?.model?.name ?? selectedModelMeta.value?.name ?? '',
    ).trim();
    const years = formatModelYears(modelContext);
    const code = String(chassis?.code ?? modelContext?.generation ?? '').trim();
    const base = [modelName, years].filter(Boolean).join(' ');
    if (!base && !code) return 'Chasis sin detalle';
    return code ? `${base || 'Modelo'} - Chasis: ${code}` : base;
};

const getApiErrorMessage = (err: any, fallback: string) =>
    err?.response?.data?.message || fallback;

// === Select options ===
const makeSelectOptions = computed(() =>
    vehicleMakes.value.map((m) => ({ value: m.id, label: m.name })),
);
const modelSelectOptions = computed(() =>
    vehicleModels.value.map((m) => {
        const years = m.year_from ? `${m.year_from}-${m.year_to || '...'}` : '';
        const gen = m.generation ? `Chasis: ${m.generation}` : '';
        const parts = [years, gen].filter(Boolean);
        return { value: m.id, label: m.name, sublabel: parts.join(' - ') };
    }),
);
const engineSelectOptions = computed(() =>
    vehicleEnginesList.value.map((e) => ({
        value: e.id,
        label: e.engine_code,
        sublabel: e.displacement || '',
    })),
);
const hasAvailableChassisOptions = computed(
    () => vehicleChassisList.value.length > 0,
);

// === Data fetching ===
const fetchVehicleMakes = async () => {
    loadingMakes.value = true;
    try {
        const { data } = await apiClient.get('/vehicle-makes');
        vehicleMakes.value = data.data ?? data;
    } catch {
        vehicleMakes.value = [];
    } finally {
        loadingMakes.value = false;
    }
};

watch(selectedMakeId, async (makeId) => {
    vehicleModels.value = [];
    vehicleEnginesList.value = [];
    selectedModelId.value = null;
    selectedEngineIds.value = [];
    if (!makeId) return;
    loadingModelsV.value = true;
    try {
        const { data } = await apiClient.get(`/vehicle-makes/${makeId}/models`);
        vehicleModels.value = data.data ?? data;
    } catch {
        vehicleModels.value = [];
    } finally {
        loadingModelsV.value = false;
    }
});

watch(selectedModelId, async (modelId) => {
    vehicleEnginesList.value = [];
    selectedEngineIds.value = [];
    vehicleChassisList.value = [];
    selectedChassisIds.value = [];
    if (props.mode === 'draft') emitDraft();
    if (!modelId) return;
    loadingEnginesV.value = true;
    try {
        const { data } = await apiClient.get(
            `/vehicle-models/${modelId}/engines`,
        );
        vehicleEnginesList.value = data.data ?? data;
    } catch {
        vehicleEnginesList.value = [];
    } finally {
        loadingEnginesV.value = false;
    }
    try {
        const { data } = await apiClient.get(
            `/vehicle-models/${modelId}/chassis`,
        );
        vehicleChassisList.value = data.data ?? data;
    } catch {
        vehicleChassisList.value = [];
    }
});

// === Draft mode: collapsible state ===
const draftExpanded = ref(false);

// === Draft mode: summary for collapse header ===
const compatibilitySummary = computed(() => {
    if (props.mode !== 'draft') return '';
    if (draftIsUniversal.value) return 'Universal';
    const parts: string[] = [];
    if (draftAllEngines.value) parts.push('todos los motores del modelo');
    else if (addedEngines.value.length > 0)
        parts.push(`${addedEngines.value.length} motor(es)`);
    if (draftAllChassis.value) parts.push('todos los chasis del modelo');
    else if (addedChassis.value.length > 0)
        parts.push(`${addedChassis.value.length} chasis`);
    return parts.join(' | ');
});

// === Draft mode actions ===
const addEnginesDraft = () => {
    if (selectedEngineIds.value.length === 0) return;
    const make = vehicleMakes.value.find((m) => m.id === selectedMakeId.value);
    const model = vehicleModels.value.find(
        (m) => m.id === selectedModelId.value,
    );
    const modelName = model?.name || '';
    const year = formatModelYears(model);
    const chassis = String(model?.generation ?? '').trim();

    selectedEngineIds.value.forEach((engineId) => {
        if (addedEngines.value.some((e) => e.engine_id === engineId)) return;
        const engine = vehicleEnginesList.value.find((e) => e.id === engineId);
        addedEngines.value.push({
            engine_id: engineId,
            make: make?.name || '',
            model: modelName,
            engine: engine?.engine_code || '',
            year,
            chassis,
        });
    });
    selectedEngineIds.value = [];
    emitDraft();
};

const removeEngineDraft = (idx: number) => {
    addedEngines.value.splice(idx, 1);
    emitDraft();
};

const addChassisDraft = () => {
    if (selectedChassisIds.value.length === 0) return;
    const make = vehicleMakes.value.find((m) => m.id === selectedMakeId.value);
    const model = vehicleModels.value.find(
        (m) => m.id === selectedModelId.value,
    );
    const modelName = model?.name || '';
    const year = formatModelYears(model);
    const modelChassis = String(model?.generation ?? '').trim();

    selectedChassisIds.value.forEach((chId) => {
        if (addedChassis.value.some((c) => c.chassis_id === chId)) return;
        const ch = vehicleChassisList.value.find((c) => c.id === chId);
        addedChassis.value.push({
            chassis_id: chId,
            make: make?.name || '',
            model: modelName,
            year,
            chassis: String(ch?.code || '').trim() || modelChassis,
        });
    });
    selectedChassisIds.value = [];
    emitDraft();
};

const removeChassisDraft = (idx: number) => {
    addedChassis.value.splice(idx, 1);
    emitDraft();
};

const toggleUniversalDraft = () => {
    isUniversal.value = !isUniversal.value;
};

// === Live mode actions ===
const fetchCompatibleEngines = async () => {
    if (props.mode !== 'live' || !props.productId) return;
    loadingCompat.value = true;
    try {
        const res = await apiClient.get(
            `/products/${props.productId}/compatibility`,
        );
        const compat = res.data.data ?? [];

        let localAllEngines = false;
        let localAllChassis = false;

        compatibleEngines.value = compat
            .filter((c: any) => c.engine_id)
            .map((c: any) => ({
                id: c.engine?.id ?? c.engine_id,
                compat_id: c.id,
                engine_code: c.engine?.engine_code ?? 'N/A',
                displacement: c.engine?.displacement,
                model: c.engine?.model
                    ? {
                          id: c.engine.model.id,
                          name: c.engine.model.name,
                          year_from: c.engine.model.year_from,
                          year_to: c.engine.model.year_to,
                          generation: c.engine.model.generation,
                          make: c.engine.model.make,
                      }
                    : undefined,
            }));

        compatibleChassis.value = compat
            .filter((c: any) => c.chassis_id)
            .map((c: any) => ({
                id: c.chassis?.id ?? c.chassis_id,
                compat_id: c.id,
                code: c.chassis?.code ?? 'N/A',
                name: c.chassis?.name,
                model: c.chassis?.model
                    ? {
                          id: c.chassis.model.id,
                          name: c.chassis.model.name,
                          year_from: c.chassis.model.year_from,
                          year_to: c.chassis.model.year_to,
                          make: c.chassis.model.make,
                      }
                    : undefined,
            }));

        const allE = compat.find((c: any) => c.all_engines);
        if (allE) localAllEngines = true;
        const allC = compat.find((c: any) => c.all_chassis);
        if (allC) localAllChassis = true;

        allEnginesFlag.value = localAllEngines;
        allChassisFlag.value = localAllChassis;
    } catch {
        compatibleEngines.value = [];
        compatibleChassis.value = [];
    } finally {
        loadingCompat.value = false;
    }
};

const handleAddCompatibilities = async () => {
    if (selectedEngineIds.value.length === 0) return;
    addingCompat.value = true;
    try {
        for (const engineId of selectedEngineIds.value) {
            if (compatibleEngines.value.some((e) => e.id === engineId))
                continue;
            await apiClient.post('/product-compatibility', {
                product_id: props.productId,
                engine_id: engineId,
            });
        }
        await fetchCompatibleEngines();
        selectedEngineIds.value = [];
        toast.success('Motores agregados a la compatibilidad.');
    } catch (e: any) {
        toast.error(
            getApiErrorMessage(e, 'No se pudieron agregar los motores.'),
        );
    } finally {
        addingCompat.value = false;
    }
};

const handleChassisPrimaryAction = async () => {
    if (!selectedModelId.value) return;
    if (!hasAvailableChassisOptions.value) {
        emit('open-inline', 'vehicleChassis');
        return;
    }
    await handleAddChassisCompatibilities();
};

const handleAddChassisCompatibilities = async () => {
    if (selectedChassisIds.value.length === 0) return;
    addingCompat.value = true;
    try {
        for (const chassisId of selectedChassisIds.value) {
            if (compatibleChassis.value.some((c) => c.id === chassisId))
                continue;
            await apiClient.post('/product-compatibility', {
                product_id: props.productId,
                chassis_id: chassisId,
            });
        }
        await fetchCompatibleEngines();
        selectedChassisIds.value = [];
        toast.success('Chasis agregados a la compatibilidad.');
    } catch (e: any) {
        toast.error(
            getApiErrorMessage(e, 'No se pudieron agregar los chasis.'),
        );
    } finally {
        addingCompat.value = false;
    }
};

watch(allEnginesFlag, async (val, oldVal) => {
    if (props.mode !== 'live' || val === oldVal) return;
    try {
        if (val) {
            await apiClient.post('/product-compatibility', {
                product_id: props.productId,
                all_engines: true,
            });
        } else {
            const res = await apiClient.get(
                `/products/${props.productId}/compatibility`,
            );
            const compat = res.data.data ?? [];
            const record = compat.find((c: any) => c.all_engines);
            if (record)
                await apiClient.delete(`/product-compatibility/${record.id}`);
        }
    } catch {
        allEnginesFlag.value = oldVal;
    }
});

watch(allChassisFlag, async (val, oldVal) => {
    if (props.mode !== 'live' || val === oldVal) return;
    try {
        if (val) {
            await apiClient.post('/product-compatibility', {
                product_id: props.productId,
                all_chassis: true,
            });
        } else {
            const res = await apiClient.get(
                `/products/${props.productId}/compatibility`,
            );
            const compat = res.data.data ?? [];
            const record = compat.find((c: any) => c.all_chassis);
            if (record)
                await apiClient.delete(`/product-compatibility/${record.id}`);
        }
    } catch {
        allChassisFlag.value = oldVal;
    }
});

const handleRemoveCompatibility = async (compatId: number) => {
    if (!confirm('¿Eliminar esta compatibilidad?')) return;
    try {
        await apiClient.delete(`/product-compatibility/${compatId}`);
        compatibleEngines.value = compatibleEngines.value.filter(
            (e) => e.compat_id !== compatId,
        );
        compatibleChassis.value = compatibleChassis.value.filter(
            (c) => c.compat_id !== compatId,
        );
    } catch (e) {
        console.error('Error removing compatibility', e);
    }
};

const toggleUniversalLive = async () => {
    try {
        await apiClient.put(`/products/${props.productId}`, {
            is_universal: liveIsUniversal.value,
        });
    } catch (e: any) {
        console.error('Error updating universal status', e);
        liveIsUniversal.value = !liveIsUniversal.value;
    }
};

const liveIsUniversal = ref(false);

const fetchProductUniversalStatus = async () => {
    if (props.mode !== 'live' || !props.productId) return;
    try {
        const res = await apiClient.get(`/products/${props.productId}`);
        const product = res.data.data ?? res.data;
        liveIsUniversal.value = product.is_universal ?? false;
    } catch {
        liveIsUniversal.value = false;
    }
};

// Expose methods for parent to call after inline modal creates new entities
const addMake = (make: VehicleMake) => {
    vehicleMakes.value.push(make);
    selectedMakeId.value = make.id;
};

const addModel = (model: VehicleModelItem) => {
    vehicleModels.value.push(model);
    selectedModelId.value = model.id;
};

const addEngine = (engine: VehicleEngineItem) => {
    vehicleEnginesList.value.push(engine);
    selectedEngineIds.value.push(engine.id);
};

const addChassisToList = (chassis: any) => {
    vehicleChassisList.value.push(chassis);
    selectedChassisIds.value.push(chassis.id);
};

defineExpose({
    addMake,
    addModel,
    addEngine,
    addChassisToList,
    vehicleMakes,
    vehicleModels,
    vehicleEnginesList,
    vehicleChassisList,
    selectedMakeId,
    selectedModelId,
    selectedEngineIds,
    selectedChassisIds,
    addedEngines,
    addedChassis,
    draftAllEngines,
    draftAllChassis,
    draftIsUniversal,
});

onMounted(() => {
    fetchVehicleMakes();
    if (props.mode === 'live') {
        fetchCompatibleEngines();
        fetchProductUniversalStatus();
    }
});
</script>

<template>
    <!-- Draft mode: collapsible wrapper -->
    <div
        v-if="mode === 'draft'"
        class="rounded-xl border border-l-4 border-gray-100 border-l-teal-500 bg-white shadow-sm dark:border-border dark:bg-card"
    >
        <button
            type="button"
            @click="draftExpanded = !draftExpanded"
            class="flex w-full items-center justify-between px-5 py-4 text-left"
        >
            <div class="flex items-center gap-2">
                <span
                    class="text-sm font-semibold text-gray-900 dark:text-white"
                    >Compatibilidad Vehicular</span
                >
                <span
                    v-if="
                        addedEngines.length > 0 ||
                        addedChassis.length > 0 ||
                        draftAllEngines ||
                        draftAllChassis ||
                        draftIsUniversal
                    "
                    class="rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                >
                    {{ compatibilitySummary }}
                </span>
            </div>
            <span class="text-xs text-gray-400">{{
                draftExpanded ? '▲ Colapsar' : '▼ Expandir'
            }}</span>
        </button>

        <div
            v-show="draftExpanded"
            class="space-y-4 border-t border-gray-100 px-5 pt-4 pb-5 dark:border-border"
        >
            <!-- Universal toggle (draft) -->
            <button
                type="button"
                @click="toggleUniversalDraft"
                class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
                :class="
                    draftIsUniversal
                        ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                        : 'border-gray-300 text-gray-600 hover:border-teal-400 dark:border-border dark:text-gray-400'
                "
            >
                <Globe class="h-4 w-4" />
                {{
                    draftIsUniversal
                        ? '✓ Compatible con TODOS los vehículos'
                        : 'Marcar como Universal (TODOS)'
                }}
            </button>

            <div v-if="!draftIsUniversal">
                <!-- Tabs -->
                <div
                    class="mb-4 flex border-b border-gray-200 dark:border-border"
                >
                    <button
                        type="button"
                        @click="compatTab = 'engines'"
                        :class="
                            compatTab === 'engines'
                                ? 'border-teal-500 text-teal-600'
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                        "
                        class="flex w-1/2 items-center justify-center gap-2 border-b-2 px-1 py-2 text-center text-sm font-medium"
                    >
                        🔧 Motores
                    </button>
                    <button
                        type="button"
                        @click="compatTab = 'chassis'"
                        :class="
                            compatTab === 'chassis'
                                ? 'border-teal-500 text-teal-600'
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                        "
                        class="flex w-1/2 items-center justify-center gap-2 border-b-2 px-1 py-2 text-center text-sm font-medium"
                    >
                        🚗 Chasis
                    </button>
                </div>

                <!-- Make / Model row -->
                <div class="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                        <div class="mb-1 flex items-center justify-between">
                            <label
                                class="block text-xs font-medium text-gray-600 dark:text-gray-400"
                                >Marca Vehículo</label
                            >
                            <button
                                type="button"
                                @click="$emit('open-inline', 'vehicleMake')"
                                class="flex items-center gap-0.5 text-xs text-blue-500 hover:underline"
                            >
                                <Plus class="h-3 w-3" />
                            </button>
                        </div>
                        <SearchableSelect
                            :options="makeSelectOptions"
                            :model-value="selectedMakeId"
                            @update:model-value="
                                (v) => (selectedMakeId = v as number | null)
                            "
                            placeholder="Marca"
                            :loading="loadingMakes"
                        />
                    </div>
                    <div>
                        <div class="mb-1 flex items-center justify-between">
                            <label
                                class="block text-xs font-medium text-gray-600 dark:text-gray-400"
                                >Modelo</label
                            >
                            <button
                                v-if="selectedMakeId"
                                type="button"
                                @click="$emit('open-inline', 'vehicleModel')"
                                class="flex items-center gap-0.5 text-xs text-blue-500 hover:underline"
                            >
                                <Plus class="h-3 w-3" />
                            </button>
                        </div>
                        <SearchableSelect
                            :options="modelSelectOptions"
                            :model-value="selectedModelId"
                            @update:model-value="
                                (v) => (selectedModelId = v as number | null)
                            "
                            placeholder="Modelo"
                            :disabled="!selectedMakeId"
                            :loading="loadingModelsV"
                        />
                    </div>
                </div>

                <!-- Engines panel (draft) -->
                <div v-show="compatTab === 'engines'">
                    <div class="mb-3 flex items-center">
                        <label class="flex cursor-pointer items-center gap-2">
                            <input
                                type="checkbox"
                                v-model="draftAllEngines"
                                @change="emitDraft"
                                class="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span
                                class="text-sm font-medium text-gray-700 dark:text-gray-300"
                                >Compatible con TODOS los motores de este
                                modelo</span
                            >
                        </label>
                    </div>
                    <div
                        v-if="!draftAllEngines"
                        class="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4"
                    >
                        <div class="md:col-span-3">
                            <div class="mb-1 flex items-center justify-between">
                                <label
                                    class="block text-xs font-medium text-gray-600 dark:text-gray-400"
                                >
                                    Motores
                                    <span
                                        v-if="selectedEngineIds.length > 0"
                                        class="ml-1 text-teal-600"
                                        >({{
                                            selectedEngineIds.length
                                        }}
                                        seleccionados)</span
                                    >
                                </label>
                                <button
                                    v-if="selectedModelId"
                                    type="button"
                                    @click="
                                        $emit('open-inline', 'vehicleEngine')
                                    "
                                    class="flex items-center gap-0.5 text-xs text-blue-500 hover:underline"
                                >
                                    <Plus class="h-3 w-3" />
                                </button>
                            </div>
                            <div
                                v-if="loadingEnginesV"
                                class="py-4 text-center text-sm text-gray-400"
                            >
                                Cargando motores...
                            </div>
                            <div
                                v-else-if="!selectedModelId"
                                class="rounded-md border py-4 text-center text-sm text-gray-400 dark:border-border"
                            >
                                Selecciona un modelo primero
                            </div>
                            <div
                                v-else-if="vehicleEnginesList.length === 0"
                                class="rounded-md border py-4 text-center text-sm text-gray-400 dark:border-border"
                            >
                                No hay motores disponibles
                            </div>
                            <div
                                v-else
                                class="max-h-40 overflow-y-auto rounded-md border bg-white dark:border-border dark:bg-muted"
                            >
                                <label
                                    v-for="engine in vehicleEnginesList"
                                    :key="engine.id"
                                    class="flex cursor-pointer items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-gray-50 dark:border-border dark:hover:bg-background/50"
                                    :class="{
                                        'bg-teal-50 dark:bg-teal-900/20':
                                            selectedEngineIds.includes(
                                                engine.id,
                                            ),
                                        'opacity-50': addedEngines.some(
                                            (e) => e.engine_id === engine.id,
                                        ),
                                    }"
                                >
                                    <input
                                        type="checkbox"
                                        :value="engine.id"
                                        v-model="selectedEngineIds"
                                        :disabled="
                                            addedEngines.some(
                                                (e) =>
                                                    e.engine_id === engine.id,
                                            )
                                        "
                                        class="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <span
                                        class="font-mono text-sm text-gray-900 dark:text-white"
                                        >{{ engine.engine_code }}</span
                                    >
                                    <span
                                        v-if="engine.displacement"
                                        class="text-xs text-gray-500"
                                        >{{ engine.displacement }}</span
                                    >
                                    <span
                                        v-if="
                                            addedEngines.some(
                                                (e) =>
                                                    e.engine_id === engine.id,
                                            )
                                        "
                                        class="ml-auto text-xs text-teal-600"
                                        >✓ Agregado</span
                                    >
                                </label>
                            </div>
                        </div>
                        <div class="flex items-end">
                            <button
                                type="button"
                                @click="addEnginesDraft"
                                :disabled="selectedEngineIds.length === 0"
                                class="w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40"
                            >
                                + Agregar
                                {{
                                    selectedEngineIds.length > 0
                                        ? `(${selectedEngineIds.length})`
                                        : ''
                                }}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Chassis panel (draft) -->
                <div v-show="compatTab === 'chassis'">
                    <div class="mb-3 flex items-center">
                        <label class="flex cursor-pointer items-center gap-2">
                            <input
                                type="checkbox"
                                v-model="draftAllChassis"
                                @change="emitDraft"
                                class="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span
                                class="text-sm font-medium text-gray-700 dark:text-gray-300"
                                >Compatible con TODOS los chasis de este
                                modelo</span
                            >
                        </label>
                    </div>
                    <div
                        v-if="!draftAllChassis"
                        class="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4"
                    >
                        <div class="md:col-span-3">
                            <div class="mb-1 flex items-center justify-between">
                                <label
                                    class="block text-xs font-medium text-gray-600 dark:text-gray-400"
                                >
                                    Chasis
                                    <span
                                        v-if="selectedChassisIds.length > 0"
                                        class="ml-1 text-teal-600"
                                        >({{
                                            selectedChassisIds.length
                                        }}
                                        seleccionados)</span
                                    >
                                </label>
                                <button
                                    v-if="selectedModelId"
                                    type="button"
                                    @click="
                                        $emit('open-inline', 'vehicleChassis')
                                    "
                                    class="text-xs font-medium text-teal-600 underline-offset-2 hover:text-teal-700 hover:underline"
                                >
                                    ¿No aparece el chasis? Agrégalo aquí
                                </button>
                            </div>
                            <div
                                v-if="!selectedModelId"
                                class="rounded-md border py-4 text-center text-sm text-gray-400 dark:border-border"
                            >
                                Selecciona un modelo primero
                            </div>
                            <div
                                v-else-if="vehicleChassisList.length === 0"
                                class="rounded-md border py-4 text-center text-sm text-gray-400 dark:border-border"
                            >
                                No hay chasis disponibles
                            </div>
                            <div
                                v-else
                                class="max-h-40 overflow-y-auto rounded-md border bg-white dark:border-border dark:bg-muted"
                            >
                                <label
                                    v-for="chassis in vehicleChassisList"
                                    :key="chassis.id"
                                    class="flex cursor-pointer items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-gray-50 dark:border-border dark:hover:bg-background/50"
                                    :class="{
                                        'bg-teal-50 dark:bg-teal-900/20':
                                            selectedChassisIds.includes(
                                                chassis.id,
                                            ),
                                        'opacity-50': addedChassis.some(
                                            (c) => c.chassis_id === chassis.id,
                                        ),
                                    }"
                                >
                                    <input
                                        type="checkbox"
                                        :value="chassis.id"
                                        v-model="selectedChassisIds"
                                        :disabled="
                                            addedChassis.some(
                                                (c) =>
                                                    c.chassis_id === chassis.id,
                                            )
                                        "
                                        class="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <div class="min-w-0 flex-1">
                                        <p
                                            class="truncate text-sm font-semibold text-gray-900 dark:text-white"
                                        >
                                            {{
                                                getChassisOptionDetail(chassis)
                                            }}
                                        </p>
                                        <p
                                            v-if="chassis.name"
                                            class="truncate text-xs text-gray-500"
                                        >
                                            {{ chassis.name }}
                                        </p>
                                    </div>
                                    <span
                                        v-if="
                                            addedChassis.some(
                                                (c) =>
                                                    c.chassis_id === chassis.id,
                                            )
                                        "
                                        class="ml-auto text-xs text-teal-600"
                                        >✓ Agregado</span
                                    >
                                </label>
                            </div>
                        </div>
                        <div class="flex items-end">
                            <button
                                type="button"
                                @click="addChassisDraft"
                                :disabled="selectedChassisIds.length === 0"
                                class="w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40"
                            >
                                + Agregar
                                {{
                                    selectedChassisIds.length > 0
                                        ? `(${selectedChassisIds.length})`
                                        : ''
                                }}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Combined table (draft) -->
                <div
                    v-if="addedEngines.length > 0 || addedChassis.length > 0"
                    class="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-border"
                >
                    <table class="w-full text-left text-xs">
                        <thead class="bg-gray-50 dark:bg-background/50">
                            <tr>
                                <th
                                    class="px-3 py-2 font-semibold text-gray-500 uppercase"
                                >
                                    Tipo
                                </th>
                                <th
                                    class="px-3 py-2 font-semibold text-gray-500 uppercase"
                                >
                                    Vehículo
                                </th>
                                <th
                                    class="px-3 py-2 font-semibold text-gray-500 uppercase"
                                >
                                    Especificación
                                </th>
                                <th class="w-10 px-2 py-2"></th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-100 dark:divide-border/50"
                        >
                            <tr
                                v-for="(eng, idx) in addedEngines"
                                :key="'eng' + eng.engine_id"
                                class="bg-white dark:bg-card"
                            >
                                <td
                                    class="px-3 py-2 text-gray-500 dark:text-gray-400"
                                >
                                    🔧 Motor
                                </td>
                                <td
                                    class="px-3 py-2 text-gray-900 dark:text-white"
                                >
                                    {{ eng.make }} {{ eng.model }}
                                </td>
                                <td
                                    class="px-3 py-2 font-mono text-gray-600 dark:text-gray-400"
                                >
                                    {{ eng.engine }}
                                </td>
                                <td class="px-2 py-2 text-center">
                                    <button
                                        type="button"
                                        @click="removeEngineDraft(idx)"
                                        class="text-red-400 hover:text-red-600"
                                    >
                                        ✕
                                    </button>
                                </td>
                            </tr>
                            <tr
                                v-for="(ch, idx) in addedChassis"
                                :key="'ch' + ch.chassis_id"
                                class="bg-white dark:bg-card"
                            >
                                <td
                                    class="px-3 py-2 text-gray-500 dark:text-gray-400"
                                >
                                    🚗 Chasis
                                </td>
                                <td
                                    class="px-3 py-2 text-gray-900 dark:text-white"
                                >
                                    {{ ch.make }} {{ ch.model }}
                                </td>
                                <td
                                    class="px-3 py-2 font-mono text-gray-600 dark:text-gray-400"
                                >
                                    {{ ch.chassis }}
                                </td>
                                <td class="px-2 py-2 text-center">
                                    <button
                                        type="button"
                                        @click="removeChassisDraft(idx)"
                                        class="text-red-400 hover:text-red-600"
                                    >
                                        ✕
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- Live mode: always visible -->
    <div
        v-else
        class="rounded-lg border-l-4 border-teal-500 bg-white p-6 shadow dark:bg-card"
    >
        <h2
            class="mb-1 flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white"
        >
            <Car class="h-5 w-5 text-teal-600" /> Compatibilidad Vehicular
        </h2>
        <p class="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Agrega los vehículos compatibles con este producto.
        </p>

        <!-- Universal Toggle (live) -->
        <div
            class="mb-6 rounded-lg border-2 border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/30 dark:bg-indigo-900/10"
        >
            <label class="flex cursor-pointer items-center gap-3">
                <div class="relative flex items-center">
                    <input
                        type="checkbox"
                        v-model="liveIsUniversal"
                        @change="toggleUniversalLive"
                        class="peer sr-only"
                    />
                    <div
                        class="h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-indigo-600 peer-focus:ring-2 peer-focus:ring-indigo-300 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-700"
                    ></div>
                </div>
                <div>
                    <p
                        class="flex items-center gap-2 font-medium text-indigo-900 dark:text-indigo-200"
                    >
                        <Globe class="h-4 w-4" /> Compatibilidad Universal
                    </p>
                    <p
                        class="text-sm text-indigo-700/70 dark:text-indigo-400/70"
                    >
                        Marcar si el producto es genérico y aplica a cualquier
                        vehículo o marca.
                    </p>
                </div>
            </label>
        </div>

        <!-- Specific Vehicle Assignment (live) -->
        <div v-show="!liveIsUniversal" class="space-y-6">
            <!-- Make / Model -->
            <div
                class="grid grid-cols-1 gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4 md:grid-cols-2 dark:border-border/50 dark:bg-muted/30"
            >
                <div>
                    <label
                        class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                        >Marca Vehículo</label
                    >
                    <div class="flex gap-1">
                        <SearchableSelect
                            :options="makeSelectOptions"
                            :model-value="selectedMakeId"
                            @update:model-value="
                                (v) => (selectedMakeId = v as number | null)
                            "
                            placeholder="-- Marca --"
                            :loading="loadingMakes"
                        />
                        <button
                            type="button"
                            @click="$emit('open-inline', 'vehicleMake')"
                            class="flex-shrink-0 rounded-md border border-gray-300 bg-white p-2 text-gray-500 transition hover:border-blue-400 hover:text-blue-600 dark:border-border dark:bg-muted dark:hover:text-blue-400"
                            title="Crear nueva marca"
                        >
                            <Plus class="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <div>
                    <label
                        class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                        >Modelo</label
                    >
                    <div class="flex gap-1">
                        <SearchableSelect
                            :options="modelSelectOptions"
                            :model-value="selectedModelId"
                            @update:model-value="
                                (v) => (selectedModelId = v as number | null)
                            "
                            placeholder="-- Modelo --"
                            :disabled="!selectedMakeId"
                            :loading="loadingModelsV"
                        />
                        <button
                            type="button"
                            @click="$emit('open-inline', 'vehicleModel')"
                            :disabled="!selectedMakeId"
                            class="flex-shrink-0 rounded-md border border-gray-300 bg-white p-2 text-gray-500 transition hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-30 dark:border-border dark:bg-muted dark:hover:text-blue-400"
                            title="Crear nuevo modelo"
                        >
                            <Plus class="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- Tabs -->
            <div class="mb-4 flex border-b border-gray-200 dark:border-border">
                <button
                    type="button"
                    @click="compatTab = 'engines'"
                    :class="
                        compatTab === 'engines'
                            ? 'border-teal-500 text-teal-600'
                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    "
                    class="flex w-1/2 items-center justify-center gap-2 border-b-2 px-1 py-2 text-center text-sm font-medium"
                >
                    🔧 Motores
                </button>
                <button
                    type="button"
                    @click="compatTab = 'chassis'"
                    :class="
                        compatTab === 'chassis'
                            ? 'border-teal-500 text-teal-600'
                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    "
                    class="flex w-1/2 items-center justify-center gap-2 border-b-2 px-1 py-2 text-center text-sm font-medium"
                >
                    🚗 Chasis
                </button>
            </div>

            <!-- Engines panel (live) -->
            <div v-show="compatTab === 'engines'" class="space-y-4">
                <div
                    class="flex items-center rounded-lg border border-gray-100 bg-gray-50 p-2 dark:border-border/50 dark:bg-muted/30"
                >
                    <label class="flex cursor-pointer items-center gap-2">
                        <input
                            type="checkbox"
                            v-model="allEnginesFlag"
                            class="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span
                            class="text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Compatible con TODOS los motores de este
                            modelo</span
                        >
                    </label>
                </div>
                <div
                    v-if="!allEnginesFlag"
                    class="grid grid-cols-1 items-end gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4 md:grid-cols-4 dark:border-border/50 dark:bg-muted/30"
                >
                    <div class="md:col-span-3">
                        <div class="mb-1 flex items-center justify-between">
                            <label
                                class="block text-xs font-medium text-gray-700 dark:text-gray-300"
                            >
                                Motores
                                <span
                                    v-if="selectedEngineIds.length > 0"
                                    class="ml-1 text-teal-600"
                                    >({{
                                        selectedEngineIds.length
                                    }}
                                    seleccionados)</span
                                >
                            </label>
                            <button
                                type="button"
                                @click="$emit('open-inline', 'vehicleEngine')"
                                :disabled="!selectedModelId"
                                class="flex items-center gap-0.5 text-xs text-blue-500 hover:underline disabled:cursor-not-allowed disabled:opacity-30"
                                title="Crear nuevo motor"
                            >
                                <Plus class="h-3 w-3" />
                            </button>
                        </div>
                        <div
                            v-if="loadingEnginesV"
                            class="py-4 text-center text-sm text-gray-400"
                        >
                            Cargando motores...
                        </div>
                        <div
                            v-else-if="!selectedModelId"
                            class="rounded-md border py-4 text-center text-sm text-gray-400 dark:border-border"
                        >
                            Selecciona un modelo primero
                        </div>
                        <div
                            v-else-if="vehicleEnginesList.length === 0"
                            class="rounded-md border py-4 text-center text-sm text-gray-400 dark:border-border"
                        >
                            No hay motores disponibles
                        </div>
                        <div
                            v-else
                            class="max-h-40 overflow-y-auto rounded-md border bg-white dark:border-border dark:bg-muted"
                        >
                            <label
                                v-for="engine in vehicleEnginesList"
                                :key="engine.id"
                                class="flex cursor-pointer items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-gray-50 dark:border-border dark:hover:bg-background/50"
                                :class="{
                                    'bg-teal-50 dark:bg-teal-900/20':
                                        selectedEngineIds.includes(engine.id),
                                    'opacity-50': compatibleEngines.some(
                                        (e) => e.id === engine.id,
                                    ),
                                }"
                            >
                                <input
                                    type="checkbox"
                                    :value="engine.id"
                                    v-model="selectedEngineIds"
                                    :disabled="
                                        compatibleEngines.some(
                                            (e) => e.id === engine.id,
                                        )
                                    "
                                    class="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                />
                                <span
                                    class="font-mono text-sm text-gray-900 dark:text-white"
                                    >{{ engine.engine_code }}</span
                                >
                                <span
                                    v-if="engine.displacement"
                                    class="text-xs text-gray-500"
                                    >{{ engine.displacement }}</span
                                >
                                <span
                                    v-if="
                                        compatibleEngines.some(
                                            (e) => e.id === engine.id,
                                        )
                                    "
                                    class="ml-auto text-xs text-teal-600"
                                    >✓ Agregado</span
                                >
                            </label>
                        </div>
                    </div>
                    <div class="flex items-end">
                        <button
                            type="button"
                            @click="handleAddCompatibilities"
                            :disabled="
                                selectedEngineIds.length === 0 || addingCompat
                            "
                            class="w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-40"
                        >
                            {{
                                addingCompat
                                    ? 'Agregando...'
                                    : `+ Agregar ${selectedEngineIds.length > 0 ? `(${selectedEngineIds.length})` : ''}`
                            }}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Chassis panel (live) -->
            <div v-show="compatTab === 'chassis'" class="space-y-4">
                <div
                    class="flex items-center rounded-lg border border-gray-100 bg-gray-50 p-2 dark:border-border/50 dark:bg-muted/30"
                >
                    <label class="flex cursor-pointer items-center gap-2">
                        <input
                            type="checkbox"
                            v-model="allChassisFlag"
                            class="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span
                            class="text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Compatible con TODOS los chasis de este
                            modelo</span
                        >
                    </label>
                </div>
                <div
                    v-if="!allChassisFlag"
                    class="grid grid-cols-1 items-end gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4 md:grid-cols-4 dark:border-border/50 dark:bg-muted/30"
                >
                    <div class="md:col-span-3">
                        <div class="mb-1 flex items-center justify-between">
                            <label
                                class="block text-xs font-medium text-gray-700 dark:text-gray-300"
                            >
                                Chasis
                                <span
                                    v-if="selectedChassisIds.length > 0"
                                    class="ml-1 text-teal-600"
                                    >({{
                                        selectedChassisIds.length
                                    }}
                                    seleccionados)</span
                                >
                            </label>
                            <button
                                type="button"
                                @click="$emit('open-inline', 'vehicleChassis')"
                                :disabled="!selectedModelId"
                                class="text-xs font-medium text-teal-600 underline-offset-2 hover:text-teal-700 hover:underline disabled:cursor-not-allowed disabled:opacity-30"
                                title="Crear nuevo chasis"
                            >
                                ¿No aparece el chasis? Agrégalo aquí
                            </button>
                        </div>
                        <div
                            v-if="!selectedModelId"
                            class="rounded-md border py-4 text-center text-sm text-gray-400 dark:border-border"
                        >
                            Selecciona un modelo primero
                        </div>
                        <div
                            v-else-if="vehicleChassisList.length === 0"
                            class="rounded-md border py-4 text-center text-sm dark:border-border"
                        >
                            <p class="text-gray-500 dark:text-gray-400">
                                No hay chasis disponibles para este modelo.
                            </p>
                            <button
                                type="button"
                                @click="$emit('open-inline', 'vehicleChassis')"
                                class="mt-2 font-medium text-teal-600 underline-offset-2 hover:text-teal-700 hover:underline"
                            >
                                Crear chasis ahora
                            </button>
                        </div>
                        <div
                            v-else
                            class="max-h-40 overflow-y-auto rounded-md border bg-white dark:border-border dark:bg-muted"
                        >
                            <label
                                v-for="chassis in vehicleChassisList"
                                :key="chassis.id"
                                class="flex cursor-pointer items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-gray-50 dark:border-border dark:hover:bg-background/50"
                                :class="{
                                    'bg-teal-50 dark:bg-teal-900/20':
                                        selectedChassisIds.includes(chassis.id),
                                    'opacity-50': compatibleChassis.some(
                                        (c) => c.id === chassis.id,
                                    ),
                                }"
                            >
                                <input
                                    type="checkbox"
                                    :value="chassis.id"
                                    v-model="selectedChassisIds"
                                    :disabled="
                                        compatibleChassis.some(
                                            (c) => c.id === chassis.id,
                                        )
                                    "
                                    class="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                />
                                <div class="min-w-0 flex-1">
                                    <p
                                        class="truncate text-sm font-semibold text-gray-900 dark:text-white"
                                    >
                                        {{ getChassisOptionDetail(chassis) }}
                                    </p>
                                    <p
                                        v-if="chassis.name"
                                        class="truncate text-xs text-gray-500"
                                    >
                                        {{ chassis.name }}
                                    </p>
                                </div>
                                <span
                                    v-if="
                                        compatibleChassis.some(
                                            (c) => c.id === chassis.id,
                                        )
                                    "
                                    class="ml-auto text-xs text-teal-600"
                                    >✓ Agregado</span
                                >
                            </label>
                        </div>
                    </div>
                    <div class="flex items-end">
                        <button
                            type="button"
                            @click="handleChassisPrimaryAction"
                            :disabled="
                                !selectedModelId ||
                                addingCompat ||
                                (hasAvailableChassisOptions &&
                                    selectedChassisIds.length === 0)
                            "
                            class="w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-40"
                        >
                            {{
                                addingCompat
                                    ? 'Agregando...'
                                    : !selectedModelId
                                      ? 'Selecciona modelo'
                                      : !hasAvailableChassisOptions
                                        ? 'Crear Chasis'
                                        : `+ Agregar ${selectedChassisIds.length > 0 ? `(${selectedChassisIds.length})` : ''}`
                            }}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Combined table (live) -->
            <div v-if="loadingCompat" class="py-8 text-center">
                <div
                    class="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-teal-600 border-r-transparent"
                ></div>
            </div>
            <div
                v-else-if="
                    compatibleEngines.length > 0 || compatibleChassis.length > 0
                "
                class="overflow-hidden rounded-lg border border-gray-200 dark:border-border"
            >
                <table class="w-full text-left text-sm">
                    <thead class="bg-gray-50 dark:bg-background/50">
                        <tr>
                            <th
                                class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase"
                            >
                                Tipo
                            </th>
                            <th
                                class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase"
                            >
                                Vehículo
                            </th>
                            <th
                                class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase"
                            >
                                Especificación
                            </th>
                            <th class="w-10 px-2 py-2"></th>
                        </tr>
                    </thead>
                    <tbody
                        class="divide-y divide-gray-100 dark:divide-border/50"
                    >
                        <tr
                            v-for="eng in compatibleEngines"
                            :key="'eng' + eng.id"
                            class="bg-white transition-colors hover:bg-gray-50 dark:bg-card dark:hover:bg-muted/30"
                        >
                            <td
                                class="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400"
                            >
                                🔧 Motor
                            </td>
                            <td
                                class="px-4 py-2 font-medium text-gray-900 dark:text-white"
                            >
                                {{ eng.model?.make?.name ?? 'N/A' }}
                                {{ eng.model?.name ?? 'N/A' }}
                            </td>
                            <td
                                class="px-4 py-2 font-mono text-gray-600 dark:text-gray-400"
                            >
                                {{ eng.engine_code
                                }}<span
                                    v-if="eng.displacement"
                                    class="ml-1 text-xs text-gray-400"
                                    >({{ eng.displacement }})</span
                                >
                            </td>
                            <td class="px-2 py-2 text-center">
                                <button
                                    type="button"
                                    @click="
                                        handleRemoveCompatibility(eng.compat_id)
                                    "
                                    class="text-red-400 transition hover:text-red-600"
                                    title="Eliminar"
                                >
                                    <svg
                                        class="h-4 w-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </td>
                        </tr>
                        <tr
                            v-for="ch in compatibleChassis"
                            :key="'ch' + ch.id"
                            class="bg-white transition-colors hover:bg-gray-50 dark:bg-card dark:hover:bg-muted/30"
                        >
                            <td
                                class="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400"
                            >
                                🚗 Chasis
                            </td>
                            <td
                                class="px-4 py-2 font-medium text-gray-900 dark:text-white"
                            >
                                {{ ch.model?.make?.name ?? 'N/A' }}
                                {{ ch.model?.name ?? 'N/A' }}
                                <span
                                    v-if="formatModelYears(ch.model)"
                                    class="ml-1 text-xs text-gray-500"
                                    >({{ formatModelYears(ch.model) }})</span
                                >
                            </td>
                            <td
                                class="px-4 py-2 font-mono text-gray-600 dark:text-gray-400"
                            >
                                {{ ch.code }}
                                <span
                                    v-if="ch.name"
                                    class="ml-1 text-xs text-gray-500"
                                    >- {{ ch.name }}</span
                                >
                            </td>
                            <td class="px-2 py-2 text-center">
                                <button
                                    type="button"
                                    @click="
                                        handleRemoveCompatibility(ch.compat_id)
                                    "
                                    class="text-red-400 transition hover:text-red-600"
                                    title="Eliminar"
                                >
                                    <svg
                                        class="h-4 w-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div v-else class="py-10 text-center text-gray-400">
                <Car class="mx-auto mb-2 h-8 w-8 text-gray-300" />
                <p class="text-sm">No hay vehículos compatibles asignados</p>
            </div>
        </div>
    </div>
</template>
