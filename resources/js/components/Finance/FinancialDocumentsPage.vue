<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3';
import {
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    FileText,
    LoaderCircle,
    Pencil,
    Plus,
    RefreshCw,
    Trash2,
    X,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import FinancialDocumentPaymentDialog from '@/components/Finance/FinancialDocumentPaymentDialog.vue';
import DateRangeInput from '@/components/ui/DateRangeInput.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { useFinancialDocuments } from '@/composables/useFinancialDocuments';
import AppLayout from '@/layouts/AppLayout.vue';
import { financialDocumentsService } from '@/services/financial-documents';
import type { BreadcrumbItem } from '@/types';
import type {
    FinancialDocument,
    FinancialDocumentMode,
} from '@/types/financial-document';
import { formatCurrency, formatReportDate } from '@/utils/formatters';

const props = defineProps<{ mode: FinancialDocumentMode }>();

const copy = computed(() =>
    props.mode === 'payable'
        ? {
              title: 'Cuentas por pagar',
              description:
                  'Facturas y órdenes de compra pendientes, pagos y saldos de proveedores.',
              action: 'Registrar pago',
              paid: 'Total pagado',
              balance: 'Saldo adeudado',
              empty: 'No hay cuentas por pagar para estos filtros.',
          }
        : {
              title: 'Cuentas por cobrar',
              description:
                  'Facturas de venta, cobros, abonos y saldos de clientes.',
              action: 'Registrar cobro',
              paid: 'Total cobrado',
              balance: 'Saldo por cobrar',
              empty: 'No hay cuentas por cobrar para estos filtros.',
          },
);

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Finanzas', href: '/finance' },
    {
        title: copy.value.title,
        href: props.mode === 'payable' ? '/accounts-payable' : '/ar',
    },
]);

const {
    filters,
    documents,
    summary,
    meta,
    statuses,
    loading,
    error,
    load,
    applyFilters,
    clearFilters,
    goToPage,
} = useFinancialDocuments(props.mode);

const selectedDocument = ref<FinancialDocument | null>(null);
const paymentDocument = ref<FinancialDocument | null>(null);
const choosingPayment = ref(false);
const paymentLoading = ref(false);
const paymentError = ref<string | null>(null);
const actionDocument = ref<FinancialDocument | null>(null);
const actionReason = ref('');
const actionLoading = ref(false);

const statusOptions = computed<SelectOption[]>(() =>
    Object.entries(statuses.value).map(([value, label]) => ({
        value,
        label,
    })),
);
const payableDocuments = computed(() =>
    documents.value.filter((document) =>
        props.mode === 'payable'
            ? document.capabilities.can_register_payment
            : document.capabilities.can_register_receipt,
    ),
);

const statusClass = (status: FinancialDocument['status']): string => {
    if (status === 'settled') {
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30';
    }
    if (status === 'partial') {
        return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30';
    }
    if (status === 'cancelled') {
        return 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-muted dark:text-slate-300 dark:ring-border';
    }

    return 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30';
};

const openPrimaryAction = (): void => {
    if (payableDocuments.value.length === 1) {
        paymentDocument.value = payableDocuments.value[0];
        return;
    }
    choosingPayment.value = true;
};

const openPayment = (document: FinancialDocument): void => {
    choosingPayment.value = false;
    paymentError.value = null;
    paymentDocument.value = document;
};

const submitPayment = async (
    payload: Record<string, unknown>,
): Promise<void> => {
    if (!paymentDocument.value?.party.id || paymentLoading.value) return;
    paymentLoading.value = true;
    paymentError.value = null;
    try {
        await financialDocumentsService.settle(
            props.mode,
            paymentDocument.value.party.id,
            payload,
        );
        paymentDocument.value = null;
        selectedDocument.value = null;
        await load();
    } catch (exception: any) {
        paymentError.value =
            exception.response?.data?.message ||
            `No se pudo ${props.mode === 'payable' ? 'registrar el pago' : 'registrar el cobro'}.`;
    } finally {
        paymentLoading.value = false;
    }
};

