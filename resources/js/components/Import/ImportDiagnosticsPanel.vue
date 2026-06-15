<script setup lang="ts">
defineProps<{
    expanded?: boolean;
}>();
</script>

<template>
    <section v-show="expanded" class="shrink-0 bg-white dark:bg-card">
        <slot />
    </section>
</template>
