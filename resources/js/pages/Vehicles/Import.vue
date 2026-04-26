<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import UniversalImporter from '@/components/Import/UniversalImporter.vue'
import type { ImporterConfig } from '@/services/import'

const importConfig: ImporterConfig = {
    entity: 'vehicles',
    title: 'Importación de Vehículos',
    description: 'Importa la jerarquía Marca → Modelo → Chasis → Motor → VIN desde un archivo Excel. Se crea automáticamente cualquier entidad que no exista.',
    templateFilename: 'plantilla_vehiculos.xlsx',
    columns: [
        { key: 'make',   label: 'Marca (MAKE)',   type: 'searchable', required: true, searchableEndpoint: '/vehicle-makes/all' },
        { key: 'model',  label: 'Modelo (MODEL)', type: 'text',       required: true },
        { key: 'year',   label: 'Año (YEAR)',     type: 'text',       required: true, placeholder: '2000-2005' },
        { key: 'generation', label: 'Generacion', type: 'text',       placeholder: 'P10' },
        { key: 'code',   label: 'Chasis (CODE)', type: 'text',       placeholder: 'P10' },
        { key: 'engine', label: 'Motor (ENGINE)', type: 'text',       placeholder: '1NZFE' },
        { key: 'displacement', label: 'Cilindrada', type: 'text',     placeholder: '1.5L' },
        { key: 'fuel_type', label: 'Combustible', type: 'select', options: [
            { label: 'Gasoline', value: 'Gasoline' },
            { label: 'Diesel', value: 'Diesel' },
            { label: 'Hybrid', value: 'Hybrid' },
            { label: 'Electric', value: 'Electric' },
        ] },
        { key: 'aspiration', label: 'Aspiracion', type: 'text',       placeholder: 'Turbo' },
        { key: 'vin',    label: 'VIN',            type: 'text',       placeholder: 'MR2BT9F3...' },
    ],
}
</script>

<template>
    <Head title="Importar Vehículos" />
    <AppLayout>
        <UniversalImporter :config="importConfig" />
    </AppLayout>
</template>
