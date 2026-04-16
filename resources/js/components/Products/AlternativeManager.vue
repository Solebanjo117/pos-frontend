<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Trash2, ArrowRightLeft } from 'lucide-vue-next'
import apiClient from '@/services/api/client'
import AsyncProductCombobox from '@/components/AsyncProductCombobox.vue'

const props = defineProps<{
    productId: number
}>()

interface Alternative {
    id: number // This is the PRODUCT ID of the alternative
    sku: string
    name: string
    relationship_type: string
}

const alternatives = ref<Alternative[]>([])
const loading = ref(false)
const adding = ref(false)
const error = ref('')

// Form
const selectedProduct = ref<any>(null)
const relationshipType = ref('compatible') // compatible, substitute, upgrade

const fetchAlternatives = async () => {
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
    fetchAlternatives()
})
</script>

<template>
    <div class="space-y-6">
        <!-- Add Form -->
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-card">
            <h3 class="mb-4 text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Plus class="h-4 w-4" />
                Upsales
            </h3>
            
            <div class="grid gap-4 sm:grid-cols-12 items-end">
                <div class="sm:col-span-6">
                    <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Buscar Producto <span class="text-red-500">*</span></label>
                    <AsyncProductCombobox :model-value="selectedProduct?.id ?? null" @select="selectedProduct = $event" />
                </div>
                <div class="sm:col-span-3">
                    <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Tipo de Relación</label>
                    <select 
                        v-model="relationshipType"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white sm:text-sm"
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
                        class="flex w-full items-center justify-center rounded-md bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:hover:bg-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        <span v-if="adding">...</span>
                        <span v-else>Agregar upsale</span>
                    </button>
                </div>
            </div>
            <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
        </div>

        <!-- List -->
        <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-background">
            <div class="border-b border-gray-200 bg-white px-4 py-3 dark:border-border dark:bg-card">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white">Upsales vinculados</h3>
            </div>
            
            <div v-if="loading && alternatives.length === 0" class="p-8 text-center text-gray-500">
                Cargando alternativas...
            </div>

            <div v-else-if="alternatives.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
                No hay upsales vinculados.
            </div>

            <table v-else class="min-w-full divide-y divide-gray-200 dark:divide-border">
                <thead class="bg-gray-50 dark:bg-card">
                    <tr>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Producto</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Relación</th>
                        <th scope="col" class="relative px-6 py-3"><span class="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-background">
                    <tr v-for="alt in alternatives" :key="alt.id">
                        <td class="px-6 py-4">
                            <div class="flex items-center">
                                <div>
                                    <div class="text-sm font-medium text-gray-900 dark:text-white">{{ alt.sku }}</div>
                                    <div class="text-sm text-gray-500 dark:text-gray-400">{{ alt.name }}</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span :class="getTypeColor(alt.relationship_type)" class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
                                {{ getTypeLabel(alt.relationship_type) }}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button @click="removeAlternative(alt.id)" class="text-red-600 hover:text-red-900 transition" title="Desvincular">
                                <Trash2 class="h-4 w-4" />
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
