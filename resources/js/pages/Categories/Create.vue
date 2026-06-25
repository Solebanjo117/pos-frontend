<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3';
import { ArrowLeft, Plus, Save, X } from 'lucide-vue-next';
import { ref, onMounted, computed } from 'vue';
import CategoryImagesSection, {
    type PendingCategoryImage,
} from '@/components/Categories/CategoryImagesSection.vue';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { useCategories } from '@/composables/useCategories';
import { useStoreSettings } from '@/composables/useStoreSettings';
import AppLayout from '@/layouts/AppLayout.vue';
import { categoriesService } from '@/services/categories';
import type {
    CreateCategoryData,
    Category,
    CategoryDefaultAttribute,
} from '@/types/category';

const { loading, error, createCategory, fetchCategoriesWithParent } =
    useCategories();
const { fetchSettings, defaultTaxRate, resolveTaxRate } = useStoreSettings();

const parentCategories = ref<Category[]>([]);
const pendingImages = ref<PendingCategoryImage[]>([]);
const selectedParentCategoryId = ref<number | null>(null);

type CategoryAttributeDraft = {
    name: string;
    required: boolean;
    type: 'string' | 'select';
    options_text: string;
};

type CategoryForm = Omit<CreateCategoryData, 'default_attributes'> & {
    default_attributes: CategoryAttributeDraft[];
    parent_ids: number[];
};

const form = ref<CategoryForm>({
    name: '',
    parent_id: null,
    parent_ids: [],
    description: '',
    default_attributes: [],
    icon: '',
    image_url: null,
    priority: 0,
    default_margin_percent: null,
    pricing_formula: null,
    min_suggested_price: null,
    applies_itbm: false,
    itbm_percent: defaultTaxRate(),
});

const parentCategoryOptions = computed<SelectOption[]>(() =>
    parentCategories.value
        .filter((category) => !form.value.parent_ids.includes(category.id))
        .map((category) => ({
            value: category.id,
            label: formatCategoryLabel(category),
        })),
);

const selectedParentCategories = computed(() =>
    form.value.parent_ids
        .map((parentId) =>
            parentCategories.value.find((category) => category.id === parentId),
        )
        .filter((category): category is Category => Boolean(category)),
);

function addAttribute() {
    form.value.default_attributes.push({
        name: '',
        required: false,
        type: 'string',
        options_text: '',
    });
}

function removeAttribute(index: number) {
    form.value.default_attributes.splice(index, 1);
}

function toCategoryId(value: number | string | null): number | null {
    if (value === null || value === '') {
        return null;
    }

    const categoryId = Number(value);

    return Number.isFinite(categoryId) ? categoryId : null;
}

function formatCategoryLabel(category: Category): string {
    return category.parent
        ? `${category.parent.name} > ${category.name}`
        : category.name;
}

function addParentCategory() {
    if (
        selectedParentCategoryId.value === null ||
        form.value.parent_ids.includes(selectedParentCategoryId.value)
    ) {
        return;
    }

    form.value.parent_ids.push(selectedParentCategoryId.value);
    selectedParentCategoryId.value = null;
}

function removeParentCategory(categoryId: number) {
    form.value.parent_ids = form.value.parent_ids.filter(
        (parentId) => parentId !== categoryId,
    );

    if (selectedParentCategoryId.value === categoryId) {
        selectedParentCategoryId.value = null;
    }
}

function parseSelectOptions(optionsText: string): string[] {
    return optionsText
        .split('\n')
        .map((option) => option.trim())
        .filter((option) => option !== '');
}

function toPayloadDefaultAttributes(): CategoryDefaultAttribute[] {
    return form.value.default_attributes.flatMap(
        (attribute): CategoryDefaultAttribute[] => {
            const name = attribute.name.trim();
            const type = attribute.type === 'select' ? 'select' : 'string';
            const options =
                type === 'select'
                    ? parseSelectOptions(attribute.options_text)
                    : null;

            if (name === '') {
                return [];
            }

            return [
                {
                    name,
                    required: Boolean(attribute.required),
                    type,
                    options,
                },
            ];
        },
    );
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
        : defaultTaxRate();
}

onMounted(async () => {
    await fetchSettings();
    form.value.itbm_percent = resolveTaxRate(form.value.itbm_percent ?? null);
    parentCategories.value = await fetchCategoriesWithParent();
});

