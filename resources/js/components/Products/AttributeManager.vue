<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { Plus, Trash2, Edit2, Check, X, Lock } from 'lucide-vue-next'
import { useProductAttributes, type ProductAttribute } from '@/composables/useProductAttributes'

const props = withDefaults(defineProps<{
    productId: number
    variantId?: number | null
    showVariantContext?: boolean
}>(), {
    variantId: null,
    showVariantContext: true,
})

const scopedVariantId = computed(() => props.variantId ?? null)

// Variant-scoped (or product-level if no variantId) editable attrs
const {
    attributes,
    loading,
    error,
    fetchAttributes,
    addAttribute,
    updateAttribute,
    removeAttribute,
    setVariantId,
} = useProductAttributes(props.productId, scopedVariantId.value)

// Product-level attrs for read-only reference (only when editing a variant)
const {
    attributes: productAttrs,
    fetchAttributes: fetchProductAttrs
} = useProductAttributes(props.productId, null)

const adding = ref(false)
const newName = ref('')
const newValue = ref('')
const actionError = ref('')

const editingId = ref<number | null>(null)
const editName = ref('')
const editValue = ref('')

watch(scopedVariantId, async (newVariantId) => {
    setVariantId(newVariantId)
    await fetchAttributes()
    if (newVariantId) {
        await fetchProductAttrs()
    }
})

onMounted(async () => {
    setVariantId(scopedVariantId.value)
    await fetchAttributes()
    if (scopedVariantId.value) {
        await fetchProductAttrs()
    }
})

const handleAdd = async () => {
    if (!newName.value.trim() || !newValue.value.trim()) return
    adding.value = true
    actionError.value = ''
    try {
        await addAttribute(newName.value.trim(), newValue.value.trim())
        newName.value = ''
        newValue.value = ''
    } catch (e: any) {
        actionError.value = e.response?.data?.message || error.value || 'No se pudo agregar el atributo.'
    } finally {
        adding.value = false
    }
}

const startEdit = (attr: ProductAttribute) => {
    editingId.value = attr.id
    editName.value = attr.name
    editValue.value = attr.value
}

const cancelEdit = () => {
    editingId.value = null
}

const saveEdit = async (id: number) => {
    if (!editName.value.trim() || !editValue.value.trim()) {
        actionError.value = 'Nombre y valor son requeridos.'
        return
    }

    actionError.value = ''
    try {
        await updateAttribute(id, {
            name: editName.value.trim(),
            value: editValue.value.trim(),
        })
        editingId.value = null
    } catch (e: any) {
        actionError.value = e.response?.data?.message || error.value || 'No se pudo actualizar el atributo.'
    }
}
</script>

<template>
    <div class="space-y-6">
        <!-- Variant context banner -->
        <div v-if="scopedVariantId && showVariantContext" class="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300">
            <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Editando especificaciones <strong>propias de esta variante</strong>. Los valores aquí <span class="font-semibold">sobreescriben</span> los del producto base al mostrar el detalle.
        </div>

        <!-- Add Attribute Bar -->
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-card">
            <h3 class="mb-4 text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Plus class="h-4 w-4" />
                {{ scopedVariantId ? 'Agregar Especificación de Variante' : 'Agregar Especificación' }}
            </h3>

            <div class="grid gap-4 sm:grid-cols-12 items-end">
                <div class="sm:col-span-5">
                    <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Atributo (Ej. Amperaje)</label>
                    <input v-model="newName" type="text" placeholder="Nombre"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white sm:text-sm"
                        @keyup.enter="handleAdd">
                </div>
                <div class="sm:col-span-5">
                    <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Valor (Ej. 100)</label>
                    <input v-model="newValue" type="text" placeholder="Valor"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white sm:text-sm"
                        @keyup.enter="handleAdd">
                </div>
                <div class="sm:col-span-2">
                    <button @click="handleAdd" :disabled="!newName || !newValue || adding"
                        class="flex w-full items-center justify-center rounded-md bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:hover:bg-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed">
                        <span v-if="adding">...</span>
                        <span v-else>Agregar</span>
                    </button>
                </div>
            </div>

            <p v-if="actionError" class="mt-3 text-sm text-red-600">{{ actionError }}</p>
        </div>

        <!-- Variant-level (or product-level) editable specs -->
        <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-background">
            <div class="border-b border-gray-200 bg-white px-4 py-3 dark:border-border dark:bg-card">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                    {{ scopedVariantId ? 'Especificaciones propias de la variante' : 'Especificaciones Técnicas' }}
                </h3>
            </div>

            <div v-if="loading && attributes.length === 0" class="p-8 text-center text-gray-500">
                Cargando especificaciones...
            </div>

            <div v-else-if="attributes.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
                {{ scopedVariantId ? 'Sin especificaciones propias. Las del producto base aplican por defecto.' : 'No hay especificaciones definidas. Agrega características técnicas para mejorar la búsqueda.' }}
            </div>

            <table v-else class="min-w-full divide-y divide-gray-200 dark:divide-border">
                <thead class="bg-gray-50 dark:bg-card">
                    <tr>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Atributo</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Valor</th>
                        <th scope="col" class="relative px-6 py-3"><span class="sr-only">Acciones</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-background">
                    <tr v-for="attr in attributes" :key="attr.id">
                        <template v-if="editingId === attr.id">
                            <td class="px-6 py-4 whitespace-nowrap">
                                <input v-model="editName" class="w-full rounded border-gray-300 text-sm dark:bg-card dark:text-white p-1" />
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <input v-model="editValue" class="w-full rounded border-gray-300 text-sm dark:bg-card dark:text-white p-1" />
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button @click="saveEdit(attr.id)" class="text-green-600 hover:text-green-900 mr-2"><Check class="h-4 w-4" /></button>
                                <button @click="cancelEdit" class="text-gray-600 hover:text-gray-900"><X class="h-4 w-4" /></button>
                            </td>
                        </template>
                        <template v-else>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{{ attr.name }}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ attr.value }}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button @click="startEdit(attr)" class="text-indigo-600 dark:text-primary hover:text-indigo-900 mr-3"><Edit2 class="h-4 w-4" /></button>
                                <button @click="removeAttribute(attr.id)" class="text-red-600 hover:text-red-900"><Trash2 class="h-4 w-4" /></button>
                            </td>
                        </template>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Product-level specs (read-only reference) — visible only when editing a variant -->
        <div v-if="scopedVariantId && productAttrs.length > 0" class="overflow-hidden rounded-lg border border-gray-200 dark:border-border">
            <div class="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-border dark:bg-card flex items-center gap-2">
                <Lock class="h-3.5 w-3.5 text-gray-400" />
                <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Especificaciones del producto base (solo referencia)</h3>
            </div>
            <table class="min-w-full divide-y divide-gray-200 dark:divide-border">
                <tbody class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-background">
                    <tr v-for="attr in productAttrs" :key="attr.id" class="opacity-60">
                        <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-300 w-1/3">{{ attr.name }}</td>
                        <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ attr.value }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
