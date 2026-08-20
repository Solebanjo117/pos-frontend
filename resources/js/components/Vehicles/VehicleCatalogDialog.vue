<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next';
import { computed, reactive, watch } from 'vue';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogScrollContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import type {
    VehicleCatalogRow,
    VehicleCatalogTab,
    VehicleConfigurationRow,
    VehicleEngineRow,
    VehicleMakeRow,
    VehicleModelRow,
} from '@/composables/useVehicleCatalog';

interface ChassisOption {
    id: number;
    code: string;
    name?: string | null;
}

const props = defineProps<{
    open: boolean;
    tab: VehicleCatalogTab;
    row: VehicleCatalogRow | null;
    makes: VehicleMakeRow[];
    models: VehicleModelRow[];
    engines: VehicleEngineRow[];
    chassis: ChassisOption[];
    processing: boolean;
    error?: string | null;
}>();

const emit = defineEmits<{
    close: [];
    save: [payload: Record<string, unknown>];
}>();

const currentYear = new Date().getFullYear();
const form = reactive({
    name: '',
    make_id: null as number | null,
    model_id: null as number | null,
    engine_id: null as number | null,
    model_ids: [] as number[],
    year_from: currentYear,
    year_to: currentYear,
    generation: '',
    chassis_id: null as number | null,
    engine_code: '',
    displacement: '',
    fuel_type: 'Gasoline',
    aspiration: '',
    vins: [] as Array<{
        id?: number;
        vin: string;
        notes: string;
        linked: boolean;
    }>,
});

const isEditing = computed(() => props.row !== null);
const title = computed(() => {
    const noun = {
        makes: 'marca',
        engines: 'motor',
        models: 'modelo',
        vehicles: 'vehículo',
    }[props.tab];
    return `${isEditing.value ? 'Editar' : 'Nuevo'} ${noun}`;
});

const description = computed(() => {
    if (props.tab === 'vehicles') {
        return 'Relaciona un modelo con un motor y administra sus VIN.';
    }
    return 'Los cambios se aplicarán al catálogo automotriz de HermeX.';
});

const makeOptions = computed<SelectOption[]>(() =>
    props.makes.map((make) => ({ value: make.id, label: make.name })),
);
const modelOptions = computed<SelectOption[]>(() =>
    props.models
        .filter(
            (model) => !form.make_id || model.make_id === Number(form.make_id),
        )
        .map((model) => ({
            value: model.id,
            label: `${model.make?.name ?? ''} ${model.name}`.trim(),
            sublabel: `${model.year_from}-${model.year_to}${model.generation ? ` • ${model.generation}` : ''}`,
        })),
);
const engineOptions = computed<SelectOption[]>(() => {
    const selectedModel = props.models.find(
        (model) => model.id === Number(form.model_id),
    );
    const makeId = selectedModel?.make_id ?? form.make_id;
    return props.engines
        .filter((engine) => !makeId || engine.make_id === Number(makeId))
        .map((engine) => ({
            value: engine.id,
            label: engine.engine_code,
            sublabel: [
                engine.make?.name,
                engine.displacement,
                engine.fuel_type,
                engine.aspiration,
            ]
                .filter(Boolean)
                .join(' • '),
        }));
});
const chassisOptions = computed<SelectOption[]>(() =>
    props.chassis.map((chassis) => ({
        value: chassis.id,
        label: chassis.code,
        sublabel: chassis.name ?? undefined,
    })),
);
const modelsForEngine = computed(() =>
    props.models.filter(
        (model) => !form.make_id || model.make_id === Number(form.make_id),
    ),
);
const pairLocked = computed(
    () => props.tab === 'vehicles' && Boolean(props.row?.delete_block_reason),
);

const resetForm = () => {
    Object.assign(form, {
        name: '',
        make_id: null,
        model_id: null,
        engine_id: null,
        model_ids: [],
        year_from: currentYear,
        year_to: currentYear,
        generation: '',
        chassis_id: null,
        engine_code: '',
        displacement: '',
        fuel_type: 'Gasoline',
        aspiration: '',
        vins: [],
    });

    if (!props.row) return;
    if (props.tab === 'makes') {
        form.name = (props.row as VehicleMakeRow).name;
    } else if (props.tab === 'models') {
        const row = props.row as VehicleModelRow;
        form.name = row.name;
        form.make_id = row.make_id;
        form.year_from = row.year_from;
        form.year_to = row.year_to;
        form.generation = row.generation ?? '';
        form.chassis_id = row.chassis?.[0]?.id ?? null;
    } else if (props.tab === 'engines') {
        const row = props.row as VehicleEngineRow;
        form.make_id = row.make_id;
        form.model_ids =
            row.model_ids ?? row.models?.map((model) => model.id) ?? [];
        form.engine_code = row.engine_code;
        form.displacement = row.displacement ?? '';
        form.fuel_type = row.fuel_type ?? 'Gasoline';
        form.aspiration = row.aspiration ?? '';
    } else {
        const row = props.row as VehicleConfigurationRow;
        form.make_id = row.make.id;
        form.model_id = row.model.id;
        form.engine_id = row.engine.id;
        form.vins = row.vins.map((vin) => ({
            id: vin.id,
            vin: vin.vin,
            notes: vin.notes ?? '',
            linked: Boolean(vin.is_customer_linked),
        }));
    }
};

