<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { ChevronRight, ClipboardList } from 'lucide-vue-next';

defineProps<{
    title: string;
    subtitle?: string;
    statusLabel?: string;
    total?: string;
}>();
</script>

<template>
    <header
        class="sticky top-0 z-30 border-b border-emerald-100 bg-white/95 shadow-sm backdrop-blur dark:border-emerald-900/30 dark:bg-background/95"
    >
        <div
            class="flex min-h-[4.25rem] flex-col justify-center gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
        >
            <div class="flex min-w-0 items-start gap-3">
                <div
                    class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                    <ClipboardList :size="20" />
                </div>
                <div class="min-w-0">
                    <nav
                        class="mb-1 hidden items-center gap-1.5 text-xs font-medium text-gray-500 md:flex dark:text-gray-400"
                    >
                        <Link
                            href="/inventory"
                            class="hover:text-emerald-700 dark:hover:text-emerald-300"
                        >
                            Compras
                        </Link>
                        <ChevronRight :size="14" />
                        <Link
                            href="/purchase-orders"
                            class="hover:text-emerald-700 dark:hover:text-emerald-300"
                        >
                            Ordenes de compra
                        </Link>
                        <ChevronRight :size="14" />
                    </nav>
                    <div class="flex min-w-0 flex-wrap items-center gap-2">
                        <h1
                            class="truncate text-lg font-semibold text-gray-950 dark:text-white"
                        >
                            {{ title }}
                        </h1>
                        <span
                            v-if="statusLabel"
                            class="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                            {{ statusLabel }}
                        </span>
                        <span
                            v-if="total"
                            class="font-mono text-sm font-semibold text-gray-900 dark:text-white"
                        >
                            {{ total }}
                        </span>
                    </div>
                    <p
                        v-if="subtitle"
                        class="mt-1 truncate text-sm text-gray-500 dark:text-gray-400"
                    >
                        {{ subtitle }}
                    </p>
                </div>
            </div>
            <div
                class="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end"
            >
                <slot name="actions" />
            </div>
        </div>
    </header>
</template>
