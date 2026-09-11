<script setup lang="ts">
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameMonth,
    isWithinInterval,
    startOfMonth,
    startOfWeek,
    subDays,
    subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

const props = withDefaults(
    defineProps<{
        from?: string;
        to?: string;
        label?: string;
        persistToUrl?: boolean;
    }>(),
    { persistToUrl: true },
);

const emit = defineEmits<{
    (e: 'update:from', value: string): void;
    (e: 'update:to', value: string): void;
    (e: 'change'): void;
}>();

const open = ref(false);
const container = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const selectingEnd = ref(false);
const draftFrom = ref(props.from);
const draftTo = ref(props.to);

const panamaToday = (): Date => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Panama',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return new Date(Number(value.year), Number(value.month) - 1, Number(value.day), 12);
};

const parseDate = (value?: string): Date | null => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12);
    return Number.isNaN(date.getTime()) || format(date, 'yyyy-MM-dd') !== value ? null : date;
};

const inputDate = (date: Date): string => format(date, 'yyyy-MM-dd');
const displayDate = (value?: string): string => {
    const date = parseDate(value);
    return date ? format(date, 'dd/MM/yyyy') : '--/--/----';
};

const visibleMonth = ref(startOfMonth(parseDate(props.from) ?? panamaToday()));
const months = computed(() => Array.from({ length: 3 }, (_, index) => {
    const month = addMonths(visibleMonth.value, index);
    return { month, days: eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    }) };
}));
const panelPosition = ref({ top: '0px', left: '0px' });
const positionPanel = (): void => {
    const rect = trigger.value?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(800, window.innerWidth - 24);
    panelPosition.value = {
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) + 'px',
        top: Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - 470)) + 'px',
    };
};
const applyDraft = (): void => {
    const from = parseDate(draftFrom.value);
    const to = parseDate(draftTo.value);
    if (!from || !to) return;
    commit(from < to ? from : to, from < to ? to : from);
};

const persist = (from: string, to: string): void => {
    if (!props.persistToUrl || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (from) url.searchParams.set('date_from', from);
    else url.searchParams.delete('date_from');
    if (to) url.searchParams.set('date_to', to);
    else url.searchParams.delete('date_to');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
};

const commit = (from: Date | null, to: Date | null): void => {
    const fromValue = from ? inputDate(from) : '';
    const toValue = to ? inputDate(to) : '';
    draftFrom.value = fromValue;
    draftTo.value = toValue;
    emit('update:from', fromValue);
    emit('update:to', toValue);
    persist(fromValue, toValue);
    open.value = false;
    selectingEnd.value = false;
    nextTick(() => emit('change'));
};

type Preset = 'today' | 'yesterday' | 'last7' | 'last30' | 'month' | 'previousMonth' | 'last3Months' | 'year' | 'previousYear' | 'clear';
const presetOptions: Array<{ value: Preset; label: string }> = [
    { value: 'today', label: 'Hoy' },
    { value: 'yesterday', label: 'Ayer' },
    { value: 'last7', label: 'Ultimos 7 dias' },
    { value: 'last30', label: 'Ultimos 30 dias' },
    { value: 'month', label: 'Este mes' },
    { value: 'previousMonth', label: 'Mes anterior' },
    { value: 'last3Months', label: 'Ultimos 3 meses' },
    { value: 'year', label: 'Este ano' },
    { value: 'previousYear', label: 'Ano anterior' },
    { value: 'clear', label: 'Limpiar' },
];

const applyPreset = (preset: Preset): void => {
    if (preset === 'clear') return commit(null, null);
    const today = panamaToday();
    let from = new Date(today);
    let to = new Date(today);

    if (preset === 'yesterday') from = to = subDays(today, 1);
    if (preset === 'last7') from = subDays(today, 6);
    if (preset === 'last30') from = subDays(today, 29);
    if (preset === 'month') from = startOfMonth(today);
    if (preset === 'previousMonth') {
        from = startOfMonth(subMonths(today, 1));
        to = endOfMonth(from);
    }
    if (preset === 'last3Months') from = startOfMonth(subMonths(today, 2));
    if (preset === 'year') from = new Date(today.getFullYear(), 0, 1, 12);
    if (preset === 'previousYear') {
        from = new Date(today.getFullYear() - 1, 0, 1, 12);
        to = new Date(today.getFullYear() - 1, 11, 31, 12);
    }
    commit(from, to);
};

const chooseDay = (day: Date): void => {
    const currentFrom = parseDate(draftFrom.value);
    if (!selectingEnd.value || !currentFrom) {
        draftFrom.value = inputDate(day);
        draftTo.value = inputDate(day);
        selectingEnd.value = true;
        return;
    }
    draftFrom.value = inputDate(day < currentFrom ? day : currentFrom);
    draftTo.value = inputDate(day < currentFrom ? currentFrom : day);
    selectingEnd.value = false;
};

const inDraftRange = (day: Date): boolean => {
    const from = parseDate(draftFrom.value);
    const to = parseDate(draftTo.value);
    return !!from && !!to && isWithinInterval(day, { start: from, end: to });
};

const toggle = (): void => {
    open.value = !open.value;
    if (open.value) {
        selectingEnd.value = false;
        positionPanel();
        draftFrom.value = props.from;
        draftTo.value = props.to;
        visibleMonth.value = startOfMonth(parseDate(props.from) ?? subMonths(panamaToday(), 2));
        nextTick(() => {
            const selected = draftFrom.value || inputDate(panamaToday());
            panel.value
                ?.querySelector<HTMLButtonElement>(
                    `[data-calendar-day="${selected}"]`,
                )
                ?.focus();
        });
    }
};

const close = (): void => {
    open.value = false;
    nextTick(() => trigger.value?.focus());
};

const handleDialogKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
    }
    if (event.key !== 'Tab' || !panel.value) return;
    const focusable = Array.from(
        panel.value.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled])',
        ),
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
};

