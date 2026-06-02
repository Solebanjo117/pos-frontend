export type ImportCellValue = string | number | boolean | null | undefined;

export type ImportActionType =
    | 'create'
    | 'update'
    | 'unchanged'
    | 'conflict'
    | 'invalid';

export type ImportRunStatus =
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancel_requested'
    | 'cancelled';

export interface ImportSelectOption {
    id?: string | number;
    label: string;
    value: string | number;
}

export interface ImportRow {
    __preview_index: number;
    __row: number;
    __valid: boolean;
    __errors: string[];
    __warnings: string[];
    __action_type: ImportActionType;
    __change_preview: ChangePreviewItem[];
    __conflicts: ConflictItem[];
    __attributes: ImportAttribute[];
    __variants: GroupVariant[];
    __variant_preview: VariantPreview | null;
    __product_group_key: string | null;
    __compatibility: Record<string, ImportCellValue>[];
    __vehicle_creation_candidate: VehicleCandidate | null;
    [key: string]: any;
}

export interface ChangePreviewItem {
    field: string;
    label?: string;
    current: string | number | null;
    imported: string | number | null;
}

export interface ConflictItem {
    type: string;
    field: string;
    message: string;
}

export interface ImportAttribute {
    name: string;
    value: string;
    unit?: string;
}

export interface VariantPreview {
    brand?: string;
    sku?: string;
    system_id?: string;
}

export interface ImportSummary {
    action_counts: Record<string, number>;
    conflict_count: number;
    productos_estimados?: number;
    variantes_estimadas?: number;
    groups?: ImportGroup[];
    missing_categories?: string[];
    missing_references?: { brands?: string[] };
    missingReferences?: { brands?: string[] };
    missing_vehicle_candidates?: VehicleCandidate[];
    detected_attributes?: string[];
    suggestions?: { categories?: Suggestion[]; brands?: Suggestion[] };
    preview_limited?: boolean;
    preview_async?: boolean;
    sheets?: ImportSheet[];
    selected_sheet?: { index: number; name?: string };
    recommended_sheet?: ImportSheet | null;
    detected_columns?: DetectedColumn[];
    suggested_mapping?: Record<string, string>;
    required_fields?: string[];
    sheet_detection_warning?: string | null;
    rows_revision?: number;
    validated_rows_revision?: number;
    rows_dirty?: boolean;
    full_revalidation_status?: string;
}

export interface ImportGroup {
    product_key: string;
    product_name?: string;
    original_name?: string;
    variant_count?: number;
    rows?: number[];
    variant_skus?: string[];
    sku_warning?: string;
    variants?: GroupVariant[];
}

export interface GroupVariant {
    variant_key: string;
    brand?: string;
    sku?: string;
    system_id?: string;
    cantidad?: number;
    costo?: number;
    precio?: number;
}

export interface Suggestion {
    value: string;
    suggestion: string;
}

export interface VehicleCandidate {
    make_id?: number | null;
    make?: string | null;
    model_id?: number | null;
    model?: string | null;
    chassis?: string | null;
    engine?: string | null;
    label?: string | null;
    source?: string | null;
    can_create?: boolean;
}

export interface ImportBatchReferenceResult {
    created: Array<{ id: number; name: string; status?: string }>;
    existing: Array<{ id: number; name: string; status?: string }>;
    skipped: Array<{ name: string | null; message: string }>;
    errors: Array<{ name: string; message: string }>;
}

export interface ImportBatchSummary {
    created_count: number;
    existing_count: number;
    skipped_count: number;
    error_count: number;
}

export interface ImportBatchReferencesResponse {
    data: {
        categories: ImportBatchReferenceResult;
        brands: ImportBatchReferenceResult;
        summary: ImportBatchSummary;
    };
}

export interface ImportBatchVehicleCandidate {
    index: number;
    status: 'created' | 'existing' | 'error';
    input: VehicleCandidate;
    message?: string;
    make?: { id: number; name: string };
    model?: {
        id: number;
        name: string;
        make_id: number;
        year_from?: number;
        year_to?: number;
        generation?: string | null;
    };
    chassis?: { id: number; code: string; name: string; model_id?: number };
    engine?: {
        id: number;
        engine_code: string;
        make_id?: number;
        model_id?: number;
    };
    summary: ImportBatchSummary;
}

