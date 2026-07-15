<script setup lang="ts">
import DocumentReferenceLink from './DocumentReferenceLink.vue';
import type { TransactionTraceNode } from '@/types/transaction-trace';

defineProps<{ node: TransactionTraceNode; drawerFirst?: boolean }>();
const emit = defineEmits<{ inspect: [node: TransactionTraceNode] }>();
</script>

<template>
    <DocumentReferenceLink
        :node="node"
        :drawer-first="drawerFirst"
        @inspect="emit('inspect', $event)"
    />
</template>
