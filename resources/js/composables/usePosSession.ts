import { ref, computed } from 'vue';
import { usePage } from '@inertiajs/vue3';
import { PosSessionApiService } from '../services/pos-session';
import type { PosSession, PosSessionSummary } from '../types/pos-session';
import type {
    CashMovementPayload,
    CashMovementRecord,
} from '../services/pos-session';

export function usePosSession() {
    const page = usePage();
    const user = page.props.auth?.user as any;
    const userId = user?.id;

    const session = ref<PosSession | null>(null);
    const summary = ref<PosSessionSummary | null>(null);
    const isChecking = ref(true);
    const error = ref<string | null>(null);
    const cashMovements = ref<CashMovementRecord[]>([]);

    const getSessionStorageKey = () =>
        `pos_open_session_user_${userId ?? 'guest'}`;

    const syncSessionStorage = (currentSession: PosSession | null) => {
        if (typeof window === 'undefined') return;
        const key = getSessionStorageKey();

        if (!currentSession) {
            localStorage.removeItem(key);
            return;
        }

        localStorage.setItem(
            key,
            JSON.stringify({
                id: currentSession.id,
                status: currentSession.status,
                warehouse_id: (currentSession as any).warehouse_id ?? null,
                updated_at: new Date().toISOString(),
            }),
        );
    };

    const isOpen = computed(
        () => session.value !== null && session.value.status === 'open',
    );

    const checkCurrentSession = async (warehouseId?: number) => {
        if (!userId) {
            isChecking.value = false;
            return;
        }

        isChecking.value = true;
        error.value = null;
        try {
            const response = await PosSessionApiService.getCurrentSession(
                userId,
                warehouseId,
            );
            session.value = response.data ?? null;
            summary.value = response.summary ?? null;
            syncSessionStorage(session.value);
        } catch (e: any) {
            if (e.response?.status === 404) {
                error.value = null;
            } else {
                error.value =
                    e.response?.data?.message || 'Error checking session state';
            }
            session.value = null;
            summary.value = null;
            syncSessionStorage(null);
        } finally {
            isChecking.value = false;
        }
    };

    const openSession = async (amount: number, warehouseId?: number) => {
        if (!userId) return false;

        try {
            const { data } = await PosSessionApiService.openSession({
                user_id: userId,
                opening_amount: amount,
                warehouse_id: warehouseId,
            });
            session.value = data;
            syncSessionStorage(session.value);
            return true;
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error opening session';
            return false;
        }
    };

    const closeSession = async (
        amount: number,
        notes?: string,
        closingDetails?: Record<string, any>,
        warehouseId?: number,
    ) => {
        if (!userId) return false;

        try {
            const { data } = await PosSessionApiService.closeSession({
                user_id: userId,
                warehouse_id: warehouseId,
                closing_amount: amount,
                closing_details: closingDetails,
                notes,
            });
            session.value = null; // Once closed, no active session
            summary.value = null;
            cashMovements.value = [];
            syncSessionStorage(null);
            return true;
        } catch (e: any) {
            error.value = e.response?.data?.message || 'Error closing session';
            return false;
        }
    };

    const addCashMovement = async (
        payload: Omit<CashMovementPayload, 'user_id'>,
    ) => {
        if (!userId) return false;

        try {
            await PosSessionApiService.createCashMovement({
                ...payload,
                user_id: userId,
            });
            // Refresh movements and session summary
            await fetchCashMovements();
            return true;
        } catch (e: any) {
            error.value =
                e.response?.data?.message ||
                'Error registrando movimiento de caja';
            return false;
        }
    };

    const fetchCashMovements = async () => {
        if (!userId) return;

        try {
            const { data } =
                await PosSessionApiService.getCashMovements(userId);
            cashMovements.value = data;
        } catch (e: any) {
            console.error('Error fetching cash movements:', e);
        }
    };

    return {
        session,
        summary,
        isChecking,
        isOpen,
        error,
        cashMovements,
        checkCurrentSession,
        openSession,
        closeSession,
        addCashMovement,
        fetchCashMovements,
    };
}
