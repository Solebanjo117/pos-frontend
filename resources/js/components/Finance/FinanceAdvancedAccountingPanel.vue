<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { BookOpen, Columns3, FileText, Scale } from 'lucide-vue-next';
import { ReportsApiService } from '@/services/reports';
import type {
    AccountingAccountSummary,
    AccountingAccountsReport,
    AccountingJournalEntry,
    AccountingLedgerReport,
    AccountingPaginatedReport,
    FinancialAdvancedStatusReport,
} from '@/types/report';
import { formatReportDateTime } from '@/utils/formatters';

type AccountingTab = 'journal' | 'accounts' | 'ledger' | 'trial_balance';

const props = defineProps<{
    filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
    };
    status: FinancialAdvancedStatusReport | null;
    currencyFormatter: (value: number) => string;
}>();

const activeTab = ref<AccountingTab>('journal');
const loading = ref(false);
const error = ref<string | null>(null);
const journal = ref<AccountingPaginatedReport<AccountingJournalEntry> | null>(
    null,
);
const accounts = ref<AccountingAccountsReport | null>(null);
const trialBalance = ref<AccountingAccountsReport | null>(null);
const selectedAccount = ref<AccountingAccountSummary | null>(null);
const ledger = ref<AccountingLedgerReport | null>(null);
const tAccount = ref<AccountingLedgerReport | null>(null);

const hasLedger = computed(
    () =>
        (props.status?.ledger?.journal_entries ?? 0) > 0 ||
        (journal.value?.summary?.entries ?? 0) > 0,
);

const tabs = [
    { key: 'journal', label: 'Diario', icon: FileText },
    { key: 'accounts', label: 'Cuentas', icon: BookOpen },
    { key: 'ledger', label: 'Mayor / T', icon: Columns3 },
    { key: 'trial_balance', label: 'Balance de comprobacion', icon: Scale },
] as const;

const loadAccounting = async (): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
        const [journalReport, accountsReport, trialReport] = await Promise.all([
            ReportsApiService.getAccountingJournal({
                ...props.filters,
                per_page: 15,
            }),
            ReportsApiService.getAccountingAccounts(props.filters),
            ReportsApiService.getAccountingTrialBalance(props.filters),
        ]);

        journal.value = journalReport;
        accounts.value = accountsReport;
        trialBalance.value = trialReport;

        if (!selectedAccount.value && accountsReport.data.length > 0) {
            await selectAccount(accountsReport.data[0]);
        }
    } catch (err: any) {
        error.value =
            err.response?.data?.message || 'No se pudo cargar contabilidad.';
    } finally {
        loading.value = false;
    }
};

const selectAccount = async (account: AccountingAccountSummary): Promise<void> => {
    selectedAccount.value = account;
    activeTab.value = 'ledger';
    loading.value = true;
    error.value = null;

    try {
        const [ledgerReport, tAccountReport] = await Promise.all([
            ReportsApiService.getAccountingAccountLedger(account.id, {
                ...props.filters,
                per_page: 20,
            }),
            ReportsApiService.getAccountingTAccount(account.id, {
                ...props.filters,
                per_page: 20,
            }),
        ]);

        ledger.value = ledgerReport;
        tAccount.value = tAccountReport;
    } catch (err: any) {
        error.value =
            err.response?.data?.message ||
            'No se pudo cargar el mayor de la cuenta.';
    } finally {
        loading.value = false;
    }
};

watch(
    () => props.filters,
    () => {
        void loadAccounting();
    },
    { deep: true },
);

onMounted(() => {
    void loadAccounting();
});
</script>

