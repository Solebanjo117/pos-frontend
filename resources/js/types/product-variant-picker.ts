import type { Product, ProductVariant } from '@/types/product';

export interface ProductVariantSelection {
    product: Product;
    variant: ProductVariant | null;
    quantity: number;
    unitCost?: number;
    supplierMatch?: boolean;
    minimumOrderQuantity?: number | null;
    leadTimeDays?: number | null;
}
