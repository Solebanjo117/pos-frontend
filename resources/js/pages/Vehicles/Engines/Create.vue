<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3';
import { computed, onMounted, ref, watch } from 'vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import {
    useVehicleEngines,
    VEHICLE_ENGINE_FUEL_TYPE_OPTIONS,
    buildVehicleEnginePayload,
    normalizeVehicleEngineCode,
    normalizeVehicleEngineFuelType,
} from '@/composables/useVehicleEngines';
import { useAuth } from '@/composables/useAuth';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import { type BreadcrumbItem } from '@/types';

interface VehicleModelItem {
    id: number;
    make_id?: number;
    name: string;
    year_from?: number | string | null;
    year_to?: number | string | null;
    make?: {
        id: number;
        name: string;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Vehiculos', href: '/vehicles' },
    { title: 'Motores', href: '/vehicles/engines' },
    { title: 'Crear', href: '/vehicles/engines/create' },
];

const { engines, createEngine, fetchEngines, loading, error } =
    useVehicleEngines();
const { hasRole } = useAuth();

const FUEL_TYPE_OPTIONS = VEHICLE_ENGINE_FUEL_TYPE_OPTIONS;
const canManageVehicleCatalog = computed(() => hasRole(['admin', 'manager']));

const form = ref({
    make_id: null as number | null,
    engine_code: '',
    displacement: '',
    fuel_type: normalizeVehicleEngineFuelType(null),
    model_ids: [] as number[],
});

const makes = ref<{ id: number; name: string }[]>([]);
const models = ref<VehicleModelItem[]>([]);
const modelSearch = ref('');
const loadingModels = ref(false);

const makeOptions = computed<SelectOption[]>(() => [
    ...makes.value.map((make) => ({ value: make.id, label: make.name })),
]);

const modelsById = computed(() => {
    return new Map(models.value.map((model) => [model.id, model]));
});

const normalizeYear = (year?: number | string | null): string => {
    if (year === null || year === undefined) return '';
    return String(year).trim();
};

const formatModelYears = (model: VehicleModelItem): string => {
    const yearFrom = normalizeYear(model.year_from);
    const yearTo = normalizeYear(model.year_to);

    if (!yearFrom && !yearTo) return '';
    return `${yearFrom || '?'}-${yearTo || '?'}`;
};

const formatModelLabel = (model: VehicleModelItem): string => {
    const makeName = model.make?.name?.trim();
    return [makeName, model.name].filter(Boolean).join(' ');
};

const filteredModels = computed(() => {
    const query = modelSearch.value.trim().toLowerCase();

    const filtered = models.value.filter((model) => {
        const matchesMake =
            !form.value.make_id ||
            model.make?.id === form.value.make_id ||
            model.make_id === form.value.make_id;
        if (!matchesMake) return false;

        if (!query) return true;

        const haystack = [model.name, model.make?.name, formatModelYears(model)]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return haystack.includes(query);
    });

    return filtered.sort((a, b) =>
        formatModelLabel(a).localeCompare(formatModelLabel(b)),
    );
});

const selectedModels = computed(() => {
    return form.value.model_ids
        .map((id) => modelsById.value.get(id))
        .filter((model): model is VehicleModelItem => Boolean(model));
});

const fetchMakes = async () => {
    try {
        const { data } = await apiClient.get('/vehicle-makes');
        makes.value = data.data ?? [];
    } catch {
        makes.value = [];
    }
};

const fetchAllModels = async () => {
    loadingModels.value = true;

    try {
        const collected: VehicleModelItem[] = [];
        let page = 1;
        let lastPage = 1;

        do {
            const { data } = await apiClient.get('/vehicle-models', {
                params: { page, per_page: 200 },
            });

            const pageItems = (data.data ?? []) as VehicleModelItem[];
            collected.push(...pageItems);

            lastPage = Number(data.meta?.last_page ?? 1);
            page += 1;
        } while (page <= lastPage);

        const uniqueById = new Map<number, VehicleModelItem>();
        collected.forEach((model) => uniqueById.set(model.id, model));
        models.value = Array.from(uniqueById.values());
    } catch {
        models.value = [];
    } finally {
        loadingModels.value = false;
    }
};

onMounted(() => {
    fetchMakes();
    fetchAllModels();
    fetchEngines({ per_page: 500 }); // Duplicate code guard
});

watch(
    () => form.value.make_id,
    (makeId) => {
        form.value.model_ids = form.value.model_ids.filter((modelId) => {
            const model = modelsById.value.get(modelId);
            return Boolean(
                makeId &&
                model &&
                (model.make?.id === makeId || model.make_id === makeId),
            );
        });
    },
);

const duplicateConfirmed = ref(false);

const getEngineModelIds = (engine: {
    model_id?: number | null;
    model_ids?: number[];
}): number[] => {
    if (Array.isArray(engine.model_ids) && engine.model_ids.length > 0) {
        return Array.from(
            new Set(
                engine.model_ids
                    .map((id) => Number(id))
                    .filter((id) => Number.isInteger(id) && id > 0),
            ),
        );
    }

    if (engine.model_id !== null && engine.model_id !== undefined) {
        return [engine.model_id];
    }

    return [];
};

const checkDuplicate = (code: string, selectedModelIds: number[]): boolean => {
    const normalizedCode = normalizeVehicleEngineCode(code).toLowerCase();

    return engines.value.some((engine) => {
        if (
            normalizeVehicleEngineCode(engine.engine_code).toLowerCase() !==
            normalizedCode
        ) {
            return false;
        }

        const existingModelIds = getEngineModelIds(engine);

        // For independent engines (no model association), only collide with other independent engines.
        if (selectedModelIds.length === 0) {
            return existingModelIds.length === 0;
        }

        return selectedModelIds.some((modelId) =>
            existingModelIds.includes(modelId),
        );
    });
};

const handleSubmit = async () => {
    if (!canManageVehicleCatalog.value) {
        error.value =
            'No tienes permisos para crear motores. Solo admin y manager pueden hacerlo.';
        return;
    }

    const payload = buildVehicleEnginePayload({
        make_id: form.value.make_id,
        engine_code: form.value.engine_code,
        displacement: form.value.displacement,
        fuel_type: form.value.fuel_type,
        model_ids: form.value.model_ids,
        aspiration: 'N/A',
    });

    if (!payload.engine_code) {
        error.value = 'El codigo del motor es obligatorio.';
        return;
    }

    if (!payload.make_id) {
        error.value = 'Selecciona la marca de vehiculo del motor.';
        return;
    }

    if (
        !duplicateConfirmed.value &&
        checkDuplicate(payload.engine_code, payload.model_ids)
    ) {
        const confirm = window.confirm(
            `Ya existe un motor con el codigo "${payload.engine_code}" para al menos uno de los modelos seleccionados.\n\nDesea crear un motor duplicado?`,
        );
        if (!confirm) return;
        duplicateConfirmed.value = true;
    }

    try {
        await createEngine(payload);
        router.visit('/vehicles/engines');
    } catch {
        duplicateConfirmed.value = false;
    }
};
</script>

<template>
    <Head title="Crear Motor" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-3xl space-y-6 p-6">
            <div>
                <h1
                    class="text-2xl font-semibold text-gray-900 dark:text-white"
                >
                    Crear Nuevo Motor
                </h1>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Los motores son reutilizables y pueden asociarse a
                    compatibilidad vehicular.
                </p>
            </div>

