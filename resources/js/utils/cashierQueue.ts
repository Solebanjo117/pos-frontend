export const QUEUE_ENTRY_TYPE = {
    sale: 'sale_collection',
    expense: 'expense_payment',
    return: 'sales_return_refund',
} as const;

export type QueueEntryKind = keyof typeof QUEUE_ENTRY_TYPE;

export type QueueEntryWireType = (typeof QUEUE_ENTRY_TYPE)[QueueEntryKind];

export const queueEntryKind = (
    entryType: string | null | undefined,
): QueueEntryKind | null => {
    const kinds = Object.keys(QUEUE_ENTRY_TYPE) as QueueEntryKind[];

    return kinds.find((kind) => QUEUE_ENTRY_TYPE[kind] === entryType) ?? null;
};
