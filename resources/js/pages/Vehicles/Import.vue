<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed } from 'vue';
import UniversalImporter from '@/components/Import/UniversalImporter.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import type { ImporterConfig } from '@/services/import';
import type { BreadcrumbItem } from '@/types';

const returnUrl = computed(() => {
    const requested = new URLSearchParams(window.location.search).get('return');
    return requested?.startsWith('/vehicles') ? requested : '/vehicles';
});
const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Vehículos', href: returnUrl.value },
    { title: 'Importar', href: '/vehicles/import' },
]);

const importConfig: ImporterConfig = {
    entity: 'vehicles',
    title: 'Importación de Vehículos',
    description:
        'Importa la jerarquía Marca → Modelo → Chasis → Motor → VIN desde un archivo Excel. Se crea automáticamente cualquier entidad que no exista.',
    templateFilename: 'plantilla_vehiculos.xlsx',
    columns: [
        {
            key: 'make',
            label: 'Marca (MAKE)',
            type: 'searchable',
            required: true,
            searchableEndpoint: '/vehicle-makes/all',
            createsMissing: true,
        },
        { key: 'model', label: 'Modelo (MODEL)', type: 'text', required: true },
        {
            key: 'year',
            label: 'Año (YEAR)',
            type: 'text',
            required: true,
            placeholder: '2000-2005',
        },
        {
            key: 'generation',
            label: 'Generacion',
            type: 'text',
            placeholder: 'Opcional',
        },
        {
            key: 'code',
            label: 'Chasis (CODE)',
            type: 'text',
            placeholder: 'Opcional',
        },
        {
            key: 'engine',
            label: 'Motor (ENGINE)',
            type: 'text',
            placeholder: 'Opcional',
        },
        {
            key: 'displacement',
            label: 'Cilindrada',
            type: 'text',
            placeholder: 'Opcional',
        },
        {
            key: 'fuel_type',
            label: 'Combustible',
            type: 'select',
            options: [
                { label: 'Gasoline', value: 'Gasoline' },
                { label: 'Diesel', value: 'Diesel' },
                { label: 'Hybrid', value: 'Hybrid' },
                { label: 'Electric', value: 'Electric' },
            ],
        },
        {
            key: 'aspiration',
            label: 'Aspiracion',
            type: 'text',
            placeholder: 'Opcional',
        },
        { key: 'vin', label: 'VIN', type: 'text', placeholder: 'Opcional' },
    ],
};
</script>

<template>
    <Head title="Importar Vehículos" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <UniversalImporter :config="importConfig" />
    </AppLayout>
</template>
