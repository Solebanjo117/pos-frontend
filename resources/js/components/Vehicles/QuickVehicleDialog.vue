<script setup lang="ts">
import { computed, reactive, ref, watch, useId } from 'vue';
import AppModal from '@/components/ui/AppModal.vue';
import { Button } from '@/components/ui/button';
import ErrorMessage from '@/components/ui/ErrorMessage.vue';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { engineSheet } from '@/composables/useVehicleCatalog';
import apiClient from '@/services/api/client';
import type { VehicleFitmentEntry } from '@/utils/vehicleFitment';

interface MakeOption {
    id: number;
    name: string;
}
interface ModelOption {
    id: number;
    name: string;
    generation?: string | null;
    year_from: number;
    year_to: number | null;
}
interface EngineOption {
    id: number;
    engine_code: string;
    nickname?: string | null;
    displacement?: string | null;
    valves?: string | null;
    cam_type?: string | null;
}

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
    close: [];
    created: [vehicle: VehicleFitmentEntry];
}>();

const currentYear = new Date().getFullYear();
const makes = ref<MakeOption[]>([]);
const models = ref<ModelOption[]>([]);
const engines = ref<EngineOption[]>([]);
const chassisList = ref<Array<{ id: number; code: string }>>([]);
const saving = ref(false);
const errorMessage = ref<string | null>(null);

const form = reactive({
    newMake: false,
    makeId: null as number | null,
    makeName: '',
    newModel: false,
    modelId: null as number | null,
    modelName: '',
    generation: '',
    newChassis: false,
    chassisId: null as number | null,
    yearFrom: currentYear as number | string,
    yearTo: currentYear as number | string,
    newEngine: false,
    engineId: null as number | null,
    engineCode: '',
    nickname: '',
    displacement: '',
    valves: '',
    camType: '',
    cylinders: '' as number | string,
    fuelType: 'Gasoline',
});

const apiError = (err: any, fallback: string): string => {
    const errors = err?.response?.data?.errors;
    const first = errors ? Object.values(errors).flat()[0] : null;
    return String(first ?? err?.response?.data?.message ?? fallback);
};

const reset = () => {
    Object.assign(form, {
        newMake: false,
        makeId: null,
        makeName: '',
        newModel: false,
        modelId: null,
        modelName: '',
        generation: '',
        newChassis: false,
        chassisId: null,
        yearFrom: currentYear,
        yearTo: currentYear,
        newEngine: false,
        engineId: null,
        engineCode: '',
        nickname: '',
        displacement: '',
        valves: '',
        camType: '',
        cylinders: '',
        fuelType: 'Gasoline',
    });
    models.value = [];
    engines.value = [];
    chassisList.value = [];
    errorMessage.value = null;
};

const loadMakes = async () => {
    const { data } = await apiClient.get('/vehicle-makes/all');
    makes.value = data.data ?? [];
};

const loadMakeChildren = async (makeId: number) => {
    const [modelsResponse, enginesResponse, chassisResponse] =
        await Promise.all([
            apiClient.get(`/vehicle-makes/${makeId}/models`),
            apiClient.get('/vehicle-engines', {
                params: { make_id: makeId, per_page: 500 },
            }),
            apiClient.get('/vehicle-chassis', {
                params: { make_id: makeId, per_page: 500 },
            }),
        ]);
    models.value = modelsResponse.data.data ?? [];
    engines.value = enginesResponse.data.data ?? [];
    const seen = new Set<string>();
    chassisList.value = (chassisResponse.data.data ?? [])
        .filter((chassis: { code: string }) => {
            const code = chassis.code.toUpperCase();
            if (seen.has(code)) return false;
            seen.add(code);
            return true;
        })
        .sort((left: { code: string }, right: { code: string }) =>
            left.code.localeCompare(right.code),
        );
};

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) return;
        reset();
        loadMakes().catch(() => {
            errorMessage.value = 'No se pudieron cargar las marcas.';
        });
    },
    { immediate: true },
);

