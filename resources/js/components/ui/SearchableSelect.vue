<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, getCurrentInstance } from 'vue'
import { useElementBounding, useEventListener } from '@vueuse/core'

export interface SelectOption {
    value: number | string | null
    label: string
    sublabel?: string
}

const props = withDefaults(defineProps<{
    options: SelectOption[]
    modelValue: number | string | null
    placeholder?: string
    disabled?: boolean
    loading?: boolean
    loadingText?: string
    searchPlaceholder?: string
    emptyResultsText?: string
    clearable?: boolean
    ariaLabel?: string
}>(), {
    placeholder: '-- Selecciona --',
    disabled: false,
    loading: false,
    loadingText: 'Cargando...',
    searchPlaceholder: 'Buscar...',
    emptyResultsText: '',
    clearable: false,
    ariaLabel: 'Selector con búsqueda',
})

const emit = defineEmits<{
    'update:modelValue': [value: number | string | null]
}>()

const isOpen = ref(false)
const searchQuery = ref('')
const highlightedIndex = ref(-1)
const containerRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const instanceUid = getCurrentInstance()?.uid ?? 0
const dropdownId = `searchable-select-listbox-${instanceUid}`
const searchInputId = `searchable-select-search-${instanceUid}`

// Detect if this component is inside a Radix Dialog (focus trap)
const insideDialog = ref(false)
onMounted(() => {
    insideDialog.value = !!containerRef.value?.closest('[role="dialog"]')
})

const { bottom, left, width, update: updateBounds } = useElementBounding(containerRef)

const dropdownStyle = computed(() => {
    if (insideDialog.value) {
        // When inside a dialog, don't teleport — use absolute positioning
        return { width: `${width.value}px` }
    }
    return {
        top: `${bottom.value + 4}px`,
        left: `${left.value}px`,
        width: `${width.value}px`,
    }
})

useEventListener('scroll', () => {
    if (isOpen.value) updateBounds()
}, { capture: true, passive: true })

useEventListener('resize', () => {
    if (isOpen.value) updateBounds()
}, { passive: true })

const selectedLabel = computed(() => {
    if (props.modelValue === null || props.modelValue === undefined) return ''
    const opt = props.options.find(o => o.value === props.modelValue)
    return opt?.label ?? ''
})

const hasSelection = computed(() => props.modelValue !== null && props.modelValue !== undefined)
const showClearButton = computed(() => props.clearable && hasSelection.value && !props.disabled && !props.loading)

const emptyMessage = computed(() => {
    if (props.emptyResultsText) return props.emptyResultsText
    const query = searchQuery.value.trim()
    if (!query) return 'Sin opciones disponibles'
    return `Sin resultados para "${query}"`
})

const normalizeSearchText = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

const filteredOptions = computed(() => {
    if (!searchQuery.value.trim()) return props.options
    const tokens = normalizeSearchText(searchQuery.value).split(' ').filter(Boolean)

    return props.options.filter(o => {
        const searchable = normalizeSearchText(`${o.label} ${o.sublabel ?? ''}`)

        return tokens.every(token => searchable.includes(token))
    })
})

const open = () => {
    if (props.disabled || props.loading) return
    isOpen.value = true
    searchQuery.value = ''
    highlightedIndex.value = -1
    updateBounds()
    nextTick(() => inputRef.value?.focus())
}

const close = () => {
    isOpen.value = false
    searchQuery.value = ''
}

const select = (opt: SelectOption) => {
    emit('update:modelValue', opt.value)
    close()
}

const clearSelection = () => {
    emit('update:modelValue', null)
    close()
}

const onKeydown = (e: KeyboardEvent) => {
    if (!isOpen.value) return

    if (e.key === 'ArrowDown') {
        e.preventDefault()
        highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredOptions.value.length - 1)
        scrollToHighlighted()
    } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
        scrollToHighlighted()
    } else if (e.key === 'Enter') {
        e.preventDefault()
        if (highlightedIndex.value >= 0 && highlightedIndex.value < filteredOptions.value.length) {
            select(filteredOptions.value[highlightedIndex.value])
        }
    } else if (e.key === 'Escape') {
        close()
    }
}

