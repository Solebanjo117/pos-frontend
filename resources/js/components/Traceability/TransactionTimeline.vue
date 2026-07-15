<script setup lang="ts">
import { Activity, Circle } from 'lucide-vue-next';
import DocumentReferenceLink from './DocumentReferenceLink.vue';
import type {
    TransactionTraceEvent,
    TransactionTraceNode,
} from '@/types/transaction-trace';

defineProps<{
    events: TransactionTraceEvent[];
    title?: string;
    drawerFirst?: boolean;
}>();
const emit = defineEmits<{ inspect: [node: TransactionTraceNode] }>();

const formatDateTime = (value: string): string =>
    new Intl.DateTimeFormat('es-PA', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));

const formatMoney = (value: number): string =>
    new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
    }).format(value);
</script>

<template>
    <section
        class="rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
    >
        <header
            class="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800"
        >
            <Activity class="h-4 w-4 text-cyan-700" />
            <h3
                class="text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
                {{ title || 'Linea de tiempo' }}
            </h3>
        </header>
        <ol v-if="events.length" class="px-3 py-2">
            <li
                v-for="event in events"
                :key="event.id"
                class="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-2 pb-3 last:pb-0"
            >
                <div class="relative flex justify-center">
                    <span
                        class="absolute top-4 bottom-0 w-px bg-slate-200 last:hidden dark:bg-slate-800"
                    />
                    <Circle
                        class="relative mt-1 h-3 w-3 fill-cyan-600 text-cyan-600"
                    />
                </div>
                <div class="min-w-0">
                    <div
                        class="flex flex-wrap items-center justify-between gap-2"
                    >
                        <p
                            class="text-sm font-medium text-slate-900 dark:text-slate-100"
                        >
                            {{ event.label }}
                        </p>
                        <time class="text-xs text-slate-500">{{
                            formatDateTime(event.occurred_at)
                        }}</time>
                    </div>
                    <div
                        class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"
                    >
                        <span v-if="event.user?.name">{{
                            event.user.name
                        }}</span>
                        <span
                            v-if="
                                event.amount !== null &&
                                event.amount !== undefined
                            "
                            >{{ formatMoney(event.amount) }}</span
                        >
                        <span
                            v-if="
                                event.quantity !== null &&
                                event.quantity !== undefined
                            "
                            >Cantidad {{ event.quantity }}</span
                        >
                        <DocumentReferenceLink
                            :node="event.document"
                            compact
                            :drawer-first="drawerFirst"
                            @inspect="emit('inspect', $event)"
                        />
                    </div>
                    <p v-if="event.reason" class="mt-1 text-xs text-slate-600">
                        {{ event.reason }}
                    </p>
                </div>
            </li>
        </ol>
        <p v-else class="px-3 py-5 text-center text-sm text-slate-500">
            No hay actividad registrada.
        </p>
    </section>
</template>
