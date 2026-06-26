<script setup lang="ts">
import {
    ChevronLeft,
    ChevronRight,
    ImagePlus,
    Images,
    Loader2,
    Trash2,
    X,
} from 'lucide-vue-next';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { categoriesService } from '@/services/categories';

interface CategoryImage {
    id: number | null;
    url: string;
    file_path?: string;
    original_filename?: string;
    display_order: number;
}

export interface PendingCategoryImage {
    tempId: string;
    file: File;
    previewUrl: string;
}

const props = defineProps<{
    mode: 'pending' | 'gallery';
    categoryId?: number;
    categoryName?: string;
    modelValue?: PendingCategoryImage[];
}>();

const emit = defineEmits<{
    'update:modelValue': [value: PendingCategoryImage[]];
}>();

const maxImageSize = 5 * 1024 * 1024;
const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const toast = useToast();
const fileInput = ref<HTMLInputElement | null>(null);
const categoryImages = ref<CategoryImage[]>([]);
const currentImageIndex = ref(0);
const loadingImages = ref(false);
const uploadingImage = ref(false);
const deletingImage = ref(false);
const isDragging = ref(false);

const pendingImages = computed({
    get: () => props.modelValue ?? [],
    set: (value) => emit('update:modelValue', value),
});

const currentImage = computed(
    () => categoryImages.value[currentImageIndex.value] ?? null,
);
const hasMultipleImages = computed(() => categoryImages.value.length > 1);
const isGalleryMode = computed(() => props.mode === 'gallery');
const imageCount = computed(() =>
    isGalleryMode.value
        ? categoryImages.value.length
        : pendingImages.value.length,
);
const imageCountLabel = computed(
    () =>
        `${imageCount.value} ${imageCount.value === 1 ? 'imagen' : 'imágenes'}`,
);
const title = computed(() =>
    props.categoryName
        ? `Imágenes de ${props.categoryName}`
        : 'Imágenes de la categoría',
);

const openFilePicker = () => {
    if (!uploadingImage.value && !deletingImage.value) {
        fileInput.value?.click();
    }
};

const validFilesFrom = (files: File[]): File[] => {
    const accepted: File[] = [];
    let invalidTypeCount = 0;
    let oversizedCount = 0;

    for (const file of files) {
        if (!acceptedImageTypes.has(file.type)) {
            invalidTypeCount++;
            continue;
        }

        if (file.size > maxImageSize) {
            oversizedCount++;
            continue;
        }

        accepted.push(file);
    }

    if (invalidTypeCount > 0) {
        toast.warning('Solo se aceptan imágenes JPG, PNG o WebP.');
    }

    if (oversizedCount > 0) {
        toast.warning('Cada imagen debe pesar 5 MB o menos.');
    }

    return accepted;
};

const addPendingFiles = (files: File[]) => {
    const validFiles = validFilesFrom(files);
    if (validFiles.length === 0) return;

    const nextImages = [...pendingImages.value];
    let addedCount = 0;

    for (const file of validFiles) {
        const alreadyAdded = nextImages.some(
            (item) =>
                item.file.name === file.name &&
                item.file.size === file.size &&
                item.file.lastModified === file.lastModified,
        );

        if (alreadyAdded) continue;

        nextImages.push({
            tempId: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            previewUrl: URL.createObjectURL(file),
        });
        addedCount++;
    }

    if (addedCount === 0) {
        toast.info('Las imágenes ya estaban seleccionadas.');
        return;
    }

    pendingImages.value = nextImages;
};

const uploadFiles = async (files: File[]) => {
    if (!props.categoryId) return;

    const validFiles = validFilesFrom(files);
    if (validFiles.length === 0) return;

    uploadingImage.value = true;

    try {
        const newImages: CategoryImage[] = await categoriesService.uploadImages(
            props.categoryId,
            validFiles,
        );
        if (newImages.length > 0) {
            const firstNewImageIndex = categoryImages.value.length;
            categoryImages.value = [...categoryImages.value, ...newImages];
            currentImageIndex.value = firstNewImageIndex;
            toast.success(
                newImages.length === 1
                    ? 'Imagen agregada a la categoría.'
                    : 'Imágenes agregadas a la categoría.',
            );
        }
    } catch {
        toast.error('No se pudieron subir las imágenes.');
    } finally {
        uploadingImage.value = false;
    }
};

