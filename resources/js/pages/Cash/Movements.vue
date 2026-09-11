<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import {
    ArrowDownToLine,
    ArrowUpFromLine,
    Banknote,
    Clock3,
    Send,
} from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { cashOperationsService } from '@/services/cash-operations';
import { formatReportDateTime } from '@/utils/formatters';
import { createIdempotencyKey } from '@/utils/idempotency';

const initialType = new URL(window.location.href).searchParams.get('type');
const operationType = ref<'cash_in' | 'cash_out'>(
    initialType === 'out' ? 'cash_out' : 'cash_in',
);
const amount = ref<number | null>(null);
const notes = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);
const sent = ref(false);
const idempotencyKey = ref(createIdempotencyKey());
const now = ref(new Date());
let timer: ReturnType<typeof setInterval> | null = null;

const canSubmit = computed(() => Number(amount.value) > 0 && !submitting.value);
const requestTime = computed(() => formatReportDateTime(now.value));

async function submit(): Promise<void> {
    if (!canSubmit.value || amount.value === null) return;
    submitting.value = true;
    error.value = null;
    try {
        await cashOperationsService.create({
            operation_type: operationType.value,
            amount: amount.value,
            notes: notes.value.trim() || undefined,
            idempotency_key: idempotencyKey.value,
        });
        sent.value = true;
        amount.value = null;
        notes.value = '';
        idempotencyKey.value = createIdempotencyKey();
    } catch (exception: any) {
        error.value =
            exception.response?.data?.message ||
            'No se pudo enviar la solicitud a Caja.';
    } finally {
        submitting.value = false;
    }
}

onMounted(() => {
    timer = setInterval(() => (now.value = new Date()), 1000);
});
onUnmounted(() => {
    if (timer) clearInterval(timer);
});
</script>

<template>
    <Head title="Agregar / Retirar" />
    <AppLayout :show-warehouse-selector="false">
        <main class="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
            <header class="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p
                        class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                    >
                        Caja · Operaciones
                    </p>
                    <h1 class="mt-1 text-2xl font-semibold">
                        Agregar / Retirar
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        La solicitud llegará a la cola y afectará el efectivo
                        cuando un cajero la confirme.
                    </p>
                </div>
                <Link
                    href="/cash"
                    class="rounded-md border px-3 py-2 text-sm hover:bg-muted"
                    >Volver a Caja</Link
                >
            </header>

            <div
                v-if="sent"
                class="flex items-center justify-between gap-3 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
            >
                <span>Solicitud enviada correctamente.</span>
                <Link href="/pos/cashier" class="font-semibold underline"
                    >Ver cola</Link
                >
            </div>
            <form class="rounded-lg border bg-card" @submit.prevent="submit">
                <div class="grid gap-5 p-5 sm:p-6">
                    <div class="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            class="flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm font-semibold"
                            :class="
                                operationType === 'cash_in'
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                                    : 'hover:bg-muted'
                            "
                            @click="operationType = 'cash_in'"
                        >
                            <ArrowDownToLine class="size-4" /> Agregar
                        </button>
                        <button
                            type="button"
                            class="flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm font-semibold"
                            :class="
                                operationType === 'cash_out'
                                    ? 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200'
                                    : 'hover:bg-muted'
                            "
                            @click="operationType = 'cash_out'"
                        >
                            <ArrowUpFromLine class="size-4" /> Retirar
                        </button>
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <label class="space-y-1.5 text-sm">
                            <span class="font-medium">Día y hora</span>
                            <span
                                class="flex min-h-10 items-center gap-2 rounded-md border bg-muted/40 px-3 text-muted-foreground"
                                ><Clock3 class="size-4" />
                                {{ requestTime }}</span
                            >
                        </label>
                        <label class="space-y-1.5 text-sm">
                            <span class="font-medium">Método</span>
                            <span
                                class="flex min-h-10 items-center gap-2 rounded-md border bg-muted/40 px-3"
                                ><Banknote class="size-4" /> Efectivo</span
                            >
                        </label>
                    </div>
                    <label class="space-y-1.5 text-sm">
                        <span class="font-medium">Monto *</span>
                        <input
                            v-model.number="amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                            class="w-full rounded-md border bg-background px-3 py-2 text-right text-xl font-semibold tabular-nums"
                            placeholder="0.00"
                        />
                    </label>
                    <label class="space-y-1.5 text-sm">
                        <span class="font-medium">Notas</span>
                        <textarea
                            v-model="notes"
                            rows="3"
                            maxlength="1000"
                            class="w-full rounded-md border bg-background px-3 py-2"
                            placeholder="Información opcional para el cajero"
                        />
                    </label>
                    <p
                        v-if="error"
                        role="alert"
                        class="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200"
                    >
                        {{ error }}
                    </p>
                </div>
                <div
                    class="flex justify-end border-t bg-muted/20 px-5 py-4 sm:px-6"
                >
                    <button
                        type="submit"
                        :disabled="!canSubmit"
                        class="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Send class="size-4" />
                        {{ submitting ? 'Enviando…' : 'Enviar a caja' }}
                    </button>
                </div>
            </form>
        </main>
    </AppLayout>
</template>
