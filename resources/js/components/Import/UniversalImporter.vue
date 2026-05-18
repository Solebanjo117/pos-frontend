<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { importService, type ImporterConfig } from '@/services/import';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import {
    UploadCloud,
    Download,
    Eye,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    X as XIcon,
    Plus,
    Tag,
    Package,
    Car,
} from 'lucide-vue-next';
import apiClient from '@/services/api/client';

const props = defineProps<{ config: ImporterConfig }>();

const file = ref<File | null>(null);
const dragOver = ref(false);
const previewRows = ref<any[]>([]);
const editedRows = ref<any[]>([]);
const result = ref<any | null>(null);
const error = ref<string | null>(null);
const previewLoading = ref(false);
const importRunning = ref(false);
const searchableOptions = ref<Record<string, any[]>>({});
const fileInputRef = ref<HTMLInputElement | null>(null);
const MAX_IMPORT_FILE_BYTES = 25 * 1024 * 1024;

const emit = defineEmits<{
    (e: 'create', columnKey: string, rowIndex: number): void;
    (
        e: 'row-action',
        actionType: 'attributes' | 'variants' | 'compatibility',
        rowIndex: number,
    ): void;
    (
        e: 'category-changed',
        rowIndex: number,
        categoryId: number | string | null,
    ): void;
}>();

// Separate base editable columns from action columns
const editableColumns = computed(() =>
    props.config.columns.filter((c) => !c.actionType),
);
const actionColumns = computed(() =>
    props.config.columns.filter((c) => !!c.actionType),
);

const validCount = computed(
    () => editedRows.value.filter((r) => r.__valid).length,
);
const errorCount = computed(
    () => editedRows.value.filter((r) => !r.__valid).length,
);
const hasFile = computed(() => !!file.value);
const hasPreview = computed(() => editedRows.value.length > 0);
const canImport = computed(
    () => hasPreview.value && validCount.value > 0 && !importRunning.value,
);

const handleDrop = (e: DragEvent) => {
    dragOver.value = false;
    const files = e.dataTransfer?.files;
    if (files?.length) setSelectedFile(files[0]);
};

const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) setSelectedFile(input.files[0]);
};

const setSelectedFile = (selectedFile: File) => {
    resetPreview();

    if (selectedFile.size > MAX_IMPORT_FILE_BYTES) {
        file.value = null;
        error.value = 'El archivo no puede superar 25MB.';
        if (fileInputRef.value) fileInputRef.value.value = '';
        return;
    }

    file.value = selectedFile;
};

const resetPreview = () => {
    previewRows.value = [];
    editedRows.value = [];
    result.value = null;
    error.value = null;
};

const downloadTemplate = async () => {
    error.value = null;
    try {
        const blob = await importService.downloadTemplate(props.config.entity);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = props.config.templateFilename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'No se pudo descargar la plantilla.';
    }
};

const previewImport = async () => {
    if (!file.value) return;
    error.value = null;
    result.value = null;
    previewLoading.value = true;
    try {
        const response = await importService.preview(
            props.config.entity,
            file.value,
        );
        previewRows.value = response.data?.rows ?? [];
        editedRows.value = previewRows.value.map((row) => ({
            ...row.data,
            __row: row.row,
            __valid: row.is_valid,
            __errors: row.errors ?? [],
            __attributes: [],
            __variants: [],
            __compatibility: [],
        }));
        await loadSearchableOptions();
        resolveSearchableValues();
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            'No se pudo generar la previsualización.';
        previewRows.value = [];
        editedRows.value = [];
    } finally {
        previewLoading.value = false;
    }
};

const loadSearchableOptions = async () => {
    const endpoints = new Set<string>();
    props.config.columns.forEach((col) => {
        if (col.type === 'searchable' && col.searchableEndpoint)
            endpoints.add(col.searchableEndpoint);
    });
    for (const endpoint of endpoints) {
        // Skip only if already loaded with data (not if it failed returning [])
        const cached = searchableOptions.value[endpoint];
        if (Array.isArray(cached) && cached.length > 0) continue;
        try {
            const { data } = await apiClient.get(endpoint);
            const items = data.data ?? data;
            searchableOptions.value[endpoint] = Array.isArray(items)
                ? items
                : [];
        } catch (e) {
            console.error(
                `[Importer] Failed to load options for ${endpoint}:`,
                e,
            );
            searchableOptions.value[endpoint] = [];
        }
    }
};

