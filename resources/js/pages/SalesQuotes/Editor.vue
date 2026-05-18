<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import PosIndex from '@/pages/POS/Index.vue';

defineOptions({ layout: AppLayout });

const props = defineProps<{
    quoteId?: number;
}>();
</script>

<template>
    <PosIndex :quote-mode="true" :quote-id="props.quoteId" />
</template>