const editDocument = (document: FinancialDocument): void => {
    if (document.capabilities.can_edit) {
        router.visit(document.edit_url, { preserveScroll: true });
        return;
    }
    selectedDocument.value = document;
};

const requestRemoval = (document: FinancialDocument): void => {
    if (
        !document.capabilities.can_delete &&
        !document.capabilities.can_cancel
    ) {
        selectedDocument.value = document;
        return;
    }
    actionReason.value = '';
    actionDocument.value = document;
};

const confirmRemoval = async (): Promise<void> => {
    if (!actionDocument.value || actionLoading.value) return;
    if (
        actionDocument.value.capabilities.can_cancel &&
        actionReason.value.trim().length < 3
    ) {
        return;
    }
    actionLoading.value = true;
    try {
        if (actionDocument.value.capabilities.can_delete) {
            await financialDocumentsService.remove(
                actionDocument.value.document_type,
                actionDocument.value.id,
            );
        } else {
            await financialDocumentsService.cancel(
                actionDocument.value.document_type,
                actionDocument.value.id,
                actionReason.value.trim(),
            );
        }
        actionDocument.value = null;
        selectedDocument.value = null;
        await load();
    } catch (exception: any) {
        error.value =
            exception.response?.data?.message ||
            'No se pudo completar la acción.';
    } finally {
        actionLoading.value = false;
    }
};

onMounted(load);
</script>

