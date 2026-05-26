<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import {
    Plus,
    Pencil,
    Trash2,
    ChevronRight,
    ChevronDown,
    Hash,
    X,
    Car,
    Search,
    Upload,
} from 'lucide-vue-next';
import { ref, computed, onMounted } from 'vue';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { useVehicleChassis } from '@/composables/useVehicleChassis';
import {
    useVehicleEngines,
    type VehicleEngine,
} from '@/composables/useVehicleEngines';
import {
    useVehicleMakes,
    type VehicleMake,
} from '@/composables/useVehicleMakes';
import {
    useVehicleModels,
    type VehicleModel,
} from '@/composables/useVehicleModels';
import { useVehicleVins, type VehicleVin } from '@/composables/useVehicleVins';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Vehículos', href: '/vehicles' },
];

const FUEL_TYPE_OPTIONS = [
    { value: 'Gasoline', label: 'Gasolina' },
    { value: 'Diesel', label: 'Diesel' },
    { value: 'Hybrid', label: 'Hibrido' },
    { value: 'Electric', label: 'Electrico' },
] as const;

// ── Composables ──────────────────────────────────────────────────────────────
const { makes, fetchMakes, createMake, updateMake, deleteMake } =
    useVehicleMakes();
const { models, fetchModels, createModel, updateModel, deleteModel } =
    useVehicleModels();
const { engines, fetchEngines, createEngine, updateEngine, deleteEngine } =
    useVehicleEngines();
const { chassisList, fetchChassis } = useVehicleChassis();

// ── UI state ─────────────────────────────────────────────────────────────────
const search = ref('');
const expandedMakes = ref<Set<number>>(new Set());
const expandedModels = ref<Set<number>>(new Set());
const expandedEngines = ref<Set<number>>(new Set());
const loadingModels = ref<Record<number, boolean>>({});
const loadingEngines = ref<Record<number, boolean>>({});

// Store models/engines per make/model locally for the tree
const modelsByMake = ref<Record<number, VehicleModel[]>>({});
const enginesByModel = ref<Record<number, VehicleEngine[]>>({});
const treeEngineVins = ref<Record<string, VehicleVin[]>>({});
const treeEngineVinsLoading = ref<Record<string, boolean>>({});
const treeEngineVinDraft = ref<Record<string, string>>({});
const treeEngineVinAdding = ref<Record<string, boolean>>({});
const treeEngineVinError = ref<Record<string, string | null>>({});
const treeEngineVinApis: Record<string, ReturnType<typeof useVehicleVins>> = {};

const treeEngineVinKey = (modelId: number, engineId: number): string =>
    `${modelId}:${engineId}`;

const clearRecordsForEngine = <T,>(
    source: Record<string, T>,
    engineId: number,
): Record<string, T> => {
    return Object.fromEntries(
        Object.entries(source).filter(([key]) => !key.endsWith(`:${engineId}`)),
    );
};

const setTreeEngineVinError = (key: string, message: string | null) => {
    treeEngineVinError.value = {
        ...treeEngineVinError.value,
        [key]: message,
    };
};

const getTreeEngineVinApi = (modelId: number, engineId: number) => {
    const key = treeEngineVinKey(modelId, engineId);

    if (!treeEngineVinApis[key]) {
        treeEngineVinApis[key] = useVehicleVins({
            modelId,
            engineId,
        });
    }

    return treeEngineVinApis[key];
};

const loadTreeEngineVins = async (
    modelId: number,
    engineId: number,
    force = false,
) => {
    const key = treeEngineVinKey(modelId, engineId);

    if (!force && treeEngineVins.value[key]) {
        return;
    }

    const api = getTreeEngineVinApi(modelId, engineId);
    treeEngineVinsLoading.value = {
        ...treeEngineVinsLoading.value,
        [key]: true,
    };
    setTreeEngineVinError(key, null);

    try {
        await api.fetchVins();
        treeEngineVins.value = {
            ...treeEngineVins.value,
            [key]: [...api.vins.value],
        };
    } catch (e: any) {
        setTreeEngineVinError(
            key,
            e.response?.data?.message ||
                api.error.value ||
                'No se pudieron cargar los VINs',
        );
    } finally {
        treeEngineVinsLoading.value = {
            ...treeEngineVinsLoading.value,
            [key]: false,
        };
    }
};

const clearTreeEngineVinState = (engineId: number) => {
    expandedEngines.value.delete(engineId);
    expandedEngines.value = new Set(expandedEngines.value);
    treeEngineVins.value = clearRecordsForEngine(
        treeEngineVins.value,
        engineId,
    );
    treeEngineVinsLoading.value = clearRecordsForEngine(
        treeEngineVinsLoading.value,
        engineId,
    );
    treeEngineVinDraft.value = clearRecordsForEngine(
        treeEngineVinDraft.value,
        engineId,
    );
    treeEngineVinAdding.value = clearRecordsForEngine(
        treeEngineVinAdding.value,
        engineId,
    );
    treeEngineVinError.value = clearRecordsForEngine(
        treeEngineVinError.value,
        engineId,
    );
    for (const key of Object.keys(treeEngineVinApis)) {
        if (key.endsWith(`:${engineId}`)) {
            delete treeEngineVinApis[key];
        }
    }
};

// ── Search filter ─────────────────────────────────────────────────────────────
const filteredMakes = computed(() => {
    if (!search.value.trim()) return makes.value;
    const q = search.value.toLowerCase();
    return makes.value.filter(
        (m) =>
            m.name.toLowerCase().includes(q) ||
            (modelsByMake.value[m.id] ?? []).some((mod) =>
                mod.name.toLowerCase().includes(q),
            ),
    );
});

onMounted(async () => {
    await Promise.all([fetchMakes({ per_page: 200 }), loadAllChassis()]);
});

