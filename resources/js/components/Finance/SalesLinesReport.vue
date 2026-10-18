<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed, onMounted, ref, watch } from 'vue';
import apiClient from '@/services/api/client';
import { validateFinancialReportDates } from '@/utils/financialReport';
import type { FinancialReportFilters } from '@/utils/financialReport';
import { formatCurrency, formatReportDateTime } from '@/utils/formatters';
import {
    downloadMoneyReport,
    reportParams,
    reportPeriod,
} from '@/utils/moneyReports';
import ReportPeriod from './ReportPeriod.vue';
const props = withDefaults(
    defineProps<{
        initialGroup?: string;
        initialFilters?: FinancialReportFilters;
    }>(),
    {
        initialGroup: 'line',
    },
);
const emit = defineEmits<{ 'filters-applied': [FinancialReportFilters] }>();
const filters = ref({
    ...reportPeriod(),
    date_from: props.initialFilters?.date_from ?? reportPeriod().date_from,
    date_to: props.initialFilters?.date_to ?? reportPeriod().date_to,
    group_by: props.initialGroup,
    warehouse_id: props.initialFilters?.warehouse_id
        ? String(props.initialFilters.warehouse_id)
        : '',
    search: '',
    product_id: '',
    brand_id: '',
    category_id: '',
    customer_id: '',
    seller_id: '',
    page: 1,
    per_page: 25,
});
const appliedFilters = ref({ ...filters.value });
const result = ref<any>({ data: [], summary: {}, meta: {}, warnings: [] });
const loading = ref(false);
const error = ref('');
const cache = new Map<string, any>();
let requestVersion = 0;
const options = ref<Record<string, Array<{ id: number; name: string }>>>({});
const groups = {
    line: 'Cada renglón',
    product: 'Producto / variante',
    brand: 'Marca',
    category: 'Categoría',
    customer: 'Cliente',
    seller: 'Vendedor',
};
const selectors = {
    warehouse_id: 'Sucursal',
    product_id: 'Producto',
    brand_id: 'Marca',
    category_id: 'Categoría',
    customer_id: 'Cliente',
    seller_id: 'Vendedor',
};
const metrics = computed(() =>
    Object.entries({
        gross_sales: 'Venta antes de impuestos',
        discounts: 'Descuentos',
        returns_amount: 'Devoluciones',
        net_sales: 'Ventas netas',
        tax: 'Impuestos',
        cost: 'Costo histórico',
        profit: 'Utilidad bruta de artículos',
    }).map(([key, label]) => ({ label, value: result.value.summary[key] })),
);
async function load(reset = false) {
    const validation = validateFinancialReportDates(
        filters.value.date_from,
        filters.value.date_to,
    );
    if (validation) {
        error.value = validation;
        return;
    }
    if (reset) {
        filters.value.page = 1;
        cache.clear();
    }
    filters.value.search = filters.value.search.trim();
    const requestedFilters = { ...filters.value };
    const key = JSON.stringify(requestedFilters);
    const version = ++requestVersion;
    if (cache.has(key)) {
        result.value = cache.get(key);
        appliedFilters.value = requestedFilters;
        loading.value = false;
        return;
    }
    loading.value = true;
    error.value = '';
    try {
        const data = (
            await apiClient.get('/reports/sales-lines', {
                params: reportParams(filters.value),
            })
        ).data;
        cache.set(key, data);
        if (version === requestVersion) {
            result.value = data;
            appliedFilters.value = requestedFilters;
            emit('filters-applied', {
                date_from: requestedFilters.date_from,
                date_to: requestedFilters.date_to,
                warehouse_id: Number(requestedFilters.warehouse_id) || null,
            });
        }
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'No se pudo cargar la rentabilidad.';
    } finally {
        if (version === requestVersion) loading.value = false;
    }
}
async function lookup(key: string, search = '') {
    try {
        options.value[key] = (
            await apiClient.get('/reports/sales-line-options', {
                params: {
                    field: key,
                    search,
                    warehouse_id: filters.value.warehouse_id || undefined,
                },
            })
        ).data.data;
    } catch {
        error.value = 'No se pudieron cargar los filtros.';
    }
}
async function download(format: 'csv' | 'xlsx') {
    try {
        await downloadMoneyReport('sales-lines', format, appliedFilters.value);
    } catch {
        error.value = 'No se pudo exportar el reporte.';
    }
}
function label(row: any) {
    return (
        row.product_name ||
        row.brand_name ||
        row.category_name ||
        row.customer_name ||
        row.seller_name
    );
}
watch(
    () => props.initialFilters,
    (value) => {
        if (!value) return;
        const warehouse = value.warehouse_id ? String(value.warehouse_id) : '';
        if (
            filters.value.date_from === value.date_from &&
            filters.value.date_to === value.date_to &&
            filters.value.warehouse_id === warehouse
        )
            return;
        Object.assign(filters.value, {
            date_from: value.date_from,
            date_to: value.date_to,
            warehouse_id: warehouse,
        });
        void load(true);
    },
    { deep: true },
);
function changePage(page: number) {
    const target = Math.max(
        1,
        Math.min(page, result.value.meta.last_page || 1),
    );
    if (target === filters.value.page) return;
    filters.value.page = target;
    void load();
}
watch(
    () => filters.value.group_by,
    () => {
        filters.value.page = 1;
        void load();
    },
);
onMounted(() => {
    void load();
    Object.keys(selectors).forEach((key) => void lookup(key));
});
</script>
<template>
    <section class="space-y-4">
        <header class="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h2 class="text-lg font-semibold">Ventas y rentabilidad</h2>
                <p class="text-sm text-muted-foreground">
                    Venta reconocida y devoluciones aprobadas. El cobro se
                    consulta por separado. Envío e impuestos no forman parte de
                    la utilidad de artículos.
                </p>
            </div>
            <div class="flex gap-3">
                <button
                    class="text-sm text-primary"
                    :disabled="loading"
                    @click="download('csv')"
                >
                    CSV</button
                ><button
                    class="text-sm text-primary"
                    :disabled="loading"
                    @click="download('xlsx')"
                >
                    Excel
                </button>
            </div>
        </header>
        <form
            class="flex flex-wrap items-end gap-3 rounded-lg border p-3"
            @submit.prevent="load(true)"
        >
            <ReportPeriod
                v-model:from="filters.date_from"
                v-model:to="filters.date_to"
            />
            <label class="text-xs"
                >Agrupar<select
                    v-model="filters.group_by"
                    aria-label="Agrupar"
                    class="mt-1 block rounded border bg-background p-2"
                >
                    <option
                        v-for="(name, key) in groups"
                        :key="key"
                        :value="key"
                    >
                        {{ name }}
                    </option>
                </select></label
            >
            <label class="text-xs"
                >Documento / artículo<input
                    v-model="filters.search"
                    class="mt-1 block rounded border bg-background p-2"
                    placeholder="Folio, nombre o SKU"
            /></label>
            <details class="w-full">
                <summary class="cursor-pointer text-sm text-primary">
                    Filtros de sucursal, producto, marca, categoría, cliente y
                    vendedor
                </summary>
                <div class="mt-3 flex flex-wrap gap-3">
                    <label
                        v-for="(name, key) in selectors"
                        :key="key"
                        class="text-xs"
                        >{{ name
                        }}<input
                            v-if="key !== 'warehouse_id'"
                            :aria-label="`Buscar ${name}`"
                            placeholder="Buscar opciones…"
                            class="mt-1 block rounded border bg-background p-2"
                            @change="
                                lookup(
                                    key,
                                    ($event.target as HTMLInputElement).value,
                                )
                            "
                        /><select
                            v-model="filters[key]"
                            :aria-label="name"
                            class="mt-1 block max-w-56 rounded border bg-background p-2"
                        >
                            <option value="">
                                {{
                                    key === 'warehouse_id'
                                        ? 'Sucursal activa'
                                        : 'Todos'
                                }}
                            </option>
                            <option
                                v-for="option in options[key]"
                                :key="option.id"
                                :value="option.id"
                            >
                                {{ option.name }}
                            </option>
                        </select></label
                    >
                </div>
            </details>
            <button
                :disabled="loading"
                class="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
                Consultar
            </button>
        </form>
        <p v-if="error" role="alert" class="text-sm text-destructive">
            {{ error }}
        </p>
        <p
            v-for="warning in result.warnings"
            :key="warning"
            class="rounded border border-amber-400 p-3 text-sm"
        >
            {{ warning }}
        </p>
        <p
            v-if="result.summary.incomplete"
            class="rounded border border-amber-400 p-3 text-sm"
        >
            Rentabilidad incompleta: hay renglones sin costo histórico
            respaldado. No se presenta una utilidad total estimada.
        </p>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article
                v-for="metric in metrics"
                :key="metric.label"
                class="rounded-lg border p-3"
            >
                <p class="text-xs text-muted-foreground">{{ metric.label }}</p>
                <p class="font-mono text-lg font-semibold">
                    {{
                        metric.value == null
                            ? 'No disponible'
                            : formatCurrency(Number(metric.value))
                    }}
                </p>
            </article>
            <article class="rounded-lg border p-3">
                <p class="text-xs text-muted-foreground">
                    Margen sobre ventas netas
                </p>
                <p class="font-mono text-lg font-semibold">
                    {{
                        result.summary.margin == null
                            ? 'No aplicable'
                            : `${result.summary.margin}%`
                    }}
                </p>
            </article>
        </div>
        <div class="overflow-x-auto rounded-lg border">
            <table class="w-full text-sm whitespace-nowrap">
                <thead class="bg-muted">
                    <tr>
                        <th class="p-3 text-left">
                            {{
                                filters.group_by === 'line'
                                    ? 'Documento / fecha'
                                    : 'Agrupación'
                            }}
                        </th>
                        <th
                            v-if="filters.group_by === 'line'"
                            class="p-3 text-left"
                        >
                            Sucursal / cliente / vendedor
                        </th>
                        <th class="p-3 text-left">Artículo</th>
                        <th class="p-3 text-right">Cantidad</th>
                        <th
                            v-if="filters.group_by === 'line'"
                            class="p-3 text-right"
                        >
                            Precio
                        </th>
                        <th class="p-3 text-right">Descuentos</th>
                        <th class="p-3 text-right">Venta neta</th>
                        <th class="p-3 text-right">Costo</th>
                        <th class="p-3 text-right">Utilidad</th>
                        <th class="p-3 text-right">Margen</th>
                    </tr>
                </thead>
                <tbody class="divide-y">
                    <tr v-for="(row, index) in result.data" :key="index">
                        <td class="p-3">
                            <template v-if="filters.group_by === 'line'"
                                ><Link
                                    class="text-primary"
                                    :href="
                                        row.return_id
                                            ? `/returns/${row.return_id}`
                                            : `/sales-orders/${row.document_id}`
                                    "
                                    >{{ row.document_number }}</Link
                                >
                                <p class="text-xs">
                                    {{
                                        {
                                            sale: 'Venta',
                                            return: 'Devolución',
                                            amendment: 'Ampliación',
                                        }[row.kind as 'sale']
                                    }}
                                    ·
                                    {{ formatReportDateTime(row.occurred_at) }}
                                </p></template
                            ><span v-else>{{ label(row) }}</span>
                        </td>
                        <td v-if="filters.group_by === 'line'" class="p-3">
                            {{ row.warehouse_name }}
                            <p class="text-xs">
                                {{ row.customer_name }} · {{ row.seller_name }}
                            </p>
                        </td>
                        <td class="p-3">
                            {{ row.product_name || '—' }}
                            <p class="text-xs text-muted-foreground">
                                {{ row.sku }}
                            </p>
                        </td>
                        <td class="p-3 text-right font-mono">
                            {{
                                row.quantity ??
                                `${row.quantity_sold} / −${row.quantity_returned}`
                            }}
                        </td>
                        <td
                            v-if="filters.group_by === 'line'"
                            class="p-3 text-right font-mono"
                        >
                            {{ formatCurrency(Number(row.unit_price)) }}
                        </td>
                        <td
                            v-for="key in [
                                'discounts',
                                'net_sales',
                                'cost',
                                'profit',
                            ]"
                            :key="key"
                            class="p-3 text-right font-mono"
                        >
                            {{
                                row[key] == null
                                    ? 'Sin costo respaldado'
                                    : formatCurrency(Number(row[key]))
                            }}
                        </td>
                        <td class="p-3 text-right">
                            {{ row.margin == null ? '—' : `${row.margin}%` }}
                        </td>
                    </tr>
                    <tr v-if="!result.data.length">
                        <td
                            colspan="10"
                            class="p-6 text-center text-muted-foreground"
                        >
                            {{
                                loading
                                    ? 'Cargando…'
                                    : 'Sin movimientos para estos filtros.'
                            }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <footer class="flex justify-end gap-4 text-sm">
            <span>{{ result.meta.total || 0 }} resultados</span
            ><button
                :disabled="loading || filters.page <= 1"
                @click="changePage(filters.page - 1)"
            >
                Anterior</button
            ><span
                >{{ result.meta.current_page || 1 }} /
                {{ result.meta.last_page || 1 }}</span
            ><button
                :disabled="loading || filters.page >= result.meta.last_page"
                @click="changePage(filters.page + 1)"
            >
                Siguiente
            </button>
        </footer>
    </section>
</template>
