<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import Report from '@/components/Finance/CashPaymentsReport.vue';
import AppLayout from '@/layouts/AppLayout.vue';
defineOptions({ layout: AppLayout });
</script>
<template>
    <Head title="Cobros por método" />
    <main class="space-y-4 p-4 md:p-6"><Report report-mode /></main>
</template>
