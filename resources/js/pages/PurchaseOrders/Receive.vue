<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { Head, Link, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { usePurchaseOrders } from '@/composables/usePurchaseOrders';
import { PackageCheck, Save } from 'lucide-vue-next';
import PurchaseOrderSection from '@/components/PurchaseOrders/PurchaseOrderSection.vue';
import PurchaseOrderSideNav from '@/components/PurchaseOrders/PurchaseOrderSideNav.vue';
import PurchaseOrderToolbar from '@/components/PurchaseOrders/PurchaseOrderToolbar.vue';

const props = defineProps<{ purchaseOrderId: number }>();
const { purchaseOrder, loading, error, fetchPurchaseOrderById, receiveItems } =
    usePurchaseOrders();

const receiveData = ref<
    { item_id: number; quantity_received: number; batch_number: string }[]
>([]);

const hasPreAppliedStock = computed(
    () =>
        !!purchaseOrder.value?.items?.some(
            (i) =>
                Number(
                    (i.pre_applied_quantity ?? i.pre_stock_applied_qty) || 0,
                ) > 0,
        ),
);

const preAppliedPackages = computed(
    () =>
        purchaseOrder.value?.items?.reduce((sum, i) => {
            return (
                sum +
                Number((i.pre_applied_quantity ?? i.pre_stock_applied_qty) || 0)
            );
        }, 0) ?? 0,
);

const orderedPackages = computed(
    () =>
        purchaseOrder.value?.items?.reduce(
            (sum, item) => sum + Number(item.quantity_ordered || 0),
            0,
        ) ?? 0,
);

const alreadyReceivedPackages = computed(
    () =>
        purchaseOrder.value?.items?.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.effective_received_quantity ??
                        item.quantity_received ??
                        0,
                ),
            0,
        ) ?? 0,
);

const totalPendingPackages = computed(
    () =>
        purchaseOrder.value?.items?.reduce(
            (sum, item) => sum + Number(item.pending_quantity || 0),
            0,
        ) ?? 0,
);

const receivingPackages = computed(() =>
    receiveData.value.reduce(
        (sum, item) => sum + Number(item.quantity_received || 0),
        0,
    ),
);

const receivingItemCount = computed(
    () =>
        receiveData.value.filter(
            (item) => Number(item.quantity_received || 0) > 0,
        ).length,
);

const allItemsReceived = computed(
    () => !!purchaseOrder.value?.items?.every((item) => item.is_fully_received),
);

function itemFor(itemId: number) {
    return purchaseOrder.value?.items.find((i) => i.id === itemId);
}

function statusFor(itemId: number): 'ok' | 'partial' | 'excess' | 'pending' {
    const item = itemFor(itemId);
    const receiveNow =
        receiveData.value.find((row) => row.item_id === itemId)
            ?.quantity_received || 0;
    const pending = Number(item?.pending_quantity || 0);
    const alreadyReceived = Number(
        item?.effective_received_quantity ?? item?.quantity_received ?? 0,
    );

    if (pending <= 0) {
        return 'ok';
    }

    if (receiveNow === 0 && alreadyReceived === 0) {
        return 'pending';
    }

    if (receiveNow < pending) {
        return 'partial';
    }

    if (receiveNow === pending) {
        return 'ok';
    }

    return 'excess';
}

function statusLabel(status: 'ok' | 'partial' | 'excess' | 'pending'): string {
    return {
        ok: 'OK',
        partial: 'Falta',
        excess: 'Exceso',
        pending: 'Pend.',
    }[status];
}

function statusClass(status: 'ok' | 'partial' | 'excess' | 'pending'): string {
    return {
        ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
        partial: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
        excess: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
        pending: 'bg-gray-100 text-gray-600 dark:bg-muted dark:text-gray-300',
    }[status];
}

function handleMassReceive() {
    receiveData.value = receiveData.value.map((row) => ({
        ...row,
        quantity_received: Number(itemFor(row.item_id)?.pending_quantity || 0),
    }));
}

function formatCurrency(value: number | string | undefined): string {
    return `$${Number(value || 0).toFixed(2)}`;
}

onMounted(async () => {
    await fetchPurchaseOrderById(props.purchaseOrderId);
    if (purchaseOrder.value) {
        receiveData.value = purchaseOrder.value.items
            .filter((i) => !i.is_fully_received)
            .map((i) => ({
                item_id: i.id,
                quantity_received: 0,
                batch_number: '',
            }));
    }
});

async function handleSubmit() {
    const itemsToReceive = receiveData.value.filter(
        (i) => i.quantity_received > 0,
    );
    if (itemsToReceive.length === 0) {
        alert('Ingresa cantidades a recibir');
        return;
    }
    await receiveItems(props.purchaseOrderId, { items: itemsToReceive });
    router.visit(`/purchase-orders/${props.purchaseOrderId}`);
}
</script>

