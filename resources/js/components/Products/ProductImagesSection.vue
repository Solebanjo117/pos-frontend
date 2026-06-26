<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { ref, computed, onMounted, watch } from 'vue';
import apiClient from '@/services/api/client';
import { categoriesService } from '@/services/categories';

interface ProductImage {
    id: number;
    url: string;
    original_filename: string;
    display_order: number;
}

interface InheritedImage {
    id: number;
    url: string;
    display_order: number;
    category_name: string;
    category_id: number;
}

interface GroupedInheritedImages {
    categoryId: number;
    categoryName: string;
    images: InheritedImage[];
}

export interface PendingImage {
    tempId: string;
    file: File;
    previewUrl: string;
}

const props = defineProps<{
    mode: 'pending' | 'gallery';
    productId?: number;
    productName?: string;
    modelValue?: PendingImage[];
    categoryIds?: number[];
    categoryNameMap?: Record<number, string>;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: PendingImage[]];
}>();

// === Gallery mode state ===
const productImages = ref<ProductImage[]>([]);
const currentImageIndex = ref(0);
const uploadingImage = ref(false);

const currentImage = computed(
    () => productImages.value[currentImageIndex.value] ?? null,
);
const hasMultipleImages = computed(() => productImages.value.length > 1);

const prevImage = () => {
    if (productImages.value.length <= 1) return;
    currentImageIndex.value =
        currentImageIndex.value === 0
            ? productImages.value.length - 1
            : currentImageIndex.value - 1;
};

const nextImage = () => {
    if (productImages.value.length <= 1) return;
    currentImageIndex.value =
        currentImageIndex.value === productImages.value.length - 1
            ? 0
            : currentImageIndex.value + 1;
};

const goToImage = (index: number) => {
    currentImageIndex.value = index;
};

const fetchImages = async () => {
    if (!props.productId) return;
    try {
        const res = await apiClient.get(`/products/${props.productId}/images`);
        productImages.value = res.data.data ?? [];
    } catch {
        productImages.value = [];
    }
};

const handleImageUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    uploadingImage.value = true;
    const formData = new FormData();
    for (let i = 0; i < input.files.length; i++) {
        formData.append('images[]', input.files[i]);
    }

    try {
        const res = await apiClient.post(
            `/products/${props.productId}/images`,
            formData,
            {
                headers: { 'Content-Type': 'multipart/form-data' },
            },
        );
        const newImages: ProductImage[] = res.data.data ?? [];
        const jumpTo = productImages.value.length;
        productImages.value.push(...newImages);
        if (newImages.length > 0) currentImageIndex.value = jumpTo;
    } catch (e) {
        console.error('Error uploading image', e);
    } finally {
        uploadingImage.value = false;
        input.value = '';
    }
};

const handleDeleteImage = async (imageId: number) => {
    if (!confirm('¿Eliminar esta imagen?')) return;
    try {
        await apiClient.delete(
            `/products/${props.productId}/images/${imageId}`,
        );
        const idx = productImages.value.findIndex((img) => img.id === imageId);
        if (idx !== -1) {
            productImages.value.splice(idx, 1);
            if (currentImageIndex.value >= productImages.value.length) {
                currentImageIndex.value = Math.max(
                    0,
                    productImages.value.length - 1,
                );
            }
        }
    } catch (e) {
        console.error('Error deleting image', e);
    }
};

// === Pending mode state ===
const pendingImages = computed({
    get: () => props.modelValue ?? [],
    set: (val) => emit('update:modelValue', val),
});

const handlePendingImageSelection = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const newImages = [...pendingImages.value];
    for (const file of Array.from(input.files)) {
        const alreadyAdded = newImages.some(
            (item) =>
                item.file.name === file.name &&
                item.file.size === file.size &&
                item.file.lastModified === file.lastModified,
        );
        if (alreadyAdded) continue;
        newImages.push({
            tempId: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            previewUrl: URL.createObjectURL(file),
        });
    }
    pendingImages.value = newImages;
    input.value = '';
};

const removePendingImage = (tempId: string) => {
    const index = pendingImages.value.findIndex(
        (item) => item.tempId === tempId,
    );
    if (index === -1) return;
    URL.revokeObjectURL(pendingImages.value[index].previewUrl);
    const updated = [...pendingImages.value];
    updated.splice(index, 1);
    pendingImages.value = updated;
};

// === Inherited images from categories ===
const groupedInheritedImages = ref<GroupedInheritedImages[]>([]);
const inheritedImagesLoading = ref(false);

const allInheritedImages = computed(() =>
    groupedInheritedImages.value.flatMap((group) => group.images),
);

const hasInheritedImages = computed(() => allInheritedImages.value.length > 0);

// Cache and deduplication for category image fetches
const categoryImageCache = new Map<number, InheritedImage[]>();
let lastFetchedCategoryKey = '';

