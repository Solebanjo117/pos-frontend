<script setup lang="ts">
import { router } from '@inertiajs/vue3';
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
    RotateCw,
    ChevronDown,
    Trash2,
    Check,
    FileText,
    Settings,
    ListChecks,
    Maximize2,
    Minimize2,
    ArrowRight,
} from 'lucide-vue-next';
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import ImportDiagnosticsPanel from '@/components/Import/ImportDiagnosticsPanel.vue';
import ImportFileUploader from '@/components/Import/ImportFileUploader.vue';
import ImportFlatPreviewTable from '@/components/Import/ImportFlatPreviewTable.vue';
import ImportGroupedPreviewTable from '@/components/Import/ImportGroupedPreviewTable.vue';
import ImportHistoryPanel from '@/components/Import/ImportHistoryPanel.vue';
import ImportPreviewTable from '@/components/Import/ImportPreviewTable.vue';
import ImportResultsPanel from '@/components/Import/ImportResultsPanel.vue';
import ImportSheetMapper from '@/components/Import/ImportSheetMapper.vue';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    hasExplicitMapping,
    mappingsAreEqual,
    useImportMapping,
} from '@/composables/useImportMapping';
import { useImportPreviewPagination } from '@/composables/useImportPreviewPagination';
import { useImportProfiles } from '@/composables/useImportProfiles';
import { useImportTableEditing } from '@/composables/useImportTableEditing';
import { useToast } from '@/composables/useToast';
import apiClient from '@/services/api/client';
import { importService, type ImporterConfig } from '@/services/import';
import type {
    ImportRow,
    ImportSummary,
    ImportRun,
    ImportResult,
    ImportPaginationMeta,
    ImportSheet,
    DetectedColumn,
    VehicleCandidate,
} from '@/types/import';

const toast = useToast();

const props = defineProps<{ config: ImporterConfig }>();

const file = ref<File | null>(null);
const previewSource = ref<'file' | null>(null);
const dragOver = ref(false);
const previewRows = ref<ImportRow[]>([]);
const editedRows = ref<ImportRow[]>([]);
const previewSummary = ref<ImportSummary | null>(null);
const importSheets = ref<ImportSheet[]>([]);
const selectedSheetIndex = ref<number | null>(null);
const detectedColumns = ref<DetectedColumn[]>([]);
const {
    fieldMapping,
    mappingSource,
    hasMapping,
    hasExplicitMapping: hasExplicitCurrentMapping,
    resetMapping,
    replaceMapping,
    applySuggestedMappingIfPristine,
} = useImportMapping();
const requiredFields = ref<string[]>([]);
const importMode = ref('create_update');
const validationRunning = ref(false);
const fullValidationReportActive = ref(false);
const result = ref<ImportResult | null>(null);
const error = ref<string | null>(null);
const previewLoading = ref(false);
const metadataLoading = ref(false);
const uploadProgress = ref<number | null>(null);
const importRunning = ref(false);
const fullImportRunning = ref(false);
const activeImportRunId = ref<number | null>(null);
const validatedImportRunId = ref<number | null>(null);
const validationRowsServerMeta = ref<ImportPaginationMeta | null>(null);
const persistedRowsAvailable = ref(false);
const serverRowsLoading = ref(false);
const dirtyPersistedRowIds = ref<Set<number>>(new Set());
const savingPersistedRows = ref(false);
const activePreviewFilter = ref('all');
const previewSearch = ref('');
const expandedChangeRow = ref<number | null>(null);
const expandedProductGroups = ref<Set<string>>(new Set());
const diagnosticsExpanded = ref(false);
const revalidatingRows = ref(false);
const importRuns = ref<ImportRun[]>([]);
const importRunsLoading = ref(false);
const importHistoryExpanded = ref(false);
const lastProgressRefreshAt = ref<string | null>(null);
const completedImportDuration = ref<string | null>(null);
const creatingBrands = ref<Record<string, boolean>>({});
const creatingVehicleCandidates = ref(false);
type ImportSearchableOption = {
    id?: string | number;
    name?: string;
    label: string;
    value: string | number;
};
type WorkerAwareRun = Partial<ImportResult> & {
    status?: string;
    phase?: string | null;
};
type RowsRevalidationProgress = {
    status: string;
    processed_rows: number;
    total_rows: number;
    rows_revision: number;
    validated_rows_revision: number;
};

const searchableOptions = ref<Record<string, ImportSearchableOption[]>>({});
const fileInputRef = ref<HTMLInputElement | null>(null);
const importerRootRef = ref<HTMLElement | null>(null);
const normalTableScrollRef = ref<HTMLDivElement | null>(null);
const groupedTableScrollRef = ref<HTMLDivElement | null>(null);
const MAX_IMPORT_FILE_BYTES = 100 * 1024 * 1024;
const IMPORT_CHUNK_CONCURRENCY = 3;
const TERMINAL_IMPORT_STATUSES = ['completed', 'failed', 'cancelled'];
const bulkEditMode = ref(false);
const bulkValues = ref<Record<string, any>>({});
const importStartedAt = ref<Date | null>(null);
const pendingPollCount = ref(0);
const processNowAttempted = ref(false);
let importStatusTimer: ReturnType<typeof setInterval> | null = null;
let importStatusRefreshInFlight = false;
const {
    importProfiles,
    selectedProfileId,
    profileDialogOpen,
    profileName,
    profileSaving,
    loadImportProfiles,
    applySelectedProfile: applySelectedProfileMapping,
    openProfileDialog,
    saveCurrentProfile: saveProfileFromComposable,
} = useImportProfiles({
    entity: props.config.entity,
    fieldMapping,
    importMode,
    selectedSheetIndex,
});

const applySelectedProfile = (): void => {
    applySelectedProfileMapping();
    if (selectedProfileId.value !== null && hasExplicitCurrentMapping.value) {
        mappingSource.value = 'profile';
    }
};

const deleteDialogOpen = ref(false);
const runPendingDeletion = ref<ImportRun | null>(null);
const deletingRun = ref(false);
const safetyConfirmOpen = ref(false);
const pendingSafetyAction = ref<
    | 'create_references'
    | 'create_vehicles'
    | 'retry_history'
    | 'retry_active'
    | null
>(null);
const pendingSafetyRun = ref<ImportRun | null>(null);
const importConfirmOpen = ref(false);
const importConfirmMode = ref<'preview' | 'file'>('preview');
const leaveConfirmOpen = ref(false);
const pendingNavigationUrl = ref<string | null>(null);
const navigationApproved = ref(false);
const creatingAllReferences = ref(false);
const previewFullscreen = ref(false);
const previewPerPageOptions = [25, 50, 100, 200];
const {
    selectedRows,
    undoStack,
    redoStack,
    commitCellEdit,
    undoCellEdit,
    redoCellEdit,
    clearEditingState,
} = useImportTableEditing<ImportRow>({
    rows: editedRows,
    rowIndex: (row) => row.__preview_index,
    afterEdit: (edit) => {
        markPersistedRowDirty(edit.rowIndex);
        recomputeAllLocalValidation();
    },
});
let removeInertiaBeforeListener: (() => void) | null = null;
const UNSAVED_IMPORT_CHANGES_MESSAGE =
    'Tienes cambios sin guardar en filas del importador.';
const mappingPreviewStale = ref(false);
const mappingReplacementRunId = ref<number | null>(null);
const operationalMappingApplying = ref(false);
let latestPreviewRequestId = 0;
let latestMetadataRequestId = 0;
let latestServerRowsRequestId = 0;
let syncingServerPreviewPage = false;
const autoRevalidatedImportRunIds = new Set<number>();

type RowsRevalidationOptions = {
    automatic?: boolean;
};

type ReferenceRevalidationPayload = {
    brands?: string[];
    categories?: string[];
};

watch(leaveConfirmOpen, (open) => {
    if (!open) {
        pendingNavigationUrl.value = null;
    }
});

type ImportPreviewMetadata = {
    sheets: ImportSheet[];
    selectedSheet: { index: number; name?: string } | null;
    detectedColumns: DetectedColumn[];
    requiredFields: string[];
    suggestedMapping: Record<string, string>;
};

const isRecord = (value: unknown): value is Record<string, any> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

const firstArray = <T,>(...values: unknown[]): T[] => {
    const value = values.find((candidate) => Array.isArray(candidate));

    return Array.isArray(value) ? (value as T[]) : [];
};

const firstRecord = <T extends Record<string, any>>(
    ...values: unknown[]
): T => {
    const value = values.find(
        (candidate) => isRecord(candidate) && Object.keys(candidate).length > 0,
    );

    return (isRecord(value) ? value : {}) as T;
};

const payloadData = (payload: any): Record<string, any> =>
    isRecord(payload?.data) ? payload.data : isRecord(payload) ? payload : {};

const payloadSummary = (payload: any): Record<string, any> => {
    const data = payloadData(payload);

    return firstRecord(data.summary, payload?.summary);
};

const mappingColumnsFromMapping = (
    mapping: Record<string, string>,
): DetectedColumn[] =>
    Object.keys(mapping).map((key) => ({
        key,
        label: key,
    }));

const mappingColumnsFromRows = (rows: any[] = []): DetectedColumn[] => {
    const ignoredKeys = new Set([
        'id',
        'row',
        'status',
        'is_valid',
        'action_type',
        'label',
        'errors',
        'warnings',
        'conflicts',
        'change_preview',
        'error',
        'updated_at',
        'is_edited',
    ]);
    const keys = new Set<string>();

    rows.slice(0, 20).forEach((row) => {
        const source = isRecord(row?.data) ? row.data : row;
        if (!isRecord(source)) return;

        Object.keys(source).forEach((key) => {
            if (!key.startsWith('__') && !ignoredKeys.has(key)) {
                keys.add(key);
            }
        });
    });

    return Array.from(keys).map((key) => ({
        key,
        label: key,
    }));
};

const previewMetadataFromPayload = (
    payload: any,
    fallbackRows: any[] = [],
): ImportPreviewMetadata => {
    const data = payloadData(payload);
    const summary = payloadSummary(payload);
    const suggestedMapping = firstRecord<Record<string, string>>(
        data.suggested_mapping,
        summary.suggested_mapping,
        data.mapping,
        summary.mapping,
        payload?.suggested_mapping,
        payload?.mapping,
    );
    const detectedColumns = firstArray<DetectedColumn>(
        data.detected_columns,
        summary.detected_columns,
        payload?.detected_columns,
    );
    const mappingColumns = mappingColumnsFromMapping(suggestedMapping);
    const syntheticDetectedColumns =
        props.config.fullFileImport === true
            ? []
            : mappingColumns.length > 0
              ? mappingColumns
              : mappingColumnsFromRows(fallbackRows);
    const fallbackDetectedColumns =
        detectedColumns.length > 0 ? detectedColumns : syntheticDetectedColumns;

    return {
        sheets: firstArray<ImportSheet>(
            data.sheets,
            summary.sheets,
            payload?.sheets,
        ),
        selectedSheet:
            data.selected_sheet ??
            summary.selected_sheet ??
            payload?.selected_sheet ??
            null,
        detectedColumns: fallbackDetectedColumns,
        requiredFields: firstArray<string>(
            data.required_fields,
            summary.required_fields,
            payload?.required_fields,
        ),
        suggestedMapping,
    };
};

const getImportErrorMessage = (error: any, fallback: string): string =>
    error?.response?.data?.message || error?.message || fallback;

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
    () =>
        validationRowsServerMeta.value?.valid_count ??
        validationRowsServerMeta.value?.counts?.row_status_counts?.valid ??
        editedRows.value.filter((r) => r.__valid).length,
);
const errorCount = computed(
    () =>
        validationRowsServerMeta.value?.error_count ??
        validationRowsServerMeta.value?.counts?.row_status_counts?.error ??
        (validatedPreviewReadOnly.value &&
        result.value?.error_count !== undefined
            ? Number(result.value.error_count ?? 0)
            : editedRows.value.filter((r) => !r.__valid).length),
);
const warningCount = computed(
    () =>
        validationRowsServerMeta.value?.warning_count ??
        validationRowsServerMeta.value?.counts?.warning_count ??
        editedRows.value.filter((r) => (r.__warnings ?? []).length > 0).length,
);
const localDuplicateCount = computed(
    () =>
        editedRows.value.filter(
            (r) => (r.__duplicate_conflicts ?? []).length > 0,
        ).length,
);
const actionCounts = computed<Record<string, number>>(
    () =>
        validationRowsServerMeta.value?.action_counts ??
        validationRowsServerMeta.value?.counts?.action_counts ??
        previewSummary.value?.action_counts ??
        {},
);
const conflictCount = computed(
    () =>
        Number(validationRowsServerMeta.value?.conflict_count ?? 0) ||
        Number(validationRowsServerMeta.value?.counts?.conflict_count ?? 0) ||
        Number(previewSummary.value?.conflict_count ?? 0) ||
        editedRows.value.filter(
            (r) =>
                r.__action_type === 'conflict' ||
                (r.__duplicate_conflicts ?? []).length > 0,
        ).length,
);
const previewFilterOptions = computed(() => [
    {
        key: 'all',
        label: 'Todas',
        count: validationRowsServerMeta.value?.total ?? editedRows.value.length,
    },
    { key: 'errors', label: 'Errores', count: errorCount.value },
    {
        key: 'conflict',
        label: 'Conflictos',
        count: actionCounts.value.conflict ?? 0,
    },
    { key: 'create', label: 'Crea', count: actionCounts.value.create ?? 0 },
    {
        key: 'update',
        label: 'Actualiza',
        count: actionCounts.value.update ?? 0,
    },
    {
        key: 'unchanged',
        label: 'Sin cambios',
        count: actionCounts.value.unchanged ?? 0,
    },
    {
        key: 'duplicates',
        label: 'Duplicados',
        count: localDuplicateCount.value,
    },
    { key: 'warnings', label: 'Advertencias', count: warningCount.value },
]);
const filteredEditedRows = computed(() => {
    return editedRows.value.filter(
        (row) => rowMatchesPreviewFilter(row) && rowMatchesSearch(row),
    );
});
const activeFilterLabel = computed(
    () =>
        previewFilterOptions.value.find(
            (filter) => filter.key === activePreviewFilter.value,
        )?.label ?? 'filtro',
);
const visibleReferenceCount = computed(
    () =>
        (previewSummary.value?.missing_categories?.length ?? 0) +
        missingBrandReferences.value.length,
);
const referenceActionsDisabled = computed(
    () => persistedRowsRevalidationActive.value || serverRowsLoading.value,
);
const importConfirmationSummary = computed(() => {
    if (importConfirmMode.value === 'file') {
        const excludedCount = Math.max(
            0,
            Number(
                validationRowsServerMeta.value?.total ??
                    editedRows.value.length,
            ) - validCount.value,
        );

        return {
            title: 'Importar filas validas',
            description: `Se importaran ${validCount.value} filas validas. ${excludedCount} fila${excludedCount === 1 ? '' : 's'} con error o conflicto quedaran excluidas para corregirlas despues.`,
            primaryLabel: 'Importar filas validas',
        };
    }

    return {
        title: 'Importar preview validado',
        description: `Se importaran ${validCount.value} de ${editedRows.value.length} filas visibles en el preview. Las filas con error o conflicto no se enviaran.`,
        primaryLabel: 'Importar',
    };
});
const safetyConfirmationSummary = computed(() => {
    if (pendingSafetyAction.value === 'create_references') {
        return {
            title: 'Crear referencias faltantes',
            description:
                'Esto crea datos maestros de categorias o marcas desde el archivo. No importa productos todavia.',
            primaryLabel: 'Crear referencias',
            countLabel: `${visibleReferenceCount.value} referencia${visibleReferenceCount.value === 1 ? '' : 's'}`,
            examples: missingReferencePreview.value,
            tone: 'red',
        };
    }

    if (pendingSafetyAction.value === 'create_vehicles') {
        return {
            title: 'Crear vehiculos detectados',
            description:
                'Esto crea referencias de vehiculos desde el archivo y completa el catalogo opcional. No importa productos todavia.',
            primaryLabel: 'Crear vehiculos',
            countLabel: `${missingVehicleCandidates.value.length} vehiculo${missingVehicleCandidates.value.length === 1 ? '' : 's'}`,
            examples: vehicleCandidatePreview.value,
            tone: 'amber',
        };
    }

    if (pendingSafetyAction.value === 'retry_history') {
        const run = pendingSafetyRun.value;

        return {
            title: `Reintentar fallidas${run ? ` de #${run.id}` : ''}`,
            description:
                'Esto crea una nueva corrida usando solo las filas fallidas. No modifica las filas exitosas anteriores.',
            primaryLabel: 'Reintentar fallidas',
            countLabel: `${Number(run?.error_count ?? 0)} fila${Number(run?.error_count ?? 0) === 1 ? '' : 's'} con error`,
            examples: run?.original_filename ? [run.original_filename] : [],
            tone: 'blue',
        };
    }

    return {
        title: 'Reintentar fallidas',
        description:
            'Esto crea una nueva corrida con las filas fallidas de la importacion actual. No modifica las filas exitosas anteriores.',
        primaryLabel: 'Reintentar fallidas',
        countLabel: `${Number(result.value?.error_count ?? 0)} fila${Number(result.value?.error_count ?? 0) === 1 ? '' : 's'} con error`,
        examples: activeImportContext.value?.filename
            ? [activeImportContext.value.filename]
            : [],
        tone: 'blue',
    };
});
const groupedPreviewEnabled = computed(
    () => props.config.groupedProductPreview === true,
);
const hasDetectedPreviewGroups = computed(
    () =>
        (previewSummary.value?.groups?.length ?? 0) > 0 ||
        editedRows.value.some(
            (row) => row.__product_group_key || row.__variant_preview,
        ),
);
const productBaseColumns = computed(() =>
    editableColumns.value.filter((column) =>
        ['nombre', 'categoria', 'descripcion'].includes(column.key),
    ),
);
const variantColumns = computed(() =>
    editableColumns.value.filter(
        (column) =>
            !['nombre', 'categoria', 'descripcion'].includes(column.key),
    ),
);
const groupedPreviewGroups = computed(() => {
    const groups = new Map<string, any>();

    editedRows.value.forEach((row) => {
        if (!rowMatchesPreviewFilter(row) || !rowMatchesSearch(row)) {
            return;
        }

        const key = String(
            row.__product_group_key || `row-${row.__preview_index}`,
        );
        const metadata =
            previewSummary.value?.groups?.find(
                (group: any) => group.product_key === row.__product_group_key,
            ) ?? {};

        if (!groups.has(key)) {
            groups.set(key, {
                key,
                metadata,
                rows: [],
                primaryRow: row,
            });
        }

        groups.get(key).rows.push(row);
    });

    return Array.from(groups.values()).map((group) => ({
        ...group,
        validRows: group.rows.filter((row: any) => row.__valid).length,
        errorRows: group.rows.filter((row: any) => !row.__valid).length,
        conflictRows: group.rows.filter(
            (row: any) => row.__action_type === 'conflict',
        ).length,
        warningRows: group.rows.filter(
            (row: any) => (row.__warnings ?? []).length > 0,
        ).length,
    }));
});
const effectiveGroupedPreviewEnabled = computed(
    () => groupedPreviewEnabled.value && hasDetectedPreviewGroups.value,
);
const serverRowsMode = computed(
    () =>
        persistedRowsAvailable.value &&
        (validationRowsServerMeta.value?.total ?? 0) > 200,
);
const previewTotalItems = computed(() =>
    serverRowsMode.value
        ? (validationRowsServerMeta.value?.total ?? editedRows.value.length)
        : effectiveGroupedPreviewEnabled.value
          ? groupedPreviewGroups.value.length
          : filteredEditedRows.value.length,
);
const previewItemLabel = computed(() =>
    effectiveGroupedPreviewEnabled.value && !serverRowsMode.value
        ? 'grupos'
        : 'filas',
);
const {
    previewPage,
    previewPerPage,
    previewLastPage,
    previewPageStart,
    previewPageEnd,
    setPreviewPage,
} = useImportPreviewPagination({
    totalItems: previewTotalItems,
    itemLabel: previewItemLabel,
    search: previewSearch,
    activeFilter: activePreviewFilter,
    perPageOptions: previewPerPageOptions,
});
const paginatedEditedRows = computed(() => {
    if (serverRowsMode.value) {
        return editedRows.value;
    }

    const start = (previewPage.value - 1) * previewPerPage.value;

    return filteredEditedRows.value.slice(start, start + previewPerPage.value);
});
const paginatedGroupedPreviewGroups = computed(() => {
    if (serverRowsMode.value) {
        return groupedPreviewGroups.value;
    }

    const start = (previewPage.value - 1) * previewPerPage.value;

    return groupedPreviewGroups.value.slice(
        start,
        start + previewPerPage.value,
    );
});
const hasFile = computed(() => !!file.value);
const hasPreview = computed(() => editedRows.value.length > 0);
const serverScopeActions = computed(
    () => validationRowsServerMeta.value?.server_scope_actions,
);
const hasUnsavedPersistedRowChanges = computed(
    () => dirtyPersistedRowIds.value.size > 0,
);
const persistedRowsDirty = computed(
    () => validationRowsServerMeta.value?.rows_dirty === true,
);
const persistedRowsRequireRevalidation = computed(
    () =>
        persistedRowsDirty.value ||
        hasUnsavedPersistedRowChanges.value ||
        ['required', 'pending', 'running', 'failed'].includes(
            validationRowsServerMeta.value?.full_revalidation_status ?? '',
        ),
);
const persistedRowsRevalidationActive = computed(() =>
    ['pending', 'running'].includes(
        validationRowsServerMeta.value?.full_revalidation_status ?? '',
    ),
);
const rowsRevalidationProgress = computed<RowsRevalidationProgress | null>(
    () => {
        const metaProgress =
            validationRowsServerMeta.value?.revalidation_progress;
        const summaryProgress = (
            result.value?.summary as
                | { revalidation_progress?: RowsRevalidationProgress }
                | undefined
        )?.revalidation_progress;
        const progress = metaProgress ?? summaryProgress;

        if (progress) {
            return {
                status:
                    progress.status ??
                    validationRowsServerMeta.value?.full_revalidation_status ??
                    result.value?.summary?.full_revalidation_status ??
                    'pending',
                processed_rows: Number(progress.processed_rows ?? 0),
                total_rows: Number(progress.total_rows ?? 0),
                rows_revision: Number(progress.rows_revision ?? 0),
                validated_rows_revision: Number(
                    progress.validated_rows_revision ?? 0,
                ),
            };
        }

        if (!persistedRowsRevalidationActive.value) {
            return null;
        }

        return {
            status:
                validationRowsServerMeta.value?.full_revalidation_status ??
                'pending',
            processed_rows: Number(result.value?.processed_rows ?? 0),
            total_rows: Number(
                result.value?.total_rows ??
                    validationRowsServerMeta.value?.total ??
                    0,
            ),
            rows_revision: Number(
                validationRowsServerMeta.value?.rows_revision ?? 0,
            ),
            validated_rows_revision: Number(
                validationRowsServerMeta.value?.validated_rows_revision ?? 0,
            ),
        };
    },
);
const rowsRevalidationProgressPercent = computed(() => {
    const progress = rowsRevalidationProgress.value;
    if (!progress) {
        return 0;
    }

    const total = Number(progress.total_rows ?? 0);
    if (total <= 0) {
        return persistedRowsRevalidationActive.value ? 5 : 100;
    }

    return Math.min(
        100,
        Math.max(
            0,
            Math.round((Number(progress.processed_rows ?? 0) / total) * 100),
        ),
    );
});
const rowsRevalidationProgressLabel = computed(() => {
    const progress = rowsRevalidationProgress.value;
    if (!progress) {
        return null;
    }

    const total = Number(progress.total_rows ?? 0);
    if (total <= 0) {
        return 'Preparando revalidacion completa...';
    }

    return `${rowsRevalidationProgressPercent.value}% - ${Number(progress.processed_rows ?? 0)} / ${total} filas`;
});
const canSavePersistedRowChanges = computed(
    () =>
        hasUnsavedPersistedRowChanges.value &&
        activeImportRunId.value !== null &&
        validationRowsServerMeta.value !== null &&
        !savingPersistedRows.value &&
        !persistedRowsRevalidationActive.value,
);
const previewViewControlsDisabled = computed(
    () => serverRowsLoading.value || savingPersistedRows.value,
);
const previewViewControlsDisabledReason = computed(() => {
    if (serverRowsLoading.value) {
        return 'Cargando filas del servidor. Espera un momento antes de cambiar filtros o pagina.';
    }

    if (savingPersistedRows.value) {
        return 'Guardando correcciones. Espera a que termine antes de navegar la tabla.';
    }

    if (hasUnsavedPersistedRowChanges.value) {
        return 'Tienes correcciones sin guardar. Guarda o descarta esos cambios antes de cambiar de pagina.';
    }

    if (persistedRowsRevalidationActive.value) {
        return 'La revalidacion esta corriendo, pero puedes seguir filtrando y revisando las filas disponibles.';
    }

    return null;
});
const validatedPreviewReadOnly = computed(
    () =>
        props.config.fullFileImport &&
        validatedImportRunId.value !== null &&
        !persistedRowsAvailable.value,
);
const validationInProgress = computed(
    () => validationRunning.value && isActiveRunStatus(result.value?.status),
);
const uploadProgressLabel = computed(() =>
    uploadProgress.value === null
        ? null
        : `${Math.max(0, Math.min(100, uploadProgress.value))}% subido`,
);
const previewShellClass = computed(() =>
    previewFullscreen.value
        ? 'fixed inset-0 z-50 flex flex-col overflow-hidden bg-white dark:bg-background'
        : 'flex h-[calc(100vh-2rem)] min-h-[820px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card',
);
const hasMultipleSheets = computed(() => importSheets.value.length > 1);
const advancedImportControlsVisible = computed(
    () =>
        hasFile.value ||
        hasPreview.value ||
        previewLoading.value ||
        fullImportRunning.value ||
        validationRunning.value ||
        activeImportRunId.value !== null,
);

