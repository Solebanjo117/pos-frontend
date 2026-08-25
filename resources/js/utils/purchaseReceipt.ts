type ReceiptItem = {
    item_id: number;
    quantity_received: number;
    batch_number?: string;
    expiry_date?: string;
    sale_price?: number;
};

export function purchaseReceiptSignature(items: ReceiptItem[]): string {
    return JSON.stringify(
        items
            .map((item) => ({
                item_id: Number(item.item_id),
                quantity_received: Number(item.quantity_received),
                batch_number: item.batch_number?.trim() || null,
                expiry_date: item.expiry_date || null,
                sale_price:
                    item.sale_price == null ? null : Number(item.sale_price),
            }))
            .sort((left, right) => left.item_id - right.item_id),
    );
}