const fetchInheritedImages = async () => {
    const ids = [...(props.categoryIds ?? [])].sort((a, b) => a - b);
    const cacheKey = ids.join(',');

    // Skip if the same set of categories was already fetched.
    if (cacheKey === lastFetchedCategoryKey) return;

    if (ids.length === 0) {
        groupedInheritedImages.value = [];
        lastFetchedCategoryKey = cacheKey;
        return;
    }

    inheritedImagesLoading.value = true;
    const results: GroupedInheritedImages[] = [];

    // Only fetch categories not already cached.
    const uncachedIds = ids.filter((id) => !categoryImageCache.has(id));

    if (uncachedIds.length > 0) {
        await Promise.all(
            uncachedIds.map(async (categoryId) => {
                try {
                    const images =
                        await categoriesService.getImages(categoryId);
                    categoryImageCache.set(
                        categoryId,
                        images && images.length > 0 ? images : [],
                    );
                } catch {
                    categoryImageCache.set(categoryId, []);
                }
            }),
        );
    }

    for (const categoryId of ids) {
        const images = categoryImageCache.get(categoryId) ?? [];
        if (images.length > 0) {
            results.push({
                categoryId,
                categoryName:
                    props.categoryNameMap?.[categoryId] ??
                    `Categoría ${categoryId}`,
                images: images.map((img: InheritedImage) => ({
                    ...img,
                    category_id: categoryId,
                })),
            });
        }
    }

    groupedInheritedImages.value = results;
    lastFetchedCategoryKey = cacheKey;
    inheritedImagesLoading.value = false;
};

watch(
    () => props.categoryIds,
    () => fetchInheritedImages(),
    { deep: true },
);

onMounted(() => {
    if (props.mode === 'gallery') fetchImages();
    fetchInheritedImages();
});
</script>

