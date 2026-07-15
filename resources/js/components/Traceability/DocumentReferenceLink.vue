<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { ExternalLink, LockKeyhole } from 'lucide-vue-next';
import type { TransactionTraceNode } from '@/types/transaction-trace';

defineProps<{
    node: TransactionTraceNode;
    compact?: boolean;
    drawerFirst?: boolean;
}>();

const emit = defineEmits<{ inspect: [node: TransactionTraceNode] }>();
</script>

<template>
    <span
        v-if="node.restricted"
        class="inline-flex items-center gap-1 text-xs text-slate-400"
        title="Existe un documento relacionado, pero no tiene permiso para abrirlo."
    >
        <LockKeyhole class="h-3.5 w-3.5" />
        {{ node.label }}
    </span>
    <button
        v-else-if="drawerFirst && node.traceable"
        type="button"
        class="inline-flex min-w-0 items-center gap-1 font-medium text-cyan-700 hover:text-cyan-900 hover:underline"
        @click="emit('inspect', node)"
    >
        <span class="truncate">{{ node.number || node.label }}</span>
    </button>
    <Link
        v-else-if="node.href"
        :href="node.href"
        class="inline-flex min-w-0 items-center gap-1 font-medium text-cyan-700 hover:text-cyan-900 hover:underline"
    >
        <span class="truncate">{{ node.number || node.label }}</span>
        <ExternalLink v-if="!compact" class="h-3.5 w-3.5 shrink-0" />
    </Link>
    <button
        v-else-if="node.traceable"
        type="button"
        class="inline-flex min-w-0 items-center gap-1 font-medium text-cyan-700 hover:text-cyan-900 hover:underline"
        @click="emit('inspect', node)"
    >
        <span class="truncate">{{ node.number || node.label }}</span>
    </button>
    <span v-else class="text-slate-600">{{ node.number || node.label }}</span>
</template>