const resetPreviewTableScroll = async (): Promise<void> => {
    await nextTick();

    normalTableScrollRef.value?.scrollTo({ top: 0 });
    groupedTableScrollRef.value?.scrollTo({ top: 0 });
};

const requestPreviewViewChange = (change: () => void): void => {
    if (hasUnsavedPersistedRowChanges.value) {
        toast.warning(
            'Guarda o descarta los cambios antes de cambiar de pagina.',
        );
        return;
    }

    if (previewViewControlsDisabled.value) {
        return;
    }

    change();
};

const requestPreviewPage = (page: number): void => {
    requestPreviewViewChange(() => {
        setPreviewPage(page);
    });
};

const requestPreviewFilter = (key: string): void => {
    requestPreviewViewChange(() => {
        activePreviewFilter.value = key;
    });
};

const requestPreviewSearch = (value: string): void => {
    requestPreviewViewChange(() => {
        previewSearch.value = value;
    });
};

const requestPreviewSearchFromEvent = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    const previousValue = previewSearch.value;
    requestPreviewSearch(input.value);

    if (hasUnsavedPersistedRowChanges.value) {
        input.value = previousValue;
    }
};

const requestPreviewPerPage = (value: number): void => {
    requestPreviewViewChange(() => {
        previewPerPage.value = value;
    });
};

const requestPreviewPerPageFromEvent = (event: Event): void => {
    const select = event.target as HTMLSelectElement;
    const previousValue = previewPerPage.value;
    requestPreviewPerPage(Number(select.value));

    if (hasUnsavedPersistedRowChanges.value) {
        select.value = String(previousValue);
    }
};

watch([previewPage, previewPerPage, activePreviewFilter, previewSearch], () => {
    if (syncingServerPreviewPage) {
        syncingServerPreviewPage = false;
        return;
    }

    void resetPreviewTableScroll();
    if (serverRowsMode.value && activeImportRunId.value) {
        void loadValidatedRunRows(activeImportRunId.value);
    }
});

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
        validatedImportRunId.value !== null &&
        hasPreview.value &&
        previewSource.value === 'file' &&
        validCount.value > 0 &&
        !mappingPreviewStale.value &&
        !previewLoading.value &&
        !fullImportRunning.value &&
        !validationInProgress.value &&
        !operationalMappingApplying.value &&
        !persistedRowsRequireRevalidation.value,
);
const fullFileImportBlockedReason = computed(() => {
    if (!props.config.fullFileImport) return null;
    if (mappingPreviewStale.value) {
        return 'Actualiza el preview con el mapping actual antes de importar.';
    }
    if (validatedImportRunId.value === null && !hasFile.value) {
        return 'Selecciona un archivo para iniciar el flujo.';
    }
    if (previewLoading.value) {
        return 'Espera a que termine la validacion antes de importar.';
    }
    if (operationalMappingApplying.value) {
        return 'Aplicando mapping operativo y revalidando filas antes de importar.';
    }
    if (validatedImportRunId.value === null) {
        return 'Primero valida el archivo completo antes de importar.';
    }
    if (!hasPreview.value || previewSource.value !== 'file') {
        return 'Primero genera y revisa el preview validado del archivo.';
    }
    if (validCount.value <= 0) {
        return 'El preview no tiene filas validas para importar.';
    }
    if (hasUnsavedPersistedRowChanges.value) {
        return 'Guarda o descarta los cambios antes de importar.';
    }
    if (persistedRowsDirty.value) {
        return 'Ejecuta la revalidacion completa antes de importar.';
    }
    if (
        ['required', 'pending', 'running', 'failed'].includes(
            validationRowsServerMeta.value?.full_revalidation_status ?? '',
        )
    ) {
        return 'La revalidacion completa de filas esta pendiente.';
    }
    if (validationInProgress.value) {
        return 'Espera a que termine la validacion antes de importar.';
    }

    return null;
});
const missingBrandReferences = computed<string[]>(() => {
    const previewBrands =
        previewSummary.value?.missing_references?.brands ??
        previewSummary.value?.missingReferences?.brands;
    const resultBrands =
        result.value?.summary?.missing_references?.brands ??
        result.value?.summary?.missingReferences?.brands;

    return [...new Set([...(previewBrands ?? []), ...(resultBrands ?? [])])];
});
const missingCategoryReferences = computed<string[]>(
    () => previewSummary.value?.missing_categories ?? [],
);
const missingVehicleCandidates = computed<VehicleCandidate[]>(
    () => previewSummary.value?.missing_vehicle_candidates ?? [],
);
const missingReferencePreview = computed(() =>
    [
        ...missingCategoryReferences.value.map((name) => `Categoria: ${name}`),
        ...missingBrandReferences.value.map((name) => `Marca: ${name}`),
    ].slice(0, 3),
);
const vehicleCandidatePreview = computed(() =>
    missingVehicleCandidates.value
        .slice(0, 3)
        .map(
            (candidate) =>
                candidate.label ||
                [
                    candidate.make,
                    candidate.model,
                    candidate.chassis,
                    candidate.engine,
                ]
                    .filter(Boolean)
                    .join(' '),
        )
        .filter((label): label is string => Boolean(label)),
);
const criticalPreviewIssueItems = computed(() =>
    [
        {
            key: 'errors',
            label: 'Errores',
            count: errorCount.value,
            tone: 'red',
        },
        {
            key: 'conflict',
            label: 'Conflictos',
            count: conflictCount.value,
            tone: 'amber',
        },
        {
            key: 'duplicates',
            label: 'Duplicados',
            count: localDuplicateCount.value,
            tone: 'amber',
        },
        {
            key: 'references',
            label: 'Referencias',
            count: visibleReferenceCount.value,
            tone: 'red',
        },
    ].filter((item) => item.count > 0),
);
const hasCriticalPreviewIssues = computed(
    () => criticalPreviewIssueItems.value.length > 0,
);
const criticalPreviewExamples = computed(() => {
    const examples: string[] = [];

    const errorRow = editedRows.value.find((row) => row.__errors?.length);
    if (errorRow) {
        examples.push(`Fila ${errorRow.__row}: ${errorRow.__errors[0]}`);
    }

    const conflictRow = editedRows.value.find((row) => row.__conflicts?.length);
    if (conflictRow) {
        examples.push(
            `Fila ${conflictRow.__row}: ${conflictRow.__conflicts[0].message}`,
        );
    }

    missingReferencePreview.value.forEach((reference) => {
        if (examples.length < 3) {
            examples.push(reference);
        }
    });

    return examples.slice(0, 3);
});
const actionableSummary = computed(() => [
    {
        label: 'Listas',
        value: validCount.value,
        tone: 'emerald',
    },
    {
        label: 'Errores',
        value: errorCount.value,
        tone: errorCount.value > 0 ? 'red' : 'gray',
    },
    {
        label: 'Conflictos',
        value: conflictCount.value,
        tone: conflictCount.value > 0 ? 'amber' : 'gray',
    },
    {
        label: 'Referencias',
        value: visibleReferenceCount.value,
        tone: visibleReferenceCount.value > 0 ? 'red' : 'gray',
    },
]);
const actionableRecommendation = computed(() => {
    if (serverRowsLoading.value) {
        return 'Espera a que carguen las filas para revisar el reporte completo.';
    }

    if (hasUnsavedPersistedRowChanges.value) {
        return 'Guarda o descarta las correcciones antes de cambiar de pagina o importar.';
    }

    if (persistedRowsRevalidationActive.value) {
        return rowsRevalidationProgressLabel.value
            ? `Revalidacion completa en curso: ${rowsRevalidationProgressLabel.value}. Puedes filtrar errores y preparar correcciones mientras termina.`
            : 'La revalidacion esta corriendo. Puedes filtrar errores y preparar correcciones mientras termina.';
    }

    if (visibleReferenceCount.value > 0) {
        return validCount.value > 0
            ? 'Puedes importar las filas listas. Las filas con referencias faltantes quedaran excluidas para corregirlas despues.'
            : 'Crea o corrige las referencias faltantes para habilitar filas validas.';
    }

    if (errorCount.value > 0 || conflictCount.value > 0) {
        return validCount.value > 0
            ? 'Puedes importar las filas listas. Las filas con error o conflicto quedaran excluidas para corregirlas despues.'
            : 'Filtra errores o conflictos, corrige las filas y revalida antes de importar.';
    }

    if (canRunFullFile.value) {
        return 'El archivo esta listo para importar. Revisa el resumen y confirma la importacion completa.';
    }

    if (validCount.value > 0) {
        return 'Hay filas validas disponibles. Revisa el resumen antes de importar.';
    }

    return 'Genera un preview para ver que se creara o actualizara antes de importar.';
});
const previewModeMessage = computed(() => {
    if (fullValidationReportActive.value) {
        return 'Vista de validacion completa. Si necesitas corregir, abre las filas persistidas o revalida despues de ajustar referencias.';
    }

    if (persistedRowsAvailable.value) {
        return 'Puedes corregir filas, guardar cambios y revalidar antes de importar. Guardar cambios no importa productos.';
    }

    if (previewSummary.value?.preview_limited) {
        return 'Muestra limitada del archivo. Vuelve a previsualizar para refrescar el reporte antes de importar.';
    }

    return 'Puedes revisar y ajustar el preview. Ningun producto se importa hasta confirmar la importacion.';
});
const hasPreviewDiagnostics = computed(
    () =>
        Boolean(previewSummary.value) &&
        (errorCount.value > 0 ||
            conflictCount.value > 0 ||
            warningCount.value > 0 ||
            missingBrandReferences.value.length > 0 ||
            (previewSummary.value?.missing_categories?.length ?? 0) > 0 ||
            missingVehicleCandidates.value.length > 0 ||
            (previewSummary.value?.suggestions?.categories?.length ?? 0) > 0 ||
            (previewSummary.value?.suggestions?.brands?.length ?? 0) > 0),
);
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
const productMappingFields = computed(() =>
    props.config.columns
        .filter((column) => !column.actionType)
        .map((column) => ({
            key: column.key,
            label: column.label,
            required:
                column.required === true ||
                requiredFields.value.includes(column.key),
        })),
);
const usableImportProfiles = computed(() =>
    importProfiles.value.filter((profile) => profile.name.trim().length >= 3),
);
const profileNameIsValid = computed(() => profileName.value.trim().length >= 3);
const importerShellClass = computed(() =>
    props.config.fullFileImport
        ? 'mx-auto w-full max-w-[96rem] space-y-6'
        : 'mx-auto w-full max-w-7xl space-y-6',
);
const activeHistoryRun = computed(() =>
    importRuns.value.find((run) => run.id === activeImportRunId.value),
);
const activeImportContext = computed(() => {
    if (!activeImportRunId.value || !result.value) {
        return null;
    }

    const run = result.value ?? activeHistoryRun.value;

    return {
        id: activeImportRunId.value,
        filename:
            (run as any).original_filename ||
            (result.value as any).original_filename ||
            `Importacion #${activeImportRunId.value}`,
        type: runTypeLabel(run),
        status: statusLabel(run.status ?? result.value.status ?? '', run),
    };
});
const reusableAsyncPreviewRunId = computed(() => {
    if (!activeImportRunId.value) return null;

    const run = activeHistoryRun.value ?? result.value;
    const isValidationRun = run?.run_type === 'validation';
    const isAsyncPreview =
        run?.preview_async === true ||
        run?.async === true ||
        run?.summary?.preview_async === true;

    return isValidationRun && isAsyncPreview ? activeImportRunId.value : null;
});
const activeImportRunsCount = computed(
    () =>
        importRuns.value.filter((run) => isActiveRunStatus(run.status)).length,
);
const draftStorageKey = computed(
    () => `hermex-import-draft:${props.config.entity}`,
);
const mappedDetectedColumns = computed(() =>
    detectedColumns.value.map((column) => {
        const mappedKey = fieldMapping.value[column.key] ?? 'ignore';
        const mappedField = availableMappingFields.value.find(
            (field) => field.key === mappedKey,
        );

        return {
            ...column,
            mappedKey,
            mappedLabel: mappedField?.label ?? mappedKey,
            ignored: mappedKey === 'ignore' || !mappedKey,
        };
    }),
);
const mappedRequiredFields = computed(
    () =>
        new Set(
            mappedDetectedColumns.value
                .filter((column) => !column.ignored)
                .map((column) => column.mappedKey),
        ),
);
const mappedSourceColumns = computed(
    () =>
        new Set(
            Object.entries(fieldMapping.value)
                .filter(([, target]) => target !== '' && target !== 'ignore')
                .map(([source]) => source),
        ),
);
const mappedTargetFields = computed(
    () =>
        new Set(
            Object.values(fieldMapping.value).filter(
                (target) => target !== '' && target !== 'ignore',
            ),
        ),
);
const missingRequiredMapping = computed(() =>
    requiredFields.value.filter(
        (field) =>
            !mappedRequiredFields.value.has(field) &&
            !mappedTargetFields.value.has(field),
    ),
);
const mappingSummary = computed(() => ({
    mapped: mappedTargetFields.value.size,
    ignored: Math.max(
        detectedColumns.value.length - mappedSourceColumns.value.size,
        0,
    ),
    requiredMissing: missingRequiredMapping.value.length,
}));
const hasMappingPanelContent = computed(
    () =>
        detectedColumns.value.length > 0 ||
        hasMapping.value ||
        requiredFields.value.length > 0 ||
        importSheets.value.length > 0 ||
        selectedSheetIndex.value !== null ||
        editedRows.value.length > 0 ||
        previewRows.value.length > 0 ||
        activeImportRunId.value !== null,
);
const shouldShowMappingTransparency = computed(
    () =>
        props.config.fullFileImport &&
        advancedImportControlsVisible.value &&
        (metadataLoading.value ||
            previewLoading.value ||
            hasMappingPanelContent.value),
);
const mappingContextLabel = computed(() => {
    if (mappingSource.value === 'history') {
        return 'Mapping usado en esta importacion';
    }

    if (mappingSource.value === 'profile') {
        return 'Mapping aplicado desde perfil';
    }

    if (mappingSource.value === 'manual') {
        return 'Mapping editado manualmente';
    }

    return 'Automapeo detectado';
});

const currentStep = computed(() => {
    if (result.value) return 4;
    if (hasPreview.value) return 3;
    if (hasFile.value && props.config.fullFileImport) return 2;
    return 1;
});

const stepperSteps = computed(() => [
    {
        number: 1,
        label: 'Archivo',
        icon: FileText,
        completed: hasFile.value,
    },
    {
        number: 2,
        label: 'Mapeo',
        icon: Settings,
        completed: hasPreview.value,
        visible: props.config.fullFileImport,
    },
    {
        number: 3,
        label: 'Preview',
        icon: Eye,
        completed: !!result.value,
    },
    {
        number: 4,
        label: 'Resultado',
        icon: ListChecks,
        completed: false,
    },
]);

const importDuration = computed(() => {
    if (!importStartedAt.value) return null;
    const now = new Date();
    const diff = Math.floor(
        (now.getTime() - importStartedAt.value.getTime()) / 1000,
    );
    if (diff < 60) return `${diff}s`;
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    return `${minutes}m ${seconds}s`;
});

const elapsedImportDuration = (): string | null => {
    if (!importStartedAt.value) return null;

    const diff = Math.max(
        0,
        Math.floor((Date.now() - importStartedAt.value.getTime()) / 1000),
    );
    if (diff < 60) return `${diff}s`;

    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;

    return `${minutes}m ${seconds}s`;
};

const allRowsSelected = computed(
    () =>
        paginatedEditedRows.value.length > 0 &&
        paginatedEditedRows.value.every((row) =>
            selectedRows.value.has(row.__preview_index),
        ),
);
const selectedRowsCount = computed(() => selectedRows.value.size);
const selectedCurrentPageCount = computed(
    () =>
        paginatedEditedRows.value.filter((row) =>
            selectedRows.value.has(row.__preview_index),
        ).length,
);
const rowsWithValidationIssues = computed(() =>
    editedRows.value.filter(
        (row) =>
            !row.__valid ||
            (row.__local_errors ?? []).length > 0 ||
            (row.__duplicate_conflicts ?? []).length > 0,
    ),
);
const hasActiveRowFilter = computed(
    () =>
        activePreviewFilter.value !== 'all' ||
        previewSearch.value.trim() !== '',
);
const canRevalidateFilteredRows = computed(
    () =>
        !serverRowsMode.value &&
        !effectiveGroupedPreviewEnabled.value &&
        hasActiveRowFilter.value &&
        filteredEditedRows.value.length > 0 &&
        !revalidatingRows.value,
);
const canRevalidateSelectedRows = computed(
    () => selectedRows.value.size > 0 && !revalidatingRows.value,
);

const setCriticalPreviewFilter = (key: string) => {
    if (key === 'references') {
        diagnosticsExpanded.value = true;
        return;
    }

    activePreviewFilter.value = key;
};

const mappingTargetLabel = (field: string): string =>
    availableMappingFields.value.find((item) => item.key === field)?.label ??
    field;

const sourceColumnForTarget = (targetKey: string): string =>
    Object.entries(fieldMapping.value).find(
        ([, mappedTarget]) => mappedTarget === targetKey,
    )?.[0] ?? '';

const OPERATIONAL_MAPPING_TARGETS = new Set([
    'costo',
    'precio',
    'cantidad',
    'descripcion',
]);

const normalizedMappingTarget = (target: unknown): string =>
    String(target ?? '').trim();

const mappingHasChanges = (
    currentMapping: Record<string, string>,
    nextMapping: Record<string, string>,
): boolean => {
    const sources = new Set([
        ...Object.keys(currentMapping),
        ...Object.keys(nextMapping),
    ]);

    return Array.from(sources).some(
        (source) =>
            normalizedMappingTarget(currentMapping[source] ?? 'ignore') !==
            normalizedMappingTarget(nextMapping[source] ?? 'ignore'),
    );
};

const isOperationalMappingTarget = (target: string): boolean =>
    OPERATIONAL_MAPPING_TARGETS.has(target);

const isOperationalOnlyMappingChange = (
    currentMapping: Record<string, string>,
    nextMapping: Record<string, string>,
): boolean => {
    const sources = new Set([
        ...Object.keys(currentMapping),
        ...Object.keys(nextMapping),
    ]);

    for (const source of sources) {
        const currentTarget = normalizedMappingTarget(
            currentMapping[source] ?? 'ignore',
        );
        const nextTarget = normalizedMappingTarget(
            nextMapping[source] ?? 'ignore',
        );

        if (currentTarget === nextTarget) {
            continue;
        }

        if (
            currentTarget !== '' &&
            currentTarget !== 'ignore' &&
            !isOperationalMappingTarget(currentTarget)
        ) {
            return false;
        }

        if (
            nextTarget !== '' &&
            nextTarget !== 'ignore' &&
            !isOperationalMappingTarget(nextTarget)
        ) {
            return false;
        }
    }

    return true;
};

const markMappingChanged = (): void => {
    const selectedProfile = importProfiles.value.find(
        (profile) => profile.id === selectedProfileId.value,
    );
    if (
        selectedProfile &&
        !mappingsAreEqual(selectedProfile.mapping, fieldMapping.value)
    ) {
        selectedProfileId.value = null;
    }

    if (file.value && detectedColumns.value.length > 0) {
        mappingPreviewStale.value = true;
    }
};

const visiblePersistedRowIds = (): number[] =>
    paginatedEditedRows.value
        .map((row) => Number(row.__server_row_id ?? 0))
        .filter((id) => id > 0)
        .slice(0, 200);

const applyFastOperationalMappingRows = (rows: any[]): void => {
    const rowsById = new Map(rows.map((row) => [Number(row.id), row]));

    previewRows.value = previewRows.value.map((row: any) => {
        const replacement = rowsById.get(Number(row.id));

        return replacement ?? row;
    });

    editedRows.value = editedRows.value.map((row) => {
        const replacement = rowsById.get(Number(row.__server_row_id));

        return replacement
            ? previewRowToEditedRow(replacement, row.__preview_index)
            : row;
    });

    recomputeAllLocalValidation();
    clearEditingState();
};

const tryApplyOperationalMappingChange = async (
    currentMapping: Record<string, string>,
    nextMapping: Record<string, string>,
): Promise<boolean> => {
    if (!mappingHasChanges(currentMapping, nextMapping)) {
        return true;
    }

    if (!isOperationalOnlyMappingChange(currentMapping, nextMapping)) {
        return false;
    }

    if (
        !props.config.fullFileImport ||
        !activeImportRunId.value ||
        !validatedImportRunId.value ||
        activeImportRunId.value !== validatedImportRunId.value ||
        !persistedRowsAvailable.value ||
        !validationRowsServerMeta.value ||
        hasUnsavedPersistedRowChanges.value ||
        persistedRowsRevalidationActive.value ||
        operationalMappingApplying.value
    ) {
        return false;
    }

    operationalMappingApplying.value = true;
    error.value = null;
    try {
        const response = await importService.updateRunMapping(
            props.config.entity,
            activeImportRunId.value,
            {
                rows_revision: validationRowsServerMeta.value.rows_revision,
                mapping: nextMapping,
                visible_row_ids: visiblePersistedRowIds(),
            },
        );

        validationRowsServerMeta.value = {
            ...validationRowsServerMeta.value,
            rows_revision: response.data.rows_revision,
            rows_dirty: response.data.rows_dirty,
            full_revalidation_status: response.data.full_revalidation_status,
        };
        dirtyPersistedRowIds.value = new Set();
        mappingPreviewStale.value = false;
        applyFastOperationalMappingRows(response.data.rows ?? []);
        toast.info('Aplicando mapping operativo y revalidando filas...');
        startImportStatusPolling();

        return true;
    } catch (e: any) {
        if (e.response?.data?.data?.requires_full_restart === true) {
            return false;
        }

        error.value =
            e.response?.data?.message ||
            'No se pudo aplicar el mapping operativo.';
        return false;
    } finally {
        operationalMappingApplying.value = false;
    }
};

