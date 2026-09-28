<script setup lang="ts">
import { reportPeriod } from '@/utils/moneyReports';
defineProps<{ from: string; to: string }>();
const emit = defineEmits<{ 'update:from': [string]; 'update:to': [string] }>();
function preset(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'custom') return;
    const range = reportPeriod(value);
    emit('update:from', range.date_from);
    emit('update:to', range.date_to);
}
</script>
<template>
    <label class="text-xs"
        >Período<select
            aria-label="Período"
            class="mt-1 block rounded border bg-background p-2"
            @change="preset"
        >
            <option value="month">Mes actual</option>
            <option value="today">Hoy</option>
            <option value="previous">Mes anterior</option>
            <option value="two">Últimos dos meses</option>
            <option value="custom">Personalizado</option>
        </select></label
    >
    <label class="text-xs"
        >Desde<input
            aria-label="Desde"
            type="date"
            required
            :value="from"
            class="mt-1 block rounded border bg-background p-2"
            @input="
                emit('update:from', ($event.target as HTMLInputElement).value)
            "
    /></label>
    <label class="text-xs"
        >Hasta<input
            aria-label="Hasta"
            type="date"
            required
            :value="to"
            :min="from"
            class="mt-1 block rounded border bg-background p-2"
            @input="
                emit('update:to', ($event.target as HTMLInputElement).value)
            "
    /></label>
</template>