            <div
                v-if="error"
                class="rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            >
                {{ error }}
            </div>

            <div
                v-if="!canManageVehicleCatalog"
                class="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200"
            >
                Solo administradores y managers pueden crear motores. Este
                formulario esta en modo solo lectura para tu rol.
            </div>

            <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                <form
                    @submit.prevent="handleSubmit"
                    @keydown.enter="
                        (e: KeyboardEvent) => {
                            if ((e.target as HTMLElement)?.tagName === 'INPUT')
                                e.preventDefault();
                        }
                    "
                    class="space-y-6"
                >
                    <div>
                        <label
                            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            Marca de vehiculo
                            <span class="text-red-500">*</span>
                        </label>
                        <div class="mt-1">
                            <SearchableSelect
                                v-model="form.make_id"
                                :options="makeOptions"
                                placeholder="Selecciona marca"
                            />
                        </div>
                        <p class="mt-1 text-xs text-gray-500">
                            La marca se administra en Carros y se reutiliza en
                            el catalogo de motores.
                        </p>
                    </div>

                    <div>
                        <label
                            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            Codigo de Motor <span class="text-red-500">*</span>
                        </label>
                        <input
                            v-model="form.engine_code"
                            type="text"
                            required
                            placeholder="Ej: 2ZR-FE, K20A, 1GR-FE"
                            class="mt-1 block w-full rounded-md border-gray-300 font-mono shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                        />
                        <p class="mt-1 text-xs text-gray-500">
                            Codigo unico que identifica este motor.
                        </p>
                    </div>