const updateTargetFieldMapping = async (
    targetKey: string,
    sourceKey: string,
): Promise<void> => {
    const currentMapping = { ...fieldMapping.value };
    const nextMapping = Object.fromEntries(
        Object.entries(fieldMapping.value).filter(
            ([source, target]) => source !== sourceKey && target !== targetKey,
        ),
    );

    if (sourceKey !== '') {
        nextMapping[sourceKey] = targetKey;
    }

    replaceMapping(nextMapping, 'manual');
    const handledOperationalChange = await tryApplyOperationalMappingChange(
        currentMapping,
        nextMapping,
    );
    if (handledOperationalChange) {
        return;
    }

    markMappingChanged();
};

const getFieldError = (row: ImportRow, colKey: string): string | null => {
    if (row.__valid) return null;
    if (!row.__errors?.length) return null;
    const errorStr = row.__errors.join(' ').toLowerCase();
    if (
        errorStr.includes(colKey.toLowerCase()) ||
        errorStr.includes(colKey.replace('_', ' ').toLowerCase())
    ) {
        return row.__errors.join(' ');
    }
    return null;
};

const normalizeCellIdentity = (value: unknown): string =>
    String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

const duplicateMapsForRows = () => {
    const skuCounts = new Map<string, number>();
    const nameCounts = new Map<string, number>();

    editedRows.value.forEach((row) => {
        const skuKey = normalizeCellIdentity(row.sku);
        if (skuKey) {
            skuCounts.set(skuKey, (skuCounts.get(skuKey) ?? 0) + 1);
        }

        const nameKey = [
            normalizeCellIdentity(row.nombre ?? row.name),
            normalizeCellIdentity(row.categoria),
        ]
            .filter(Boolean)
            .join('|');
        if (nameKey) {
            nameCounts.set(nameKey, (nameCounts.get(nameKey) ?? 0) + 1);
        }
    });

    return { skuCounts, nameCounts };
};

const localErrorsForRow = (row: ImportRow): string[] => {
    const errors: string[] = [];

    editableColumns.value.forEach((column) => {
        const value = row[column.key];
        if (
            column.required &&
            (value === null ||
                value === undefined ||
                String(value).trim() === '')
        ) {
            errors.push(`El campo ${column.label} es obligatorio.`);
        }

        if (
            column.type === 'number' &&
            value !== null &&
            value !== undefined &&
            value !== '' &&
            Number.isNaN(Number(value))
        ) {
            errors.push(`El campo ${column.label} debe ser numerico.`);
        }
    });

    return errors;
};

const duplicateConflictsForRow = (
    row: ImportRow,
    duplicateMaps = duplicateMapsForRows(),
) => {
    const conflicts: any[] = [];
    const skuKey = normalizeCellIdentity(row.sku);
    const nameKey = [
        normalizeCellIdentity(row.nombre ?? row.name),
        normalizeCellIdentity(row.categoria),
    ]
        .filter(Boolean)
        .join('|');

    if (skuKey && (duplicateMaps.skuCounts.get(skuKey) ?? 0) > 1) {
        conflicts.push({
            field: 'sku',
            type: 'duplicate_sku_in_file',
            message: 'Hay otra fila con el mismo SKU en este archivo.',
        });
    }

    if (nameKey && (duplicateMaps.nameCounts.get(nameKey) ?? 0) > 1) {
        conflicts.push({
            field: 'nombre',
            type: 'duplicate_name_in_file',
            message:
                'Hay otra fila con el mismo nombre y categoria en este archivo.',
        });
    }

    return conflicts;
};

const recomputeRowLocalValidation = (
    row: ImportRow,
    duplicateMaps = duplicateMapsForRows(),
) => {
    const localErrors = localErrorsForRow(row);
    const duplicateConflicts = duplicateConflictsForRow(row, duplicateMaps);
    const serverErrors = row.__server_errors ?? [];
    const serverConflicts = row.__server_conflicts ?? [];

    row.__local_errors = localErrors;
    row.__duplicate_conflicts = duplicateConflicts;
    row.__errors = [...serverErrors, ...localErrors];
    row.__conflicts = [...serverConflicts, ...duplicateConflicts];
    row.__valid =
        row.__server_valid !== false &&
        row.__errors.length === 0 &&
        row.__conflicts.length === 0;
};

const recomputeAllLocalValidation = () => {
    const duplicateMaps = duplicateMapsForRows();
    editedRows.value.forEach((row) =>
        recomputeRowLocalValidation(row, duplicateMaps),
    );
};

const rowPayloadForValidation = (row: ImportRow) => {
    const clean: any = { __row: row.__row };
    props.config.columns.forEach((column) => {
        if (column.actionType) return;
        if (row[column.key] !== undefined) {
            clean[column.key] = row[column.key];
        }
    });

    clean.__attributes = row.__attributes ?? [];
    clean.__variants = row.__variants ?? [];
    clean.__compatibility = row.__compatibility ?? [];

    return clean;
};

const revalidateRows = async (rowsToValidate: ImportRow[], label: string) => {
    if (rowsToValidate.length === 0 || revalidatingRows.value) return;

    revalidatingRows.value = true;
    error.value = null;
    try {
        const response = await importService.validateRows(
            props.config.entity,
            rowsToValidate.map(rowPayloadForValidation),
            currentImportOptions(),
        );
        const validatedRows = response.data?.rows ?? response.rows ?? [];

        validatedRows.forEach((validatedRow: any) => {
            const existingIndex = editedRows.value.findIndex(
                (row) => row.__row === validatedRow.row,
            );
            if (existingIndex === -1) return;

            const previousPreviewIndex =
                editedRows.value[existingIndex].__preview_index;
            editedRows.value[existingIndex] = {
                ...previewRowToEditedRow(validatedRow, previousPreviewIndex),
                __preview_index: previousPreviewIndex,
            };
        });

        recomputeAllLocalValidation();
        toast.success(
            `Se revalidaron ${validatedRows.length} fila${validatedRows.length === 1 ? '' : 's'} ${label}.`,
        );
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            `No se pudieron revalidar las filas ${label}.`;
    } finally {
        revalidatingRows.value = false;
    }
};

const revalidateErroredRows = async () => {
    await revalidateRows(
        rowsWithValidationIssues.value,
        'con revision pendiente',
    );
};

const revalidateFilteredRows = async () => {
    await revalidateRows(filteredEditedRows.value, 'filtradas');
};

const revalidateSelectedRows = async () => {
    const rowsToValidate = editedRows.value.filter((row) =>
        selectedRows.value.has(row.__preview_index),
    );

    await revalidateRows(rowsToValidate, 'seleccionadas');
};

const toggleAllRows = () => {
    const nextSelection = new Set(selectedRows.value);

    if (allRowsSelected.value) {
        paginatedEditedRows.value.forEach((row) => {
            nextSelection.delete(row.__preview_index);
        });
    } else {
        paginatedEditedRows.value.forEach((row) => {
            nextSelection.add(row.__preview_index);
        });
    }

    selectedRows.value = nextSelection;
};

const bulkValueEntries = () =>
    Object.entries(bulkValues.value).filter(
        ([, value]) => value !== null && value !== undefined && value !== '',
    );

const rowsForBulkScope = (scope: 'all' | 'filtered' | 'page' | 'selected') => {
    if (scope === 'filtered') return filteredEditedRows.value;
    if (scope === 'page') return paginatedEditedRows.value;
    if (scope === 'selected') {
        return editedRows.value.filter((row) =>
            selectedRows.value.has(row.__preview_index),
        );
    }

    return editedRows.value;
};

const bulkScopeAvailable = (
    scope: 'all' | 'filtered' | 'page' | 'selected',
): boolean => {
    if (!serverRowsMode.value) {
        return true;
    }

    return (
        serverScopeActions.value?.[scope] ??
        ['selected', 'page'].includes(scope)
    );
};

const bulkScopeLabel = (scope: 'all' | 'filtered' | 'page' | 'selected') => {
    if (scope === 'filtered') return 'filtradas';
    if (scope === 'page') return 'de la pagina visible';
    if (scope === 'selected') return 'seleccionadas';

    return 'del preview';
};

const applyBulkValues = (scope: 'all' | 'filtered' | 'page' | 'selected') => {
    if (validatedPreviewReadOnly.value) {
        toast.warning(
            'La validacion completa es solo lectura hasta el Grupo 2.',
        );

        return;
    }

    if (!bulkScopeAvailable(scope)) {
        toast.warning('Disponible cuando el conjunto cabe en memoria.');

        return;
    }

    const entries = bulkValueEntries();
    if (entries.length === 0) {
        toast.warning('Define al menos un valor para aplicar.');

        return;
    }

    const rowsToApply = rowsForBulkScope(scope);
    if (rowsToApply.length === 0) {
        toast.warning('No hay filas en el alcance seleccionado.');

        return;
    }

    rowsToApply.forEach((row) => {
        entries.forEach(([key, value]) => {
            commitPreviewCellEdit(row.__preview_index, key, value);
        });
    });

    toast.success(
        `Se aplicaron ${entries.length} columna${entries.length === 1 ? '' : 's'} a ${rowsToApply.length} fila${rowsToApply.length === 1 ? '' : 's'} ${bulkScopeLabel(scope)}.`,
    );
    bulkValues.value = {};
    bulkEditMode.value = false;
    selectedRows.value = new Set();
};

const clearStoredPreviewDraft = (): void => {
    try {
        window.localStorage.removeItem(draftStorageKey.value);
    } catch {
        // localStorage can be unavailable in private or restricted contexts.
    }
};

const shouldWarnBeforeLeaving = () => hasUnsavedPersistedRowChanges.value;

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!shouldWarnBeforeLeaving()) {
        return;
    }

    event.preventDefault();
    event.returnValue = UNSAVED_IMPORT_CHANGES_MESSAGE;
};

const cancelPendingNavigation = (): void => {
    pendingNavigationUrl.value = null;
    leaveConfirmOpen.value = false;
};

const confirmPendingNavigation = (): void => {
    const url = pendingNavigationUrl.value;
    if (!url) {
        cancelPendingNavigation();
        return;
    }

    navigationApproved.value = true;
    cancelPendingNavigation();
    router.visit(url);
};

const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
};

const notifyImportComplete = (result: ImportResult) => {
    const successCount = result.success_count ?? 0;
    const errorCount = result.error_count ?? 0;
    const totalRows = result.total_rows ?? result.processed_rows ?? 0;
    const conflictTotal = Number(result.summary?.conflict_count ?? 0);
    completedImportDuration.value = elapsedImportDuration();
    const durationText = completedImportDuration.value
        ? ` en ${completedImportDuration.value}`
        : '';
    const totalText = totalRows ? `/${totalRows}` : '';
    const message = `Importacion completada${durationText}: ${successCount}${totalText} exitosos, ${errorCount} errores, ${conflictTotal} conflictos`;

    if (errorCount > 0) {
        toast.error(message);
    } else {
        toast.success(message);
    }

    if (
        document.hidden &&
        'Notification' in window &&
        Notification.permission === 'granted'
    ) {
        new Notification('Importacion de Productos', {
            body: message,
            icon: '/favicon.ico',
        });
    }
};

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
    previewSource.value = 'file';
    void loadImportMetadata();
};

const resetPreview = () => {
    latestPreviewRequestId++;
    latestMetadataRequestId++;

    previewRows.value = [];
    editedRows.value = [];
    previewSummary.value = null;
    importSheets.value = [];
    selectedSheetIndex.value = null;
    detectedColumns.value = [];
    resetMapping();
    requiredFields.value = [];
    fullValidationReportActive.value = false;
    result.value = null;
    error.value = null;
    metadataLoading.value = false;
    validationRunning.value = false;
    fullImportRunning.value = false;
    importRunning.value = false;
    activeImportRunId.value = null;
    validatedImportRunId.value = null;
    validationRowsServerMeta.value = null;
    persistedRowsAvailable.value = false;
    dirtyPersistedRowIds.value = new Set();
    activePreviewFilter.value = 'all';
    previewSearch.value = '';
    expandedChangeRow.value = null;
    expandedProductGroups.value = new Set();
    diagnosticsExpanded.value = false;
    previewFullscreen.value = false;
    previewPage.value = 1;
    previewSource.value = null;
    uploadProgress.value = null;
    mappingPreviewStale.value = false;
    mappingReplacementRunId.value = null;
    lastProgressRefreshAt.value = null;
    completedImportDuration.value = null;
    stopImportStatusPolling();
    clearStoredPreviewDraft();
};

const togglePreviewFullscreen = () => {
    previewFullscreen.value = !previewFullscreen.value;

    if (previewFullscreen.value) {
        diagnosticsExpanded.value = false;
    }
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

const applyMetadataPayload = (
    payload: any,
    rows: any[] = [],
    fallbackSheetIndex: number | null = selectedSheetIndex.value,
): void => {
    const metadata = previewMetadataFromPayload(payload, rows);

    importSheets.value = metadata.sheets;
    detectedColumns.value = metadata.detectedColumns;
    requiredFields.value = metadata.requiredFields;
    applySuggestedMappingIfPristine(metadata.suggestedMapping);
    selectedSheetIndex.value =
        metadata.selectedSheet?.index ?? fallbackSheetIndex ?? null;
    ensureDetectedColumns(rows);
};

const loadImportMetadata = async (
    sheetIndex: number | null = selectedSheetIndex.value,
): Promise<void> => {
    if (!file.value || !props.config.fullFileImport) {
        return;
    }

    const requestId = ++latestMetadataRequestId;
    metadataLoading.value = true;
    error.value = null;

    try {
        const response = await importService.metadata(
            props.config.entity,
            file.value,
            {
                ...(sheetIndex !== null ? { sheet_index: sheetIndex } : {}),
                mapping: currentRequestMapping(),
                mode: importMode.value,
                profile_id: selectedProfileId.value,
            },
        );
        const metadataPayload = response.data ?? response;

        if (requestId !== latestMetadataRequestId) {
            return;
        }

        applyMetadataPayload(metadataPayload, [], sheetIndex);
        previewSource.value = 'file';
        mappingPreviewStale.value = false;
    } catch (e: any) {
        if (requestId !== latestMetadataRequestId) {
            return;
        }

        error.value =
            e.response?.data?.message ||
            'No se pudieron leer las columnas del archivo.';
        importSheets.value = [];
        selectedSheetIndex.value = null;
        detectedColumns.value = [];
        requiredFields.value = [];
    } finally {
        if (requestId === latestMetadataRequestId) {
            metadataLoading.value = false;
        }
    }
};

type PreviewImportOptions = {
    restartImportRunId?: number | null;
};

const previewImport = async (
    sheetIndex: number | null = selectedSheetIndex.value,
    options: PreviewImportOptions = {},
) => {
    if (!file.value) return;
    const requestId = ++latestPreviewRequestId;
    latestMetadataRequestId++;
    error.value = null;
    result.value = null;
    fullValidationReportActive.value = false;
    validationRowsServerMeta.value = null;
    persistedRowsAvailable.value = false;
    dirtyPersistedRowIds.value = new Set();
    previewLoading.value = true;
    metadataLoading.value = false;
    uploadProgress.value = 0;
    try {
        const requestOptions = {
            ...(sheetIndex !== null ? { sheet_index: sheetIndex } : {}),
            mapping: currentRequestMapping(),
            mode: importMode.value,
            profile_id: selectedProfileId.value,
            import_run_id:
                options.restartImportRunId ?? reusableAsyncPreviewRunId.value,
            onUploadProgress: (event: { loaded: number; total?: number }) => {
                if (!event.total) return;
                uploadProgress.value = Math.round(
                    (event.loaded / event.total) * 100,
                );
            },
        };
        const response = props.config.fullFileImport
            ? await importService.validateFile(
                  props.config.entity,
                  file.value,
                  requestOptions,
              )
            : await importService.preview(
                  props.config.entity,
                  file.value,
                  requestOptions,
              );
        const previewPayload = response.data ?? response;

        if (requestId !== latestPreviewRequestId) {
            return;
        }

        const previewMetadata = previewMetadataFromPayload(
            previewPayload,
            previewPayload.rows ?? previewPayload.validation_rows ?? [],
        );

        if (
            (previewPayload.async || props.config.fullFileImport) &&
            previewPayload.import_run_id
        ) {
            const asyncRun = {
                id: previewPayload.import_run_id,
                ...previewPayload,
                preview_async: true,
                run_type: previewPayload.run_type ?? 'validation',
            };
            activeImportRunId.value = previewPayload.import_run_id;
            validatedImportRunId.value = null;
            validationRowsServerMeta.value = null;
            persistedRowsAvailable.value = false;
            dirtyPersistedRowIds.value = new Set();
            importHistoryExpanded.value = true;
            result.value = asyncRun;
            mergeImportRun(asyncRun);
            validationRunning.value = true;
            previewRows.value = [];
            editedRows.value = [];
            previewSummary.value = previewPayload.summary ?? null;
            importSheets.value = previewMetadata.sheets;
            detectedColumns.value = previewMetadata.detectedColumns;
            requiredFields.value = previewMetadata.requiredFields;
            applySuggestedMappingIfPristine(previewMetadata.suggestedMapping);
            ensureDetectedColumns();
            selectedSheetIndex.value =
                previewMetadata.selectedSheet?.index ?? sheetIndex ?? null;
            previewSource.value = 'file';
            mappingPreviewStale.value = false;
            startImportStatusPolling();
            return;
        }

        previewRows.value = previewPayload.rows ?? [];
        previewSummary.value = previewPayload.summary ?? null;
        importSheets.value = previewMetadata.sheets;
        detectedColumns.value = previewMetadata.detectedColumns;
        requiredFields.value = previewMetadata.requiredFields;
        applySuggestedMappingIfPristine(previewMetadata.suggestedMapping);
        ensureDetectedColumns(previewPayload.rows ?? []);
        selectedSheetIndex.value =
            previewMetadata.selectedSheet?.index ?? sheetIndex ?? null;
        previewSource.value = 'file';
        mappingPreviewStale.value = false;
        applyPreviewRows(previewRows.value);
        await loadSearchableOptions();
        resolveSearchableValues();
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            (e.code === 'ECONNABORTED'
                ? 'La previsualizacion tardo demasiado. Se debe procesar en cola para evitar el timeout.'
                : 'No se pudo generar la previsualización.');
        previewRows.value = [];
        editedRows.value = [];
        previewSummary.value = null;
        importSheets.value = [];
        selectedSheetIndex.value = null;
        detectedColumns.value = [];
        requiredFields.value = [];
    } finally {
        if (requestId === latestPreviewRequestId) {
            previewLoading.value = false;
            uploadProgress.value = null;
        }
    }
};

const refreshPreviewWithCurrentMapping = async (): Promise<void> => {
    if (!file.value) {
        return;
    }

    try {
        const importRunId = activeImportRunId.value;
        if (!importRunId) {
            await previewImport(selectedSheetIndex.value);
            return;
        }

        const run = result.value ?? activeHistoryRun.value;
        if (isActiveRunStatus(run?.status)) {
            mappingReplacementRunId.value = importRunId;
            const response = await importService.cancelRun(
                props.config.entity,
                importRunId,
            );

            if (response.data.status !== 'cancelled') {
                toast.info(
                    'Cancelando validacion anterior para aplicar el nuevo mapping.',
                );
                startImportStatusPolling();
                return;
            }
        }

        await restartPreviewWithCurrentMapping(importRunId);
    } catch (previewError: any) {
        mappingReplacementRunId.value = null;
        error.value =
            previewError.response?.data?.message ||
            'No se pudo reemplazar la validacion anterior con el mapping actual.';
    }
};

const restartPreviewWithCurrentMapping = async (
    importRunId: number,
): Promise<void> => {
    mappingReplacementRunId.value = null;
    await previewImport(selectedSheetIndex.value, {
        restartImportRunId: importRunId,
    });
};

const previewRowToEditedRow = (row: any, index: number): ImportRow => ({
    ...row.data,
    __server_row_id: row.id ?? null,
    __server_updated_at: row.updated_at ?? null,
    __is_edited: row.is_edited ?? false,
    __preview_index: index,
    __row: row.row,
    __server_valid: row.is_valid,
    __valid: row.is_valid,
    __server_errors: row.errors ?? [],
    __errors: row.errors ?? [],
    __local_errors: [],
    __warnings: row.warnings ?? row.data?.__warnings ?? [],
    __action_type: row.action_type ?? row.data?.action_type ?? 'invalid',
    __change_preview: row.change_preview ?? row.data?.change_preview ?? [],
    __server_conflicts: row.conflicts ?? row.data?.conflicts ?? [],
    __conflicts: row.conflicts ?? row.data?.conflicts ?? [],
    __duplicate_conflicts: [],
    __attributes: row.data?.__attributes ?? [],
    __variants: row.data?.__variants ?? [],
    __variant_preview: row.data?.__variant_preview ?? null,
    __product_group_key: row.data?.__product_group_key ?? null,
    __compatibility:
        row.data?.__compatibility ?? row.data?.__vehicle_compatibility ?? [],
    __vehicle_creation_candidate:
        row.data?.__vehicle_creation_candidate ?? null,
});

const applyPreviewRows = (rows: any[]) => {
    editedRows.value = rows.map((row, index) =>
        previewRowToEditedRow(row, index),
    );
    recomputeAllLocalValidation();
    clearEditingState();
    expandedProductGroups.value = new Set(
        groupedPreviewGroups.value
            .filter((group) => group.errorRows || group.conflictRows)
            .slice(0, 1)
            .map((group) => group.key),
    );
    diagnosticsExpanded.value =
        hasPreviewDiagnostics.value && !previewFullscreen.value;
};

const markPersistedRowDirty = (previewIndex: number): void => {
    if (!persistedRowsAvailable.value) return;
    const row = editedRows.value.find(
        (candidate) => candidate.__preview_index === previewIndex,
    );
    const id = Number(row?.__server_row_id ?? 0);
    if (id > 0) {
        dirtyPersistedRowIds.value = new Set([
            ...dirtyPersistedRowIds.value,
            id,
        ]);
        return;
    }

    toast.warning('Esta fila no tiene identificador de servidor para guardar.');
};

const commitPreviewCellEdit = (
    rowIndex: number,
    columnKey: string,
    nextValue: unknown,
): void => {
    if (previewViewControlsDisabled.value) {
        return;
    }

    commitCellEdit(rowIndex, columnKey, nextValue);
};

function isActiveRunStatus(status: string | undefined): boolean {
    return ['pending', 'running'].includes(status ?? '');
}

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

const saveCurrentProfile = async () => {
    if (!profileNameIsValid.value) {
        error.value = 'El nombre del perfil debe tener al menos 3 caracteres.';
        return;
    }

    try {
        const profile = await saveProfileFromComposable();
        if (profile) {
            mappingSource.value = 'profile';
            toast.success('Perfil guardado');
        }
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'No se pudo guardar el perfil.';
    }
};

const currentImportOptions = () => ({
    ...(selectedSheetIndex.value !== null
        ? { sheet_index: selectedSheetIndex.value }
        : {}),
    mapping: currentRequestMapping(),
    mode: importMode.value,
    profile_id: selectedProfileId.value,
});

const currentRequestMapping = (): Record<string, string> =>
    hasExplicitCurrentMapping.value ? fieldMapping.value : {};

const ensureDetectedColumns = (rows: any[] = []): void => {
    if (detectedColumns.value.length > 0) {
        return;
    }

    if (props.config.fullFileImport === true) {
        return;
    }

    const mappingColumns = mappingColumnsFromMapping(fieldMapping.value);
    detectedColumns.value =
        mappingColumns.length > 0
            ? mappingColumns
            : mappingColumnsFromRows(rows);
};

const hydrateRunMappingState = (run: ImportResult | ImportRun | null) => {
    if (!run) return;

    const metadata = previewMetadataFromPayload(run);
    const runMapping = firstRecord<Record<string, string>>(run.mapping);
    const savedMapping = hasExplicitMapping(runMapping)
        ? runMapping
        : firstRecord<Record<string, string>>(
              run.suggested_mapping,
              metadata.suggestedMapping,
          );

    replaceMapping(savedMapping, 'history');
    importMode.value = run.mode ?? importMode.value;
    importSheets.value = metadata.sheets;
    detectedColumns.value =
        metadata.detectedColumns.length > 0
            ? metadata.detectedColumns
            : props.config.fullFileImport === true
              ? []
              : mappingColumnsFromMapping(savedMapping);
    requiredFields.value = metadata.requiredFields.length
        ? metadata.requiredFields
        : requiredFields.value;
    selectedSheetIndex.value =
        run.sheet_index ??
        metadata.selectedSheet?.index ??
        selectedSheetIndex.value;
    ensureDetectedColumns();
};

const handleSheetChange = async (event: Event) => {
    const value = Number((event.target as HTMLSelectElement).value);
    selectedSheetIndex.value = Number.isNaN(value) ? null : value;
    resetMapping();

    if (
        props.config.fullFileImport &&
        !hasPreview.value &&
        activeImportRunId.value === null
    ) {
        await loadImportMetadata(selectedSheetIndex.value);
        return;
    }

    await previewImport(selectedSheetIndex.value);
};

const loadSearchableOptions = async (options: { force?: boolean } = {}) => {
    const endpoints = new Set<string>();
    props.config.columns.forEach((col) => {
        if (col.type === 'searchable' && col.searchableEndpoint)
            endpoints.add(col.searchableEndpoint);
    });
    for (const endpoint of endpoints) {
        // Skip only if already loaded with data (not if it failed returning [])
        const cached = searchableOptions.value[endpoint];
        if (!options.force && Array.isArray(cached) && cached.length > 0)
            continue;
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

const refreshAfterReferenceMutation = async (
    references: ReferenceRevalidationPayload = {},
): Promise<boolean> => {
    await loadSearchableOptions({ force: true });
    resolveSearchableValues();

    if (validatedImportRunId.value && persistedRowsAvailable.value) {
        return requestReferenceRowsRevalidation(references);
    }

    await previewImport(selectedSheetIndex.value);
    return true;
};

const createMissingBrand = async (brandName: string, refreshPreview = true) => {
    if (!brandName || creatingBrands.value[brandName]) return;
    creatingBrands.value = { ...creatingBrands.value, [brandName]: true };
    error.value = null;

    try {
        await apiClient.post('/brands', {
            name: brandName,
            status: 'active',
        });
        if (refreshPreview) {
            await refreshAfterReferenceMutation({
                brands: [brandName],
                categories: [],
            });
        }
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

const createMissingCategory = async (categoryName: string) => {
    const name = categoryName.trim();
    if (!name) return;

    await apiClient.post('/categories', { name });
};

const createMissingCategoryAndRefresh = async (categoryName: string) => {
    error.value = null;

    try {
        await createMissingCategory(categoryName);
        await refreshAfterReferenceMutation({
            brands: [],
            categories: [categoryName],
        });
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            `No se pudo crear la categoria ${categoryName}.`;
    }
};

const requestCreateAllMissingReferences = (): void => {
    pendingSafetyAction.value = 'create_references';
    pendingSafetyRun.value = null;
    safetyConfirmOpen.value = true;
};

const executeCreateAllMissingReferences = async () => {
    if (creatingAllReferences.value || visibleReferenceCount.value === 0) {
        return;
    }

    creatingAllReferences.value = true;
    error.value = null;

    try {
        const response = await importService.createReferencesBatch(
            props.config.entity,
            {
                categories: previewSummary.value?.missing_categories ?? [],
                brands: missingBrandReferences.value,
            },
        );
        const summary = response.data.summary;

        await refreshAfterReferenceMutation({
            categories: previewSummary.value?.missing_categories ?? [],
            brands: missingBrandReferences.value,
        });

        if (summary.error_count > 0) {
            toast.warning(
                `Referencias creadas con ${summary.error_count} error${summary.error_count === 1 ? '' : 'es'} por revisar.`,
            );
        } else if (
            !validatedImportRunId.value ||
            !persistedRowsAvailable.value
        ) {
            toast.success(
                `Referencias listas: ${summary.created_count} creadas, ${summary.existing_count} existentes.`,
            );
        }
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            'No se pudieron crear todas las referencias faltantes.';
    } finally {
        creatingAllReferences.value = false;
    }
};

const requestCreateMissingVehicleCandidates = (): void => {
    pendingSafetyAction.value = 'create_vehicles';
    pendingSafetyRun.value = null;
    safetyConfirmOpen.value = true;
};

const executeCreateMissingVehicleCandidates = async () => {
    if (
        creatingVehicleCandidates.value ||
        missingVehicleCandidates.value.length === 0
    ) {
        return;
    }

    creatingVehicleCandidates.value = true;
    error.value = null;

    try {
        const response = await importService.createVehicleCandidatesBatch(
            props.config.entity,
            missingVehicleCandidates.value,
        );
        const summary = response.data.summary;

        await refreshAfterReferenceMutation();

        if (summary.error_count > 0) {
            toast.warning(
                `Vehiculos creados con ${summary.error_count} error${summary.error_count === 1 ? '' : 'es'} por revisar.`,
            );
        } else if (
            !validatedImportRunId.value ||
            !persistedRowsAvailable.value
        ) {
            toast.success(
                `Vehiculos listos: ${summary.created_count} referencias creadas, ${summary.existing_count} existentes.`,
            );
        }
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            'No se pudieron crear los vehiculos detectados.';
    } finally {
        creatingVehicleCandidates.value = false;
    }
};

/**
 * After preview, try to resolve text values in searchable columns to their numeric IDs.
 * e.g. "TOYOTA" -> 3 (if VehicleMake id=3 has name=TOYOTA)
 */
const normalizeSearchableValue = (value: unknown): string =>
    String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

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
            const normalizedRawValue = normalizeSearchableValue(rawValue);
            const options =
                searchableOptions.value[col.searchableEndpoint!] ?? [];
            const match = options.find((item: any) =>
                [item.id, item.value, item.name, item.label].some(
                    (candidate) =>
                        normalizeSearchableValue(candidate) ===
                        normalizedRawValue,
                ),
            );
            if (match) row[col.key] = match.id ?? match.value;
        });
    });
    recomputeAllLocalValidation();
};

