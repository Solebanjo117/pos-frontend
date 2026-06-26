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

const props = defineProps<{
    open: boolean;
    defaultType?: 'cash' | 'inventory';
    warehouseId?: number | null;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (
        e: 'submit',
        payload: {
            type: 'cash' | 'inventory';
            amount: number;
            reason: string;
            adjustment_date: string;
            notes: string;
        },
    ): void;
}>();

const type = ref<'cash' | 'inventory'>('cash');
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
                <div class="flex gap-2">
                    <button
                        type="button"
                        class="flex-1 rounded-md border px-3 py-2 text-xs font-semibold transition"
                        :class="
                            type === 'cash'
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/30 dark:text-indigo-300'
                                : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400'
                        "
                        @click="type = 'cash'"
                    >
                        Cash
                    </button>
                    <button
                        type="button"
                        class="flex-1 rounded-md border px-3 py-2 text-xs font-semibold transition"
                        :class="
                            type === 'inventory'
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/30 dark:text-indigo-300'
                                : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400'
                        "
                        @click="type = 'inventory'"
                    >
                        Inventory
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
