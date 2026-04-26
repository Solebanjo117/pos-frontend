<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import apiClient from '@/services/api/client'
import AsyncProductCombobox from '@/components/AsyncProductCombobox.vue'

interface Alternative {
    id: number // This is the PRODUCT ID of the alternative
    sku: string
    name: string
    relationship_type: string
}

const props = withDefaults(defineProps<{
    productId?: number
    mode?: 'live' | 'draft'
    modelValue?: Alternative[]
}>(), {
    mode: 'live',
    modelValue: () => [],
})

const emit = defineEmits<{
    'update:modelValue': [value: Alternative[]]
}>()

const alternatives = ref<Alternative[]>([])
const loading = ref(false)
const adding = ref(false)
const error = ref('')

// Form
const selectedProduct = ref<any>(null)
const relationshipType = ref('compatible') // compatible, substitute, upgrade
const isDraftMode = computed(() => props.mode === 'draft')
const displayedAlternatives = computed(() => isDraftMode.value ? props.modelValue : alternatives.value)

const emitDraftAlternatives = (value: Alternative[]) => {
    emit('update:modelValue', value)
}

const fetchAlternatives = async () => {
    if (isDraftMode.value || !props.productId) return

    loading.value = true
    try {
        const res = await apiClient.get(`/products/${props.productId}/alternatives`)
        alternatives.value = res.data.data
    } catch (e) {
        console.error('Error fetching alternatives', e)
    } finally {
        loading.value = false
    }
}

const addAlternative = async () => {
    if (!selectedProduct.value) return
    
    // Prevent self-linking
    if (selectedProduct.value.id === props.productId) {
        error.value = 'No puedes vincular el producto consigo mismo'
        return
    }

    adding.value = true
    error.value = ''
    try {
        if (isDraftMode.value) {
            if (displayedAlternatives.value.some(alternative => alternative.id === selectedProduct.value.id)) {
                error.value = 'Este producto ya esta agregado'
                return
            }

            emitDraftAlternatives([
                ...displayedAlternatives.value,
                {
                    id: selectedProduct.value.id,
                    sku: selectedProduct.value.sku ?? selectedProduct.value.sku_base ?? '',
                    name: selectedProduct.value.name,
                    relationship_type: relationshipType.value,
                },
            ])
            selectedProduct.value = null
            relationshipType.value = 'compatible'
            return
        }

        await apiClient.post(`/products/${props.productId}/alternatives`, {
            alternative_product_id: selectedProduct.value.id,
            relationship_type: relationshipType.value
        })
        
        await fetchAlternatives()
        
        selectedProduct.value = null
        relationshipType.value = 'compatible'
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error al agregar alternativa'
    } finally {
        adding.value = false
    }
}

const removeAlternative = async (altProductId: number) => {
    if (isDraftMode.value) {
        emitDraftAlternatives(displayedAlternatives.value.filter(alternative => alternative.id !== altProductId))
        return
    }

    if (!confirm('¿Eliminar esta alternativa?')) return
    
    try {
        await apiClient.delete(`/products/${props.productId}/alternatives/${altProductId}`)
        alternatives.value = alternatives.value.filter(a => a.id !== altProductId)
    } catch (e) {
        console.error('Error removing alternative', e)
    }
}

const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
        'compatible': 'Compatible',
        'substitute': 'Sustituto Directo',
        'upgrade': 'Upgrade (Mejora)'
    }
    return map[type] || type
}

const getTypeColor = (type: string) => {
    const map: Record<string, string> = {
        'compatible': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        'substitute': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        'upgrade': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    }
    return map[type] || 'bg-gray-100'
}

onMounted(() => {
    if (!isDraftMode.value) {
        fetchAlternatives()
    }
})
</script>

<template>
    <div class="space-y-4">
        <!-- Add Form -->
        <div class="grid gap-4 sm:grid-cols-12 items-end">
            <div class="sm:col-span-6">
                <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Buscar producto <span class="text-red-500">*</span></label>
                <AsyncProductCombobox :model-value="selectedProduct?.id ?? null" @select="selectedProduct = $event" />
            </div>
            <div class="sm:col-span-3">
                <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Tipo de relación</label>
                <select
                    v-model="relationshipType"
                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                >
                    <option value="compatible">Compatible</option>
                    <option value="substitute">Sustituto</option>
                    <option value="upgrade">Upgrade</option>
                </select>
            </div>
            <div class="sm:col-span-3">
                <button
                    @click="addAlternative"
                    :disabled="!selectedProduct || adding"
                    class="w-full rounded-md bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-primary/90 disabled:opacity-40"
                >
                    {{ adding ? '...' : 'Agregar upsale' }}
                </button>
            </div>
        </div>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <!-- List -->
        <div class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-background">
            <div v-if="loading && displayedAlternatives.length === 0" class="px-4 py-6 text-center text-sm text-gray-500">
                Cargando upsales...
            </div>

            <div v-else-if="displayedAlternatives.length === 0" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No hay upsales pendientes por vincular.
            </div>

            <table v-else class="w-full text-left text-sm">
                <thead class="bg-gray-50 dark:bg-card">
                    <tr>
                        <th class="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Producto</th>
                        <th class="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Relación</th>
                        <th class="w-12 px-4 py-2"></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-border/50">
                    <tr v-for="alt in displayedAlternatives" :key="alt.id">
                        <td class="px-4 py-2 text-gray-900 dark:text-white">
                            <span class="font-mono">{{ alt.sku }}</span>
                            <span class="text-gray-500"> - {{ alt.name }}</span>
                        </td>
                        <td class="px-4 py-2 text-gray-700 dark:text-gray-300">{{ getTypeLabel(alt.relationship_type) }}</td>
                        <td class="px-4 py-2 text-right">
                            <button @click="removeAlternative(alt.id)" class="text-red-500 hover:text-red-700 text-xs font-semibold" title="Desvincular">Eliminar</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
