<script setup lang="ts">
defineProps<{
    title?: string;
}>();
</script>

<template>
    <section
        class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
    >
        <slot name="header">
            <h2
                v-if="title"
                class="text-base font-semibold text-gray-900 dark:text-white"
            >
                {{ title }}
            </h2>
        </slot>
        <slot />
    </section>
</template>
