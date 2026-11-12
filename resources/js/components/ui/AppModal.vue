<script setup lang="ts">
/**
 * Modal genérico del sistema: encabezado fijo (título + X), contenido con su propio
 * desplazamiento y pie fijo para los botones. Todos los modales se abren, se centran,
 * se desplazan y se cierran igual (Esc, clic fuera o la X).
 *
 * Los botones del pie pueden enviar un formulario del contenido con el atributo
 * form="<id del formulario>".
 */
import { X } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';

export type AppModalSize = 'sm' | 'md' | 'lg' | 'xl';

const props = withDefaults(
    defineProps<{
        open: boolean;
        title: string;
        description?: string;
        size?: AppModalSize;
    }>(),
    {
        description: undefined,
        size: 'md',
    },
);

const emit = defineEmits<{
    'update:open': [value: boolean];
    close: [];
}>();

const sizeClass = computed(
    () =>
        ({
            sm: 'sm:max-w-md',
            md: 'sm:max-w-2xl',
            lg: 'sm:max-w-4xl',
            xl: 'sm:max-w-[calc(100vw-3rem)] xl:max-w-7xl 2xl:max-w-[88rem]',
        })[props.size],
);

// Al abrir, reka-ui enfoca el primer elemento enfocable: la X del encabezado, que se veía
// "en hover". Se enfoca el primer campo del contenido; si no hay, el propio cuadro.
const bodyRef = ref<HTMLElement | null>(null);
// Solo campos que se pueden editar: un campo de solo lectura no sirve como punto de partida.
const FIRST_FIELD =
    'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]):not([readonly])';
const onOpenAutoFocus = (event: Event) => {
    event.preventDefault();
    const field = bodyRef.value?.querySelector<HTMLElement>(FIRST_FIELD);
    (field ?? (event.target as HTMLElement | null))?.focus?.({
        preventScroll: true,
    });
};

const onOpenChange = (value: boolean) => {
    emit('update:open', value);
    if (!value) emit('close');
};
</script>

<template>
    <Dialog :open="open" @update:open="onOpenChange">
        <!-- Sin overflow-hidden: las listas desplegables flotan por encima y pueden salir del cuadro. -->
        <DialogContent
            :show-close-button="false"
            @open-auto-focus="onOpenAutoFocus"
            :class="[
                // outline-none: si el foco cae en el propio cuadro (no hay campos), el navegador no le dibuja su borde.
                'flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 p-0 outline-none',
                sizeClass,
            ]"
        >
            <header
                class="flex shrink-0 items-start justify-between gap-4 border-b px-6 py-4 dark:border-border"
            >
                <div class="min-w-0 space-y-1">
                    <DialogTitle class="text-lg leading-tight font-semibold">
                        {{ title }}
                    </DialogTitle>
                    <DialogDescription
                        v-if="description || $slots.description"
                        class="text-sm text-muted-foreground"
                    >
                        <slot name="description">{{ description }}</slot>
                    </DialogDescription>
                </div>
                <DialogClose
                    class="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Cerrar"
                >
                    <X class="h-4 w-4" />
                </DialogClose>
            </header>

            <div ref="bodyRef" class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                <slot />
            </div>

            <footer
                v-if="$slots.footer"
                class="flex shrink-0 flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end dark:border-border"
            >
                <slot name="footer" />
            </footer>
        </DialogContent>
    </Dialog>
</template>
