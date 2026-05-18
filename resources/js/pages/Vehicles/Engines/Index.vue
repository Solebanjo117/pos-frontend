<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { Head, Link } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import { useVehicleEngines } from '@/composables/useVehicleEngines';
import { useVehicleMakes } from '@/composables/useVehicleMakes';
import { useVehicleModels } from '@/composables/useVehicleModels';
import { Search, Plus, Pencil, Trash2, X } from 'lucide-vue-next';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Vehículos', href: '/vehicles' },
    { title: 'Motores', href: '/vehicles/engines' },
];

const { engines, loading, fetchEngines, deleteEngine } = useVehicleEngines();
const { makes, fetchMakes } = useVehicleMakes();
const { models, fetchModels } = useVehicleModels();

const search = ref('');
const page = ref(1);
const total = ref(0);
const perPage = ref(15);

// Filters
const selectedMakeId = ref<number | null>(null);
const selectedModelId = ref<number | null>(null);

const makeOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todas las marcas' },
    ...makes.value.map((make) => ({ value: make.id, label: make.name })),
]);

const modelOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Todos los modelos' },
    ...models.value.map((model) => ({
        value: model.id,
        label: model.name,
        sublabel: model.year_from
            ? `(${model.year_from}${model.year_to ? `-${model.year_to}` : ''})`
            : undefined,
    })),
]);

const loadData = async () => {
    const params: Record<string, any> = {
        page: page.value,
        search: search.value,
        per_page: perPage.value,
    };
    if (selectedMakeId.value) params.make_id = selectedMakeId.value;
    if (selectedModelId.value) params.model_id = selectedModelId.value;

    const data = await fetchEngines(params);
    total.value = data.meta.total;
    perPage.value = data.meta.per_page;
};

onMounted(async () => {
    await fetchMakes();
    loadData();
});

// Debounce search
let timeout: ReturnType<typeof setTimeout>;
watch(search, () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        page.value = 1;
        loadData();
    }, 300);
});

// When make changes, load models and reload engines
watch(selectedMakeId, async (makeId) => {
    selectedModelId.value = null;
    if (makeId) {
        await fetchModels({ make_id: makeId, per_page: 200 });
    } else {
        models.value = [];
    }
    page.value = 1;
    loadData();
});

// When model changes reload engines
watch(selectedModelId, () => {
    page.value = 1;
    loadData();
});

const clearFilters = () => {
    selectedMakeId.value = null;
    selectedModelId.value = null;
    search.value = '';
};

const hasActiveFilters = () => {
    return !!selectedMakeId.value || !!selectedModelId.value || !!search.value;
};

const handleDelete = async (id: number) => {
    if (confirm('¿Estás seguro de eliminar este motor?')) {
        await deleteEngine(id);
        loadData();
    }
};

const changePage = (newPage: number) => {
    page.value = newPage;
    loadData();
};

const fuelTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
        Gasoline: 'Gasolina',
        Diesel: 'Diesel',
        Hybrid: 'Híbrido',
        Electric: 'Eléctrico',
    };
    return labels[type] || type;
};

interface AssociatedModel {
    id: number;
    name: string;
    make?: {
        id: number;
        name: string;
    };
}

const getEngineMakeName = (item: any): string => {
    return (
        item.make?.name ??
        item.model?.make?.name ??
        item.models?.[0]?.make?.name ??
        'Sin marca'
    );
};

const getAssociatedModels = (item: any): AssociatedModel[] => {
    if (Array.isArray(item.models) && item.models.length > 0) {
        return item.models;
    }

    if (item.model) {
        return [item.model];
    }

    return [];
};

const formatAssociatedModelLabel = (model: AssociatedModel): string => {
    return [model.make?.name, model.name].filter(Boolean).join(' ');
};

const getVisibleAssociatedModels = (
    item: any,
    maxVisible = 2,
): AssociatedModel[] => {
    return getAssociatedModels(item).slice(0, maxVisible);
};

const getExtraAssociatedModelsCount = (item: any, maxVisible = 2): number => {
    const total = getAssociatedModels(item).length;
    return total > maxVisible ? total - maxVisible : 0;
};

const getAssociatedModelsTooltip = (item: any): string => {
    const labels = getAssociatedModels(item)
        .map((model) => formatAssociatedModelLabel(model))
        .filter(Boolean);

    return labels.join(', ');
};
</script>

