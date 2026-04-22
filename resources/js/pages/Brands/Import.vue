<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import UniversalImporter from '@/components/Import/UniversalImporter.vue'
import type { ImporterConfig } from '@/services/import'

const importConfig: ImporterConfig = {
    entity: 'brands',
    title: 'Importación de Marcas',
    description: 'Importa marcas masivamente desde un archivo Excel. Se crearán automáticamente si no existen.',
    templateFilename: 'plantilla_marcas.xlsx',
    columns: [
        { key: 'nombre', label: 'Nombre', type: 'text', required: true },
        { key: 'descripcion', label: 'Descripción', type: 'text' },
        { key: 'website', label: 'Website', type: 'text' },
        { key: 'estado', label: 'Estado', type: 'select', options: [{ label: 'Activo', value: 'active' }, { label: 'Inactivo', value: 'inactive' }] },
        { key: 'proveedores', label: 'Proveedores', type: 'searchable', searchableEndpoint: '/suppliers/all', placeholder: 'Nombres separados por coma' },
    ],
}
</script>

<template>
    <Head title="Importar Marcas" />
    <AppLayout>
        <UniversalImporter :config="importConfig" />
    </AppLayout>
</template>