// ── Tree toggle ───────────────────────────────────────────────────────────────
const toggleMake = async (makeId: number) => {
    if (expandedMakes.value.has(makeId)) {
        expandedMakes.value.delete(makeId);
    } else {
        expandedMakes.value.add(makeId);
        if (!modelsByMake.value[makeId]) {
            loadingModels.value[makeId] = true;
            const res = await fetchModels({ make_id: makeId, per_page: 200 });
            modelsByMake.value[makeId] =
                res?.data ?? models.value.filter((m) => m.make_id === makeId);
            loadingModels.value[makeId] = false;
        }
    }
    expandedMakes.value = new Set(expandedMakes.value); // trigger reactivity
};

const toggleModel = async (modelId: number) => {
    if (expandedModels.value.has(modelId)) {
        expandedModels.value.delete(modelId);
    } else {
        expandedModels.value.add(modelId);
        if (!enginesByModel.value[modelId]) {
            loadingEngines.value[modelId] = true;
            const res = await fetchEngines({
                model_id: modelId,
                per_page: 200,
            });
            enginesByModel.value[modelId] =
                res?.data ??
                engines.value.filter((e) => e.model_id === modelId);
            loadingEngines.value[modelId] = false;
        }
    }
    expandedModels.value = new Set(expandedModels.value);
};

const toggleEngine = async (modelId: number, engineId: number) => {
    if (expandedEngines.value.has(engineId)) {
        expandedEngines.value.delete(engineId);
    } else {
        expandedEngines.value.add(engineId);
        await loadTreeEngineVins(modelId, engineId);
    }

    expandedEngines.value = new Set(expandedEngines.value);
};

// ── Modals ────────────────────────────────────────────────────────────────────
type ModalType = 'make' | 'model' | 'engine' | 'quickEngine' | null;
const modalType = ref<ModalType>(null);
const processing = ref(false);
const modalError = ref<string | null>(null);

// Context
const activeMakeId = ref<number | null>(null);
const activeModelId = ref<number | null>(null);
const editingId = ref<number | null>(null);

// Forms
const makeForm = ref({ name: '' });
const modelForm = ref({
    name: '',
    year_from: new Date().getFullYear(),
    year_to: new Date().getFullYear(),
    generation: '',
});
const engineForm = ref({
    engine_code: '',
    displacement: '',
    fuel_type: 'Gasoline',
});

// ── All engines for SearchableSelect ──────────────────────────────────────────
const allEngines = ref<VehicleEngine[]>([]);
const allEnginesLoading = ref(false);
const selectedEngineId = ref<number | null>(null);

// ── All chassis for model modal SearchableSelect ─────────────────────────────
const allChassisLoading = ref(false);
const selectedModelChassisId = ref<number | null>(null);

const loadAllChassis = async () => {
    allChassisLoading.value = true;
    try {
        await fetchChassis({ per_page: 500 });
    } finally {
        allChassisLoading.value = false;
    }
};

const loadAllEngines = async () => {
    allEnginesLoading.value = true;
    try {
        const res = await fetchEngines({ per_page: 500 });
        allEngines.value = res?.data ?? engines.value;
    } finally {
        allEnginesLoading.value = false;
    }
};

// Options for SearchableSelect (excluding already assigned to this model)
const engineSelectOptions = computed<SelectOption[]>(() => {
    const assignedIds = new Set(
        (enginesByModel.value[activeModelId.value ?? 0] ?? []).map((e) => e.id),
    );
    const makeId = resolveModelMakeId(activeModelId.value);

    return allEngines.value
        .filter(
            (e) =>
                !assignedIds.has(e.id) &&
                (makeId === null || getEngineMakeIds(e).includes(makeId)),
        )
        .map((e) => ({
            value: e.id,
            label: e.engine_code,
            sublabel:
                [e.displacement, e.fuel_type].filter(Boolean).join(' • ') ||
                undefined,
        }));
});

const chassisSelectOptions = computed<SelectOption[]>(() => {
    return [...chassisList.value]
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((chassis) => {
            const yearLabel =
                chassis.year_from || chassis.year_to
                    ? `${chassis.year_from || '?'}-${chassis.year_to || '?'}`
                    : '';

            const vehicleLabel = [
                chassis.model?.make?.name,
                chassis.model?.name,
            ]
                .filter(Boolean)
                .join(' ');

            const sublabel = [chassis.name, vehicleLabel, yearLabel]
                .filter((part) => Boolean(part && String(part).trim()))
                .join(' • ');

            return {
                value: chassis.id,
                label: chassis.code,
                sublabel: sublabel || undefined,
            };
        });
});

const syncSelectedChassisFromGeneration = () => {
    const generationCode = modelForm.value.generation?.trim();
    if (!generationCode) {
        selectedModelChassisId.value = null;
        return;
    }

    const match = chassisList.value.find(
        (chassis) =>
            chassis.code.toLowerCase() === generationCode.toLowerCase(),
    );
    selectedModelChassisId.value = match?.id ?? null;
};

const handleModelChassisChange = (value: number | string | null) => {
    const chassisId = typeof value === 'number' ? value : null;
    selectedModelChassisId.value = chassisId;

    if (!chassisId) {
        modelForm.value.generation = '';
        return;
    }

    const selected = chassisList.value.find(
        (chassis) => chassis.id === chassisId,
    );
    modelForm.value.generation = selected?.code ?? '';
};

const handleModelGenerationInput = () => {
    const generationCode = modelForm.value.generation?.trim();
    if (!generationCode) {
        selectedModelChassisId.value = null;
        return;
    }

    const match = chassisList.value.find(
        (chassis) =>
            chassis.code.toLowerCase() === generationCode.toLowerCase(),
    );
    selectedModelChassisId.value = match?.id ?? null;
};

const openMakeCreate = () => {
    editingId.value = null;
    makeForm.value = { name: '' };
    modalType.value = 'make';
    modalError.value = null;
};
const openMakeEdit = (m: VehicleMake) => {
    editingId.value = m.id;
    makeForm.value = { name: m.name };
    modalType.value = 'make';
    modalError.value = null;
};

