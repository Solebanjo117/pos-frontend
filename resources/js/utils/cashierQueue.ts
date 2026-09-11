export const QUEUE_ENTRY_TYPE = {
    sale: 'sale_collection',
    expense: 'expense_payment',
    return: 'sales_return_refund',
    cashIn: 'cash_in_request',
    cashOut: 'cash_out_request',
    funding: 'funding_request',
} as const;

export type QueueEntryKind = keyof typeof QUEUE_ENTRY_TYPE;

export type QueueEntryWireType = (typeof QUEUE_ENTRY_TYPE)[QueueEntryKind];

export interface CashierPayment {
    method: string;
    amount: number;
    reference_number?: string | null;
    notes?: string | null;
    financial_account_id?: number | null;
}

export const cashierPaymentSignature = (payments: CashierPayment[]): string =>
    JSON.stringify(
        payments.map((payment) => ({
            method: payment.method,
            amount: Number(payment.amount),
            reference_number: payment.reference_number ?? null,
            notes: payment.notes ?? null,
            financial_account_id: payment.financial_account_id ?? null,
        })),
    );

export const resolveCashierPaymentAttempt = (
    currentKey: string | null,
    currentSignature: string | null,
    payments: CashierPayment[],
    createKey: () => string,
): { key: string; signature: string } => {
    const signature = cashierPaymentSignature(payments);
    const key =
        !currentKey ||
        (currentSignature !== null && currentSignature !== signature)
            ? createKey()
            : currentKey;

    return { key, signature };
};

export const queueEntryKind = (
    entryType: string | null | undefined,
): QueueEntryKind | null => {
    const kinds = Object.keys(QUEUE_ENTRY_TYPE) as QueueEntryKind[];

    return kinds.find((kind) => QUEUE_ENTRY_TYPE[kind] === entryType) ?? null;
};
