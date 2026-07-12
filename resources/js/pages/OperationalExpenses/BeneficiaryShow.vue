<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { ArrowLeft, Building2, UserRound } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import OperationalExpenseHistoryPanel from '@/components/OperationalExpenses/OperationalExpenseHistoryPanel.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { operationalExpensesService } from '@/services/operational-expenses';
import type { OperationalExpenseBeneficiary } from '@/types/operational-expense';

defineOptions({ layout: AppLayout });
const props = defineProps<{ beneficiaryId: number }>();
const beneficiary = ref<OperationalExpenseBeneficiary | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
    try {
        beneficiary.value = await operationalExpensesService.getBeneficiary(props.beneficiaryId);
    } catch (e: any) {
        error.value = e.response?.data?.message || 'No se pudo cargar el beneficiario.';
    }
});
</script>

<template>
    <Head :title="beneficiary?.name || 'Beneficiario'" />
    <div class="min-h-[calc(100vh-4rem)] bg-gray-50/60 p-4 dark:bg-background">
        <div class="mx-auto max-w-6xl space-y-4">
            <Link href="/operational-expenses" class="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white"><ArrowLeft :size="16" /> Gastos</Link>
            <p v-if="error" class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
            <template v-if="beneficiary">
                <header class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card">
                    <div class="rounded-lg bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                        <Building2 v-if="beneficiary.type === 'company'" :size="22" />
                        <UserRound v-else :size="22" />
                    </div>
                    <div><h1 class="text-xl font-bold">{{ beneficiary.name }}</h1><p class="text-sm text-gray-500">{{ beneficiary.type === 'company' ? 'Empresa beneficiaria' : 'Beneficiario' }}</p></div>
                </header>
                <OperationalExpenseHistoryPanel party-type="beneficiary" :party-id="beneficiary.id" />
            </template>
        </div>
    </div>
</template>