const handleFileSelection = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const selectedFiles = Array.from(input.files ?? []);

    if (selectedFiles.length > 0) {
        if (isGalleryMode.value) {
            uploadFiles(selectedFiles);
        } else {
            addPendingFiles(selectedFiles);
        }
    }

    input.value = '';
};

const handleDrop = (event: DragEvent) => {
    isDragging.value = false;
    const droppedFiles = Array.from(event.dataTransfer?.files ?? []);

    if (droppedFiles.length === 0) return;

    if (isGalleryMode.value) {
        uploadFiles(droppedFiles);
    } else {
        addPendingFiles(droppedFiles);
    }
};

const removePendingImage = (tempId: string) => {
    const image = pendingImages.value.find((item) => item.tempId === tempId);
    if (!image) return;

    URL.revokeObjectURL(image.previewUrl);
    pendingImages.value = pendingImages.value.filter(
        (item) => item.tempId !== tempId,
    );
};

const fetchImages = async () => {
    if (!props.categoryId) {
        categoryImages.value = [];
        return;
    }

    loadingImages.value = true;

    try {
        categoryImages.value = await categoriesService.getImages(
            props.categoryId,
        );
        if (currentImageIndex.value >= categoryImages.value.length) {
            currentImageIndex.value = Math.max(
                0,
                categoryImages.value.length - 1,
            );
        }
    } catch {
        categoryImages.value = [];
        toast.error('No se pudieron cargar las imágenes de la categoría.');
    } finally {
        loadingImages.value = false;
    }
};

const goToImage = (index: number) => {
    currentImageIndex.value = index;
};

const prevImage = () => {
    if (!hasMultipleImages.value) return;

    currentImageIndex.value =
        currentImageIndex.value === 0
            ? categoryImages.value.length - 1
            : currentImageIndex.value - 1;
};

const nextImage = () => {
    if (!hasMultipleImages.value) return;

    currentImageIndex.value =
        currentImageIndex.value === categoryImages.value.length - 1
            ? 0
            : currentImageIndex.value + 1;
};

const deleteCurrentImage = async () => {
    if (!props.categoryId || !currentImage.value) return;

    const shouldDelete = confirm('¿Eliminar esta imagen de la categoría?');
    if (!shouldDelete) return;

    const imageToDelete = currentImage.value;
    const nextIndex = Math.min(
        currentImageIndex.value,
        Math.max(categoryImages.value.length - 2, 0),
    );
    deletingImage.value = true;

    try {
        if (imageToDelete.id === null) {
            await categoriesService.update(props.categoryId, {
                image_url: null,
            });
        } else {
            await categoriesService.deleteImage(
                props.categoryId,
                imageToDelete.id,
            );
        }

        currentImageIndex.value = nextIndex;
        await fetchImages();
        toast.success('Imagen eliminada de la categoría.');
    } catch {
        toast.error('No se pudo eliminar la imagen.');
    } finally {
        deletingImage.value = false;
    }
};

watch(
    () => props.categoryId,
    () => {
        if (isGalleryMode.value) {
            fetchImages();
        }
    },
    { immediate: true },
);

onBeforeUnmount(() => {
    for (const item of pendingImages.value) {
        URL.revokeObjectURL(item.previewUrl);
    }
});
</script>

