/** Gama de una marca: cada marca es Standard o Premium. */
export type BrandTier = 'standard' | 'premium';

export const BRAND_TIER_OPTIONS: { value: BrandTier; label: string }[] = [
    { value: 'standard', label: 'Standard' },
    { value: 'premium', label: 'Premium' },
];

/** Las marcas sin gama (datos antiguos) se tratan como Standard, igual que en la base de datos. */
export const normalizeBrandTier = (tier: unknown): BrandTier =>
    tier === 'premium' ? 'premium' : 'standard';

export const brandTierLabel = (tier: unknown): string =>
    normalizeBrandTier(tier) === 'premium' ? 'Premium' : 'Standard';

/** Nombre de la marca con su gama, para los selectores: "555 (Premium)". */
export const brandOptionLabel = (brand: {
    name: string;
    tier?: unknown;
}): string => `${brand.name} (${brandTierLabel(brand.tier)})`;