<template>
    <Head :title="copy.title" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <main
            class="min-h-[calc(100vh-4rem)] bg-gray-50/60 p-4 dark:bg-background"
        >
            <div class="mx-auto max-w-7xl space-y-4">
                <header
                    class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                >
                    <div>
                        <h1
                            class="text-2xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ copy.title }}
                        </h1>
                        <p class="text-sm text-gray-500">
                            {{ copy.description }}
                        </p>
                    </div>
                    <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        :disabled="payableDocuments.length === 0"
                        @click="openPrimaryAction"
                    >
                        <Plus :size="16" />
                        {{ copy.action }}
                    </button>
                </header>

                <div
                    v-if="error"
                    class="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                >
                    <AlertCircle :size="16" />
                    {{ error }}
                </div>

                <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div
                        v-for="metric in [
                            {
                                label: 'Total original',
                                value: formatCurrency(summary.total),
                            },
                            {
                                label: copy.paid,
                                value: formatCurrency(summary.paid),
                            },
                            {
                                label: copy.balance,
                                value: formatCurrency(summary.balance),
                            },
                            {
                                label: 'Documentos pendientes',
                                value: String(summary.pending_documents),
                            },
                        ]"
                        :key="metric.label"
                        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-border dark:bg-card"
                    >
                        <p
                            class="text-xs font-semibold text-gray-500 uppercase"
                        >
                            {{ metric.label }}
                        </p>
                        <p
                            class="mt-1 text-2xl font-bold text-gray-900 dark:text-white"
                        >
                            {{ metric.value }}
                        </p>
                    </div>
                </section>

                <section
                    class="rounded-lg border border-gray-200 bg-white p-3 dark:border-border dark:bg-card"
                    aria-label="Filtros"
                >
                    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                        <DateRangeInput
                            v-model:from="filters.date_from"
                            v-model:to="filters.date_to"
                            class="xl:col-span-2"
                            label="Rango de fechas"
                        />
                        <label class="space-y-1">
                            <span
                                class="block text-xs font-semibold text-gray-500 uppercase"
                                >Persona / Empresa</span
                            >
                            <input
                                v-model="filters.search"
                                type="search"
                                class="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-border dark:bg-background"
                                placeholder="Nombre"
                                @keyup.enter="applyFilters"
                            />
                        </label>
                        <label class="space-y-1">
                            <span
                                class="block text-xs font-semibold text-gray-500 uppercase"
                                ># Factura</span
                            >
                            <input
                                v-model="filters.document_number"
                                type="search"
                                class="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-border dark:bg-background"
                                placeholder="Número"
                                @keyup.enter="applyFilters"
                            />
                        </label>
                        <div class="space-y-1">
                            <span
                                class="block text-xs font-semibold text-gray-500 uppercase"
                                >Estado</span
                            >
                            <SearchableSelect
                                v-model="filters.status"
                                :options="statusOptions"
                            />
                        </div>
                        <div class="flex items-end gap-2">
                            <button
                                type="button"
                                class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold hover:bg-gray-50 dark:border-border dark:bg-muted"
                                @click="applyFilters"
                            >
                                <RefreshCw
                                    :size="16"
                                    :class="{ 'animate-spin': loading }"
                                />
                                Filtrar
                            </button>
                            <button
                                type="button"
                                class="h-10 rounded-md px-3 text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-muted"
                                @click="clearFilters"
                            >
                                Limpiar
                            </button>
                        </div>
                    </div>
                </section>

                <section
                    class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                >
                    <div class="hidden overflow-x-auto md:block">
                        <table class="min-w-full text-sm">
                            <thead
                                class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/50"
                            >
                                <tr>
                                    <th class="px-3 py-3 text-left">Fecha</th>
                                    <th class="px-3 py-3 text-left">
                                        Persona / Empresa
                                    </th>
                                    <th class="px-3 py-3 text-left">
                                        # Factura
                                    </th>
                                    <th class="px-3 py-3 text-right">Total</th>
                                    <th class="px-3 py-3 text-right">Pagado</th>
                                    <th class="px-3 py-3 text-right">Saldo</th>
                                    <th class="px-3 py-3 text-center">
                                        Editar
                                    </th>
                                    <th class="px-3 py-3 text-center">
                                        Eliminar
                                    </th>
                                </tr>
                            </thead>
                            <tbody
                                class="divide-y divide-gray-100 dark:divide-border"
                            >
                                <tr v-if="loading">
                                    <td
                                        colspan="8"
                                        class="px-4 py-12 text-center text-gray-500"
                                    >
                                        <LoaderCircle
                                            :size="22"
                                            class="mx-auto mb-2 animate-spin"
                                        />
                                        Cargando documentos...
                                    </td>
                                </tr>
                                <tr v-else-if="documents.length === 0">
                                    <td
                                        colspan="8"
                                        class="px-4 py-12 text-center text-gray-500"
                                    >
                                        <FileText
                                            :size="28"
                                            class="mx-auto mb-2 opacity-50"
                                        />
                                        {{ copy.empty }}
                                    </td>
                                </tr>
                                <tr
                                    v-for="document in documents"
                                    v-else
                                    :key="document.id"
                                    class="hover:bg-gray-50 dark:hover:bg-muted/40"
                                >
                                    <td class="px-3 py-3">
                                        {{ formatReportDate(document.date) }}
                                    </td>
                                    <td class="px-3 py-3 font-medium">
                                        {{ document.party.name }}
                                    </td>
                                    <td class="px-3 py-3">
                                        <button
                                            type="button"
                                            class="font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                                            @click="selectedDocument = document"
                                        >
                                            {{ document.document_number }}
                                        </button>
                                        <span
                                            class="ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1"
                                            :class="
                                                statusClass(document.status)
                                            "
                                        >
                                            {{ document.status_label }}
                                        </span>
                                    </td>
                                    <td class="px-3 py-3 text-right font-mono">
                                        {{ formatCurrency(document.total) }}
                                    </td>
                                    <td class="px-3 py-3 text-right font-mono">
                                        {{ formatCurrency(document.paid) }}
                                    </td>
                                    <td
                                        class="px-3 py-3 text-right font-mono font-bold"
                                        :class="{
                                            'text-emerald-600':
                                                document.status === 'settled',
                                            'text-amber-600':
                                                document.status === 'partial',
                                            'text-rose-600': [
                                                'pending',
                                                'overdue',
                                            ].includes(document.status),
                                        }"
                                    >
                                        {{ formatCurrency(document.balance) }}
                                    </td>
                                    <td class="px-3 py-3 text-center">
                                        <button
                                            type="button"
                                            class="rounded-md p-2 text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-emerald-950/30"
                                            :title="
                                                document.capabilities.can_edit
                                                    ? 'Editar documento'
                                                    : 'Ver detalle: este documento no admite edición directa'
                                            "
                                            @click="editDocument(document)"
                                        >
                                            <Pencil :size="16" />
                                        </button>
                                    </td>
                                    <td class="px-3 py-3 text-center">
                                        <button
                                            type="button"
                                            class="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-red-950/30"
                                            :disabled="
                                                !document.capabilities
                                                    .can_delete &&
                                                !document.capabilities
                                                    .can_cancel
                                            "
                                            :title="
                                                document.capabilities.can_delete
                                                    ? 'Eliminar borrador'
                                                    : document.capabilities
                                                            .can_cancel
                                                      ? 'Anular documento'
                                                      : 'No se puede eliminar ni anular'
                                            "
                                            @click="requestRemoval(document)"
                                        >
                                            <Trash2 :size="16" />
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div
                        class="divide-y divide-gray-100 md:hidden dark:divide-border"
                    >
                        <div
                            v-if="loading"
                            class="p-10 text-center text-sm text-gray-500"
                        >
                            Cargando documentos...
                        </div>
                        <div
                            v-else-if="documents.length === 0"
                            class="p-10 text-center text-sm text-gray-500"
                        >
                            {{ copy.empty }}
                        </div>
                        <article
                            v-for="document in documents"
                            v-else
                            :key="document.id"
                            class="space-y-3 p-4"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <p class="font-semibold">
                                        {{ document.party.name }}
                                    </p>
                                    <button
                                        type="button"
                                        class="text-sm font-semibold text-emerald-700"
                                        @click="selectedDocument = document"
                                    >
                                        {{ document.document_number }}
                                    </button>
                                </div>
                                <span
                                    class="rounded-full px-2 py-0.5 text-xs font-semibold ring-1"
                                    :class="statusClass(document.status)"
                                >
                                    {{ document.status_label }}
                                </span>
                            </div>
                            <dl class="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <dt class="text-xs text-gray-500">Fecha</dt>
                                    <dd>
                                        {{ formatReportDate(document.date) }}
                                    </dd>
                                </div>
                                <div class="text-right">
                                    <dt class="text-xs text-gray-500">Total</dt>
                                    <dd>
                                        {{ formatCurrency(document.total) }}
                                    </dd>
                                </div>
                                <div>
                                    <dt class="text-xs text-gray-500">
                                        Pagado
                                    </dt>
                                    <dd>{{ formatCurrency(document.paid) }}</dd>
                                </div>
                                <div class="text-right">
                                    <dt class="text-xs text-gray-500">Saldo</dt>
                                    <dd class="font-bold">
                                        {{ formatCurrency(document.balance) }}
                                    </dd>
                                </div>
                            </dl>
                            <div class="flex justify-end gap-2">
                                <button
                                    type="button"
                                    class="rounded-md border border-gray-200 p-2 dark:border-border"
                                    aria-label="Editar"
                                    @click="editDocument(document)"
                                >
                                    <Pencil :size="16" />
                                </button>
                                <button
                                    type="button"
                                    class="rounded-md border border-gray-200 p-2 text-red-600 disabled:opacity-35 dark:border-border"
                                    aria-label="Eliminar"
                                    :disabled="
                                        !document.capabilities.can_delete &&
                                        !document.capabilities.can_cancel
                                    "
                                    @click="requestRemoval(document)"
                                >
                                    <Trash2 :size="16" />
                                </button>
                            </div>
                        </article>
                    </div>

                    <footer
                        class="flex flex-col gap-2 border-t border-gray-200 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-border"
                    >
                        <span class="text-gray-500">
                            {{ meta.total }} documento(s) · Página
                            {{ meta.current_page }} de {{ meta.last_page }}
                        </span>
                        <div class="flex gap-2">
                            <button
                                type="button"
                                class="rounded-md border border-gray-300 p-2 disabled:opacity-40 dark:border-border"
                                :disabled="meta.current_page <= 1 || loading"
                                aria-label="Página anterior"
                                @click="goToPage(meta.current_page - 1)"
                            >
                                <ChevronLeft :size="16" />
                            </button>
                            <button
                                type="button"
                                class="rounded-md border border-gray-300 p-2 disabled:opacity-40 dark:border-border"
                                :disabled="
                                    meta.current_page >= meta.last_page ||
                                    loading
                                "
                                aria-label="Página siguiente"
                                @click="goToPage(meta.current_page + 1)"
                            >
                                <ChevronRight :size="16" />
                            </button>
                        </div>
                    </footer>
                </section>
            </div>
        </main>

        <div
            v-if="selectedDocument"
            class="fixed inset-0 z-40 bg-black/35"
            @click.self="selectedDocument = null"
        >
            <aside
                class="ml-auto flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-gray-200 bg-white shadow-2xl dark:border-border dark:bg-card"
                role="dialog"
                aria-modal="true"
            >
                <header
                    class="flex items-start justify-between border-b border-gray-200 p-5 dark:border-border"
                >
                    <div>
                        <p class="text-sm text-gray-500">
                            Detalle del documento
                        </p>
                        <h2 class="text-xl font-bold">
                            {{ selectedDocument.document_number }}
                        </h2>
                    </div>
                    <button
                        type="button"
                        class="rounded-md p-2 hover:bg-gray-100 dark:hover:bg-muted"
                        aria-label="Cerrar"
                        @click="selectedDocument = null"
                    >
                        <X :size="18" />
                    </button>
                </header>
                <div class="flex-1 space-y-5 p-5">
                    <dl class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <dt class="text-gray-500">Persona / Empresa</dt>
                            <dd class="font-semibold">
                                {{ selectedDocument.party.name }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-gray-500">Fecha</dt>
                            <dd>
                                {{ formatReportDate(selectedDocument.date) }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-gray-500">Vencimiento</dt>
                            <dd>
                                {{
                                    selectedDocument.due_date
                                        ? formatReportDate(
                                              selectedDocument.due_date,
                                          )
                                        : '-'
                                }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-gray-500">Estado</dt>
                            <dd>{{ selectedDocument.status_label }}</dd>
                        </div>
                        <div>
                            <dt class="text-gray-500">Total</dt>
                            <dd>
                                {{ formatCurrency(selectedDocument.total) }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-gray-500">Pagado</dt>
                            <dd>{{ formatCurrency(selectedDocument.paid) }}</dd>
                        </div>
                        <div class="col-span-2">
                            <dt class="text-gray-500">Saldo</dt>
                            <dd class="text-xl font-bold">
                                {{ formatCurrency(selectedDocument.balance) }}
                            </dd>
                        </div>
                    </dl>

                    <section>
                        <h3 class="mb-2 font-semibold">
                            Pagos y cobros relacionados
                        </h3>
                        <div
                            v-if="selectedDocument.movements.length === 0"
                            class="rounded-md bg-gray-50 p-4 text-sm text-gray-500 dark:bg-muted/50"
                        >
                            Sin movimientos registrados.
                        </div>
                        <div
                            v-for="movement in selectedDocument.movements"
                            v-else
                            :key="movement.id"
                            class="mb-2 rounded-md border border-gray-200 p-3 text-sm dark:border-border"
                        >
                            <div class="flex justify-between gap-3">
                                <strong>{{ movement.method }}</strong>
                                <strong>{{
                                    formatCurrency(movement.amount)
                                }}</strong>
                            </div>
                            <p class="text-gray-500">
                                {{
                                    movement.occurred_at
                                        ? formatReportDate(movement.occurred_at)
                                        : '-'
                                }}
                                · {{ movement.created_by || 'Sin usuario' }}
                            </p>
                            <p v-if="movement.reference">
                                Referencia: {{ movement.reference }}
                            </p>
                            <p v-if="movement.notes">
                                {{ movement.notes }}
                            </p>
                        </div>
                    </section>
                </div>
                <footer
                    class="flex flex-wrap justify-end gap-2 border-t border-gray-200 p-5 dark:border-border"
                >
                    <Link
                        :href="selectedDocument.detail_url"
                        class="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold dark:border-border"
                    >
                        Abrir documento
                    </Link>
                    <button
                        v-if="
                            mode === 'payable'
                                ? selectedDocument.capabilities
                                      .can_register_payment
                                : selectedDocument.capabilities
                                      .can_register_receipt
                        "
                        type="button"
                        class="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                        @click="openPayment(selectedDocument)"
                    >
                        {{ copy.action }}
                    </button>
                </footer>
            </aside>
        </div>

        <div
            v-if="choosingPayment"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            @click.self="choosingPayment = false"
        >
            <div
                class="w-full max-w-xl rounded-lg bg-white shadow-2xl dark:bg-card"
                role="dialog"
                aria-modal="true"
            >
                <header
                    class="flex items-center justify-between border-b border-gray-200 p-4 dark:border-border"
                >
                    <h2 class="text-lg font-bold">Seleccionar documento</h2>
                    <button
                        type="button"
                        class="p-2"
                        aria-label="Cerrar"
                        @click="choosingPayment = false"
                    >
                        <X :size="18" />
                    </button>
                </header>
                <div
                    class="max-h-[60vh] divide-y overflow-y-auto dark:divide-border"
                >
                    <button
                        v-for="document in payableDocuments"
                        :key="document.id"
                        type="button"
                        class="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-muted"
                        @click="openPayment(document)"
                    >
                        <span>
                            <strong class="block">{{
                                document.document_number
                            }}</strong>
                            <span class="text-sm text-gray-500">{{
                                document.party.name
                            }}</span>
                        </span>
                        <strong>{{ formatCurrency(document.balance) }}</strong>
                    </button>
                </div>
            </div>
        </div>

        <FinancialDocumentPaymentDialog
            :open="Boolean(paymentDocument)"
            :mode="mode"
            :document="paymentDocument"
            :loading="paymentLoading"
            :error="paymentError"
            @close="paymentDocument = null"
            @submit="submitPayment"
        />

        <div
            v-if="actionDocument"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            @click.self="actionDocument = null"
        >
            <form
                class="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl dark:bg-card"
                role="alertdialog"
                @submit.prevent="confirmRemoval"
            >
                <h2 class="text-lg font-bold">
                    {{
                        actionDocument.capabilities.can_delete
                            ? 'Eliminar borrador'
                            : 'Anular documento'
                    }}
                </h2>
                <p class="mt-1 text-sm text-gray-500">
                    {{
                        actionDocument.capabilities.can_delete
                            ? 'El borrador se eliminará definitivamente.'
                            : 'El documento y sus movimientos permanecerán trazables.'
                    }}
                </p>
                <label
                    v-if="actionDocument.capabilities.can_cancel"
                    class="mt-4 block space-y-1"
                >
                    <span class="text-xs font-semibold text-gray-500 uppercase"
                        >Motivo</span
                    >
                    <textarea
                        v-model="actionReason"
                        required
                        minlength="3"
                        rows="3"
                        class="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-border dark:bg-background"
                    />
                </label>
                <div class="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        class="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold dark:border-border"
                        @click="actionDocument = null"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        :disabled="actionLoading"
                    >
                        Confirmar
                    </button>
                </div>
            </form>
        </div>
    </AppLayout>
</template>
