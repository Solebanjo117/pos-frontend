<script setup lang="ts">
import { ref } from 'vue';
import { Head } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import VehicleSelector from '@/components/VehicleSelector.vue';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Vehículos', href: '/vehicles/makes' },
    { title: 'Buscador', href: '#' },
];

const selectedVehicle = ref<{
    make_id?: number;
    model_id?: number;
    engine_id?: number;
    year?: number;
}>({});
</script>

<template>
    <Head title="Buscador de Vehículos" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-7xl space-y-6 p-6">
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
                Buscador y Selector de Vehículos
            </h1>
            <p class="text-gray-500 dark:text-gray-400">
                Prueba del componente de selección jerárquica (Año > Marca >
                Modelo > Motor).
            </p>

            <div class="rounded-lg bg-white p-6 shadow dark:bg-card">
                <VehicleSelector v-model="selectedVehicle" />

                <!-- Debug Output -->
                <div class="mt-8 rounded-md bg-gray-50 p-4 dark:bg-muted">
                    <h3
                        class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Datos Seleccionados (JSON):
                    </h3>
                    <pre
                        class="overflow-auto text-xs text-gray-600 dark:text-gray-400"
                        >{{ JSON.stringify(selectedVehicle, null, 2) }}</pre
                    >
                </div>

                <div
                    v-if="selectedVehicle.engine_id"
                    class="mt-4 rounded-md border border-green-200 bg-green-50 p-4 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                >
                    ✅ Vehículo completamente definido. Listo para buscar piezas
                    compatibles.
                </div>
            </div>
        </div>
    </AppLayout>
</template>
