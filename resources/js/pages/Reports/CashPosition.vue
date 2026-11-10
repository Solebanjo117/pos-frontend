<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import Report from '@/components/Finance/CashPositionReport.vue';
import AppLayout from '@/layouts/AppLayout.vue';
defineOptions({ layout: AppLayout });
</script>
<template>
    <Head title="Efectivo y bancos" />
    <main class="space-y-4"><Report /></main>
</template>
