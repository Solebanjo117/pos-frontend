<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import {
    ArrowDownAZ,
    ArrowUpAZ,
    Car,
    Download,
    LoaderCircle,
    Pencil,
    Plus,
    Search,
    Trash2,
    Upload,
} from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Pagination from '@/components/Pagination.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import VehicleCatalogDialog from '@/components/Vehicles/VehicleCatalogDialog.vue';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import {
    useVehicleCatalog,
    type VehicleCatalogFilters,
    type VehicleCatalogMeta,
    type VehicleCatalogRow,
    type VehicleCatalogSummary,
    type VehicleCatalogTab,
    type VehicleConfigurationRow,
    type VehicleEngineRow,
    type VehicleMakeRow,
    type VehicleModelRow,
} from '@/composables/useVehicleCatalog';
import { useVehicleChassis } from '@/composables/useVehicleChassis';
import AppLayout from '@/layouts/AppLayout.vue';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Vehículos', href: '/vehicles' },
];

const tabs: Array<{ id: VehicleCatalogTab; label: string }> = [
    { id: 'makes', label: 'Marcas' },
    { id: 'engines', label: 'Motores' },
    { id: 'models', label: 'Modelos' },
    { id: 'vehicles', label: 'Vehículos' },
];
const defaultSort: Record<VehicleCatalogTab, string> = {
    makes: 'name',
    engines: 'code',
    models: 'name',
    vehicles: 'make',
};
const singularLabel: Record<VehicleCatalogTab, string> = {
    makes: 'marca',
    engines: 'motor',
    models: 'modelo',
    vehicles: 'vehículo',
};

const { hasRole } = useAuth();
const canManage = computed(() => hasRole(['admin', 'manager']));
const toast = useToast();
const catalog = useVehicleCatalog();
const { chassisList, fetchChassis } = useVehicleChassis();

const isTab = (value: string | null): value is VehicleCatalogTab =>
    tabs.some((tab) => tab.id === value);
const stateFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const tab = isTab(params.get('tab')) ? params.get('tab') : 'makes';
    return {
        tab: tab as VehicleCatalogTab,
        filters: {
            page: Math.max(Number(params.get('page')) || 1, 1),
            per_page: 20,
            search: params.get('search') ?? '',
            sort: params.get('sort') ?? defaultSort[tab as VehicleCatalogTab],
            direction: params.get('direction') === 'desc' ? 'desc' : 'asc',
        } satisfies VehicleCatalogFilters,
    };
};

const initial = stateFromUrl();
const activeTab = ref<VehicleCatalogTab>(initial.tab);
const filters = ref<VehicleCatalogFilters>(initial.filters);
const summary = ref<VehicleCatalogSummary>({
    makes: 0,
    engines: 0,
    models: 0,
    vehicles: 0,
});
const meta = ref<VehicleCatalogMeta>({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
});
const rows = ref<VehicleCatalogRow[]>([]);
const loading = ref(false);
const pageError = ref<string | null>(null);
const selected = ref<Set<string>>(new Set());
const deleting = ref(false);
const exporting = ref(false);

const dialogOpen = ref(false);
const dialogRow = ref<VehicleCatalogRow | null>(null);
const dialogProcessing = ref(false);
const dialogError = ref<string | null>(null);
const optionMakes = ref<VehicleMakeRow[]>([]);
const optionModels = ref<VehicleModelRow[]>([]);
const optionEngines = ref<VehicleEngineRow[]>([]);

const rowKey = (row: VehicleCatalogRow): string =>
    activeTab.value === 'vehicles'
        ? (row as VehicleConfigurationRow).key
        : String((row as { id: number }).id);
const selectedRows = computed(() =>
    rows.value.filter((row) => selected.value.has(rowKey(row))),
);
const selectableRows = computed(() =>
    rows.value.filter((row) => row.can_delete),
);
const allSelected = computed(
    () =>
        selectableRows.value.length > 0 &&
        selectableRows.value.every((row) => selected.value.has(rowKey(row))),
);

