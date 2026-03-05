<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

interface PaginationData {
    current_page: number
    last_page: number
    per_page: number
    total: number
}

interface Props {
    pagination: PaginationData
    loading?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
    (e: 'page-change', page: number): void
}>()

// Generate page numbers to display
const pageNumbers = computed(() => {
    const { current_page, last_page } = props.pagination
    const pages: (number | string)[] = []
    
    // Always show first page
    pages.push(1)
    
    // Calculate range around current page
    const rangeSize = 2
    const rangeStart = Math.max(2, current_page - rangeSize)
    const rangeEnd = Math.min(last_page - 1, current_page + rangeSize)
    
    // Add ellipsis before range if needed
    if (rangeStart > 2) {
        pages.push('...')
    }
    
    // Add range
    for (let i = rangeStart; i <= rangeEnd; i++) {
        pages.push(i)
    }
    
    // Add ellipsis after range if needed
    if (rangeEnd < last_page - 1) {
        pages.push('...')
    }
    
    // Always show last page if there is more than one page
    if (last_page > 1) {
        pages.push(last_page)
    }
    
    return pages
})

const canGoPrevious = computed(() => props.pagination.current_page > 1)
const canGoNext = computed(() => props.pagination.current_page < props.pagination.last_page)

function goToPage(page: number | string) {
    if (typeof page === 'string' || props.loading) return
    if (page >= 1 && page <= props.pagination.last_page) {
        emit('page-change', page)
    }
}

function previousPage() {
    if (canGoPrevious.value && !props.loading) {
        emit('page-change', props.pagination.current_page - 1)
    }
}

function nextPage() {
    if (canGoNext.value && !props.loading) {
        emit('page-change', props.pagination.current_page + 1)
    }
}

const startItem = computed(() => {
    return (props.pagination.current_page - 1) * props.pagination.per_page + 1
})

const endItem = computed(() => {
    return Math.min(props.pagination.current_page * props.pagination.per_page, props.pagination.total)
})
</script>

<template>
    <div class="px-6 py-3 border-t border-gray-200 dark:border-border flex flex-col sm:flex-row items-center justify-between gap-4">
        <!-- Info Text -->
        <p class="text-sm text-gray-500 dark:text-gray-400">
            Mostrando <span class="font-medium">{{ startItem }}</span> a 
            <span class="font-medium">{{ endItem }}</span> de 
            <span class="font-medium">{{ pagination.total }}</span> resultados
        </p>
        
        <!-- Navigation -->
        <nav class="flex items-center gap-1" aria-label="Pagination">
            <!-- Previous Button -->
            <button
                @click="previousPage"
                :disabled="!canGoPrevious || loading"
                class="inline-flex items-center px-2 py-2 border border-gray-300 dark:border-border text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                :class="{ 'cursor-not-allowed': !canGoPrevious || loading }"
            >
                <ChevronLeft :size="16" />
                <span class="ml-1 hidden sm:inline">Anterior</span>
            </button>
            
            <!-- Page Numbers -->
            <template v-for="(page, idx) in pageNumbers" :key="idx">
                <button
                    v-if="typeof page === 'number'"
                    @click="goToPage(page)"
                    :disabled="loading"
                    class="inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md transition"
                    :class="[
                        page === pagination.current_page
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-primary dark:text-indigo-400'
                            : 'border-gray-300 dark:border-border text-gray-700 dark:text-gray-300 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-muted/50',
                        { 'cursor-not-allowed opacity-50': loading }
                    ]"
                >
                    {{ page }}
                </button>
                <span
                    v-else
                    class="inline-flex items-center px-2 py-2 text-sm text-gray-500 dark:text-gray-400"
                >
                    {{ page }}
                </span>
            </template>
            
            <!-- Next Button -->
            <button
                @click="nextPage"
                :disabled="!canGoNext || loading"
                class="inline-flex items-center px-2 py-2 border border-gray-300 dark:border-border text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                :class="{ 'cursor-not-allowed': !canGoNext || loading }"
            >
                <span class="mr-1 hidden sm:inline">Siguiente</span>
                <ChevronRight :size="16" />
            </button>
        </nav>
    </div>
</template>
