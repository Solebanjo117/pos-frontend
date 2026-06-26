<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import UniversalImporter from '@/components/Import/UniversalImporter.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import type { ImporterConfig } from '@/services/import';

const importConfig: ImporterConfig = {
    entity: 'suppliers',
    title: 'Importación de Proveedores',
    description: 'Importa proveedores masivamente desde un archivo Excel.',
    templateFilename: 'plantilla_proveedores.xlsx',
    columns: [
        { key: 'nombre', label: 'Nombre', type: 'text', required: true },
        { key: 'contacto', label: 'Contacto', type: 'text' },
        { key: 'email', label: 'Email', type: 'text' },
        { key: 'telefono', label: 'Teléfono', type: 'text' },
        { key: 'direccion', label: 'Dirección', type: 'text' },
        { key: 'ciudad', label: 'Ciudad', type: 'text' },
        { key: 'pais', label: 'País', type: 'text' },
        { key: 'condiciones_pago', label: 'Condiciones de Pago', type: 'text' },
        { key: 'dias_entrega', label: 'Días de Entrega', type: 'number' },
        { key: 'notas', label: 'Notas', type: 'text' },
        {
            key: 'estado',
            label: 'Estado',
            type: 'select',
            options: [
                { label: 'Activo', value: 'active' },
                { label: 'Inactivo', value: 'inactive' },
            ],
        },
        {
            key: 'marcas',
            label: 'Marcas',
            type: 'text',
            placeholder: 'Nombres separados por coma',
        },
    ],
};
</script>

<template>
    <Head title="Importar Proveedores" />
    <AppLayout>
        <UniversalImporter :config="importConfig" />
    </AppLayout>
</template>
