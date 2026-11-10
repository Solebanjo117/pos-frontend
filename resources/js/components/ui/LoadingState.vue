<script setup lang="ts">
/**
 * Estado de carga estándar del sistema: icono que gira con el color del tema y el texto debajo.
 * Se usa para pantallas, secciones, tarjetas y filas de tabla mientras cargan datos.
 * (Los iconos que giran dentro de un botón, como "Refrescar", son otra cosa y no usan esto.)
 */
import { Loader2 } from 'lucide-vue-next';

withDefaults(
    defineProps<{
        label?: string;
    }>(),
    {
        label: 'Cargando...',
    },
);
</script>

<template>
    <div
        role="status"
        aria-live="polite"
        data-slot="loading-state"
        class="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground"
    >
        <Loader2 class="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
        <span>{{ label }}</span>
    </div>
</template>