async function handleSubmit() {
    try {
        normalizeItbmPercent();
        const categoryPayload = {
            ...form.value,
            parent_id: form.value.parent_ids[0] ?? null,
            default_attributes: toPayloadDefaultAttributes(),
        };
        delete categoryPayload.image_url;

        const createdCategory = await createCategory({
            ...categoryPayload,
            name: categoryPayload.name?.toString().trim(),
        });

        if (pendingImages.value.length > 0) {
            await categoriesService.uploadImages(
                createdCategory.id,
                pendingImages.value.map((item) => item.file),
            );

            pendingImages.value.forEach((item) =>
                URL.revokeObjectURL(item.previewUrl),
            );
            pendingImages.value = [];
        }

        router.visit('/categories');
    } catch (e) {
        // Error handled in composable
    }
}

function goBack() {
    router.visit('/categories');
}
</script>

<template>
    <Head title="Nueva Categoría" />
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
                        Nueva Categoría
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Agrega una nueva categoría de productos
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

            <!-- Form -->
            <form
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

                <!-- Parent Categories -->
                <div>
                    <label
                        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        Categorías padre
                    </label>
                    <div class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                        <SearchableSelect
                            :options="parentCategoryOptions"
                            :model-value="selectedParentCategoryId"
                            @update:model-value="
                                (value) =>
                                    (selectedParentCategoryId =
                                        toCategoryId(value))
                            "
                            placeholder="Buscar categoría padre"
                            search-placeholder="Buscar categoría padre"
                            empty-results-text="Sin categorías disponibles"
                            :loading="loading"
                            :clearable="true"
                        />
                        <button
                            type="button"
                            @click="addParentCategory"
                            :disabled="!selectedParentCategoryId"
                            class="inline-flex items-center justify-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        >
                            <Plus class="h-4 w-4" />
                            Agregar
                        </button>
                    </div>
                    <div
                        v-if="selectedParentCategories.length > 0"
                        class="mt-2 flex flex-wrap gap-2"
                    >
                        <span
                            v-for="category in selectedParentCategories"
                            :key="category.id"
                            class="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200"
                        >
                            {{ formatCategoryLabel(category) }}
                            <button
                                type="button"
                                @click="removeParentCategory(category.id)"
                                class="rounded p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-800"
                                :aria-label="`Quitar ${category.name}`"
                            >
                                <X class="h-3 w-3" />
                            </button>
                        </span>
                    </div>
                    <p
                        v-else
                        class="mt-2 text-xs text-gray-500 dark:text-gray-400"
                    >
                        Sin categorías padre seleccionadas
                    </p>
                    <p class="mt-1 text-xs text-gray-500">
                        Agrega una o más categorías padre si esta es una
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

                <CategoryImagesSection mode="pending" v-model="pendingImages" />

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
                        class="mb-3 rounded-lg border border-gray-200 p-3 dark:border-border"
                    >
                        <div class="grid gap-3 sm:grid-cols-12">
                            <div class="sm:col-span-6">
                                <label
                                    class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                                >
                                    Nombre
                                </label>
                                <input
                                    v-model="attr.name"
                                    type="text"
                                    @keydown.enter.prevent
                                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                    placeholder="Ej: Largo, Ancho, Material..."
                                />
                            </div>
                            <div class="sm:col-span-3">
                                <label
                                    class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                                >
                                    Tipo
                                </label>
                                <select
                                    v-model="attr.type"
                                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                >
                                    <option value="string">Texto</option>
                                    <option value="select">Lista</option>
                                </select>
                            </div>
                            <div class="flex items-end sm:col-span-2 sm:pb-2">
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
                            </div>
                            <div class="flex items-end sm:col-span-1">
                                <button
                                    type="button"
                                    @click="removeAttribute(index)"
                                    class="w-full rounded-md border border-red-200 bg-red-50 px-2 py-2 text-red-600 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                                >
                                    ✕
                                </button>
                            </div>
                            <div
                                v-if="attr.type === 'select'"
                                class="sm:col-span-12"
                            >
                                <label
                                    class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                                >
                                    Opciones (una por línea)
                                </label>
                                <textarea
                                    v-model="attr.options_text"
                                    rows="3"
                                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                    placeholder="DELANTERO&#10;TRASERO"
                                ></textarea>
                            </div>
                        </div>
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
                        Guardar
                    </button>
                </div>
            </form>
        </div>
    </AppLayout>
</template>
