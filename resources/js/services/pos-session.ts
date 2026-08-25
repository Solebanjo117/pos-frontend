import type { PosSession, PosSessionSummary } from '../types/pos-session';
import apiClient from './api/client';

export interface CashMovementPayload {
    user_id?: number;
    type: 'in' | 'out';
    subtype?:
        | 'cash_in'
        | 'cash_out'
        | 'deposit'
        | 'withdrawal'
        | 'adjustment_positive'
        | 'adjustment_negative';
    amount: number;
    reason: string;
    reference_number?: string;
    business_datetime?: string;
    notes?: string;
    warehouse_id?: number;
    idempotency_key?: string;
}

export interface CashMovementRecord {
    id: number;
    pos_session_id: number;
    user_id: number;
    type: 'in' | 'out';
    subtype?: string | null;
    amount: string;
    reason: string;
    reference_number?: string | null;
    balance_before?: string | null;
    balance_after?: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export const PosSessionApiService = {
    /**
     * Get current open session
     */
    async getCurrentSession(
        userId: number,
        warehouseId?: number,
    ): Promise<{ data: PosSession | null; summary: PosSessionSummary | null }> {
        const params: Record<string, any> = { user_id: userId };
        if (warehouseId) params.warehouse_id = warehouseId;
        const response = await apiClient.get('/pos-sessions/current', {
            params,
        });
        return response.data;
    },

    /**
     * Open a new session
     */
    async openSession(data: {
        user_id: number;
        opening_amount: number;
        warehouse_id?: number;
    }): Promise<{ message: string; data: PosSession }> {
        const response = await apiClient.post('/pos-sessions/open', data);
        return response.data;
    },

    /**
     * Close the current session
     */
    async closeSession(data: {
        user_id: number;
        warehouse_id?: number;
        closing_amount: number;
        closing_details?: Record<string, any>;
        notes?: string;
    }): Promise<{ message: string; data: PosSession }> {
        const response = await apiClient.post('/pos-sessions/close', data);
        return response.data;
    },

    /**
     * Create a cash movement (retiro / ingreso extra)
     */
    async createCashMovement(
        data: CashMovementPayload,
    ): Promise<{ message: string; data: CashMovementRecord }> {
        const response = await apiClient.post(
            '/pos-sessions/current/movements',
            data,
        );
        return response.data;
    },

    /**
     * List cash movements for the current session
     */
    async getCashMovements(
        userId?: number,
        warehouseId?: number,
    ): Promise<{ data: CashMovementRecord[] }> {
        const params: Record<string, any> = {};
        if (userId) params.user_id = userId;
        if (warehouseId) params.warehouse_id = warehouseId;
        const response = await apiClient.get(
            '/pos-sessions/current/movements',
            { params },
        );
        return response.data;
    },
};