                    <div>
                        <label
                            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            Desplazamiento
                        </label>
                        <input
                            v-model="form.displacement"
                            type="text"
                            placeholder="Ej: 1.8L, 2.4L, 3.5L"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            Combustible
                        </label>
                        <select
                            v-model="form.fuel_type"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                        >
                            <option
                                v-for="option in FUEL_TYPE_OPTIONS"
                                :key="`create-fuel-${option.value}`"
                                :value="option.value"
                            >
                                {{ option.label }}
                            </option>
                        </select>
                    </div>

                    <div class="space-y-3">
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Modelos asociados (opcional)
                            </label>
                            <p class="mt-1 text-xs text-gray-500">
                                Puedes asociar este motor a uno o varios modelos
                                de la misma marca.
                            </p>
                        </div>

                        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                                <label
                                    class="block text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Modelos de la marca
                                </label>
                                <div class="mt-1">
                                    <p
                                        class="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-border dark:bg-muted dark:text-gray-300"
                                    >
                                        {{
                                            makes.find(
                                                (make) =>
                                                    make.id === form.make_id,
                                            )?.name ||
                                            'Selecciona una marca primero'
                                        }}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label
                                    class="block text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
                                >
                                    Buscar modelo
                                </label>
                                <input
                                    v-model="modelSearch"
                                    type="text"
                                    placeholder="Ej: Hilux, Corolla, Civic..."
                                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>
                        </div>

                        <div
                            class="rounded-md border border-gray-200 dark:border-border"
                        >
                            <div
                                v-if="loadingModels"
                                class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400"
                            >
                                Cargando modelos...
                            </div>

                            <div
                                v-else-if="!form.make_id"
                                class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400"
                            >
                                Selecciona una marca para ver sus modelos.
                            </div>

                            <div
                                v-else-if="filteredModels.length === 0"
                                class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400"
                            >
                                No hay modelos para el filtro actual.
                            </div>

                            <div
                                v-else
                                class="max-h-56 divide-y divide-gray-100 overflow-y-auto dark:divide-border"
                            >
                                <label
                                    v-for="model in filteredModels"
                                    :key="model.id"
                                    class="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-muted/40"
                                >
                                    <input
                                        v-model="form.model_ids"
                                        type="checkbox"
                                        :value="model.id"
                                        class="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />

                                    <div class="min-w-0">
                                        <p
                                            class="text-sm font-medium text-gray-900 dark:text-white"
                                        >
                                            {{ formatModelLabel(model) }}
                                        </p>
                                        <p
                                            v-if="formatModelYears(model)"
                                            class="text-xs text-gray-500 dark:text-gray-400"
                                        >
                                            Anos: {{ formatModelYears(model) }}
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <p class="text-xs text-gray-500 dark:text-gray-400">
                            {{ form.model_ids.length }} modelo(s)
                            seleccionado(s)
                        </p>

                        <div
                            v-if="selectedModels.length > 0"
                            class="flex flex-wrap gap-2"
                        >
                            <span
                                v-for="model in selectedModels"
                                :key="`selected-model-${model.id}`"
                                class="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                                :title="`${formatModelLabel(model)} ${formatModelYears(model)}`"
                            >
                                {{ formatModelLabel(model) }}
                            </span>
                        </div>
                    </div>

                    <div
                        class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-border"
                    >
                        <Link
                            href="/vehicles/engines"
                            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-muted dark:text-gray-200 dark:hover:bg-muted"
                        >
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            :disabled="
                                loading ||
                                !canManageVehicleCatalog ||
                                !form.engine_code
                            "
                            class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        >
                            {{ loading ? 'Guardando...' : 'Guardar Motor' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </AppLayout>
</template>