const setUrl = (mode: 'push' | 'replace' = 'push') => {
    const params = new URLSearchParams();
    params.set('tab', activeTab.value);
    if (filters.value.search) params.set('search', filters.value.search);
    if (filters.value.page > 1) params.set('page', String(filters.value.page));
    if (filters.value.sort !== defaultSort[activeTab.value]) {
        params.set('sort', filters.value.sort);
    }
    if (filters.value.direction === 'desc') params.set('direction', 'desc');
    const url = window.location.pathname + '?' + params.toString();
    window.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', url);
};

const errorMessage = (error: any): string => {
    const errors = error?.response?.data?.errors;
    const first = errors ? Object.values(errors).flat()[0] : null;
    return typeof first === 'string'
        ? first
        : error?.response?.data?.message ||
              'No se pudo completar la operación.';
};

let requestId = 0;
const loadRows = async () => {
    const currentRequest = ++requestId;
    loading.value = true;
    pageError.value = null;
    try {
        const response = await catalog.fetchRows(
            activeTab.value,
            filters.value,
        );
        if (currentRequest !== requestId) return;
        rows.value = response.data;
        meta.value = response.meta;
        selected.value = new Set();
    } catch (error: any) {
        if (currentRequest === requestId) {
            pageError.value = errorMessage(error);
            rows.value = [];
        }
    } finally {
        if (currentRequest === requestId) loading.value = false;
    }
};
const loadSummary = async () => {
    try {
        summary.value = await catalog.fetchSummary();
    } catch {
        // The table can remain available if only the counters fail.
    }
};
const refresh = () => Promise.all([loadRows(), loadSummary()]);

const selectTab = (tab: VehicleCatalogTab) => {
    if (tab === activeTab.value) return;
    activeTab.value = tab;
    filters.value = {
        page: 1,
        per_page: 20,
        search: '',
        sort: defaultSort[tab],
        direction: 'asc',
    };
    setUrl();
    void loadRows();
};

let searchTimer: ReturnType<typeof setTimeout> | null = null;
const searchChanged = () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        filters.value.page = 1;
        setUrl('replace');
        void loadRows();
    }, 300);
};
const changePage = (page: number) => {
    filters.value.page = page;
    setUrl();
    void loadRows();
};
const changeSort = (sort: string) => {
    if (filters.value.sort === sort) {
        filters.value.direction =
            filters.value.direction === 'asc' ? 'desc' : 'asc';
    } else {
        filters.value.sort = sort;
        filters.value.direction = 'asc';
    }
    filters.value.page = 1;
    setUrl();
    void loadRows();
};
const sortIcon = (sort: string) =>
    filters.value.sort === sort && filters.value.direction === 'desc'
        ? ArrowDownAZ
        : ArrowUpAZ;

const toggleRow = (row: VehicleCatalogRow) => {
    if (!row.can_delete) return;
    const next = new Set(selected.value);
    const key = rowKey(row);
    if (next.has(key)) {
        next.delete(key);
    } else {
        next.add(key);
    }
    selected.value = next;
};
const toggleAll = () => {
    selected.value = allSelected.value
        ? new Set()
        : new Set(selectableRows.value.map(rowKey));
};

const loadOptions = async (tab: VehicleCatalogTab) => {
    if (tab === 'makes') return;

    const common: VehicleCatalogFilters = {
        page: 1,
        per_page: 500,
        search: '',
        sort: 'name',
        direction: 'asc',
    };

    const [options] = await Promise.all([
        catalog.fetchDialogOptions(tab, common),
        ...(tab === 'models' ? [fetchChassis({ per_page: 500 })] : []),
    ]);
    optionMakes.value = options.makes;
    optionModels.value = options.models;
    optionEngines.value = options.engines;
};
const openCreate = async () => {
    dialogRow.value = null;
    dialogError.value = null;
    try {
        await loadOptions(activeTab.value);
        dialogOpen.value = true;
    } catch (error: any) {
        toast.error(errorMessage(error));
    }
};
const openEdit = async (row: VehicleCatalogRow) => {
    dialogRow.value = row;
    dialogError.value = null;
    try {
        await loadOptions(activeTab.value);
        dialogOpen.value = true;
    } catch (error: any) {
        toast.error(errorMessage(error));
    }
};
const closeDialog = () => {
    if (dialogProcessing.value) return;
    dialogOpen.value = false;
    dialogRow.value = null;
    dialogError.value = null;
    const params = new URLSearchParams(window.location.search);
    params.delete('action');
    params.delete('edit');
    window.history.replaceState(
        {},
        '',
        window.location.pathname + '?' + params.toString(),
    );
};