export interface ImportBatchVehicleCandidatesResponse {
    data: {
        candidates: ImportBatchVehicleCandidate[];
        summary: ImportBatchSummary;
    };
}

export interface ImportRun {
    data?: Record<string, unknown>;
    id: number;
    status: ImportRunStatus;
    run_type?: string;
    mode?: string;
    original_filename?: string;
    total_rows?: number;
    processed_rows?: number;
    success_count?: number;
    error_count?: number;
    conflict_count?: number;
    unchanged_count?: number;
    action_counts?: Record<string, number>;
    created_at?: string;
    user?: { name: string };
    has_source_file?: boolean;
    has_errors?: boolean;
    can_cancel?: boolean;
    can_retry_failed?: boolean;
    can_delete?: boolean;
    preview_async?: boolean;
    async?: boolean;
    summary?: ImportSummary;
    mapping?: Record<string, string>;
    sheet_index?: number | null;
    sheet_name?: string | null;
    sheets?: ImportSheet[];
    selected_sheet?: { index: number; name?: string };
    detected_columns?: DetectedColumn[];
    suggested_mapping?: Record<string, string>;
    required_fields?: string[];
}

export interface ImportRunRow {
    id: number;
    row: number;
    sheet_name?: string | null;
    status: 'valid' | 'error' | 'warning' | 'conflict' | string;
    is_valid: boolean;
    action_type?: ImportActionType | string | null;
    label?: string | null;
    data: Record<string, any>;
    errors: string[];
    warnings: string[];
    conflicts: ConflictItem[];
    change_preview: ChangePreviewItem[];
    error?: string;
    updated_at: string;
    is_edited: boolean;
}

export interface ImportPaginationMeta {
    current_page: number;
    from?: number | null;
    last_page: number;
    per_page: number;
    to?: number | null;
    total: number;
    rows_revision: number;
    validated_rows_revision: number;
    rows_dirty: boolean;
    full_revalidation_status: string;
    valid_count: number;
    error_count: number;
    warning_count: number;
    conflict_count: number;
    action_counts: Record<string, number>;
    retryable_failed_rows_count: number;
    server_scope_actions?: {
        selected: boolean;
        page: boolean;
        filtered: boolean;
        all: boolean;
    };
    revalidation_progress?: {
        status: string;
        processed_rows: number;
        total_rows: number;
        rows_revision: number;
        validated_rows_revision: number;
    };
    counts?: {
        validation_rows_count?: number;
        row_status_counts?: Record<string, number>;
        action_counts?: Record<string, number>;
        warning_count?: number;
        conflict_count?: number;
        retryable_failed_rows_count?: number;
    };
}

export interface ImportRunRowsResponse {
    data: ImportRunRow[];
    meta: ImportPaginationMeta;
}

export interface ImportResult {
    data?: any;
    status?: string;
    run_type?: string;
    mode?: string;
    total_rows?: number;
    processed_rows?: number;
    success_count?: number;
    error_count?: number;
    errors?: { row: number; label?: string; error: string }[];
    results?: { row: number; label: string; id?: number }[];
    summary?: ImportSummary;
    import_run_id?: number;
    validation_rows?: ImportRow[];
    preview_async?: boolean;
    async?: boolean;
    sheets?: ImportSheet[];
    detected_columns?: DetectedColumn[];
    required_fields?: string[];
    suggested_mapping?: Record<string, string>;
    selected_sheet?: { index: number; name?: string };
    mapping?: Record<string, string>;
    sheet_index?: number | null;
    sheet_name?: string | null;
    rows?: ImportRow[];
}

export interface ImportProfile {
    data?: any;
    id: number;
    name: string;
    mapping: Record<string, string>;
    mode?: string;
    sheet_index?: number | null;
}

export interface DetectedColumn {
    key: string;
    label: string;
}

export interface ImportSheet {
    index: number;
    name: string;
    row_count: number;
    matched_headers?: string[];
    is_recommended?: boolean;
    is_compatible?: boolean;
}
