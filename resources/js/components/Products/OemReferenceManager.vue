<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import apiClient from '@/services/api/client'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'

const props = defineProps<{
    productId: number
}>()

interface OemReference {
    id: number
    oem_code: string
    manufacturer: string | null
}

interface BrandOption {
    id: number
    name: string
}

const references = ref<OemReference[]>([])
const loading = ref(false)
const adding = ref(false)
const loadingBrands = ref(false)
const error = ref('')
const brands = ref<BrandOption[]>([])

// Form
const newCode = ref('')
const newManufacturer = ref<string | null>(null)

const brandSearchOptions = computed(() =>
    brands.value.map(brand => ({
        value: brand.name,
        label: brand.name,
    }))
)

const fetchBrands = async () => {
    loadingBrands.value = true
    try {
        const response = await apiClient.get('/brands/all')
        brands.value = response.data.data ?? response.data ?? []
    } catch (e) {
        console.error('Error fetching brands', e)
        brands.value = []
    } finally {
        loadingBrands.value = false
    }
}

const fetchReferences = async () => {
    loading.value = true
    try {
        const res = await apiClient.get(`/products/${props.productId}/oem-references`)
        references.value = res.data.data
    } catch (e) {
        console.error('Error fetching references', e)
    } finally {
        loading.value = false
    }
}

const addReference = async () => {
    if (!newCode.value) return
    
    adding.value = true
    error.value = ''
    try {
        await apiClient.post(`/products/${props.productId}/oem-references`, {
            oem_code: newCode.value,
            manufacturer: newManufacturer.value || null
        })
        // Add to list (response usually wraps in data)
        // Check if response has the new object
        // Based on controller, it returns JSON with message. 
        // We should fetch again or manually push if we knew the ID.
        // Controller returns 201 created but maybe not the object? 
        // checking controller: "message": "Referencia OEM agregada". It DOES NOT return the object!
        // So we MUST fetch again.
        await fetchReferences()
        
        newCode.value = ''
        newManufacturer.value = null
    } catch (e: any) {
        error.value = e.response?.data?.message || 'Error al agregar referencia'
    } finally {
        adding.value = false
    }
}

const removeReference = async (id: number) => {
    if (!confirm('¿Eliminar esta referencia?')) return
    
    try {
        await apiClient.delete(`/products/${props.productId}/oem-references/${id}`)
        references.value = references.value.filter(r => r.id !== id)
    } catch (e) {
        console.error('Error removing reference', e)
    }
}

onMounted(() => {
    fetchReferences()
    fetchBrands()
})
</script>

<template>
    <div class="space-y-6">
        <!-- Add Form -->
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-card">
            <h3 class="mb-4 text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Plus class="h-4 w-4" />
                Códigos alternos
            </h3>
            
            <div class="grid gap-4 sm:grid-cols-12 items-end">
                <div class="sm:col-span-4">
                    <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Código <span class="text-red-500">*</span></label>
                    <input 
                        v-model="newCode"
                        type="text" 
                        placeholder="Ej. 123-456-ABC"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-muted dark:text-white sm:text-sm"
                        @keyup.enter="addReference"
                    >
                </div>
                <div class="sm:col-span-5">
                    <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Marca</label>
                    <SearchableSelect
                        :options="brandSearchOptions"
                        :model-value="newManufacturer"
                        @update:model-value="value => newManufacturer = (value as string | null)"
                        :loading="loadingBrands"
                        placeholder="Sin marca"
                        search-placeholder="Buscar marca..."
                        :clearable="true"
                    />
                </div>
                <div class="sm:col-span-3">
                    <button
                        @click="addReference"
                        :disabled="!newCode || adding"
                        class="flex w-full items-center justify-center rounded-md bg-blue-600 dark:bg-primary dark:text-primary-foreground px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:hover:bg-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        <span v-if="adding">...</span>
                        <span v-else>Agregar</span>
                    </button>
                </div>
            </div>
            <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
        </div>

        <!-- List -->
        <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-background">
            <div class="border-b border-gray-200 bg-white px-4 py-3 dark:border-border dark:bg-card">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white">Códigos alternos vinculados</h3>
            </div>
            
            <div v-if="loading && references.length === 0" class="p-8 text-center text-gray-500">
                Cargando referencias...
            </div>

            <div v-else-if="references.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
                No hay códigos alternos vinculados todavía.
            </div>

            <table v-else class="min-w-full divide-y divide-gray-200 dark:divide-border">
                <thead class="bg-gray-50 dark:bg-card">
                    <tr>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Código</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Marca</th>
                        <th scope="col" class="relative px-6 py-3"><span class="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white dark:divide-border dark:bg-background">
                    <tr v-for="ref in references" :key="ref.id">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                            {{ ref.oem_code }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {{ ref.manufacturer || '-' }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button @click="removeReference(ref.id)" class="text-red-600 hover:text-red-900 transition" title="Eliminar referencia">
                                <Trash2 class="h-4 w-4" />
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