/**
 * After preview, try to resolve text values in searchable columns to their numeric IDs.
 * e.g. "TOYOTA" -> 3 (if VehicleMake id=3 has name=TOYOTA)
 */
const resolveSearchableValues = () => {
    const searchableCols = props.config.columns.filter(
        (c) => c.type === 'searchable' && c.searchableEndpoint,
    );
    editedRows.value.forEach((row) => {
        searchableCols.forEach((col) => {
            const rawValue = row[col.key];
            // Already a number — already resolved
            if (typeof rawValue === 'number') return;
            if (!rawValue) return;
            const options =
                searchableOptions.value[col.searchableEndpoint!] ?? [];
            const match = options.find(
                (item: any) =>
                    item.name?.toLowerCase() ===
                        String(rawValue).toLowerCase() ||
                    item.label?.toLowerCase() ===
                        String(rawValue).toLowerCase(),
            );
            if (match) row[col.key] = match.id;
        });
    });
};

onMounted(loadSearchableOptions);

defineExpose({
    reloadSearchableOptions: () => {
        searchableOptions.value = {};
        return loadSearchableOptions();
    },
    editedRows,
});

const getOptionsForColumn = (col: any) => {
    if (col.type === 'select' && col.options) {
        return col.options.map((o: any) => ({
            value: o.value,
            label: o.label,
        }));
    }
    if (col.type === 'searchable' && col.searchableEndpoint) {
        return (searchableOptions.value[col.searchableEndpoint] ?? []).map(
            (item: any) => ({
                value: item.id ?? item.name,
                label: item.name ?? item.label ?? String(item.id),
            }),
        );
    }
    return [];
};

// When a searchable column changes, check if it's a category and autocomplete attributes
const onSearchableChange = async (col: any, rowIdx: number, newValue: any) => {
    editedRows.value[rowIdx][col.key] = newValue;

    if (col.key === 'categoria' && newValue) {
        emit('category-changed', rowIdx, newValue);
        // Autocarga de default_attributes si la categoría tiene ID numérico
        if (typeof newValue === 'number') {
            try {
                const { data } = await apiClient.get(`/categories/${newValue}`);
                const cat = data.data ?? data;
                if (
                    cat.default_attributes &&
                    Array.isArray(cat.default_attributes) &&
                    cat.default_attributes.length > 0
                ) {
                    // Only pre-fill if the row has no attributes yet
                    if (editedRows.value[rowIdx].__attributes.length === 0) {
                        editedRows.value[rowIdx].__attributes =
                            cat.default_attributes.map((a: any) => ({
                                name: a.name ?? '',
                                value: '',
                                unit: a.unit ?? '',
                            }));
                    }
                }
            } catch {
                /* silencioso */
            }
        }
    }
};

// Action column helpers
const getActionCount = (row: any, actionType: string): number => {
    if (actionType === 'attributes') return (row.__attributes ?? []).length;
    if (actionType === 'variants') return (row.__variants ?? []).length;
    if (actionType === 'compatibility')
        return (row.__compatibility ?? []).length;
    return 0;
};

const getActionIcon = (actionType: string) => {
    if (actionType === 'attributes') return Tag;
    if (actionType === 'variants') return Package;
    if (actionType === 'compatibility') return Car;
    return Plus;
};

const getActionLabel = (actionType: string, count: number) => {
    if (actionType === 'attributes') return count ? `${count} attr` : '+ Attrs';
    if (actionType === 'variants') return count ? `${count} var` : '+ Var';
    if (actionType === 'compatibility')
        return count ? `${count} compat` : '+ Compat';
    return '+';
};

