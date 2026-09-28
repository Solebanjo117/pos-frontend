import { createIdempotencyKey } from '@/utils/idempotency';

export interface OriginalOrderItem {
    id: number;
    product_id: number | null;
    variant_id?: number | null;
    warehouse_id: number;
    quantity: number;
    unit_price: number | string;
    discount_amount?: number | string | null;
    discount_percent?: number | string | null;
    tax_percent: number | string;
    total?: number | string | null;
    seller_id?: number | null;
    is_custom_line?: boolean;
    custom_description?: string | null;
    notes?: string | null;
}

export interface AmendmentCartItem {
    order_item_id?: number;
    product_id: number | null;
    variant_id?: number | null;
    warehouse_id?: number | null;
    quantity: number;
    product_price: number;
    discount_amount?: number;
    discount_percent?: number;
    tax_percent: number;
    seller_id?: number | null;
    is_custom_line?: boolean;
    custom_description?: string | null;
    notes?: string | null;
}

export interface AmendmentOrder {
    id: number;
    total: number | string;
    items: OriginalOrderItem[];
}

export interface AmendmentPayment {
    method: string;
    amount: number;
    reference_number?: string | null;
    financial_account_id?: number | null;
    notes?: string | null;
}

export interface AmendmentItemPayload {
    order_item_id?: number;
    product_id: number | null;
    variant_id: number | null;
    warehouse_id: number;
    qty: number;
    price: number;
    discount_amount?: number;
    discount_percent?: number;
    tax_percent: number;
    seller_id: number | null;
    is_custom_line: boolean;
    custom_description: string | null;
    notes: string | null;
}

export interface AmendmentPreview {
    order_id: number;
    expected_total: number;
    warehouse_id: number;
    items: AmendmentItemPayload[];
    difference: number;
}

export interface AmendmentPayload {
    idempotency_key: string;
    expected_total: number;
    warehouse_id: number;
    items: AmendmentItemPayload[];
    payment: AmendmentPayment[];
}

const cents = (value: number | string | null | undefined): number =>
    Math.round((Number(value ?? 0) + Number.EPSILON) * 100);

const lineTotalCents = (
    quantity: number,
    price: number,
    discountAmount: number,
    taxPercent: number,
): number => {
    const gross = cents(quantity * price);
    const subtotal = gross - cents(discountAmount);
    return subtotal + Math.round((subtotal * taxPercent) / 100);
};

const requiredQuantity = (quantity: number): number => {
    if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error('La cantidad debe ser un entero mayor que cero.');
    }
    return quantity;
};

