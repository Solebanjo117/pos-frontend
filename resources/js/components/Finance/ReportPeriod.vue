<script setup lang="ts">
import DateRangeInput from '@/components/ui/DateRangeInput.vue';
defineProps<{ from: string; to: string }>();
const emit = defineEmits<{ 'update:from': [string]; 'update:to': [string] }>();
</script>
<template>
    <DateRangeInput
        :from="from"
        :to="to"
        label="Rango de fechas"
        class="w-full min-w-0 md:max-w-xl md:flex-1"
        @update:from="emit('update:from', $event)"
        @update:to="emit('update:to', $event)"
    />
</template>
