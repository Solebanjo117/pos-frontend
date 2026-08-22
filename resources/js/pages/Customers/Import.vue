<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import UniversalImporter from '@/components/Import/UniversalImporter.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import type { ImporterConfig } from '@/services/import';

const importConfig: ImporterConfig = {
    entity: 'customers',
    title: 'Importar clientes',
    description:
        'Previsualiza clientes y relaciones de vehículos antes de escribir datos.',
    templateFilename: 'plantilla_clientes.xlsx',
    columns: [
        { key: 'codigo', label: 'Código', type: 'text' },
        { key: 'nombre', label: 'Nombre', type: 'text', required: true },
        { key: 'empresa', label: 'Empresa', type: 'text' },
        { key: 'tipo', label: 'Tipo', type: 'text', required: true },
        { key: 'ruc', label: 'RUC', type: 'text' },
        { key: 'telefono', label: 'Teléfono', type: 'text' },
        { key: 'email', label: 'Email', type: 'text' },
        { key: 'direccion', label: 'Dirección', type: 'text' },
        { key: 'notas', label: 'Notas', type: 'text' },
        { key: 'marca_vehiculo', label: 'Marca vehículo', type: 'text' },
        { key: 'modelo_vehiculo', label: 'Modelo vehículo', type: 'text' },
        { key: 'motor_vehiculo', label: 'Motor vehículo', type: 'text' },
        { key: 'anio', label: 'Año', type: 'number' },
        { key: 'vin', label: 'VIN', type: 'text' },
        { key: 'placa', label: 'Placa', type: 'text' },
    ],
};
</script>

<template>
    <Head title="Importar clientes" />
    <AppLayout
        :breadcrumbs="[
            { title: 'Clientes', href: '/customers' },
            { title: 'Importar', href: '/customers/import' },
        ]"
    >
        <UniversalImporter :config="importConfig" />
    </AppLayout>
</template>
