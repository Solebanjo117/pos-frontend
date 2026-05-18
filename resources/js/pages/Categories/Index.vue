<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { Head, Link } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { useCategories } from '@/composables/useCategories';
import {
    Search,
    Plus,
    Trash2,
    Folder,
    CornerDownRight,
    ChevronRight,
    ChevronDown,
    ChevronLeft,
    Upload,
} from 'lucide-vue-next';
import type { Category } from '@/types/category';

const { loading, error, fetchCategoriesWithParent, deleteCategory } =
    useCategories();

const searchQuery = ref('');
const expandedCategories = ref<Set<number>>(new Set());

// Pagination State
const currentPage = ref(1);
const itemsPerPage = ref(15);

// Categories with parent info for display
const categoriesWithParent = ref<Category[]>([]);

// Reset pagination when search changes
watch(searchQuery, () => {
    currentPage.value = 1;
});

// Extended Category interface for UI
interface UICategory extends Category {
    _indent: number;
    _isSearchMatched: boolean;
    _hasChildren: boolean;
    _isExpanded: boolean;
    _path: string;
}

const categoryMap = computed(() => {
    const map = new Map<number, Category>();
    categoriesWithParent.value.forEach((category) => {
        map.set(category.id, category);
    });
    return map;
});

function buildCategoryPath(category: Category): string {
    const path = [category.name];
    const visited = new Set<number>([category.id]);
    let parentId = category.parent_id ?? null;

    while (parentId) {
        if (visited.has(parentId)) break;
        const parent = categoryMap.value.get(parentId);
        if (!parent) break;

        path.unshift(parent.name);
        visited.add(parent.id);
        parentId = parent.parent_id ?? null;
    }

    return path.join(' / ');
}

// Compute filtered categories (flattened for search but still preserving parent-child context if possible)
const processedCategories = computed(() => {
    let list = categoriesWithParent.value;
    const queryText = searchQuery.value.trim();

    // Apply search filter if it exists
    if (queryText) {
        const query = queryText.toLowerCase();
        const matched = list.filter(
            (c) =>
                c.name.toLowerCase().includes(query) ||
                c.description?.toLowerCase().includes(query) ||
                c.parent?.name.toLowerCase().includes(query) ||
                buildCategoryPath(c).toLowerCase().includes(query) ||
                (c.default_attributes || []).some((attr) =>
                    attr.name.toLowerCase().includes(query),
                ),
        );
        // For search, we show a flat list of all matches
        return {
            items: matched.map(
                (c) =>
                    ({
                        ...c,
                        _isSearchMatched: true,
                        _indent: 0,
                        _hasChildren: false,
                        _isExpanded: false,
                        _path: buildCategoryPath(c),
                    }) as UICategory,
            ),
            totalPages: 1, // Search doesn't paginate for now, or paginates flat
        };
    }

    // Build Hierarchical Tree Display (when no search)
    const result: UICategory[] = [];

    // Group children by parent
    const childrenByParent = list.reduce(
        (acc, cat) => {
            if (cat.parent_id) {
                if (!acc[cat.parent_id]) acc[cat.parent_id] = [];
                acc[cat.parent_id].push(cat);
            }
            return acc;
        },
        {} as Record<number, Category[]>,
    );

    // Pagination: Only slice the TOP LEVEL items
    let topLevel = list
        .filter((c) => !c.parent_id)
        .sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const totalPages = Math.ceil(topLevel.length / itemsPerPage.value);

    // Apply slice for current page
    const startIdx = (currentPage.value - 1) * itemsPerPage.value;
    topLevel = topLevel.slice(startIdx, startIdx + itemsPerPage.value);

    // Recursive function to build the tree list
    function addNode(cat: Category, depth: number) {
        const children = (childrenByParent[cat.id] || []).sort(
            (a, b) => (a.priority || 0) - (b.priority || 0),
        );
        const hasChildren = children.length > 0;
        const isExpanded = expandedCategories.value.has(cat.id);

        result.push({
            ...cat,
            _indent: depth,
            _isSearchMatched: false,
            _hasChildren: hasChildren,
            _isExpanded: isExpanded,
            _path: buildCategoryPath(cat),
        } as UICategory);

        // Only append children to the list if this node is expanded attached
        if (hasChildren && isExpanded) {
            children.forEach((child) => addNode(child, depth + 1));
        }
    }

    topLevel.forEach((tl) => addNode(tl, 0));

    return {
        items: result,
        totalPages,
    };
});

