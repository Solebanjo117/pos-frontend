import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';

export type ImportPreviewFilterKey =
    | 'all'
    | 'errors'
    | 'conflict'
    | 'create'
    | 'update'
    | 'unchanged'
    | 'duplicates'
    | 'warnings'
    | string;

export interface ImportPreviewPaginationOptions {
    totalItems: ComputedRef<number>;
    itemLabel: ComputedRef<string>;
    search?: Ref<string>;
    activeFilter?: Ref<ImportPreviewFilterKey>;
    perPage?: Ref<number>;
    initialPerPage?: number;
    perPageOptions?: number[];
}

export function useImportPreviewPagination({
    totalItems,
    itemLabel,
    search,
    activeFilter,
    perPage,
    initialPerPage = 50,
    perPageOptions = [25, 50, 100, 200],
}: ImportPreviewPaginationOptions) {
    const previewSearch = search ?? ref('');
    const activePreviewFilter =
        activeFilter ?? ref<ImportPreviewFilterKey>('all');
    const previewPage = ref(1);
    const previewPerPage = perPage ?? ref(initialPerPage);

    const previewLastPage = computed(() =>
        Math.max(1, Math.ceil(totalItems.value / previewPerPage.value)),
    );
    const previewPageStart = computed(() =>
        totalItems.value === 0
            ? 0
            : (previewPage.value - 1) * previewPerPage.value + 1,
    );
    const previewPageEnd = computed(() =>
        Math.min(previewPage.value * previewPerPage.value, totalItems.value),
    );

    const setPreviewPage = (page: number): void => {
        previewPage.value = Math.min(Math.max(1, page), previewLastPage.value);
    };

    watch([previewSearch, activePreviewFilter, previewPerPage], () => {
        previewPage.value = 1;
    });

    watch(totalItems, () => {
        if (previewPage.value > previewLastPage.value) {
            previewPage.value = previewLastPage.value;
        }
    });

    return {
        activePreviewFilter,
        previewSearch,
        previewPage,
        previewPerPage,
        previewPerPageOptions: perPageOptions,
        previewLastPage,
        previewPageStart,
        previewPageEnd,
        previewTotalItems: totalItems,
        previewItemLabel: itemLabel,
        setPreviewPage,
    };
}