export function previewSalesOrderAmendment(
    order: AmendmentOrder,
    cart: AmendmentCartItem[],
    warehouseId: number,
): AmendmentPreview {
    if (!Number.isInteger(warehouseId) || warehouseId < 1) {
        throw new Error('Selecciona una sucursal para ampliar la transacción.');
    }

    const originals = new Map(order.items.map((item) => [item.id, item]));
    const seenOriginals = new Set<number>();
    const items: AmendmentItemPayload[] = [];
    let differenceCents = 0;

    for (const item of cart) {
        const quantity = requiredQuantity(item.quantity);
        const itemWarehouseId = item.warehouse_id ?? warehouseId;
        if (itemWarehouseId !== warehouseId) {
            throw new Error(
                'Todos los artículos deben pertenecer a la sucursal activa.',
            );
        }

        if (item.order_item_id !== undefined) {
            const original = originals.get(item.order_item_id);
            if (!original || seenOriginals.has(item.order_item_id)) {
                throw new Error(
                    'Una línea original de la transacción no es válida.',
                );
            }
            seenOriginals.add(item.order_item_id);
            if (original.warehouse_id !== warehouseId) {
                throw new Error(
                    'La transacción no pertenece a la sucursal activa.',
                );
            }
            if (quantity < original.quantity) {
                throw new Error('Para reducir cantidades usa Devoluciones.');
            }
            if (quantity === original.quantity) continue;

            const price = Number(original.unit_price);
            const discountAmount = Number(original.discount_amount ?? 0);
            const taxPercent = Number(original.tax_percent);
            const originalTotal =
                original.total === null || original.total === undefined
                    ? lineTotalCents(
                          original.quantity,
                          price,
                          discountAmount,
                          taxPercent,
                      )
                    : cents(original.total);
            const amendedTotal = lineTotalCents(
                quantity,
                price,
                discountAmount,
                taxPercent,
            );
            differenceCents += amendedTotal - originalTotal;
            items.push({
                order_item_id: original.id,
                product_id: original.product_id,
                variant_id: original.variant_id ?? null,
                warehouse_id: original.warehouse_id,
                qty: quantity,
                price,
                discount_amount: discountAmount,
                discount_percent: Number(original.discount_percent ?? 0),
                tax_percent: taxPercent,
                seller_id: original.seller_id ?? null,
                is_custom_line: !!original.is_custom_line,
                custom_description: original.custom_description ?? null,
                notes: original.notes ?? null,
            });
            continue;
        }

        if (!item.is_custom_line && !item.product_id) {
            throw new Error('Selecciona un producto para la línea nueva.');
        }
        if (item.is_custom_line && !item.custom_description?.trim()) {
            throw new Error('Indica la descripción del artículo nuevo.');
        }
        const price = Number(item.product_price);
        const taxPercent = Number(item.tax_percent);
        const gross = cents(quantity * price);
        const discountAmount =
            item.discount_amount === undefined
                ? Math.round(
                      (gross * Number(item.discount_percent ?? 0)) / 100,
                  ) / 100
                : Number(item.discount_amount);
        if (
            !Number.isFinite(price) ||
            price < 0 ||
            !Number.isFinite(discountAmount) ||
            discountAmount < 0 ||
            cents(discountAmount) > gross ||
            !Number.isInteger(taxPercent) ||
            taxPercent < 0 ||
            taxPercent > 100
        ) {
            throw new Error('Revisa el precio y descuento de la línea nueva.');
        }
        differenceCents += lineTotalCents(
            quantity,
            price,
            discountAmount,
            taxPercent,
        );
        items.push({
            product_id: item.is_custom_line ? null : item.product_id,
            variant_id: item.is_custom_line ? null : (item.variant_id ?? null),
            warehouse_id: itemWarehouseId,
            qty: quantity,
            price,
            ...(item.discount_amount === undefined
                ? { discount_percent: Number(item.discount_percent ?? 0) }
                : { discount_amount: discountAmount }),
            tax_percent: taxPercent,
            seller_id: item.seller_id ?? null,
            is_custom_line: !!item.is_custom_line,
            custom_description: item.is_custom_line
                ? (item.custom_description?.trim() ?? null)
                : null,
            notes: item.notes ?? null,
        });
    }

    if (seenOriginals.size !== originals.size) {
        throw new Error(
            'No puedes quitar artículos originales; usa Devoluciones.',
        );
    }
    if (items.length === 0 || differenceCents <= 0) {
        throw new Error(
            'Agrega artículos o aumenta una cantidad antes de cobrar.',
        );
    }

    return {
        order_id: order.id,
        expected_total: Number(order.total),
        warehouse_id: warehouseId,
        items,
        difference: differenceCents / 100,
    };
}

export function createSalesOrderAmendmentKeyResolver(): (
    preview: AmendmentPreview,
    payment: AmendmentPayment[],
) => AmendmentPayload {
    let lastSignature = '';
    let key = '';

    return (preview, payment) => {
        if (
            payment.some(
                (item) =>
                    !item.method ||
                    !Number.isFinite(item.amount) ||
                    cents(item.amount) <= 0,
            )
        ) {
            throw new Error('Revisa los métodos e importes del cobro.');
        }
        const normalizedPayment = payment.map((item) => ({
            method: item.method,
            amount: cents(item.amount) / 100,
            reference_number: item.reference_number ?? null,
            financial_account_id: item.financial_account_id ?? null,
            notes: item.notes ?? null,
        }));
        if (
            normalizedPayment.reduce(
                (sum, item) => sum + cents(item.amount),
                0,
            ) !== cents(preview.difference)
        ) {
            throw new Error(
                'Los pagos deben cubrir exactamente la diferencia.',
            );
        }

        const payload = {
            expected_total: preview.expected_total,
            warehouse_id: preview.warehouse_id,
            items: preview.items,
            payment: normalizedPayment,
        };
        const signature = JSON.stringify([preview.order_id, payload]);
        if (signature !== lastSignature) {
            key = createIdempotencyKey();
            lastSignature = signature;
        }
        return { idempotency_key: key, ...payload };
    };
}
