import { describe, expect, it } from 'vitest';
import type { MoneyAccountOption } from '@/types/financial-transfer';
import {
    moneyEndpointKey,
    validateTransferSelection,
} from '@/utils/financialTransferForm';

const account = (
    endpointType: MoneyAccountOption['endpoint_type'],
    endpointId: number,
    balance = 100,
): MoneyAccountOption => ({
    endpoint_type: endpointType,
    endpoint_id: endpointId,
    account_type: endpointType === 'pos_session' ? 'cash' : 'bank',
    name: `Cuenta ${endpointId}`,
    masked_number: null,
    balance,
    currency: 'USD',
    allow_negative_balance: false,
});

describe('financial transfer form', () => {
    it('uses endpoint type and id as the canonical selection key', () => {
        expect(moneyEndpointKey(account('pos_session', 7))).toBe(
            'pos_session:7',
        );
        expect(moneyEndpointKey(account('financial_account', 7))).toBe(
            'financial_account:7',
        );
    });

    it('accepts a valid transfer', () => {
        expect(
            validateTransferSelection(
                account('financial_account', 1),
                account('financial_account', 2),
                25,
            ),
        ).toBeNull();
    });

    it('rejects missing, equal, invalid and insufficient selections', () => {
        const source = account('financial_account', 1, 50);

        expect(validateTransferSelection(undefined, source, 10)).toContain(
            'Completa',
        );
        expect(validateTransferSelection(source, source, 10)).toContain(
            'diferentes',
        );
        expect(
            validateTransferSelection(
                source,
                account('financial_account', 2),
                0,
            ),
        ).toContain('mayor a cero');
        expect(
            validateTransferSelection(
                source,
                account('financial_account', 2),
                51,
            ),
        ).toContain('saldo suficiente');
    });

    it('allows overdrafts only for accounts configured for them', () => {
        const source = {
            ...account('financial_account', 1, 10),
            allow_negative_balance: true,
        };

        expect(
            validateTransferSelection(
                source,
                account('financial_account', 2),
                20,
            ),
        ).toBeNull();
    });
});
