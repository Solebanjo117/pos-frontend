<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import {
    AlertTriangle,
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    LoaderCircle,
} from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import TransactionRelationsPanel from './TransactionRelationsPanel.vue';
import TransactionTimeline from './TransactionTimeline.vue';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { transactionTraceService } from '@/services/transaction-traces';
import type {
    InventoryMovementTraceDetails,
    TransactionTrace,
    TransactionTraceNode,
} from '@/types/transaction-trace';

const props = defineProps<{
    open: boolean;
    type?: string | null;
    id?: number | null;
    initialTrace?: TransactionTrace | null;
}>();

const emit = defineEmits<{ close: [] }>();

const trace = ref<TransactionTrace | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const currentType = ref<string | null>(null);
const currentId = ref<number | null>(null);
const navigationStack = ref<TransactionTraceNode[]>([]);

const inventoryDetails = computed<InventoryMovementTraceDetails | null>(() =>
    trace.value?.root.type === 'inventory_movement'
        ? (trace.value.details as InventoryMovementTraceDetails)
        : null,
);

const formatMoney = (value?: number | null): string =>
    new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value || 0));

const load = async (type: string, id: number, page = 1): Promise<void> => {
    currentType.value = type;
    currentId.value = id;
    loading.value = true;
    error.value = null;
    try {
        trace.value = await transactionTraceService.get(type, id, page, 25);
    } catch (caught: any) {
        error.value =
            caught.response?.status === 403
                ? 'No tiene permiso para abrir este documento.'
                : caught.response?.data?.message ||
                  'No se pudo cargar la trazabilidad.';
    } finally {
        loading.value = false;
    }
};

const inspect = (node: TransactionTraceNode): void => {
    if (!node.can_view || !node.traceable) return;
    if (trace.value?.root) navigationStack.value.push(trace.value.root);
    void load(node.type, node.id);
};

const goBack = (): void => {
    const previous = navigationStack.value.pop();
    if (previous) void load(previous.type, previous.id);
};

const changePage = (page: number): void => {
    if (!currentType.value || !currentId.value || loading.value) return;
    if (page < 1 || page > (trace.value?.meta.last_page ?? 1)) return;
    void load(currentType.value, currentId.value, page);
};

watch(
    () => [props.open, props.type, props.id, props.initialTrace] as const,
    ([open, type, id, initialTrace]) => {
        if (!open) return;
        navigationStack.value = [];
        if (initialTrace) {
            trace.value = initialTrace;
            currentType.value = initialTrace.root.type;
            currentId.value = initialTrace.root.id;
            return;
        }
        if (
            type &&
            id &&
            (type !== currentType.value || id !== currentId.value)
        ) {
            void load(type, id);
        }
    },
    { immediate: true },
);
</script>

