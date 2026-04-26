<script setup lang="ts">
import { ref } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import UniversalImporter from '@/components/Import/UniversalImporter.vue'
import type { ImporterConfig } from '@/services/import'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const importerRef = ref<any>(null)

const importConfig: ImporterConfig = {
    entity: 'categories',
    title: 'Importación de Categorías',
    description: 'Importa categorías masivamente desde un archivo Excel. Las categorías padre se pueden buscar o crear automáticamente.',
    templateFilename: 'plantilla_categorias.xlsx',
    columns: [
        { key: 'nombre',         label: 'Nombre',          type: 'text',       required: true },
        { key: 'slug',           label: 'Slug',             type: 'text' },
        { key: 'categoria_padre',label: 'Categoría Padre',  type: 'searchable', searchableEndpoint: '/categories/all' },
        { key: 'descripcion',    label: 'Descripción',      type: 'text' },
        { key: 'margen_default', label: 'Margen %',         type: 'number' },
        { key: 'formula_precio', label: 'Fórmula Precio',   type: 'text' },
        { key: 'aplica_itbm',    label: 'Aplica ITBM',      type: 'select', options: [{ label: 'Sí', value: 'si' }, { label: 'No', value: 'no' }] },
        { key: 'itbm_porcentaje',label: 'ITBM %',           type: 'number' },
        { key: 'prioridad',      label: 'Prioridad',        type: 'number' },
        { key: 'precio_minimo_sugerido', label: 'Precio Min.', type: 'number' },
        { key: 'atributos_default', label: 'Atributos Texto', type: 'text', placeholder: 'color,largo o color:rojo' },
        { key: '__attributes',   label: 'Atributos',        actionType: 'attributes' },
    ],
}

// ─── Modal: Atributos por fila ────────────────────────────────────────────────
const attributesModal = ref(false)
const editingRowIdx = ref<number | null>(null)
const currentAttributes = ref<{ name: string, required: boolean }[]>([])

const openAttributesModal = (rowIdx: number) => {
    editingRowIdx.value = rowIdx
    const rows = importerRef.value?.editedRows
    const row = rows?.[rowIdx]
    // Pre-populate from existing __attributes
    currentAttributes.value = (row?.__attributes ?? []).map((a: any) => ({
        name: a.name ?? '',
        required: !!a.required,
    }))
    attributesModal.value = true
}

const addAttr = () => currentAttributes.value.push({ name: '', required: false })
const removeAttr = (i: number) => currentAttributes.value.splice(i, 1)

const saveAttributes = () => {
    const rows = importerRef.value?.editedRows
    if (editingRowIdx.value !== null && rows) {
        rows[editingRowIdx.value].__attributes = currentAttributes.value
            .filter(a => a.name.trim())
            .map(a => ({ name: a.name.trim(), required: a.required }))
    }
    attributesModal.value = false
    toast.success('Atributos guardados')
}

const handleRowAction = (actionType: string, rowIdx: number) => {
    if (actionType === 'attributes') openAttributesModal(rowIdx)
}
</script>

<template>
    <Head title="Importar Categorías" />
    <AppLayout>
        <div class="p-4">
            <UniversalImporter
                ref="importerRef"
                :config="importConfig"
                @row-action="handleRowAction"
            />
        </div>

        <!-- ══ Modal: Atributos por defecto de la categoría ══ -->
        <Dialog :open="attributesModal" @update:open="v => { if (!v) attributesModal = false }">
            <DialogContent class="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Atributos por Defecto — Fila {{ editingRowIdx !== null ? editingRowIdx + 1 : '' }}</DialogTitle>
                </DialogHeader>
                <div class="py-2 space-y-3">
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                        Estos atributos se asignarán automáticamente a los productos de esta categoría al crearlos.
                    </p>

                    <!-- Header -->
                    <div v-if="currentAttributes.length" class="grid grid-cols-[1fr_auto_auto] gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 px-1">
                        <span>Nombre del atributo</span>
                        <span class="text-center w-20">Requerido</span>
                        <span class="w-6"></span>
                    </div>

                    <!-- Attribute rows -->
                    <div v-for="(attr, i) in currentAttributes" :key="i"
                        class="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                        <Input v-model="attr.name" placeholder="Ej: Amperaje, Voltaje, Posición" />
                        <label class="flex items-center justify-center gap-1.5 w-20 cursor-pointer">
                            <input type="checkbox" v-model="attr.required"
                                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <span class="text-xs text-gray-600 dark:text-gray-400">Sí</span>
                        </label>
                        <button type="button" @click="removeAttr(i)"
                            class="text-red-400 hover:text-red-600 transition-colors">
                            <X class="h-4 w-4" />
                        </button>
                    </div>

                    <p v-if="!currentAttributes.length"
                        class="text-sm text-gray-400 italic text-center py-6 border border-dashed border-gray-200 dark:border-border rounded-lg">
                        Sin atributos configurados. Agrega uno con el botón de abajo.
                    </p>

                    <button type="button" @click="addAttr"
                        class="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                        <Plus class="h-4 w-4" /> Agregar atributo
                    </button>
                </div>

                <div class="flex justify-end gap-2 pt-3 border-t dark:border-border">
                    <Button variant="outline" @click="attributesModal = false">Cancelar</Button>
                    <Button @click="saveAttributes">Guardar</Button>
                </div>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>