const runImport = async () => {
    if (!canImport.value) return;
    error.value = null;
    importRunning.value = true;
    try {
        const rows = editedRows.value
            .filter((row) => row.__valid)
            .map((row) => {
                const clean: any = { __row: row.__row };
                props.config.columns.forEach((col) => {
                    if (col.actionType) return; // skip action columns
                    if (row[col.key] !== undefined && row[col.key] !== '') {
                        clean[col.key] = row[col.key];
                    }
                });
                // Include enriched data
                clean.__attributes = row.__attributes ?? [];
                clean.__variants = row.__variants ?? [];
                clean.__compatibility = row.__compatibility ?? [];
                return clean;
            });
        const response = await importService.execute(props.config.entity, rows);
        result.value = response.data ?? response;
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error al importar.';
    } finally {
        importRunning.value = false;
    }
};

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};
</script>

<template>
    <div class="mx-auto max-w-7xl space-y-6">
        <div class="mb-4">
            <h1
                class="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white"
            >
                <FileSpreadsheet class="h-6 w-6 text-emerald-600" />
                {{ config.title }}
            </h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ config.description }}
            </p>
        </div>

        <!-- Step 1: File Upload -->
        <div
            class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-border dark:bg-card"
        >
            <h2
                class="mb-4 text-lg font-semibold text-gray-900 dark:text-white"
            >
                1. Seleccionar archivo
            </h2>

            <div
                @dragover.prevent="dragOver = true"
                @dragleave="dragOver = false"
                @drop.prevent="handleDrop"
                :class="[
                    'relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all',
                    dragOver
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
                        : file
                          ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-600 dark:bg-emerald-900/10'
                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:border-border dark:hover:bg-muted/30',
                ]"
                @click="fileInputRef?.click()"
            >
                <input
                    ref="fileInputRef"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    class="hidden"
                    @change="handleFileSelect"
                />
                <UploadCloud
                    v-if="!file"
                    class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
                />
                <CheckCircle2
                    v-else
                    class="mx-auto h-12 w-12 text-emerald-500"
                />
                <div v-if="!file" class="mt-4">
                    <p
                        class="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Arrastra tu archivo aquí o haz clic para seleccionar
                    </p>
                    <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        .xlsx, .xls, .csv — máx 25MB
                    </p>
                </div>
                <div v-else class="mt-4">
                    <p
                        class="text-sm font-medium text-emerald-700 dark:text-emerald-300"
                    >
                        {{ file.name }}
                    </p>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {{ formatFileSize(file.size) }}
                    </p>
                </div>
            </div>

            <div class="mt-4 flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    @click="downloadTemplate"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/30"
                >
                    <Download class="h-4 w-4" /> Descargar Plantilla
                </button>

                <button
                    type="button"
                    :disabled="!hasFile || previewLoading"
                    @click="previewImport"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
                >
                    <Eye class="h-4 w-4" />
                    {{
                        previewLoading ? 'Previsualizando...' : 'Previsualizar'
                    }}
                </button>

                <button
                    v-if="hasPreview"
                    type="button"
                    @click="resetPreview"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-50 dark:border-border dark:text-gray-400 dark:hover:bg-muted/30"
                >
                    <XIcon class="h-4 w-4" /> Limpiar
                </button>
            </div>
        </div>

        <!-- Error message -->
        <div
            v-if="error"
            class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
        >
            <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />{{ error }}
        </div>

        <!-- Step 2: Preview Editable -->
        <div
            v-if="hasPreview"
            class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
        >
            <div
                class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-border dark:bg-background"
            >
                <div>
                    <h2
                        class="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        2. Revisar datos
                    </h2>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Total: {{ editedRows.length }} filas ·
                        <span class="text-emerald-600"
                            >✓ {{ validCount }} válidas</span
                        >
                        <span v-if="errorCount > 0" class="text-red-600">
                            · ✗ {{ errorCount }} con error</span
                        >
                    </p>
                </div>
                <p class="text-xs text-gray-400">
                    Edita las celdas y enriquece cada producto con atributos,
                    variantes y compatibilidad
                </p>
            </div>

            <div class="max-h-[600px] overflow-x-auto overflow-y-auto">
                <table
                    class="min-w-full divide-y divide-gray-200 text-xs dark:divide-border"
                >
                    <thead
                        class="sticky top-0 z-10 bg-gray-50 dark:bg-background"
                    >
                        <tr>
                            <th
                                class="w-12 px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300"
                            >
                                #
                            </th>
                            <!-- Editable columns -->
                            <th
                                v-for="col in editableColumns"
                                :key="col.key"
                                class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300"
                            >
                                {{ col.label
                                }}<span v-if="col.required" class="text-red-500"
                                    >*</span
                                >
                            </th>
                            <!-- Action columns -->
                            <th
                                v-for="col in actionColumns"
                                :key="col.key"
                                class="w-28 px-3 py-2 text-center font-semibold text-gray-600 dark:text-gray-300"
                            >
                                {{ col.label }}
                            </th>
                            <th
                                class="w-24 px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300"
                            >
                                Estado
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-border">
                        <tr
                            v-for="(row, rowIdx) in editedRows"
                            :key="rowIdx"
                            :class="
                                row.__valid
                                    ? 'hover:bg-gray-50 dark:hover:bg-muted/30'
                                    : 'bg-red-50/50 dark:bg-red-900/10'
                            "
                        >
                            <td
                                class="px-3 py-2 text-gray-500 dark:text-gray-400"
                            >
                                {{ row.__row }}
                            </td>

                            <!-- Editable inputs -->
                            <td
                                v-for="col in editableColumns"
                                :key="col.key"
                                class="px-1 py-1"
                            >
                                <input
                                    v-if="col.type === 'text' || !col.type"
                                    v-model="row[col.key]"
                                    type="text"
                                    :placeholder="col.placeholder || ''"
                                    class="w-full min-w-[80px] rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                />

                                <input
                                    v-else-if="col.type === 'number'"
                                    v-model.number="row[col.key]"
                                    type="number"
                                    step="0.01"
                                    class="w-full min-w-[70px] rounded border border-gray-200 bg-white px-2 py-1 text-right text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                />

                                <select
                                    v-else-if="col.type === 'select'"
                                    v-model="row[col.key]"
                                    class="w-full min-w-[80px] rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                >
                                    <option value="">—</option>
                                    <option
                                        v-for="opt in col.options ?? []"
                                        :key="opt.value"
                                        :value="opt.value"
                                    >
                                        {{ opt.label }}
                                    </option>
                                </select>

                                <div
                                    v-else-if="col.type === 'searchable'"
                                    class="flex items-center gap-1"
                                >
                                    <SearchableSelect
                                        :model-value="row[col.key]"
                                        @update:model-value="
                                            onSearchableChange(
                                                col,
                                                rowIdx,
                                                $event,
                                            )
                                        "
                                        :options="getOptionsForColumn(col)"
                                        placeholder="Buscar..."
                                        class="min-w-[120px] flex-1"
                                    />
                                    <button
                                        v-if="col.creatable"
                                        type="button"
                                        @click="emit('create', col.key, rowIdx)"
                                        class="rounded p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                        title="Crear nuevo"
                                    >
                                        <Plus class="h-4 w-4" />
                                    </button>
                                </div>
                            </td>

                            <!-- Action columns: badge + button -->
                            <td
                                v-for="col in actionColumns"
                                :key="col.key"
                                class="px-1 py-2 text-center"
                            >
                                <button
                                    type="button"
                                    @click="
                                        emit(
                                            'row-action',
                                            col.actionType!,
                                            rowIdx,
                                        )
                                    "
                                    :class="[
                                        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
                                        getActionCount(row, col.actionType!) > 0
                                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                            : 'border-gray-200 bg-white text-gray-500 hover:border-blue-400 hover:text-blue-600 dark:border-border dark:bg-muted/30 dark:text-gray-400',
                                    ]"
                                >
                                    <component
                                        :is="getActionIcon(col.actionType!)"
                                        class="h-3 w-3"
                                    />
                                    <span class="font-medium">{{
                                        getActionLabel(
                                            col.actionType!,
                                            getActionCount(
                                                row,
                                                col.actionType!,
                                            ),
                                        )
                                    }}</span>
                                </button>
                            </td>

                            <!-- Status -->
                            <td class="px-3 py-2">
                                <template v-if="row.__valid">
                                    <span
                                        class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                        >OK</span
                                    >
                                    <p
                                        v-if="row.__warnings?.length"
                                        class="mt-1 text-[11px] leading-tight text-amber-600 dark:text-amber-300"
                                    >
                                        {{ row.__warnings.join(' ') }}
                                    </p>
                                </template>
                                <template v-else>
                                    <span
                                        class="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                        >Error</span
                                    >
                                    <p
                                        v-if="row.__errors?.length"
                                        class="mt-1 text-[11px] leading-tight text-red-600 dark:text-red-300"
                                    >
                                        {{ row.__errors.join(' ') }}
                                    </p>
                                    <p
                                        v-if="row.__warnings?.length"
                                        class="mt-1 text-[11px] leading-tight text-amber-600 dark:text-amber-300"
                                    >
                                        {{ row.__warnings.join(' ') }}
                                    </p>
                                </template>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Import button -->
            <div
                class="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-border dark:bg-background"
            >
                <p class="text-xs text-gray-500 dark:text-gray-400">
                    Se importarán
                    <span
                        class="font-semibold text-emerald-600 dark:text-emerald-400"
                        >{{ validCount }}</span
                    >
                    de {{ editedRows.length }} filas
                </p>
                <button
                    type="button"
                    :disabled="!canImport"
                    @click="runImport"
                    class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <UploadCloud class="h-4 w-4" />
                    {{ importRunning ? 'Importando...' : 'Importar' }}
                </button>
            </div>
        </div>

        <!-- Step 3: Results -->
        <div
            v-if="result"
            class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
        >
            <div
                class="border-b border-gray-200 bg-emerald-50 px-6 py-4 dark:border-border dark:bg-emerald-900/20"
            >
                <h2
                    class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
                >
                    <CheckCircle2 class="h-5 w-5 text-emerald-600" />
                    Importación completada
                </h2>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    Importados:
                    <span
                        class="font-semibold text-emerald-600 dark:text-emerald-400"
                        >{{ result.success_count ?? 0 }}</span
                    >
                    · Errores:
                    <span
                        class="font-semibold"
                        :class="
                            (result.error_count ?? 0) > 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-600 dark:text-gray-300'
                        "
                        >{{ result.error_count ?? 0 }}</span
                    >
                </p>
            </div>
            <div
                v-if="result.errors?.length"
                class="max-h-60 overflow-y-auto p-4"
            >
                <p
                    class="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-400"
                >
                    Filas con error:
                </p>
                <ul class="space-y-1">
                    <li
                        v-for="(err, i) in result.errors"
                        :key="i"
                        class="text-xs text-red-700 dark:text-red-300"
                    >
                        <span class="font-medium">Fila {{ err.row }}</span
                        >{{ err.label ? ` (${err.label})` : '' }}:
                        {{ err.error }}
                    </li>
                </ul>
            </div>
            <div
                v-if="result.results?.length"
                class="max-h-60 overflow-y-auto border-t border-gray-200 p-4 dark:border-border"
            >
                <p
                    class="mb-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400"
                >
                    Importados correctamente:
                </p>
                <ul class="space-y-1">
                    <li
                        v-for="(res, i) in result.results.slice(0, 20)"
                        :key="i"
                        class="text-xs text-emerald-700 dark:text-emerald-300"
                    >
                        Fila {{ res.row }}: {{ res.label }}
                        <span class="text-gray-400">#{{ res.id }}</span>
                    </li>
                    <li
                        v-if="result.results.length > 20"
                        class="text-xs text-gray-400"
                    >
                        ... y {{ result.results.length - 20 }} más
                    </li>
                </ul>
            </div>
        </div>
    </div>
</template>
