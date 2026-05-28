<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
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
    History,
    RefreshCw,
    RotateCcw,
    ChevronDown,
} from 'lucide-vue-next';
import apiClient from '@/services/api/client';

const props = defineProps<{ config: ImporterConfig }>();

const file = ref<File | null>(null);
const dragOver = ref(false);
const previewRows = ref<any[]>([]);
const editedRows = ref<any[]>([]);
const previewSummary = ref<any | null>(null);
const importSheets = ref<any[]>([]);
const selectedSheetIndex = ref<number | null>(null);
const detectedColumns = ref<any[]>([]);
const fieldMapping = ref<Record<string, string>>({});
const requiredFields = ref<string[]>([]);
const importProfiles = ref<any[]>([]);
const selectedProfileId = ref<number | null>(null);
const importMode = ref('create_update');
const validationRunning = ref(false);
const fullValidationReportActive = ref(false);
const result = ref<any | null>(null);
const error = ref<string | null>(null);
const previewLoading = ref(false);
const importRunning = ref(false);
const fullImportRunning = ref(false);
const activeImportRunId = ref<number | null>(null);
const pendingPollCount = ref(0);
const processNowAttempted = ref(false);
const importRuns = ref<any[]>([]);
const importRunsLoading = ref(false);
const importHistoryExpanded = ref(false);
const creatingBrands = ref<Record<string, boolean>>({});
let importStatusTimer: ReturnType<typeof setInterval> | null = null;
let importStatusRefreshInFlight = false;
const searchableOptions = ref<Record<string, any[]>>({});
const fileInputRef = ref<HTMLInputElement | null>(null);
const MAX_IMPORT_FILE_BYTES = 100 * 1024 * 1024;

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
const hasMultipleSheets = computed(() => importSheets.value.length > 1);
const selectedImportSheet = computed(() =>
    importSheets.value.find(
        (sheet) => sheet.index === selectedSheetIndex.value,
    ),
);
const canImport = computed(
    () =>
        hasPreview.value &&
        validCount.value > 0 &&
        !importRunning.value &&
        !fullValidationReportActive.value &&
        !props.config.fullFileImport,
);
const canRunFullFile = computed(
    () =>
        props.config.fullFileImport &&
        hasFile.value &&
        !previewLoading.value &&
        !fullImportRunning.value &&
        !validationRunning.value,
);
const missingBrandReferences = computed<string[]>(() => {
    const previewBrands =
        previewSummary.value?.missing_references?.brands ??
        previewSummary.value?.missingReferences?.brands;
    const resultBrands =
        result.value?.summary?.missing_references?.brands ??
        result.value?.summary?.missingReferences?.brands;

    return [...new Set([...(previewBrands ?? []), ...(resultBrands ?? [])])];
});
const isValidationResult = computed(
    () =>
        result.value?.run_type === 'validation' ||
        result.value?.mode === 'validate_only',
);
const resultHasErrors = computed(
    () =>
        result.value?.status === 'failed' ||
        Number(result.value?.error_count ?? 0) > 0,
);
const resultTitle = computed(() => {
    if (
        result.value?.status === 'pending' ||
        result.value?.status === 'running'
    ) {
        return isValidationResult.value
            ? 'Validacion en proceso'
            : 'Importacion en proceso';
    }

    if (result.value?.status === 'failed') {
        return isValidationResult.value
            ? 'Validacion con error'
            : 'Importacion con error';
    }

    if (isValidationResult.value) {
        return Number(result.value?.error_count ?? 0) > 0
            ? 'Validacion completada con errores'
            : 'Validacion completada';
    }

    return 'Importacion completada';
});
const resultHeaderClass = computed(() => {
    if (resultHasErrors.value) {
        return isValidationResult.value
            ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'
            : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20';
    }

    return 'border-gray-200 bg-emerald-50 dark:border-border dark:bg-emerald-900/20';
});
const resultIconClass = computed(() =>
    resultHasErrors.value
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-emerald-600 dark:text-emerald-400',
);
const availableMappingFields = computed(() => [
    { key: 'ignore', label: 'Ignorar' },
    ...props.config.columns
        .filter((column) => !column.actionType)
        .map((column) => ({ key: column.key, label: column.label })),
]);
const importerShellClass = computed(() =>
    props.config.fullFileImport
        ? 'mx-auto w-full max-w-[96rem] space-y-6'
        : 'mx-auto w-full max-w-7xl space-y-6',
);
const activeHistoryRun = computed(() =>
    importRuns.value.find((run) => run.id === activeImportRunId.value),
);
const activeImportRunsCount = computed(
    () =>
        importRuns.value.filter((run) => isActiveRunStatus(run.status)).length,
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
        error.value = 'El archivo no puede superar 100MB.';
        if (fileInputRef.value) fileInputRef.value.value = '';
        return;
    }

    file.value = selectedFile;
};