const openModelCreate = (makeId: number) => {
    activeMakeId.value = makeId;
    editingId.value = null;
    modelForm.value = {
        name: '',
        year_from: new Date().getFullYear(),
        year_to: new Date().getFullYear(),
        generation: '',
    };
    selectedModelChassisId.value = null;
    if (chassisList.value.length === 0) {
        void loadAllChassis();
    }
    modalType.value = 'model';
    modalError.value = null;
};
const openModelEdit = async (model: VehicleModel) => {
    activeMakeId.value = model.make_id;
    editingId.value = model.id;
    modelForm.value = {
        name: model.name,
        year_from: model.year_from ?? new Date().getFullYear(),
        year_to: model.year_to ?? new Date().getFullYear(),
        generation: model.generation ?? '',
    };
    if (chassisList.value.length === 0) {
        await loadAllChassis();
    }
    // Prefer the authoritative chassis relation from the API over generation-based lookup
    if (model.chassis && model.chassis.length > 0) {
        selectedModelChassisId.value = model.chassis[0].id;
    } else {
        syncSelectedChassisFromGeneration();
    }
    modalType.value = 'model';
    modalError.value = null;
};

const openEngineCreate = async (modelId: number) => {
    activeModelId.value = modelId;
    editingId.value = null;
    selectedEngineId.value = null;
    duplicateConfirmed.value = false;
    modalType.value = 'engine';
    modalError.value = null;
    // Load all available engines
    await loadAllEngines();
};
const openEngineEdit = async (engine: VehicleEngine, modelId?: number) => {
    activeModelId.value = modelId ?? engine.model_id;
    editingId.value = engine.id;
    engineForm.value = {
        engine_code: engine.engine_code,
        displacement: engine.displacement,
        fuel_type: engine.fuel_type || 'Gasoline',
    };
    duplicateConfirmed.value = false;
    modalType.value = 'engine';
    modalError.value = null;
};

// Quick Add Engine Modal
const openQuickEngineCreate = () => {
    engineForm.value = {
        engine_code: '',
        displacement: '',
        fuel_type: 'Gasoline',
    };
    duplicateConfirmed.value = false;
    modalType.value = 'quickEngine';
    modalError.value = null;
};

const closeModal = () => {
    modalType.value = null;
    selectedEngineId.value = null;
    duplicateConfirmed.value = false;
};

// R20: Check for duplicates helper
const duplicateConfirmed = ref(false);

const checkMakeDuplicate = (name: string): boolean => {
    return makes.value.some(
        (m) =>
            m.name.toLowerCase().trim() === name.toLowerCase().trim() &&
            m.id !== editingId.value,
    );
};

const checkModelDuplicate = (name: string, makeId: number): boolean => {
    const modelsInMake = modelsByMake.value[makeId] ?? [];
    return modelsInMake.some(
        (m) =>
            m.name.toLowerCase().trim() === name.toLowerCase().trim() &&
            m.id !== editingId.value,
    );
};

const getEngineModelIds = (engine: VehicleEngine): number[] => {
    if (Array.isArray(engine.model_ids) && engine.model_ids.length > 0) {
        return Array.from(
            new Set(
                engine.model_ids
                    .map((id) => Number(id))
                    .filter((id) => Number.isInteger(id) && id > 0),
            ),
        );
    }

    if (engine.model_id !== null) {
        return [engine.model_id];
    }

    return [];
};

const resolveModelMakeId = (modelId: number | null): number | null => {
    if (!modelId) return null;

    for (const [makeId, models] of Object.entries(modelsByMake.value)) {
        if (models.some((model) => model.id === modelId)) {
            return Number(makeId);
        }
    }

    const model = models.value.find((item) => item.id === modelId);
    return model?.make_id ?? null;
};

const getEngineMakeIds = (engine: VehicleEngine): number[] => {
    const makeIds = new Set<number>();

    if (engine.make_id) makeIds.add(engine.make_id);
    if (engine.make?.id) makeIds.add(engine.make.id);
    if (engine.model?.make?.id) makeIds.add(engine.model.make.id);

    engine.models?.forEach((model) => {
        if (model.make?.id) makeIds.add(model.make.id);
    });

    return Array.from(makeIds);
};

const checkEngineDuplicate = (
    code: string,
    modelId: number | null,
): boolean => {
    const normalizedCode = code.toLowerCase().trim();
    const makeId = resolveModelMakeId(modelId);

    return allEngines.value.some(
        (e) =>
            e.engine_code.toLowerCase().trim() === normalizedCode &&
            e.id !== editingId.value &&
            (makeId === null || getEngineMakeIds(e).includes(makeId)),
    );
};

// Make submit
const submitMake = async () => {
    // R20: Check for duplicate
    if (
        !editingId.value &&
        !duplicateConfirmed.value &&
        checkMakeDuplicate(makeForm.value.name)
    ) {
        const confirm = window.confirm(
            `⚠️ Ya existe una marca con el nombre "${makeForm.value.name}".\n\n¿Desea crear una marca duplicada?`,
        );
        if (!confirm) return;
        duplicateConfirmed.value = true;
    }

    processing.value = true;
    modalError.value = null;
    try {
        if (editingId.value) {
            const updated = await updateMake(editingId.value, makeForm.value);
            const idx = makes.value.findIndex((m) => m.id === editingId.value);
            if (idx !== -1) makes.value[idx] = updated;
        } else {
            await createMake(makeForm.value);
            // makes array is automatically updated by the composable
        }
        closeModal();
        duplicateConfirmed.value = false;
    } catch (e: any) {
        modalError.value = e.response?.data?.message || 'Error';
    } finally {
        processing.value = false;
    }
};