<template>
    <Head title="Recepcion de OC" />
    <AppLayout>
        <PurchaseOrderToolbar
            title="Recepcion de OC"
            :subtitle="`${purchaseOrder?.po_number || purchaseOrderId} | ${purchaseOrder?.supplier?.name || 'OC diaria general'}`"
            :status-label="purchaseOrder?.status_label"
            :total="purchaseOrder?.formatted_total"
        >
            <template #actions>
                <Link
                    :href="`/purchase-orders/${purchaseOrderId}`"
                    class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-border dark:bg-card dark:text-gray-200 dark:hover:bg-muted"
                >
                    Cancelar
                </Link>
                <button
                    type="submit"
                    form="receive-form"
                    :disabled="loading || receivingPackages <= 0"
                    class="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                    <Save :size="16" />
                    {{ loading ? 'Procesando...' : 'Registrar recepcion' }}
                </button>
            </template>
        </PurchaseOrderToolbar>

        <div
            class="min-h-[calc(100vh-4.25rem)] bg-gray-50/60 dark:bg-background"
        >
            <main class="mx-auto max-w-7xl min-w-0 p-4">
                <PurchaseOrderSideNav
                    v-if="purchaseOrder"
                    :purchase-order-id="purchaseOrder.id"
                    active="check-in"
                    :can-edit="purchaseOrder.status === 'draft'"
                />
                <div
                    v-if="error"
                    class="mb-3 border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
                >
                    {{ error }}
                </div>

                <div
                    v-if="purchaseOrder && hasPreAppliedStock"
                    class="mb-3 border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200"
                >
                    Esta OC viene desde POS con stock ya preaplicado. No volvera
                    a sumar inventario por esa base ({{ preAppliedPackages }}
                    paq.). Solo se recibira la diferencia pendiente.
                </div>

                <template v-if="purchaseOrder">
                    <div
                        class="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                    >
                        <div
                            class="grid flex-1 grid-cols-2 gap-2 md:grid-cols-5"
                        >
                            <div
                                class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-border dark:bg-card"
                            >
                                <p
                                    class="text-xs font-semibold text-gray-500 uppercase"
                                >
                                    Proveedor
                                </p>
                                <p class="mt-1 truncate text-sm font-semibold">
                                    {{
                                        purchaseOrder.supplier?.name ||
                                        'OC diaria'
                                    }}
                                </p>
                            </div>
                            <div
                                class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-border dark:bg-card"
                            >
                                <p
                                    class="text-xs font-semibold text-gray-500 uppercase"
                                >
                                    Ordenado
                                </p>
                                <p class="mt-1 text-xl font-bold">
                                    {{ orderedPackages }}
                                </p>
                            </div>
                            <div
                                class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-border dark:bg-card"
                            >
                                <p
                                    class="text-xs font-semibold text-gray-500 uppercase"
                                >
                                    Recibido
                                </p>
                                <p class="mt-1 text-xl font-bold">
                                    {{ alreadyReceivedPackages }}
                                </p>
                            </div>
                            <div
                                class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-border dark:bg-card"
                            >
                                <p
                                    class="text-xs font-semibold text-gray-500 uppercase"
                                >
                                    Pendiente
                                </p>
                                <p
                                    class="mt-1 text-xl font-bold text-amber-600"
                                >
                                    {{ totalPendingPackages }}
                                </p>
                            </div>
                            <div
                                class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-border dark:bg-card"
                            >
                                <p
                                    class="text-xs font-semibold text-gray-500 uppercase"
                                >
                                    A recibir
                                </p>
                                <p
                                    class="mt-1 text-xl font-bold text-green-600"
                                >
                                    {{ receivingPackages }}
                                </p>
                            </div>
                        </div>
                        <button
                            v-if="!allItemsReceived"
                            type="button"
                            class="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                            @click="handleMassReceive"
                        >
                            <PackageCheck :size="16" />
                            Recibir pendientes
                        </button>
                    </div>

                    <form
                        v-if="receiveData.length"
                        id="receive-form"
                        @submit.prevent="handleSubmit"
                        @keydown.enter="
                            (e: KeyboardEvent) => {
                                if (
                                    (e.target as HTMLElement)?.tagName ===
                                    'INPUT'
                                )
                                    e.preventDefault();
                            }
                        "
                    >
                        <PurchaseOrderSection
                            title="Articulos a recibir"
                            subtitle="Ajusta cantidades, lotes y costos antes de registrar"
                            :count="receiveData.length"
                            default-open
                        >
                            <div class="overflow-x-auto">
                                <table class="min-w-full text-sm">
                                    <thead
                                        class="sticky top-0 bg-gray-50 text-xs text-gray-500 uppercase dark:bg-muted/50 dark:text-gray-300"
                                    >
                                        <tr>
                                            <th
                                                class="w-12 px-3 py-2 text-left"
                                            >
                                                #
                                            </th>
                                            <th class="px-3 py-2 text-left">
                                                Estado
                                            </th>
                                            <th
                                                class="min-w-80 px-3 py-2 text-left"
                                            >
                                                Producto
                                            </th>
                                            <th class="px-3 py-2 text-right">
                                                Ordenado
                                            </th>
                                            <th class="px-3 py-2 text-right">
                                                Und/Paq
                                            </th>
                                            <th class="px-3 py-2 text-right">
                                                Pendiente
                                            </th>
                                            <th class="px-3 py-2 text-right">
                                                Recibir
                                            </th>
                                            <th class="px-3 py-2 text-left">
                                                Lote
                                            </th>
                                            <th class="px-3 py-2 text-right">
                                                Costo
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for="(rd, idx) in receiveData"
                                            :key="rd.item_id"
                                            class="border-t border-gray-100 hover:bg-emerald-50/50 dark:border-border dark:hover:bg-emerald-950/20"
                                        >
                                            <td class="px-3 py-2 text-gray-500">
                                                {{ idx + 1 }}
                                            </td>
                                            <td class="px-3 py-2">
                                                <span
                                                    :class="[
                                                        'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                                                        statusClass(
                                                            statusFor(
                                                                rd.item_id,
                                                            ),
                                                        ),
                                                    ]"
                                                >
                                                    {{
                                                        statusLabel(
                                                            statusFor(
                                                                rd.item_id,
                                                            ),
                                                        )
                                                    }}
                                                </span>
                                            </td>
                                            <td class="px-3 py-2">
                                                <p
                                                    class="font-semibold text-emerald-700 dark:text-emerald-300"
                                                >
                                                    {{
                                                        itemFor(rd.item_id)
                                                            ?.product?.name ||
                                                        'Producto'
                                                    }}
                                                </p>
                                                <p
                                                    class="font-mono text-xs text-gray-500"
                                                >
                                                    {{
                                                        itemFor(rd.item_id)
                                                            ?.variant?.sku ||
                                                        itemFor(rd.item_id)
                                                            ?.product
                                                            ?.sku_base ||
                                                        '-'
                                                    }}
                                                </p>
                                                <p
                                                    v-if="
                                                        (itemFor(rd.item_id)
                                                            ?.pre_applied_quantity ??
                                                            itemFor(rd.item_id)
                                                                ?.pre_stock_applied_qty ??
                                                            0) > 0
                                                    "
                                                    class="mt-1 text-xs text-amber-600 dark:text-amber-300"
                                                >
                                                    POS preaplicado:
                                                    {{
                                                        itemFor(rd.item_id)
                                                            ?.pre_applied_quantity ??
                                                        itemFor(rd.item_id)
                                                            ?.pre_stock_applied_qty
                                                    }}
                                                    paq.
                                                </p>
                                            </td>
                                            <td class="px-3 py-2 text-right">
                                                {{
                                                    itemFor(rd.item_id)
                                                        ?.quantity_ordered
                                                }}
                                            </td>
                                            <td class="px-3 py-2 text-right">
                                                {{
                                                    itemFor(rd.item_id)
                                                        ?.units_per_package ?? 1
                                                }}
                                            </td>
                                            <td
                                                class="px-3 py-2 text-right font-semibold text-amber-600"
                                            >
                                                {{
                                                    itemFor(rd.item_id)
                                                        ?.pending_quantity
                                                }}
                                            </td>
                                            <td class="px-3 py-2 text-right">
                                                <input
                                                    v-model.number="
                                                        rd.quantity_received
                                                    "
                                                    type="number"
                                                    min="0"
                                                    :max="
                                                        itemFor(rd.item_id)
                                                            ?.pending_quantity
                                                    "
                                                    class="w-24 rounded border border-gray-300 bg-white px-2 py-1 text-right text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                                />
                                            </td>
                                            <td class="px-3 py-2">
                                                <input
                                                    v-model="rd.batch_number"
                                                    type="text"
                                                    placeholder="Opcional"
                                                    class="w-32 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                                />
                                            </td>
                                            <td
                                                class="px-3 py-2 text-right font-mono"
                                            >
                                                {{
                                                    formatCurrency(
                                                        itemFor(rd.item_id)
                                                            ?.unit_cost,
                                                    )
                                                }}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div
                                class="border-t border-gray-100 bg-gray-50 px-4 py-3 text-sm dark:border-border dark:bg-muted/20"
                            >
                                <div
                                    class="ml-auto grid max-w-md grid-cols-3 gap-3 text-right"
                                >
                                    <div>
                                        <p class="text-xs text-gray-500">
                                            Items a recibir
                                        </p>
                                        <p class="font-semibold">
                                            {{ receivingItemCount }}
                                        </p>
                                    </div>
                                    <div>
                                        <p class="text-xs text-gray-500">
                                            Paquetes
                                        </p>
                                        <p class="font-semibold">
                                            {{ receivingPackages }}
                                        </p>
                                    </div>
                                    <div>
                                        <p class="text-xs text-gray-500">
                                            Pendientes
                                        </p>
                                        <p class="font-semibold text-amber-600">
                                            {{ totalPendingPackages }}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </PurchaseOrderSection>
                    </form>

                    <div
                        v-else
                        class="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm dark:border-border dark:bg-card"
                    >
                        <PackageCheck
                            class="mx-auto mb-3 text-green-500"
                            :size="48"
                        />
                        <p class="text-gray-600 dark:text-gray-400">
                            Todos los articulos ya han sido recibidos
                        </p>
                    </div>
                </template>
            </main>
        </div>
    </AppLayout>
</template>
