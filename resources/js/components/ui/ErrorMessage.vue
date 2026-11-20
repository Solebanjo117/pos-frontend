<script setup lang="ts">
/**
 * Mensaje de error estándar del sistema (no se pudo cargar, no se pudo guardar, validaciones…).
 * El texto va en el slot. Usa el color "destructive" del tema en modo claro y oscuro.
 */
import { AlertCircle } from 'lucide-vue-next';
</script>

<template>
    <div
        role="alert"
        data-slot="error-message"
        class="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
        <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div class="min-w-0 flex-1 break-words">
            <slot />
        </div>
    </div>
</template>
