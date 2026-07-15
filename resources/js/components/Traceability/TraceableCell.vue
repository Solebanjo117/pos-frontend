<script setup lang="ts">
import EntityLink from './EntityLink.vue';
import type { TransactionTraceNode } from '@/types/transaction-trace';

defineProps<{
    value?: string | number | null;
    node?: TransactionTraceNode | null;
}>();
const emit = defineEmits<{ inspect: [node: TransactionTraceNode] }>();
</script>

<template>
    <EntityLink
        v-if="node"
        :node="node"
        drawer-first
        @inspect="emit('inspect', $event)"
    />
    <span v-else>{{ value ?? '-' }}</span>
</template>
