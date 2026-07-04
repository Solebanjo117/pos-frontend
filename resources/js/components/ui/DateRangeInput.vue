<script setup lang="ts">
import { Calendar } from 'lucide-vue-next';

defineProps<{
    from: string;
    to: string;
    label?: string;
}>();

const emit = defineEmits<{
    (e: 'update:from', value: string): void;
    (e: 'update:to', value: string): void;
    (e: 'change'): void;
}>();

const updateFrom = (event: Event) => {
    emit('update:from', (event.target as HTMLInputElement).value);
    emit('change');
};

const updateTo = (event: Event) => {
    emit('update:to', (event.target as HTMLInputElement).value);
    emit('change');
};
</script>

<template>
    <div>
        <label
            v-if="label"
            class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
        >
            <Calendar :size="12" class="mr-1 inline" />
            {{ label }}
        </label>
        <div
            class="flex h-10 items-center overflow-hidden rounded-md border border-slate-200 bg-white text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
            <input
                :value="from"
                type="date"
                class="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-sm outline-none focus:ring-0"
                aria-label="Fecha desde"
                @change="updateFrom"
            />
            <span
                class="shrink-0 border-x border-slate-200 px-2 text-xs font-semibold text-slate-400 dark:border-slate-700"
            >
                -
            </span>
            <input
                :value="to"
                type="date"
                class="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-sm outline-none focus:ring-0"
                aria-label="Fecha hasta"
                @change="updateTo"
            />
        </div>
    </div>
</template>