const onMakeChange = (value: string | number | null) => {
    form.makeId = value ? Number(value) : null;
    form.modelId = null;
    form.engineId = null;
    models.value = [];
    engines.value = [];
    chassisList.value = [];
    if (form.makeId) {
        loadMakeChildren(form.makeId).catch(() => {
            errorMessage.value = 'No se pudieron cargar modelos y motores.';
        });
    }
};

const setNewMake = (value: boolean) => {
    form.newMake = value;
    form.makeId = null;
    form.newModel = value || form.newModel;
    form.newEngine = value || form.newEngine;
    form.newChassis = value || form.newChassis;
    form.chassisId = null;
    models.value = [];
    engines.value = [];
    chassisList.value = [];
};

const makeOptions = computed<SelectOption[]>(() =>
    makes.value.map((make) => ({ value: make.id, label: make.name })),
);
const modelOptions = computed<SelectOption[]>(() =>
    models.value.map((model) => ({
        value: model.id,
        label: [model.name, model.generation].filter(Boolean).join(' '),
        sublabel: `${model.year_from}-${model.year_to ?? 'Presente'}`,
    })),
);
const chassisOptions = computed<SelectOption[]>(() =>
    chassisList.value.map((chassis) => ({
        value: chassis.id,
        label: chassis.code,
    })),
);

const engineOptions = computed<SelectOption[]>(() =>
    engines.value.map((engine) => ({
        value: engine.id,
        label: engine.nickname
            ? `${engine.engine_code} (${engine.nickname})`
            : engine.engine_code,
        sublabel: engineSheet(engine) || undefined,
    })),
);

const canSubmit = computed(() => {
    const makeOk = form.newMake ? form.makeName.trim() !== '' : !!form.makeId;
    const modelOk = form.newModel
        ? form.modelName.trim() !== '' &&
          Number(form.yearFrom) >= 1900 &&
          Number(form.yearTo) >= Number(form.yearFrom)
        : !!form.modelId;
    const engineOk = form.newEngine
        ? form.engineCode.trim() !== ''
        : !!form.engineId;
    return makeOk && modelOk && engineOk && !saving.value;
});

const submit = async () => {
    if (!canSubmit.value) return;
    saving.value = true;
    errorMessage.value = null;
    let step = 'la marca';
    try {
        let makeId = form.makeId;
        let makeName = makes.value.find((make) => make.id === makeId)?.name;
        if (form.newMake) {
            const { data } = await apiClient.post('/vehicle-makes', {
                name: form.makeName.trim().toUpperCase(),
            });
            makeId = data.data.id;
            makeName = data.data.name;
        }

        step = 'el modelo';
        let model = models.value.find((item) => item.id === form.modelId);
        if (form.newModel) {
            const { data } = await apiClient.post('/vehicle-models', {
                make_id: makeId,
                name: form.modelName.trim().toUpperCase(),
                // Un solo dato de chasis: uno existente o un código nuevo.
                chassis_id: form.newChassis ? null : form.chassisId,
                generation: form.newChassis
                    ? form.generation.trim().toUpperCase() || null
                    : null,
                year_from: Number(form.yearFrom),
                year_to: Number(form.yearTo),
            });
            model = data.data;
        }

        step = 'el motor';
        let engine = engines.value.find((item) => item.id === form.engineId);
        if (form.newEngine) {
            const { data } = await apiClient.post('/vehicle-engines', {
                make_id: makeId,
                model_ids: [model!.id],
                engine_code: form.engineCode.trim(),
                nickname: form.nickname.trim() || null,
                displacement: form.displacement.trim() || null,
                valves: form.valves.trim() || null,
                cam_type: form.camType || null,
                cylinders:
                    String(form.cylinders).trim() === ''
                        ? null
                        : Number(form.cylinders),
                fuel_type: form.fuelType,
            });
            engine = data.data;
        } else {
            step = 'el vehículo';
            const { data } = await apiClient.get(
                `/vehicle-models/${model!.id}/engines`,
            );
            const alreadyPaired = (data.data ?? []).some(
                (item: { id: number }) => item.id === engine!.id,
            );
            if (!alreadyPaired) {
                await apiClient.post('/vehicle-configurations', {
                    model_id: model!.id,
                    engine_id: engine!.id,
                });
            }
        }

        emit('created', {
            model_id: model!.id,
            engine_id: engine!.id,
            make: makeName ?? '',
            model: model!.name,
            generation: model!.generation ?? null,
            years:
                model!.year_from === model!.year_to
                    ? String(model!.year_from)
                    : `${model!.year_from}-${model!.year_to ?? ''}`,
            engine: engine!.nickname
                ? `${engine!.engine_code} (${engine!.nickname})`
                : engine!.engine_code,
            engine_sheet: engineSheet(engine!),
        });
    } catch (err) {
        errorMessage.value = `No se pudo guardar ${step}: ${apiError(err, 'error inesperado')}`;
    } finally {
        saving.value = false;
    }
};