<template>
    <!-- Pending mode (Create) -->
    <div
        v-if="mode === 'pending'"
        class="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-border dark:bg-card"
    >
        <div class="mb-3 flex items-center justify-between gap-3">
            <h2
                class="text-sm font-semibold tracking-wider text-gray-500 uppercase"
            >
                Imagen del Producto
            </h2>
            <label
                class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
            >
                Seleccionar imágenes
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    class="hidden"
                    @change="handlePendingImageSelection"
                />
            </label>
        </div>

        <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Las imágenes se cargarán automáticamente al crear el producto.
        </p>

        <div
            v-if="pendingImages.length === 0"
            class="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-border dark:text-gray-400"
        >
            No hay imágenes seleccionadas.
        </div>
        <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div
                v-for="item in pendingImages"
                :key="item.tempId"
                class="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-border dark:bg-muted"
            >
                <img
                    :src="item.previewUrl"
                    :alt="item.file.name"
                    class="h-28 w-full object-cover"
                />
                <button
                    type="button"
                    @click="removePendingImage(item.tempId)"
                    class="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    title="Quitar imagen"
                >
                    <X class="h-3 w-3" />
                </button>
                <p
                    class="truncate px-2 py-1 text-[11px] text-gray-600 dark:text-gray-300"
                    :title="item.file.name"
                >
                    {{ item.file.name }}
                </p>
            </div>
        </div>

        <!-- Inherited category images -->
        <div
            v-if="categoryIds && categoryIds.length > 0"
            class="mt-5 border-t border-gray-200 pt-5 dark:border-border"
        >
            <h3
                class="mb-3 text-sm font-semibold tracking-wider text-blue-700 uppercase dark:text-blue-300"
            >
                Imágenes Heredadas de Categorías
            </h3>
            <p class="mb-3 text-xs text-blue-600 dark:text-blue-400">
                Estas imágenes se heredan automáticamente de las categorías
                seleccionadas.
            </p>

            <div
                v-if="inheritedImagesLoading"
                class="flex items-center justify-center py-4"
            >
                <div
                    class="h-5 w-5 animate-spin rounded-full border-2 border-blue-400 border-r-transparent"
                ></div>
                <span class="ml-2 text-sm text-blue-600 dark:text-blue-400"
                    >Cargando...</span
                >
            </div>

            <div
                v-else-if="!hasInheritedImages"
                class="py-3 text-center text-sm text-gray-400"
            >
                Las categorías seleccionadas no tienen imágenes
            </div>

            <div v-else class="space-y-3">
                <div
                    v-for="group in groupedInheritedImages"
                    :key="group.categoryId"
                    class="space-y-1.5"
                >
                    <p
                        class="text-xs font-medium text-gray-600 dark:text-gray-300"
                    >
                        {{ group.categoryName }}
                        <span class="text-gray-400 dark:text-gray-500"
                            >({{ group.images.length }})</span
                        >
                    </p>
                    <div
                        class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6"
                    >
                        <div
                            v-for="img in group.images"
                            :key="img.id"
                            class="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-border dark:bg-muted"
                        >
                            <img
                                :src="img.url"
                                :alt="group.categoryName"
                                class="h-20 w-full object-cover"
                                loading="lazy"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Gallery mode (Edit) -->
    <div v-else class="rounded-lg bg-white p-6 shadow dark:bg-card">
        <div class="mb-6 flex items-center justify-between">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                Imagen del Producto
            </h2>
            <label
                class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
            >
                <svg
                    class="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 4v16m8-8H4"
                    />
                </svg>
                {{ uploadingImage ? 'Subiendo...' : 'Agregar Fotos' }}
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    class="hidden"
                    multiple
                    @change="handleImageUpload"
                    :disabled="uploadingImage"
                />
            </label>
        </div>

        <div v-if="productImages.length > 0" class="relative mx-auto max-w-2xl">
            <div
                class="group/img relative h-80 overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800"
            >
                <img
                    v-if="currentImage"
                    :src="currentImage.url"
                    :alt="productName || 'Producto'"
                    class="h-full w-full object-contain"
                    :key="currentImage.id"
                />
                <button
                    v-if="hasMultipleImages"
                    @click="prevImage"
                    type="button"
                    class="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 backdrop-blur-sm transition-all group-hover/img:opacity-100 hover:bg-black/70"
                >
                    <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2.5"
                            d="M15 19l-7-7 7-7"
                        />
                    </svg>
                </button>
                <button
                    v-if="hasMultipleImages"
                    @click="nextImage"
                    type="button"
                    class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 backdrop-blur-sm transition-all group-hover/img:opacity-100 hover:bg-black/70"
                >
                    <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2.5"
                            d="M9 5l7 7-7 7"
                        />
                    </svg>
                </button>
                <div
                    class="absolute top-3 left-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm"
                >
                    {{ currentImageIndex + 1 }} / {{ productImages.length }}
                </div>
                <button
                    v-if="currentImage"
                    @click="handleDeleteImage(currentImage.id)"
                    type="button"
                    class="absolute top-3 right-3 rounded-lg bg-red-500/80 p-1.5 text-white opacity-0 backdrop-blur-sm transition-all group-hover/img:opacity-100 hover:bg-red-600"
                    title="Eliminar imagen"
                >
                    <svg
                        class="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                    </svg>
                </button>
                <div
                    v-if="hasMultipleImages"
                    class="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5"
                >
                    <button
                        v-for="(_, idx) in productImages"
                        :key="idx"
                        @click="goToImage(idx)"
                        type="button"
                        class="h-2.5 w-2.5 rounded-full transition-all"
                        :class="
                            idx === currentImageIndex
                                ? 'scale-125 bg-white shadow-md'
                                : 'bg-white/50 hover:bg-white/80'
                        "
                    />
                </div>
            </div>
        </div>
        <div
            v-else
            class="flex flex-col items-center justify-center py-12 text-gray-400"
        >
            <svg
                class="mb-3 h-16 w-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
            </svg>
            <p class="text-sm">Este producto no tiene fotos</p>
        </div>
        <div
            v-if="productImages.length > 1"
            class="mx-auto mt-4 grid max-w-2xl grid-cols-6 gap-2"
        >
            <button
                v-for="(img, idx) in productImages"
                :key="img.id"
                @click="goToImage(idx)"
                type="button"
                class="relative h-16 overflow-hidden rounded-lg border-2 transition-all"
                :class="
                    idx === currentImageIndex
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-400 dark:border-border'
                "
            >
                <img :src="img.url" class="h-full w-full object-cover" />
            </button>
        </div>

        <!-- Inherited category images in gallery mode -->
        <div
            v-if="categoryIds && categoryIds.length > 0"
            class="mt-6 border-t border-gray-200 pt-6 dark:border-border"
        >
            <h3
                class="mb-3 text-sm font-semibold tracking-wider text-blue-700 uppercase dark:text-blue-300"
            >
                Imágenes Heredadas de Categorías
            </h3>
            <p class="mb-3 text-xs text-blue-600 dark:text-blue-400">
                Estas imágenes se heredan automáticamente de las categorías
                seleccionadas.
            </p>

            <div
                v-if="inheritedImagesLoading"
                class="flex items-center justify-center py-4"
            >
                <div
                    class="h-5 w-5 animate-spin rounded-full border-2 border-blue-400 border-r-transparent"
                ></div>
                <span class="ml-2 text-sm text-blue-600 dark:text-blue-400"
                    >Cargando...</span
                >
            </div>

            <div
                v-else-if="!hasInheritedImages"
                class="py-3 text-center text-sm text-gray-400"
            >
                Las categorías seleccionadas no tienen imágenes
            </div>

            <div v-else class="space-y-3">
                <div
                    v-for="group in groupedInheritedImages"
                    :key="group.categoryId"
                    class="space-y-1.5"
                >
                    <p
                        class="text-xs font-medium text-gray-600 dark:text-gray-300"
                    >
                        {{ group.categoryName }}
                        <span class="text-gray-400 dark:text-gray-500"
                            >({{ group.images.length }})</span
                        >
                    </p>
                    <div
                        class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6"
                    >
                        <div
                            v-for="img in group.images"
                            :key="img.id"
                            class="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-border dark:bg-muted"
                        >
                            <img
                                :src="img.url"
                                :alt="group.categoryName"
                                class="h-20 w-full object-cover"
                                loading="lazy"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
