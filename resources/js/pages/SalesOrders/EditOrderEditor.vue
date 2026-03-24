<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue'
import PosIndex from '@/pages/POS/Index.vue'

defineOptions({ layout: AppLayout })

const props = defineProps<{
  orderId: number
}>()
</script>

<template>
  <PosIndex :edit-mode="true" :order-id="props.orderId" />
</template>