const saveDialog = async (payload: Record<string, unknown>) => {
    dialogProcessing.value = true;
    dialogError.value = null;
    try {
        if (activeTab.value === 'makes') {
            const row = dialogRow.value as VehicleMakeRow | null;
            if (row) {
                await catalog.updateMake(row.id, String(payload.name));
            } else {
                await catalog.createMake(String(payload.name));
            }
        } else if (activeTab.value === 'models') {
            const row = dialogRow.value as VehicleModelRow | null;
            if (row) {
                await catalog.updateModel(row.id, payload);
            } else {
                await catalog.createModel(payload);
            }
        } else if (activeTab.value === 'engines') {
            const row = dialogRow.value as VehicleEngineRow | null;
            if (row) {
                await catalog.updateEngine(row.id, payload);
            } else {
                await catalog.createEngine(payload);
            }
        } else {
            const row = dialogRow.value as VehicleConfigurationRow | null;
            if (row) {
                await catalog.updateConfiguration(
                    row.model.id,
                    row.engine.id,
                    payload,
                );
            } else {
                await catalog.createConfiguration(payload);
            }
        }
        toast.success('Catálogo actualizado correctamente.');
        dialogOpen.value = false;
        dialogRow.value = null;
        await refresh();
    } catch (error: any) {
        dialogError.value = errorMessage(error);
    } finally {
        dialogProcessing.value = false;
    }
};

const removeRow = async (row: VehicleCatalogRow) => {
    if (!row.can_delete) {
        toast.error(
            row.delete_block_reason || 'Este registro no puede eliminarse.',
        );
        return;
    }
    if (!window.confirm('¿Eliminar este registro del catálogo?')) return;
    deleting.value = true;
    try {
        await catalog.deleteRow(activeTab.value, row);
        toast.success('Registro eliminado correctamente.');
        await refresh();
    } catch (error: any) {
        toast.error(errorMessage(error));
    } finally {
        deleting.value = false;
    }
};
const removeSelected = async () => {
    if (
        selectedRows.value.length === 0 ||
        !window.confirm(
            '¿Eliminar ' +
                selectedRows.value.length +
                ' registro(s) seleccionados?',
        )
    ) {
        return;
    }
    deleting.value = true;
    try {
        await catalog.bulkDelete(activeTab.value, selectedRows.value);
        toast.success('Selección eliminada correctamente.');
        await refresh();
    } catch (error: any) {
        toast.error(errorMessage(error));
    } finally {
        deleting.value = false;
    }
};
const exportCatalog = async () => {
    exporting.value = true;
    try {
        await catalog.exportCatalog();
        toast.success('Exportación generada correctamente.');
    } catch (error: any) {
        toast.error(errorMessage(error));
    } finally {
        exporting.value = false;
    }
};

const yearLabel = (row: VehicleModelRow | VehicleConfigurationRow['model']) =>
    row.year_from === row.year_to
        ? String(row.year_from)
        : row.year_from + '-' + row.year_to;
const engineSpecs = (
    engine: VehicleEngineRow | VehicleConfigurationRow['engine'],
) =>
    [engine.displacement, engine.fuel_type, engine.aspiration]
        .filter(Boolean)
        .join(' • ') || 'Sin especificaciones';
const popState = () => {
    const state = stateFromUrl();
    activeTab.value = state.tab;
    filters.value = state.filters;
    void loadRows();
};

const openUrlAction = async () => {
    if (!canManage.value || activeTab.value === 'vehicles') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'create') {
        await openCreate();
        return;
    }

    const editId = Number(params.get('edit'));
    if (editId > 0) {
        try {
            const row = await catalog.fetchRow(activeTab.value, editId);
            await openEdit(row);
        } catch (error: any) {
            toast.error(errorMessage(error));
        }
    }
};

