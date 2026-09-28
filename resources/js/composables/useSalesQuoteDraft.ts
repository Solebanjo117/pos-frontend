import { ref } from 'vue';
import type { VehicleContext } from '@/composables/useVehicleContext';
import apiClient from '@/services/api/client';
import { createIdempotencyKey } from '@/utils/idempotency';

export interface QuoteDraftItem {
    product_id: number | null;
    variant_id: number | null;
    warehouse_id: number;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    discount_amount?: number;
    tax_percent: number;
    notes?: string | null;
    is_custom_line: boolean;
    custom_description: string | null;
}

export interface QuoteDraftPayload {
    seller_id?: number | null;
    vehicle_context?: VehicleContext | null;
    customer_id: number | null;
    customer_vehicle_id: number | null;
    warehouse_id: number;
    notes: string | null;
    internal_notes: string | null;
    items: QuoteDraftItem[];
}

interface LocalDraft {
    uuid: string;
    quoteId: number | null;
    revision: number;
    payload: QuoteDraftPayload;
    cart: unknown[];
    vehicleContext?: VehicleContext;
    dirty: boolean;
}

interface SavedQuote {
    id: number;
    quote_number: string;
    draft_revision: number;
    idempotency_key?: string | null;
    status: string;
    user_id?: number | null;
    user?: { name: string } | null;
    customer?: { name: string } | null;
    created_at?: string | null;
    notes?: string | null;
    total?: number | string | null;
}

type SaveResult = 'saved' | 'failed';