watch(
    () => [props.open, props.row, props.tab],
    () => {
        if (props.open) resetForm();
    },
    { immediate: true },
);

watch(
    () => form.make_id,
    () => {
        if (!props.open) return;
        if (
            form.model_id &&
            !props.models.some(
                (model) =>
                    model.id === Number(form.model_id) &&
                    model.make_id === Number(form.make_id),
            )
        ) {
            form.model_id = null;
        }
        if (
            form.engine_id &&
            !props.engines.some(
                (engine) =>
                    engine.id === Number(form.engine_id) &&
                    engine.make_id === Number(form.make_id),
            )
        ) {
            form.engine_id = null;
        }
        form.model_ids = form.model_ids.filter((modelId) =>
            props.models.some(
                (model) =>
                    model.id === modelId &&
                    model.make_id === Number(form.make_id),
            ),
        );
    },
);

watch(
    () => form.model_id,
    (modelId) => {
        const model = props.models.find((item) => item.id === Number(modelId));
        if (model) form.make_id = model.make_id;
    },
);

const toggleModel = (modelId: number) => {
    form.model_ids = form.model_ids.includes(modelId)
        ? form.model_ids.filter((id) => id !== modelId)
        : [...form.model_ids, modelId];
};

const addVin = () => {
    form.vins.push({ vin: '', notes: '', linked: false });
};

const removeVin = (index: number) => {
    if (form.vins[index]?.linked) return;
    form.vins.splice(index, 1);
};

const submit = () => {
    if (props.tab === 'makes') {
        emit('save', { name: form.name.trim() });
        return;
    }
    if (props.tab === 'models') {
        emit('save', {
            make_id: form.make_id,
            name: form.name.trim(),
            year_from: Number(form.year_from),
            year_to: Number(form.year_to),
            generation: form.generation.trim() || null,
            chassis_id: form.chassis_id,
        });
        return;
    }
    if (props.tab === 'engines') {
        emit('save', {
            make_id: form.make_id,
            model_ids: form.model_ids,
            engine_code: form.engine_code.trim(),
            displacement: form.displacement.trim() || null,
            fuel_type: form.fuel_type,
            aspiration: form.aspiration.trim() || null,
        });
        return;
    }
    emit('save', {
        model_id: form.model_id,
        engine_id: form.engine_id,
        vins: form.vins
            .filter((vin) => vin.vin.trim())
            .map((vin) => ({
                vin: vin.vin.trim().toUpperCase(),
                notes: vin.notes.trim() || null,
            })),
    });
};
</script>

