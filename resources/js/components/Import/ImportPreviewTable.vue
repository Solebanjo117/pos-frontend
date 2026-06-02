<script setup lang="ts">
defineProps<{
    shellClass: string;
}>();
</script>

<template>
    <section :class="shellClass">
        <slot />
    </section>
</template>