onMounted(loadSearchableOptions);
onMounted(loadImportProfiles);
onMounted(async () => {
    await loadImportRuns(false);
    clearStoredPreviewDraft();
});
onMounted(() => {
    window.addEventListener('keydown', handleImporterKeydown);
    window.addEventListener('beforeunload', handleBeforeUnload);
    removeInertiaBeforeListener = router.on('before', (event: any) => {
        if (navigationApproved.value) {
            navigationApproved.value = false;
            return true;
        }

        if (!shouldWarnBeforeLeaving()) {
            return true;
        }

        pendingNavigationUrl.value = String(event.detail.visit.url);
        leaveConfirmOpen.value = true;

        return false;
    });
});

defineExpose({
    reloadSearchableOptions: () => {
        searchableOptions.value = {};
        return loadSearchableOptions();
    },
    refreshPreview: () => previewImport(selectedSheetIndex.value),
    revalidatePersistedRows: requestFullRowsRevalidation,
    refreshAfterReferenceBatch: () => refreshAfterReferenceMutation(),
    markPersistedRowDirty,
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

const isPreviewImageUrl = (value: unknown): value is string =>
    typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim());

// When a searchable column changes, check if it's a category and autocomplete attributes
const onSearchableChange = async (col: any, rowIdx: number, newValue: any) => {
    if (validatedPreviewReadOnly.value) return;

    commitPreviewCellEdit(rowIdx, col.key, newValue);
    const row = editedRows.value.find(
        (item) => item.__preview_index === rowIdx,
    );
    if (!row) return;

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
                    if (row.__attributes.length === 0) {
                        row.__attributes = cat.default_attributes.map(
                            (a: any) => ({
                                name: a.name ?? '',
                                value: '',
                                unit: a.unit ?? '',
                            }),
                        );
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
        const compatibility = row.__compatibility ?? [];
        const compatibilityCount = Array.isArray(compatibility)
            ? compatibility.length
            : Object.values(compatibility).reduce(
                  (total: number, scope: any) =>
                      total + (Array.isArray(scope) ? scope.length : 0),
                  0,
              );
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

const requestImportConfirmation = (mode: 'preview' | 'file') => {
    importConfirmMode.value = mode;
    importConfirmOpen.value = true;
};

const confirmImport = async () => {
    importConfirmOpen.value = false;
    if (importConfirmMode.value === 'file') {
        await importFullFile();
        return;
    }

    await runImport();
};

const runImport = async () => {
    if (!canImport.value) return;
    error.value = null;
    importRunning.value = true;
    importStartedAt.value = new Date();
    completedImportDuration.value = null;
    requestNotificationPermission();
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
        const response = await importService.execute(
            props.config.entity,
            rows,
            {
                mode: importMode.value,
            },
        );
        result.value = response.data ?? response;
        if (result.value) {
            notifyImportComplete(result.value);
            clearStoredPreviewDraft();
        }
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error al importar.';
    } finally {
        importRunning.value = false;
    }
};

const importFullFile = async () => {
    if (!validatedImportRunId.value || !canRunFullFile.value) return;
    error.value = null;
    result.value = null;
    fullImportRunning.value = true;
    uploadProgress.value = null;
    validationRunning.value = false;
    fullValidationReportActive.value = false;
    importStartedAt.value = new Date();
    completedImportDuration.value = null;
    requestNotificationPermission();

    try {
        const response = await importService.importValidatedRun(
            props.config.entity,
            validatedImportRunId.value,
            {
                mode: importMode.value,
            },
        );
        activeImportRunId.value = response.data?.import_run_id ?? null;
        result.value = response.data ?? response;
        uploadProgress.value = null;

        if (activeImportRunId.value) {
            importHistoryExpanded.value = true;
            await loadImportRuns(false);
            startImportStatusPolling();
        } else {
            fullImportRunning.value = false;
        }
    } catch (e: any) {
        error.value = getImportErrorMessage(
            e,
            'No se pudo iniciar la importacion completa.',
        );
        fullImportRunning.value = false;
        uploadProgress.value = null;
    }
};

const cancelActiveRun = async () => {
    if (!activeImportRunId.value) return;
    await importService.cancelRun(props.config.entity, activeImportRunId.value);
    await loadImportRuns(false);
    await refreshImportRun();
};

const requestRetryFailedRows = (): void => {
    pendingSafetyAction.value = 'retry_active';
    pendingSafetyRun.value = null;
    safetyConfirmOpen.value = true;
};

const executeRetryFailedRows = async () => {
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

const serverRowsParams = () => {
    const params: Record<string, any> = {
        page: previewPage.value,
        per_page: previewPerPage.value,
    };

    if (previewSearch.value.trim()) {
        params.search = previewSearch.value.trim();
    }

    if (activePreviewFilter.value === 'errors') {
        params.has_errors = true;
    } else if (activePreviewFilter.value === 'warnings') {
        params.has_warnings = true;
    } else if (activePreviewFilter.value === 'conflict') {
        params.has_conflicts = true;
    } else if (
        ['create', 'update', 'unchanged'].includes(activePreviewFilter.value)
    ) {
        params.action_type = activePreviewFilter.value;
    }

    return params;
};

const loadValidatedRunRows = async (
    importRunId: number,
    options: { discardLocalChanges?: boolean } = {},
) => {
    if (
        hasUnsavedPersistedRowChanges.value &&
        options.discardLocalChanges !== true
    ) {
        toast.warning(
            'Guarda o descarta los cambios antes de cambiar de pagina.',
        );
        return;
    }

    const requestId = ++latestServerRowsRequestId;
    serverRowsLoading.value = true;
    try {
        const response = await importService.getRunRows(
            props.config.entity,
            importRunId,
            serverRowsParams(),
        );

        if (
            requestId !== latestServerRowsRequestId ||
            activeImportRunId.value !== importRunId
        ) {
            return;
        }

        persistedRowsAvailable.value = response.meta.total > 0;
        validationRowsServerMeta.value = response.meta;
        previewRows.value = response.data as any[];
        applyPreviewRows(response.data);
        ensureDetectedColumns(response.data);
        dirtyPersistedRowIds.value = new Set();
        if (
            Number(response.meta.current_page ?? previewPage.value) !==
            previewPage.value
        ) {
            syncingServerPreviewPage = true;
            previewPage.value = Number(response.meta.current_page);
        }
        fullValidationReportActive.value = !persistedRowsAvailable.value;
    } finally {
        if (requestId === latestServerRowsRequestId) {
            serverRowsLoading.value = false;
        }
    }
};

const applyCompletedValidationRows = async () => {
    const validationRows = result.value?.validation_rows ?? [];
    if (!activeImportRunId.value) return;

    validatedImportRunId.value = activeImportRunId.value;
    previewSource.value = 'file';
    validationRowsServerMeta.value = null;

    let rows: any[] = validationRows;
    if (rows.length === 0) {
        await loadValidatedRunRows(activeImportRunId.value);
        rows = previewRows.value;
    } else {
        persistedRowsAvailable.value = false;
        validationRowsServerMeta.value = null;
    }

    previewRows.value = rows;
    previewSummary.value = result.value?.summary ?? null;
    const metadata = previewMetadataFromPayload(result.value, rows);
    importSheets.value = metadata.sheets;
    detectedColumns.value = metadata.detectedColumns;
    requiredFields.value = metadata.requiredFields;
    applySuggestedMappingIfPristine(metadata.suggestedMapping);
    applyPreviewRows(rows);
    ensureDetectedColumns(rows);
    await loadSearchableOptions();
    resolveSearchableValues();
    fullValidationReportActive.value = !persistedRowsAvailable.value;
};

const savePersistedRowChanges = async () => {
    if (
        !canSavePersistedRowChanges.value ||
        !activeImportRunId.value ||
        !validationRowsServerMeta.value
    ) {
        return;
    }

    savingPersistedRows.value = true;
    error.value = null;
    try {
        const rows = editedRows.value
            .filter((row) =>
                dirtyPersistedRowIds.value.has(Number(row.__server_row_id)),
            )
            .map((row) => ({
                id: Number(row.__server_row_id),
                updated_at: String(row.__server_updated_at),
                data: rowPayloadForValidation(row),
            }));

        if (rows.length === 0) {
            error.value = 'No se encontraron filas persistidas para guardar.';
            return;
        }

        const response = await importService.updateRunRows(
            props.config.entity,
            activeImportRunId.value,
            {
                rows_revision: validationRowsServerMeta.value.rows_revision,
                rows,
            },
        );

        validationRowsServerMeta.value = {
            ...validationRowsServerMeta.value,
            rows_revision: response.data.rows_revision,
            rows_dirty: response.data.rows_dirty,
            full_revalidation_status: response.data.full_revalidation_status,
        };
        dirtyPersistedRowIds.value = new Set();
        await loadValidatedRunRows(activeImportRunId.value);
        toast.success(
            'Cambios guardados. Ejecuta la revalidacion completa antes de importar.',
        );
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            'No se pudieron guardar los cambios de filas.';
    } finally {
        savingPersistedRows.value = false;
    }
};

const discardPersistedRowChanges = async () => {
    if (!activeImportRunId.value) return;
    dirtyPersistedRowIds.value = new Set();
    await loadValidatedRunRows(activeImportRunId.value, {
        discardLocalChanges: true,
    });
};

async function requestReferenceRowsRevalidation(
    references: ReferenceRevalidationPayload,
): Promise<boolean> {
    if (
        !activeImportRunId.value ||
        revalidatingRows.value ||
        persistedRowsRevalidationActive.value
    )
        return false;

    revalidatingRows.value = true;
    error.value = null;

    try {
        const response = await importService.revalidateRunRows(
            props.config.entity,
            activeImportRunId.value,
            {
                scope: 'references',
                brands: references.brands ?? [],
                categories: references.categories ?? [],
            },
        );

        validationRowsServerMeta.value = validationRowsServerMeta.value
            ? {
                  ...validationRowsServerMeta.value,
                  full_revalidation_status:
                      response.data.full_revalidation_status,
              }
            : validationRowsServerMeta.value;

        if (response.data.fallback_full_revalidation === true) {
            if (validationRowsServerMeta.value) {
                validationRowsServerMeta.value = {
                    ...validationRowsServerMeta.value,
                    revalidation_progress: {
                        status: response.data.full_revalidation_status,
                        processed_rows: 0,
                        total_rows: validationRowsServerMeta.value.total,
                        rows_revision:
                            validationRowsServerMeta.value.rows_revision,
                        validated_rows_revision:
                            validationRowsServerMeta.value
                                .validated_rows_revision,
                    },
                };
            }
            toast.info(
                'No se pudo limitar por referencia. Se inicio revalidacion completa.',
            );
            startImportStatusPolling();
            return true;
        }

        if (activeImportRunId.value) {
            await loadValidatedRunRows(activeImportRunId.value);
            await refreshImportRun();
        }

        toast.success('Filas afectadas revalidadas.');
        return true;
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            'No se pudo revalidar las filas afectadas.';
        return false;
    } finally {
        revalidatingRows.value = false;
    }
}

async function requestFullRowsRevalidation(
    options: RowsRevalidationOptions = {},
): Promise<boolean> {
    if (
        !activeImportRunId.value ||
        revalidatingRows.value ||
        persistedRowsRevalidationActive.value
    )
        return false;
    revalidatingRows.value = true;
    error.value = null;
    try {
        const response = await importService.revalidateRunRows(
            props.config.entity,
            activeImportRunId.value,
        );
        validationRowsServerMeta.value = validationRowsServerMeta.value
            ? {
                  ...validationRowsServerMeta.value,
                  full_revalidation_status:
                      response.data.full_revalidation_status,
                  revalidation_progress: {
                      status: response.data.full_revalidation_status,
                      processed_rows: 0,
                      total_rows: validationRowsServerMeta.value.total,
                      rows_revision:
                          validationRowsServerMeta.value.rows_revision,
                      validated_rows_revision:
                          validationRowsServerMeta.value
                              .validated_rows_revision,
                  },
              }
            : validationRowsServerMeta.value;
        if (options.automatic === true) {
            toast.info(
                'Revalidando errores guardados con las referencias actuales.',
            );
        } else {
            toast.success('Revalidación completa en cola.');
        }
        startImportStatusPolling();
        return true;
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            'No se pudo iniciar la revalidacion completa.';
        return false;
    } finally {
        revalidatingRows.value = false;
    }
}

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

const shouldAutoRevalidateOpenedRun = (importRunId: number): boolean => {
    if (
        result.value?.run_type !== 'validation' ||
        result.value?.status !== 'completed' ||
        activeImportRunId.value !== importRunId ||
        !persistedRowsAvailable.value ||
        hasUnsavedPersistedRowChanges.value ||
        autoRevalidatedImportRunIds.has(importRunId)
    ) {
        return false;
    }

    const revalidationStatus =
        validationRowsServerMeta.value?.full_revalidation_status ??
        result.value?.summary?.full_revalidation_status ??
        '';

    if (['pending', 'running'].includes(revalidationStatus)) {
        return false;
    }

    const persistedErrorCount = Number(
        validationRowsServerMeta.value?.error_count ??
            result.value?.error_count ??
            0,
    );

    return persistedErrorCount > 0;
};

const maybeAutoRevalidateOpenedRun = async (
    importRunId: number,
): Promise<void> => {
    if (!shouldAutoRevalidateOpenedRun(importRunId)) {
        return;
    }

    const queued = await requestFullRowsRevalidation({ automatic: true });
    if (queued) {
        autoRevalidatedImportRunIds.add(importRunId);
    }
};

const exportEditedPreview = async () => {
    if (!hasPreview.value) return;

    error.value = null;
    try {
        const blob = await importService.exportPreview(
            props.config.entity,
            editedRows.value,
        );
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `preview-${props.config.entity}-editado.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            'No se pudo exportar el preview editado.';
    }
};

const openImportRun = async (run: any) => {
    error.value = null;
    activeImportRunId.value = run.id;
    const response = await importService.getRun(props.config.entity, run.id);
    result.value = response.data ?? response;
    hydrateRunMappingState(result.value);
    const status = result.value?.status;

    validationRunning.value =
        result.value?.run_type === 'validation' && isActiveRunStatus(status);
    fullImportRunning.value =
        result.value?.run_type !== 'validation' && isActiveRunStatus(status);

    if (isActiveRunStatus(status)) {
        startImportStatusPolling();
    } else {
        stopImportStatusPolling();
    }

    if (result.value?.run_type === 'validation' && status === 'completed') {
        await applyCompletedValidationRows();
        await maybeAutoRevalidateOpenedRun(run.id);
    }
};

const cancelHistoryRun = async (run: any) => {
    await importService.cancelRun(props.config.entity, run.id);
    await loadImportRuns(false);
    if (activeImportRunId.value === run.id) {
        await refreshImportRun();
    }
};

const requestRetryHistoryRun = (run: ImportRun): void => {
    pendingSafetyAction.value = 'retry_history';
    pendingSafetyRun.value = run;
    safetyConfirmOpen.value = true;
};

const executeRetryHistoryRun = async (run: ImportRun) => {
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

const requestDeleteHistoryRun = (run: ImportRun) => {
    runPendingDeletion.value = run;
    deleteDialogOpen.value = true;
};

const cancelSafetyAction = (): void => {
    safetyConfirmOpen.value = false;
    pendingSafetyAction.value = null;
    pendingSafetyRun.value = null;
};

const confirmSafetyAction = async (): Promise<void> => {
    const action = pendingSafetyAction.value;
    const run = pendingSafetyRun.value;

    safetyConfirmOpen.value = false;

    if (action === 'create_references') {
        await executeCreateAllMissingReferences();
    } else if (action === 'create_vehicles') {
        await executeCreateMissingVehicleCandidates();
    } else if (action === 'retry_history' && run) {
        await executeRetryHistoryRun(run);
    } else if (action === 'retry_active') {
        await executeRetryFailedRows();
    }

    pendingSafetyAction.value = null;
    pendingSafetyRun.value = null;
};

const deleteHistoryRun = async () => {
    const run = runPendingDeletion.value;
    if (!run || deletingRun.value) return;

    deletingRun.value = true;
    error.value = null;

    try {
        await importService.deleteRun(props.config.entity, run.id);

        if (activeImportRunId.value === run.id) {
            activeImportRunId.value = null;
            result.value = null;
            fullImportRunning.value = false;
            validationRunning.value = false;
            stopImportStatusPolling();
        }

        await loadImportRuns(false);
    } catch (e: any) {
        error.value =
            e.response?.data?.message ||
            'No se pudo eliminar la importacion del historial.';
    } finally {
        deletingRun.value = false;
        deleteDialogOpen.value = false;
        runPendingDeletion.value = null;
    }
};

const mergeImportRun = (run: any) => {
    const index = importRuns.value.findIndex((item) => item.id === run.id);
    if (index >= 0) {
        importRuns.value.splice(index, 1, {
            ...importRuns.value[index],
            ...run,
        });
        return;
    }

    importRuns.value = [run, ...importRuns.value];
};

const chunkConcurrencyForRun = (run: ImportResult | null): number => {
    if (run?.run_type === 'validation') {
        if (
            run.summary?.parallel_validation === true &&
            run.summary?.use_persisted_rows_snapshot === true &&
            run.summary?.staging_status === 'completed'
        ) {
            return IMPORT_CHUNK_CONCURRENCY;
        }

        return 1;
    }

    if (
        run?.run_type === 'import' &&
        run?.summary?.use_persisted_rows_snapshot === true
    ) {
        return IMPORT_CHUNK_CONCURRENCY;
    }

    return 1;
};

const isTerminalImportStatus = (status: string | null | undefined): boolean =>
    TERMINAL_IMPORT_STATUSES.includes(status ?? '');

const isTerminalChunkConflict = (error: any): boolean =>
    error?.response?.status === 409 &&
    typeof error.response?.data?.message === 'string' &&
    error.response.data.message.includes('ya finalizo');

const isActiveChunkStatus = (status: string | null | undefined): boolean =>
    status === 'pending' || status === 'running';

const latestProgressRun = (runs: ImportResult[]): ImportResult =>
    runs.reduce((latest, current) =>
        (current.processed_rows ?? 0) >= (latest.processed_rows ?? 0)
            ? current
            : latest,
    );

const processImportRunChunks = async (
    importRunId: number,
    concurrency: number,
): Promise<ImportResult> => {
    const responses = await Promise.allSettled(
        Array.from({ length: concurrency }, () =>
            importService.processRunChunk(props.config.entity, importRunId),
        ),
    );
    const completedRuns = responses
        .filter(
            (response): response is PromiseFulfilledResult<ImportRun> =>
                response.status === 'fulfilled',
        )
        .map(
            (response) =>
                (response.value.data ?? response.value) as ImportResult,
        );
    const terminalConflict = responses.find(
        (response): response is PromiseRejectedResult =>
            response.status === 'rejected' &&
            isTerminalChunkConflict(response.reason),
    );

    if (completedRuns.length > 0) {
        const terminalRuns = completedRuns.filter(
            (run) =>
                isTerminalImportStatus(run.status) ||
                run.chunk?.has_more === false,
        );

        if (terminalRuns.length > 0) {
            return latestProgressRun(terminalRuns);
        }
    }

    if (terminalConflict) {
        const latestResponse = await importService.getRun(
            props.config.entity,
            importRunId,
        );
        const latestRun = (latestResponse.data ??
            latestResponse) as ImportResult;

        if (
            isTerminalImportStatus(latestRun.status) ||
            latestRun.chunk?.has_more === false ||
            !isActiveChunkStatus(latestRun.status)
        ) {
            return latestRun;
        }
    }

    if (completedRuns.length > 0) {
        return latestProgressRun(completedRuns);
    }

    const firstRejected = responses.find(
        (response): response is PromiseRejectedResult =>
            response.status === 'rejected',
    );

    throw firstRejected?.reason ?? new Error('No se pudo procesar el lote.');
};

const refreshImportRun = async () => {
    if (!activeImportRunId.value) return;
    const importRunId = activeImportRunId.value;
    const response = await importService.getRun(
        props.config.entity,
        importRunId,
    );
    result.value = response.data ?? response;
    mergeImportRun(result.value);
    lastProgressRefreshAt.value = new Intl.DateTimeFormat('es-PA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(new Date());
    let status = result.value?.status;
    if (status === 'pending' || status === 'running') {
        pendingPollCount.value += 1;

        try {
            result.value = await processImportRunChunks(
                importRunId,
                chunkConcurrencyForRun(result.value),
            );
            mergeImportRun(result.value);
            status = result.value?.status;
            error.value = null;
        } catch (e: any) {
            if (isTerminalChunkConflict(e)) {
                const terminalResponse = await importService.getRun(
                    props.config.entity,
                    importRunId,
                );
                result.value = terminalResponse.data ?? terminalResponse;
                mergeImportRun(result.value);
                status = result.value?.status;
                error.value = null;
            } else {
                const processErrorData = e.response?.data?.data as
                    | Partial<ImportResult>
                    | undefined;
                if (processErrorData && typeof processErrorData === 'object') {
                    result.value = {
                        ...(result.value ?? activeHistoryRun.value ?? {}),
                        ...processErrorData,
                        id: importRunId,
                        status,
                    };
                    mergeImportRun(result.value);
                }

                error.value =
                    processErrorData?.message ||
                    e.response?.data?.message ||
                    'No se pudo procesar el siguiente lote de la importacion.';
            }
        }

        if (status === 'pending' || status === 'running') {
            return;
        }
    }

    if (
        mappingReplacementRunId.value === importRunId &&
        isTerminalImportStatus(status)
    ) {
        await restartPreviewWithCurrentMapping(importRunId);
        return;
    }

    pendingPollCount.value = 0;
    if (
        result.value?.run_type === 'validation' &&
        status === 'completed' &&
        ['pending', 'running'].includes(
            result.value?.summary?.full_revalidation_status ?? '',
        )
    ) {
        validationRunning.value = true;
        if (persistedRowsAvailable.value) {
            await loadValidatedRunRows(importRunId);
        }
        await loadImportRuns(false);
        return;
    }

    if (isTerminalImportStatus(status)) {
        fullImportRunning.value = false;
        validationRunning.value = false;
        if (result.value?.run_type === 'validation') {
            if (status === 'completed') {
                await applyCompletedValidationRows();
            }
        } else if (status === 'completed' || status === 'failed') {
            if (status === 'completed') {
                clearStoredPreviewDraft();
            }
            if (result.value) {
                notifyImportComplete(result.value);
            }
        }
        await loadImportRuns(false);
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
        refreshImportRun()
            .catch(() => {
                error.value =
                    'No se pudo actualizar el avance de la importacion.';
                fullImportRunning.value = false;
                validationRunning.value = false;
                stopImportStatusPolling();
            })
            .finally(() => {
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
    window.removeEventListener('keydown', handleImporterKeydown);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    removeInertiaBeforeListener?.();
    removeInertiaBeforeListener = null;
});

const runTypeLabel = (run: any): string => {
    if (run.preview_async) return 'Preview';
    if (run.run_type === 'validation') return 'Validacion';
    if (run.mode === 'retry_failed') return 'Reintento';
    return 'Importacion';
};

const runWaitingForWorker = (
    run: WorkerAwareRun | null | undefined,
): boolean => {
    return run?.waiting_for_worker === true || run?.worker_required === true;
};

const runWorkerMessage = (
    run: WorkerAwareRun | null | undefined,
): string | null => {
    if (!runWaitingForWorker(run)) return null;

    return (
        run?.worker_message ||
        'El proceso requiere una accion manual antes de continuar.'
    );
};

const statusLabel = (status: string, run?: WorkerAwareRun): string => {
    if (runWaitingForWorker({ ...(run ?? {}), status })) {
        return 'Requiere accion';
    }

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

const statusClass = (status: string, run?: WorkerAwareRun): string => {
    if (runWaitingForWorker({ ...(run ?? {}), status })) {
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
    }

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

const rowMatchesPreviewFilter = (row: any): boolean => {
    if (activePreviewFilter.value === 'all') return true;
    if (activePreviewFilter.value === 'errors') return !row.__valid;
    if (activePreviewFilter.value === 'warnings') {
        return (row.__warnings ?? []).length > 0;
    }
    if (activePreviewFilter.value === 'duplicates') {
        return (row.__duplicate_conflicts ?? []).length > 0;
    }

    return row.__action_type === activePreviewFilter.value;
};

const rowMatchesSearch = (row: ImportRow): boolean => {
    const term = previewSearch.value.trim().toLowerCase();
    if (!term) return true;

    return ['nombre', 'name', 'sku', 'system_id', 'brand', 'categoria'].some(
        (key) =>
            String(row[key] ?? '')
                .toLowerCase()
                .includes(term),
    );
};

const toggleProductGroup = (groupKey: string) => {
    const expanded = new Set(expandedProductGroups.value);
    if (expanded.has(groupKey)) {
        expanded.delete(groupKey);
    } else {
        expanded.add(groupKey);
    }
    expandedProductGroups.value = expanded;
};

const isProductGroupExpanded = (groupKey: string): boolean =>
    expandedProductGroups.value.has(groupKey);

const productGroupTitle = (group: any): string =>
    group.metadata?.product_name || group.primaryRow?.nombre || 'Sin nombre';

const productGroupOriginalName = (group: any): string =>
    group.metadata?.original_name || group.primaryRow?.__original_name || '';

const productGroupAttributes = (group: any): any[] =>
    group.primaryRow?.__attributes ?? [];

const setGroupBaseValue = (group: any, columnKey: string, value: any) => {
    if (validatedPreviewReadOnly.value) return;

    group.rows.forEach((row: any) => {
        commitPreviewCellEdit(row.__preview_index, columnKey, value);
    });
};

const eventTargetValue = (event: Event): string =>
    (event.target as HTMLInputElement).value;

const eventTargetNumberValue = (event: Event): number | string => {
    const value = (event.target as HTMLInputElement).value;

    return value === '' ? '' : Number(value);
};

const editableColumnKeys = computed(() =>
    editableColumns.value.map((column) => column.key),
);

const focusImportCell = async (rowIndex: number, columnKey: string) => {
    const rowPosition = filteredEditedRows.value.findIndex(
        (row) => row.__preview_index === rowIndex,
    );
    if (rowPosition === -1) return;

    const nextPage = Math.floor(rowPosition / previewPerPage.value) + 1;
    if (nextPage !== previewPage.value) {
        previewPage.value = nextPage;
        await nextTick();
    }

    const selector = `[data-import-cell="${rowIndex}:${columnKey}"]`;
    const element = importerRootRef.value?.querySelector<HTMLElement>(selector);
    element?.scrollIntoView({
        block: 'center',
        inline: 'nearest',
    });
    element?.focus();
};

const moveCellFocus = async (
    row: ImportRow,
    columnKey: string,
    direction: 'next' | 'previous' | 'down' | 'up',
) => {
    const columns = editableColumnKeys.value;
    const rowPosition = filteredEditedRows.value.findIndex(
        (item) => item.__preview_index === row.__preview_index,
    );
    const columnPosition = columns.indexOf(columnKey);
    if (rowPosition === -1 || columnPosition === -1) return;

    let nextRowPosition = rowPosition;
    let nextColumnPosition = columnPosition;

    if (direction === 'next') {
        nextColumnPosition++;
        if (nextColumnPosition >= columns.length) {
            nextColumnPosition = 0;
            nextRowPosition++;
        }
    } else if (direction === 'previous') {
        nextColumnPosition--;
        if (nextColumnPosition < 0) {
            nextColumnPosition = columns.length - 1;
            nextRowPosition--;
        }
    } else if (direction === 'down') {
        nextRowPosition++;
    } else if (direction === 'up') {
        nextRowPosition--;
    }

    const nextRow = filteredEditedRows.value[nextRowPosition];
    const nextColumn = columns[nextColumnPosition];
    if (!nextRow || !nextColumn) return;

    await focusImportCell(nextRow.__preview_index, nextColumn);
};

const handleCellKeydown = async (
    event: KeyboardEvent,
    row: ImportRow,
    columnKey: string,
) => {
    if (fullValidationReportActive.value) return;

    if (event.key === 'Tab') {
        event.preventDefault();
        await moveCellFocus(
            row,
            columnKey,
            event.shiftKey ? 'previous' : 'next',
        );
    }

    if (event.key === 'Enter') {
        event.preventDefault();
        await moveCellFocus(row, columnKey, event.shiftKey ? 'up' : 'down');
    }
};

const handleImporterKeydown = (event: KeyboardEvent) => {
    const target = event.target as Node | null;
    if (!target || !importerRootRef.value?.contains(target)) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
            redoCellEdit();
        } else {
            undoCellEdit();
        }
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redoCellEdit();
    }
};

const onGroupBaseSearchableChange = async (
    group: any,
    col: any,
    newValue: any,
) => {
    for (const row of group.rows) {
        await onSearchableChange(col, row.__preview_index, newValue);
    }
};

const groupActionCount = (group: any, actionType: string): number => {
    if (actionType === 'variants') {
        return group.metadata?.variant_count ?? group.rows.length;
    }

    return getActionCount(group.primaryRow, actionType);
};

const formatProgressRefresh = (): string => {
    if (!lastProgressRefreshAt.value) return 'Sin refresco reciente';

    return `Actualizado ${lastProgressRefreshAt.value}`;
};

const openImportHistoryPanel = () => {
    importHistoryExpanded.value = true;
};

const actionTypeLabel = (actionType: string | undefined): string => {
    const labels: Record<string, string> = {
        create: 'Crea',
        update: 'Actualiza',
        unchanged: 'Sin cambios',
        conflict: 'Conflicto',
        invalid: 'Invalida',
    };

    return labels[actionType ?? ''] ?? 'Revisar';
};

const actionTypeClass = (actionType: string | undefined): string => {
    if (actionType === 'create') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300';
    }
    if (actionType === 'update') {
        return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300';
    }
    if (actionType === 'unchanged') {
        return 'border-gray-200 bg-gray-50 text-gray-600 dark:border-border dark:bg-muted/30 dark:text-gray-300';
    }
    if (actionType === 'conflict') {
        return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300';
    }

    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300';
};

const summaryToneClass = (tone: string): string => {
    if (tone === 'emerald') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200';
    }

    if (tone === 'red') {
        return 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/20 dark:text-red-200';
    }

    if (tone === 'amber') {
        return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200';
    }

    if (tone === 'blue') {
        return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-200';
    }

    return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-border dark:bg-muted/30 dark:text-gray-200';
};

const rowChangeSummary = (row: any): string => {
    const changes = row.__change_preview ?? [];
    if (!Array.isArray(changes) || changes.length === 0) {
        return row.__action_type === 'unchanged'
            ? 'No cambia datos existentes'
            : '';
    }

    return changes
        .slice(0, 2)
        .map((change: any) => change.label ?? change.field)
        .join(', ');
};

const formatChangeValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') {
        return 'Sin dato';
    }

    return String(value);
};

const normalizedChangeValue = (value: unknown): string =>
    String(value ?? '').trim();

const changeValueClass = (value: unknown): string =>
    normalizedChangeValue(value) === ''
        ? 'text-gray-400 dark:text-gray-500'
        : 'text-gray-800 dark:text-gray-100';

const changeRowClass = (change: any): string => {
    if (normalizedChangeValue(change.current) === '') {
        return 'bg-emerald-50/60 dark:bg-emerald-950/10';
    }

    if (normalizedChangeValue(change.imported) === '') {
        return 'bg-amber-50/60 dark:bg-amber-950/10';
    }

    return 'bg-blue-50/50 dark:bg-blue-950/10';
};

const hasChangeDetails = (row: any): boolean =>
    (Array.isArray(row.__change_preview) && row.__change_preview.length > 0) ||
    (Array.isArray(row.__conflicts) && row.__conflicts.length > 0);

const toggleChangeDetails = (row: any) => {
    const index = Number(row.__preview_index);
    expandedChangeRow.value = expandedChangeRow.value === index ? null : index;
};

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};
</script>

<template>
    <div ref="importerRootRef" :class="importerShellClass">
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

        <div
            class="sticky top-0 z-20 mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
        >
            <div
                class="flex items-center justify-between"
                role="list"
                aria-label="Estado del flujo de importacion"
            >
                <template
                    v-for="(step, idx) in stepperSteps.filter(
                        (s) => s.visible !== false,
                    )"
                    :key="step.number"
                >
                    <div
                        class="flex items-center gap-3"
                        role="listitem"
                        :aria-current="
                            currentStep === step.number ? 'step' : undefined
                        "
                    >
                        <div
                            class="flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all"
                            :class="
                                currentStep > step.number
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : currentStep === step.number
                                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                                      : 'border-gray-300 bg-white text-gray-400 dark:border-border dark:bg-muted dark:text-gray-500'
                            "
                        >
                            <Check
                                v-if="currentStep > step.number"
                                class="h-5 w-5"
                            />
                            <component v-else :is="step.icon" class="h-5 w-5" />
                        </div>
                        <div>
                            <p
                                class="text-sm font-semibold"
                                :class="
                                    currentStep >= step.number
                                        ? 'text-gray-900 dark:text-white'
                                        : 'text-gray-400 dark:text-gray-500'
                                "
                            >
                                {{ step.label }}
                            </p>
                            <p
                                v-if="
                                    step.number === 4 &&
                                    importDuration &&
                                    currentStep === 4
                                "
                                class="text-xs text-gray-500 dark:text-gray-400"
                            >
                                Duración: {{ importDuration }}
                            </p>
                        </div>
                    </div>
                    <div
                        v-if="
                            idx <
                            stepperSteps.filter((s) => s.visible !== false)
                                .length -
                                1
                        "
                        class="mx-4 h-0.5 flex-1 rounded"
                        :class="
                            currentStep > step.number
                                ? 'bg-emerald-500'
                                : 'bg-gray-200 dark:bg-border'
                        "
                    ></div>
                </template>
            </div>
        </div>

        <!-- Step 1: File Upload -->
        <ImportFileUploader>
            <h2
                class="mb-4 text-lg font-semibold text-gray-900 dark:text-white"
            >
                1. Seleccionar archivo
            </h2>

            <div
                @dragover.prevent="dragOver = true"
                @dragleave="dragOver = false"
                @drop.prevent="handleDrop"
                role="button"
                tabindex="0"
                aria-label="Seleccionar archivo de importacion de productos"
                :class="[
                    'relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all',
                    dragOver
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
                        : file
                          ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-600 dark:bg-emerald-900/10'
                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:border-border dark:hover:bg-muted/30',
                ]"
                @click="fileInputRef?.click()"
                @keydown.enter.prevent="fileInputRef?.click()"
                @keydown.space.prevent="fileInputRef?.click()"
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
                    :disabled="!hasFile || metadataLoading || previewLoading"
                    @click="() => previewImport()"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
                >
                    <Eye class="h-4 w-4" />
                    {{
                        metadataLoading
                            ? 'Leyendo columnas...'
                            : previewLoading
                              ? 'Previsualizando...'
                              : 'Previsualizar'
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
                    :aria-describedby="
                        fullFileImportBlockedReason
                            ? 'full-file-import-blocked-reason'
                            : undefined
                    "
                    @click="requestImportConfirmation('file')"
                    class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <UploadCloud class="h-4 w-4" />
                    {{
                        fullImportRunning
                            ? 'Importando archivo...'
                            : 'Importar filas validas'
                    }}
                </button>

                <p
                    v-if="config.fullFileImport && fullFileImportBlockedReason"
                    id="full-file-import-blocked-reason"
                    class="basis-full text-xs font-medium text-red-700 dark:text-red-300"
                >
                    {{ fullFileImportBlockedReason }}
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
                v-if="previewLoading"
                role="status"
                aria-live="polite"
                class="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-xs text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/20 dark:text-indigo-100"
            >
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p class="text-sm font-semibold">
                            Generando preview operacional
                        </p>
                        <p class="mt-1 text-indigo-700 dark:text-indigo-300">
                            Detectando hoja, aplicando mapeo y clasificando
                            filas antes de mostrar la tabla.
                        </p>
                        <p
                            v-if="uploadProgressLabel"
                            class="mt-1 font-medium text-indigo-800 dark:text-indigo-200"
                        >
                            {{ uploadProgressLabel }}
                        </p>
                    </div>
                    <RefreshCw class="h-5 w-5 animate-spin" />
                </div>
                <div class="mt-4 grid gap-2 sm:grid-cols-3">
                    <div
                        class="rounded-md border border-indigo-200 bg-white/80 p-3 dark:border-indigo-800 dark:bg-background/50"
                    >
                        <p class="font-semibold">Archivo</p>
                        <p class="mt-1 truncate">
                            {{ file?.name ?? 'Seleccion pendiente' }}
                        </p>
                    </div>
                    <div
                        class="rounded-md border border-indigo-200 bg-white/80 p-3 dark:border-indigo-800 dark:bg-background/50"
                    >
                        <p class="font-semibold">Hoja y mapeo</p>
                        <div
                            class="mt-2 h-2 rounded bg-indigo-100 dark:bg-indigo-900/40"
                        ></div>
                        <div
                            class="mt-2 h-2 w-2/3 rounded bg-indigo-100 dark:bg-indigo-900/40"
                        ></div>
                    </div>
                    <div
                        class="rounded-md border border-indigo-200 bg-white/80 p-3 dark:border-indigo-800 dark:bg-background/50"
                    >
                        <p class="font-semibold">Validacion</p>
                        <div
                            class="mt-2 h-2 rounded bg-indigo-100 dark:bg-indigo-900/40"
                        ></div>
                        <div
                            class="mt-2 h-2 w-1/2 rounded bg-indigo-100 dark:bg-indigo-900/40"
                        ></div>
                    </div>
                </div>
            </div>

            <div
                v-else-if="fullImportRunning && uploadProgressLabel"
                role="status"
                aria-live="polite"
                class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-100"
            >
                <p class="text-sm font-semibold">Subiendo archivo validado</p>
                <p class="mt-1">{{ uploadProgressLabel }}</p>
                <div
                    class="mt-3 h-2 overflow-hidden rounded bg-emerald-100 dark:bg-emerald-900/40"
                >
                    <div
                        class="h-full rounded bg-emerald-600 transition-all"
                        :style="{ width: `${uploadProgress ?? 0}%` }"
                    ></div>
                </div>
            </div>

            <ImportSheetMapper
                :visible="
                    hasMultipleSheets ||
                    shouldShowMappingTransparency ||
                    (config.fullFileImport &&
                        advancedImportControlsVisible &&
                        Boolean(
                            usableImportProfiles.length ||
                            detectedColumns.length,
                        ))
                "
            >
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
                            :disabled="
                                metadataLoading ||
                                previewLoading ||
                                fullImportRunning
                            "
                            class="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none disabled:opacity-60 dark:border-amber-700 dark:bg-background dark:text-white"
                            @change="handleSheetChange"
                        >
                            <option
                                v-for="sheet in importSheets"
                                :key="sheet.index"
                                :value="sheet.index"
                            >
                                {{ sheet.name }} - {{ sheet.row_count }} filas -
                                {{ sheet.matched_headers?.length ?? 0 }}
                                columnas
                                {{
                                    sheet.is_recommended ? ' - recomendada' : ''
                                }}
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
                    v-if="shouldShowMappingTransparency"
                    class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-border dark:bg-background"
                >
                    <div
                        class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-border"
                    >
                        <div>
                            <p
                                class="text-sm font-semibold text-slate-900 dark:text-white"
                            >
                                {{ mappingContextLabel }}
                            </p>
                            <p
                                class="mt-1 text-xs text-slate-500 dark:text-gray-400"
                            >
                                Revisa que cada columna apunte al campo correcto
                                antes de importar. Este es el mapping actual.
                            </p>
                        </div>
                        <div class="flex flex-wrap gap-2 text-xs">
                            <span
                                class="rounded-md bg-emerald-100 px-2 py-1 font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                            >
                                {{ mappingSummary.mapped }} mapeadas
                            </span>
                            <span
                                class="rounded-md bg-gray-200 px-2 py-1 font-medium text-gray-700 dark:bg-muted dark:text-gray-200"
                            >
                                {{ mappingSummary.ignored }} ignoradas
                            </span>
                            <span
                                v-if="mappingSummary.requiredMissing"
                                class="rounded-md bg-red-100 px-2 py-1 font-medium text-red-800 dark:bg-red-900/30 dark:text-red-200"
                            >
                                {{ mappingSummary.requiredMissing }} requeridos
                                faltantes
                            </span>
                        </div>
                    </div>

                    <div
                        v-if="detectedColumns.length"
                        class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
                    >
                        <div
                            v-for="column in mappedDetectedColumns.slice(0, 12)"
                            :key="`mapping-${column.key}`"
                            class="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-border dark:bg-card"
                        >
                            <span
                                class="min-w-0 flex-1 truncate font-medium text-slate-700 dark:text-gray-200"
                                :title="column.label"
                            >
                                {{ column.label }}
                            </span>
                            <ArrowRight
                                class="h-3.5 w-3.5 shrink-0 text-slate-400"
                            />
                            <span
                                class="shrink-0 rounded px-2 py-0.5 font-semibold"
                                :class="
                                    column.ignored
                                        ? 'bg-gray-100 text-gray-500 dark:bg-muted dark:text-gray-400'
                                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                                "
                            >
                                {{
                                    column.ignored
                                        ? 'Ignorar'
                                        : column.mappedLabel
                                }}
                            </span>
                        </div>
                        <div
                            v-if="mappedDetectedColumns.length > 12"
                            class="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 dark:border-border dark:text-gray-400"
                        >
                            +{{ mappedDetectedColumns.length - 12 }} columnas
                            mas
                        </div>
                    </div>
                    <div
                        v-else
                        class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
                    >
                        <div
                            v-for="index in 6"
                            :key="`mapping-skeleton-${index}`"
                            class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-border dark:bg-card"
                        >
                            <div
                                class="h-2 rounded bg-slate-200 dark:bg-muted"
                            ></div>
                            <div
                                class="mt-2 h-2 w-2/3 rounded bg-slate-100 dark:bg-muted/70"
                            ></div>
                        </div>
                    </div>
                    <p
                        v-if="missingRequiredMapping.length"
                        class="mt-3 text-xs font-medium text-red-700 dark:text-red-300"
                    >
                        Falta mapear:
                        {{
                            missingRequiredMapping
                                .map((field) => mappingTargetLabel(field))
                                .join(', ')
                        }}
                    </p>
                </div>

                <div
                    v-if="
                        config.fullFileImport &&
                        advancedImportControlsVisible &&
                        (usableImportProfiles.length || detectedColumns.length)
                    "
                    class="mt-4 grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 lg:grid-cols-2 dark:border-border dark:bg-background"
                >
                    <div class="min-w-0">
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
                                    v-for="profile in usableImportProfiles"
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
                            @click="openProfileDialog"
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
                        <div
                            class="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1"
                        >
                            <div
                                v-for="field in productMappingFields"
                                :key="field.key"
                                class="grid grid-cols-[minmax(0,1fr),minmax(12rem,18rem)] items-center gap-2 text-xs"
                            >
                                <div class="min-w-0">
                                    <span
                                        class="truncate font-medium text-gray-700 dark:text-gray-200"
                                    >
                                        {{ field.label }}
                                        <span
                                            v-if="field.required"
                                            class="text-red-500"
                                            >*</span
                                        >
                                    </span>
                                    <p
                                        class="truncate text-[11px] text-gray-400 dark:text-gray-500"
                                    >
                                        {{ field.key }}
                                    </p>
                                </div>
                                <select
                                    :value="sourceColumnForTarget(field.key)"
                                    class="rounded border border-gray-300 bg-white px-2 py-1 dark:border-border dark:bg-card dark:text-white"
                                    :disabled="
                                        metadataLoading ||
                                        previewLoading ||
                                        mappingReplacementRunId !== null ||
                                        operationalMappingApplying ||
                                        persistedRowsRevalidationActive
                                    "
                                    @change="
                                        updateTargetFieldMapping(
                                            field.key,
                                            ($event.target as HTMLSelectElement)
                                                .value,
                                        )
                                    "
                                >
                                    <option value="">Sin columna</option>
                                    <option
                                        v-for="column in detectedColumns"
                                        :key="column.key"
                                        :value="column.key"
                                    >
                                        {{ column.label }}
                                    </option>
                                </select>
                            </div>
                        </div>
                        <p
                            class="mt-2 text-xs text-gray-500 dark:text-gray-400"
                        >
                            Requeridos:
                            {{ requiredFields.join(', ') || 'Ninguno' }}
                        </p>
                        <div
                            v-if="mappingPreviewStale"
                            class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-100"
                        >
                            <div
                                class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <span>
                                    {{
                                        mappingReplacementRunId
                                            ? 'Cancelando validacion anterior para aplicar el nuevo mapping.'
                                            : 'El mapping cambio. Actualiza el preview para ver los datos remapeados.'
                                    }}
                                </span>
                                <button
                                    type="button"
                                    class="inline-flex items-center justify-center rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
                                    :disabled="
                                        metadataLoading ||
                                        previewLoading ||
                                        mappingReplacementRunId !== null
                                    "
                                    @click="refreshPreviewWithCurrentMapping"
                                >
                                    {{
                                        mappingReplacementRunId
                                            ? 'Esperando cancelacion...'
                                            : 'Actualizar preview con mapping'
                                    }}
                                </button>
                            </div>
                        </div>
                        <div
                            v-else-if="
                                operationalMappingApplying ||
                                persistedRowsRevalidationActive
                            "
                            class="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-100"
                        >
                            <div class="font-medium">
                                Aplicando mapping operativo y revalidando
                                filas...
                            </div>
                            <div
                                v-if="rowsRevalidationProgressLabel"
                                class="mt-2"
                            >
                                <div
                                    class="h-1.5 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/50"
                                >
                                    <div
                                        class="h-full rounded-full bg-blue-500 transition-all"
                                        :style="{
                                            width: `${rowsRevalidationProgressPercent}%`,
                                        }"
                                    ></div>
                                </div>
                                <p class="mt-1">
                                    {{ rowsRevalidationProgressLabel }}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div
                        v-else-if="config.fullFileImport && hasPreview"
                        class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-100"
                    >
                        No se detectaron columnas del archivo. Vuelve a
                        previsualizar el CSV para cargar los encabezados reales.
                    </div>
                </div>
            </ImportSheetMapper>
        </ImportFileUploader>

        <section
            v-if="activeImportContext"
            class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-100"
        >
            <div
                class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
                <div class="min-w-0">
                    <p class="font-semibold">
                        Importacion #{{ activeImportContext.id }} abierta
                    </p>
                    <p class="mt-1 truncate text-blue-800 dark:text-blue-200">
                        {{ activeImportContext.filename }} ·
                        {{ activeImportContext.type }} ·
                        {{ activeImportContext.status }}
                    </p>
                </div>
                <button
                    type="button"
                    class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-800 transition hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100"
                    @click="resetPreview"
                >
                    <Plus class="h-3.5 w-3.5" />
                    Nueva importacion
                </button>
            </div>
        </section>

        <ImportHistoryPanel v-if="config.fullFileImport">
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
                    :aria-label="
                        importHistoryExpanded
                            ? 'Ocultar historial de importaciones'
                            : 'Mostrar historial de importaciones'
                    "
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
                    aria-label="Actualizar historial de importaciones"
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
                    <caption class="sr-only">
                        Historial de importaciones de productos
                    </caption>
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
                                <p
                                    v-if="run.action_counts"
                                    class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                                >
                                    {{ run.action_counts.create ?? 0 }} crea /
                                    {{ run.action_counts.update ?? 0 }}
                                    actualiza /
                                    {{ run.unchanged_count ?? 0 }} sin cambios
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
                                    :class="statusClass(run.status, run)"
                                >
                                    {{ statusLabel(run.status, run) }}
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
                                        {{ runProgressPercent(run) }}% ·
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
                                        <span
                                            v-if="
                                                Number(
                                                    run.conflict_count ?? 0,
                                                ) > 0
                                            "
                                            class="text-amber-600 dark:text-amber-300"
                                        >
                                            - {{ run.conflict_count }}
                                            conflictos
                                        </span>
                                    </p>
                                    <p
                                        v-if="runWorkerMessage(run)"
                                        class="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300"
                                    >
                                        {{ runWorkerMessage(run) }}
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
                                        :aria-label="`Abrir importacion ${run.id}`"
                                        @click="openImportRun(run)"
                                        class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/30"
                                    >
                                        <Eye class="h-3.5 w-3.5" />
                                        Abrir
                                    </button>
                                    <button
                                        v-if="run.has_source_file"
                                        type="button"
                                        :aria-label="`Descargar archivo original de importacion ${run.id}`"
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
                                        :aria-label="`Descargar errores de importacion ${run.id}`"
                                        @click="downloadRunErrors(run.id)"
                                        class="inline-flex items-center gap-1 rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/20"
                                    >
                                        <Download class="h-3.5 w-3.5" />
                                        Errores
                                    </button>
                                    <button
                                        v-if="run.can_cancel"
                                        type="button"
                                        :aria-label="`Cancelar importacion ${run.id}`"
                                        @click="cancelHistoryRun(run)"
                                        class="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/20"
                                    >
                                        <XIcon class="h-3.5 w-3.5" />
                                        Cancelar
                                    </button>
                                    <button
                                        v-if="run.can_retry_failed"
                                        type="button"
                                        :aria-label="`Reintentar filas fallidas de importacion ${run.id}`"
                                        @click="requestRetryHistoryRun(run)"
                                        class="inline-flex items-center gap-1 rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/20"
                                    >
                                        <RotateCcw class="h-3.5 w-3.5" />
                                        Reintentar
                                    </button>
                                    <button
                                        v-if="run.can_delete"
                                        type="button"
                                        :aria-label="`Eliminar importacion ${run.id} del historial`"
                                        @click="requestDeleteHistoryRun(run)"
                                        class="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/20"
                                    >
                                        <Trash2 class="h-3.5 w-3.5" />
                                        Eliminar
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </ImportHistoryPanel>

        <!-- Error message -->
        <div
            v-if="error"
            class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
        >
            <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />{{ error }}
        </div>

        <!-- Step 2: Preview Editable -->
        <ImportPreviewTable v-if="hasPreview" :shell-class="previewShellClass">
            <div
                class="flex shrink-0 flex-col gap-3 border-b border-gray-200 bg-gray-50 px-4 sm:flex-row sm:items-center sm:justify-between dark:border-border dark:bg-background"
                :class="previewFullscreen ? 'py-2' : 'py-3'"
            >
                <div class="min-w-0">
                    <h2
                        class="text-base font-semibold text-gray-900 dark:text-white"
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
                    v-if="!previewFullscreen"
                    class="text-xs text-gray-500 dark:text-gray-400"
                >
                    {{ previewModeMessage }}
                </p>
                <div class="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition"
                        :class="
                            hasPreviewDiagnostics
                                ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-border dark:bg-card dark:text-gray-300'
                        "
                        @click="diagnosticsExpanded = !diagnosticsExpanded"
                    >
                        Diagnostico
                        <span
                            v-if="hasPreviewDiagnostics"
                            class="rounded bg-white/70 px-1.5 py-0.5 text-[10px] dark:bg-black/20"
                        >
                            revisar
                        </span>
                        <ChevronDown
                            class="h-3.5 w-3.5 transition-transform"
                            :class="{ 'rotate-180': diagnosticsExpanded }"
                        />
                    </button>
                </div>
            </div>

            <div
                v-if="!previewFullscreen"
                class="shrink-0 border-b border-gray-200 bg-white px-4 py-3 dark:border-border dark:bg-card"
            >
                <div class="grid gap-2 sm:grid-cols-4">
                    <div
                        v-for="item in actionableSummary"
                        :key="item.label"
                        class="rounded-md border px-3 py-2"
                        :class="summaryToneClass(item.tone)"
                    >
                        <p class="text-[11px] font-medium uppercase">
                            {{ item.label }}
                        </p>
                        <p class="mt-1 text-lg font-semibold">
                            {{ item.value }}
                        </p>
                    </div>
                </div>
                <p class="mt-3 text-xs text-gray-600 dark:text-gray-300">
                    <span class="font-semibold">Siguiente accion:</span>
                    {{ actionableRecommendation }}
                </p>
            </div>

            <ImportDiagnosticsPanel :expanded="diagnosticsExpanded">
                <div
                    v-if="fullValidationReportActive"
                    class="border-b border-sky-200 bg-sky-50 px-6 py-3 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950/20 dark:text-sky-200"
                >
                    {{ previewModeMessage }}
                    <span v-if="validationRowsServerMeta">
                        Mostrando {{ editedRows.length }} de
                        {{ validationRowsServerMeta.total }} filas validadas.
                    </span>
                </div>

                <div
                    v-if="previewSummary"
                    class="grid gap-3 border-b border-gray-200 bg-white px-6 py-3 text-xs sm:grid-cols-6 dark:border-border dark:bg-card"
                >
                    <div>
                        <p
                            class="font-semibold text-gray-700 dark:text-gray-200"
                        >
                            Acciones
                        </p>
                        <p class="text-gray-500 dark:text-gray-400">
                            {{ actionCounts.create ?? 0 }} crea /
                            {{ actionCounts.update ?? 0 }} actualiza
                        </p>
                    </div>
                    <div>
                        <p
                            class="font-semibold text-gray-700 dark:text-gray-200"
                        >
                            Atencion
                        </p>
                        <p class="text-gray-500 dark:text-gray-400">
                            {{ conflictCount }} conflictos /
                            {{ errorCount }} errores
                        </p>
                    </div>
                    <div>
                        <p
                            class="font-semibold text-gray-700 dark:text-gray-200"
                        >
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
                        <p
                            class="font-semibold text-gray-700 dark:text-gray-200"
                        >
                            Categorias faltantes
                        </p>
                        <p class="text-gray-500 dark:text-gray-400">
                            {{
                                previewSummary.missing_categories?.length
                                    ? previewSummary.missing_categories.join(
                                          ', ',
                                      )
                                    : 'Ninguna'
                            }}
                        </p>
                    </div>
                    <div>
                        <p
                            class="font-semibold text-gray-700 dark:text-gray-200"
                        >
                            Atributos tecnicos
                        </p>
                        <p class="text-gray-500 dark:text-gray-400">
                            {{
                                previewSummary.detected_attributes?.length
                                    ? previewSummary.detected_attributes.join(
                                          ', ',
                                      )
                                    : 'Ninguno'
                            }}
                        </p>
                    </div>
                    <div>
                        <p
                            class="font-semibold text-gray-700 dark:text-gray-200"
                        >
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
                    v-if="visibleReferenceCount"
                    class="border-b border-red-200 bg-red-50 px-6 py-3 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/20 dark:text-red-200"
                >
                    <div
                        class="mb-2 flex flex-wrap items-center justify-between gap-2"
                    >
                        <div class="font-semibold">
                            <template v-if="persistedRowsRevalidationActive">
                                Revalidando referencias con los datos maestros
                                actuales. Esta lista puede cambiar al terminar.
                            </template>
                            <template v-else>
                                Referencias faltantes. Puedes crear estas
                                categorias o marcas para habilitar las filas
                                excluidas. Esto crea datos maestros; no importa
                                productos todavia.
                            </template>
                        </div>
                        <div
                            v-if="
                                persistedRowsRevalidationActive &&
                                rowsRevalidationProgressLabel
                            "
                            class="flex min-w-[220px] flex-1 flex-col gap-1 sm:max-w-xs"
                        >
                            <div
                                class="h-1.5 overflow-hidden rounded-full bg-red-100 dark:bg-red-900/40"
                            >
                                <div
                                    class="h-full rounded-full bg-red-600 transition-all dark:bg-red-400"
                                    :style="{
                                        width: `${rowsRevalidationProgressPercent}%`,
                                    }"
                                ></div>
                            </div>
                            <span class="text-[11px] font-medium">
                                {{ rowsRevalidationProgressLabel }}
                            </span>
                        </div>
                        <button
                            type="button"
                            class="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2 py-1 font-medium text-red-700 transition hover:bg-red-100 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100"
                            @click="diagnosticsExpanded = false"
                        >
                            <ChevronDown class="h-3.5 w-3.5 rotate-180" />
                            Minimizar referencias
                        </button>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button
                            v-if="visibleReferenceCount > 1"
                            type="button"
                            @click="requestCreateAllMissingReferences"
                            :disabled="
                                creatingAllReferences ||
                                referenceActionsDisabled
                            "
                            class="inline-flex items-center gap-1 rounded-md bg-red-700 px-2 py-1 font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Plus class="h-3.5 w-3.5" />
                            {{
                                creatingAllReferences
                                    ? 'Creando...'
                                    : 'Crear todas'
                            }}
                        </button>
                        <button
                            v-for="brandName in missingBrandReferences"
                            :key="brandName"
                            type="button"
                            @click="createMissingBrand(brandName)"
                            :disabled="
                                creatingBrands[brandName] ||
                                referenceActionsDisabled
                            "
                            class="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2 py-1 font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100"
                        >
                            <Plus class="h-3.5 w-3.5" />
                            {{
                                creatingBrands[brandName]
                                    ? 'Creando...'
                                    : `Crear ${brandName}`
                            }}
                        </button>
                        <button
                            v-for="categoryName in previewSummary?.missing_categories ??
                            []"
                            :key="`category-${categoryName}`"
                            type="button"
                            @click="
                                createMissingCategoryAndRefresh(categoryName)
                            "
                            :disabled="referenceActionsDisabled"
                            class="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2 py-1 font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100"
                        >
                            <Plus class="h-3.5 w-3.5" />
                            Crear {{ categoryName }}
                        </button>
                    </div>
                </div>

                <div
                    v-if="missingVehicleCandidates.length"
                    class="border-b border-amber-200 bg-amber-50 px-6 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200"
                >
                    <div
                        class="flex flex-wrap items-center justify-between gap-2"
                    >
                        <div class="min-w-0">
                            <p class="font-semibold">
                                Vehiculos detectados pendientes de crear
                            </p>
                            <p
                                class="mt-1 truncate text-amber-800 dark:text-amber-200"
                            >
                                {{
                                    missingVehicleCandidates
                                        .slice(0, 3)
                                        .map(
                                            (candidate) =>
                                                candidate.label ||
                                                [
                                                    candidate.make,
                                                    candidate.model,
                                                    candidate.chassis,
                                                    candidate.engine,
                                                ]
                                                    .filter(Boolean)
                                                    .join(' '),
                                        )
                                        .join(', ')
                                }}
                                <span
                                    v-if="missingVehicleCandidates.length > 3"
                                >
                                    +{{ missingVehicleCandidates.length - 3 }}
                                </span>
                            </p>
                        </div>
                        <button
                            type="button"
                            @click="requestCreateMissingVehicleCandidates"
                            :disabled="
                                creatingVehicleCandidates ||
                                referenceActionsDisabled
                            "
                            class="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
                        >
                            <Car class="h-3.5 w-3.5" />
                            {{
                                creatingVehicleCandidates
                                    ? 'Creando...'
                                    : `Crear vehiculos detectados (${missingVehicleCandidates.length})`
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
                        v-for="suggestion in previewSummary.suggestions
                            .categories ?? []"
                        :key="suggestion.value"
                        class="mr-3"
                    >
                        {{ suggestion.value }} -> {{ suggestion.suggestion }}
                    </span>
                    <span
                        v-for="suggestion in previewSummary.suggestions
                            .brands ?? []"
                        :key="`brand-${suggestion.value}`"
                        class="mr-3"
                    >
                        {{ suggestion.value }} -> {{ suggestion.suggestion }}
                    </span>
                </div>
            </ImportDiagnosticsPanel>

            <div
                v-if="hasCriticalPreviewIssues"
                class="flex shrink-0 flex-col gap-3 border-b border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900 sm:flex-row sm:items-center sm:justify-between dark:border-red-800 dark:bg-red-950/20 dark:text-red-100"
            >
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <AlertCircle class="h-4 w-4 shrink-0" />
                        <span class="font-semibold">
                            Filas excluidas de la importacion
                        </span>
                        <span
                            v-for="item in criticalPreviewIssueItems"
                            :key="item.key"
                            class="rounded-md bg-white px-2 py-0.5 font-medium text-red-800 dark:bg-red-950/50 dark:text-red-100"
                        >
                            {{ item.count }} {{ item.label.toLowerCase() }}
                        </span>
                    </div>
                    <div
                        v-if="criticalPreviewExamples.length"
                        class="mt-2 flex flex-wrap gap-2 text-red-800 dark:text-red-200"
                    >
                        <span
                            v-for="example in criticalPreviewExamples"
                            :key="example"
                            class="max-w-[28rem] truncate rounded border border-red-200 bg-white/70 px-2 py-0.5 dark:border-red-800 dark:bg-red-950/40"
                            :title="example"
                        >
                            {{ example }}
                        </span>
                    </div>
                </div>
                <div class="flex shrink-0 flex-wrap gap-2">
                    <button
                        v-for="item in criticalPreviewIssueItems"
                        :key="`action-${item.key}`"
                        type="button"
                        class="rounded-md border border-red-300 bg-white px-2 py-1 font-semibold text-red-800 transition hover:bg-red-100 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100"
                        @click="setCriticalPreviewFilter(item.key)"
                    >
                        Ver {{ item.label.toLowerCase() }}
                    </button>
                </div>
            </div>

            <div
                v-if="visibleReferenceCount && !diagnosticsExpanded"
                class="flex shrink-0 flex-wrap items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/20 dark:text-red-200"
            >
                <span class="font-semibold">
                    Referencias faltantes: {{ visibleReferenceCount }}
                </span>
                <span
                    v-for="reference in missingReferencePreview"
                    :key="reference"
                    class="rounded-md border border-red-200 bg-white px-2 py-0.5 text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100"
                >
                    {{ reference }}
                </span>
                <span
                    v-if="
                        visibleReferenceCount > missingReferencePreview.length
                    "
                    class="text-red-700 dark:text-red-200"
                >
                    +{{
                        visibleReferenceCount - missingReferencePreview.length
                    }}
                    mas
                </span>
                <button
                    v-if="visibleReferenceCount > 1"
                    type="button"
                    @click="requestCreateAllMissingReferences"
                    :disabled="creatingAllReferences"
                    class="ml-auto inline-flex items-center gap-1 rounded-md bg-red-700 px-2 py-1 font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Plus class="h-3.5 w-3.5" />
                    {{ creatingAllReferences ? 'Creando...' : 'Crear todas' }}
                </button>
                <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2 py-1 font-medium text-red-700 transition hover:bg-red-100 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100"
                    @click="diagnosticsExpanded = true"
                >
                    Ver referencias
                </button>
            </div>

            <div
                class="flex shrink-0 flex-wrap gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs dark:border-border dark:bg-background"
            >
                <input
                    :value="previewSearch"
                    type="search"
                    aria-label="Buscar filas del preview por nombre, SKU o system ID"
                    placeholder="Buscar nombre, SKU, system_id..."
                    class="min-w-[240px] flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none sm:flex-none dark:border-border dark:bg-card dark:text-white"
                    :disabled="previewViewControlsDisabled"
                    @input="requestPreviewSearchFromEvent"
                />
                <button
                    v-for="filter in previewFilterOptions"
                    :key="filter.key"
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium transition"
                    :class="
                        activePreviewFilter === filter.key
                            ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-border dark:bg-card dark:text-gray-300'
                    "
                    :disabled="previewViewControlsDisabled"
                    @click="requestPreviewFilter(filter.key)"
                >
                    {{ filter.label }}
                    <span
                        class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-muted dark:text-gray-300"
                    >
                        {{ filter.count }}
                    </span>
                </button>
                <div
                    class="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 dark:border-border dark:bg-card dark:text-gray-300"
                >
                    <span>
                        Mostrando {{ previewPageStart }}-{{ previewPageEnd }} de
                        {{ previewTotalItems }} {{ previewItemLabel }}
                    </span>
                    <select
                        :value="previewPerPage"
                        aria-label="Filas por pagina del preview"
                        class="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-700 focus:border-blue-400 focus:outline-none dark:border-border dark:bg-background dark:text-gray-200"
                        :disabled="previewViewControlsDisabled"
                        @change="requestPreviewPerPageFromEvent"
                    >
                        <option
                            v-for="option in previewPerPageOptions"
                            :key="option"
                            :value="option"
                        >
                            {{ option }} por pagina
                        </option>
                    </select>
                    <button
                        type="button"
                        aria-label="Pagina anterior del preview"
                        class="rounded border border-gray-200 px-2 py-0.5 font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:hover:bg-muted"
                        :disabled="
                            previewPage <= 1 || previewViewControlsDisabled
                        "
                        @click="requestPreviewPage(previewPage - 1)"
                    >
                        Anterior
                    </button>
                    <span class="font-medium">
                        {{ previewPage }}/{{ previewLastPage }}
                    </span>
                    <button
                        type="button"
                        aria-label="Pagina siguiente del preview"
                        class="rounded border border-gray-200 px-2 py-0.5 font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:hover:bg-muted"
                        :disabled="
                            previewPage >= previewLastPage ||
                            previewViewControlsDisabled
                        "
                        @click="requestPreviewPage(previewPage + 1)"
                    >
                        Siguiente
                    </button>
                </div>
                <div class="ml-auto flex gap-2">
                    <button
                        v-if="persistedRowsAvailable"
                        type="button"
                        aria-label="Guardar cambios de filas corregidas"
                        class="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 font-medium text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
                        :disabled="!canSavePersistedRowChanges"
                        @click="savePersistedRowChanges"
                    >
                        <RefreshCw
                            class="h-3.5 w-3.5"
                            :class="{ 'animate-spin': savingPersistedRows }"
                        />
                        Guardar cambios
                    </button>
                    <button
                        v-if="persistedRowsAvailable"
                        type="button"
                        aria-label="Descartar cambios de filas corregidas"
                        class="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 font-medium text-gray-600 transition hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-card dark:text-gray-300"
                        :disabled="
                            !hasUnsavedPersistedRowChanges ||
                            savingPersistedRows
                        "
                        @click="discardPersistedRowChanges"
                    >
                        <RotateCcw class="h-3.5 w-3.5" />
                        Descartar cambios
                    </button>
                    <button
                        v-if="persistedRowsAvailable"
                        type="button"
                        aria-label="Revalidar archivo completo desde filas persistidas"
                        class="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                        :disabled="
                            hasUnsavedPersistedRowChanges ||
                            revalidatingRows ||
                            persistedRowsRevalidationActive
                        "
                        @click="() => requestFullRowsRevalidation()"
                    >
                        <RefreshCw
                            class="h-3.5 w-3.5"
                            :class="{
                                'animate-spin':
                                    revalidatingRows ||
                                    persistedRowsRevalidationActive,
                            }"
                        />
                        <span v-if="persistedRowsRevalidationActive">
                            Revalidando:
                            {{ rowsRevalidationProgressLabel ?? 'en cola...' }}
                        </span>
                        <span v-else> Revalidar archivo completo </span>
                    </button>
                    <button
                        v-if="!validatedPreviewReadOnly"
                        type="button"
                        aria-label="Deshacer ultima edicion"
                        class="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 font-medium text-gray-600 transition hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-card dark:text-gray-300"
                        :disabled="undoStack.length === 0"
                        @click="undoCellEdit"
                    >
                        <RotateCcw class="h-3.5 w-3.5" />
                        Deshacer
                    </button>
                    <button
                        v-if="!validatedPreviewReadOnly"
                        type="button"
                        aria-label="Rehacer ultima edicion"
                        class="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 font-medium text-gray-600 transition hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-card dark:text-gray-300"
                        :disabled="redoStack.length === 0"
                        @click="redoCellEdit"
                    >
                        <RotateCw class="h-3.5 w-3.5" />
                        Rehacer
                    </button>
                    <button
                        v-if="!validatedPreviewReadOnly"
                        type="button"
                        aria-label="Revalidar filas con errores"
                        class="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                        :disabled="
                            revalidatingRows ||
                            rowsWithValidationIssues.length === 0
                        "
                        @click="revalidateErroredRows"
                    >
                        <RefreshCw
                            class="h-3.5 w-3.5"
                            :class="{ 'animate-spin': revalidatingRows }"
                        />
                        Revalidar errores
                    </button>
                    <button
                        v-if="
                            canRevalidateFilteredRows &&
                            !validatedPreviewReadOnly
                        "
                        type="button"
                        aria-label="Revalidar filas filtradas"
                        class="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1 font-medium text-amber-800 transition hover:bg-amber-50 dark:border-amber-800 dark:bg-card dark:text-amber-200"
                        @click="revalidateFilteredRows"
                    >
                        <RefreshCw
                            class="h-3.5 w-3.5"
                            :class="{ 'animate-spin': revalidatingRows }"
                        />
                        Revalidar filtradas
                    </button>
                    <button
                        v-if="
                            selectedRowsCount > 0 && !validatedPreviewReadOnly
                        "
                        type="button"
                        aria-label="Revalidar filas seleccionadas"
                        class="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1 font-medium text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:bg-card dark:text-amber-200"
                        :disabled="!canRevalidateSelectedRows"
                        @click="revalidateSelectedRows"
                    >
                        <RefreshCw
                            class="h-3.5 w-3.5"
                            :class="{ 'animate-spin': revalidatingRows }"
                        />
                        Revalidar seleccionadas ({{ selectedRowsCount }})
                    </button>
                    <button
                        v-if="!validatedPreviewReadOnly"
                        type="button"
                        aria-label="Exportar preview editado a Excel"
                        class="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                        :disabled="!hasPreview"
                        @click="exportEditedPreview"
                    >
                        <Download class="h-3.5 w-3.5" />
                        Exportar Excel
                    </button>
                    <button
                        type="button"
                        :aria-label="
                            previewFullscreen
                                ? 'Salir de pantalla completa del preview'
                                : 'Expandir tabla de preview'
                        "
                        class="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 font-medium text-gray-600 transition hover:border-gray-300 dark:border-border dark:bg-card dark:text-gray-300"
                        @click="togglePreviewFullscreen"
                    >
                        <component
                            :is="previewFullscreen ? Minimize2 : Maximize2"
                            class="h-3.5 w-3.5"
                        />
                        {{
                            previewFullscreen
                                ? 'Salir de pantalla completa'
                                : 'Expandir tabla'
                        }}
                    </button>
                    <button
                        v-if="!validatedPreviewReadOnly"
                        type="button"
                        :aria-label="
                            bulkEditMode
                                ? 'Cerrar edicion masiva'
                                : 'Abrir edicion masiva'
                        "
                        class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium transition"
                        :class="
                            bulkEditMode
                                ? 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-border dark:bg-card dark:text-gray-300'
                        "
                        @click="bulkEditMode = !bulkEditMode"
                    >
                        <ListChecks class="h-3.5 w-3.5" />
                        Edición masiva
                    </button>
                </div>
            </div>

            <div
                v-if="previewViewControlsDisabledReason && !previewFullscreen"
                class="shrink-0 border-b border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-100"
            >
                {{ previewViewControlsDisabledReason }}
            </div>

            <div
                v-if="bulkEditMode && !validatedPreviewReadOnly"
                class="shrink-0 border-b border-purple-200 bg-purple-50 px-4 py-3 dark:border-purple-800 dark:bg-purple-950/20"
            >
                <div class="mb-2 flex items-center justify-between">
                    <p
                        class="text-sm font-semibold text-purple-900 dark:text-purple-100"
                    >
                        Edición masiva
                    </p>
                    <p class="text-xs text-purple-700 dark:text-purple-300">
                        Esto solo modifica el preview; guarda y revalida antes
                        de importar.
                    </p>
                    <div class="flex gap-2">
                        <Checkbox
                            :checked="allRowsSelected"
                            @update:checked="toggleAllRows"
                        />
                        <span
                            class="text-xs text-purple-700 dark:text-purple-300"
                        >
                            Seleccionar pagina ({{
                                selectedCurrentPageCount
                            }}/{{ paginatedEditedRows.length }})
                        </span>
                    </div>
                </div>
                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div
                        v-for="col in editableColumns"
                        :key="`bulk-${col.key}`"
                        class="space-y-1"
                    >
                        <label
                            class="text-xs font-medium text-purple-900 dark:text-purple-100"
                        >
                            {{ col.label }}
                        </label>
                        <SearchableSelect
                            v-if="col.type === 'searchable'"
                            v-model="bulkValues[col.key]"
                            :options="getOptionsForColumn(col)"
                            placeholder="Seleccionar..."
                        />
                        <input
                            v-else
                            v-model="bulkValues[col.key]"
                            :type="col.type === 'number' ? 'number' : 'text'"
                            :placeholder="
                                col.placeholder || `Valor para ${col.label}`
                            "
                            class="w-full rounded border border-purple-300 bg-white px-2 py-1 text-xs focus:border-purple-500 focus:ring-1 focus:ring-purple-500 dark:border-purple-700 dark:bg-muted dark:text-white"
                        />
                    </div>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                    <button
                        v-if="selectedRowsCount > 0"
                        type="button"
                        @click="applyBulkValues('selected')"
                        class="rounded-md border border-purple-600 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:text-purple-300 dark:hover:bg-purple-900/30"
                    >
                        Aplicar a seleccionadas ({{ selectedRowsCount }})
                    </button>
                    <button
                        type="button"
                        @click="applyBulkValues('page')"
                        class="rounded-md border border-purple-300 bg-white px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-950/20 dark:text-purple-300"
                    >
                        Aplicar a pagina visible
                    </button>
                    <button
                        type="button"
                        @click="applyBulkValues('filtered')"
                        :disabled="
                            filteredEditedRows.length === 0 ||
                            !bulkScopeAvailable('filtered')
                        "
                        aria-describedby="bulk-filtered-scope-help"
                        :title="
                            !bulkScopeAvailable('filtered')
                                ? 'Disponible cuando el conjunto cabe en memoria.'
                                : undefined
                        "
                        class="rounded-md border border-purple-300 bg-white px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-purple-700 dark:bg-purple-950/20 dark:text-purple-300"
                    >
                        Aplicar al filtro ({{ filteredEditedRows.length }})
                    </button>
                    <button
                        type="button"
                        @click="applyBulkValues('all')"
                        :disabled="!bulkScopeAvailable('all')"
                        aria-describedby="bulk-all-scope-help"
                        :title="
                            !bulkScopeAvailable('all')
                                ? 'Disponible cuando el conjunto cabe en memoria.'
                                : undefined
                        "
                        class="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Aplicar a todo el preview
                    </button>
                    <span id="bulk-filtered-scope-help" class="sr-only">
                        Disponible cuando el conjunto cabe en memoria.
                    </span>
                    <span id="bulk-all-scope-help" class="sr-only">
                        Disponible cuando el conjunto cabe en memoria.
                    </span>
                    <button
                        type="button"
                        @click="
                            bulkEditMode = false;
                            bulkValues = {};
                            selectedRows = new Set();
                        "
                        class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-border dark:text-gray-300 dark:hover:bg-muted"
                    >
                        Cancelar
                    </button>
                </div>
            </div>

            <ImportGroupedPreviewTable
                :enabled="effectiveGroupedPreviewEnabled"
            >
                <div
                    ref="groupedTableScrollRef"
                    class="min-h-0 flex-1 overflow-auto"
                >
                    <table
                        class="min-w-full divide-y divide-gray-200 text-xs dark:divide-border"
                    >
                        <caption class="sr-only">
                            Preview agrupado de productos a importar
                        </caption>
                        <thead
                            class="sticky top-0 z-10 bg-gray-50 dark:bg-muted"
                        >
                            <tr>
                                <th class="w-12 px-3 py-2"></th>
                                <th
                                    class="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300"
                                    :class="
                                        previewFullscreen
                                            ? 'min-w-[24rem]'
                                            : 'min-w-[22rem]'
                                    "
                                >
                                    Producto base
                                </th>
                                <th
                                    v-for="col in productBaseColumns"
                                    :key="`base-${col.key}`"
                                    class="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300"
                                    :class="
                                        previewFullscreen
                                            ? 'min-w-[14rem]'
                                            : 'min-w-[12rem]'
                                    "
                                >
                                    {{ col.label }}
                                </th>
                                <th
                                    class="w-28 px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300"
                                >
                                    Resumen
                                </th>
                                <th
                                    class="w-24 px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300"
                                >
                                    Estado
                                </th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-100 dark:divide-border"
                        >
                            <template
                                v-for="group in paginatedGroupedPreviewGroups"
                                :key="group.key"
                            >
                                <tr
                                    class="bg-white hover:bg-gray-50 dark:bg-card dark:hover:bg-muted/30"
                                >
                                    <td class="px-3 py-2 align-top">
                                        <button
                                            type="button"
                                            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted"
                                            @click="
                                                toggleProductGroup(group.key)
                                            "
                                        >
                                            <ChevronDown
                                                class="h-4 w-4 transition-transform"
                                                :class="{
                                                    'rotate-180':
                                                        isProductGroupExpanded(
                                                            group.key,
                                                        ),
                                                }"
                                            />
                                        </button>
                                    </td>
                                    <td class="px-3 py-2 align-top">
                                        <div
                                            class="max-w-[26rem] truncate leading-snug font-semibold text-gray-900 dark:text-white"
                                            :title="productGroupTitle(group)"
                                        >
                                            {{ productGroupTitle(group) }}
                                        </div>
                                        <p
                                            v-if="
                                                productGroupOriginalName(
                                                    group,
                                                ) &&
                                                productGroupOriginalName(
                                                    group,
                                                ) !== productGroupTitle(group)
                                            "
                                            class="mt-1 max-w-[26rem] truncate text-xs text-gray-500 dark:text-gray-400"
                                            :title="
                                                productGroupOriginalName(group)
                                            "
                                        >
                                            Original:
                                            {{
                                                productGroupOriginalName(group)
                                            }}
                                        </p>
                                        <div
                                            v-if="
                                                productGroupAttributes(group)
                                                    .length
                                            "
                                            class="mt-2 flex flex-wrap gap-1"
                                        >
                                            <span
                                                v-for="attribute in productGroupAttributes(
                                                    group,
                                                ).slice(0, 5)"
                                                :key="`${group.key}-${attribute.name}-${attribute.value}`"
                                                class="inline-flex rounded-md bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                            >
                                                {{
                                                    attribute.value ||
                                                    attribute.name
                                                }}
                                                <span
                                                    v-if="attribute.unit"
                                                    class="ml-0.5 text-green-600 dark:text-green-400"
                                                >
                                                    {{ attribute.unit }}
                                                </span>
                                            </span>
                                        </div>
                                    </td>
                                    <td
                                        v-for="col in productBaseColumns"
                                        :key="`${group.key}-${col.key}`"
                                        class="px-2 py-2 align-top"
                                    >
                                        <SearchableSelect
                                            v-if="col.type === 'searchable'"
                                            :model-value="
                                                group.primaryRow[col.key]
                                            "
                                            :data-import-cell="`${group.primaryRow.__preview_index}:${col.key}`"
                                            @update:model-value="
                                                onGroupBaseSearchableChange(
                                                    group,
                                                    col,
                                                    $event,
                                                )
                                            "
                                            :options="getOptionsForColumn(col)"
                                            placeholder="Buscar..."
                                            :disabled="
                                                fullValidationReportActive
                                            "
                                            @keydown="
                                                handleCellKeydown(
                                                    $event,
                                                    group.primaryRow,
                                                    col.key,
                                                )
                                            "
                                        />
                                        <input
                                            v-else
                                            :value="group.primaryRow[col.key]"
                                            :data-import-cell="`${group.primaryRow.__preview_index}:${col.key}`"
                                            :type="
                                                col.type === 'number'
                                                    ? 'number'
                                                    : 'text'
                                            "
                                            :disabled="
                                                fullValidationReportActive
                                            "
                                            class="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                            @input="
                                                setGroupBaseValue(
                                                    group,
                                                    col.key,
                                                    col.type === 'number'
                                                        ? eventTargetNumberValue(
                                                              $event,
                                                          )
                                                        : eventTargetValue(
                                                              $event,
                                                          ),
                                                )
                                            "
                                            @keydown="
                                                handleCellKeydown(
                                                    $event,
                                                    group.primaryRow,
                                                    col.key,
                                                )
                                            "
                                        />
                                        <div
                                            v-if="
                                                col.type === 'image' &&
                                                isPreviewImageUrl(
                                                    group.primaryRow[col.key],
                                                )
                                            "
                                            class="mt-1 flex items-center gap-2"
                                        >
                                            <img
                                                :src="group.primaryRow[col.key]"
                                                alt=""
                                                class="h-9 w-9 rounded border border-gray-200 object-cover dark:border-border"
                                                loading="lazy"
                                            />
                                            <span
                                                class="truncate text-[11px] text-gray-500 dark:text-gray-400"
                                            >
                                                Vista previa
                                            </span>
                                        </div>
                                    </td>
                                    <td class="px-2 py-2 align-top text-xs">
                                        <p
                                            class="text-gray-700 dark:text-gray-200"
                                        >
                                            {{ group.rows.length }} /
                                            {{
                                                group.metadata?.variant_count ??
                                                group.rows.length
                                            }}
                                        </p>
                                        <p class="text-[11px] text-gray-500">
                                            filas / vars
                                        </p>
                                        <p
                                            v-if="group.metadata?.sku_warning"
                                            class="mt-1 max-h-7 overflow-hidden text-[11px] text-amber-600 dark:text-amber-300"
                                        >
                                            {{ group.metadata.sku_warning }}
                                        </p>
                                    </td>
                                    <td class="px-2 py-2 align-top">
                                        <span
                                            class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
                                            :class="
                                                group.errorRows ||
                                                group.conflictRows
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                            "
                                        >
                                            {{
                                                group.errorRows ||
                                                group.conflictRows
                                                    ? 'Revisar'
                                                    : 'OK'
                                            }}
                                        </span>
                                        <p
                                            class="mt-1 text-[11px] text-gray-500"
                                        >
                                            {{ group.validRows }}/{{
                                                group.errorRows
                                            }}
                                        </p>
                                    </td>
                                </tr>
                                <tr
                                    v-if="isProductGroupExpanded(group.key)"
                                    class="bg-gray-50 dark:bg-background"
                                >
                                    <td
                                        :colspan="
                                            2 + productBaseColumns.length + 2
                                        "
                                        class="px-4 py-2"
                                    >
                                        <div
                                            class="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-border dark:bg-card"
                                        >
                                            <table class="min-w-full text-xs">
                                                <caption class="sr-only">
                                                    Variantes agrupadas del
                                                    producto
                                                </caption>
                                                <thead
                                                    class="bg-gray-100 text-gray-600 dark:bg-muted dark:text-gray-300"
                                                >
                                                    <tr>
                                                        <th
                                                            class="px-2 py-1.5 text-left"
                                                        >
                                                            Fila
                                                        </th>
                                                        <th
                                                            v-for="col in variantColumns"
                                                            :key="`variant-head-${col.key}`"
                                                            class="min-w-[9rem] px-2 py-1.5 text-left"
                                                        >
                                                            {{ col.label }}
                                                        </th>
                                                        <th
                                                            v-for="col in actionColumns"
                                                            :key="`variant-action-${col.key}`"
                                                            class="px-2 py-1.5 text-center"
                                                        >
                                                            {{ col.label }}
                                                        </th>
                                                        <th
                                                            class="px-2 py-1.5 text-left"
                                                        >
                                                            Estado
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody
                                                    class="divide-y divide-gray-100 dark:divide-border"
                                                >
                                                    <tr
                                                        v-for="row in group.rows"
                                                        :key="
                                                            row.__preview_index
                                                        "
                                                    >
                                                        <td
                                                            class="px-2 py-1.5 text-gray-500"
                                                        >
                                                            {{ row.__row }}
                                                        </td>
                                                        <td
                                                            v-for="col in variantColumns"
                                                            :key="`${row.__preview_index}-${col.key}`"
                                                            class="px-1.5 py-1.5"
                                                        >
                                                            <input
                                                                v-if="
                                                                    col.type ===
                                                                        'text' ||
                                                                    !col.type
                                                                "
                                                                :value="
                                                                    row[col.key]
                                                                "
                                                                type="text"
                                                                :data-import-cell="`${row.__preview_index}:${col.key}`"
                                                                :disabled="
                                                                    fullValidationReportActive
                                                                "
                                                                class="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                                                @input="
                                                                    commitPreviewCellEdit(
                                                                        row.__preview_index,
                                                                        col.key,
                                                                        eventTargetValue(
                                                                            $event,
                                                                        ),
                                                                    )
                                                                "
                                                                @keydown="
                                                                    handleCellKeydown(
                                                                        $event,
                                                                        row,
                                                                        col.key,
                                                                    )
                                                                "
                                                            />
                                                            <input
                                                                v-else-if="
                                                                    col.type ===
                                                                    'number'
                                                                "
                                                                :value="
                                                                    row[col.key]
                                                                "
                                                                type="number"
                                                                step="0.01"
                                                                :data-import-cell="`${row.__preview_index}:${col.key}`"
                                                                :disabled="
                                                                    fullValidationReportActive
                                                                "
                                                                class="w-full rounded border border-gray-200 bg-white px-2 py-1 text-right text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white"
                                                                @input="
                                                                    commitPreviewCellEdit(
                                                                        row.__preview_index,
                                                                        col.key,
                                                                        eventTargetNumberValue(
                                                                            $event,
                                                                        ),
                                                                    )
                                                                "
                                                                @keydown="
                                                                    handleCellKeydown(
                                                                        $event,
                                                                        row,
                                                                        col.key,
                                                                    )
                                                                "
                                                            />
                                                            <div
                                                                v-else-if="
                                                                    col.type ===
                                                                    'searchable'
                                                                "
                                                                tabindex="0"
                                                                :data-import-cell="`${row.__preview_index}:${col.key}`"
                                                                @keydown="
                                                                    handleCellKeydown(
                                                                        $event,
                                                                        row,
                                                                        col.key,
                                                                    )
                                                                "
                                                            >
                                                                <SearchableSelect
                                                                    :model-value="
                                                                        row[
                                                                            col
                                                                                .key
                                                                        ]
                                                                    "
                                                                    @update:model-value="
                                                                        onSearchableChange(
                                                                            col,
                                                                            row.__preview_index,
                                                                            $event,
                                                                        )
                                                                    "
                                                                    :options="
                                                                        getOptionsForColumn(
                                                                            col,
                                                                        )
                                                                    "
                                                                    placeholder="Buscar..."
                                                                    :disabled="
                                                                        fullValidationReportActive
                                                                    "
                                                                />
                                                            </div>
                                                        </td>
                                                        <td
                                                            v-for="col in actionColumns"
                                                            :key="`${row.__preview_index}-${col.key}`"
                                                            class="px-1.5 py-1.5 text-center"
                                                        >
                                                            <button
                                                                type="button"
                                                                @click="
                                                                    emit(
                                                                        'row-action',
                                                                        col.actionType!,
                                                                        row.__preview_index,
                                                                    )
                                                                "
                                                                :disabled="
                                                                    fullValidationReportActive
                                                                "
                                                                class="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-60 dark:border-border dark:text-gray-300"
                                                            >
                                                                <component
                                                                    :is="
                                                                        getActionIcon(
                                                                            col.actionType!,
                                                                        )
                                                                    "
                                                                    class="h-3 w-3"
                                                                />
                                                                {{
                                                                    getActionLabel(
                                                                        col.actionType!,
                                                                        groupActionCount(
                                                                            group,
                                                                            col.actionType!,
                                                                        ),
                                                                    )
                                                                }}
                                                            </button>
                                                        </td>
                                                        <td class="px-2 py-1.5">
                                                            <span
                                                                class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                                                                :class="
                                                                    actionTypeClass(
                                                                        row.__action_type,
                                                                    )
                                                                "
                                                            >
                                                                {{
                                                                    actionTypeLabel(
                                                                        row.__action_type,
                                                                    )
                                                                }}
                                                            </span>
                                                            <p
                                                                v-if="
                                                                    row.__errors
                                                                        ?.length
                                                                "
                                                                class="mt-1 max-h-8 overflow-hidden text-red-600 dark:text-red-300"
                                                            >
                                                                {{
                                                                    row.__errors.join(
                                                                        ' ',
                                                                    )
                                                                }}
                                                            </p>
                                                            <p
                                                                v-if="
                                                                    row
                                                                        .__conflicts
                                                                        ?.length
                                                                "
                                                                class="mt-1 max-h-8 overflow-hidden text-amber-600 dark:text-amber-300"
                                                            >
                                                                {{
                                                                    row.__conflicts
                                                                        .map(
                                                                            (
                                                                                conflict: any,
                                                                            ) =>
                                                                                conflict.message,
                                                                        )
                                                                        .join(
                                                                            ' ',
                                                                        )
                                                                }}
                                                            </p>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </td>
                                </tr>
                            </template>
                            <tr
                                v-if="
                                    paginatedGroupedPreviewGroups.length === 0
                                "
                            >
                                <td
                                    :colspan="2 + productBaseColumns.length + 2"
                                    class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
                                >
                                    No hay grupos para el filtro
                                    {{ activeFilterLabel }}.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </ImportGroupedPreviewTable>

            <ImportFlatPreviewTable :enabled="!effectiveGroupedPreviewEnabled">
                <div
                    ref="normalTableScrollRef"
                    class="min-h-0 flex-1 overflow-auto"
                >
                    <table
                        class="min-w-full divide-y divide-gray-200 text-xs dark:divide-border"
                    >
                        <caption class="sr-only">
                            Preview plano de filas de importacion
                        </caption>
                        <thead
                            class="sticky top-0 z-10 bg-gray-50 dark:bg-background"
                        >
                            <tr>
                                <th
                                    class="w-12 px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300"
                                >
                                    #
                                </th>
                                <th
                                    class="w-32 px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300"
                                >
                                    Accion
                                </th>
                                <!-- Editable columns -->
                                <th
                                    v-for="col in editableColumns"
                                    :key="col.key"
                                    class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300"
                                    :class="getColumnInputWidthClass(col)"
                                >
                                    {{ col.label
                                    }}<span
                                        v-if="col.required"
                                        class="text-red-500"
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
                        <tbody
                            class="divide-y divide-gray-100 dark:divide-border"
                        >
                            <template
                                v-for="row in paginatedEditedRows"
                                :key="row.__preview_index"
                            >
                                <tr
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
                                    <td class="px-3 py-2 align-top">
                                        <span
                                            class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                                            :class="
                                                actionTypeClass(
                                                    row.__action_type,
                                                )
                                            "
                                        >
                                            {{
                                                actionTypeLabel(
                                                    row.__action_type,
                                                )
                                            }}
                                        </span>
                                        <p
                                            v-if="rowChangeSummary(row)"
                                            class="mt-1 max-w-[11rem] text-[11px] leading-tight text-gray-500 dark:text-gray-400"
                                        >
                                            {{ rowChangeSummary(row) }}
                                        </p>
                                        <button
                                            v-if="hasChangeDetails(row)"
                                            type="button"
                                            class="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-300"
                                            @click="toggleChangeDetails(row)"
                                        >
                                            Ver detalle
                                            <ChevronDown
                                                class="h-3 w-3 transition-transform"
                                                :class="
                                                    expandedChangeRow ===
                                                    row.__preview_index
                                                        ? 'rotate-180'
                                                        : ''
                                                "
                                            />
                                        </button>
                                    </td>

                                    <!-- Editable inputs -->
                                    <td
                                        v-for="col in editableColumns"
                                        :key="col.key"
                                        class="px-1 py-1"
                                    >
                                        <TooltipProvider
                                            v-if="
                                                col.type === 'text' ||
                                                col.type === 'image' ||
                                                !col.type
                                            "
                                        >
                                            <Tooltip>
                                                <TooltipTrigger as-child>
                                                    <div
                                                        :class="
                                                            getColumnInputWidthClass(
                                                                col,
                                                            )
                                                        "
                                                    >
                                                        <input
                                                            :value="
                                                                row[col.key]
                                                            "
                                                            type="text"
                                                            :data-import-cell="`${row.__preview_index}:${col.key}`"
                                                            :disabled="
                                                                fullValidationReportActive
                                                            "
                                                            :placeholder="
                                                                col.placeholder ||
                                                                ''
                                                            "
                                                            class="w-full rounded border bg-white px-2 py-1 text-xs focus:ring-1 dark:bg-muted dark:text-white"
                                                            :class="
                                                                getFieldError(
                                                                    row,
                                                                    col.key,
                                                                )
                                                                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                                                                    : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500 dark:border-border'
                                                            "
                                                            @input="
                                                                commitPreviewCellEdit(
                                                                    row.__preview_index,
                                                                    col.key,
                                                                    eventTargetValue(
                                                                        $event,
                                                                    ),
                                                                )
                                                            "
                                                            @keydown="
                                                                handleCellKeydown(
                                                                    $event,
                                                                    row,
                                                                    col.key,
                                                                )
                                                            "
                                                        />
                                                        <div
                                                            v-if="
                                                                col.type ===
                                                                    'image' &&
                                                                isPreviewImageUrl(
                                                                    row[
                                                                        col.key
                                                                    ],
                                                                )
                                                            "
                                                            class="mt-1 flex items-center gap-2"
                                                        >
                                                            <img
                                                                :src="
                                                                    row[col.key]
                                                                "
                                                                alt=""
                                                                class="h-9 w-9 rounded border border-gray-200 object-cover dark:border-border"
                                                                loading="lazy"
                                                            />
                                                            <span
                                                                class="truncate text-[11px] text-gray-500 dark:text-gray-400"
                                                            >
                                                                Vista previa
                                                            </span>
                                                        </div>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent
                                                    v-if="
                                                        getFieldError(
                                                            row,
                                                            col.key,
                                                        )
                                                    "
                                                    class="max-w-xs bg-red-600 text-white"
                                                >
                                                    <p class="text-xs">
                                                        {{
                                                            getFieldError(
                                                                row,
                                                                col.key,
                                                            )
                                                        }}
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <TooltipProvider
                                            v-else-if="col.type === 'number'"
                                        >
                                            <Tooltip>
                                                <TooltipTrigger as-child>
                                                    <input
                                                        :value="row[col.key]"
                                                        type="number"
                                                        step="0.01"
                                                        :data-import-cell="`${row.__preview_index}:${col.key}`"
                                                        :disabled="
                                                            fullValidationReportActive
                                                        "
                                                        class="w-full rounded border bg-white px-2 py-1 text-right text-xs focus:ring-1 dark:bg-muted dark:text-white"
                                                        :class="[
                                                            getColumnInputWidthClass(
                                                                col,
                                                            ),
                                                            getFieldError(
                                                                row,
                                                                col.key,
                                                            )
                                                                ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                                                                : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500 dark:border-border',
                                                        ]"
                                                        @input="
                                                            commitPreviewCellEdit(
                                                                row.__preview_index,
                                                                col.key,
                                                                eventTargetNumberValue(
                                                                    $event,
                                                                ),
                                                            )
                                                        "
                                                        @keydown="
                                                            handleCellKeydown(
                                                                $event,
                                                                row,
                                                                col.key,
                                                            )
                                                        "
                                                    />
                                                </TooltipTrigger>
                                                <TooltipContent
                                                    v-if="
                                                        getFieldError(
                                                            row,
                                                            col.key,
                                                        )
                                                    "
                                                    class="max-w-xs bg-red-600 text-white"
                                                >
                                                    <p class="text-xs">
                                                        {{
                                                            getFieldError(
                                                                row,
                                                                col.key,
                                                            )
                                                        }}
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <TooltipProvider
                                            v-else-if="col.type === 'select'"
                                        >
                                            <Tooltip>
                                                <TooltipTrigger as-child>
                                                    <select
                                                        :value="row[col.key]"
                                                        :data-import-cell="`${row.__preview_index}:${col.key}`"
                                                        :disabled="
                                                            fullValidationReportActive
                                                        "
                                                        class="w-full rounded border bg-white px-2 py-1 text-xs focus:ring-1 dark:bg-muted dark:text-white"
                                                        :class="[
                                                            getColumnInputWidthClass(
                                                                col,
                                                            ),
                                                            getFieldError(
                                                                row,
                                                                col.key,
                                                            )
                                                                ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                                                                : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500 dark:border-border',
                                                        ]"
                                                        @change="
                                                            commitPreviewCellEdit(
                                                                row.__preview_index,
                                                                col.key,
                                                                eventTargetValue(
                                                                    $event,
                                                                ),
                                                            )
                                                        "
                                                        @keydown="
                                                            handleCellKeydown(
                                                                $event,
                                                                row,
                                                                col.key,
                                                            )
                                                        "
                                                    >
                                                        <option value="">
                                                            —
                                                        </option>
                                                        <option
                                                            v-for="opt in col.options ??
                                                            []"
                                                            :key="opt.value"
                                                            :value="opt.value"
                                                        >
                                                            {{ opt.label }}
                                                        </option>
                                                    </select>
                                                </TooltipTrigger>
                                                <TooltipContent
                                                    v-if="
                                                        getFieldError(
                                                            row,
                                                            col.key,
                                                        )
                                                    "
                                                    class="max-w-xs bg-red-600 text-white"
                                                >
                                                    <p class="text-xs">
                                                        {{
                                                            getFieldError(
                                                                row,
                                                                col.key,
                                                            )
                                                        }}
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <div
                                            v-else-if="
                                                col.type === 'searchable'
                                            "
                                            class="flex items-center gap-1"
                                        >
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger as-child>
                                                        <div
                                                            class="flex-1"
                                                            tabindex="0"
                                                            :data-import-cell="`${row.__preview_index}:${col.key}`"
                                                            :class="
                                                                getColumnInputWidthClass(
                                                                    col,
                                                                )
                                                            "
                                                            @keydown="
                                                                handleCellKeydown(
                                                                    $event,
                                                                    row,
                                                                    col.key,
                                                                )
                                                            "
                                                        >
                                                            <SearchableSelect
                                                                :model-value="
                                                                    row[col.key]
                                                                "
                                                                @update:model-value="
                                                                    onSearchableChange(
                                                                        col,
                                                                        row.__preview_index,
                                                                        $event,
                                                                    )
                                                                "
                                                                :options="
                                                                    getOptionsForColumn(
                                                                        col,
                                                                    )
                                                                "
                                                                placeholder="Buscar..."
                                                                :disabled="
                                                                    fullValidationReportActive
                                                                "
                                                                :class="{
                                                                    'ring-2 ring-red-400':
                                                                        getFieldError(
                                                                            row,
                                                                            col.key,
                                                                        ),
                                                                }"
                                                            />
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                        v-if="
                                                            getFieldError(
                                                                row,
                                                                col.key,
                                                            )
                                                        "
                                                        class="max-w-xs bg-red-600 text-white"
                                                    >
                                                        <p class="text-xs">
                                                            {{
                                                                getFieldError(
                                                                    row,
                                                                    col.key,
                                                                )
                                                            }}
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <button
                                                v-if="
                                                    col.creatable &&
                                                    !fullValidationReportActive
                                                "
                                                type="button"
                                                @click="
                                                    emit(
                                                        'create',
                                                        col.key,
                                                        row.__preview_index,
                                                    )
                                                "
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
                                                    row.__preview_index,
                                                )
                                            "
                                            :disabled="
                                                fullValidationReportActive
                                            "
                                            :class="[
                                                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
                                                getActionCount(
                                                    row,
                                                    col.actionType!,
                                                ) > 0
                                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                                    : 'border-gray-200 bg-white text-gray-500 hover:border-blue-400 hover:text-blue-600 disabled:hover:border-gray-200 disabled:hover:text-gray-500 dark:border-border dark:bg-muted/30 dark:text-gray-400',
                                                fullValidationReportActive
                                                    ? 'cursor-not-allowed opacity-70'
                                                    : '',
                                            ]"
                                        >
                                            <component
                                                :is="
                                                    getActionIcon(
                                                        col.actionType!,
                                                    )
                                                "
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
                                                v-if="row.__conflicts?.length"
                                                class="mt-1 max-h-8 overflow-hidden text-[11px] leading-tight text-amber-600 dark:text-amber-300"
                                            >
                                                {{
                                                    row.__conflicts
                                                        .map(
                                                            (conflict: any) =>
                                                                conflict.message,
                                                        )
                                                        .join(' ')
                                                }}
                                            </p>
                                            <p
                                                v-if="row.__warnings?.length"
                                                class="mt-1 max-h-8 overflow-hidden text-[11px] leading-tight text-amber-600 dark:text-amber-300"
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
                                                class="mt-1 max-h-8 overflow-hidden text-[11px] leading-tight text-red-600 dark:text-red-300"
                                            >
                                                {{ row.__errors.join(' ') }}
                                            </p>
                                            <p
                                                v-if="row.__conflicts?.length"
                                                class="mt-1 max-h-8 overflow-hidden text-[11px] leading-tight text-amber-600 dark:text-amber-300"
                                            >
                                                {{
                                                    row.__conflicts
                                                        .map(
                                                            (conflict: any) =>
                                                                conflict.message,
                                                        )
                                                        .join(' ')
                                                }}
                                            </p>
                                            <p
                                                v-if="row.__warnings?.length"
                                                class="mt-1 max-h-8 overflow-hidden text-[11px] leading-tight text-amber-600 dark:text-amber-300"
                                            >
                                                {{ row.__warnings.join(' ') }}
                                            </p>
                                        </template>
                                    </td>
                                </tr>
                                <tr
                                    v-if="
                                        expandedChangeRow ===
                                        row.__preview_index
                                    "
                                    class="bg-blue-50/40 dark:bg-blue-950/10"
                                >
                                    <td
                                        :colspan="
                                            3 +
                                            editableColumns.length +
                                            actionColumns.length
                                        "
                                        class="px-4 py-3"
                                    >
                                        <div
                                            class="grid gap-3 text-xs lg:grid-cols-[1fr_18rem]"
                                        >
                                            <div
                                                class="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-border dark:bg-card"
                                            >
                                                <div
                                                    class="border-b border-gray-100 px-3 py-2 font-semibold text-gray-700 dark:border-border dark:text-gray-200"
                                                >
                                                    Cambios detectados
                                                </div>
                                                <div
                                                    v-if="
                                                        row.__change_preview
                                                            ?.length
                                                    "
                                                    class="overflow-x-auto"
                                                >
                                                    <table
                                                        class="min-w-full divide-y divide-gray-100 text-xs dark:divide-border"
                                                    >
                                                        <caption
                                                            class="sr-only"
                                                        >
                                                            Detalle de cambios
                                                            previstos para la
                                                            fila
                                                        </caption>
                                                        <thead
                                                            class="bg-gray-50 text-[11px] text-gray-500 uppercase dark:bg-muted/40 dark:text-gray-400"
                                                        >
                                                            <tr>
                                                                <th
                                                                    class="px-3 py-2 text-left font-semibold"
                                                                >
                                                                    Campo
                                                                </th>
                                                                <th
                                                                    class="px-3 py-2 text-left font-semibold"
                                                                >
                                                                    Actual
                                                                </th>
                                                                <th
                                                                    class="px-3 py-2 text-left font-semibold"
                                                                >
                                                                    Importado
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody
                                                            class="divide-y divide-gray-100 dark:divide-border"
                                                        >
                                                            <tr
                                                                v-for="change in row.__change_preview"
                                                                :key="`${row.__preview_index}-${change.field}`"
                                                                :class="
                                                                    changeRowClass(
                                                                        change,
                                                                    )
                                                                "
                                                            >
                                                                <td
                                                                    class="w-44 px-3 py-2 font-semibold text-gray-700 dark:text-gray-200"
                                                                >
                                                                    {{
                                                                        change.label ??
                                                                        change.field
                                                                    }}
                                                                </td>
                                                                <td
                                                                    class="max-w-[22rem] px-3 py-2"
                                                                    :class="
                                                                        changeValueClass(
                                                                            change.current,
                                                                        )
                                                                    "
                                                                >
                                                                    <span
                                                                        class="block truncate"
                                                                        :title="
                                                                            formatChangeValue(
                                                                                change.current,
                                                                            )
                                                                        "
                                                                    >
                                                                        {{
                                                                            formatChangeValue(
                                                                                change.current,
                                                                            )
                                                                        }}
                                                                    </span>
                                                                </td>
                                                                <td
                                                                    class="max-w-[22rem] px-3 py-2"
                                                                    :class="
                                                                        changeValueClass(
                                                                            change.imported,
                                                                        )
                                                                    "
                                                                >
                                                                    <span
                                                                        class="block truncate font-semibold"
                                                                        :title="
                                                                            formatChangeValue(
                                                                                change.imported,
                                                                            )
                                                                        "
                                                                    >
                                                                        {{
                                                                            formatChangeValue(
                                                                                change.imported,
                                                                            )
                                                                        }}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <div
                                                    v-else
                                                    class="px-3 py-3 text-gray-500 dark:text-gray-400"
                                                >
                                                    No hay cambios de campo para
                                                    esta fila.
                                                </div>
                                            </div>
                                            <div
                                                v-if="row.__conflicts?.length"
                                                class="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100"
                                            >
                                                <p class="font-semibold">
                                                    Conflictos
                                                </p>
                                                <ul class="mt-2 space-y-1">
                                                    <li
                                                        v-for="conflict in row.__conflicts"
                                                        :key="`${row.__preview_index}-${conflict.type}-${conflict.field}`"
                                                    >
                                                        {{ conflict.message }}
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </template>
                            <tr v-if="paginatedEditedRows.length === 0">
                                <td
                                    :colspan="
                                        3 +
                                        editableColumns.length +
                                        actionColumns.length
                                    "
                                    class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
                                >
                                    No hay filas para el filtro
                                    {{ activeFilterLabel }}.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </ImportFlatPreviewTable>

            <!-- Import button -->
            <div
                class="flex shrink-0 items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-border dark:bg-background"
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
                    @click="requestImportConfirmation('preview')"
                    class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <UploadCloud class="h-4 w-4" />
                    {{ importRunning ? 'Importando...' : 'Importar' }}
                </button>
                <button
                    v-else-if="!fullValidationReportActive"
                    type="button"
                    :disabled="!canRunFullFile"
                    :title="fullFileImportBlockedReason ?? undefined"
                    @click="requestImportConfirmation('file')"
                    class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <UploadCloud class="h-4 w-4" />
                    Importar filas validas
                </button>
            </div>
        </ImportPreviewTable>

        <!-- Step 3: Results -->
        <ImportResultsPanel v-if="result">
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
                        Avance:
                        <span class="font-semibold">
                            {{ runProgressPercent(result) }}%
                        </span>
                        &middot; Procesadas:
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
                <div v-if="activeImportRunId" class="mt-3 max-w-2xl">
                    <div
                        class="h-2 overflow-hidden rounded-full bg-white/70 dark:bg-muted"
                    >
                        <div
                            class="h-full rounded-full bg-blue-500 transition-all"
                            :style="{ width: `${runProgressPercent(result)}%` }"
                        ></div>
                    </div>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {{ formatProgressRefresh() }}
                    </p>
                    <p
                        v-if="runWorkerMessage(result)"
                        class="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300"
                    >
                        {{ runWorkerMessage(result) }}
                    </p>
                </div>
                <div
                    v-if="
                        result.status === 'completed' ||
                        result.status === 'failed'
                    "
                    class="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-xs text-gray-700 dark:border-border dark:bg-background/60 dark:text-gray-200"
                >
                    <span class="font-semibold"> Resumen final </span>
                    <span v-if="completedImportDuration || importDuration">
                        Duracion:
                        {{ completedImportDuration ?? importDuration }}
                    </span>
                    <span>
                        Procesadas:
                        {{ result.processed_rows ?? result.total_rows ?? 0 }}
                    </span>
                    <span> Exitosas: {{ result.success_count ?? 0 }} </span>
                    <span> Errores: {{ result.error_count ?? 0 }} </span>
                    <span>
                        Conflictos:
                        {{ result.summary?.conflict_count ?? 0 }}
                    </span>
                    <button
                        v-if="config.fullFileImport"
                        type="button"
                        class="ml-auto rounded-md border border-gray-300 bg-white px-2 py-1 font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-card dark:text-gray-200"
                        @click="openImportHistoryPanel"
                    >
                        Ver historial
                    </button>
                </div>
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
                        @click="requestRetryFailedRows"
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
        </ImportResultsPanel>

        <Dialog v-model:open="profileDialogOpen">
            <DialogContent class="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Guardar perfil de importacion</DialogTitle>
                    <DialogDescription>
                        Guarda el mapeo actual para reutilizarlo en proximas
                        cargas. Usa un nombre claro, por ejemplo "Proveedor mayo
                        2026".
                    </DialogDescription>
                </DialogHeader>
                <div class="space-y-2">
                    <label
                        class="text-sm font-medium text-gray-700 dark:text-gray-200"
                        for="import-profile-name"
                    >
                        Nombre del perfil
                    </label>
                    <input
                        id="import-profile-name"
                        v-model="profileName"
                        type="text"
                        placeholder="Ej: Plantilla proveedor principal"
                        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none dark:border-border dark:bg-background dark:text-white"
                        @keydown.enter.prevent="saveCurrentProfile"
                    />
                    <p
                        v-if="profileName.trim() && !profileNameIsValid"
                        class="text-xs text-amber-700 dark:text-amber-300"
                    >
                        Usa al menos 3 caracteres para evitar perfiles de prueba
                        o nombres ambiguos.
                    </p>
                </div>
                <DialogFooter>
                    <button
                        type="button"
                        class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200"
                        @click="profileDialogOpen = false"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        :disabled="!profileNameIsValid || profileSaving"
                        class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        @click="saveCurrentProfile"
                    >
                        {{ profileSaving ? 'Guardando...' : 'Guardar' }}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog v-model:open="deleteDialogOpen">
            <DialogContent class="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle
                        >Eliminar importacion del historial</DialogTitle
                    >
                    <DialogDescription>
                        Se quitara el historial y el archivo original guardado.
                        No deshace productos, variantes, stock ni precios ya
                        importados.
                    </DialogDescription>
                </DialogHeader>
                <div
                    v-if="runPendingDeletion"
                    class="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/20 dark:text-red-100"
                >
                    <p class="font-semibold">
                        Importacion #{{ runPendingDeletion.id }}
                    </p>
                    <p class="mt-1">
                        {{
                            runPendingDeletion.original_filename ||
                            'Sin archivo original'
                        }}
                    </p>
                    <p class="mt-1">
                        Esta accion solo elimina el registro operativo del
                        historial.
                    </p>
                </div>
                <DialogFooter>
                    <button
                        type="button"
                        class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200"
                        @click="deleteDialogOpen = false"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        :disabled="deletingRun"
                        class="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        @click="deleteHistoryRun"
                    >
                        {{ deletingRun ? 'Eliminando...' : 'Eliminar' }}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog v-model:open="safetyConfirmOpen">
            <DialogContent class="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{{
                        safetyConfirmationSummary.title
                    }}</DialogTitle>
                    <DialogDescription>
                        {{ safetyConfirmationSummary.description }}
                    </DialogDescription>
                </DialogHeader>
                <div
                    class="rounded-lg border p-3 text-xs"
                    :class="summaryToneClass(safetyConfirmationSummary.tone)"
                >
                    <p class="font-semibold">
                        {{ safetyConfirmationSummary.countLabel }}
                    </p>
                    <div
                        v-if="safetyConfirmationSummary.examples.length"
                        class="mt-2 flex flex-wrap gap-2"
                    >
                        <span
                            v-for="example in safetyConfirmationSummary.examples"
                            :key="example"
                            class="max-w-[18rem] truncate rounded bg-white/70 px-2 py-1 dark:bg-black/20"
                            :title="example"
                        >
                            {{ example }}
                        </span>
                    </div>
                </div>
                <DialogFooter>
                    <button
                        type="button"
                        class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200"
                        @click="cancelSafetyAction"
                    >
                        Revisar primero
                    </button>
                    <button
                        type="button"
                        class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        @click="confirmSafetyAction"
                    >
                        {{ safetyConfirmationSummary.primaryLabel }}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog v-model:open="importConfirmOpen">
            <DialogContent class="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{{
                        importConfirmationSummary.title
                    }}</DialogTitle>
                    <DialogDescription>
                        {{ importConfirmationSummary.description }}
                    </DialogDescription>
                </DialogHeader>
                <div
                    v-if="previewSummary"
                    class="grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 sm:grid-cols-3 dark:border-border dark:bg-background dark:text-gray-300"
                >
                    <div>
                        <span
                            class="block font-semibold text-gray-900 dark:text-white"
                            >{{ actionCounts.create ?? 0 }}</span
                        >
                        crea
                    </div>
                    <div>
                        <span
                            class="block font-semibold text-gray-900 dark:text-white"
                            >{{ actionCounts.update ?? 0 }}</span
                        >
                        actualiza
                    </div>
                    <div>
                        <span
                            class="block font-semibold text-gray-900 dark:text-white"
                            >{{ actionCounts.unchanged ?? 0 }}</span
                        >
                        sin cambios
                    </div>
                </div>
                <DialogFooter>
                    <button
                        type="button"
                        class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200"
                        @click="importConfirmOpen = false"
                    >
                        Revisar
                    </button>
                    <button
                        type="button"
                        class="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                        @click="confirmImport"
                    >
                        {{ importConfirmationSummary.primaryLabel }}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog v-model:open="leaveConfirmOpen">
            <DialogContent class="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Salir del importador</DialogTitle>
                    <DialogDescription>
                        Tienes cambios de filas sin guardar. Guarda o descarta
                        esos cambios antes de salir para no perderlos.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <button
                        type="button"
                        class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200"
                        @click="cancelPendingNavigation"
                    >
                        Continuar editando
                    </button>
                    <button
                        type="button"
                        class="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                        @click="confirmPendingNavigation"
                    >
                        Salir
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
</template>