<template>
    <section
        class="rounded-lg border border-gray-100 bg-white p-5 shadow-sm dark:border-border dark:bg-card"
    >
        <div
            class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
            <div>
                <h2
                    class="flex items-center gap-2 text-sm font-semibold tracking-wider text-gray-500 uppercase"
                >
                    <Images class="h-4 w-4" />
                    {{ title }}
                </h2>
                <span
                    class="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-muted dark:text-gray-300"
                >
                    {{ imageCountLabel }}
                </span>
            </div>

            <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                :disabled="uploadingImage || deletingImage"
                @click="openFilePicker"
            >
                <Loader2 v-if="uploadingImage" class="h-4 w-4 animate-spin" />
                <ImagePlus v-else class="h-4 w-4" />
                {{ uploadingImage ? 'Subiendo...' : 'Agregar imágenes' }}
            </button>
        </div>

        <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            class="hidden"
            @change="handleFileSelection"
        />

        <div
            v-if="mode === 'pending'"
            class="rounded-lg border border-dashed p-4 transition"
            :class="
                isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'border-gray-300 dark:border-border'
            "
            @dragenter.prevent="isDragging = true"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
        >
            <div
                v-if="pendingImages.length === 0"
                class="flex min-h-32 flex-col items-center justify-center gap-3 text-center text-gray-500 dark:text-gray-400"
            >
                <ImagePlus class="h-10 w-10" />
                <button
                    type="button"
                    class="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300"
                    @click="openFilePicker"
                >
                    Seleccionar imágenes
                </button>
            </div>

            <div
                v-else
                class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
            >
                <div
                    v-for="item in pendingImages"
                    :key="item.tempId"
                    class="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-border dark:bg-muted"
                >
                    <img
                        :src="item.previewUrl"
                        :alt="item.file.name"
                        class="h-28 w-full object-cover"
                    />
                    <button
                        type="button"
                        class="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/80"
                        title="Quitar imagen"
                        @click="removePendingImage(item.tempId)"
                    >
                        <X class="h-3.5 w-3.5" />
                    </button>
                    <p
                        class="truncate px-2 py-1 text-[11px] text-gray-600 dark:text-gray-300"
                        :title="item.file.name"
                    >
                        {{ item.file.name }}
                    </p>
                </div>
            </div>
        </div>

        <div v-else>
            <div
                v-if="loadingImages"
                class="flex min-h-56 items-center justify-center text-sm text-gray-500 dark:text-gray-400"
            >
                <Loader2 class="mr-2 h-5 w-5 animate-spin" />
                Cargando imágenes
            </div>

            <div
                v-else-if="categoryImages.length === 0"
                class="flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-500 transition dark:border-border dark:text-gray-400"
                :class="
                    isDragging
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                        : ''
                "
                @dragenter.prevent="isDragging = true"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
            >
                <ImagePlus class="h-12 w-12" />
                <button
                    type="button"
                    class="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300"
                    @click="openFilePicker"
                >
                    Seleccionar imágenes
                </button>
            </div>

            <div v-else class="space-y-4">
                <div
                    class="group relative mx-auto h-80 max-w-2xl overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-border dark:bg-muted"
                    :class="isDragging ? 'ring-2 ring-blue-500' : ''"
                    @dragenter.prevent="isDragging = true"
                    @dragover.prevent="isDragging = true"
                    @dragleave.prevent="isDragging = false"
                    @drop.prevent="handleDrop"
                >
                    <img
                        v-if="currentImage"
                        :key="currentImage.id ?? currentImage.url"
                        :src="currentImage.url"
                        :alt="categoryName || 'Categoría'"
                        class="h-full w-full object-contain"
                    />

                    <button
                        v-if="hasMultipleImages"
                        type="button"
                        class="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75"
                        title="Imagen anterior"
                        @click="prevImage"
                    >
                        <ChevronLeft class="h-5 w-5" />
                    </button>
                    <button
                        v-if="hasMultipleImages"
                        type="button"
                        class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75"
                        title="Imagen siguiente"
                        @click="nextImage"
                    >
                        <ChevronRight class="h-5 w-5" />
                    </button>

                    <div
                        class="absolute top-3 left-3 rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium text-white"
                    >
                        {{ currentImageIndex + 1 }} /
                        {{ categoryImages.length }}
                    </div>

                    <button
                        type="button"
                        class="absolute top-3 right-3 rounded-md bg-red-600/85 p-1.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="deletingImage"
                        title="Eliminar imagen"
                        @click="deleteCurrentImage"
                    >
                        <Loader2
                            v-if="deletingImage"
                            class="h-4 w-4 animate-spin"
                        />
                        <Trash2 v-else class="h-4 w-4" />
                    </button>
                </div>

                <div
                    v-if="hasMultipleImages"
                    class="mx-auto grid max-w-2xl grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8"
                >
                    <button
                        v-for="(img, idx) in categoryImages"
                        :key="img.id ?? img.url"
                        type="button"
                        class="relative h-16 overflow-hidden rounded-md border-2 transition"
                        :class="
                            idx === currentImageIndex
                                ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900'
                                : 'border-gray-200 hover:border-gray-400 dark:border-border'
                        "
                        @click="goToImage(idx)"
                    >
                        <img
                            :src="img.url"
                            :alt="
                                img.original_filename ||
                                categoryName ||
                                'Categoría'
                            "
                            class="h-full w-full object-cover"
                        />
                    </button>
                </div>
            </div>
        </div>
    </section>
</template>