<template>
    <Dialog :open="open" @update:open="(value) => !value && emit('close')">
        <DialogScrollContent class="max-h-[90vh] sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>{{ title }}</DialogTitle>
                <DialogDescription>{{ description }}</DialogDescription>
            </DialogHeader>

            <form class="space-y-5" @submit.prevent="submit">
                <div v-if="tab === 'makes'" class="space-y-2">
                    <Label for="vehicle-make-name">Nombre de la marca</Label>
                    <Input
                        id="vehicle-make-name"
                        v-model="form.name"
                        required
                        autocomplete="off"
                        placeholder="Ej: Toyota"
                    />
                </div>

                <template v-else-if="tab === 'models'">
                    <div class="space-y-2">
                        <Label>Marca</Label>
                        <SearchableSelect
                            v-model="form.make_id"
                            :options="makeOptions"
                            placeholder="Selecciona una marca"
                        />
                    </div>
                    <div class="space-y-2">
                        <Label for="vehicle-model-name">Modelo</Label>
                        <Input
                            id="vehicle-model-name"
                            v-model="form.name"
                            required
                            placeholder="Ej: Corolla"
                        />
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="space-y-2">
                            <Label for="vehicle-year-from">Año desde</Label>
                            <Input
                                id="vehicle-year-from"
                                v-model.number="form.year_from"
                                type="number"
                                min="1900"
                                :max="currentYear + 2"
                                required
                            />
                        </div>
                        <div class="space-y-2">
                            <Label for="vehicle-year-to">Año hasta</Label>
                            <Input
                                id="vehicle-year-to"
                                v-model.number="form.year_to"
                                type="number"
                                min="1900"
                                :max="currentYear + 2"
                                required
                            />
                        </div>
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="space-y-2">
                            <Label>Chasis configurado</Label>
                            <SearchableSelect
                                v-model="form.chassis_id"
                                :options="chassisOptions"
                                :clearable="true"
                                placeholder="Sin chasis"
                            />
                        </div>
                        <div class="space-y-2">
                            <Label for="vehicle-generation">Generación</Label>
                            <Input
                                id="vehicle-generation"
                                v-model="form.generation"
                                maxlength="20"
                                placeholder="Ej: E170"
                            />
                        </div>
                    </div>
                </template>

                <template v-else-if="tab === 'engines'">
                    <div class="space-y-2">
                        <Label>Marca</Label>
                        <SearchableSelect
                            v-model="form.make_id"
                            :options="makeOptions"
                            placeholder="Selecciona una marca"
                        />
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="space-y-2">
                            <Label for="vehicle-engine-code">Código</Label>
                            <Input
                                id="vehicle-engine-code"
                                v-model="form.engine_code"
                                required
                                placeholder="Ej: 2ZR-FE"
                            />
                        </div>
                        <div class="space-y-2">
                            <Label for="vehicle-engine-displacement"
                                >Desplazamiento</Label
                            >
                            <Input
                                id="vehicle-engine-displacement"
                                v-model="form.displacement"
                                placeholder="Ej: 1.8L"
                            />
                        </div>
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="space-y-2">
                            <Label for="vehicle-engine-fuel">Combustible</Label>
                            <select
                                id="vehicle-engine-fuel"
                                v-model="form.fuel_type"
                                class="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                            >
                                <option value="Gasoline">Gasolina</option>
                                <option value="Diesel">Diésel</option>
                                <option value="Hybrid">Híbrido</option>
                                <option value="Electric">Eléctrico</option>
                            </select>
                        </div>
                        <div class="space-y-2">
                            <Label for="vehicle-engine-aspiration"
                                >Aspiración</Label
                            >
                            <Input
                                id="vehicle-engine-aspiration"
                                v-model="form.aspiration"
                                placeholder="Ej: Turbo"
                            />
                        </div>
                    </div>
                    <fieldset class="space-y-2">
                        <legend class="text-sm font-medium">
                            Modelos relacionados
                        </legend>
                        <div
                            class="max-h-44 space-y-1 overflow-y-auto rounded-lg border p-2"
                        >
                            <label
                                v-for="model in modelsForEngine"
                                :key="model.id"
                                class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                            >
                                <input
                                    type="checkbox"
                                    :checked="form.model_ids.includes(model.id)"
                                    @change="toggleModel(model.id)"
                                />
                                <span>{{ model.name }}</span>
                                <span class="text-muted-foreground"
                                    >{{ model.year_from }}-{{
                                        model.year_to
                                    }}</span
                                >
                            </label>
                            <p
                                v-if="modelsForEngine.length === 0"
                                class="p-2 text-sm text-muted-foreground"
                            >
                                Selecciona una marca para ver sus modelos.
                            </p>
                        </div>
                    </fieldset>
                </template>

                <template v-else>
                    <div
                        v-if="pairLocked"
                        class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                    >
                        {{ row?.delete_block_reason }} El modelo y el motor no
                        pueden trasladarse desde esta configuración.
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="space-y-2">
                            <Label>Modelo</Label>
                            <SearchableSelect
                                v-model="form.model_id"
                                :options="modelOptions"
                                :disabled="pairLocked"
                                placeholder="Selecciona un modelo"
                            />
                        </div>
                        <div class="space-y-2">
                            <Label>Motor</Label>
                            <SearchableSelect
                                v-model="form.engine_id"
                                :options="engineOptions"
                                :disabled="pairLocked || !form.model_id"
                                placeholder="Selecciona un motor"
                            />
                        </div>
                    </div>
                    <div class="space-y-3">
                        <div class="flex items-center justify-between">
                            <Label>VIN registrados</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                @click="addVin"
                            >
                                <Plus class="mr-2 h-4 w-4" />Agregar VIN
                            </Button>
                        </div>
                        <div
                            v-for="(vin, index) in form.vins"
                            :key="vin.id ?? `new-${index}`"
                            class="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]"
                        >
                            <Input
                                v-model="vin.vin"
                                :disabled="vin.linked"
                                maxlength="40"
                                placeholder="VIN"
                                class="font-mono uppercase"
                            />
                            <Input
                                v-model="vin.notes"
                                maxlength="255"
                                placeholder="Notas opcionales"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                :disabled="vin.linked"
                                :title="
                                    vin.linked
                                        ? 'Este VIN está vinculado a un cliente'
                                        : 'Eliminar VIN'
                                "
                                @click="removeVin(index)"
                            >
                                <Trash2 class="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                        <p
                            v-if="form.vins.length === 0"
                            class="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground"
                        >
                            La configuración puede guardarse sin VIN.
                        </p>
                    </div>
                </template>

                <p v-if="error" class="text-sm text-destructive" role="alert">
                    {{ error }}
                </p>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        @click="emit('close')"
                    >
                        Cancelar
                    </Button>
                    <Button type="submit" :disabled="processing">
                        {{ processing ? 'Guardando…' : 'Guardar' }}
                    </Button>
                </DialogFooter>
            </form>
        </DialogScrollContent>
    </Dialog>
</template>