// Model submit
const submitModel = async () => {
    // R20: Check for duplicate
    if (
        !editingId.value &&
        !duplicateConfirmed.value &&
        checkModelDuplicate(modelForm.value.name, activeMakeId.value!)
    ) {
        const makeName =
            makes.value.find((m) => m.id === activeMakeId.value)?.name || '';
        const confirm = window.confirm(
            `⚠️ Ya existe un modelo "${modelForm.value.name}" en la marca ${makeName}.\n\n¿Desea crear un modelo duplicado?`,
        );
        if (!confirm) return;
        duplicateConfirmed.value = true;
    }

    processing.value = true;
    modalError.value = null;
    try {
        const payload = {
            ...modelForm.value,
            make_id: activeMakeId.value!,
            chassis_id: selectedModelChassisId.value,
        };
        if (editingId.value) {
            const updated = await updateModel(editingId.value, payload);
            const list = modelsByMake.value[activeMakeId.value!] ?? [];
            const idx = list.findIndex((m) => m.id === editingId.value);
            if (idx !== -1) list[idx] = updated;
        } else {
            const created = await createModel(payload);
            if (!modelsByMake.value[activeMakeId.value!])
                modelsByMake.value[activeMakeId.value!] = [];
            // Prevent duplicate pushes if composable is also tracking it
            if (
                !modelsByMake.value[activeMakeId.value!].find(
                    (m) => m.id === created.id,
                )
            ) {
                modelsByMake.value[activeMakeId.value!].push(created);
            }
        }
        closeModal();
        duplicateConfirmed.value = false;
    } catch (e: any) {
        modalError.value = e.response?.data?.message || 'Error';
    } finally {
        processing.value = false;
    }
};

// Assign existing engine to model (update engine's model_id)
const assignEngineToModel = async () => {
    if (!selectedEngineId.value || !activeModelId.value) return;
    processing.value = true;
    modalError.value = null;
    try {
        const selectedEngine = allEngines.value.find(
            (engine) => engine.id === selectedEngineId.value,
        );
        const existingModelIds = selectedEngine
            ? getEngineModelIds(selectedEngine)
            : [];
        const nextModelIds = Array.from(
            new Set([...existingModelIds, activeModelId.value]),
        );
        const makeId = resolveModelMakeId(activeModelId.value);

        const updated = await updateEngine(selectedEngineId.value, {
            make_id: makeId,
            model_id: nextModelIds[0] ?? activeModelId.value,
            model_ids: nextModelIds,
        });

        // Add to local tree
        if (!enginesByModel.value[activeModelId.value])
            enginesByModel.value[activeModelId.value] = [];
        if (
            !enginesByModel.value[activeModelId.value].find(
                (e) => e.id === updated.id,
            )
        ) {
            enginesByModel.value[activeModelId.value].push(updated);
        }

        const allEnginesIndex = allEngines.value.findIndex(
            (engine) => engine.id === updated.id,
        );
        if (allEnginesIndex !== -1) {
            allEngines.value[allEnginesIndex] = updated;
        }

        selectedEngineId.value = null;
        await loadAllEngines();
        closeModal();
    } catch (e: any) {
        modalError.value = e.response?.data?.message || 'Error';
    } finally {
        processing.value = false;
    }
};

// Engine submit (edit mode only, or quick-create)
const submitEngine = async () => {
    const normalizedEngineCode = engineForm.value.engine_code.trim();
    if (!normalizedEngineCode) {
        modalError.value = 'El codigo del motor es obligatorio.';
        return;
    }

    // R20: Check for duplicate engine code
    if (
        !editingId.value &&
        !duplicateConfirmed.value &&
        checkEngineDuplicate(normalizedEngineCode, activeModelId.value)
    ) {
        const modelName = models.value.find(
            (model) => model.id === activeModelId.value,
        )?.name;
        const confirm = window.confirm(
            `⚠️ Ya existe un motor con el código "${normalizedEngineCode}"${modelName ? ` en el modelo ${modelName}` : ''}.\n\n¿Desea crear un motor duplicado?`,
        );
        if (!confirm) return;
        duplicateConfirmed.value = true;
    }

    processing.value = true;
    modalError.value = null;
    try {
        const normalizedDisplacement = engineForm.value.displacement.trim();
        const normalizedFuelType = engineForm.value.fuel_type || 'Gasoline';
        const modelIds = activeModelId.value ? [activeModelId.value] : [];
        const makeId = resolveModelMakeId(activeModelId.value);

        const payload = {
            make_id: makeId,
            model_id: activeModelId.value,
            model_ids: modelIds,
            engine_code: normalizedEngineCode,
            displacement: normalizedDisplacement || undefined,
            fuel_type: normalizedFuelType,
            aspiration: 'N/A',
        };
        if (editingId.value) {
            // Editing existing engine
            const updated = await updateEngine(editingId.value, payload);
            const list = enginesByModel.value[activeModelId.value!] ?? [];
            const idx = list.findIndex((e) => e.id === editingId.value);
            if (idx !== -1) list[idx] = updated;
        } else {
            // Quick create new engine
            const created = await createEngine(payload);

            // Add to allEngines so it appears in future searches
            if (!allEngines.value.find((e) => e.id === created.id)) {
                allEngines.value.push(created);
            }

            if (activeModelId.value) {
                // Add to model's engine list
                if (!enginesByModel.value[activeModelId.value])
                    enginesByModel.value[activeModelId.value] = [];
                if (
                    !enginesByModel.value[activeModelId.value].find(
                        (e) => e.id === created.id,
                    )
                ) {
                    enginesByModel.value[activeModelId.value].push(created);
                }
            }
        }
        closeModal();
        duplicateConfirmed.value = false;
    } catch (e: any) {
        modalError.value = e.response?.data?.message || 'Error';
    } finally {
        processing.value = false;
    }
};

// Delete helpers
const handleDeleteMake = async (make: VehicleMake) => {
    if (
        !confirm(
            `¿Eliminar marca "${make.name}"? Se eliminarán sus modelos y motores.`,
        )
    )
        return;
    try {
        await deleteMake(make.id);
        makes.value = makes.value.filter((m) => m.id !== make.id);
    } catch {
        alert('No se pudo eliminar.');
    }
};
const handleDeleteModel = async (model: VehicleModel) => {
    if (!confirm(`¿Eliminar modelo "${model.name}"?`)) return;
    try {
        await deleteModel(model.id);
        if (modelsByMake.value[model.make_id]) {
            modelsByMake.value[model.make_id] = modelsByMake.value[
                model.make_id
            ].filter((m) => m.id !== model.id);
        }
    } catch {
        alert('No se pudo eliminar.');
    }
};
const handleDeleteEngine = async (engine: VehicleEngine) => {
    if (!confirm(`¿Eliminar motor "${engine.engine_code}"?`)) return;
    try {
        await deleteEngine(engine.id);
        if (engine.model_id !== null && enginesByModel.value[engine.model_id]) {
            enginesByModel.value[engine.model_id] = enginesByModel.value[
                engine.model_id
            ].filter((e) => e.id !== engine.id);
        }
        clearTreeEngineVinState(engine.id);
    } catch {
        alert('No se pudo eliminar.');
    }
};

