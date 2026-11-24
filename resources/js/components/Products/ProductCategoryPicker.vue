<script setup lang="ts">
import { Plus, Star, X } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import apiClient from '@/services/api/client';

/**
 * Categorías del producto en una sola lista. La principal (★) va primero: de ella salen la
 * fórmula de precio, el ITBM y los atributos. Las demás se muestran igual en la tabla y se
 * pueden hacer principales con un clic.
 */
interface CategoryOption {
    id: number;
    name: string;
}

const props = withDefaults(
    defineProps<{
        categories: CategoryOption[];
        primaryId: number | null;
        extraIds: number[];
        loading?: boolean;
        allowCreate?: boolean;
    }>(),
    { loading: false, allowCreate: false },
);

const emit = defineEmits<{
    'update:primaryId': [value: number | null];
    'update:extraIds': [value: number[]];
    created: [category: CategoryOption];
}>();

// Crear una categoría desde el producto: queda agregada y se puede hacer principal con ★.
const creating = ref(false);
const newName = ref('');
const newParentId = ref<number | null>(null);
const saving = ref(false);
const createError = ref<string | null>(null);

const openCreate = () => {
    creating.value = true;
    newName.value = '';
    newParentId.value = null;
    createError.value = null;
};

const parentOptions = computed(() =>
    props.categories.map((c) => ({ value: c.id, label: c.name })),
);

const pending = ref<number | null>(null);

const byId = computed(
    () => new Map(props.categories.map((c) => [c.id, c] as const)),
);

const selected = computed(() => {
    const rows: Array<CategoryOption & { primary: boolean }> = [];
    const primary =
        props.primaryId != null ? byId.value.get(props.primaryId) : undefined;
    if (primary) rows.push({ ...primary, primary: true });
    const extras = props.extraIds
        .filter((id) => id !== props.primaryId)
        .map((id) => byId.value.get(id))
        .filter((c): c is CategoryOption => Boolean(c))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    for (const c of extras) rows.push({ ...c, primary: false });
    return rows;
});

const options = computed(() =>
    props.categories
        .filter(
            (c) => c.id !== props.primaryId && !props.extraIds.includes(c.id),
        )
        .map((c) => ({ value: c.id, label: c.name })),
);

const toId = (value: unknown): number | null => {
    const id = Number(value);
    return Number.isFinite(id) && id > 0 ? id : null;
};

const add = (value: unknown) => {
    const id = toId(value);
    pending.value = null;
    if (!id || id === props.primaryId || props.extraIds.includes(id)) return;
    if (props.primaryId == null) {
        emit('update:primaryId', id);
    } else {
        emit('update:extraIds', [...props.extraIds, id]);
    }
};

const makePrimary = (id: number) => {
    if (id === props.primaryId) return;
    const extras = props.extraIds.filter((extra) => extra !== id);
    if (props.primaryId != null) extras.push(props.primaryId);
    emit('update:extraIds', extras);
    emit('update:primaryId', id);
};

const remove = (id: number) => {
    if (id !== props.primaryId) {
        emit(
            'update:extraIds',
            props.extraIds.filter((extra) => extra !== id),
        );
        return;
    }
    // Si se quita la principal, la siguiente (por nombre) pasa a ser principal.
    const next = selected.value.find((c) => !c.primary);
    if (next) {
        emit(
            'update:extraIds',
            props.extraIds.filter((extra) => extra !== next.id),
        );
    }
    emit('update:primaryId', next?.id ?? null);
};

const saveNew = async () => {
    const name = newName.value.trim();
    if (!name || saving.value) return;
    saving.value = true;
    createError.value = null;
    try {
        const { data } = await apiClient.post('/categories', {
            name,
            parent_id: newParentId.value,
        });
        const created = (data?.data ?? data) as CategoryOption;
        emit('created', created);
        add(created.id);
        creating.value = false;
    } catch (e: any) {
        createError.value =
            e?.response?.data?.message || 'No se pudo crear la categoría';
    } finally {
        saving.value = false;
    }
};

defineExpose({ add });
</script>

<template>
    <div class="space-y-2" data-test="product-category-picker">
        <div class="flex items-center justify-between">
            <label
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >Categorías</label
            >
            <button
                v-if="allowCreate"
                type="button"
                data-test="category-create"
                class="flex items-center gap-0.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
                @click="openCreate"
            >
                <Plus class="h-3 w-3" /> Crear
            </button>
        </div>

        <div
            v-if="creating"
            data-test="category-create-form"
            class="space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10"
        >
            <input
                v-model="newName"
                type="text"
                data-test="category-create-name"
                placeholder="Nombre de la nueva categoría (ej: Filtros)"
                class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-border dark:bg-muted dark:text-white"
                @keydown.enter.prevent="saveNew"
            />
            <SearchableSelect
                :options="parentOptions"
                :model-value="newParentId"
                placeholder="Categoría padre (opcional)"
                :clearable="true"
                @update:model-value="(v) => (newParentId = toId(v))"
            />
            <p v-if="createError" class="text-xs text-red-600">
                {{ createError }}
            </p>
            <div class="flex justify-end gap-2">
                <button
                    type="button"
                    class="rounded-md px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    @click="creating = false"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    data-test="category-create-save"
                    :disabled="!newName.trim() || saving"
                    class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                    @click="saveNew"
                >
                    {{ saving ? 'Creando…' : 'Crear y agregar' }}
                </button>
            </div>
        </div>

        <SearchableSelect
            :options="options"
            :model-value="pending"
            placeholder="-- Agregar categoría --"
            :loading="loading"
            :clearable="true"
            @update:model-value="add"
        />

        <ul
            v-if="selected.length"
            class="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-border dark:border-border"
        >
            <li
                v-for="category in selected"
                :key="category.id"
                data-test="category-row"
                class="flex items-center gap-2 px-3 py-2 text-sm"
                :class="
                    category.primary
                        ? 'bg-amber-50/60 dark:bg-amber-900/10'
                        : ''
                "
            >
                <button
                    type="button"
                    data-test="category-star"
                    class="rounded p-0.5"
                    :class="
                        category.primary
                            ? 'cursor-default text-amber-500'
                            : 'text-gray-300 hover:text-amber-400 dark:text-gray-600'
                    "
                    :aria-label="
                        category.primary
                            ? `${category.name} es la principal`
                            : `Hacer principal ${category.name}`
                    "
                    :title="category.primary ? 'Principal' : 'Hacer principal'"
                    @click="makePrimary(category.id)"
                >
                    <Star
                        class="h-4 w-4"
                        :fill="category.primary ? 'currentColor' : 'none'"
                    />
                </button>
                <span
                    class="flex-1 truncate"
                    :class="
                        category.primary
                            ? 'font-semibold text-gray-900 dark:text-white'
                            : 'text-gray-700 dark:text-gray-300'
                    "
                    >{{ category.name }}</span
                >
                <span
                    v-if="category.primary"
                    class="hidden text-[11px] text-amber-700 sm:inline dark:text-amber-300"
                    >Principal · define precio e ITBM</span
                >
                <button
                    type="button"
                    data-test="category-remove"
                    class="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"
                    :aria-label="`Quitar ${category.name}`"
                    @click="remove(category.id)"
                >
                    <X class="h-3.5 w-3.5" />
                </button>
            </li>
        </ul>
        <p v-else class="text-xs text-gray-400">
            Sin categorías. La primera que agregues será la principal.
        </p>
    </div>
</template>
