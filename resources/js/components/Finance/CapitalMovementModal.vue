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
import { createIdempotencyKey } from '@/utils/idempotency';

const props = defineProps<{
    open: boolean;
    defaultType?: 'in' | 'out';
    warehouseId?: number | null;
    loading?: boolean;
    error?: string | null;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (
        e: 'submit',
        payload: {
            movement_type: 'in' | 'out';
            amount: number;
            reason: string;
            movement_date: string;
            notes: string;
            idempotency_key: string;
        },
    ): void;
}>();

const movementType = ref<'in' | 'out'>('in');
const amount = ref<number>(0);
const reason = ref('');
const movementDate = ref(new Date().toISOString().split('T')[0]);
const notes = ref('');
const idempotencyKey = ref('');
const submitted = ref(false);

watch(
    () => props.open,
    (open) => {
        if (open) {
            movementType.value = props.defaultType ?? 'in';
            amount.value = 0;
            reason.value = '';
            movementDate.value = new Date().toISOString().split('T')[0];
            notes.value = '';
            idempotencyKey.value = createIdempotencyKey();
            submitted.value = false;
        }
    },
    { immediate: true },
);
watch(
    () => props.loading,
    (loading) => {
        if (!loading) submitted.value = false;
    },
);

const submit = () => {
    if (
        props.loading ||
        submitted.value ||
        !reason.value.trim() ||
        amount.value <= 0
    )
        return;
    submitted.value = true;
    emit('submit', {
        movement_type: movementType.value,
        amount: amount.value,
        reason: reason.value,
        movement_date: movementDate.value,
        notes: notes.value,
        idempotency_key: idempotencyKey.value,
    });
};
</script>

<template>
    <Dialog :open="open" @update:open="(value) => emit('update:open', value)">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Movimiento de inversion</DialogTitle>
            </DialogHeader>
            <div
                v-if="error"
                role="alert"
                class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
                {{ error }}
            </div>
            <div class="space-y-3 py-2">
                <div class="flex gap-2">
                    <button
                        type="button"
                        class="flex-1 rounded-md border px-3 py-2 text-xs font-semibold transition"
                        :class="
                            movementType === 'in'
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-300'
                                : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400'
                        "
                        @click="movementType = 'in'"
                        :disabled="loading"
                    >
                        Aporte
                    </button>
                    <button
                        type="button"
                        class="flex-1 rounded-md border px-3 py-2 text-xs font-semibold transition"
                        :class="
                            movementType === 'out'
                                ? 'border-rose-600 bg-rose-50 text-rose-700 dark:border-rose-500 dark:bg-rose-950/30 dark:text-rose-300'
                                : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400'
                        "
                        @click="movementType = 'out'"
                        :disabled="loading"
                    >
                        Retiro
                    </button>
                </div>
                <div>
                    <Label class="text-xs">Monto</Label>
                    <Input
                        v-model.number="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        class="mt-1"
                        placeholder="0.00"
                    />
                </div>
                <div>
                    <Label class="text-xs">Motivo</Label>
                    <Input
                        v-model="reason"
                        class="mt-1"
                        placeholder="Aporte de socio, retiro, banco, etc."
                    />
                </div>
                <div>
                    <Label class="text-xs">Fecha</Label>
                    <Input v-model="movementDate" type="date" class="mt-1" />
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
                    :disabled="loading"
                    @click="emit('update:open', false)"
                    >Cancelar</Button
                >
                <Button
                    size="sm"
                    :disabled="
                        loading || submitted || !reason.trim() || amount <= 0
                    "
                    @click="submit"
                    >{{ loading ? 'Guardando…' : 'Guardar' }}</Button
                >
            </div>
        </DialogContent>
    </Dialog>
</template>
