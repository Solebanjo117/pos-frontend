<script setup lang="ts">
import { Link2, ShieldAlert } from 'lucide-vue-next';
import DocumentReferenceLink from './DocumentReferenceLink.vue';
import type { TransactionTraceNode } from '@/types/transaction-trace';

defineProps<{
    nodes: TransactionTraceNode[];
    title?: string;
    drawerFirst?: boolean;
}>();
const emit = defineEmits<{ inspect: [node: TransactionTraceNode] }>();

const relationLabel = (value?: string | null): string =>
    ({
        customer: 'Cliente',
        supplier: 'Proveedor',
        beneficiary: 'Beneficiario',
        source_quote: 'Cotizacion origen',
        source_invoice: 'Factura origen',
        converted_invoice: 'Factura creada',
        invoice: 'Factura',
        payment: 'Pago',
        refund: 'Reembolso',
        return: 'Devolucion',
        credit_note: 'Nota de credito',
        cashier_queue: 'Cola de Caja',
        cash_session: 'Sesion de Caja',
        cash_movement: 'Movimiento de caja',
        inventory_movement: 'Movimiento de inventario',
        related_movement: 'Movimiento relacionado',
        receivable: 'CxC',
        receivable_adjustment: 'Ajuste CxC',
        receivable_ledger: 'Mayor CxC',
        payable: 'CxP',
        category: 'Categoria',
        source_document: 'Documento origen',
        sale: 'Venta',
        supplier_payment: 'Pago proveedor',
    })[value || ''] ||
    value ||
    'Relacionado';
</script>

<template>
    <section
        class="rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
    >
        <header
            class="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800"
        >
            <Link2 class="h-4 w-4 text-cyan-700" />
            <h3
                class="text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
                {{ title || 'Documentos relacionados' }}
            </h3>
        </header>
        <div
            v-if="nodes.length"
            class="divide-y divide-slate-100 dark:divide-slate-800"
        >
            <div
                v-for="node in nodes"
                :key="`${node.type}-${node.id}-${node.relation}`"
                class="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1.5fr)_auto] items-center gap-2 px-3 py-2 text-sm"
            >
                <span class="text-xs text-slate-500">{{
                    relationLabel(node.relation)
                }}</span>
                <DocumentReferenceLink
                    :node="node"
                    :drawer-first="drawerFirst"
                    @inspect="emit('inspect', $event)"
                />
                <span v-if="node.status" class="text-xs text-slate-500">{{
                    node.status
                }}</span>
                <ShieldAlert
                    v-else-if="node.restricted"
                    class="h-4 w-4 text-slate-400"
                />
            </div>
        </div>
        <p v-else class="px-3 py-5 text-center text-sm text-slate-500">
            No hay documentos relacionados.
        </p>
    </section>
</template>
