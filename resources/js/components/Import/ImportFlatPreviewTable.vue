<script setup lang="ts">
defineProps<{
    enabled?: boolean;
}>();
</script>

<template>
    <section v-if="enabled" class="contents">
        <slot />
    </section>
</template>
