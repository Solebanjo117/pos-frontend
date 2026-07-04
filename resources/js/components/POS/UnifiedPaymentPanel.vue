<script setup lang="ts">
import OperationalPaymentPanel from '@/components/POS/OperationalPaymentPanel.vue';
import type { Customer } from '@/types/customer';

interface Payment {
    method: string;
    amount: number;
    reference_number?: string | null;
    notes?: string | null;
}

defineProps<{
    show: boolean;
    amountToCharge: number;
    customer?: Customer | null;
    shippingCost?: number;
    editMode?: boolean;
    subtotal?: number;
    taxAmount?: number;
    discountAmount?: number;
}>();

const emit = defineEmits<{
    (e: 'finish', payments: Payment[]): void;
    (e: 'cancel'): void;
}>();

function handleFinish(payments: Payment[]) {
    emit('finish', payments);
}
</script>

<template>
    <OperationalPaymentPanel
        mode="sale"
        :show="show"
        :amount-to-charge="amountToCharge"
        :customer="customer"
        :shipping-cost="shippingCost"
        :edit-mode="editMode"
        :subtotal="subtotal"
        :tax-amount="taxAmount"
        :discount-amount="discountAmount"
        @finish="handleFinish"
        @cancel="emit('cancel')"
    />
</template>
