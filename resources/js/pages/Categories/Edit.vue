<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { useCategories } from '@/composables/useCategories'
import { ArrowLeft, Save } from 'lucide-vue-next'
import type { UpdateCategoryData, Category } from '@/types/category'

interface Props {
    id: string
}

const props = defineProps<Props>()

const { category, loading, error, fetchCategoryById, updateCategory, fetchCategoriesWithParent } = useCategories()

const parentCategories = ref<Category[]>([])

const form = ref<UpdateCategoryData & { default_attributes: { name: string; required: boolean }[] }>({
    name: '',
    parent_id: null,
    description: '',
    default_attributes: [],
    icon: '',
    priority: 0,
})

function addAttribute() {
    form.value.default_attributes.push({ name: '', required: false })
}

function removeAttribute(index: number) {
    form.value.default_attributes.splice(index, 1)
}

onMounted(async () => {
    await fetchCategoryById(Number(props.id))
    parentCategories.value = await fetchCategoriesWithParent()
    
    if (category.value) {
        form.value = {
            name: category.value.name,
            parent_id: category.value.parent_id ?? null,
            description: category.value.description || '',
            default_attributes: (category.value as any).default_attributes || [],
            icon: category.value.icon || '',
            priority: category.value.priority ?? 0,
        }
    }
})

async function handleSubmit() {
    try {
        await updateCategory(Number(props.id), form.value)
        router.visit('/categories')
    } catch (e) {
        // Error handled in composable
    }
}

function goBack() {
    router.visit('/categories')
}

// Filter out current category and its descendants from parent options
const availableParents = ref<Category[]>([])
onMounted(() => {
    if (parentCategories.value.length > 0) {
        availableParents.value = parentCategories.value.filter(c => c.id !== Number(props.id))
    }
})
</script>

<template>
    <Head title="Editar Categoría" />
    <AppLayout>
        <div class="max-w-2xl mx-auto space-y-6">
            <!-- Header -->
            <div class="flex items-center gap-4">
                <button
                    @click="goBack"
                    class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
                >
                    <ArrowLeft :size="24" />
                </button>
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Editar Categoría</h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Modifica la información de la categoría
                    </p>
                </div>
            </div>

            <!-- Error -->
            <div v-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p class="text-red-600 dark:text-red-400">{{ error }}</p>
            </div>

            <!-- Loading or Form -->
            <div v-if="loading && !category" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p class="mt-4 text-gray-500">Cargando...</p>
            </div>

            <form v-else @submit.prevent="handleSubmit" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                <!-- Name -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nombre <span class="text-red-500">*</span>
                    </label>
                    <input
                        v-model="form.name"
                        type="text"
                        required
                        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Ej: Motor, Suspensión, Frenos..."
                    />
                </div>

                <!-- Parent Category -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Categoría Padre
                    </label>
                    <select
                        v-model="form.parent_id"
                        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option :value="null">Ninguna (categoría raíz)</option>
                        <option v-for="cat in availableParents" :key="cat.id" :value="cat.id">
                            {{ cat.parent ? `${cat.parent.name} → ${cat.name}` : cat.name }}
                        </option>
                    </select>
                    <p class="mt-1 text-xs text-gray-500">Selecciona una categoría padre si esta es una subcategoría</p>
                </div>

                <!-- Description -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Descripción
                    </label>
                    <textarea
                        v-model="form.description"
                        rows="3"
                        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Descripción de la categoría..."
                    ></textarea>
                </div>

                <!-- Default Attributes -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Atributos por Defecto
                    </label>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        Especificaciones técnicas que se sugerirán automáticamente al crear productos en esta categoría.
                    </p>
                    <div v-for="(attr, index) in form.default_attributes" :key="index"
                        class="flex items-center gap-3 mb-2">
                        <input
                            v-model="attr.name"
                            type="text"
                            class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            placeholder="Ej: Largo, Ancho, Material..."
                        />
                        <label class="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            <input type="checkbox" v-model="attr.required" class="rounded" />
                            Obligatorio
                        </label>
                        <button type="button" @click="removeAttribute(index)"
                            class="p-1 text-red-500 hover:text-red-700 transition">
                            ✕
                        </button>
                    </div>
                    <button type="button" @click="addAttribute"
                        class="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition">
                        + Añadir Atributo
                    </button>
                </div>

                <!-- Icon -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Icono
                    </label>
                    <input
                        v-model="form.icon"
                        type="text"
                        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Ej: engine, brake, suspension..."
                    />
                    <p class="mt-1 text-xs text-gray-500">Nombre del icono (opcional)</p>
                </div>

                <!-- Priority -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Prioridad
                    </label>
                    <input
                        v-model.number="form.priority"
                        type="number"
                        min="0"
                        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="0"
                    />
                    <p class="mt-1 text-xs text-gray-500">Mayor prioridad aparece primero</p>
                </div>

                <!-- Actions -->
                <div class="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        type="button"
                        @click="goBack"
                        class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        :disabled="loading"
                        class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50"
                    >
                        <Save :size="18" />
                        Actualizar
                    </button>
                </div>
            </form>
        </div>
    </AppLayout>
</template>
