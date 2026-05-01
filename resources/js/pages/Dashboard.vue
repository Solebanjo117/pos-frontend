<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import {
    AlertTriangle,
    ClipboardList,
    DollarSign,
    Package,
    PackageSearch,
    Plus,
    Search,
    ShoppingCart,
    TrendingUp,
    Warehouse,
} from 'lucide-vue-next';
import AppLayout from '@/layouts/AppLayout.vue';
import PageShell from '@/components/PageShell.vue';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import SalesChart from '@/components/dashboard/SalesChart.vue';
import CategorySalesChart from '@/components/dashboard/CategorySalesChart.vue';
import TopCashiers from '@/components/dashboard/TopCashiers.vue';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed.vue';
import DashboardMetricCard from '@/components/dashboard/DashboardMetricCard.vue';
import DashboardPanel from '@/components/dashboard/DashboardPanel.vue';
import ChangelogQuickEntry from '@/components/dashboard/ChangelogQuickEntry.vue';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { useDashboard } from '@/composables/useDashboard';
import { usePosSettings } from '@/composables/usePosSettings';
import { useAuth } from '@/composables/useAuth';
import { changelogApi, type ChangelogRelease } from '@/services/api/changelog';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

const {
    stats,
    topProducts,
    lowStockProducts,
    chartData,
    profitByBrand,
    salesByCategory,
    topCashiers,
    recentActivity,
    loading,
    error,
    fetchDashboardData,
} = useDashboard();

const { currentWarehouseId, initWarehouse } = usePosSettings();
const { hasRole } = useAuth();

const selectedPeriod = ref<string>('7d');
const dashboardInitialized = ref(false);
const initializing = ref(true);
const releases = ref<ChangelogRelease[]>([]);
const releaseNotesLoading = ref(false);
const releaseNotesError = ref<string | null>(null);

const periodOptions = [
    { value: '7d', label: '7 dias' },
    { value: '30d', label: '30 dias' },
    { value: '90d', label: '90 dias' },
];

const canAccessPOS = computed(() => hasRole(['admin', 'manager', 'cashier']));

const latestReleases = computed(() => releases.value.slice(0, 3));

const todayMargin = computed(() => {
    if (stats.value.today_sales <= 0) return null;

    return `${((stats.value.today_profit / stats.value.today_sales) * 100).toFixed(1)}% margen`;
});

const quickActions = computed(() => [
    {
        label: 'Nuevo producto',
        href: '/products/create',
        icon: Plus,
    },
    {
        label: 'Buscar productos',
        href: '/products',
        icon: Search,
    },
    {
        label: 'Inventario',
        href: '/inventory',
        icon: Package,
    },
    ...(canAccessPOS.value
        ? [
              {
                  label: 'Abrir POS',
                  href: '/pos',
                  icon: ShoppingCart,
              },
          ]
        : []),
]);

