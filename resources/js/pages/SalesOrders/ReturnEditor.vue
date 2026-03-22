<script setup lang="ts">
import PosIndex from '@/pages/POS/Index.vue'

const props = defineProps<{
  orderId: number
}>()
</script>

<template>
  <PosIndex :return-mode="true" :order-id="props.orderId" />
</template>
