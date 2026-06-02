<script setup lang="ts">
defineProps<{
    visible?: boolean;
}>();
</script>

<template>
    <section v-if="visible" class="space-y-4">
        <slot />
    </section>
</template>
