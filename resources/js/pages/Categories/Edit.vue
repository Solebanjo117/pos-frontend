<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { useCategories } from '@/composables/useCategories';
import { ArrowLeft, Save } from 'lucide-vue-next';
import type { UpdateCategoryData, Category } from '@/types/category';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import CategoryImagesSection from '@/components/Categories/CategoryImagesSection.vue';

interface Props {
    id: string;
}

const props = defineProps<Props>();

const {
    category,
    loading,
    error,
    fetchCategoryById,
    updateCategory,
    fetchCategoriesWithParent,
} = useCategories();

const parentCategories = ref<Category[]>([]);

const form = ref<
    UpdateCategoryData & {
        default_attributes: { name: string; required: boolean }[];
    }
>({
    name: '',
    parent_id: null,
    description: '',
    default_attributes: [],
    icon: '',
    image_url: null,
    priority: 0,
    default_margin_percent: null,
    pricing_formula: null,
    min_suggested_price: null,
    applies_itbm: false,
    itbm_percent: 7,
});

function addAttribute() {
    form.value.default_attributes.push({ name: '', required: false });
}

function removeAttribute(index: number) {
    form.value.default_attributes.splice(index, 1);
}

function normalizeItbmPercent() {
    if (
        form.value.itbm_percent === null ||
        form.value.itbm_percent === undefined
    )
        return;
    const parsed = Number(form.value.itbm_percent);
    form.value.itbm_percent = Number.isFinite(parsed)
        ? Math.max(0, Math.min(100, Math.round(parsed)))
        : 7;
}

onMounted(async () => {
    await fetchCategoryById(Number(props.id));
    parentCategories.value = await fetchCategoriesWithParent();

    if (category.value) {
        form.value = {
            name: category.value.name,
            parent_id: category.value.parent_id ?? null,
            description: category.value.description || '',
            default_attributes:
                (category.value as any).default_attributes || [],
            icon: category.value.icon || '',
            image_url: category.value.image_url ?? null,
            priority: category.value.priority ?? 0,
            default_margin_percent:
                category.value.default_margin_percent ?? null,
            pricing_formula: category.value.pricing_formula ?? null,
            min_suggested_price: category.value.min_suggested_price ?? null,
            applies_itbm: category.value.applies_itbm ?? false,
            itbm_percent: category.value.itbm_percent ?? 7,
        };
    }
});

async function handleSubmit() {
    try {
        normalizeItbmPercent();
        const categoryPayload = { ...form.value };
        delete categoryPayload.image_url;

        await updateCategory(Number(props.id), {
            ...categoryPayload,
            name: categoryPayload.name?.toString().trim(),
        });

        router.visit('/categories');
    } catch (e) {
        // Error handled in composable
    }
}

function goBack() {
    router.visit('/categories');
}

// Filter out current category and its descendants from parent options
const availableParents = computed(() =>
    parentCategories.value.filter((c) => c.id !== Number(props.id)),
);

const parentCategoryOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Ninguna (categoría raíz)' },
    ...availableParents.value.map((category) => ({
        value: category.id,
        label: category.parent
            ? `${category.parent.name} → ${category.name}`
            : category.name,
    })),
]);
</script>

