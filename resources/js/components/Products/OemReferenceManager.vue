<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import apiClient from '@/services/api/client';

interface OemReference {
    id: number;
    oem_code: string;
    manufacturer: string | null;
}

const props = withDefaults(
    defineProps<{
        productId?: number;
        mode?: 'live' | 'draft';
        modelValue?: OemReference[];
    }>(),
    {
        mode: 'live',
        modelValue: () => [],
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: OemReference[]];
}>();

interface BrandOption {
    id: number;
    name: string;
}

const references = ref<OemReference[]>([]);
const loading = ref(false);
const adding = ref(false);
const loadingBrands = ref(false);
const error = ref('');
const brands = ref<BrandOption[]>([]);
const nextDraftId = ref(-1);

// Form
const newCode = ref('');
const newManufacturer = ref<string | null>(null);

const isDraftMode = computed(() => props.mode === 'draft');
const displayedReferences = computed(() =>
    isDraftMode.value ? props.modelValue : references.value,
);

const emitDraftReferences = (value: OemReference[]) => {
    emit('update:modelValue', value);
};

const brandSearchOptions = computed(() =>
    brands.value.map((brand) => ({
        value: brand.name,
        label: brand.name,
    })),
);

const fetchBrands = async () => {
    loadingBrands.value = true;
    try {
        const response = await apiClient.get('/brands/all');
        brands.value = response.data.data ?? response.data ?? [];
    } catch (e) {
        console.error('Error fetching brands', e);
        brands.value = [];
    } finally {
        loadingBrands.value = false;
    }
};

const fetchReferences = async () => {
    if (isDraftMode.value || !props.productId) return;

    loading.value = true;
    try {
        const res = await apiClient.get(
            `/products/${props.productId}/oem-references`,
        );
        references.value = res.data.data;
    } catch (e) {
        console.error('Error fetching references', e);
    } finally {
        loading.value = false;
    }
};

const addReference = async () => {
    if (!newCode.value) return;

    adding.value = true;
    error.value = '';
    try {
        if (isDraftMode.value) {
            const code = newCode.value.trim();
            if (
                displayedReferences.value.some(
                    (reference) =>
                        reference.oem_code.toLowerCase() === code.toLowerCase(),
                )
            ) {
                error.value = 'Este codigo ya esta agregado';
                return;
            }

            emitDraftReferences([
                ...displayedReferences.value,
                {
                    id: nextDraftId.value--,
                    oem_code: code,
                    manufacturer: newManufacturer.value || null,
                },
            ]);
            newCode.value = '';
            newManufacturer.value = null;
            return;
        }

        await apiClient.post(`/products/${props.productId}/oem-references`, {
            oem_code: newCode.value,
            manufacturer: newManufacturer.value || null,
        });
        // Add to list (response usually wraps in data)
        // Check if response has the new object
        // Based on controller, it returns JSON with message.
        // We should fetch again or manually push if we knew the ID.
        // Controller returns 201 created but maybe not the object?
        // checking controller: "message": "Referencia OEM agregada". It DOES NOT return the object!
        // So we MUST fetch again.
        await fetchReferences();

        newCode.value = '';
        newManufacturer.value = null;
    } catch (e: any) {
        error.value =
            e.response?.data?.message || 'Error al agregar referencia';
    } finally {
        adding.value = false;
    }
};

const removeReference = async (id: number) => {
    if (isDraftMode.value) {
        emitDraftReferences(
            displayedReferences.value.filter(
                (reference) => reference.id !== id,
            ),
        );
        return;
    }

    if (!confirm('¿Eliminar esta referencia?')) return;

    try {
        await apiClient.delete(
            `/products/${props.productId}/oem-references/${id}`,
        );
        references.value = references.value.filter((r) => r.id !== id);
    } catch (e) {
        console.error('Error removing reference', e);
    }
};

onMounted(() => {
    if (!isDraftMode.value) {
        fetchReferences();
    }
    fetchBrands();
});
</script>

<template>
    <div
        class="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm dark:border-border dark:bg-card"
    >
        <h2
            class="text-sm font-semibold tracking-wider text-gray-500 uppercase"
        >
            Códigos alternos
        </h2>

        <!-- Add Form -->
        <div class="grid items-end gap-3 sm:grid-cols-12">
            <div class="sm:col-span-5">
                <label
                    class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                    >Código <span class="text-red-500">*</span></label
                >
                <input
                    v-model="newCode"
                    type="text"
                    placeholder="Ej: 123-456-ABC"
                    class="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm dark:border-border dark:bg-muted dark:text-white"
                    @keyup.enter="addReference"
                />
            </div>
            <div class="sm:col-span-4">
                <label
                    class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                    >Marca</label
                >
                <SearchableSelect
                    :options="brandSearchOptions"
                    :model-value="newManufacturer"
                    @update:model-value="
                        (value) => (newManufacturer = value as string | null)
                    "
                    :loading="loadingBrands"
                    placeholder="Sin marca"
                    search-placeholder="Buscar marca..."
                    :clearable="true"
                />
            </div>
            <div class="sm:col-span-3">
                <button
                    @click="addReference"
                    :disabled="!newCode || adding"
                    class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                    {{ adding ? '...' : 'Agregar' }}
                </button>
            </div>
        </div>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <!-- List -->
        <div
            class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-background"
        >
            <div
                v-if="loading && displayedReferences.length === 0"
                class="px-4 py-6 text-center text-sm text-gray-500"
            >
                Cargando referencias...
            </div>

            <div
                v-else-if="displayedReferences.length === 0"
                class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
            >
                No hay códigos alternos vinculados.
            </div>

            <table v-else class="w-full text-left text-sm">
                <thead class="bg-gray-50 dark:bg-card">
                    <tr>
                        <th
                            class="px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
                        >
                            Código
                        </th>
                        <th
                            class="px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
                        >
                            Marca
                        </th>
                        <th class="w-12 px-4 py-2"></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-border/50">
                    <tr v-for="ref in displayedReferences" :key="ref.id">
                        <td
                            class="px-4 py-2 font-mono text-gray-900 dark:text-white"
                        >
                            {{ ref.oem_code }}
                        </td>
                        <td class="px-4 py-2 text-gray-700 dark:text-gray-300">
                            {{ ref.manufacturer || '-' }}
                        </td>
                        <td class="px-4 py-2 text-right">
                            <button
                                @click="removeReference(ref.id)"
                                class="text-xs font-semibold text-red-500 hover:text-red-700"
                                title="Eliminar referencia"
                            >
                                Eliminar
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