<template>
    <section class="space-y-3">
        <div
            class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
        >
            <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2
                        class="text-sm font-semibold text-slate-950 dark:text-slate-50"
                    >
                        Contabilidad avanzada
                    </h2>
                    <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Diario, mayor, cuentas T y balance formal desde asientos
                        contables reales.
                    </p>
                </div>
                <span
                    class="rounded-md border px-3 py-2 text-xs font-semibold"
                    :class="
                        hasLedger
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                    "
                >
                    {{
                        hasLedger
                            ? 'Contabilidad formal disponible'
                            : 'Contabilidad formal pendiente'
                    }}
                </span>
            </div>
        </div>

        <nav class="flex flex-wrap gap-2">
            <button
                v-for="tab in tabs"
                :key="tab.key"
                type="button"
                class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition"
                :class="
                    activeTab === tab.key
                        ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900'
                "
                @click="activeTab = tab.key"
            >
                <component :is="tab.icon" :size="15" />
                {{ tab.label }}
            </button>
        </nav>

        <div
            v-if="error"
            class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
        >
            {{ error }}
        </div>

        <div
            v-if="loading"
            class="rounded-lg border border-slate-200 bg-white px-3 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
        >
            Cargando contabilidad...
        </div>

        <div
            v-else-if="!hasLedger"
            class="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-950"
        >
            <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Contabilidad formal pendiente
            </p>
            <p class="mx-auto mt-2 max-w-xl text-xs text-slate-500">
                Los reportes avanzados no fabrican asientos desde Finanzas
                operativas. Cuando existan gastos o movimientos posteados al
                diario, apareceran aqui.
            </p>
        </div>

        <div v-else-if="activeTab === 'journal'" class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <table class="min-w-full text-xs tabular-nums">
                <thead class="bg-slate-50 dark:bg-slate-900">
                    <tr>
                        <th class="px-3 py-2 text-left font-semibold text-slate-500 uppercase">Fecha/Hora</th>
                        <th class="px-3 py-2 text-left font-semibold text-slate-500 uppercase">Origen</th>
                        <th class="px-3 py-2 text-left font-semibold text-slate-500 uppercase">Memo</th>
                        <th class="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Debito</th>
                        <th class="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Credito</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr v-for="entry in journal?.data ?? []" :key="entry.id" class="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                        <td class="px-3 py-2 text-slate-600 dark:text-slate-400">{{ formatReportDateTime(entry.occurred_at) }}</td>
                        <td class="px-3 py-2 text-slate-600 dark:text-slate-400">{{ entry.source_type }} #{{ entry.source_id ?? '-' }}</td>
                        <td class="px-3 py-2 text-slate-700 dark:text-slate-300">{{ entry.memo || '-' }}</td>
                        <td class="px-3 py-2 text-right font-semibold text-slate-900 dark:text-slate-100">{{ currencyFormatter(entry.debit) }}</td>
                        <td class="px-3 py-2 text-right font-semibold text-slate-900 dark:text-slate-100">{{ currencyFormatter(entry.credit) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-else-if="activeTab === 'accounts'" class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <table class="min-w-full text-xs tabular-nums">
                <thead class="bg-slate-50 dark:bg-slate-900">
                    <tr>
                        <th class="px-3 py-2 text-left font-semibold text-slate-500 uppercase">Cuenta</th>
                        <th class="px-3 py-2 text-left font-semibold text-slate-500 uppercase">Tipo</th>
                        <th class="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Debito</th>
                        <th class="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Credito</th>
                        <th class="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Saldo</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr v-for="account in accounts?.data ?? []" :key="account.id" class="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                        <td class="px-3 py-2">
                            <button type="button" class="text-left font-semibold text-indigo-600 hover:underline dark:text-indigo-300" @click="selectAccount(account)">
                                {{ account.code }} - {{ account.name }}
                            </button>
                        </td>
                        <td class="px-3 py-2 text-slate-600 dark:text-slate-400">{{ account.type }}</td>
                        <td class="px-3 py-2 text-right">{{ currencyFormatter(account.debit) }}</td>
                        <td class="px-3 py-2 text-right">{{ currencyFormatter(account.credit) }}</td>
                        <td class="px-3 py-2 text-right font-semibold">{{ currencyFormatter(account.balance) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-else-if="activeTab === 'ledger'" class="grid gap-3 xl:grid-cols-2">
            <section class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                <header class="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
                    Libro Mayor {{ selectedAccount ? `${selectedAccount.code} - ${selectedAccount.name}` : '' }}
                </header>
                <table class="min-w-full text-xs tabular-nums">
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                        <tr v-for="line in ledger?.data ?? []" :key="line.id" class="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                            <td class="px-3 py-2 text-slate-500">{{ formatReportDateTime(line.occurred_at) }}</td>
                            <td class="px-3 py-2 text-slate-700 dark:text-slate-300">{{ line.memo || line.source_type }}</td>
                            <td class="px-3 py-2 text-right">{{ currencyFormatter(line.debit) }}</td>
                            <td class="px-3 py-2 text-right">{{ currencyFormatter(line.credit) }}</td>
                        </tr>
                    </tbody>
                </table>
            </section>
            <section class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                <header class="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
                    Cuenta T
                </header>
                <div class="grid grid-cols-2 divide-x divide-slate-200 text-xs dark:divide-slate-800">
                    <div>
                        <p class="bg-slate-50 px-3 py-2 font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">Debitos</p>
                        <div v-for="line in tAccount?.debits ?? []" :key="`d-${line.id}`" class="flex justify-between gap-2 px-3 py-2">
                            <span class="truncate">{{ line.memo || line.source_type }}</span>
                            <span class="tabular-nums">{{ currencyFormatter(line.debit) }}</span>
                        </div>
                    </div>
                    <div>
                        <p class="bg-slate-50 px-3 py-2 font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">Creditos</p>
                        <div v-for="line in tAccount?.credits ?? []" :key="`c-${line.id}`" class="flex justify-between gap-2 px-3 py-2">
                            <span class="truncate">{{ line.memo || line.source_type }}</span>
                            <span class="tabular-nums">{{ currencyFormatter(line.credit) }}</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>

        <div v-else class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <table class="min-w-full text-xs tabular-nums">
                <thead class="bg-slate-50 dark:bg-slate-900">
                    <tr>
                        <th class="px-3 py-2 text-left font-semibold text-slate-500 uppercase">Cuenta</th>
                        <th class="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Debito</th>
                        <th class="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Credito</th>
                        <th class="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Diferencia</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr v-for="account in trialBalance?.data ?? []" :key="account.id">
                        <td class="px-3 py-2 text-slate-700 dark:text-slate-300">{{ account.code }} - {{ account.name }}</td>
                        <td class="px-3 py-2 text-right">{{ currencyFormatter(account.debit) }}</td>
                        <td class="px-3 py-2 text-right">{{ currencyFormatter(account.credit) }}</td>
                        <td class="px-3 py-2 text-right font-semibold">{{ currencyFormatter(account.balance) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>
</template>