const formatCurrency = (value: number, digits = 2): string =>
    value.toLocaleString('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

const formatInteger = (value: number): string =>
    value.toLocaleString('es-MX', {
        maximumFractionDigits: 0,
    });

const formatDate = (value: string): string => {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleDateString('es-MX', {
        month: 'short',
        day: '2-digit',
    });
};

const navigateTo = (path: string) => {
    router.visit(path);
};

const loadDashboard = async () => {
    await fetchDashboardData(currentWarehouseId.value, selectedPeriod.value);
};

const loadReleaseNotes = async () => {
    releaseNotesLoading.value = true;
    releaseNotesError.value = null;

    try {
        const response = await changelogApi.getChangelog();
        releases.value = Array.isArray(response.data) ? response.data : [];
    } catch (err: any) {
        releaseNotesError.value =
            err?.response?.data?.message || 'No se pudieron cargar las notas.';
        releases.value = [];
    } finally {
        releaseNotesLoading.value = false;
    }
};

onMounted(async () => {
    try {
        await Promise.all([initWarehouse(), loadReleaseNotes()]);
        dashboardInitialized.value = true;
        await loadDashboard();
    } finally {
        initializing.value = false;
    }
});

watch([currentWarehouseId, selectedPeriod], async () => {
    if (!dashboardInitialized.value) return;

    await loadDashboard();
});
</script>

<template>
    <Head title="Dashboard" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <PageShell
            title="Dashboard operativo"
            description="Ventas, inventario, alertas y notas recientes en un solo lugar."
            content-class="mx-auto max-w-[1600px]"
        >
            <template #actions>
                <div class="inline-flex rounded-md border bg-background p-1">
                    <button
                        v-for="option in periodOptions"
                        :key="option.value"
                        type="button"
                        :class="[
                            'h-8 rounded px-3 text-sm font-medium transition-colors',
                            selectedPeriod === option.value
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        ]"
                        @click="selectedPeriod = option.value"
                    >
                        {{ option.label }}
                    </button>
                </div>
            </template>

            <section
                v-if="initializing || loading"
                class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
            >
                <Skeleton
                    v-for="item in 6"
                    :key="item"
                    class="h-32 rounded-lg"
                />
            </section>

            <section
                v-else-if="error"
                class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
            >
                {{ error }}
            </section>

            <template v-else>
                <section
                    class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
                >
                    <DashboardMetricCard
                        label="Ventas del dia"
                        :value="formatCurrency(stats.today_sales)"
                        tone="green"
                        :icon="DollarSign"
                    />
                    <DashboardMetricCard
                        label="Utilidad del dia"
                        :value="formatCurrency(stats.today_profit)"
                        :helper="todayMargin || 'Sin ventas hoy'"
                        tone="emerald"
                        :icon="TrendingUp"
                    />
                    <DashboardMetricCard
                        label="Ordenes pendientes"
                        :value="stats.pending_orders"
                        tone="blue"
                        :icon="ClipboardList"
                    />
                    <DashboardMetricCard
                        label="Stock bajo"
                        :value="stats.low_stock_items"
                        tone="yellow"
                        :icon="PackageSearch"
                    />
                    <DashboardMetricCard
                        label="Alertas activas"
                        :value="stats.active_alerts"
                        tone="red"
                        :icon="AlertTriangle"
                    />
                    <DashboardMetricCard
                        label="Valor inventario"
                        :value="
                            formatCurrency(stats.total_inventory_value || 0, 0)
                        "
                        tone="indigo"
                        :icon="Warehouse"
                    />
                </section>

                <section
                    class="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]"
                >
                    <DashboardPanel
                        title="Tendencia de ventas"
                        description="Ingresos y utilidad segun el periodo seleccionado."
                        content-class="h-80"
                    >
                        <SalesChart
                            :data="chartData"
                            :period="selectedPeriod"
                        />
                    </DashboardPanel>

                    <DashboardPanel
                        title="Notas de release"
                        description="Cambios recientes y captura rapida para el changelog."
                    >
                        <div class="space-y-4">
                            <ChangelogQuickEntry @saved="loadReleaseNotes" />

                            <div v-if="releaseNotesLoading" class="space-y-2">
                                <Skeleton
                                    v-for="item in 3"
                                    :key="item"
                                    class="h-14 rounded-md"
                                />
                            </div>

                            <p
                                v-else-if="releaseNotesError"
                                class="text-sm text-red-600 dark:text-red-400"
                            >
                                {{ releaseNotesError }}
                            </p>

                            <div
                                v-else-if="latestReleases.length === 0"
                                class="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
                            >
                                No hay notas publicadas todavia.
                            </div>

                            <div v-else class="space-y-3">
                                <article
                                    v-for="release in latestReleases"
                                    :key="`${release.version}-${release.date}`"
                                    class="rounded-md border p-3"
                                >
                                    <div
                                        class="mb-1 flex min-w-0 items-center justify-between gap-2"
                                    >
                                        <p
                                            class="truncate text-sm font-medium text-foreground"
                                        >
                                            {{ release.title }}
                                        </p>
                                        <span
                                            class="shrink-0 text-xs text-muted-foreground"
                                        >
                                            {{ formatDate(release.date) }}
                                        </span>
                                    </div>
                                    <p
                                        class="line-clamp-2 text-sm text-muted-foreground"
                                    >
                                        {{ release.changes[0] }}
                                    </p>
                                </article>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                class="w-full"
                                @click="navigateTo('/changelog')"
                            >
                                Ver changelog completo
                            </Button>
                        </div>
                    </DashboardPanel>
                </section>

                <section class="grid gap-6 lg:grid-cols-2">
                    <DashboardPanel
                        title="Ventas por categoria"
                        content-class="h-72"
                    >
                        <CategorySalesChart :data="salesByCategory || []" />
                    </DashboardPanel>

                    <DashboardPanel title="Desempeno del personal">
                        <TopCashiers :cashiers="topCashiers || []" />
                    </DashboardPanel>
                </section>

                <section class="grid gap-6 xl:grid-cols-3">
                    <DashboardPanel title="Productos mas vendidos">
                        <div class="space-y-3">
                            <div
                                v-for="(product, index) in topProducts"
                                :key="index"
                                class="flex min-w-0 items-center justify-between gap-3"
                            >
                                <span
                                    class="min-w-0 text-sm break-words text-foreground"
                                    >{{ product.name }}</span
                                >
                                <span
                                    class="shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-300"
                                >
                                    {{ product.sales }} vendidos
                                </span>
                            </div>
                            <div
                                v-if="topProducts.length === 0"
                                class="py-4 text-center text-sm text-muted-foreground"
                            >
                                No hay datos de ventas.
                            </div>
                        </div>
                    </DashboardPanel>

                    <DashboardPanel title="Actividad reciente">
                        <RecentActivityFeed
                            :activities="recentActivity || []"
                        />
                    </DashboardPanel>

                    <div class="flex min-w-0 flex-col gap-6">
                        <DashboardPanel title="Stock bajo">
                            <div class="space-y-3">
                                <div
                                    v-for="(product, index) in lowStockProducts"
                                    :key="index"
                                    class="flex min-w-0 items-center justify-between gap-3"
                                >
                                    <span
                                        class="min-w-0 text-sm break-words text-foreground"
                                        >{{ product.name }}</span
                                    >
                                    <span
                                        class="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300"
                                    >
                                        {{ product.stock }} uds
                                    </span>
                                </div>
                                <div
                                    v-if="lowStockProducts.length === 0"
                                    class="py-4 text-center text-sm text-muted-foreground"
                                >
                                    Inventario saludable.
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                class="mt-4 w-full"
                                @click="navigateTo('/inventory')"
                            >
                                Ver inventario
                            </Button>
                        </DashboardPanel>

                        <DashboardPanel title="Accesos rapidos">
                            <div class="grid grid-cols-2 gap-3">
                                <button
                                    v-for="action in quickActions"
                                    :key="action.href"
                                    type="button"
                                    class="flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-lg border bg-background p-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                                    @click="navigateTo(action.href)"
                                >
                                    <component
                                        :is="action.icon"
                                        class="size-5 text-muted-foreground"
                                    />
                                    <span class="text-center leading-tight">{{
                                        action.label
                                    }}</span>
                                </button>
                            </div>
                        </DashboardPanel>
                    </div>
                </section>

                <DashboardPanel
                    v-if="profitByBrand.length > 0"
                    title="Rentabilidad por marca"
                >
                    <div class="overflow-x-auto">
                        <table class="w-full min-w-[720px] text-sm">
                            <thead>
                                <tr class="border-b">
                                    <th
                                        class="py-3 text-left font-semibold text-muted-foreground"
                                    >
                                        Marca
                                    </th>
                                    <th
                                        class="py-3 text-right font-semibold text-muted-foreground"
                                    >
                                        Ingresos
                                    </th>
                                    <th
                                        class="py-3 text-right font-semibold text-muted-foreground"
                                    >
                                        Costo
                                    </th>
                                    <th
                                        class="py-3 text-right font-semibold text-muted-foreground"
                                    >
                                        Utilidad
                                    </th>
                                    <th
                                        class="py-3 text-right font-semibold text-muted-foreground"
                                    >
                                        Margen
                                    </th>
                                    <th
                                        class="py-3 text-right font-semibold text-muted-foreground"
                                    >
                                        Uds.
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="(brand, idx) in profitByBrand"
                                    :key="idx"
                                    class="border-b last:border-0 hover:bg-muted/40"
                                >
                                    <td
                                        class="py-3 font-medium text-foreground"
                                    >
                                        {{ brand.brand }}
                                    </td>
                                    <td
                                        class="py-3 text-right text-muted-foreground"
                                    >
                                        {{ formatCurrency(brand.revenue) }}
                                    </td>
                                    <td
                                        class="py-3 text-right text-muted-foreground"
                                    >
                                        {{ formatCurrency(brand.cost) }}
                                    </td>
                                    <td
                                        class="py-3 text-right font-semibold"
                                        :class="
                                            brand.profit >= 0
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-red-600 dark:text-red-400'
                                        "
                                    >
                                        {{ formatCurrency(brand.profit) }}
                                    </td>
                                    <td class="py-3 text-right">
                                        <span
                                            class="rounded-full px-2 py-0.5 text-xs font-semibold"
                                            :class="
                                                brand.margin >= 20
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                                    : brand.margin >= 10
                                                      ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300'
                                                      : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                                            "
                                        >
                                            {{ brand.margin }}%
                                        </span>
                                    </td>
                                    <td
                                        class="py-3 text-right text-muted-foreground"
                                    >
                                        {{ formatInteger(brand.units_sold) }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </DashboardPanel>
            </template>
        </PageShell>
    </AppLayout>
</template>
