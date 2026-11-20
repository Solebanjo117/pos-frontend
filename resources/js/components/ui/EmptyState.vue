<script setup lang="ts">
/**
 * Mensaje estándar de "no hay datos" (lista vacía, búsqueda sin resultados) en todo el sistema.
 * El texto va en el slot; puede incluir datos ("No hay resultados para …") o un enlace de acción.
 * compact: para cajas pequeñas o cuando el mensaje comparte espacio con otros elementos.
 */
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });
</script>

<template>
    <div
        data-slot="empty-state"
        class="text-center text-sm text-muted-foreground"
        :class="compact ? 'py-2' : 'py-10'"
    >
        <slot />
    </div>
</template>
