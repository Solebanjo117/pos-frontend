<script setup lang="ts">
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-vue-next';
import type { Toast } from '@/composables/useToast';

interface Props {
    toast: Toast;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const iconMap = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

const colorMap = {
    success: {
        container:
            'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
        icon: 'text-green-600 dark:text-green-400',
        text: 'text-green-800 dark:text-green-200',
    },
    error: {
        container:
            'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
        icon: 'text-red-600 dark:text-red-400',
        text: 'text-red-800 dark:text-red-200',
    },
    warning: {
        container:
            'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
        icon: 'text-yellow-600 dark:text-yellow-400',
        text: 'text-yellow-800 dark:text-yellow-200',
    },
    info: {
        container:
            'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
        icon: 'text-blue-600 dark:text-primary dark:text-blue-400',
        text: 'text-blue-800 dark:text-blue-200',
    },
};

const Icon = iconMap[props.toast.type];
const colors = colorMap[props.toast.type];
</script>

<template>
    <div
        class="toast-item flex max-w-md min-w-80 animate-in items-start gap-3 rounded-lg border p-4 shadow-lg duration-300 slide-in-from-right-5 fade-in"
        :class="colors.container"
    >
        <component
            :is="Icon"
            :size="20"
            :class="colors.icon"
            class="mt-0.5 flex-shrink-0"
        />

        <p class="flex-1 text-sm font-medium" :class="colors.text">
            {{ toast.message }}
        </p>

        <button
            @click="emit('close')"
            class="flex-shrink-0 text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300"
        >
            <X :size="18" />
        </button>
    </div>
</template>

<style scoped>
.toast-item {
    animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
</style>
