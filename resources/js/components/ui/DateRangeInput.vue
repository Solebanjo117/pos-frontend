<script setup lang="ts">
import { Calendar, ChevronDown } from 'lucide-vue-next';

const props = defineProps<{
    from: string;
    to: string;
    label?: string;
}>();

const emit = defineEmits<{
    (e: 'update:from', value: string): void;
    (e: 'update:to', value: string): void;
    (e: 'change'): void;
}>();

const formatInputDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDisplayDate = (value: string): string => {
    if (!value) return '--/--/----';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
};

const applyRange = (from: Date | null, to: Date | null): void => {
    emit('update:from', from ? formatInputDate(from) : '');
    emit('update:to', to ? formatInputDate(to) : '');
    emit('change');
};

const applyPreset = (
    preset:
        | 'today'
        | 'yesterday'
        | 'week'
        | 'month'
        | 'previous_month'
        | 'year'
        | 'clear',
): void => {
    if (preset === 'clear') {
        applyRange(null, null);
        return;
    }

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(from);

    if (preset === 'yesterday') {
        from.setDate(from.getDate() - 1);
        to.setDate(to.getDate() - 1);
    } else if (preset === 'week') {
        const mondayOffset = (from.getDay() + 6) % 7;
        from.setDate(from.getDate() - mondayOffset);
    } else if (preset === 'month') {
        from.setDate(1);
    } else if (preset === 'previous_month') {
        from.setMonth(from.getMonth() - 1, 1);
        to.setDate(0);
    } else if (preset === 'year') {
        from.setMonth(0, 1);
    }

    applyRange(from, to);
};

const updateFrom = (event: Event): void => {
    emit('update:from', (event.target as HTMLInputElement).value);
};

const updateTo = (event: Event): void => {
    emit('update:to', (event.target as HTMLInputElement).value);
};

const applyManualRange = (): void => {
    if (props.from && props.to) emit('change');
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

        <details class="group relative">
            <summary
                class="flex h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 select-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
                <span class="truncate tabular-nums">
                    {{ formatDisplayDate(from) }} - {{ formatDisplayDate(to) }}
                </span>
                <ChevronDown
                    :size="15"
                    class="shrink-0 text-slate-400 transition group-open:rotate-180"
                />
            </summary>

            <div
                class="absolute top-11 left-0 z-40 w-[min(92vw,460px)] rounded-md border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-950"
            >
                <div class="mb-3 flex flex-wrap gap-1.5">
                    <button type="button" class="preset" @click="applyPreset('today')">Hoy</button>
                    <button type="button" class="preset" @click="applyPreset('yesterday')">Ayer</button>
                    <button type="button" class="preset" @click="applyPreset('week')">Semana</button>
                    <button type="button" class="preset" @click="applyPreset('month')">Mes</button>
                    <button type="button" class="preset" @click="applyPreset('previous_month')">Mes anterior</button>
                    <button type="button" class="preset" @click="applyPreset('year')">Año</button>
                    <button type="button" class="preset" @click="applyPreset('clear')">Limpiar</button>
                </div>

                <div class="grid gap-2 sm:grid-cols-2">
                    <label class="text-xs font-medium text-slate-500">
                        Desde
                        <input
                            :value="from"
                            type="date"
                            class="mt-1 h-9 w-full rounded-md border border-slate-200 bg-transparent px-2 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-indigo-400 dark:border-slate-700 dark:text-slate-100"
                            @change="updateFrom"
                        />
                    </label>
                    <label class="text-xs font-medium text-slate-500">
                        Hasta
                        <input
                            :value="to"
                            type="date"
                            class="mt-1 h-9 w-full rounded-md border border-slate-200 bg-transparent px-2 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-indigo-400 dark:border-slate-700 dark:text-slate-100"
                            @change="updateTo"
                        />
                    </label>
                </div>

                <button
                    type="button"
                    class="mt-3 h-9 w-full rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                    :disabled="!from || !to"
                    @click="applyManualRange"
                >
                    Aplicar rango
                </button>
            </div>
        </details>
    </div>
</template>

<style scoped>
.preset {
    border: 1px solid rgb(226 232 240);
    border-radius: 0.375rem;
    padding: 0.35rem 0.55rem;
    color: rgb(71 85 105);
    font-size: 0.75rem;
    font-weight: 600;
}

.preset:hover {
    background: rgb(248 250 252);
}

:global(.dark) .preset {
    border-color: rgb(51 65 85);
    color: rgb(203 213 225);
}

:global(.dark) .preset:hover {
    background: rgb(15 23 42);
}
</style>
