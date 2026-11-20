/**
 * ITBM por variante: solo se indica si aplica (Sí/No). La tasa es única para toda la
 * tienda y se cambia en Ajustes > Tienda.
 */
export type ItbmChoice = 'yes' | 'no';

/** "Sí" si la variante tiene una tasa mayor que 0 (incluye tasas antiguas distintas a la de la tienda). */
export const itbmChoiceFromRate = (rate: unknown): ItbmChoice => {
    const parsed = Number(rate);
    return Number.isFinite(parsed) && Math.round(parsed) > 0 ? 'yes' : 'no';
};

/** Tasa a guardar: la de la tienda si aplica, 0 si no. */
export const itbmRateFromChoice = (
    choice: ItbmChoice,
    storeTaxRate: number,
): number => (choice === 'yes' ? storeTaxRate : 0);
