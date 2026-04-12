export interface PricingFormula {
    id: number
    name: string
    formula: string
    description: string | null
    is_preset: boolean
    is_active: boolean
    sort_order: number
    created_at?: string
    updated_at?: string
}