const toggleClass =
    'text-xs font-medium text-teal-700 hover:underline dark:text-teal-300';
const selectClass =
    'h-9 w-full rounded-md border border-input bg-background px-3 text-sm dark:bg-input/30';

// Id único por instancia: los botones del pie envían el formulario con form="...".
const formId = useId();
</script>

<template>
    <AppModal
        :open="open"
        title="Agregar vehículo"
        description="Se registra en el catálogo de vehículos y queda asignado a este producto."
        size="lg"
        @close="emit('close')"
    >
        <form :id="formId" class="space-y-5" @submit.prevent="submit">
            <!-- Marca -->
            <section class="space-y-2">
                <div class="flex items-center justify-between">
                    <Label>Marca</Label>
                    <button
                        type="button"
                        :class="toggleClass"
                        @click="setNewMake(!form.newMake)"
                    >
                        {{
                            form.newMake
                                ? 'Elegir una existente'
                                : '+ Nueva marca'
                        }}
                    </button>
                </div>
                <Input
                    v-if="form.newMake"
                    id="quick-vehicle-make"
                    v-model="form.makeName"
                    placeholder="Ej: TOYOTA"
                />
                <SearchableSelect
                    v-else
                    :model-value="form.makeId"
                    :options="makeOptions"
                    placeholder="Selecciona una marca"
                    aria-label="Marca"
                    @update:model-value="onMakeChange"
                />
            </section>

            <!-- Modelo -->
            <section class="space-y-2">
                <div class="flex items-center justify-between">
                    <Label>Modelo y chasis</Label>
                    <button
                        v-if="!form.newMake"
                        type="button"
                        :class="toggleClass"
                        @click="form.newModel = !form.newModel"
                    >
                        {{
                            form.newModel
                                ? 'Elegir uno existente'
                                : '+ Nuevo modelo'
                        }}
                    </button>
                </div>
                <div v-if="form.newModel" class="grid gap-3 sm:grid-cols-4">
                    <Input
                        id="quick-vehicle-model"
                        v-model="form.modelName"
                        class="uppercase sm:col-span-2"
                        placeholder="Modelo (ej: COROLLA)"
                    />
                    <div class="space-y-1">
                        <Input
                            v-if="form.newChassis"
                            id="quick-vehicle-chassis-code"
                            v-model="form.generation"
                            maxlength="20"
                            class="uppercase"
                            placeholder="Código de chasis (ej: E110)"
                        />
                        <SearchableSelect
                            v-else
                            :model-value="form.chassisId"
                            :options="chassisOptions"
                            :clearable="true"
                            placeholder="Chasis"
                            aria-label="Chasis"
                            @update:model-value="
                                (value) =>
                                    (form.chassisId = value
                                        ? Number(value)
                                        : null)
                            "
                        />
                        <button
                            v-if="!form.newMake"
                            type="button"
                            :class="toggleClass"
                            @click="
                                form.newChassis = !form.newChassis;
                                form.chassisId = null;
                                form.generation = '';
                            "
                        >
                            {{
                                form.newChassis
                                    ? 'Elegir uno existente'
                                    : '+ Nuevo código'
                            }}
                        </button>
                    </div>
                    <div class="flex items-center gap-1">
                        <Input
                            id="quick-vehicle-year-from"
                            v-model="form.yearFrom"
                            type="number"
                            min="1900"
                            aria-label="Año desde"
                        />
                        <span class="text-gray-400">-</span>
                        <Input
                            id="quick-vehicle-year-to"
                            v-model="form.yearTo"
                            type="number"
                            min="1900"
                            aria-label="Año hasta"
                        />
                    </div>
                </div>
                <SearchableSelect
                    v-else
                    :model-value="form.modelId"
                    :options="modelOptions"
                    :disabled="!form.makeId"
                    placeholder="Selecciona un modelo"
                    aria-label="Modelo"
                    @update:model-value="
                        (value) => (form.modelId = value ? Number(value) : null)
                    "
                />
            </section>

            <!-- Motor -->
            <section class="space-y-2">
                <div class="flex items-center justify-between">
                    <Label>Motor</Label>
                    <button
                        v-if="!form.newMake"
                        type="button"
                        :class="toggleClass"
                        @click="form.newEngine = !form.newEngine"
                    >
                        {{
                            form.newEngine
                                ? 'Elegir uno existente'
                                : '+ Nuevo motor'
                        }}
                    </button>
                </div>
                <div v-if="form.newEngine" class="space-y-3">
                    <div class="grid gap-3 sm:grid-cols-2">
                        <Input
                            id="quick-vehicle-engine-code"
                            v-model="form.engineCode"
                            placeholder="Código (ej: 1ZZFE)"
                        />
                        <Input
                            id="quick-vehicle-engine-nickname"
                            v-model="form.nickname"
                            placeholder="Apodo opcional (ej: CABALLITO)"
                        />
                    </div>
                    <div class="grid gap-3 sm:grid-cols-5">
                        <Input
                            id="quick-vehicle-engine-displacement"
                            v-model="form.displacement"
                            placeholder="Cilindrada (1.8L)"
                        />
                        <Input
                            id="quick-vehicle-engine-valves"
                            v-model="form.valves"
                            placeholder="Válvulas (16V)"
                        />
                        <select
                            id="quick-vehicle-engine-cam"
                            v-model="form.camType"
                            :class="selectClass"
                            aria-label="Árbol de levas"
                        >
                            <option value="">Árbol —</option>
                            <option value="SOHC">SOHC</option>
                            <option value="DOHC">DOHC</option>
                            <option value="OHV">OHV</option>
                        </select>
                        <Input
                            id="quick-vehicle-engine-cylinders"
                            v-model="form.cylinders"
                            type="number"
                            min="1"
                            max="16"
                            placeholder="Cilindros"
                        />
                        <select
                            id="quick-vehicle-engine-fuel"
                            v-model="form.fuelType"
                            :class="selectClass"
                            aria-label="Combustible"
                        >
                            <option value="Gasoline">Gasolina</option>
                            <option value="Diesel">Diésel</option>
                            <option value="Hybrid">Híbrido</option>
                            <option value="Electric">Eléctrico</option>
                        </select>
                    </div>
                </div>
                <SearchableSelect
                    v-else
                    :model-value="form.engineId"
                    :options="engineOptions"
                    :disabled="!form.makeId"
                    placeholder="Selecciona un motor"
                    aria-label="Motor"
                    @update:model-value="
                        (value) =>
                            (form.engineId = value ? Number(value) : null)
                    "
                />
            </section>

            <ErrorMessage v-if="errorMessage" role="alert">
                {{ errorMessage }}
            </ErrorMessage>
        </form>

        <template #footer>
            <Button type="button" variant="outline" @click="emit('close')">
                Cancelar
            </Button>
            <Button type="submit" :form="formId" :disabled="!canSubmit">
                {{ saving ? 'Guardando…' : 'Agregar y asignar' }}
            </Button>
        </template>
    </AppModal>
</template>
