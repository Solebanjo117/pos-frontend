import type { MoneyAccountOption } from '@/types/financial-transfer';

export const moneyEndpointKey = (option: MoneyAccountOption): string =>
    `${option.endpoint_type}:${option.endpoint_id}`;

export const validateTransferSelection = (
    from: MoneyAccountOption | undefined,
    to: MoneyAccountOption | undefined,
    amount: number,
): string | null => {
    if (!from || !to) {
        return 'Completa las cuentas y el monto.';
    }

    if (moneyEndpointKey(from) === moneyEndpointKey(to)) {
        return 'La cuenta de origen y destino deben ser diferentes.';
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return 'El monto debe ser mayor a cero.';
    }

    if (amount > Number(from.balance) && !from.allow_negative_balance) {
        return 'La cuenta de origen no tiene saldo suficiente.';
    }

    return null;
};
