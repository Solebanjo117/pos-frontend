export interface PaymentMethod {
    id: number
    name: string
    code: string
    is_active: boolean
    is_system: boolean
    requires_reference: boolean
    requires_cash_count: boolean
    sort_order: number
    created_at?: string
    updated_at?: string
}

export interface CreatePaymentMethodData {
    name: string
    requires_reference?: boolean
    requires_cash_count?: boolean
}

export interface UpdatePaymentMethodData {
    name?: string
    is_active?: boolean
    requires_reference?: boolean
    requires_cash_count?: boolean
    sort_order?: number
}
