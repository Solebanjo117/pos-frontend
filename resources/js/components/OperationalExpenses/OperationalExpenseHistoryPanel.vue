<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { operationalExpensesService } from '@/services/operational-expenses';
import type {
    OperationalExpense,
    OperationalExpensePartyType,
} from '@/types/operational-expense';
import { formatCurrency, formatReportDate } from '@/utils/formatters';

const props = defineProps<{
    partyType: OperationalExpensePartyType;
    partyId: number;
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const expenses = ref<OperationalExpense[]>([]);
const total = ref(0);
const dateFrom = ref('');
const dateTo = ref('');
const category = ref('');

async function load() {
    loading.value = true;
    error.value = null;
    try {
        const response = await operationalExpensesService.list({
            party_type: props.partyType,
            party_id: props.partyId,
            date_from: dateFrom.value || undefined,
            date_to: dateTo.value || undefined,
            category: category.value,
            per_page: 100,
        });
        expenses.value = response.data;
        total.value = response.summary.total_amount;
    } catch (e: any) {
        error.value = e.response?.data?.message || 'No se pudo cargar el historial de gastos.';
    } finally {
        loading.value = false;
    }
}

watch(() => [props.partyType, props.partyId], load);
onMounted(load);
</script>

<template>
    <section class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card">
        <div class="flex flex-wrap items-end gap-3 border-b border-gray-200 p-4 dark:border-border">
            <div>
                <label class="mb-1 block text-xs font-semibold text-gray-500 uppercase">Desde</label>
                <input v-model="dateFrom" type="date" class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-muted" />
            </div>
            <div>
                <label class="mb-1 block text-xs font-semibold text-gray-500 uppercase">Hasta</label>
                <input v-model="dateTo" type="date" class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-muted" />
            </div>
            <div class="min-w-48 flex-1">
                <label class="mb-1 block text-xs font-semibold text-gray-500 uppercase">Categoria</label>
                <input v-model="category" type="search" placeholder="Slug de categoria" class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-border dark:bg-muted" />
            </div>
            <button type="button" class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" @click="load">Filtrar</button>
            <div class="ml-auto text-right">
                <p class="text-xs text-gray-500">Total relacionado</p>
                <p class="font-mono text-lg font-bold">{{ formatCurrency(total) }}</p>
            </div>
        </div>
        <p v-if="error" class="p-4 text-sm text-red-600">{{ error }}</p>
        <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
                <thead class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/50">
                    <tr><th class="px-4 py-3 text-left">Fecha</th><th class="px-4 py-3 text-left">Categoria</th><th class="px-4 py-3 text-left">Concepto</th><th class="px-4 py-3 text-left">Metodo</th><th class="px-4 py-3 text-right">Monto</th></tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-border">
                    <tr v-if="loading"><td colspan="5" class="px-4 py-8 text-center text-gray-500">Cargando historial...</td></tr>
                    <tr v-else-if="expenses.length === 0"><td colspan="5" class="px-4 py-8 text-center text-gray-500">No hay gastos relacionados.</td></tr>
                    <tr v-for="expense in expenses" v-else :key="expense.id">
                        <td class="px-4 py-3">{{ formatReportDate(expense.expense_date) }}</td>
                        <td class="px-4 py-3">{{ expense.category_label }}</td>
                        <td class="px-4 py-3">{{ expense.description || expense.notes || '-' }}</td>
                        <td class="px-4 py-3">{{ expense.payment_method_label || '-' }}</td>
                        <td class="px-4 py-3 text-right font-mono font-semibold">{{ formatCurrency(expense.amount) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>
</template>
