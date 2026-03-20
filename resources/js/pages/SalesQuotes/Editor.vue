<script setup lang="ts">
import PosIndex from '@/pages/POS/Index.vue'

const props = defineProps<{
  quoteId?: number
}>()
</script>

<template>
  <PosIndex :quote-mode="true" :quote-id="props.quoteId" />
</template>