const resetPreview = () => {
    previewRows.value = [];
    editedRows.value = [];
    previewSummary.value = null;
    importSheets.value = [];
    selectedSheetIndex.value = null;
    detectedColumns.value = [];
    fieldMapping.value = {};
    requiredFields.value = [];
    fullValidationReportActive.value = false;
    result.value = null;
    error.value = null;
    activeImportRunId.value = null;
    stopImportStatusPolling();
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

const previewImport = async (
    sheetIndex: number | null = selectedSheetIndex.value,
) => {
    if (!file.value) return;
    error.value = null;
    result.value = null;
    fullValidationReportActive.value = false;
    previewLoading.value = true;
    try {
        const response = await importService.preview(
            props.config.entity,
            file.value,
            {
                ...(sheetIndex !== null ? { sheet_index: sheetIndex } : {}),
                mapping: fieldMapping.value,
                mode: importMode.value,
                profile_id: selectedProfileId.value,
            },
        );
        if (response.data?.async && response.data?.import_run_id) {
            activeImportRunId.value = response.data.import_run_id;
            importHistoryExpanded.value = true;
            result.value = response.data;
            validationRunning.value = true;
            previewRows.value = [];
            editedRows.value = [];
            previewSummary.value = response.data?.summary ?? null;
            importSheets.value = response.data?.sheets ?? [];
            detectedColumns.value = response.data?.detected_columns ?? [];
            requiredFields.value = response.data?.required_fields ?? [];
            if (Object.keys(fieldMapping.value).length === 0) {
                fieldMapping.value = response.data?.suggested_mapping ?? {};
            }
            selectedSheetIndex.value =
                response.data?.selected_sheet?.index ?? sheetIndex ?? null;
            await loadImportRuns(false);
            startImportStatusPolling();
            return;
        }

        previewRows.value = response.data?.rows ?? [];
        previewSummary.value = response.data?.summary ?? null;
        importSheets.value = response.data?.sheets ?? [];
        detectedColumns.value = response.data?.detected_columns ?? [];
        requiredFields.value = response.data?.required_fields ?? [];
        if (Object.keys(fieldMapping.value).length === 0) {
            fieldMapping.value = response.data?.suggested_mapping ?? {};
        }
        selectedSheetIndex.value =
            response.data?.selected_sheet?.index ?? sheetIndex ?? null;
        applyPreviewRows(previewRows.value);
        await loadSearchableOptions();
        resolveSearchableValues();
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            (e.code === 'ECONNABORTED'
                ? 'La previsualizacion tardo demasiado. Se debe procesar en cola para evitar el timeout.'
                : null) ||
            'No se pudo generar la previsualización.';
        previewRows.value = [];
        editedRows.value = [];
        previewSummary.value = null;
        importSheets.value = [];
        selectedSheetIndex.value = null;
        detectedColumns.value = [];
        requiredFields.value = [];
    } finally {
        previewLoading.value = false;
    }
};

const applyPreviewRows = (rows: any[]) => {
    editedRows.value = rows.map((row) => ({
        ...row.data,
        __row: row.row,
        __valid: row.is_valid,
        __errors: row.errors ?? [],
        __warnings: row.warnings ?? row.data?.__warnings ?? [],
        __attributes: row.data?.__attributes ?? [],
        __variants: row.data?.__variants ?? [],
        __variant_preview: row.data?.__variant_preview ?? null,
        __product_group_key: row.data?.__product_group_key ?? null,
        __compatibility:
            row.data?.__compatibility ??
            row.data?.__vehicle_compatibility ??
            [],
        __vehicle_creation_candidate:
            row.data?.__vehicle_creation_candidate ?? null,
    }));
};

const loadImportProfiles = async () => {
    if (!props.config.fullFileImport) return;
    try {
        const response = await importService.listProfiles(props.config.entity);
        importProfiles.value = response.data ?? [];
    } catch {
        importProfiles.value = [];
    }
};

const isActiveRunStatus = (status: string | undefined) =>
    ['pending', 'running', 'cancel_requested'].includes(status ?? '');

const loadImportRuns = async (resumeActive = false) => {
    if (!props.config.fullFileImport) return;
    importRunsLoading.value = true;
    try {
        const response = await importService.listRuns(props.config.entity, {
            per_page: 10,
        });
        importRuns.value = response.data ?? [];

        if (resumeActive && !activeImportRunId.value) {
            const activeRun = importRuns.value.find((run) =>
                isActiveRunStatus(run.status),
            );
            if (activeRun) {
                importHistoryExpanded.value = true;
                await openImportRun(activeRun);
            }
        }
    } catch {
        importRuns.value = [];
    } finally {
        importRunsLoading.value = false;
    }
};

const toggleImportHistory = () => {
    importHistoryExpanded.value = !importHistoryExpanded.value;
};

const applySelectedProfile = () => {
    const profile = importProfiles.value.find(
        (item) => item.id === selectedProfileId.value,
    );
    if (!profile) return;
    fieldMapping.value = profile.mapping ?? {};
    importMode.value = profile.mode ?? 'create_update';
    selectedSheetIndex.value = profile.sheet_index ?? selectedSheetIndex.value;
};

const saveCurrentProfile = async () => {
    const name = window.prompt('Nombre del perfil');
    if (!name) return;
    const response = await importService.saveProfile(props.config.entity, {
        name,
        mapping: fieldMapping.value,
        sheet_index: selectedSheetIndex.value,
        mode: importMode.value,
    });
    const profile = response.data ?? response;
    await loadImportProfiles();
    selectedProfileId.value = profile.id ?? null;
};

const currentImportOptions = () => ({
    ...(selectedSheetIndex.value !== null
        ? { sheet_index: selectedSheetIndex.value }
        : {}),
    mapping: fieldMapping.value,
    mode: importMode.value,
    profile_id: selectedProfileId.value,
});

const handleSheetChange = async (event: Event) => {
    const value = Number((event.target as HTMLSelectElement).value);
    selectedSheetIndex.value = Number.isNaN(value) ? null : value;
    await previewImport(selectedSheetIndex.value);
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

const createMissingBrand = async (brandName: string) => {
    if (!brandName || creatingBrands.value[brandName]) return;
    creatingBrands.value = { ...creatingBrands.value, [brandName]: true };
    error.value = null;

    try {
        await apiClient.post('/brands', {
            name: brandName,
            status: 'active',
        });
        await previewImport(selectedSheetIndex.value);
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            `No se pudo crear la marca ${brandName}.`;
    } finally {
        const next = { ...creatingBrands.value };
        delete next[brandName];
        creatingBrands.value = next;
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
onMounted(loadImportProfiles);
onMounted(() => loadImportRuns(true));

defineExpose({
    reloadSearchableOptions: () => {
        searchableOptions.value = {};
        return loadSearchableOptions();
    },
    refreshPreview: () => previewImport(selectedSheetIndex.value),
    editedRows,
    previewSummary,
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

const getColumnInputWidthClass = (col: any): string => {
    const widthByKey: Record<string, string> = {
        nombre: 'min-w-[22rem]',
        descripcion: 'min-w-[18rem]',
        categoria: 'min-w-[14rem]',
        categorias_extra: 'min-w-[14rem]',
        atributos: 'min-w-[16rem]',
        brand: 'min-w-[12rem]',
        sku: 'min-w-[10rem]',
        system_id: 'min-w-[10rem]',
        warehouse: 'min-w-[10rem]',
    };

    return (
        widthByKey[col.key] ??
        (col.type === 'number' ? 'min-w-[6rem]' : 'min-w-[8rem]')
    );
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
    if (actionType === 'variants') {
        const group = previewSummary.value?.groups?.find(
            (item: any) => item.product_key === row.__product_group_key,
        );
        if (group?.variant_count !== undefined) {
            return Number(group.variant_count) || 0;
        }

        return (row.__variants ?? []).length + (row.__variant_preview ? 1 : 0);
    }
    if (actionType === 'compatibility') {
        const compatibilityCount = (row.__compatibility ?? []).length;
        return compatibilityCount || (row.__vehicle_creation_candidate ? 1 : 0);
    }
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

const importFullFile = async () => {
    if (!file.value || !canRunFullFile.value) return;
    error.value = null;
    result.value = null;
    fullImportRunning.value = true;
    validationRunning.value = false;
    fullValidationReportActive.value = false;

    try {
        const response = await importService.importFile(
            props.config.entity,
            file.value,
            currentImportOptions(),
        );
        activeImportRunId.value = response.data?.import_run_id ?? null;
        result.value = response.data ?? response;

        if (activeImportRunId.value) {
            importHistoryExpanded.value = true;
            await loadImportRuns(false);
            startImportStatusPolling();
        } else {
            fullImportRunning.value = false;
        }
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            'No se pudo iniciar la importacion completa.';
        fullImportRunning.value = false;
    }
};

const cancelActiveRun = async () => {
    if (!activeImportRunId.value) return;
    await importService.cancelRun(props.config.entity, activeImportRunId.value);
    await loadImportRuns(false);
    await refreshImportRun();
};

const retryFailedRows = async () => {
    if (!activeImportRunId.value) return;
    const response = await importService.retryFailed(
        props.config.entity,
        activeImportRunId.value,
    );
    activeImportRunId.value = response.data?.import_run_id ?? null;
    result.value = response.data ?? response;
    await loadImportRuns(false);
    if (activeImportRunId.value) startImportStatusPolling();
};

const applyCompletedValidationRows = async () => {
    const validationRows = result.value?.validation_rows ?? [];
    if (validationRows.length === 0) return;

    previewRows.value = validationRows;
    previewSummary.value = result.value?.summary ?? null;
    applyPreviewRows(validationRows);
    await loadSearchableOptions();
    resolveSearchableValues();
    fullValidationReportActive.value = true;
};

const downloadErrorReport = async () => {
    if (!activeImportRunId.value) return;
    await downloadRunErrors(activeImportRunId.value);
};

const downloadRunErrors = async (importRunId: number) => {
    error.value = null;
    try {
        const blob = await importService.downloadErrors(
            props.config.entity,
            importRunId,
        );
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `errores-importacion-${importRunId}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            'No se pudo descargar el archivo de errores.';
    }
};

const downloadRunSource = async (run: any) => {
    error.value = null;
    try {
        const blob = await importService.downloadSource(
            props.config.entity,
            run.id,
        );
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = run.original_filename || `importacion-${run.id}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            'No se pudo descargar el archivo original.';
    }
};

const openImportRun = async (run: any) => {
    error.value = null;
    activeImportRunId.value = run.id;
    const response = await importService.getRun(props.config.entity, run.id);
    result.value = response.data ?? response;
    const status = result.value?.status;

    validationRunning.value =
        result.value?.run_type === 'validation' && isActiveRunStatus(status);
    fullImportRunning.value =
        result.value?.run_type !== 'validation' && isActiveRunStatus(status);

    if (result.value?.run_type === 'validation' && status === 'completed') {
        await applyCompletedValidationRows();
    }

    if (isActiveRunStatus(status)) {
        startImportStatusPolling();
    } else {
        stopImportStatusPolling();
    }
};

const cancelHistoryRun = async (run: any) => {
    await importService.cancelRun(props.config.entity, run.id);
    await loadImportRuns(false);
    if (activeImportRunId.value === run.id) {
        await refreshImportRun();
    }
};

const retryHistoryRun = async (run: any) => {
    const response = await importService.retryFailed(
        props.config.entity,
        run.id,
    );
    activeImportRunId.value = response.data?.import_run_id ?? null;
    result.value = response.data ?? response;
    await loadImportRuns(false);
    if (activeImportRunId.value) {
        startImportStatusPolling();
    }
};

const refreshImportRun = async () => {
    if (!activeImportRunId.value) return;
    const importRunId = activeImportRunId.value;
    const response = await importService.getRun(
        props.config.entity,
        importRunId,
    );
    result.value = response.data ?? response;
    await loadImportRuns(false);
    let status = result.value?.status;
    if (status === 'pending') {
        pendingPollCount.value += 1;

        if (pendingPollCount.value >= 6 && !processNowAttempted.value) {
            processNowAttempted.value = true;

            try {
                const processResponse = await importService.processRunNow(
                    props.config.entity,
                    importRunId,
                );
                result.value = processResponse.data ?? processResponse;
                await loadImportRuns(false);
                status = result.value?.status;
            } catch (e: any) {
                error.value =
                    e.response?.data?.message ||
                    'El proceso sigue en cola. Puedes mantener esta pantalla abierta; se seguira consultando el avance.';
            }
        } else if (pendingPollCount.value >= 6) {
            error.value =
                'El proceso sigue en cola. Puedes mantener esta pantalla abierta; se seguira consultando el avance.';
        }

        if (status === 'pending') {
            return;
        }
    }

    pendingPollCount.value = 0;
    if (
        status === 'completed' ||
        status === 'failed' ||
        status === 'cancelled'
    ) {
        fullImportRunning.value = false;
        validationRunning.value = false;
        if (result.value?.run_type === 'validation') {
            if (status === 'completed') {
                await applyCompletedValidationRows();
            }
        }
        stopImportStatusPolling();
    }
};

const startImportStatusPolling = () => {
    stopImportStatusPolling();
    pendingPollCount.value = 0;
    processNowAttempted.value = false;
    importStatusTimer = setInterval(() => {
        if (importStatusRefreshInFlight) return;

        importStatusRefreshInFlight = true;
        refreshImportRun().catch(() => {
            error.value = 'No se pudo actualizar el avance de la importacion.';
            fullImportRunning.value = false;
            validationRunning.value = false;
            stopImportStatusPolling();
        }).finally(() => {
            importStatusRefreshInFlight = false;
        });
    }, 2500);
};

const stopImportStatusPolling = () => {
    if (importStatusTimer) {
        clearInterval(importStatusTimer);
        importStatusTimer = null;
    }
};

onUnmounted(() => {
    stopImportStatusPolling();
});

const runTypeLabel = (run: any): string => {
    if (run.preview_async) return 'Preview';
    if (run.run_type === 'validation') return 'Validacion';
    if (run.mode === 'retry_failed') return 'Reintento';
    return 'Importacion';
};

const statusLabel = (status: string): string => {
    const labels: Record<string, string> = {
        pending: 'En cola',
        running: 'Procesando',
        completed: 'Completado',
        failed: 'Fallido',
        cancel_requested: 'Cancelando',
        cancelled: 'Cancelado',
    };

    return labels[status] ?? status;
};

const statusClass = (status: string): string => {
    if (status === 'completed') {
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    }
    if (status === 'failed' || status === 'cancelled') {
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    }
    if (status === 'running') {
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    }

    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
};

const formatRunDate = (value: string | null | undefined): string => {
    if (!value) return 'Sin fecha';

    return new Intl.DateTimeFormat('es-PA', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value));
};

const runProgressPercent = (run: any): number => {
    const total = Number(run.total_rows ?? 0);
    if (total <= 0) {
        return isActiveRunStatus(run.status)
            ? 5
            : run.status === 'completed'
              ? 100
              : 0;
    }

    return Math.min(
        100,
        Math.round((Number(run.processed_rows ?? 0) / total) * 100),
    );
};

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};
</script>

<template>
    <div :class="importerShellClass">
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
                        .xlsx, .xls, .csv - max 100MB
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
                    @click="() => previewImport()"
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

                <button
                    v-if="config.fullFileImport"
                    type="button"
                    :disabled="!canRunFullFile"
                    @click="importFullFile"
                    class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <UploadCloud class="h-4 w-4" />
                    {{
                        fullImportRunning
                            ? 'Importando archivo...'
                            : 'Importar archivo completo'
                    }}
                </button>

                <p
                    v-if="
                        config.fullFileImport && missingBrandReferences.length
                    "
                    class="basis-full text-xs font-medium text-red-700 dark:text-red-300"
                >
                    Crea o corrige las marcas faltantes antes de importar el
                    archivo completo.
                </p>

                <button
                    v-if="
                        activeImportRunId &&
                        (fullImportRunning || validationRunning)
                    "
                    type="button"
                    @click="cancelActiveRun"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                >
                    Cancelar
                </button>
            </div>

            <div
                v-if="hasMultipleSheets"
                class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20"
            >
                <label
                    class="text-sm font-semibold text-amber-900 dark:text-amber-200"
                    for="import-sheet-select"
                >
                    Hoja detectada
                </label>
                <div
                    class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                    <select
                        id="import-sheet-select"
                        :value="selectedSheetIndex ?? ''"
                        :disabled="previewLoading || fullImportRunning"
                        class="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none disabled:opacity-60 dark:border-amber-700 dark:bg-background dark:text-white"
                        @change="handleSheetChange"
                    >
                        <option
                            v-for="sheet in importSheets"
                            :key="sheet.index"
                            :value="sheet.index"
                        >
                            {{ sheet.name }} - {{ sheet.row_count }} filas -
                            {{ sheet.matched_headers?.length ?? 0 }} columnas
                            {{ sheet.is_recommended ? ' - recomendada' : '' }}
                        </option>
                    </select>
                    <p class="text-xs text-amber-800 dark:text-amber-300">
                        La importacion completa usara esta misma hoja.
                    </p>
                </div>
                <p
                    v-if="
                        selectedImportSheet &&
                        !selectedImportSheet.is_compatible
                    "
                    class="mt-2 text-xs font-medium text-red-700 dark:text-red-300"
                >
                    Esta hoja no parece tener encabezados completos de
                    productos.
                </p>
            </div>

            <div
                v-if="
                    config.fullFileImport &&
                    (importProfiles.length || detectedColumns.length)
                "
                class="mt-4 grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 lg:grid-cols-2 dark:border-border dark:bg-background"
            >
                <div>
                    <p
                        class="text-sm font-semibold text-gray-800 dark:text-gray-100"
                    >
                        Perfil y modo
                    </p>
                    <div class="mt-2 grid gap-2 sm:grid-cols-2">
                        <select
                            v-model="selectedProfileId"
                            class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-card dark:text-white"
                            @change="applySelectedProfile"
                        >
                            <option :value="null">Sin perfil</option>
                            <option
                                v-for="profile in importProfiles"
                                :key="profile.id"
                                :value="profile.id"
                            >
                                {{ profile.name }}
                            </option>
                        </select>
                        <select
                            v-model="importMode"
                            class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-card dark:text-white"
                        >
                            <option value="create_update">
                                Crear y actualizar
                            </option>
                            <option value="create_only">
                                Solo crear nuevos
                            </option>
                            <option value="update_stock_price">
                                Solo stock/precio
                            </option>
                        </select>
                    </div>
                    <button
                        type="button"
                        class="mt-2 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
                        @click="saveCurrentProfile"
                    >
                        Guardar mapping como perfil
                    </button>
                </div>

                <div v-if="detectedColumns.length">
                    <p
                        class="text-sm font-semibold text-gray-800 dark:text-gray-100"
                    >
                        Mapeo de columnas
                    </p>
                    <div class="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
                        <div
                            v-for="column in detectedColumns"
                            :key="column.key"
                            class="grid grid-cols-[1fr,180px] items-center gap-2 text-xs"
                        >
                            <span
                                class="truncate text-gray-600 dark:text-gray-300"
                            >
                                {{ column.label }}
                            </span>
                            <select
                                v-model="fieldMapping[column.key]"
                                class="rounded border border-gray-300 bg-white px-2 py-1 dark:border-border dark:bg-card dark:text-white"
                            >
                                <option
                                    v-for="field in availableMappingFields"
                                    :key="field.key"
                                    :value="field.key"
                                >
                                    {{ field.label }}
                                </option>
                            </select>
                        </div>
                    </div>
                    <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Requeridos: {{ requiredFields.join(', ') || 'Ninguno' }}
                    </p>
                </div>
            </div>
        </div>

        <div
            v-if="config.fullFileImport"
            class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
        >
            <div
                class="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                :class="{
                    'border-b border-gray-200 dark:border-border':
                        importHistoryExpanded,
                }"
            >
                <button
                    type="button"
                    class="flex min-w-0 flex-1 items-center gap-3 text-left"
                    :aria-expanded="importHistoryExpanded"
                    @click="toggleImportHistory"
                >
                    <span
                        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-muted dark:text-gray-300"
                    >
                        <History class="h-5 w-5" />
                    </span>
                    <span class="min-w-0">
                        <span
                            class="flex flex-wrap items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
                        >
                            Historial de importaciones
                            <span
                                v-if="activeImportRunsCount > 0"
                                class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            >
                                {{ activeImportRunsCount }} activo{{
                                    activeImportRunsCount === 1 ? '' : 's'
                                }}
                            </span>
                        </span>
                        <span
                            class="mt-1 block text-xs text-gray-500 dark:text-gray-400"
                        >
                            {{
                                importHistoryExpanded
                                    ? 'Click para minimizar el historial.'
                                    : 'Click para ver procesos, descargas y reintentos.'
                            }}
                        </span>
                    </span>
                    <ChevronDown
                        class="ml-auto h-5 w-5 shrink-0 text-gray-400 transition-transform"
                        :class="{ 'rotate-180': importHistoryExpanded }"
                    />
                </button>
                <button
                    type="button"
                    :disabled="importRunsLoading"
                    @click="loadImportRuns(false)"
                    class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border dark:text-gray-300 dark:hover:bg-muted/30"
                >
                    <RefreshCw
                        class="h-4 w-4"
                        :class="{ 'animate-spin': importRunsLoading }"
                    />
                    Actualizar
                </button>
            </div>

            <div
                v-if="
                    importHistoryExpanded &&
                    importRunsLoading &&
                    importRuns.length === 0
                "
                class="px-6 py-6 text-sm text-gray-500 dark:text-gray-400"
            >
                Cargando historial...
            </div>
            <div
                v-else-if="importHistoryExpanded && importRuns.length === 0"
                class="px-6 py-6 text-sm text-gray-500 dark:text-gray-400"
            >
                Aun no hay importaciones guardadas.
            </div>
            <div v-else-if="importHistoryExpanded" class="overflow-x-auto">
                <table
                    class="min-w-full divide-y divide-gray-200 text-sm dark:divide-border"
                >
                    <thead class="bg-gray-50 dark:bg-background">
                        <tr>
                            <th
                                class="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300"
                            >
                                Archivo
                            </th>
                            <th
                                class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300"
                            >
                                Tipo
                            </th>
                            <th
                                class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300"
                            >
                                Estado
                            </th>
                            <th
                                class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300"
                            >
                                Progreso
                            </th>
                            <th
                                class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300"
                            >
                                Fecha
                            </th>
                            <th
                                class="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300"
                            >
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-border">
                        <tr
                            v-for="run in importRuns"
                            :key="run.id"
                            :class="[
                                activeHistoryRun?.id === run.id
                                    ? 'bg-blue-50/70 dark:bg-blue-950/20'
                                    : 'bg-white dark:bg-card',
                            ]"
                        >
                            <td class="px-6 py-4">
                                <div
                                    class="max-w-[24rem] truncate font-medium text-gray-900 dark:text-white"
                                    :title="run.original_filename"
                                >
                                    {{
                                        run.original_filename ||
                                        `Importacion #${run.id}`
                                    }}
                                </div>
                                <p
                                    class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                                >
                                    #{{ run.id }}
                                    <span v-if="run.user?.name">
                                        · {{ run.user.name }}</span
                                    >
                                </p>
                            </td>
                            <td
                                class="px-4 py-4 text-gray-700 dark:text-gray-300"
                            >
                                {{ runTypeLabel(run) }}
                            </td>
                            <td class="px-4 py-4">
                                <span
                                    class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                                    :class="statusClass(run.status)"
                                >
                                    {{ statusLabel(run.status) }}
                                </span>
                            </td>
                            <td class="px-4 py-4">
                                <div class="w-36">
                                    <div
                                        class="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-muted"
                                    >
                                        <div
                                            class="h-full rounded-full bg-blue-500"
                                            :style="{
                                                width: `${runProgressPercent(run)}%`,
                                            }"
                                        ></div>
                                    </div>
                                    <p
                                        class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                                    >
                                        {{ run.processed_rows ?? 0 }} /
                                        {{ run.total_rows ?? 0 }} filas
                                        <span
                                            v-if="
                                                Number(run.error_count ?? 0) > 0
                                            "
                                            class="text-red-600 dark:text-red-300"
                                        >
                                            · {{ run.error_count }} errores
                                        </span>
                                    </p>
                                </div>
                            </td>
                            <td
                                class="px-4 py-4 text-xs text-gray-500 dark:text-gray-400"
                            >
                                {{ formatRunDate(run.created_at) }}
                            </td>
                            <td class="px-6 py-4">
                                <div
                                    class="flex flex-wrap items-center justify-end gap-2"
                                >
                                    <button
                                        type="button"
                                        @click="openImportRun(run)"
                                        class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/30"
                                    >
                                        <Eye class="h-3.5 w-3.5" />
                                        Abrir
                                    </button>
                                    <button
                                        v-if="run.has_source_file"
                                        type="button"
                                        @click="downloadRunSource(run)"
                                        class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/30"
                                    >
                                        <Download class="h-3.5 w-3.5" />
                                        Original
                                    </button>
                                    <button
                                        v-if="
                                            run.has_errors ||
                                            Number(run.error_count ?? 0) > 0
                                        "
                                        type="button"
                                        @click="downloadRunErrors(run.id)"
                                        class="inline-flex items-center gap-1 rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/20"
                                    >
                                        <Download class="h-3.5 w-3.5" />
                                        Errores
                                    </button>
                                    <button
                                        v-if="run.can_cancel"
                                        type="button"
                                        @click="cancelHistoryRun(run)"
                                        class="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/20"
                                    >
                                        <XIcon class="h-3.5 w-3.5" />
                                        Cancelar
                                    </button>
                                    <button
                                        v-if="run.can_retry_failed"
                                        type="button"
                                        @click="retryHistoryRun(run)"
                                        class="inline-flex items-center gap-1 rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/20"
                                    >
                                        <RotateCcw class="h-3.5 w-3.5" />
                                        Reintentar
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
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
                        {{
                            fullValidationReportActive
                                ? '2. Revisar validacion completa'
                                : '2. Revisar datos'
                        }}
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
                <p
                    v-if="
                        !fullValidationReportActive &&
                        previewResult?.preview_limited
                    "
                    class="text-xs text-gray-400"
                >
                    Muestra limitada del archivo. Usa "Importar archivo
                    completo" para procesar todas las filas.
                </p>
                <p v-else class="text-xs text-gray-500 dark:text-gray-400">
                    Resultado de validacion completa. La importacion completa
                    usara el archivo original.
                </p>
            </div>

            <div
                v-if="fullValidationReportActive"
                class="border-b border-sky-200 bg-sky-50 px-6 py-3 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950/20 dark:text-sky-200"
            >
                Reporte de solo lectura: estas filas son para revisar errores y
                advertencias. Editar aqui no cambia el archivo que se importara
                con "Importar".
            </div>

            <div
                v-if="previewSummary"
                class="grid gap-3 border-b border-gray-200 bg-white px-6 py-3 text-xs sm:grid-cols-4 dark:border-border dark:bg-card"
            >
                <div>
                    <p class="font-semibold text-gray-700 dark:text-gray-200">
                        Grupos detectados
                    </p>
                    <p class="text-gray-500 dark:text-gray-400">
                        {{
                            previewSummary.productos_estimados ??
                            previewSummary.groups?.length ??
                            0
                        }}
                        productos /
                        {{ previewSummary.variantes_estimadas ?? 0 }}
                        variantes
                    </p>
                </div>
                <div>
                    <p class="font-semibold text-gray-700 dark:text-gray-200">
                        Categorias faltantes
                    </p>
                    <p class="text-gray-500 dark:text-gray-400">
                        {{
                            previewSummary.missing_categories?.length
                                ? previewSummary.missing_categories.join(', ')
                                : 'Ninguna'
                        }}
                    </p>
                </div>
                <div>
                    <p class="font-semibold text-gray-700 dark:text-gray-200">
                        Atributos tecnicos
                    </p>
                    <p class="text-gray-500 dark:text-gray-400">
                        {{
                            previewSummary.detected_attributes?.length
                                ? previewSummary.detected_attributes.join(', ')
                                : 'Ninguno'
                        }}
                    </p>
                </div>
                <div>
                    <p class="font-semibold text-gray-700 dark:text-gray-200">
                        Marcas faltantes
                    </p>
                    <p class="text-gray-500 dark:text-gray-400">
                        {{
                            missingBrandReferences.length
                                ? missingBrandReferences.join(', ')
                                : 'Ninguna'
                        }}
                    </p>
                </div>
            </div>

            <div
                v-if="missingBrandReferences.length"
                class="border-b border-red-200 bg-red-50 px-6 py-3 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/20 dark:text-red-200"
            >
                <div class="mb-2 font-semibold">
                    Marcas faltantes. Crea estas marcas antes de importar el
                    archivo completo.
                </div>
                <div class="flex flex-wrap gap-2">
                    <button
                        v-for="brandName in missingBrandReferences"
                        :key="brandName"
                        type="button"
                        @click="createMissingBrand(brandName)"
                        :disabled="creatingBrands[brandName]"
                        class="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2 py-1 font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100"
                    >
                        <Plus class="h-3.5 w-3.5" />
                        {{
                            creatingBrands[brandName]
                                ? 'Creando...'
                                : `Crear ${brandName}`
                        }}
                    </button>
                </div>
            </div>

            <div
                v-if="
                    previewSummary?.suggestions?.categories?.length ||
                    previewSummary?.suggestions?.brands?.length
                "
                class="border-b border-amber-200 bg-amber-50 px-6 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200"
            >
                Sugerencias:
                <span
                    v-for="suggestion in previewSummary.suggestions.categories"
                    :key="suggestion.value"
                    class="mr-3"
                >
                    {{ suggestion.value }} -> {{ suggestion.suggestion }}
                </span>
                <span
                    v-for="suggestion in previewSummary.suggestions.brands ??
                    []"
                    :key="`brand-${suggestion.value}`"
                    class="mr-3"
                >
                    {{ suggestion.value }} -> {{ suggestion.suggestion }}
                </span>
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
                                :class="getColumnInputWidthClass(col)"
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
                                    :disabled="fullValidationReportActive"
                                    :placeholder="col.placeholder || ''"
                                    class="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                    :class="getColumnInputWidthClass(col)"
                                />

                                <input
                                    v-else-if="col.type === 'number'"
                                    v-model.number="row[col.key]"
                                    type="number"
                                    step="0.01"
                                    :disabled="fullValidationReportActive"
                                    class="w-full rounded border border-gray-200 bg-white px-2 py-1 text-right text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                    :class="getColumnInputWidthClass(col)"
                                />

                                <select
                                    v-else-if="col.type === 'select'"
                                    v-model="row[col.key]"
                                    :disabled="fullValidationReportActive"
                                    class="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                    :class="getColumnInputWidthClass(col)"
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
                                        :disabled="fullValidationReportActive"
                                        class="flex-1"
                                        :class="getColumnInputWidthClass(col)"
                                    />
                                    <button
                                        v-if="
                                            col.creatable &&
                                            !fullValidationReportActive
                                        "
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
                                    :disabled="fullValidationReportActive"
                                    :class="[
                                        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
                                        getActionCount(row, col.actionType!) > 0
                                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                            : 'border-gray-200 bg-white text-gray-500 hover:border-blue-400 hover:text-blue-600 disabled:hover:border-gray-200 disabled:hover:text-gray-500 dark:border-border dark:bg-muted/30 dark:text-gray-400',
                                        fullValidationReportActive
                                            ? 'cursor-not-allowed opacity-70'
                                            : '',
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
                <p
                    v-if="!fullValidationReportActive"
                    class="text-xs text-gray-500 dark:text-gray-400"
                >
                    Se importarán
                    <span
                        class="font-semibold text-emerald-600 dark:text-emerald-400"
                        >{{ validCount }}</span
                    >
                    de {{ editedRows.length }} filas
                </p>
                <p v-else class="text-xs text-gray-500 dark:text-gray-400">
                    Reporte de validacion: {{ validCount }} filas validas y
                    {{ errorCount }} con error.
                </p>
                <button
                    v-if="!fullValidationReportActive && !config.fullFileImport"
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
            <div class="border-b px-6 py-4" :class="resultHeaderClass">
                <h2
                    class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
                >
                    <component
                        :is="resultHasErrors ? AlertCircle : CheckCircle2"
                        class="h-5 w-5"
                        :class="resultIconClass"
                    />
                    {{ resultTitle }}
                </h2>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    <template v-if="result.total_rows !== undefined">
                        Procesadas:
                        <span class="font-semibold">
                            {{ result.processed_rows ?? 0 }}
                        </span>
                        de
                        <span class="font-semibold">
                            {{ result.total_rows ?? 0 }}
                        </span>
                        &middot;
                    </template>
                    {{ isValidationResult ? 'Validas:' : 'Importados:' }}
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
                <div class="mt-3 flex flex-wrap gap-2">
                    <button
                        v-if="activeImportRunId && result.error_count"
                        type="button"
                        class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200"
                        @click="downloadErrorReport"
                    >
                        Descargar errores
                    </button>
                    <button
                        v-if="
                            activeImportRunId &&
                            result.error_count &&
                            !isValidationResult
                        "
                        type="button"
                        class="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300"
                        @click="retryFailedRows"
                    >
                        Reintentar fallidas
                    </button>
                </div>
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
                    {{
                        isValidationResult
                            ? 'Filas validas en la validacion:'
                            : 'Importados correctamente:'
                    }}
                </p>
                <ul class="space-y-1">
                    <li
                        v-for="(res, i) in result.results.slice(0, 20)"
                        :key="i"
                        class="text-xs text-emerald-700 dark:text-emerald-300"
                    >
                        Fila {{ res.row }}: {{ res.label }}
                        <span v-if="res.id" class="text-gray-400"
                            >#{{ res.id }}</span
                        >
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
