<script setup lang="ts">
import { useToast } from '@/composables/useToast';
import ToastItem from '@/components/ToastItem.vue';

const { toasts, removeToast } = useToast();
</script>

<template>
    <div
        class="toast-container pointer-events-none fixed top-4 right-4 z-[9999] flex flex-col gap-3"
    >
        <div
            v-for="toast in toasts"
            :key="toast.id"
            class="pointer-events-auto"
        >
            <ToastItem :toast="toast" @close="removeToast(toast.id)" />
        </div>
    </div>
</template>