<template>
    <Sheet :open="open" @update:open="!$event && emit('close')">
        <SheetContent class="w-full overflow-y-auto sm:max-w-xl">
            <SheetHeader
                class="border-b border-slate-200 pr-10 dark:border-slate-800"
            >
                <SheetTitle>{{
                    trace?.root.label || 'Trazabilidad'
                }}</SheetTitle>
                <SheetDescription>
                    Origen, documentos relacionados y movimientos derivados.
                </SheetDescription>
            </SheetHeader>

            <div
                v-if="loading"
                class="flex flex-1 items-center justify-center p-8 text-sm text-slate-500"
            >
                <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
                Cargando trazabilidad...
            </div>
            <div
                v-else-if="error"
                class="m-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
                <AlertTriangle class="mr-1 inline h-4 w-4" />
                {{ error }}
            </div>
            <div v-else-if="trace" class="space-y-4 p-4 pt-0">
                <button
                    v-if="navigationStack.length"
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
                    @click="goBack"
                >
                    <ArrowLeft class="h-3.5 w-3.5" />
                    Volver a
                    {{
                        navigationStack[navigationStack.length - 1]?.number ||
                        navigationStack[navigationStack.length - 1]?.label
                    }}
                </button>
                <div
                    class="grid grid-cols-2 gap-3 rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800"
                >
                    <div>
                        <p class="text-xs text-slate-500">Documento</p>
                        <p class="font-semibold">
                            {{ trace.root.number || `#${trace.root.id}` }}
                        </p>
                    </div>
                    <div>
                        <p class="text-xs text-slate-500">Estado</p>
                        <p class="font-semibold">
                            {{ trace.root.status || '-' }}
                        </p>
                    </div>
                    <div
                        v-if="
                            trace.root.amount !== null &&
                            trace.root.amount !== undefined
                        "
                    >
                        <p class="text-xs text-slate-500">Monto</p>
                        <p class="font-semibold">
                            {{ formatMoney(trace.root.amount) }}
                        </p>
                    </div>
                    <div
                        v-if="trace.root.href"
                        class="flex items-end justify-end"
                    >
                        <Link
                            :href="trace.root.href"
                            class="text-xs font-medium text-cyan-700 hover:underline"
                        >
                            Abrir documento completo
                        </Link>
                    </div>
                </div>

                <section
                    v-if="inventoryDetails"
                    class="rounded-md border border-slate-200 p-3 dark:border-slate-800"
                >
                    <h3 class="mb-3 text-sm font-semibold">
                        Detalle de inventario
                    </h3>
                    <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <div>
                            <dt class="text-xs text-slate-500">Producto</dt>
                            <dd class="font-medium">
                                {{ inventoryDetails.product?.name || '-' }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-xs text-slate-500">Variante</dt>
                            <dd>{{ inventoryDetails.variant?.sku || '-' }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-slate-500">
                                Almacen origen
                            </dt>
                            <dd>
                                {{ inventoryDetails.warehouse?.name || '-' }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-xs text-slate-500">
                                Almacen destino
                            </dt>
                            <dd>
                                {{
                                    inventoryDetails.destination_warehouse
                                        ?.name || '-'
                                }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-xs text-slate-500">Antes</dt>
                            <dd>
                                {{ inventoryDetails.quantity_before ?? '-' }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-xs text-slate-500">Movimiento</dt>
                            <dd>{{ inventoryDetails.quantity }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-slate-500">Despues</dt>
                            <dd>
                                {{ inventoryDetails.quantity_after ?? '-' }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-xs text-slate-500">Usuario</dt>
                            <dd>{{ inventoryDetails.user?.name || '-' }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-slate-500">
                                Costo unitario
                            </dt>
                            <dd>
                                {{ formatMoney(inventoryDetails.unit_cost) }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-xs text-slate-500">Costo total</dt>
                            <dd>
                                {{ formatMoney(inventoryDetails.total_cost) }}
                            </dd>
                        </div>
                        <div class="col-span-2">
                            <dt class="text-xs text-slate-500">Motivo</dt>
                            <dd>{{ inventoryDetails.reason || '-' }}</dd>
                        </div>
                        <div class="col-span-2">
                            <dt class="text-xs text-slate-500">Notas</dt>
                            <dd>{{ inventoryDetails.notes || '-' }}</dd>
                        </div>
                    </dl>
                    <div
                        v-if="inventoryDetails.fifo_lots.length"
                        class="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800"
                    >
                        <p class="mb-2 text-xs font-semibold text-slate-600">
                            Lotes FIFO
                        </p>
                        <div
                            v-for="lot in inventoryDetails.fifo_lots"
                            :key="lot.id"
                            class="flex justify-between py-1 text-xs"
                        >
                            <span
                                >Lote #{{ lot.id }}
                                <span v-if="lot.batch_number"
                                    >({{ lot.batch_number }})</span
                                ></span
                            >
                            <span
                                >{{ lot.quantity }} x
                                {{ formatMoney(lot.unit_cost) }}</span
                            >
                        </div>
                    </div>
                </section>

                <TransactionRelationsPanel
                    :nodes="trace.relationships"
                    drawer-first
                    @inspect="inspect"
                />
                <TransactionTimeline
                    :events="trace.timeline"
                    drawer-first
                    @inspect="inspect"
                />
                <div
                    v-if="trace.meta.total > trace.meta.per_page"
                    class="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300"
                >
                    <span>
                        {{ trace.meta.total }} eventos · pagina
                        {{ trace.meta.current_page }} de
                        {{ trace.meta.last_page }}
                    </span>
                    <div class="flex items-center gap-1">
                        <button
                            type="button"
                            class="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
                            title="Pagina anterior"
                            :disabled="trace.meta.current_page <= 1 || loading"
                            @click="changePage(trace.meta.current_page - 1)"
                        >
                            <ChevronLeft class="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            class="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
                            title="Pagina siguiente"
                            :disabled="
                                trace.meta.current_page >=
                                    trace.meta.last_page || loading
                            "
                            @click="changePage(trace.meta.current_page + 1)"
                        >
                            <ChevronRight class="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </SheetContent>
    </Sheet>
</template>
