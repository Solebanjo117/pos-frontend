<script setup lang="ts">
import { Clock, Package, User } from 'lucide-vue-next';

interface QueueCardItem {
    id: number;
    product_name?: string | null;
    quantity: number;
}

const props = withDefaults(
    defineProps<{
        documentNumber: string;
        sellerName?: string | null;
        elapsed: string;
        customerName: string;
        items: QueueCardItem[];
        total?: string | null;
        statusLabel?: string | null;
    }>(),
    {
        sellerName: null,
        total: null,
        statusLabel: null,
    },
);

const emit = defineEmits<{
    open: [];
    'open-document': [];
}>();

const shownItems = () => props.items.slice(0, 4);
const extraItems = () => Math.max(0, props.items.length - 4);
</script>

<template>
    <article
        class="flex h-[420px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow duration-200 hover:shadow-lg dark:border-border dark:bg-card"
    >
        <header
            class="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-border"
        >
            <div class="min-w-0">
                <button
                    type="button"
                    class="block max-w-full truncate text-left text-sm font-bold text-indigo-700 uppercase hover:underline dark:text-indigo-400"
                    @click="emit('open-document')"
                >
                    {{ documentNumber }}
                </button>
                <div class="mt-0.5 flex items-center gap-1.5">
                    <User :size="12" class="shrink-0 text-gray-400" />
                    <span
                        class="truncate text-xs text-gray-500 dark:text-gray-400"
                    >
                        {{ sellerName || 'Sistema' }}
                    </span>
                </div>
            </div>
            <div
                class="ml-3 flex shrink-0 items-center gap-1 text-amber-600 dark:text-amber-400"
            >
                <Clock :size="14" />
                <span class="text-sm font-semibold tabular-nums">{{
                    elapsed
                }}</span>
            </div>
        </header>

        <button
            type="button"
            class="flex flex-1 cursor-pointer flex-col space-y-3 overflow-y-auto px-5 py-4 text-left"
            title="Ver detalle"
            @click="emit('open')"
        >
            <div class="flex items-center gap-2">
                <span
                    class="text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
                >
                    Cliente:
                </span>
                <span
                    class="truncate text-sm font-semibold text-gray-900 dark:text-white"
                >
                    {{ customerName || 'Público General' }}
                </span>
            </div>

            <div class="mt-2 w-full space-y-1.5">
                <div
                    v-for="item in shownItems()"
                    :key="item.id"
                    class="flex items-center justify-between gap-2 rounded bg-gray-50 px-2 py-1.5 text-sm dark:bg-muted/30"
                >
                    <div class="flex min-w-0 items-center gap-2">
                        <Package :size="14" class="shrink-0 text-gray-400" />
                        <span
                            class="truncate font-medium text-gray-700 dark:text-gray-300"
                        >
                            {{ item.product_name || 'Producto' }}
                        </span>
                    </div>
                    <span
                        class="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-bold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                    >
                        x{{ item.quantity }}
                    </span>
                </div>
                <p
                    v-if="extraItems() > 0"
                    class="pt-2 text-center text-xs text-gray-400 dark:text-gray-500"
                >
                    + {{ extraItems() }} producto(s) adicional(es)
                </p>
            </div>

            <div
                v-if="statusLabel || total"
                class="mt-auto flex w-full items-end justify-between gap-3 border-t border-gray-100 pt-3 dark:border-border"
            >
                <span
                    v-if="statusLabel"
                    class="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                >
                    {{ statusLabel }}
                </span>
                <strong
                    v-if="total"
                    class="ml-auto font-mono text-lg text-foreground"
                >
                    {{ total }}
                </strong>
            </div>
        </button>

        <footer
            class="border-t border-gray-100 bg-gray-50 px-5 py-3 dark:border-border dark:bg-background"
        >
            <slot name="action" />
        </footer>
    </article>
</template>
