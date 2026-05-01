<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import {
    ClipboardCheck,
    CreditCard,
    Edit3,
    FileText,
    Package,
    Truck,
} from 'lucide-vue-next';

const props = defineProps<{
    purchaseOrderId: number;
    active: 'check-in' | 'details' | 'items' | 'costs';
    canEdit?: boolean;
}>();

type NavItem = {
    key:
        | 'check-in'
        | 'shipments'
        | 'details'
        | 'items'
        | 'costs'
        | 'email'
        | 'export';
    label: string;
    icon: typeof ClipboardCheck;
    disabled?: boolean;
};

const navItems: NavItem[] = [
    { key: 'details', label: 'Resumen', icon: Edit3 },
    { key: 'items', label: 'Articulos', icon: Package },
    { key: 'check-in', label: 'Recepcion', icon: ClipboardCheck },
    { key: 'costs', label: 'Costos y pagos', icon: CreditCard },
    {
        key: 'shipments',
        label: 'Historial',
        icon: Truck,
        disabled: true,
    },
    { key: 'export', label: 'Exportar', icon: FileText, disabled: true },
];

function hrefFor(key: string): string {
    if (key === 'check-in') {
        return `/purchase-orders/${props.purchaseOrderId}/receive`;
    }

    if (key === 'details' && props.canEdit) {
        return `/purchase-orders/${props.purchaseOrderId}/edit`;
    }

    return `/purchase-orders/${props.purchaseOrderId}#${key}`;
}
</script>

<template>
    <div
        class="mb-4 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 shadow-sm dark:border-border dark:bg-card"
    >
        <nav class="flex min-w-max items-center gap-1 text-sm">
            <template v-for="item in navItems" :key="item.key">
                <span
                    v-if="item.disabled"
                    class="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-gray-400 dark:text-gray-500"
                >
                    <component :is="item.icon" :size="15" />
                    {{ item.label }}
                </span>
                <Link
                    v-else
                    :href="hrefFor(item.key)"
                    class="flex items-center gap-2 rounded-md px-3 py-2 transition hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-200"
                    :class="
                        active === item.key
                            ? 'bg-emerald-600 font-semibold text-white shadow-sm dark:bg-emerald-500 dark:text-emerald-950'
                            : 'text-gray-600 dark:text-gray-300'
                    "
                >
                    <component :is="item.icon" :size="15" />
                    {{ item.label }}
                </Link>
            </template>
        </nav>
    </div>
</template>