onMounted(async () => {
    window.addEventListener('popstate', popState);
    await refresh();
    await openUrlAction();
});
onBeforeUnmount(() => {
    window.removeEventListener('popstate', popState);
    if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
    <Head title="Administración de Vehículos" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6">
            <header
                class="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-center lg:justify-between"
            >
                <div>
                    <h1 class="text-2xl font-semibold tracking-tight">
                        Administración de Vehículos
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Marcas, motores, modelos, configuraciones y VIN en un
                        solo lugar.
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <Link
                        v-if="canManage"
                        :href="
                            '/vehicles/import?return=' +
                            encodeURIComponent('/vehicles?tab=' + activeTab)
                        "
                    >
                        <Button variant="outline">
                            <Upload class="mr-2 h-4 w-4" />Importar
                        </Button>
                    </Link>
                    <Button
                        variant="outline"
                        :disabled="exporting"
                        @click="exportCatalog"
                    >
                        <LoaderCircle
                            v-if="exporting"
                            class="mr-2 h-4 w-4 animate-spin"
                        />
                        <Download v-else class="mr-2 h-4 w-4" />Exportar
                    </Button>
                    <Button v-if="canManage" @click="openCreate">
                        <Plus class="mr-2 h-4 w-4" />Nuevo
                        {{ singularLabel[activeTab] }}
                    </Button>
                </div>
            </header>

            <nav
                class="flex gap-1 overflow-x-auto rounded-lg border bg-muted/30 p-1"
                aria-label="Catálogo de vehículos"
            >
                <button
                    v-for="tab in tabs"
                    :key="tab.id"
                    type="button"
                    class="flex min-w-max items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
                    :class="
                        activeTab === tab.id
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                    "
                    :aria-current="activeTab === tab.id ? 'page' : undefined"
                    @click="selectTab(tab.id)"
                >
                    {{ tab.label }}
                    <Badge variant="secondary" class="tabular-nums">
                        {{ summary[tab.id] }}
                    </Badge>
                </button>
            </nav>

            <section class="overflow-hidden rounded-xl border bg-card">
                <div
                    class="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div class="relative w-full sm:max-w-md">
                        <Search
                            class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                            v-model="filters.search"
                            class="pl-9"
                            :placeholder="
                                'Buscar ' + singularLabel[activeTab] + '…'
                            "
                            @input="searchChanged"
                        />
                    </div>
                    <Button
                        v-if="canManage && selectedRows.length"
                        variant="destructive"
                        :disabled="deleting"
                        @click="removeSelected"
                    >
                        <Trash2 class="mr-2 h-4 w-4" />Eliminar selección ({{
                            selectedRows.length
                        }})
                    </Button>
                </div>

                <div
                    v-if="pageError"
                    class="m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                    role="alert"
                >
                    {{ pageError }}
                    <Button
                        variant="link"
                        class="ml-2 h-auto p-0"
                        @click="loadRows"
                    >
                        Reintentar
                    </Button>
                </div>
                <div
                    v-else-if="loading"
                    class="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"
                >
                    <LoaderCircle class="h-5 w-5 animate-spin" />Cargando
                    catálogo…
                </div>
                <div
                    v-else-if="rows.length === 0"
                    class="flex min-h-64 flex-col items-center justify-center p-6 text-center"
                >
                    <Car class="mb-3 h-10 w-10 text-muted-foreground" />
                    <p class="font-medium">No hay resultados</p>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Ajusta la búsqueda o registra un nuevo elemento.
                    </p>
                </div>

                <template v-else>
                    <div class="hidden overflow-x-auto md:block">
                        <table class="w-full text-sm">
                            <thead class="border-b bg-muted/40 text-left">
                                <tr>
                                    <th v-if="canManage" class="w-12 px-4 py-3">
                                        <input
                                            type="checkbox"
                                            :checked="allSelected"
                                            aria-label="Seleccionar registros eliminables"
                                            @change="toggleAll"
                                        />
                                    </th>
                                    <template v-if="activeTab === 'makes'">
                                        <th class="px-4 py-3">
                                            <button
                                                class="inline-flex items-center gap-1"
                                                @click="changeSort('name')"
                                            >
                                                Marca
                                                <component
                                                    :is="sortIcon('name')"
                                                    class="h-3.5 w-3.5"
                                                />
                                            </button>
                                        </th>
                                        <th class="px-4 py-3">Modelos</th>
                                        <th class="px-4 py-3">Motores</th>
                                        <th class="px-4 py-3">Vehículos</th>
                                    </template>
                                    <template
                                        v-else-if="activeTab === 'engines'"
                                    >
                                        <th class="px-4 py-3">
                                            <button @click="changeSort('make')">
                                                Marca
                                            </button>
                                        </th>
                                        <th class="px-4 py-3">
                                            <button @click="changeSort('code')">
                                                Código
                                            </button>
                                        </th>
                                        <th class="px-4 py-3">
                                            Especificaciones
                                        </th>
                                        <th class="px-4 py-3">Vehículos</th>
                                    </template>
                                    <template
                                        v-else-if="activeTab === 'models'"
                                    >
                                        <th class="px-4 py-3">
                                            <button @click="changeSort('make')">
                                                Marca
                                            </button>
                                        </th>
                                        <th class="px-4 py-3">
                                            <button @click="changeSort('name')">
                                                Modelo
                                            </button>
                                        </th>
                                        <th class="px-4 py-3">
                                            <button
                                                @click="changeSort('years')"
                                            >
                                                Años / Generación
                                            </button>
                                        </th>
                                        <th class="px-4 py-3">Vehículos</th>
                                    </template>
                                    <template v-else>
                                        <th class="px-4 py-3">
                                            <button @click="changeSort('make')">
                                                Marca / Modelo / Años
                                            </button>
                                        </th>
                                        <th class="px-4 py-3">
                                            <button
                                                @click="changeSort('engine')"
                                            >
                                                Motor / Especificaciones
                                            </button>
                                        </th>
                                        <th class="px-4 py-3">
                                            VIN registrados
                                        </th>
                                    </template>
                                    <th
                                        v-if="canManage"
                                        class="px-4 py-3 text-right"
                                    >
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
                                <tr
                                    v-for="row in rows"
                                    :key="rowKey(row)"
                                    class="hover:bg-muted/30"
                                >
                                    <td v-if="canManage" class="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            :checked="selected.has(rowKey(row))"
                                            :disabled="!row.can_delete"
                                            :title="
                                                row.delete_block_reason ??
                                                undefined
                                            "
                                            @change="toggleRow(row)"
                                        />
                                    </td>
                                    <template v-if="activeTab === 'makes'">
                                        <td class="px-4 py-3 font-medium">
                                            {{ (row as VehicleMakeRow).name }}
                                        </td>
                                        <td class="px-4 py-3">
                                            {{
                                                (row as VehicleMakeRow)
                                                    .models_count
                                            }}
                                        </td>
                                        <td class="px-4 py-3">
                                            {{
                                                (row as VehicleMakeRow)
                                                    .engines_count
                                            }}
                                        </td>
                                        <td class="px-4 py-3">
                                            {{
                                                (row as VehicleMakeRow)
                                                    .vehicles_count
                                            }}
                                        </td>
                                    </template>
                                    <template
                                        v-else-if="activeTab === 'engines'"
                                    >
                                        <td class="px-4 py-3">
                                            {{
                                                (row as VehicleEngineRow).make
                                                    ?.name ?? 'Sin marca'
                                            }}
                                        </td>
                                        <td
                                            class="px-4 py-3 font-mono font-medium"
                                        >
                                            {{
                                                (row as VehicleEngineRow)
                                                    .engine_code
                                            }}
                                        </td>
                                        <td
                                            class="px-4 py-3 text-muted-foreground"
                                        >
                                            {{
                                                engineSpecs(
                                                    row as VehicleEngineRow,
                                                )
                                            }}
                                        </td>
                                        <td class="px-4 py-3">
                                            {{
                                                (row as VehicleEngineRow)
                                                    .vehicles_count
                                            }}
                                        </td>
                                    </template>
                                    <template
                                        v-else-if="activeTab === 'models'"
                                    >
                                        <td class="px-4 py-3">
                                            {{
                                                (row as VehicleModelRow).make
                                                    ?.name
                                            }}
                                        </td>
                                        <td class="px-4 py-3 font-medium">
                                            {{ (row as VehicleModelRow).name }}
                                        </td>
                                        <td class="px-4 py-3">
                                            {{
                                                yearLabel(
                                                    row as VehicleModelRow,
                                                )
                                            }}
                                            <Badge
                                                v-if="
                                                    (row as VehicleModelRow)
                                                        .generation
                                                "
                                                variant="outline"
                                                class="ml-2"
                                            >
                                                {{
                                                    (row as VehicleModelRow)
                                                        .generation
                                                }}
                                            </Badge>
                                        </td>
                                        <td class="px-4 py-3">
                                            {{
                                                (row as VehicleModelRow)
                                                    .vehicles_count
                                            }}
                                        </td>
                                    </template>
                                    <template v-else>
                                        <td class="px-4 py-3">
                                            <p class="font-medium">
                                                {{
                                                    (
                                                        row as VehicleConfigurationRow
                                                    ).make.name
                                                }}
                                                {{
                                                    (
                                                        row as VehicleConfigurationRow
                                                    ).model.name
                                                }}
                                            </p>
                                            <p
                                                class="text-xs text-muted-foreground"
                                            >
                                                {{
                                                    yearLabel(
                                                        (
                                                            row as VehicleConfigurationRow
                                                        ).model,
                                                    )
                                                }}
                                                <span
                                                    v-if="
                                                        (
                                                            row as VehicleConfigurationRow
                                                        ).model.generation
                                                    "
                                                >
                                                    •
                                                    {{
                                                        (
                                                            row as VehicleConfigurationRow
                                                        ).model.generation
                                                    }}
                                                </span>
                                            </p>
                                        </td>
                                        <td class="px-4 py-3">
                                            <p class="font-mono font-medium">
                                                {{
                                                    (
                                                        row as VehicleConfigurationRow
                                                    ).engine.engine_code
                                                }}
                                            </p>
                                            <p
                                                class="text-xs text-muted-foreground"
                                            >
                                                {{
                                                    engineSpecs(
                                                        (
                                                            row as VehicleConfigurationRow
                                                        ).engine,
                                                    )
                                                }}
                                            </p>
                                        </td>
                                        <td class="max-w-md px-4 py-3">
                                            <div
                                                v-if="
                                                    (
                                                        row as VehicleConfigurationRow
                                                    ).vins.length
                                                "
                                                class="flex flex-wrap gap-1"
                                            >
                                                <Badge
                                                    v-for="vin in (
                                                        row as VehicleConfigurationRow
                                                    ).vins"
                                                    :key="vin.id ?? vin.vin"
                                                    variant="outline"
                                                    class="font-mono"
                                                >
                                                    {{ vin.vin }}
                                                </Badge>
                                            </div>
                                            <span
                                                v-else
                                                class="text-muted-foreground"
                                                >Sin VIN</span
                                            >
                                        </td>
                                    </template>
                                    <td v-if="canManage" class="px-4 py-3">
                                        <div class="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Editar"
                                                @click="openEdit(row)"
                                            >
                                                <Pencil class="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                :disabled="
                                                    !row.can_delete || deleting
                                                "
                                                :title="
                                                    row.delete_block_reason ||
                                                    'Eliminar'
                                                "
                                                @click="removeRow(row)"
                                            >
                                                <Trash2
                                                    class="h-4 w-4 text-destructive"
                                                />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="divide-y md:hidden">
                        <article
                            v-for="row in rows"
                            :key="rowKey(row)"
                            class="space-y-3 p-4"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <template v-if="activeTab === 'makes'">
                                        <p class="font-medium">
                                            {{ (row as VehicleMakeRow).name }}
                                        </p>
                                        <p
                                            class="text-sm text-muted-foreground"
                                        >
                                            {{
                                                (row as VehicleMakeRow)
                                                    .models_count
                                            }}
                                            modelos •
                                            {{
                                                (row as VehicleMakeRow)
                                                    .engines_count
                                            }}
                                            motores •
                                            {{
                                                (row as VehicleMakeRow)
                                                    .vehicles_count
                                            }}
                                            vehículos
                                        </p>
                                    </template>
                                    <template
                                        v-else-if="activeTab === 'engines'"
                                    >
                                        <p class="font-mono font-medium">
                                            {{
                                                (row as VehicleEngineRow)
                                                    .engine_code
                                            }}
                                        </p>
                                        <p
                                            class="text-sm text-muted-foreground"
                                        >
                                            {{
                                                (row as VehicleEngineRow).make
                                                    ?.name
                                            }}
                                            •
                                            {{
                                                engineSpecs(
                                                    row as VehicleEngineRow,
                                                )
                                            }}
                                        </p>
                                    </template>
                                    <template
                                        v-else-if="activeTab === 'models'"
                                    >
                                        <p class="font-medium">
                                            {{
                                                (row as VehicleModelRow).make
                                                    ?.name
                                            }}
                                            {{ (row as VehicleModelRow).name }}
                                        </p>
                                        <p
                                            class="text-sm text-muted-foreground"
                                        >
                                            {{
                                                yearLabel(
                                                    row as VehicleModelRow,
                                                )
                                            }}
                                        </p>
                                    </template>
                                    <template v-else>
                                        <p class="font-medium">
                                            {{
                                                (row as VehicleConfigurationRow)
                                                    .make.name
                                            }}
                                            {{
                                                (row as VehicleConfigurationRow)
                                                    .model.name
                                            }}
                                        </p>
                                        <p
                                            class="font-mono text-sm text-muted-foreground"
                                        >
                                            {{
                                                (row as VehicleConfigurationRow)
                                                    .engine.engine_code
                                            }}
                                            •
                                            {{
                                                engineSpecs(
                                                    (
                                                        row as VehicleConfigurationRow
                                                    ).engine,
                                                )
                                            }}
                                        </p>
                                    </template>
                                </div>
                                <input
                                    v-if="canManage"
                                    type="checkbox"
                                    :checked="selected.has(rowKey(row))"
                                    :disabled="!row.can_delete"
                                    @change="toggleRow(row)"
                                />
                            </div>
                            <div
                                v-if="activeTab === 'vehicles'"
                                class="flex flex-wrap gap-1"
                            >
                                <Badge
                                    v-for="vin in (
                                        row as VehicleConfigurationRow
                                    ).vins"
                                    :key="vin.id ?? vin.vin"
                                    variant="outline"
                                    class="font-mono"
                                >
                                    {{ vin.vin }}
                                </Badge>
                                <span
                                    v-if="
                                        (row as VehicleConfigurationRow).vins
                                            .length === 0
                                    "
                                    class="text-sm text-muted-foreground"
                                    >Sin VIN</span
                                >
                            </div>
                            <div
                                v-if="canManage"
                                class="flex justify-end gap-2 border-t pt-3"
                            >
                                <Button
                                    variant="outline"
                                    size="sm"
                                    @click="openEdit(row)"
                                >
                                    <Pencil class="mr-2 h-4 w-4" />Editar
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    :disabled="!row.can_delete || deleting"
                                    :title="
                                        row.delete_block_reason ?? undefined
                                    "
                                    @click="removeRow(row)"
                                >
                                    <Trash2
                                        class="mr-2 h-4 w-4 text-destructive"
                                    />Eliminar
                                </Button>
                            </div>
                        </article>
                    </div>

                    <Pagination
                        :pagination="meta"
                        :loading="loading"
                        @page-change="changePage"
                    />
                </template>
            </section>
        </div>

        <VehicleCatalogDialog
            :open="dialogOpen"
            :tab="activeTab"
            :row="dialogRow"
            :makes="optionMakes"
            :models="optionModels"
            :engines="optionEngines"
            :chassis="chassisList"
            :processing="dialogProcessing"
            :error="dialogError"
            @close="closeDialog"
            @save="saveDialog"
        />
    </AppLayout>
</template>
