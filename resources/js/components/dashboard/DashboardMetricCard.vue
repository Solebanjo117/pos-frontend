<script setup lang="ts">
import type { Component } from 'vue';
import { Card, CardContent } from '@/components/ui/card';

defineProps<{
    label: string;
    value: string | number;
    helper?: string;
    tone?: 'green' | 'emerald' | 'blue' | 'yellow' | 'red' | 'indigo';
    icon: Component;
}>();

const toneClasses = {
    green: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300',
    emerald:
        'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    yellow: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
};
</script>

<template>
    <Card class="min-w-0 rounded-lg py-0">
        <CardContent
            class="flex min-h-32 items-start justify-between gap-4 p-4"
        >
            <div class="min-w-0">
                <p class="text-sm font-medium text-muted-foreground">
                    {{ label }}
                </p>
                <p
                    class="mt-2 text-2xl font-semibold break-words text-foreground"
                >
                    {{ value }}
                </p>
                <p v-if="helper" class="mt-1 text-xs text-muted-foreground">
                    {{ helper }}
                </p>
            </div>

            <div
                :class="[
                    'flex size-10 shrink-0 items-center justify-center rounded-md',
                    toneClasses[tone || 'blue'],
                ]"
            >
                <component :is="icon" class="size-5" />
            </div>
        </CardContent>
    </Card>
</template>
