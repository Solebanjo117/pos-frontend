<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Head } from '@inertiajs/vue3';
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import { usePricingFormulas } from '@/composables/usePricingFormulas';
import type { PricingFormula } from '@/types/pricing-formula';
import {
    Calculator,
    Plus,
    Trash2,
    Edit,
    Save,
    X,
    Search,
    Check,
    AlertCircle,
} from 'lucide-vue-next';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Configuración', href: '/settings/store' },
    { title: 'Fórmulas de Precio', href: '/settings/pricing-formulas' },
];

const {
    formulas,
    loading,
    error,
    fetchFormulas,
    createFormula,
    updateFormula,
    deleteFormula,
    previewFormula,
} = usePricingFormulas();

const showModal = ref(false);
const modalMode = ref<'create' | 'edit'>('create');
const isSaving = ref(false);
const formError = ref('');
const search = ref('');

const form = ref<Partial<PricingFormula>>({
    name: '',
    formula: '',
    description: '',
    is_active: true,
    sort_order: 0,
});

// Validation PREVIEW
const previewCost = ref(100);
const previewResult = ref<number | null>(null);
const previewError = ref('');

onMounted(async () => {
    await fetchFormulas();
});

const openCreateModal = () => {
    modalMode.value = 'create';
    form.value = {
        name: '',
        formula: '',
        description: '',
        is_active: true,
        sort_order: 0,
    };
    formError.value = '';
    previewResult.value = null;
    previewError.value = '';
    showModal.value = true;
};

const openEditModal = (formula: PricingFormula) => {
    modalMode.value = 'edit';
    form.value = { ...formula };
    formError.value = '';
    previewResult.value = null;
    previewError.value = '';
    showModal.value = true;
};

const closeModal = () => {
    showModal.value = false;
};

const testFormula = async () => {
    if (!form.value.formula) return;
    previewError.value = '';
    previewResult.value = null;
    try {
        const res = await previewFormula(form.value.formula, previewCost.value);
        if (res.valid) {
            previewResult.value = res.result;
        } else {
            previewError.value = res.error || 'Fórmula inválida';
        }
    } catch (e: any) {
        previewError.value = e.message;
    }
};

const save = async () => {
    formError.value = '';
    isSaving.value = true;
    try {
        if (modalMode.value === 'create') {
            await createFormula(form.value);
        } else {
            await updateFormula(form.value.id!, form.value);
        }
        closeModal();
    } catch (e: any) {
        formError.value = e.message;
    } finally {
        isSaving.value = false;
    }
};

const confirmDelete = async (formula: PricingFormula) => {
    if (formula.is_preset) return;
    if (confirm(`¿Eliminar la fórmula "${formula.name}"?`)) {
        try {
            await deleteFormula(formula.id);
        } catch (e: any) {
            alert(e.message);
        }
    }
};

const toggleActive = async (formula: PricingFormula) => {
    try {
        await updateFormula(formula.id, { is_active: !formula.is_active });
    } catch (e: any) {
        alert(e.message);
    }
};
</script>

