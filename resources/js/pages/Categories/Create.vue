<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import { useCategories } from '@/composables/useCategories'
import { ArrowLeft, Save } from 'lucide-vue-next'
import type { CreateCategoryData, Category } from '@/types/category'
import SearchableSelect, { type SelectOption } from '@/components/ui/SearchableSelect.vue'

const { loading, error, createCategory, fetchCategoriesWithParent } = useCategories()

const parentCategories = ref<Category[]>([])

const parentCategoryOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Ninguna (categoría raíz)' },
    ...parentCategories.value.map((category) => ({
        value: category.id,
        label: category.parent ? `${category.parent.name} → ${category.name}` : category.name,
    })),
])

const form = ref<CreateCategoryData & { default_attributes: { name: string; required: boolean }[] }>({
    name: '',
    parent_id: null,
    description: '',
    default_attributes: [],
    icon: '',
    priority: 0, // kept for compatibility but hidden
    default_margin_percent: null,
    pricing_formula: null,
    min_suggested_price: null,
    applies_itbm: false,
    itbm_percent: 7, // default ITBM 7%
})

function addAttribute() {
    form.value.default_attributes.push({ name: '', required: false })
}

function removeAttribute(index: number) {
    form.value.default_attributes.splice(index, 1)
}

function normalizeItbmPercent() {
    if (form.value.itbm_percent === null || form.value.itbm_percent === undefined) return
    const parsed = Number(form.value.itbm_percent)
    form.value.itbm_percent = Number.isFinite(parsed)
        ? Math.max(0, Math.min(100, Math.round(parsed)))
        : 7
}

onMounted(async () => {
    parentCategories.value = await fetchCategoriesWithParent()
})

async function handleSubmit() {
    try {
        normalizeItbmPercent()
        await createCategory({
            ...form.value,
            name: form.value.name?.toString().trim(),
        })
        router.visit('/categories')
    } catch (e) {
        // Error handled in composable
    }
}

function goBack() {
    router.visit('/categories')
}
</script>

<template>
    <Head title="Nueva Categoría" />
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
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Nueva Categoría</h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Agrega una nueva categoría de productos
                    </p>
                </div>
            </div>

            <!-- Error -->
            <div v-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p class="text-red-600 dark:text-red-400">{{ error }}</p>
            </div>

            <!-- Form -->
            <form @submit.prevent="handleSubmit" @keydown.enter="(e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') e.preventDefault() }" class="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-200 dark:border-border p-6 space-y-6">
                <!-- Name -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nombre <span class="text-red-500">*</span>
                    </label>
                    <input
                        v-model="form.name"
                        type="text"
                        required
                        @keydown.enter.prevent
                        class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white"
                        placeholder="Ej: Motor, Suspensión, Frenos..."
                    />
                </div>

                <!-- Parent Category -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Categoría Padre
                    </label>
                    <SearchableSelect
                        v-model="form.parent_id"
                        :options="parentCategoryOptions"
                        placeholder="Ninguna (categoría raíz)"
                    />
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
                        class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white"
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
                            @keydown.enter.prevent
                            class="flex-1 px-3 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white text-sm"
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
                        class="inline-flex items-center gap-1 text-sm text-indigo-600 dark:text-primary hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition">
                        + Añadir Atributo
                    </button>
                </div>

                <!-- Pricing Section -->
                <div class="border-t border-gray-200 dark:border-border pt-5 space-y-5">
                    <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Configuración de Precios</h3>
                    
                    <div class="p-4 bg-gray-50 dark:bg-muted/30 rounded-lg space-y-4">
                        <!-- ITBM Checkbox + Porcentaje -->
                        <div class="space-y-2">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" v-model="form.applies_itbm" class="rounded" />
                                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Aplicar ITBM a productos de esta categoría</span>
                            </label>
                            
                            <div v-if="form.applies_itbm" class="flex items-center gap-3 pl-6">
                                <label class="text-sm text-gray-600 dark:text-gray-400">Porcentaje ITBM:</label>
                                <input
                                    v-model.number="form.itbm_percent"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    class="w-20 px-3 py-1.5 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white text-sm"
                                />
                                <span class="text-sm text-gray-500">%</span>
                            </div>
                        </div>

                        <!-- Pricing Formula -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Fórmula de precio
                            </label>
                            <input
                                v-model="form.pricing_formula"
                                type="text"
                                @keydown.enter.prevent
                                class="w-full px-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white font-mono text-sm"
                                placeholder="ej: costo * 1.3 + 5"
                            />
                            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Variable disponible: <code class="bg-gray-100 dark:bg-muted px-1 rounded">costo</code>.
                                Ej: <code class="bg-gray-100 dark:bg-muted px-1 rounded">costo * 1.5</code> aplica 50% de margen.
                            </p>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Precio Minimo Sugerido
                            </label>
                            <div class="relative">
                                <span class="absolute left-3 top-2 text-sm text-gray-500">$</span>
                                <input
                                    v-model.number="form.min_suggested_price"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    class="w-full pl-7 pr-4 py-2 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-muted text-gray-900 dark:text-white"
                                    placeholder="0.00"
                                />
                            </div>
                            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Precio minimo de venta sugerido para productos de esta categoria
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Actions -->
                <div class="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-border">
                    <button
                        type="button"
                        @click="goBack"
                        class="px-4 py-2 border border-gray-300 dark:border-border rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted/50 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        :disabled="loading"
                        class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-primary dark:text-primary-foreground hover:bg-indigo-700 dark:hover:bg-primary/90 text-white rounded-lg transition disabled:opacity-50"
                    >
                        <Save :size="18" />
                        Guardar
                    </button>
                </div>
            </form>
        </div>
    </AppLayout>
</template>
