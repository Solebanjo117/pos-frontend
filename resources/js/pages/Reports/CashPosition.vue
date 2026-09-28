<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import Report from '@/components/Finance/CashPositionReport.vue';
import AppLayout from '@/layouts/AppLayout.vue';
defineOptions({ layout: AppLayout });
</script>
<template>
    <Head title="Efectivo y bancos" />
    <main class="space-y-4 p-4 md:p-6"><Report /></main>
</template>
