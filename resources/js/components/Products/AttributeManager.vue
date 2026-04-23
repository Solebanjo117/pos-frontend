<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { Trash2, Lock } from 'lucide-vue-next'
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

const {
    attributes: productAttrs,
    fetchAttributes: fetchProductAttrs
} = useProductAttributes(props.productId, null)

const adding = ref(false)
const newName = ref('')
const newValue = ref('')
const actionError = ref('')
const savingIds = ref<Set<number>>(new Set())

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

defineExpose({ refresh: fetchAttributes })

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

let debounceTimers: Record<number, ReturnType<typeof setTimeout>> = {}

const debouncedSave = (attr: ProductAttribute, field: 'name' | 'value', newVal: string) => {
    if (debounceTimers[attr.id]) clearTimeout(debounceTimers[attr.id])
    debounceTimers[attr.id] = setTimeout(() => {
        saveField(attr, field, newVal)
    }, 600)
}

const saveField = async (attr: ProductAttribute, field: 'name' | 'value', newVal: string) => {
    const trimmed = newVal.trim()
    if (!trimmed) return
    if (attr[field] === trimmed) return

    savingIds.value.add(attr.id)
    actionError.value = ''
    try {
        await updateAttribute(attr.id, { [field]: trimmed })
    } catch (e: any) {
        actionError.value = e.response?.data?.message || error.value || 'No se pudo actualizar.'
    } finally {
        savingIds.value.delete(attr.id)
    }
}

const flushAndSave = (attr: ProductAttribute, field: 'name' | 'value', newVal: string) => {
    if (debounceTimers[attr.id]) clearTimeout(debounceTimers[attr.id])
    saveField(attr, field, newVal)
}
</script>

<template>
    <div class="space-y-4">
        <!-- Variant context banner -->
        <div v-if="scopedVariantId && showVariantContext" class="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300">
            <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Editando especificaciones <strong>propias de esta variante</strong>. Los valores aquí <span class="font-semibold">sobreescriben</span> los del producto base al mostrar el detalle.
        </div>

        <!-- Add Attribute Bar -->
        <div class="grid gap-3 sm:grid-cols-12 items-end">
            <div class="sm:col-span-5">
                <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Atributo (Ej. Amperaje)</label>
                <input v-model="newName" type="text" placeholder="Nombre"
                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                    @keyup.enter="handleAdd">
            </div>
            <div class="sm:col-span-5">
                <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Valor (Ej. 100)</label>
                <input v-model="newValue" type="text" placeholder="Valor"
                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                    @keyup.enter="handleAdd">
            </div>
            <div class="sm:col-span-2">
                <button @click="handleAdd" :disabled="!newName || !newValue || adding"
                    class="w-full rounded-md bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-primary/90 disabled:opacity-40">
                    {{ adding ? '...' : 'Agregar' }}
                </button>
            </div>
        </div>
        <p v-if="actionError" class="text-sm text-red-600">{{ actionError }}</p>

        <!-- Inline-editable specs table -->
        <div class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-background">
            <div v-if="loading && attributes.length === 0" class="px-4 py-6 text-center text-sm text-gray-500">
                Cargando especificaciones...
            </div>

            <div v-else-if="attributes.length === 0" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {{ scopedVariantId ? 'Sin especificaciones propias. Las del producto base aplican por defecto.' : 'No hay especificaciones definidas.' }}
            </div>

            <table v-else class="w-full text-left text-sm">
                <thead class="bg-gray-50 dark:bg-card">
                    <tr>
                        <th class="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Atributo</th>
                        <th class="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Valor</th>
                        <th class="w-12 px-4 py-2"></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-border/50">
                    <tr v-for="attr in attributes" :key="attr.id" class="group">
                        <td class="px-4 py-1.5">
                            <input
                                :value="attr.name"
                                @input="debouncedSave(attr, 'name', ($event.target as HTMLInputElement).value)"
                                @blur="flushAndSave(attr, 'name', ($event.target as HTMLInputElement).value)"
                                @keyup.enter="($event.target as HTMLInputElement).blur()"
                                class="w-full rounded border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium text-gray-900 hover:border-gray-300 focus:border-blue-400 focus:bg-white focus:outline-none dark:text-white dark:hover:border-border dark:focus:border-primary dark:focus:bg-muted"
                            />
                        </td>
                        <td class="px-4 py-1.5">
                            <div class="flex items-center gap-1.5">
                                <input
                                    :value="attr.value"
                                    @input="debouncedSave(attr, 'value', ($event.target as HTMLInputElement).value)"
                                    @blur="flushAndSave(attr, 'value', ($event.target as HTMLInputElement).value)"
                                    @keyup.enter="($event.target as HTMLInputElement).blur()"
                                    class="w-full rounded border border-transparent bg-transparent px-2 py-1.5 text-sm text-gray-700 hover:border-gray-300 focus:border-blue-400 focus:bg-white focus:outline-none dark:text-gray-300 dark:hover:border-border dark:focus:border-primary dark:focus:bg-muted"
                                />
                                <div v-if="savingIds.has(attr.id)" class="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></div>
                            </div>
                        </td>
                        <td class="px-2 py-1.5 text-right">
                            <button @click="removeAttribute(attr.id)" class="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity" title="Eliminar">
                                <Trash2 class="h-4 w-4" />
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Product-level specs (read-only reference) — visible only when editing a variant -->
        <div v-if="scopedVariantId && productAttrs.length > 0" class="overflow-hidden rounded-lg border border-gray-200 dark:border-border">
            <div class="border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-border dark:bg-card flex items-center gap-2">
                <Lock class="h-3.5 w-3.5 text-gray-400" />
                <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Especificaciones del producto base (solo referencia)</span>
            </div>
            <table class="w-full text-left text-sm">
                <tbody class="divide-y divide-gray-100 dark:divide-border/50">
                    <tr v-for="attr in productAttrs" :key="attr.id" class="opacity-60">
                        <td class="px-4 py-2 font-medium text-gray-700 dark:text-gray-300 w-1/3">{{ attr.name }}</td>
                        <td class="px-4 py-2 text-gray-500 dark:text-gray-400">{{ attr.value }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
