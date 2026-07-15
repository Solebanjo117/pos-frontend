<script setup lang="ts">
import TransactionTraceDrawer from './TransactionTraceDrawer.vue';

defineProps<{ open: boolean; movementId?: number | null }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
    <TransactionTraceDrawer
        :open="open"
        type="inventory_movement"
        :id="movementId"
        @close="emit('close')"
    />
</template>