export function useSalesQuoteDraft(
    capture: () => {
        payload: QuoteDraftPayload;
        cart: unknown[];
        vehicleContext?: VehicleContext;
    },
    onSaved: (quote: SavedQuote) => void,
) {
    const quoteId = ref<number | null>(null);
    const revision = ref(0);
    const dirty = ref(false);
    const saving = ref(false);
    const conflict = ref(false);
    const error = ref<string | null>(null);
    const ready = ref(false);
    const uuid = ref('');
    let storageKey = '';
    let pointerKey = '';
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight: Promise<SaveResult> | null = null;
    let flushPromise: Promise<boolean> | null = null;
    let changeVersion = 0;
    let latest: LocalDraft | null = null;

    function persist(): void {
        if (!storageKey || !latest) return;
        try {
            localStorage.setItem(storageKey, JSON.stringify(latest));
        } catch {
            error.value =
                'No se pudo conservar una copia local de la cotización.';
        }
    }

    function start(
        userId: number,
        warehouseId: number,
        existingQuoteId?: number,
        serverRevision = 0,
        serverUuid?: string | null,
    ): LocalDraft | null {
        pointerKey = `sales_quote_draft_pointer:${userId}:${warehouseId}`;
        let draftUuid = createIdempotencyKey();
        if (!existingQuoteId) {
            try {
                draftUuid = sessionStorage.getItem(pointerKey) || draftUuid;
                sessionStorage.setItem(pointerKey, draftUuid);
            } catch {
                // The in-memory UUID still prevents duplicate creates in this page.
            }
        }
        storageKey = existingQuoteId
            ? `sales_quote_draft:${userId}:${warehouseId}:quote:${existingQuoteId}`
            : `sales_quote_draft:${userId}:${warehouseId}:new:${draftUuid}`;

        let stored: LocalDraft | null = null;
        try {
            const raw = localStorage.getItem(storageKey);
            stored = raw ? (JSON.parse(raw) as LocalDraft) : null;
        } catch {
            stored = null;
        }

        uuid.value = stored?.dirty
            ? stored.uuid
            : serverUuid || stored?.uuid || draftUuid;
        quoteId.value = stored?.quoteId ?? existingQuoteId ?? null;
        revision.value = stored?.revision ?? serverRevision;
        latest = stored;
        dirty.value = stored?.dirty ?? false;
        if (stored?.dirty && serverUuid && stored.uuid !== serverUuid) {
            conflict.value = true;
            error.value =
                'La identidad de la cotización cambió. Revisa la versión guardada antes de continuar.';
        } else if (existingQuoteId && !stored?.dirty) {
            revision.value = serverRevision;
        }
        ready.value = true;
        if (dirty.value && !conflict.value) schedule();

        return stored?.dirty ? stored : null;
    }

    function reconcileServer(serverQuote: SavedQuote): void {
        if (
            serverQuote.idempotency_key &&
            serverQuote.idempotency_key !== uuid.value
        ) {
            conflict.value = true;
            error.value =
                'La identidad de la cotización cambió. Revisa la versión guardada antes de continuar.';
            return;
        }
        if (!dirty.value) revision.value = Number(serverQuote.draft_revision);
    }

    function recordChange(): void {
        if (!ready.value) return;
        const state = capture();
        latest = {
            uuid: uuid.value,
            quoteId: quoteId.value,
            revision: revision.value,
            payload: JSON.parse(
                JSON.stringify(state.payload),
            ) as QuoteDraftPayload,
            cart: JSON.parse(JSON.stringify(state.cart)) as unknown[],
            vehicleContext: state.vehicleContext
                ? { ...state.vehicleContext }
                : undefined,
            dirty: true,
        };
        changeVersion += 1;
        dirty.value = true;
        persist();
        if (!conflict.value) schedule();
    }

    function schedule(): void {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            void flush();
        }, 800);
    }

    async function saveOnce(
        payload: QuoteDraftPayload,
        version: number,
    ): Promise<SaveResult> {
        saving.value = true;
        error.value = null;
        try {
            const response = await apiClient.put(
                `/sales-quotes/drafts/${uuid.value}`,
                {
                    ...payload,
                    quote_id: quoteId.value,
                    expected_revision: revision.value,
                },
            );
            const quote = response.data?.data as SavedQuote | undefined;
            if (!quote?.id)
                throw new Error('La API no devolvió la cotización guardada.');
            quoteId.value = Number(quote.id);
            revision.value = Number(quote.draft_revision);
            onSaved(quote);
            if (latest) {
                latest.quoteId = quoteId.value;
                latest.revision = revision.value;
                if (changeVersion === version) {
                    latest.dirty = false;
                    dirty.value = false;
                }
                persist();
            }
            return 'saved';
        } catch (exception: any) {
            const serverQuote = exception.response?.data?.data as
                | SavedQuote
                | undefined;
            if (exception.response?.status === 409 && serverQuote?.id) {
                conflict.value = true;
                error.value =
                    'La cotización cambió o ya fue enviada. Revisa la versión guardada.';
            } else {
                error.value =
                    exception.response?.data?.message ||
                    exception.message ||
                    'No se pudo guardar la cotización.';
            }
            return 'failed';
        } finally {
            saving.value = false;
        }
    }

    function flush(): Promise<boolean> {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        if (flushPromise) return flushPromise;
        flushPromise = drain().finally(() => {
            flushPromise = null;
        });
        return flushPromise;
    }

    async function drain(): Promise<boolean> {
        if (!ready.value || conflict.value) return !conflict.value;
        if (inFlight) await inFlight;
        if (!dirty.value) return true;
        if (!latest?.payload.items.length) {
            if (!quoteId.value) return true;
            error.value =
                'Agrega al menos un producto para guardar los cambios de esta cotización.';
            return false;
        }

        while (dirty.value && !conflict.value) {
            const version = changeVersion;
            const payload = latest.payload;
            inFlight = saveOnce(payload, version);
            const result = await inFlight;
            inFlight = null;
            if (result === 'failed') return false;
        }
        return !dirty.value && !conflict.value;
    }

    function clearAfterLeave(): void {
        if (timer) clearTimeout(timer);
        timer = null;
        try {
            localStorage.removeItem(storageKey);
            if (pointerKey && storageKey.includes(':new:'))
                sessionStorage.removeItem(pointerKey);
        } catch {
            // A saved quote remains recoverable from the server.
        }
    }

    function dispose(): void {
        if (timer) clearTimeout(timer);
        timer = null;
    }

    return {
        quoteId,
        revision,
        dirty,
        saving,
        conflict,
        error,
        ready,
        start,
        reconcileServer,
        recordChange,
        flush,
        clearAfterLeave,
        dispose,
    };
}