const handleAddTreeEngineVin = async (modelId: number, engineId: number) => {
    const key = treeEngineVinKey(modelId, engineId);
    const normalized = (treeEngineVinDraft.value[key] ?? '').trim();
    if (normalized.length < 1 || normalized.length > 40) return;

    const api = getTreeEngineVinApi(modelId, engineId);
    treeEngineVinAdding.value = {
        ...treeEngineVinAdding.value,
        [key]: true,
    };
    setTreeEngineVinError(key, null);

    try {
        await api.addVin(normalized.toUpperCase());
        treeEngineVins.value = {
            ...treeEngineVins.value,
            [key]: [...api.vins.value],
        };
        treeEngineVinDraft.value = {
            ...treeEngineVinDraft.value,
            [key]: '',
        };
    } catch (e: any) {
        setTreeEngineVinError(
            key,
            e.response?.data?.message ||
                api.error.value ||
                'VIN invalido o duplicado',
        );
    } finally {
        treeEngineVinAdding.value = {
            ...treeEngineVinAdding.value,
            [key]: false,
        };
    }
};

const handleRemoveTreeEngineVin = async (
    modelId: number,
    engineId: number,
    vinId: number,
) => {
    const key = treeEngineVinKey(modelId, engineId);
    const api = getTreeEngineVinApi(modelId, engineId);
    setTreeEngineVinError(key, null);

    try {
        await api.removeVin(vinId);
        treeEngineVins.value = {
            ...treeEngineVins.value,
            [key]: [...api.vins.value],
        };
    } catch (e: any) {
        setTreeEngineVinError(
            key,
            e.response?.data?.message ||
                api.error.value ||
                'No se pudo eliminar el VIN',
        );
    }
};
</script>

