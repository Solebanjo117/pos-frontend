import { computed, ref } from 'vue';
import { financialDocumentsService } from '@/services/financial-documents';
import type {
    FinancialDocument,
    FinancialDocumentFilters,
    FinancialDocumentMode,
    FinancialDocumentResponse,
} from '@/types/financial-document';

const emptyResponse = (): FinancialDocumentResponse => ({
    data: [],
    summary: { total: 0, paid: 0, balance: 0, pending_documents: 0 },
    meta: { current_page: 1, last_page: 1, per_page: 25, total: 0 },
    statuses: {
        open: 'Pendientes activos',
        all: 'Todos',
        pending: 'Pendiente',
        partial: 'Parcial',
        overdue: 'Vencido',
        settled: 'Saldado',
        cancelled: 'Anulado',
    },
});

const readFilters = (): FinancialDocumentFilters => {
    const params = new URLSearchParams(window.location.search);
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    return {
        date_from:
            params.get('date_from') ?? monthStart.toISOString().slice(0, 10),
        date_to: params.get('date_to') ?? today.toISOString().slice(0, 10),
        search: params.get('search') ?? '',
        document_number: params.get('document_number') ?? '',
        party_id: Number(params.get('party_id')) || null,
        status: params.get('status') ?? 'open',
        page: Math.max(1, Number(params.get('page')) || 1),
        per_page: Number(params.get('per_page')) || 25,
    };
};

export function useFinancialDocuments(mode: FinancialDocumentMode) {
    const response = ref<FinancialDocumentResponse>(emptyResponse());
    const filters = ref<FinancialDocumentFilters>(readFilters());
    const loading = ref(false);
    const error = ref<string | null>(null);

    const documents = computed(() => response.value.data);
    const summary = computed(() => response.value.summary);
    const meta = computed(() => response.value.meta);
    const statuses = computed(() => response.value.statuses);

    const syncUrl = (): void => {
        const params = new URLSearchParams();
        Object.entries(filters.value).forEach(([key, value]) => {
            if (value !== '' && value !== null && value !== undefined) {
                params.set(key, String(value));
            }
        });
        window.history.replaceState(
            {},
            '',
            `${window.location.pathname}?${params.toString()}`,
        );
    };

    const load = async (): Promise<void> => {
        loading.value = true;
        error.value = null;
        try {
            response.value = await financialDocumentsService.list(
                mode,
                filters.value,
            );
            syncUrl();
        } catch (exception: any) {
            error.value =
                exception.response?.data?.message ||
                'No se pudieron cargar los documentos.';
        } finally {
            loading.value = false;
        }
    };

    const applyFilters = async (): Promise<void> => {
        filters.value.page = 1;
        await load();
    };

    const clearFilters = async (): Promise<void> => {
        filters.value = {
            ...readFilters(),
            date_from: '',
            date_to: '',
            search: '',
            document_number: '',
            party_id: null,
            status: 'open',
            page: 1,
        };
        await load();
    };

    const goToPage = async (page: number): Promise<void> => {
        filters.value.page = Math.min(meta.value.last_page, Math.max(1, page));
        await load();
    };

    const findDocument = (id: number): FinancialDocument | undefined =>
        documents.value.find((document) => document.id === id);

    return {
        filters,
        documents,
        summary,
        meta,
        statuses,
        loading,
        error,
        load,
        applyFilters,
        clearFilters,
        goToPage,
        findDocument,
    };
}
