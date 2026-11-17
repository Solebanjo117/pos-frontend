import apiClient from '@/services/api/client';

/** Un proveedor de una marca: con qué código la vende y cuánto se le pagó en la última compra. */
export interface VariantSupplierRow {
    supplier_id: number;
    supplier_name: string | null;
    supplier_code: string | null;
    supplier_cost: number;
    last_purchased_at: string | null;
    lead_time_days: number;
    minimum_order_quantity: number;
    /** El más barato: el sistema lo propone al pedir (se puede escoger otro). */
    is_default: boolean;
}

export interface VariantSupplierPayload {
    supplier_code?: string | null;
    supplier_cost: number;
}

const base = (productId: number, variantId: number) =>
    `/products/${productId}/variants/${variantId}/suppliers`;

export const variantSuppliersService = {
    async list(
        productId: number,
        variantId: number,
    ): Promise<VariantSupplierRow[]> {
        const { data } = await apiClient.get(base(productId, variantId));
        return data.data ?? [];
    },

    async save(
        productId: number,
        variantId: number,
        supplierId: number,
        payload: VariantSupplierPayload,
    ): Promise<VariantSupplierRow[]> {
        const { data } = await apiClient.put(
            `${base(productId, variantId)}/${supplierId}`,
            payload,
        );
        return data.data ?? [];
    },

    async remove(
        productId: number,
        variantId: number,
        supplierId: number,
    ): Promise<VariantSupplierRow[]> {
        const { data } = await apiClient.delete(
            `${base(productId, variantId)}/${supplierId}`,
        );
        return data.data ?? [];
    },

    /** Proveedor de un lote sin compra (existencia inicial o ajuste). */
    async assignLotSupplier(
        lotId: number,
        supplierId: number | null,
    ): Promise<{ id: number; supplier: { id: number; name: string } | null }> {
        const { data } = await apiClient.patch(
            `/inventory/lots/${lotId}/supplier`,
            { supplier_id: supplierId },
        );
        return data.data;
    },
};
