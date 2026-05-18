<script setup lang="ts">
import type { RecentActivity } from '@/types/dashboard';
import { CheckCircle2Icon, PackageIcon } from 'lucide-vue-next';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
    activities: RecentActivity[];
}
defineProps<Props>();

const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: es,
    });
};
</script>

<template>
    <div class="flow-root">
        <ul
            v-if="activities && activities.length > 0"
            role="list"
            class="-mb-8"
        >
            <li
                v-for="(activity, activityIdx) in activities"
                :key="activity.id"
            >
                <div class="relative pb-8">
                    <span
                        v-if="activityIdx !== activities.length - 1"
                        class="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-muted"
                        aria-hidden="true"
                    />
                    <div class="relative flex space-x-3">
                        <div>
                            <span
                                class="flex h-8 w-8 items-center justify-center rounded-full ring-8 ring-white dark:ring-gray-800"
                                :class="
                                    activity.type === 'sale'
                                        ? 'bg-emerald-500'
                                        : 'bg-blue-500'
                                "
                            >
                                <CheckCircle2Icon
                                    v-if="activity.type === 'sale'"
                                    class="h-5 w-5 text-white"
                                    aria-hidden="true"
                                />
                                <PackageIcon
                                    v-else
                                    class="h-5 w-5 text-white"
                                    aria-hidden="true"
                                />
                            </span>
                        </div>
                        <div
                            class="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5"
                        >
                            <div>
                                <p
                                    class="text-sm text-gray-900 dark:text-white"
                                >
                                    {{ activity.description }}
                                </p>
                                <p
                                    class="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400"
                                >
                                    +${{
                                        activity.amount.toLocaleString(
                                            'es-MX',
                                            { minimumFractionDigits: 2 },
                                        )
                                    }}
                                </p>
                            </div>
                            <div
                                class="text-right text-xs whitespace-nowrap text-gray-500 dark:text-gray-400"
                            >
                                <time :datetime="activity.date">{{
                                    formatDate(activity.date)
                                }}</time>
                            </div>
                        </div>
                    </div>
                </div>
            </li>
        </ul>
        <div
            v-else
            class="py-4 text-center text-sm text-gray-500 dark:text-gray-400"
        >
            No hay actividad reciente.
        </div>
    </div>
</template>