<template>
    <Head title="Motores" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-6xl space-y-6 p-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1
                        class="text-2xl font-semibold text-gray-900 dark:text-white"
                    >
                        Motores
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Catálogo de motores reutilizables para asignar a
                        vehículos
                    </p>
                </div>
                <Link
                    href="/vehicles/engines/create"
                    class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                    <Plus class="h-5 w-5" />
                    Nuevo Motor
                </Link>
            </div>

            <!-- Search + Filters -->
            <div class="space-y-4 rounded-lg bg-white p-4 shadow dark:bg-card">
                <div class="relative">
                    <Search
                        class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400"
                    />
                    <input
                        v-model="search"
                        type="text"
                        placeholder="Buscar por código o desplazamiento..."
                        class="w-full rounded-md border border-gray-300 pl-10 focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                    />
                </div>

                <!-- Make / Model filters -->
                <div class="flex flex-wrap items-end gap-4">
                    <div class="min-w-[180px] flex-1">
                        <label
                            class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                            >Marca Vehículo</label
                        >
                        <SearchableSelect
                            v-model="selectedMakeId"
                            :options="makeOptions"
                            placeholder="Todas las marcas"
                        />
                    </div>
                    <div class="min-w-[180px] flex-1">
                        <label
                            class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                            >Modelo</label
                        >
                        <SearchableSelect
                            v-model="selectedModelId"
                            :options="modelOptions"
                            :disabled="!selectedMakeId"
                            placeholder="Todos los modelos"
                        />
                    </div>
                    <button
                        v-if="hasActiveFilters()"
                        @click="clearFilters"
                        class="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                    >
                        <X class="h-4 w-4" />
                        Limpiar
                    </button>
                </div>
            </div>

            <!-- Data Table -->
            <div
                class="overflow-hidden rounded-lg bg-white shadow dark:bg-card"
            >
                <table
                    class="min-w-full divide-y divide-gray-200 dark:divide-border"
                >
                    <thead class="bg-gray-50 dark:bg-muted">
                        <tr>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
                            >
                                Código Motor
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
                            >
                                Marca
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
                            >
                                Modelos asociados
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
                            >
                                Desplazamiento
                            </th>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
                            >
                                Combustible
                            </th>
                            <th
                                class="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
                            >
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-border">
                        <tr v-if="loading" class="animate-pulse">
                            <td
                                colspan="6"
                                class="px-6 py-4 text-center text-gray-500"
                            >
                                Cargando...
                            </td>
                        </tr>
                        <tr v-else-if="engines.length === 0">
                            <td
                                colspan="6"
                                class="px-6 py-4 text-center text-gray-500"
                            >
                                No se encontraron motores
                            </td>
                        </tr>
                        <tr
                            v-for="engine in engines"
                            :key="engine.id"
                            class="hover:bg-gray-50 dark:hover:bg-muted/50"
                        >
                            <td
                                class="px-6 py-4 font-mono text-sm font-semibold whitespace-nowrap text-gray-900 dark:text-white"
                            >
                                {{ engine.engine_code }}
                            </td>
                            <td
                                class="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900 dark:text-white"
                            >
                                {{ getEngineMakeName(engine) }}
                            </td>
                            <td
                                class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                            >
                                <div
                                    v-if="
                                        getAssociatedModels(engine).length > 0
                                    "
                                    class="flex flex-wrap items-center gap-1"
                                    :title="getAssociatedModelsTooltip(engine)"
                                >
                                    <span
                                        v-for="model in getVisibleAssociatedModels(
                                            engine,
                                        )"
                                        :key="`model-chip-${engine.id}-${model.id}`"
                                        class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                                    >
                                        {{ formatAssociatedModelLabel(model) }}
                                    </span>
                                    <span
                                        v-if="
                                            getExtraAssociatedModelsCount(
                                                engine,
                                            ) > 0
                                        "
                                        class="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-muted dark:text-gray-300"
                                    >
                                        +{{
                                            getExtraAssociatedModelsCount(
                                                engine,
                                            )
                                        }}
                                    </span>
                                </div>
                                <span v-else class="text-gray-400 italic"
                                    >Independiente</span
                                >
                            </td>
                            <td
                                class="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white"
                            >
                                {{ engine.displacement || '—' }}
                            </td>
                            <td
                                class="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-300"
                            >
                                {{ fuelTypeLabel(engine.fuel_type || '') }}
                            </td>
                            <td class="px-6 py-4 text-right whitespace-nowrap">
                                <div class="flex justify-end gap-2">
                                    <Link
                                        :href="`/vehicles/engines/${engine.id}/edit`"
                                        class="rounded p-1 text-blue-600 hover:bg-blue-50 dark:text-primary dark:hover:bg-muted"
                                    >
                                        <Pencil class="h-5 w-5" />
                                    </Link>
                                    <button
                                        @click="handleDelete(engine.id)"
                                        class="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-muted"
                                    >
                                        <Trash2 class="h-5 w-5" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- Pagination -->
                <div
                    v-if="total > perPage"
                    class="flex items-center justify-between border-t border-gray-200 px-6 py-3 dark:border-border"
                >
                    <button
                        :disabled="page === 1"
                        @click="changePage(page - 1)"
                        class="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                    >
                        Anterior
                    </button>
                    <span class="text-sm text-gray-700 dark:text-gray-300">
                        Página {{ page }}
                    </span>
                    <button
                        :disabled="page * perPage >= total"
                        @click="changePage(page + 1)"
                        class="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                    >
                        Siguiente
                    </button>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
