<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3';
import { computed, onMounted, ref, watch } from 'vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { useVehicleEngines } from '@/composables/useVehicleEngines';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import { type BreadcrumbItem } from '@/types';

interface Props {
    id?: string | number;
    engineId?: number;
}

const props = defineProps<Props>();
const routeEngineId = computed(() => Number(props.engineId ?? props.id ?? 0));

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
    { title: 'Editar', href: `/vehicles/engines/${routeEngineId.value}/edit` },
];

const {
    engines,
    engine,
    fetchEngine,
    fetchEngines,
    updateEngine,
    loading,
    error,
} = useVehicleEngines();

const form = ref({
    make_id: null as number | null,
    engine_code: '',
    displacement: '',
    fuel_type: '',
    model_ids: [] as number[],
});

const loadingEngine = ref(true);

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

const duplicateConfirmed = ref(false);

const checkDuplicate = (code: string, makeId: number | null): boolean => {
    return engines.value.some(
        (engineItem) =>
            engineItem.id !== routeEngineId.value &&
            engineItem.make_id === makeId &&
            engineItem.engine_code.toLowerCase().trim() ===
                code.toLowerCase().trim(),
    );
};

const loadEngine = async () => {
    loadingEngine.value = true;
    try {
        await fetchEngine(routeEngineId.value);
        await fetchEngines({ per_page: 500 });

        if (engine.value) {
            const initialModelIds =
                Array.isArray(engine.value.model_ids) &&
                engine.value.model_ids.length > 0
                    ? engine.value.model_ids
                    : engine.value.model_id
                      ? [engine.value.model_id]
                      : [];

            form.value = {
                make_id:
                    engine.value.make_id ??
                    engine.value.make?.id ??
                    engine.value.model?.make?.id ??
                    engine.value.models?.[0]?.make?.id ??
                    null,
                engine_code: engine.value.engine_code,
                displacement: engine.value.displacement || '',
                fuel_type: engine.value.fuel_type || 'Gasoline',
                model_ids: initialModelIds,
            };
        }
    } finally {
        loadingEngine.value = false;
    }
};

onMounted(async () => {
    await Promise.all([fetchMakes(), fetchAllModels()]);
    await loadEngine();
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

const handleSubmit = async () => {
    if (!form.value.make_id) {
        error.value = 'Selecciona la marca de vehiculo del motor.';
        return;
    }

    if (
        !duplicateConfirmed.value &&
        checkDuplicate(form.value.engine_code, form.value.make_id)
    ) {
        const confirm = window.confirm(
            `Ya existe un motor con el codigo "${form.value.engine_code}" para esta marca.\n\nDesea guardar de todos modos?`,
        );
        if (!confirm) return;
        duplicateConfirmed.value = true;
    }

    const uniqueModelIds = Array.from(
        new Set(
            form.value.model_ids
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id)),
        ),
    );

    try {
        await updateEngine(routeEngineId.value, {
            make_id: form.value.make_id,
            engine_code: form.value.engine_code,
            displacement: form.value.displacement || undefined,
            fuel_type: form.value.fuel_type,
            model_id: uniqueModelIds[0] ?? null,
            model_ids: uniqueModelIds,
            aspiration: 'N/A',
        });
        router.visit('/vehicles/engines');
    } catch {
        duplicateConfirmed.value = false;
    }
};
</script>

<template>
    <Head title="Editar Motor" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-3xl space-y-6 p-6">
            <div>
                <h1
                    class="text-2xl font-semibold text-gray-900 dark:text-white"
                >
                    Editar Motor
                </h1>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Actualiza los datos del motor y su asociacion con uno o
                    varios modelos.
                </p>
            </div>

            <div
                v-if="error"
                class="rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            >
                {{ error }}
            </div>

            <div
                v-if="loadingEngine"
                class="rounded-lg bg-white p-6 shadow dark:bg-card"
            >
                <p class="text-gray-500 dark:text-gray-400">
                    Cargando motor...
                </p>
            </div>

            <div v-else class="rounded-lg bg-white p-6 shadow dark:bg-card">
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
                            class="mt-1 block w-full rounded-md border-gray-300 font-mono shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                        />
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
                            <option value="Gasoline">Gasolina</option>
                            <option value="Diesel">Diesel</option>
                            <option value="Hybrid">Hibrido</option>
                            <option value="Electric">Electrico</option>
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
                            :disabled="loading || !form.engine_code"
                            class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        >
                            {{ loading ? 'Guardando...' : 'Guardar Cambios' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </AppLayout>
</template>