<template>
    <Head title="Editar Categoría" />
    <AppLayout>
        <div class="mx-auto max-w-2xl space-y-6">
            <!-- Header -->
            <div class="flex items-center gap-4">
                <button
                    @click="goBack"
                    class="p-2 text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                    <ArrowLeft :size="24" />
                </button>
                <div>
                    <h1
                        class="text-3xl font-bold text-gray-900 dark:text-white"
                    >
                        Editar Categoría
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Modifica la información de la categoría
                    </p>
                </div>
            </div>

            <!-- Error -->
            <div
                v-if="error"
                class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30"
            >
                <p class="text-red-600 dark:text-red-400">{{ error }}</p>
            </div>

            <!-- Loading or Form -->
            <div
                v-if="loading && !category"
                class="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm dark:border-border dark:bg-card"
            >
                <div
                    class="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600 dark:border-primary"
                ></div>
                <p class="mt-4 text-gray-500">Cargando...</p>
            </div>

            <form
                v-else
                @submit.prevent="handleSubmit"
                @keydown.enter="
                    (e: KeyboardEvent) => {
                        if ((e.target as HTMLElement)?.tagName === 'INPUT')
                            e.preventDefault();
                    }
                "
                class="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-border dark:bg-card"
            >
                <!-- Name -->
                <div>
                    <label
                        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Nombre <span class="text-red-500">*</span>
                    </label>
                    <input
                        v-model="form.name"
                        type="text"
                        required
                        @keydown.enter.prevent
                        class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        placeholder="Ej: Motor, Suspensión, Frenos..."
                    />
                </div>

                <!-- Parent Category -->
                <div>
                    <label
                        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Categoría Padre
                    </label>
                    <SearchableSelect
                        v-model="form.parent_id"
                        :options="parentCategoryOptions"
                        placeholder="Ninguna (categoría raíz)"
                    />
                    <p class="mt-1 text-xs text-gray-500">
                        Selecciona una categoría padre si esta es una
                        subcategoría
                    </p>
                </div>

                <!-- Description -->
                <div>
                    <label
                        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Descripción
                    </label>
                    <textarea
                        v-model="form.description"
                        rows="3"
                        class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                        placeholder="Descripción de la categoría..."
                    ></textarea>
                </div>

                <CategoryImagesSection
                    mode="gallery"
                    :category-id="Number(props.id)"
                    :category-name="form.name || category?.name || 'Categoría'"
                />

                <!-- Default Attributes -->
                <div>
                    <label
                        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Atributos por Defecto
                    </label>
                    <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
                        Especificaciones técnicas que se sugerirán
                        automáticamente al crear productos en esta categoría.
                    </p>
                    <div
                        v-for="(attr, index) in form.default_attributes"
                        :key="index"
                        class="mb-2 flex items-center gap-3"
                    >
                        <input
                            v-model="attr.name"
                            type="text"
                            @keydown.enter.prevent
                            class="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                            placeholder="Ej: Largo, Ancho, Material..."
                        />
                        <label
                            class="flex items-center gap-1 text-xs whitespace-nowrap text-gray-600 dark:text-gray-400"
                        >
                            <input
                                type="checkbox"
                                v-model="attr.required"
                                class="rounded"
                            />
                            Obligatorio
                        </label>
                        <button
                            type="button"
                            @click="removeAttribute(index)"
                            class="p-1 text-red-500 transition hover:text-red-700"
                        >
                            ✕
                        </button>
                    </div>
                    <button
                        type="button"
                        @click="addAttribute"
                        class="inline-flex items-center gap-1 text-sm text-indigo-600 transition hover:text-indigo-800 dark:text-indigo-400 dark:text-primary dark:hover:text-indigo-300"
                    >
                        + Añadir Atributo
                    </button>
                </div>

                <!-- Pricing Section -->
                <div
                    class="space-y-5 border-t border-gray-200 pt-5 dark:border-border"
                >
                    <h3
                        class="text-sm font-semibold text-gray-900 dark:text-white"
                    >
                        Configuración de Precios
                    </h3>

                    <div
                        class="space-y-4 rounded-lg bg-gray-50 p-4 dark:bg-muted/30"
                    >
                        <!-- ITBM Checkbox + Porcentaje -->
                        <div class="space-y-2">
                            <label
                                class="flex cursor-pointer items-center gap-2"
                            >
                                <input
                                    type="checkbox"
                                    v-model="form.applies_itbm"
                                    class="rounded"
                                />
                                <span
                                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Aplicar ITBM a productos de esta
                                    categoría</span
                                >
                            </label>

                            <div
                                v-if="form.applies_itbm"
                                class="flex items-center gap-3 pl-6"
                            >
                                <label
                                    class="text-sm text-gray-600 dark:text-gray-400"
                                    >Porcentaje ITBM:</label
                                >
                                <input
                                    v-model.number="form.itbm_percent"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    class="w-20 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                />
                                <span class="text-sm text-gray-500">%</span>
                            </div>
                        </div>

                        <!-- Pricing Formula -->
                        <div>
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Fórmula de precio
                            </label>
                            <input
                                v-model="form.pricing_formula"
                                type="text"
                                @keydown.enter.prevent
                                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 font-mono text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                placeholder="ej: costo * 1.3 + 5"
                            />
                            <p
                                class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                            >
                                Variable disponible:
                                <code
                                    class="rounded bg-gray-100 px-1 dark:bg-muted"
                                    >costo</code
                                >. Ej:
                                <code
                                    class="rounded bg-gray-100 px-1 dark:bg-muted"
                                    >costo * 1.5</code
                                >
                                aplica 50% de margen.
                            </p>
                        </div>

                        <div>
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                Precio Minimo Sugerido
                            </label>
                            <div class="relative">
                                <span
                                    class="absolute top-2 left-3 text-sm text-gray-500"
                                    >$</span
                                >
                                <input
                                    v-model.number="form.min_suggested_price"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    class="w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-7 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                    placeholder="0.00"
                                />
                            </div>
                            <p
                                class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                            >
                                Precio minimo de venta sugerido para productos
                                de esta categoria
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Actions -->
                <div
                    class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-border"
                >
                    <button
                        type="button"
                        @click="goBack"
                        class="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50 dark:border-border dark:text-gray-300 dark:hover:bg-muted/50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        :disabled="loading"
                        class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                    >
                        <Save :size="18" />
                        Actualizar
                    </button>
                </div>
            </form>
        </div>
    </AppLayout>
</template>