<template>
    <Head title="Gestión de Vehículos" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-5xl space-y-6 p-6">
            <!-- Page Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1
                        class="text-2xl font-semibold text-gray-900 dark:text-white"
                    >
                        Gestión de Vehículos
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Marcas → Carros/Modelos → Motores → VINs
                    </p>
                </div>
                <Button @click="openMakeCreate">
                    <Plus class="mr-2 h-4 w-4" /> Nueva Marca
                </Button>
                <a href="/vehicles/import">
                    <Button variant="outline">
                        <Upload class="mr-2 h-4 w-4" /> Importar
                    </Button>
                </a>
            </div>

            <!-- Search -->
            <div class="relative max-w-sm">
                <Search
                    class="absolute top-2.5 left-2.5 h-4 w-4 text-gray-400"
                />
                <Input
                    v-model="search"
                    placeholder="Buscar marca o modelo..."
                    class="pl-9"
                />
            </div>

            <!-- Vehicle Tree -->
            <div
                class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-background"
            >
                <!-- Empty state -->
                <div
                    v-if="filteredMakes.length === 0"
                    class="flex flex-col items-center justify-center py-16 text-center text-gray-400"
                >
                    <Car class="mb-3 h-10 w-10" />
                    <p class="text-sm">
                        No hay marcas de vehículos registradas.
                    </p>
                    <Button class="mt-4" @click="openMakeCreate"
                        ><Plus class="mr-2 h-4 w-4" />Agregar Marca</Button
                    >
                </div>

                <!-- Makes list -->
                <div
                    v-for="(make, makeIdx) in filteredMakes"
                    :key="make.id"
                    :class="
                        makeIdx > 0
                            ? 'border-t border-gray-200 dark:border-border'
                            : ''
                    "
                >
                    <!-- Make row -->
                    <div
                        class="flex cursor-pointer items-center gap-2 px-4 py-3 hover:bg-gray-50 dark:hover:bg-card/50"
                        @click="toggleMake(make.id)"
                    >
                        <button class="text-gray-400">
                            <ChevronDown
                                v-if="expandedMakes.has(make.id)"
                                class="h-4 w-4"
                            />
                            <ChevronRight v-else class="h-4 w-4" />
                        </button>
                        <span
                            class="flex-1 font-semibold text-gray-900 dark:text-white"
                            >{{ make.name }}</span
                        >
                        <div class="flex items-center gap-1" @click.stop>
                            <Button
                                variant="ghost"
                                size="icon"
                                class="h-7 w-7"
                                @click="openModelCreate(make.id)"
                                title="Nuevo Modelo"
                            >
                                <Plus class="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                class="h-7 w-7"
                                @click="openMakeEdit(make)"
                            >
                                <Pencil class="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                class="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-700"
                                @click="handleDeleteMake(make)"
                            >
                                <Trash2 class="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>

                    <!-- Models -->
                    <div v-if="expandedMakes.has(make.id)">
                        <div
                            v-if="loadingModels[make.id]"
                            class="py-3 pl-12 text-sm text-gray-400"
                        >
                            Cargando modelos...
                        </div>

                        <div
                            v-else-if="
                                (modelsByMake[make.id] ?? []).length === 0
                            "
                            class="py-3 pl-12 text-sm text-gray-400"
                        >
                            Sin modelos.
                            <button
                                class="text-blue-500 underline"
                                @click="openModelCreate(make.id)"
                            >
                                Agregar
                            </button>
                        </div>

                        <div
                            v-for="model in modelsByMake[make.id] ?? []"
                            :key="model.id"
                            :class="[
                                'border-t border-gray-100 dark:border-border',
                            ]"
                        >
                            <!-- Model row -->
                            <div
                                class="flex cursor-pointer items-center gap-2 py-2.5 pr-4 pl-10 hover:bg-gray-50 dark:hover:bg-card/50"
                                @click="toggleModel(model.id)"
                            >
                                <button class="text-gray-400">
                                    <ChevronDown
                                        v-if="expandedModels.has(model.id)"
                                        class="h-4 w-4"
                                    />
                                    <ChevronRight v-else class="h-4 w-4" />
                                </button>
                                <span
                                    class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200"
                                >
                                    {{ model.name }}
                                    <span
                                        v-if="model.generation"
                                        class="ml-1 font-mono text-xs text-indigo-500 dark:text-indigo-400"
                                        >{{ model.generation }}</span
                                    >
                                    <span
                                        v-if="model.year_from"
                                        class="ml-1 text-xs text-gray-400"
                                        >({{ model.year_from }}–{{
                                            model.year_to ?? 'Pres.'
                                        }})</span
                                    >
                                </span>
                                <div
                                    class="flex items-center gap-1"
                                    @click.stop
                                >
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="h-7 w-7"
                                        @click="openEngineCreate(model.id)"
                                        title="Nuevo Motor"
                                    >
                                        <Plus class="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="h-7 w-7"
                                        @click="openModelEdit(model)"
                                    >
                                        <Pencil class="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-700"
                                        @click="handleDeleteModel(model)"
                                    >
                                        <Trash2 class="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            <!-- Engines -->
                            <div v-if="expandedModels.has(model.id)">
                                <div
                                    v-if="loadingEngines[model.id]"
                                    class="py-2 pl-20 text-xs text-gray-400"
                                >
                                    Cargando motores...
                                </div>

                                <div
                                    v-else-if="
                                        (enginesByModel[model.id] ?? [])
                                            .length === 0
                                    "
                                    class="py-2 pl-20 text-xs text-gray-400"
                                >
                                    Sin motores.
                                    <button
                                        class="text-blue-500 underline"
                                        @click="openEngineCreate(model.id)"
                                    >
                                        Agregar
                                    </button>
                                </div>

                                <div
                                    v-for="engine in enginesByModel[model.id] ??
                                    []"
                                    :key="engine.id"
                                    class="border-t border-gray-100 dark:border-border"
                                >
                                    <div
                                        class="flex cursor-pointer items-center gap-2 py-2 pr-4 pl-20 hover:bg-gray-50/50 dark:hover:bg-card/30"
                                        @click="
                                            toggleEngine(model.id, engine.id)
                                        "
                                    >
                                        <button class="text-gray-400">
                                            <ChevronDown
                                                v-if="
                                                    expandedEngines.has(
                                                        engine.id,
                                                    )
                                                "
                                                class="h-4 w-4"
                                            />
                                            <ChevronRight
                                                v-else
                                                class="h-4 w-4"
                                            />
                                        </button>
                                        <div class="flex-1">
                                            <span
                                                class="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200"
                                                >{{ engine.engine_code }}</span
                                            >
                                            <span
                                                v-if="engine.displacement"
                                                class="ml-2 text-xs text-gray-500"
                                                >{{ engine.displacement }}</span
                                            >
                                        </div>
                                        <div
                                            class="flex items-center gap-1"
                                            @click.stop
                                        >
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                class="h-7 w-7"
                                                @click="
                                                    openEngineEdit(
                                                        engine,
                                                        model.id,
                                                    )
                                                "
                                                title="Editar motor"
                                            >
                                                <Pencil class="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                class="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-700"
                                                @click="
                                                    handleDeleteEngine(engine)
                                                "
                                            >
                                                <Trash2 class="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div
                                        v-if="expandedEngines.has(engine.id)"
                                        class="space-y-2 border-t border-gray-100 bg-gray-50/60 py-3 pr-4 pl-28 dark:border-border dark:bg-card/20"
                                    >
                                        <div class="flex items-center gap-2">
                                            <Hash
                                                class="h-3.5 w-3.5 text-gray-400"
                                            />
                                            <span
                                                class="text-xs font-semibold text-gray-700 dark:text-gray-200"
                                                >VINs de configuración</span
                                            >
                                            <span
                                                class="ml-auto text-[11px] text-gray-400"
                                                >Modelo + Motor</span
                                            >
                                        </div>

                                        <div class="flex gap-2">
                                            <Input
                                                v-model="
                                                    treeEngineVinDraft[
                                                        treeEngineVinKey(
                                                            model.id,
                                                            engine.id,
                                                        )
                                                    ]
                                                "
                                                maxlength="40"
                                                placeholder="VIN (hasta 40 caracteres)"
                                                class="font-mono text-xs uppercase"
                                                @keyup.enter="
                                                    handleAddTreeEngineVin(
                                                        model.id,
                                                        engine.id,
                                                    )
                                                "
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                :disabled="
                                                    (
                                                        treeEngineVinDraft[
                                                            treeEngineVinKey(
                                                                model.id,
                                                                engine.id,
                                                            )
                                                        ] ?? ''
                                                    ).trim().length < 1 ||
                                                    (
                                                        treeEngineVinDraft[
                                                            treeEngineVinKey(
                                                                model.id,
                                                                engine.id,
                                                            )
                                                        ] ?? ''
                                                    ).trim().length > 40 ||
                                                    treeEngineVinAdding[
                                                        treeEngineVinKey(
                                                            model.id,
                                                            engine.id,
                                                        )
                                                    ]
                                                "
                                                @click="
                                                    handleAddTreeEngineVin(
                                                        model.id,
                                                        engine.id,
                                                    )
                                                "
                                            >
                                                <Plus class="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <p
                                            v-if="
                                                (
                                                    treeEngineVinDraft[
                                                        treeEngineVinKey(
                                                            model.id,
                                                            engine.id,
                                                        )
                                                    ] ?? ''
                                                ).length > 0
                                            "
                                            class="text-[11px] text-gray-500"
                                        >
                                            {{
                                                (
                                                    treeEngineVinDraft[
                                                        treeEngineVinKey(
                                                            model.id,
                                                            engine.id,
                                                        )
                                                    ] ?? ''
                                                ).length
                                            }}
                                            / 40 caracteres
                                        </p>
                                        <p
                                            v-if="
                                                treeEngineVinError[
                                                    treeEngineVinKey(
                                                        model.id,
                                                        engine.id,
                                                    )
                                                ]
                                            "
                                            class="text-[11px] text-red-600"
                                        >
                                            {{
                                                treeEngineVinError[
                                                    treeEngineVinKey(
                                                        model.id,
                                                        engine.id,
                                                    )
                                                ]
                                            }}
                                        </p>

                                        <div
                                            v-if="
                                                treeEngineVinsLoading[
                                                    treeEngineVinKey(
                                                        model.id,
                                                        engine.id,
                                                    )
                                                ]
                                            "
                                            class="py-1 text-xs text-gray-400"
                                        >
                                            Cargando VINs...
                                        </div>
                                        <div
                                            v-else-if="
                                                (
                                                    treeEngineVins[
                                                        treeEngineVinKey(
                                                            model.id,
                                                            engine.id,
                                                        )
                                                    ] ?? []
                                                ).length === 0
                                            "
                                            class="py-1 text-xs text-gray-400"
                                        >
                                            Sin VINs registrados para esta
                                            configuración.
                                        </div>
                                        <ul
                                            v-else
                                            class="max-h-40 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200 bg-white dark:divide-border dark:border-border dark:bg-background"
                                        >
                                            <li
                                                v-for="v in treeEngineVins[
                                                    treeEngineVinKey(
                                                        model.id,
                                                        engine.id,
                                                    )
                                                ] ?? []"
                                                :key="v.id"
                                                class="flex items-center justify-between px-3 py-1.5 text-xs"
                                            >
                                                <div
                                                    class="min-w-0 flex-1 truncate"
                                                >
                                                    <span
                                                        class="font-mono tracking-wide text-gray-800 dark:text-gray-200"
                                                        >{{ v.vin }}</span
                                                    >
                                                    <span
                                                        v-if="v.notes"
                                                        class="ml-2 text-gray-500 dark:text-gray-400"
                                                        >{{ v.notes }}</span
                                                    >
                                                </div>
                                                <button
                                                    type="button"
                                                    class="ml-2 text-red-500 hover:text-red-700"
                                                    @click="
                                                        handleRemoveTreeEngineVin(
                                                            model.id,
                                                            engine.id,
                                                            v.id,
                                                        )
                                                    "
                                                >
                                                    <X class="h-3.5 w-3.5" />
                                                </button>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ── Modal: Make ── -->
        <Dialog
            :open="modalType === 'make'"
            @update:open="
                (v) => {
                    if (!v) closeModal();
                }
            "
        >
            <DialogContent class="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{{
                        editingId ? 'Editar Marca' : 'Nueva Marca'
                    }}</DialogTitle>
                </DialogHeader>
                <form
                    @submit.prevent="submitMake"
                    @keydown.enter="
                        (e: KeyboardEvent) => {
                            if ((e.target as HTMLElement)?.tagName === 'INPUT')
                                e.preventDefault();
                        }
                    "
                    class="space-y-4 py-2"
                >
                    <div class="space-y-2">
                        <Label>Nombre</Label>
                        <Input
                            v-model="makeForm.name"
                            required
                            placeholder="Ej: Toyota, Honda"
                        />
                    </div>
                    <div v-if="modalError" class="text-sm text-red-600">
                        {{ modalError }}
                    </div>
                    <div class="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            @click="closeModal"
                            >Cancelar</Button
                        >
                        <Button type="submit" :disabled="processing">{{
                            processing ? 'Guardando...' : 'Guardar'
                        }}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>

        <!-- ── Modal: Model ── -->
        <Dialog
            :open="modalType === 'model'"
            @update:open="
                (v) => {
                    if (!v) closeModal();
                }
            "
        >
            <DialogContent class="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{{
                        editingId ? 'Editar Modelo' : 'Nuevo Modelo'
                    }}</DialogTitle>
                </DialogHeader>
                <form
                    @submit.prevent="submitModel"
                    @keydown.enter="
                        (e: KeyboardEvent) => {
                            if ((e.target as HTMLElement)?.tagName === 'INPUT')
                                e.preventDefault();
                        }
                    "
                    class="space-y-4 py-2"
                >
                    <div class="space-y-2">
                        <Label>Nombre del Modelo</Label>
                        <Input
                            v-model="modelForm.name"
                            required
                            placeholder="Ej: Corolla, Civic, Hilux"
                        />
                    </div>
                    <div class="grid grid-cols-3 gap-4">
                        <div class="space-y-2">
                            <Label>Año Desde</Label>
                            <Input
                                v-model.number="modelForm.year_from"
                                type="number"
                                placeholder="2005"
                            />
                        </div>
                        <div class="space-y-2">
                            <Label>Año Hasta</Label>
                            <Input
                                v-model.number="modelForm.year_to"
                                type="number"
                                placeholder="2024"
                            />
                        </div>
                        <div class="space-y-2">
                            <Label>Chasis</Label>
                            <SearchableSelect
                                :model-value="selectedModelChassisId"
                                :options="chassisSelectOptions"
                                :loading="allChassisLoading"
                                :clearable="true"
                                placeholder="Selecciona chasis"
                                search-placeholder="Buscar por código o descripción..."
                                loading-text="Cargando chasis..."
                                @update:model-value="handleModelChassisChange"
                            />
                            <Input
                                v-model="modelForm.generation"
                                placeholder="O escribe codigo de chasis (ej: E170)"
                                maxlength="20"
                                @input="handleModelGenerationInput"
                            />
                        </div>
                    </div>
                    <p class="text-xs text-gray-500">
                        El chasis se sincroniza automáticamente con la
                        generación del modelo.
                    </p>
                    <div v-if="modalError" class="text-sm text-red-600">
                        {{ modalError }}
                    </div>
                    <div class="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            @click="closeModal"
                            >Cancelar</Button
                        >
                        <Button type="submit" :disabled="processing">{{
                            processing ? 'Guardando...' : 'Guardar'
                        }}</Button>
                    </div>
                </form>

                <div v-if="editingId" class="border-t pt-4">
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                        Los VINs se registran desde el árbol, bajo cada motor,
                        cuando el modelo tiene chasis asignado.
                    </p>
                </div>
            </DialogContent>
        </Dialog>

        <!-- ── Modal: Engine (Select existing + Quick Add) ── -->
        <Dialog
            :open="modalType === 'engine'"
            @update:open="
                (v) => {
                    if (!v) closeModal();
                }
            "
        >
            <DialogContent class="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{{
                        editingId ? 'Editar Motor' : 'Asignar Motor'
                    }}</DialogTitle>
                    <DialogDescription>{{
                        editingId
                            ? 'Editar datos del motor'
                            : 'Selecciona un motor existente o crea uno nuevo'
                    }}</DialogDescription>
                </DialogHeader>

                <!-- Mode: Assign existing engine (when not editing) -->
                <div v-if="!editingId" class="space-y-4 py-2">
                    <div class="space-y-2">
                        <Label>Motor</Label>
                        <div class="flex gap-2">
                            <div class="flex-1">
                                <SearchableSelect
                                    v-model="selectedEngineId"
                                    :options="engineSelectOptions"
                                    :loading="allEnginesLoading"
                                    placeholder="Buscar motor..."
                                    loadingText="Cargando motores..."
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                @click="openQuickEngineCreate"
                                title="Crear motor nuevo"
                            >
                                <Plus class="h-4 w-4" />
                            </Button>
                        </div>
                        <p
                            v-if="
                                engineSelectOptions.length === 0 &&
                                !allEnginesLoading
                            "
                            class="text-xs text-gray-500"
                        >
                            No hay motores disponibles.
                            <button
                                type="button"
                                class="text-blue-500 underline"
                                @click="openQuickEngineCreate"
                            >
                                Crear uno nuevo
                            </button>
                        </p>
                    </div>
                    <div v-if="modalError" class="text-sm text-red-600">
                        {{ modalError }}
                    </div>
                    <div class="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            @click="closeModal"
                            >Cancelar</Button
                        >
                        <Button
                            type="button"
                            :disabled="!selectedEngineId || processing"
                            @click="assignEngineToModel"
                        >
                            {{ processing ? 'Asignando...' : 'Asignar Motor' }}
                        </Button>
                    </div>
                </div>

                <!-- Mode: Edit existing engine -->
                <form
                    v-else
                    @submit.prevent="submitEngine"
                    @keydown.enter="
                        (e: KeyboardEvent) => {
                            if ((e.target as HTMLElement)?.tagName === 'INPUT')
                                e.preventDefault();
                        }
                    "
                    class="space-y-4 py-2"
                >
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <Label>Motor</Label>
                            <Input
                                v-model="engineForm.engine_code"
                                required
                                placeholder="Ej: 2AZ-FE, K20A"
                            />
                        </div>
                        <div class="space-y-2">
                            <Label>Desplazamiento</Label>
                            <Input
                                v-model="engineForm.displacement"
                                placeholder="Ej: 2.4L"
                            />
                        </div>
                    </div>
                    <div class="space-y-2">
                        <Label>Combustible</Label>
                        <Input
                            v-model="engineForm.fuel_type"
                            placeholder="Ej: Gasolina, Diesel"
                        />
                    </div>

                    <div class="border-t pt-4">
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                            Los VINs se registran desde el árbol principal, bajo
                            cada motor, cuando el modelo tiene chasis asignado.
                        </p>
                    </div>

                    <div v-if="modalError" class="text-sm text-red-600">
                        {{ modalError }}
                    </div>
                    <div class="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            @click="closeModal"
                            >Cancelar</Button
                        >
                        <Button type="submit" :disabled="processing">{{
                            processing ? 'Guardando...' : 'Actualizar'
                        }}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>

        <!-- ── Modal: Quick Add Engine ── -->
        <Dialog
            :open="modalType === 'quickEngine'"
            @update:open="
                (v) => {
                    if (!v) {
                        modalType = 'engine';
                        duplicateConfirmed = false;
                        modalError = null;
                    }
                }
            "
        >
            <DialogContent class="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Crear Motor Rápido</DialogTitle>
                    <DialogDescription
                        >El motor se creará y asignará al
                        modelo</DialogDescription
                    >
                </DialogHeader>
                <form
                    @submit.prevent="submitEngine"
                    @keydown.enter="
                        (e: KeyboardEvent) => {
                            if ((e.target as HTMLElement)?.tagName === 'INPUT')
                                e.preventDefault();
                        }
                    "
                    class="space-y-4 py-2"
                >
                    <div class="space-y-2">
                        <Label
                            >Código Motor
                            <span class="text-red-500">*</span></Label
                        >
                        <Input
                            v-model="engineForm.engine_code"
                            required
                            placeholder="Ej: 2AZ-FE, K20A"
                        />
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <Label>Desplazamiento</Label>
                            <Input
                                v-model="engineForm.displacement"
                                placeholder="Ej: 2.4L"
                            />
                        </div>
                        <div class="space-y-2">
                            <Label>Combustible</Label>
                            <select
                                v-model="engineForm.fuel_type"
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                            >
                                <option
                                    v-for="option in FUEL_TYPE_OPTIONS"
                                    :key="`quick-fuel-${option.value}`"
                                    :value="option.value"
                                >
                                    {{ option.label }}
                                </option>
                            </select>
                        </div>
                    </div>
                    <div v-if="modalError" class="text-sm text-red-600">
                        {{ modalError }}
                    </div>
                    <div class="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            @click="
                                () => {
                                    modalType = 'engine';
                                    duplicateConfirmed = false;
                                    modalError = null;
                                }
                            "
                            >Cancelar</Button
                        >
                        <Button
                            type="submit"
                            :disabled="
                                processing || !engineForm.engine_code.trim()
                            "
                        >
                            {{ processing ? 'Creando...' : 'Crear Motor' }}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>