<template>
    <Head title="Fórmulas de Precio - Configuración" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div
                        class="rounded-xl border border-primary/20 bg-primary/10 p-2"
                    >
                        <Calculator :size="24" class="text-primary" />
                    </div>
                    <div>
                        <h1
                            class="text-2xl font-bold text-gray-900 dark:text-white"
                        >
                            Fórmulas de Precio
                        </h1>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                            Administra las fórmulas dinámicas para calcular
                            precios de venta
                        </p>
                    </div>
                </div>
                <button
                    @click="openCreateModal"
                    class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-black shadow-sm transition hover:bg-primary/90"
                >
                    <Plus :size="18" />
                    Nueva Fórmula
                </button>
            </div>

            <!-- Pre-defined Notice -->
            <div
                class="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
            >
                <AlertCircle class="shrink-0" :size="20" />
                <div>
                    <p class="mb-1 font-medium">Sobre las fórmulas de precio</p>
                    <p>
                        Las fórmulas se evalúan dinámicamente. Puedes usar
                        variables como <code>costo</code> y <code>ITBM</code>, y
                        funciones como <code>ROUND</code>, <code>ROUNDUP</code>,
                        <code>FLOOR</code> y <code>CEIL</code> para calcular el
                        precio final.
                    </p>
                </div>
            </div>

            <div
                v-if="error"
                class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30"
            >
                <p class="text-red-600 dark:text-red-400">{{ error }}</p>
            </div>

            <!-- Formulas List -->
            <div
                class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card"
            >
                <div
                    v-if="loading && formulas.length === 0"
                    class="p-8 text-center text-gray-500"
                >
                    Cargando fórmulas...
                </div>

                <table
                    v-else
                    class="min-w-full divide-y divide-gray-200 text-sm dark:divide-border"
                >
                    <thead class="bg-gray-50 dark:bg-background">
                        <tr>
                            <th
                                class="px-6 py-3 text-left font-medium text-gray-500 uppercase"
                            >
                                Nombre
                            </th>
                            <th
                                class="px-6 py-3 text-left font-medium text-gray-500 uppercase"
                            >
                                Fórmula
                            </th>
                            <th
                                class="px-6 py-3 text-center font-medium text-gray-500 uppercase"
                            >
                                Tipo
                            </th>
                            <th
                                class="px-6 py-3 text-center font-medium text-gray-500 uppercase"
                            >
                                Estado
                            </th>
                            <th
                                class="px-6 py-3 text-right font-medium text-gray-500 uppercase"
                            >
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-border">
                        <tr
                            v-for="formula in formulas"
                            :key="formula.id"
                            :class="
                                !formula.is_active
                                    ? 'bg-gray-50/50 opacity-60 dark:bg-muted/10'
                                    : ''
                            "
                        >
                            <td class="px-6 py-4">
                                <p
                                    class="font-medium text-gray-900 dark:text-white"
                                >
                                    {{ formula.name }}
                                </p>
                                <p
                                    v-if="formula.description"
                                    class="mt-0.5 text-xs text-gray-500"
                                >
                                    {{ formula.description }}
                                </p>
                            </td>
                            <td
                                class="px-6 py-4 font-mono text-gray-700 dark:text-gray-300"
                            >
                                {{ formula.formula }}
                            </td>
                            <td class="px-6 py-4 text-center">
                                <span
                                    v-if="formula.is_preset"
                                    class="inline-flex rounded bg-gray-100 px-2 py-1 text-[10px] font-semibold tracking-widest text-gray-600 uppercase dark:bg-muted dark:text-gray-400"
                                    >Predefinida</span
                                >
                                <span
                                    v-else
                                    class="inline-flex rounded bg-indigo-50 px-2 py-1 text-[10px] font-semibold tracking-widest text-indigo-600 uppercase dark:bg-indigo-900/30 dark:text-indigo-400"
                                    >Personalizada</span
                                >
                            </td>
                            <td class="px-6 py-4 text-center">
                                <label
                                    class="relative inline-flex cursor-pointer items-center"
                                >
                                    <input
                                        type="checkbox"
                                        :checked="formula.is_active"
                                        @change="toggleActive(formula)"
                                        class="peer sr-only"
                                    />
                                    <div
                                        class="peer h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-primary after:absolute after:start-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-muted"
                                    ></div>
                                </label>
                            </td>
                            <td
                                class="space-x-2 px-6 py-4 text-right whitespace-nowrap"
                            >
                                <button
                                    @click="openEditModal(formula)"
                                    class="p-1.5 text-gray-400 transition hover:text-indigo-600 dark:hover:text-primary"
                                    title="Editar"
                                >
                                    <Edit :size="18" />
                                </button>
                                <button
                                    v-if="!formula.is_preset"
                                    @click="confirmDelete(formula)"
                                    class="p-1.5 text-gray-400 transition hover:text-red-600"
                                    title="Eliminar"
                                >
                                    <Trash2 :size="18" />
                                </button>
                                <span
                                    v-else
                                    class="inline-block w-[30px]"
                                ></span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- FORM MODAL -->
        <Teleport to="body">
            <div
                v-if="showModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            >
                <div
                    class="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-card"
                >
                    <div
                        class="flex items-center justify-between border-b border-gray-200 p-4 dark:border-border"
                    >
                        <h2
                            class="text-lg font-bold text-gray-900 dark:text-white"
                        >
                            {{
                                modalMode === 'create'
                                    ? 'Nueva Fórmula'
                                    : 'Editar Fórmula'
                            }}
                        </h2>
                        <button
                            @click="closeModal"
                            class="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X :size="20" />
                        </button>
                    </div>

                    <div class="space-y-4 overflow-y-auto p-4">
                        <div
                            v-if="formError"
                            class="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400"
                        >
                            {{ formError }}
                        </div>

                        <div
                            v-if="form.is_preset"
                            class="mb-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                        >
                            Modo solo lectura parcial. Las fórmulas predefinidas
                            no pueden cambiar su nombre o expresión matemática.
                        </div>

                        <div>
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >Nombre Descriptivo *</label
                            >
                            <input
                                v-model="form.name"
                                type="text"
                                :disabled="form.is_preset"
                                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-primary disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white"
                                placeholder="Ej: Costo x 2.5"
                            />
                        </div>

                        <div>
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >Fórmula *</label
                            >
                            <input
                                v-model="form.formula"
                                type="text"
                                :disabled="form.is_preset"
                                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-primary disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white"
                                placeholder="Ej: ROUND(costo * 2.5)"
                            />
                            <p class="mt-1 text-xs text-gray-500">
                                Variables: <code>costo</code>,
                                <code>ITBM</code>. Funciones:
                                <code>ROUND()</code>, <code>ROUNDUP()</code>,
                                <code>FLOOR()</code>.
                            </p>
                        </div>

                        <div>
                            <label
                                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >Descripción (opcional)</label
                            >
                            <textarea
                                v-model="form.description"
                                :disabled="form.is_preset"
                                rows="2"
                                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-primary disabled:opacity-50 dark:border-border dark:bg-muted dark:text-white"
                            ></textarea>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Orden de aparición</label
                                >
                                <input
                                    v-model.number="form.sort_order"
                                    type="number"
                                    min="0"
                                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:ring-primary dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>
                            <div class="flex items-center pt-6">
                                <label
                                    class="flex cursor-pointer items-center gap-2"
                                >
                                    <input
                                        v-model="form.is_active"
                                        type="checkbox"
                                        class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <span
                                        class="text-sm text-gray-700 dark:text-gray-300"
                                        >Fórmula Activa</span
                                    >
                                </label>
                            </div>
                        </div>

                        <div
                            class="border-t border-gray-200 pt-4 dark:border-border"
                        >
                            <h3
                                class="mb-2 text-sm font-semibold text-gray-900 dark:text-white"
                            >
                                Simulador
                            </h3>
                            <div class="flex items-end gap-2">
                                <div class="flex-1">
                                    <label
                                        class="mb-1 block text-xs text-gray-500"
                                        >Costo de Prueba ($)</label
                                    >
                                    <input
                                        v-model.number="previewCost"
                                        type="number"
                                        step="0.01"
                                        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                    />
                                </div>
                                <button
                                    type="button"
                                    @click="testFormula"
                                    class="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-200 dark:bg-muted dark:text-gray-200 dark:hover:bg-muted/80"
                                >
                                    Probar
                                </button>
                                <div
                                    class="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center font-mono dark:border-border dark:bg-background"
                                >
                                    <span
                                        v-if="previewResult !== null"
                                        class="font-bold text-green-600 dark:text-green-500"
                                        >${{ previewResult.toFixed(2) }}</span
                                    >
                                    <span
                                        v-else-if="previewError"
                                        class="text-xs text-red-500"
                                        >{{ previewError }}</span
                                    >
                                    <span v-else class="text-sm text-gray-400"
                                        >Resultado</span
                                    >
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        class="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-background/50"
                    >
                        <button
                            type="button"
                            @click="closeModal"
                            class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-muted"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            @click="save"
                            :disabled="
                                isSaving || (!form.formula && !form.is_preset)
                            "
                            class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-black shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
                        >
                            <Save :size="16" />
                            {{ isSaving ? 'Guardando...' : 'Guardar' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </AppLayout>
</template>
