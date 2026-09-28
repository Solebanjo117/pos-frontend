<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import CashPaymentsReport from '@/components/Finance/CashPaymentsReport.vue';
import AppLayout from '@/layouts/AppLayout.vue';
defineOptions({ layout: AppLayout });
</script>
<template>
    <Head title="Movimientos por método" /><CashPaymentsReport />
</template>
