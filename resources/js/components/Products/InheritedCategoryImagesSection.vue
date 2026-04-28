<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RefreshCw } from 'lucide-vue-next';
import { categoriesService } from '@/services/categories';

interface CategoryOption {
    id: number;
    name: string;
}

interface InheritedCategoryImage {
    id: number | null;
    url: string;
    file_path: string;
    original_filename: string;
    display_order: number;
    source_category_id: number;
    category_name: string;
}

const props = defineProps<{
    categoryIds: number[];
    categories: CategoryOption[];
}>();

const inheritedImages = ref<InheritedCategoryImage[]>([]);
const loading = ref(false);
const refreshing = ref(false);

const categoryNameMap = computed(() =>
    Object.fromEntries(props.categories.map((category) => [category.id, category.name])),
);

const normalizedCategoryIds = computed(() =>
    [...new Set(props.categoryIds)]
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
        .sort((a, b) => a - b),
);

let refreshInterval: ReturnType<typeof setInterval> | null = null;

const clearRefreshInterval = () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
};

const setupRefreshInterval = () => {
    clearRefreshInterval();
    if (normalizedCategoryIds.value.length === 0) return;
    refreshInterval = setInterval(() => {
        fetchInheritedImages(true);
    }, 15000);
};

const fetchInheritedImages = async (silent = false) => {
    if (normalizedCategoryIds.value.length === 0) {
        inheritedImages.value = [];
        return;
    }

    if (silent) {
        refreshing.value = true;
    } else {
        loading.value = true;
    }

    try {
        const grouped = await Promise.all(
            normalizedCategoryIds.value.map(async (categoryId) => {
                const images = await categoriesService.getImages(categoryId);
                const categoryName =
                    categoryNameMap.value[categoryId] ?? `Categoría ${categoryId}`;

                return (images as any[]).map((image, index) => ({
                    id: image.id ?? null,
                    url: String(image.url ?? ''),
                    file_path: String(image.file_path ?? ''),
                    original_filename: String(image.original_filename ?? ''),
                    display_order: Number(image.display_order ?? index),
                    source_category_id: categoryId,
                    category_name: categoryName,
                }));
            }),
        );

        const flat = grouped.flat().filter((image) => image.url);
        const uniqueBySource = new Map<string, InheritedCategoryImage>();

        flat.forEach((image) => {
            const key = `${image.source_category_id}:${image.id ?? image.url}`;
            if (!uniqueBySource.has(key)) {
                uniqueBySource.set(key, image);
            }
        });

        inheritedImages.value = [...uniqueBySource.values()].sort((a, b) => {
            if (a.category_name !== b.category_name) {
                return a.category_name.localeCompare(b.category_name, 'es');
            }
            return a.display_order - b.display_order;
        });
    } catch (error) {
        console.error('Error loading inherited category images:', error);
    } finally {
        loading.value = false;
        refreshing.value = false;
    }
};

const refreshNow = async () => {
    await fetchInheritedImages(true);
};

const onWindowFocus = () => {
    fetchInheritedImages(true);
};

watch(
    normalizedCategoryIds,
    async () => {
        await fetchInheritedImages();
        setupRefreshInterval();
    },
    { immediate: true },
);

onMounted(() => {
    window.addEventListener('focus', onWindowFocus);
});

onBeforeUnmount(() => {
    window.removeEventListener('focus', onWindowFocus);
    clearRefreshInterval();
});
</script>

<template>
    <div class="rounded-xl border border-l-4 border-gray-100 border-l-indigo-500 bg-white p-5 shadow-sm dark:border-border dark:bg-card">
        <div class="mb-3 flex items-center justify-between gap-3">
            <h2 class="text-sm font-semibold tracking-wider text-gray-500 uppercase">
                Imágenes Heredadas
            </h2>
            <button
                type="button"
                @click="refreshNow"
                :disabled="refreshing || normalizedCategoryIds.length === 0"
                class="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-border dark:bg-card dark:text-gray-300 dark:hover:bg-muted"
            >
                <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': refreshing }" />
                Actualizar
            </button>
        </div>

        <div
            v-if="normalizedCategoryIds.length === 0"
            class="rounded-md border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 dark:border-border dark:text-gray-400"
        >
            Selecciona una categoría para ver imágenes heredadas.
        </div>

        <div
            v-else-if="loading"
            class="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-border dark:text-gray-400"
        >
            Cargando imágenes heredadas...
        </div>

        <div
            v-else-if="inheritedImages.length === 0"
            class="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-border dark:text-gray-400"
        >
            Las categorías seleccionadas no tienen imágenes.
        </div>

        <div v-else class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div
                v-for="image in inheritedImages"
                :key="`${image.source_category_id}-${image.id ?? image.url}`"
                class="overflow-hidden rounded-lg border border-gray-200 dark:border-border"
            >
                <img
                    :src="image.url"
                    :alt="image.category_name"
                    class="h-28 w-full object-cover"
                />
                <div class="truncate border-t border-gray-100 px-2 py-1 text-center text-[11px] text-gray-500 dark:border-border dark:text-gray-400">
                    {{ image.category_name }}
                </div>
            </div>
        </div>
    </div>
</template>
