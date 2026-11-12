<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppModal from '@/components/ui/AppModal.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import { Button } from '@/components/ui/button';
import ErrorMessage from '@/components/ui/ErrorMessage.vue';
import apiClient from '@/services/api/client';

/**
 * Ajuste de existencia de una marca (variante) en un almacén. No se sobrescribe el número: el
 * backend registra un movimiento de entrada o salida por la diferencia, con su motivo y nota.
 */
const props = defineProps<{
    open: boolean;
    productId: number;
    variantId: number;
    warehouseId: number | null;
    currentQuantity: number;
    label?: string;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    saved: [quantity: number];
}>();

const STOCK_ADJUST_REASONS = [
    'Conteo físico',
    'Daño',
    'Pérdida o robo',
    'Corrección de error',
    'Otro',
] as const;

const reasonOptions = STOCK_ADJUST_REASONS.map((reason) => ({
    value: reason,
    label: reason,
}));

const newQuantity = ref<number | null>(null);
const reason = ref<string>('');
const notes = ref('');
const saving = ref(false);
const errorMessage = ref('');

watch(
    () => props.open,
    (open) => {
        if (open) {
            newQuantity.value = props.currentQuantity;
            reason.value = '';
            notes.value = '';
            errorMessage.value = '';
        }
    },
    { immediate: true },
);

const difference = computed(() =>
    newQuantity.value === null || Number.isNaN(newQuantity.value)
        ? 0
        : newQuantity.value - props.currentQuantity,
);

const validationMessage = computed(() => {
    if (!props.warehouseId) return 'No hay un almacén seleccionado.';
    if (
        newQuantity.value === null ||
        !Number.isInteger(newQuantity.value) ||
        newQuantity.value < 0
    )
        return 'La cantidad debe ser un número entero, cero o mayor.';
    if (difference.value === 0) return 'La cantidad es igual a la actual.';
    if (!reason.value) return 'Selecciona el motivo del ajuste.';
    if (reason.value === 'Otro' && !notes.value.trim())
        return 'Escribe una nota que explique el ajuste.';
    return '';
});

const close = () => emit('update:open', false);

const save = async () => {
    if (validationMessage.value || saving.value) return;
    saving.value = true;
    errorMessage.value = '';
    try {
        const response = await apiClient.put(
            `/inventory/products/${props.productId}/warehouses/${props.warehouseId}`,
            {
                variant_id: props.variantId,
                stock_available: newQuantity.value,
                reason: reason.value,
                notes: notes.value.trim() || null,
            },
        );
        const saved = Number(
            response.data?.data?.quantity_available ?? newQuantity.value,
        );
        emit('saved', saved);
        close();
    } catch (error: any) {
        errorMessage.value =
            error?.response?.data?.message ??
            'No se pudo ajustar la existencia. Intenta de nuevo.';
    } finally {
        saving.value = false;
    }
};
</script>

<template>
    <AppModal
        :open="open"
        title="Ajustar existencia"
        :description="label"
        size="sm"
        @update:open="(value) => emit('update:open', value)"
    >
        <form class="space-y-4" @submit.prevent="save">
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <span
                        class="mb-1 block text-sm font-medium text-muted-foreground"
                        >Actual</span
                    >
                    <p
                        data-test="current-quantity"
                        class="flex h-9 items-center text-base font-semibold"
                    >
                        {{ currentQuantity }}
                    </p>
                </div>
                <div>
                    <label
                        for="stock-adjust-quantity"
                        class="mb-1 block text-sm font-medium"
                        >Cantidad nueva</label
                    >
                    <input
                        id="stock-adjust-quantity"
                        v-model.number="newQuantity"
                        data-test="new-quantity"
                        type="number"
                        min="0"
                        step="1"
                        class="h-9 w-full rounded-md border border-input bg-transparent px-3 text-right text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                    />
                </div>
            </div>

            <p
                v-if="difference !== 0"
                data-test="difference"
                class="text-sm"
                :class="
                    difference > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                "
            >
                {{
                    difference > 0
                        ? `Se registrará una entrada de ${difference}.`
                        : `Se registrará una salida de ${Math.abs(difference)}.`
                }}
            </p>

            <div>
                <span class="mb-1 block text-sm font-medium">Motivo</span>
                <AppSelect
                    v-model="reason"
                    :options="reasonOptions"
                    placeholder="Seleccionar motivo..."
                    aria-label="Motivo del ajuste"
                />
            </div>

            <div>
                <label
                    for="stock-adjust-notes"
                    class="mb-1 block text-sm font-medium"
                    >Nota
                    <span class="font-normal text-muted-foreground">{{
                        reason === 'Otro' ? '(obligatoria)' : '(opcional)'
                    }}</span></label
                >
                <textarea
                    id="stock-adjust-notes"
                    v-model="notes"
                    data-test="notes"
                    rows="2"
                    maxlength="500"
                    class="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                />
            </div>

            <ErrorMessage v-if="errorMessage">{{ errorMessage }}</ErrorMessage>
        </form>

        <template #footer>
            <p
                v-if="validationMessage && difference !== 0"
                class="mr-auto text-xs text-muted-foreground"
            >
                {{ validationMessage }}
            </p>
            <Button type="button" variant="outline" @click="close"
                >Cancelar</Button
            >
            <Button
                type="button"
                data-test="save-adjustment"
                :disabled="Boolean(validationMessage) || saving"
                @click="save"
            >
                {{ saving ? 'Guardando...' : 'Guardar ajuste' }}
            </Button>
        </template>
    </AppModal>
</template>
