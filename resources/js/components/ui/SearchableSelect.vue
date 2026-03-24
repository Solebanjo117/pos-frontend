<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

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
}>(), {
    placeholder: '-- Selecciona --',
    disabled: false,
    loading: false,
    loadingText: 'Cargando...',
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

const selectedLabel = computed(() => {
    if (props.modelValue === null || props.modelValue === undefined) return ''
    const opt = props.options.find(o => o.value === props.modelValue)
    return opt?.label ?? ''
})

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const filteredOptions = computed(() => {
    if (!searchQuery.value.trim()) return props.options
    const escaped = escapeRegExp(searchQuery.value.trim())
    // Match start of any word (\b) so "CS" matches "CS35" but not "Tucson"
    const re = new RegExp('\\b' + escaped, 'i')
    return props.options.filter(o =>
        re.test(o.label) ||
        (o.sublabel && re.test(o.sublabel))
    )
})

const open = () => {
    if (props.disabled || props.loading) return
    isOpen.value = true
    searchQuery.value = ''
    highlightedIndex.value = -1
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
    if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
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
            class="w-full h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm dark:border-border dark:bg-muted dark:text-white disabled:opacity-50 flex items-center justify-between gap-2 transition-colors hover:border-gray-400 dark:hover:border-gray-500"
        >
            <span class="truncate block" :class="selectedLabel ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'">
                {{ loading ? loadingText : (selectedLabel || placeholder) }}
            </span>
            <svg class="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
        </button>

        <!-- Dropdown -->
        <Transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
        >
            <div v-if="isOpen"
                class="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-border dark:bg-card overflow-hidden"
            >
                <!-- Search input -->
                <div class="p-2 border-b border-gray-100 dark:border-border">
                    <div class="relative">
                        <svg class="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            ref="inputRef"
                            v-model="searchQuery"
                            @keydown="onKeydown"
                            type="text"
                            class="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-sm dark:border-border dark:bg-muted dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-primary"
                            placeholder="Buscar..."
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
                        Sin resultados para "{{ searchQuery }}"
                    </li>
                </ul>
            </div>
        </Transition>
    </div>
</template>
