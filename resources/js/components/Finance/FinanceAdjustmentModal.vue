<script setup lang="ts">
import { ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FinancialAdjustmentType } from '@/types/report';

const props = defineProps<{
    open: boolean;
    defaultType?: FinancialAdjustmentType;
    warehouseId?: number | null;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (
        e: 'submit',
        payload: {
            type: FinancialAdjustmentType;
            amount: number;
            reason: string;
            adjustment_date: string;
            notes: string;
        },
    ): void;
}>();

const adjustmentTypes: Array<{
    value: FinancialAdjustmentType;
    label: string;
}> = [
    { value: 'cash', label: 'Cash' },
    { value: 'bank', label: 'Banco' },
    { value: 'inventory', label: 'Inventario' },
    { value: 'sales', label: 'Ventas' },
    { value: 'purchases', label: 'Compras' },
    { value: 'expenses', label: 'Gastos' },
    { value: 'investment', label: 'Inversion' },
    { value: 'accounts_receivable', label: 'CxC' },
    { value: 'accounts_payable', label: 'CxP' },
    { value: 'manual_correction', label: 'Manual' },
];

const type = ref<FinancialAdjustmentType>('cash');
const amount = ref<number>(0);
const reason = ref('');
const adjustmentDate = ref(new Date().toISOString().split('T')[0]);
const notes = ref('');

watch(
    () => props.open,
    (open) => {
        if (open) {
            type.value = props.defaultType ?? 'cash';
            amount.value = 0;
            reason.value = '';
            adjustmentDate.value = new Date().toISOString().split('T')[0];
            notes.value = '';
        }
    },
);

const submit = () => {
    if (!reason.value.trim() || amount.value === 0) return;
    emit('submit', {
        type: type.value,
        amount: amount.value,
        reason: reason.value,
        adjustment_date: adjustmentDate.value,
        notes: notes.value,
    });
    emit('update:open', false);
};
</script>

<template>
    <Dialog :open="open" @update:open="(value) => emit('update:open', value)">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Ajustar</DialogTitle>
            </DialogHeader>
            <div class="space-y-3 py-2">
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <button
                        v-for="option in adjustmentTypes"
                        :key="option.value"
                        type="button"
                        class="rounded-md border px-3 py-2 text-xs font-semibold transition"
                        :class="
                            type === option.value
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/30 dark:text-indigo-300'
                                : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400'
                        "
                        @click="type = option.value"
                    >
                        {{ option.label }}
                    </button>
                </div>
                <div>
                    <Label class="text-xs">Monto (positivo o negativo)</Label>
                    <Input
                        v-model.number="amount"
                        type="number"
                        step="0.01"
                        class="mt-1"
                        placeholder="0.00"
                    />
                </div>
                <div>
                    <Label class="text-xs">Motivo</Label>
                    <Input
                        v-model="reason"
                        class="mt-1"
                        placeholder="Cuadre de caja, merma, etc."
                    />
                </div>
                <div>
                    <Label class="text-xs">Fecha</Label>
                    <Input v-model="adjustmentDate" type="date" class="mt-1" />
                </div>
                <div>
                    <Label class="text-xs">Notas (opcional)</Label>
                    <Input
                        v-model="notes"
                        class="mt-1"
                        placeholder="Detalle adicional"
                    />
                </div>
            </div>
            <div class="flex justify-end gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    @click="emit('update:open', false)"
                    >Cancelar</Button
                >
                <Button size="sm" @click="submit">Guardar</Button>
            </div>
        </DialogContent>
    </Dialog>
</template>