// Access items directly for template bound
const filteredCategories = computed(() => processedCategories.value.items);
const totalPages = computed(() => processedCategories.value.totalPages);

function nextPage() {
    if (currentPage.value < totalPages.value) currentPage.value++;
}

function prevPage() {
    if (currentPage.value > 1) currentPage.value--;
}

async function loadCategories() {
    categoriesWithParent.value = await fetchCategoriesWithParent();
}

function toggleExpand(id: number) {
    if (expandedCategories.value.has(id)) {
        expandedCategories.value.delete(id);
    } else {
        expandedCategories.value.add(id);
    }
}

async function handleDelete(id: number) {
    if (
        !confirm(
            '¿Estás seguro de eliminar esta categoría? Si tiene subcategorías, podrían quedar huérfanas o eliminarse según tu base de datos.',
        )
    )
        return;
    try {
        await deleteCategory(id);
        await loadCategories();
    } catch (e) {
        // Error handled in composable
    }
}

onMounted(async () => {
    await loadCategories();
});
</script>

<template>
    <Head title="Categorías" />
    <AppLayout>
        <div class="space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1
                        class="text-3xl font-bold text-gray-900 dark:text-white"
                    >
                        Categorías
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Gestiona las categorías de productos y sus jerarquías
                    </p>
                </div>
                <Link
                    href="/categories/create"
                    class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                    <Plus :size="20" />
                    Nueva Categoría
                </Link>
                <Link
                    href="/categories/import"
                    class="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                >
                    <Upload :size="20" />
                    Importar
                </Link>
            </div>

            <!-- Search -->
            <div
                class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card"
            >
                <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                        <label
                            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Buscar</label
                        >
                        <div class="relative">
                            <Search
                                class="absolute top-2.5 left-3 text-gray-400"
                                :size="18"
                            />
                            <input
                                v-model="searchQuery"
                                type="text"
                                placeholder="Nombre de categoría..."
                                class="w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-10 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-border dark:bg-muted dark:text-white"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Error -->
            <div
                v-if="error"
                class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10"
            >
                <p class="font-medium text-red-600 dark:text-red-400">
                    {{ error }}
                </p>
            </div>

            <!-- Table -->
            <div
                class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
            >
                <div class="overflow-x-auto">
                    <table
                        class="min-w-full divide-y divide-gray-200 dark:divide-border"
                    >
                        <thead class="bg-gray-50 dark:bg-background">
                            <tr>
                                <th
                                    class="w-[40%] px-6 py-3 text-left text-xs font-semibold tracking-wider text-gray-600 uppercase dark:text-gray-400"
                                >
                                    Categoría
                                </th>
                                <th
                                    class="w-[35%] px-6 py-3 text-left text-xs font-semibold tracking-wider text-gray-600 uppercase dark:text-gray-400"
                                >
                                    Atributos
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-semibold tracking-wider text-gray-600 uppercase dark:text-gray-400"
                                >
                                    Productos
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-semibold tracking-wider text-gray-600 uppercase dark:text-gray-400"
                                >
                                    Accion
                                </th>
                            </tr>
                        </thead>
                        <tbody
                            class="divide-y divide-gray-100 bg-white dark:divide-border/50 dark:bg-card"
                        >
                            <tr v-if="loading">
                                <td
                                    colspan="4"
                                    class="px-6 py-12 text-center text-gray-500"
                                >
                                    <div
                                        class="flex items-center justify-center gap-2"
                                    >
                                        <div
                                            class="h-5 w-5 animate-spin rounded-full border-b-2 border-indigo-600 dark:border-primary"
                                        ></div>
                                        Cargando estructura...
                                    </div>
                                </td>
                            </tr>
                            <tr v-else-if="filteredCategories.length === 0">
                                <td
                                    colspan="4"
                                    class="px-6 py-16 text-center text-gray-500 dark:text-gray-400"
                                >
                                    <div
                                        class="mx-auto mb-4 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-gray-50 dark:bg-muted/30"
                                    >
                                        <Folder
                                            class="text-gray-400"
                                            :size="24"
                                        />
                                    </div>
                                    <p
                                        class="text-base font-medium text-gray-900 dark:text-gray-200"
                                    >
                                        No se encontraron categorías
                                    </p>
                                    <p class="mt-1 text-sm">
                                        Intenta con otro término de búsqueda o
                                        crea una nueva.
                                    </p>
                                </td>
                            </tr>
                            <tr
                                v-for="cat in filteredCategories"
                                :key="cat.id"
                                class="transition duration-150 hover:bg-indigo-50/50 dark:hover:bg-muted/50"
                                :class="{
                                    'bg-gray-50/30 dark:bg-muted/10':
                                        cat._indent > 0 && !searchQuery,
                                }"
                            >
                                <td class="px-6 py-4">
                                    <div
                                        class="flex items-center"
                                        :style="{
                                            paddingLeft:
                                                (cat._indent || 0) * 2 + 'rem',
                                        }"
                                    >
                                        <div class="flex items-center gap-2">
                                            <!-- Expand/Collapse Toggle -->
                                            <button
                                                v-if="
                                                    cat._hasChildren &&
                                                    !searchQuery
                                                "
                                                @click="toggleExpand(cat.id)"
                                                class="rounded-md p-0.5 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-muted dark:hover:text-gray-200"
                                            >
                                                <ChevronDown
                                                    v-if="cat._isExpanded"
                                                    :size="18"
                                                />
                                                <ChevronRight
                                                    v-else
                                                    :size="18"
                                                />
                                            </button>
                                            <div
                                                v-else-if="!searchQuery"
                                                class="w-[22px]"
                                                aria-hidden="true"
                                            >
                                                <!-- Spacer for alignment -->
                                            </div>

                                            <!-- Icon logic -->
                                            <div
                                                v-if="
                                                    cat._indent === 0 &&
                                                    !searchQuery
                                                "
                                                class="rounded-md bg-indigo-50 p-1 text-indigo-500 dark:bg-indigo-900/20 dark:text-primary"
                                            >
                                                <Folder
                                                    :size="18"
                                                    class="stroke-[2.5px]"
                                                />
                                            </div>
                                            <div
                                                v-else-if="
                                                    cat._indent > 0 &&
                                                    !searchQuery
                                                "
                                                class="mr-0.5 text-gray-400"
                                            >
                                                <CornerDownRight :size="16" />
                                            </div>
                                            <div v-else class="text-gray-400">
                                                <Folder :size="18" />
                                            </div>

                                            <!-- Text -->
                                            <div>
                                                <Link
                                                    :href="`/categories/${cat.id}/edit`"
                                                    :class="[
                                                        'font-medium hover:underline',
                                                        cat._indent === 0 &&
                                                        !searchQuery
                                                            ? 'text-base font-bold text-gray-900 dark:text-gray-100'
                                                            : 'text-sm text-gray-700 dark:text-gray-300',
                                                    ]"
                                                >
                                                    {{ cat.name }}
                                                </Link>
                                                <p
                                                    class="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
                                                >
                                                    {{ cat._path }}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4">
                                    <div
                                        v-if="cat.default_attributes?.length"
                                        class="flex flex-wrap gap-1"
                                    >
                                        <span
                                            v-for="(
                                                attr, index
                                            ) in cat.default_attributes.slice(
                                                0,
                                                3,
                                            )"
                                            :key="`${cat.id}-attr-${index}`"
                                            class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                        >
                                            {{ attr.name }}
                                            <span v-if="attr.required">*</span>
                                        </span>
                                        <span
                                            v-if="
                                                cat.default_attributes.length >
                                                3
                                            "
                                            class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-muted dark:text-gray-300"
                                        >
                                            +{{
                                                cat.default_attributes.length -
                                                3
                                            }}
                                        </span>
                                    </div>
                                    <span
                                        v-else
                                        class="text-sm text-gray-400 dark:text-gray-500"
                                        >Sin atributos</span
                                    >
                                </td>
                                <td class="px-6 py-4 text-center">
                                    <span
                                        :class="[
                                            'inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium',
                                            cat.products_count
                                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                : 'bg-gray-100 text-gray-500 dark:bg-muted dark:text-gray-400',
                                        ]"
                                    >
                                        {{ cat.products_count || 0 }} items
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-right">
                                    <div
                                        class="flex items-center justify-end gap-1"
                                    >
                                        <button
                                            @click="handleDelete(cat.id)"
                                            class="rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                                            title="Eliminar Categoría"
                                        >
                                            <Trash2 :size="16" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Pagination Controls -->
                <div
                    v-if="totalPages > 1 && !searchQuery"
                    class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-border dark:bg-card"
                >
                    <div class="flex flex-1 justify-between sm:hidden">
                        <button
                            @click="prevPage"
                            :disabled="currentPage === 1"
                            :class="[
                                'relative inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium',
                                currentPage === 1
                                    ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-border dark:bg-muted dark:text-gray-500'
                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-background dark:text-gray-300 dark:hover:bg-muted',
                            ]"
                        >
                            Anterior
                        </button>
                        <button
                            @click="nextPage"
                            :disabled="currentPage === totalPages"
                            :class="[
                                'relative inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium',
                                currentPage === totalPages
                                    ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-border dark:bg-muted dark:text-gray-500'
                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-background dark:text-gray-300 dark:hover:bg-muted',
                            ]"
                        >
                            Siguiente
                        </button>
                    </div>
                    <div
                        class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between"
                    >
                        <div>
                            <p class="text-sm text-gray-700 dark:text-gray-300">
                                Mostrando página
                                <span class="font-medium">{{
                                    currentPage
                                }}</span>
                                de
                                <span class="font-medium">{{
                                    totalPages
                                }}</span>
                            </p>
                        </div>
                        <div>
                            <nav
                                class="relative z-0 inline-flex -space-x-px rounded-md shadow-sm"
                                aria-label="Pagination"
                            >
                                <button
                                    @click="prevPage"
                                    :disabled="currentPage === 1"
                                    :class="[
                                        'relative inline-flex items-center rounded-l-md border px-2 py-2 text-sm font-medium',
                                        currentPage === 1
                                            ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-border dark:bg-muted dark:text-gray-500'
                                            : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50 dark:border-border dark:bg-background dark:text-gray-300 dark:hover:bg-muted',
                                    ]"
                                >
                                    <span class="sr-only">Anterior</span>
                                    <ChevronLeft
                                        class="h-5 w-5"
                                        aria-hidden="true"
                                    />
                                </button>

                                <span
                                    class="relative inline-flex items-center border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 dark:border-border dark:bg-background dark:text-gray-300"
                                >
                                    {{ currentPage }}
                                </span>

                                <button
                                    @click="nextPage"
                                    :disabled="currentPage === totalPages"
                                    :class="[
                                        'relative inline-flex items-center rounded-r-md border px-2 py-2 text-sm font-medium',
                                        currentPage === totalPages
                                            ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-border dark:bg-muted dark:text-gray-500'
                                            : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50 dark:border-border dark:bg-background dark:text-gray-300 dark:hover:bg-muted',
                                    ]"
                                >
                                    <span class="sr-only">Siguiente</span>
                                    <ChevronRight
                                        class="h-5 w-5"
                                        aria-hidden="true"
                                    />
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
