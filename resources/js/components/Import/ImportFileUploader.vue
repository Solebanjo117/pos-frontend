<script setup lang="ts">
defineProps<{
    title?: string;
}>();
</script>

<template>
    <section
        class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-border dark:bg-card"
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