const handleOutsideClick = (event: PointerEvent): void => {
    if (open.value && !container.value?.contains(event.target as Node) && !panel.value?.contains(event.target as Node)) close();
};

onMounted(() => document.addEventListener('pointerdown', handleOutsideClick));
onBeforeUnmount(() =>
    document.removeEventListener('pointerdown', handleOutsideClick),
);

const handleDayKey = (event: KeyboardEvent, day: Date): void => {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const target = inputDate(new Date(day.getFullYear(), day.getMonth(), day.getDate() + offsets[event.key], 12));
    panel.value?.querySelector<HTMLButtonElement>(`[data-calendar-day="${target}"]`)?.focus();
};
</script>

<template>
    <div ref="container" class="relative">
        <label v-if="label" class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            <Calendar :size="12" class="mr-1 inline" /> {{ label }}
        </label>
        <button ref="trigger" type="button" class="flex h-10 w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" :aria-expanded="open" aria-haspopup="dialog" @click="toggle">
            <span class="truncate tabular-nums">{{ displayDate(from) }} - {{ displayDate(to) }}</span>
            <ChevronDown :size="15" class="shrink-0 text-slate-400 transition" :class="{ 'rotate-180': open }" />
        </button>

        <Teleport to="body">
        <div ref="panel" v-if="open" role="dialog" aria-modal="true" aria-label="Seleccionar rango de fechas"
            :style="panelPosition"
            class="fixed z-[100] max-h-[calc(100dvh-24px)] w-[min(calc(100vw-24px),800px)] overflow-auto rounded-lg border bg-popover p-3 text-popover-foreground shadow-xl"
            @keydown="handleDialogKeydown">
            <div class="mb-3 flex items-center justify-between gap-2">
                <button type="button" class="calendar-nav" aria-label="Mes anterior" @click="visibleMonth = subMonths(visibleMonth, 1)"><ChevronLeft :size="16" /></button>
                <p class="text-xs font-medium">Seleccionar un día o un rango</p>
                <button type="button" class="calendar-nav" aria-label="Mes siguiente" @click="visibleMonth = addMonths(visibleMonth, 1)"><ChevronRight :size="16" /></button>
            </div>
            <div class="overflow-x-auto">
            <div class="grid min-w-[630px] grid-cols-3 gap-4">
                <section v-for="month in months" :key="inputDate(month.month)">
                    <h3 class="mb-2 text-center text-sm font-semibold capitalize">{{ format(month.month, 'MMMM yyyy', { locale: es }) }}</h3>
                    <div class="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
                        <span v-for="name in ['Lu','Ma','Mi','Ju','Vi','Sa','Do']" :key="name" class="py-1">{{ name }}</span>
                    </div>
                    <div class="grid grid-cols-7 gap-px">
                        <template v-for="day in month.days" :key="inputDate(day)">
                        <button v-if="isSameMonth(day, month.month)" type="button"
                            :data-calendar-day="inputDate(day)"
                            :aria-label="format(day, 'd MMMM yyyy', { locale: es })"
                            :aria-pressed="inDraftRange(day)"
                            class="h-7 rounded-sm text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            :class="inDraftRange(day) ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'"
                            @click="chooseDay(day)" @keydown="handleDayKey($event, day)">{{ format(day, 'd') }}</button>
                        <span v-else class="h-7" />
                        </template>
                    </div>
                </section>
            </div>
            </div>
            <div class="mt-3 flex flex-wrap gap-1 border-t pt-3">
                <button v-for="preset in presetOptions" :key="preset.value" type="button"
                    class="rounded px-2 py-1 text-xs text-primary hover:bg-accent"
                    @click="applyPreset(preset.value)">{{ preset.label }}</button>
            </div>
            <div class="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
                <label class="text-xs">Desde
                    <input v-model="draftFrom" type="date" class="mt-1 block rounded border bg-background px-2 py-1.5" @input="selectingEnd = false" />
                </label>
                <label class="text-xs">Hasta
                    <input v-model="draftTo" type="date" class="mt-1 block rounded border bg-background px-2 py-1.5" @input="selectingEnd = false" />
                </label>
                <div class="ml-auto flex gap-2">
                    <button type="button" class="rounded border px-3 py-2 text-xs" @click="close">Cancelar</button>
                    <button type="button" class="rounded bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-40" :disabled="!parseDate(draftFrom) || !parseDate(draftTo)" @click="applyDraft">Aplicar</button>
                </div>
            </div>
        </div>
        </Teleport>
    </div>
</template>

<style scoped>
.calendar-nav { display: inline-flex; width: 2rem; height: 2rem; align-items: center; justify-content: center; border: 1px solid rgb(226 232 240); border-radius: .375rem; color: rgb(71 85 105); }
:global(.dark) .calendar-nav { border-color: rgb(51 65 85); color: rgb(203 213 225); }
</style>
