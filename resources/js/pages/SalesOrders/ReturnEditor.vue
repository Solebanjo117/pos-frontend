<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue'
import PosIndex from '@/pages/POS/Index.vue'

const props = defineProps<{
  orderId: number
}>()

defineOptions({ layout: AppLayout })
</script>

<template>
  <PosIndex :return-mode="true" :order-id="props.orderId" />
</template>