const scrollToHighlighted = () => {
    nextTick(() => {
        const el = listRef.value?.children[highlightedIndex.value] as HTMLElement
        el?.scrollIntoView({ block: 'nearest' })
    })
}

// Close on outside click
const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as Node
    if (
        (containerRef.value && !containerRef.value.contains(target)) &&
        (!dropdownRef.value || !dropdownRef.value.contains(target))
    ) {
        close()
    }
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside))

// Reset highlight when search changes
watch(searchQuery, () => { highlightedIndex.value = 0 })
</script>

<template>
    <div ref="containerRef" class="relative">
        <!-- Trigger button -->
        <button
            type="button"
            @click="open"
            :disabled="disabled || loading"
            :aria-label="ariaLabel"
            aria-haspopup="listbox"
            :aria-expanded="isOpen"
            :aria-controls="dropdownId"
            class="w-full h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 pr-14 text-left text-sm dark:border-border dark:bg-muted dark:text-white disabled:opacity-50 flex items-center justify-between gap-2 transition-colors hover:border-gray-400 dark:hover:border-gray-500"
        >
            <span class="truncate block" :class="selectedLabel ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'">
                {{ loading ? loadingText : (selectedLabel || placeholder) }}
            </span>
        </button>

        <button
            v-if="showClearButton"
            type="button"
            class="absolute right-8 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-muted dark:hover:text-gray-200"
            @click.stop="clearSelection"
            aria-label="Limpiar selección"
        >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>

        <svg class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>

        <!-- Dropdown -->
        <Teleport to="body" :disabled="insideDialog">
            <Transition
                enter-active-class="transition duration-100 ease-out"
                enter-from-class="opacity-0 scale-95"
                enter-to-class="opacity-100 scale-100"
                leave-active-class="transition duration-75 ease-in"
                leave-from-class="opacity-100 scale-100"
                leave-to-class="opacity-0 scale-95"
            >
                <div v-if="isOpen"
                    ref="dropdownRef"
                    :id="dropdownId"
                    role="listbox"
                    :aria-label="ariaLabel"
                    :style="dropdownStyle"
                    @pointerdown.stop
                    @mousedown.stop
                    :class="insideDialog
                        ? 'absolute left-0 top-full mt-1 z-[9999] rounded-lg border border-gray-200 bg-white shadow-lg dark:border-border dark:bg-card overflow-hidden'
                        : 'fixed z-[9999] pointer-events-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-border dark:bg-card overflow-hidden'
                    "
                >
                <!-- Search input -->
                <div class="p-2 border-b border-gray-100 dark:border-border">
                    <div class="relative">
                        <svg class="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            ref="inputRef"
                            :id="searchInputId"
                            v-model="searchQuery"
                            @keydown="onKeydown"
                            type="text"
                            class="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-sm dark:border-border dark:bg-muted dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-primary"
                            :placeholder="searchPlaceholder"
                            :aria-controls="dropdownId"
                            aria-autocomplete="list"
                            autocomplete="off"
                        />
                    </div>
                </div>

                <!-- Options list -->
                <ul ref="listRef" class="max-h-48 overflow-y-auto py-1">
                    <li
                        v-for="(opt, idx) in filteredOptions"
                        :key="String(opt.value)"
                        @click="select(opt)"
                        @mouseenter="highlightedIndex = idx"
                        role="option"
                        :aria-selected="opt.value === modelValue"
                        class="cursor-pointer px-3 py-2 text-sm transition-colors"
                        :class="[
                            idx === highlightedIndex ? 'bg-blue-50 text-blue-700 dark:bg-primary/10 dark:text-primary' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted',
                            opt.value === modelValue ? 'font-semibold' : ''
                        ]"
                    >
                        <span>{{ opt.label }}</span>
                        <span v-if="opt.sublabel" class="ml-2 text-xs text-gray-400">{{ opt.sublabel }}</span>
                        <svg v-if="opt.value === modelValue" class="inline ml-1 h-3.5 w-3.5 text-blue-500 dark:text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </li>
                    <li v-if="filteredOptions.length === 0" class="px-3 py-4 text-center text-sm text-gray-400">
                        {{ emptyMessage }}
                    </li>
                </ul>
            </div>
            </Transition>
        </Teleport>
    </div>
</template>
