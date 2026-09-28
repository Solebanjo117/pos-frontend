<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { Banknote, Clock3, Pencil, Plus, Send } from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import {
    cashOperationsService,
    type FundingCategory,
} from '@/services/cash-operations';
import { formatReportDateTime } from '@/utils/formatters';
import { createIdempotencyKey } from '@/utils/idempotency';

interface ExpenseCategory {
    id: number;
    name: string;
    is_active: boolean;
}

const operationType = ref<'expense' | 'funding'>('expense');
const categoryId = ref<number | null>(null);
const amount = ref<number | null>(null);
const notes = ref('');
const expenseCategories = ref<ExpenseCategory[]>([]);
const fundingCategories = ref<FundingCategory[]>([]);
const loadingCategories = ref(true);
const submitting = ref(false);
const error = ref<string | null>(null);
const sent = ref(false);
const idempotencyKey = ref(createIdempotencyKey());
const now = ref(new Date());
const showCategories = ref(false);
const categoryName = ref('');
const categorySaving = ref(false);
const categoryError = ref<string | null>(null);
let timer: ReturnType<typeof setInterval> | null = null;

const activeFundingCategories = computed(() =>
    fundingCategories.value.filter((category) => category.is_active),
);
const availableCategories = computed(() =>
    operationType.value === 'expense'
        ? expenseCategories.value
        : activeFundingCategories.value,
);
const canSubmit = computed(
    () =>
        Number(amount.value) > 0 &&
        categoryId.value !== null &&
        !submitting.value,
);
const requestTime = computed(() => formatReportDateTime(now.value));

async function loadCategories(): Promise<void> {
    loadingCategories.value = true;
    try {
        const [expenses, funding] = await Promise.all([
            apiClient.get('/operational-expense-categories'),
            cashOperationsService.fundingCategories(true),
        ]);
        expenseCategories.value = expenses.data.data ?? [];
        fundingCategories.value = funding;
        if (!categoryId.value)
            categoryId.value = availableCategories.value[0]?.id ?? null;
    } finally {
        loadingCategories.value = false;
    }
}

function selectType(type: 'expense' | 'funding'): void {
    operationType.value = type;
    categoryId.value =
        (type === 'expense'
            ? expenseCategories.value
            : activeFundingCategories.value)[0]?.id ?? null;
    sent.value = false;
}

async function submit(): Promise<void> {
    if (!canSubmit.value || amount.value === null || categoryId.value === null)
        return;
    submitting.value = true;
    error.value = null;
    try {
        await cashOperationsService.create({
            operation_type: operationType.value,
            amount: amount.value,
            notes: notes.value.trim() || undefined,
            ...(operationType.value === 'expense'
                ? { expense_category_id: categoryId.value }
                : { funding_category_id: categoryId.value }),
            idempotency_key: idempotencyKey.value,
        });
        sent.value = true;
        amount.value = null;
        notes.value = '';
        idempotencyKey.value = createIdempotencyKey();
    } catch (exception: any) {
        error.value =
            exception.response?.data?.message ||
            'No se pudo enviar la solicitud a Caja.';
    } finally {
        submitting.value = false;
    }
}

async function createCategory(): Promise<void> {
    if (!categoryName.value.trim() || categorySaving.value) return;
    categorySaving.value = true;
    categoryError.value = null;
    try {
        const created = await cashOperationsService.createFundingCategory(
            categoryName.value.trim(),
        );
        fundingCategories.value.push(created);
        categoryName.value = '';
        categoryId.value = created.id;
    } catch (exception: any) {
        categoryError.value =
            exception.response?.data?.message ||
            'No se pudo crear la categoría.';
    } finally {
        categorySaving.value = false;
    }
}

async function updateCategory(category: FundingCategory): Promise<void> {
    const nextName = window.prompt('Nombre de la categoría', category.name);
    if (nextName === null || !nextName.trim()) return;
    const updated = await cashOperationsService.updateFundingCategory(
        category.id,
        { name: nextName.trim() },
    );
    fundingCategories.value = fundingCategories.value.map((item) =>
        item.id === updated.id ? updated : item,
    );
}

async function toggleCategory(category: FundingCategory): Promise<void> {
    const updated = await cashOperationsService.updateFundingCategory(
        category.id,
        { is_active: !category.is_active },
    );
    fundingCategories.value = fundingCategories.value.map((item) =>
        item.id === updated.id ? updated : item,
    );
    if (!updated.is_active && categoryId.value === updated.id)
        categoryId.value = activeFundingCategories.value[0]?.id ?? null;
}

onMounted(async () => {
    timer = setInterval(() => (now.value = new Date()), 1000);
    await loadCategories();
});
onUnmounted(() => {
    if (timer) clearInterval(timer);
});
</script>

<template>
    <Head title="Gastos / Funding" />
    <AppLayout :show-warehouse-selector="false">
        <main class="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6">
            <header class="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p
                        class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                    >
                        Caja · Operaciones
                    </p>
                    <h1 class="mt-1 text-2xl font-semibold">
                        Gastos / Funding
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Registra una solicitud pendiente para que Caja confirme
                        los métodos y cuentas de la operación.
                    </p>
                </div>
                <Link
                    href="/cash"
                    class="rounded-md border px-3 py-2 text-sm hover:bg-muted"
                    >Volver a Caja</Link
                >
            </header>

            <div
                v-if="sent"
                class="flex items-center justify-between gap-3 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
            >
                <span>Solicitud enviada correctamente.</span
                ><Link href="/pos/cashier" class="font-semibold underline"
                    >Ver cola</Link
                >
            </div>

            <form class="rounded-lg border bg-card" @submit.prevent="submit">
                <div class="grid gap-5 p-5 sm:p-6">
                    <div class="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            class="rounded-md border px-3 py-3 text-sm font-semibold"
                            :class="
                                operationType === 'expense'
                                    ? 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200'
                                    : 'hover:bg-muted'
                            "
                            @click="selectType('expense')"
                        >
                            Gasto
                        </button>
                        <button
                            type="button"
                            class="rounded-md border px-3 py-3 text-sm font-semibold"
                            :class="
                                operationType === 'funding'
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                                    : 'hover:bg-muted'
                            "
                            @click="selectType('funding')"
                        >
                            Aportación de fondos
                        </button>
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <label class="space-y-1.5 text-sm"
                            ><span class="font-medium">Día y hora</span
                            ><span
                                class="flex min-h-10 items-center gap-2 rounded-md border bg-muted/40 px-3 text-muted-foreground"
                                ><Clock3 class="size-4" />
                                {{ requestTime }}</span
                            ></label
                        >
                        <label class="space-y-1.5 text-sm"
                            ><span class="font-medium">Método</span
                            ><span
                                class="flex min-h-10 items-center gap-2 rounded-md border bg-muted/40 px-3"
                                ><Banknote class="size-4" /> Se elige en
                                Caja</span
                            ></label
                        >
                    </div>
                    <label class="space-y-1.5 text-sm">
                        <span class="flex items-center justify-between gap-2"
                            ><span class="font-medium">Categoría *</span
                            ><button
                                v-if="operationType === 'funding'"
                                type="button"
                                class="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300"
                                @click="showCategories = !showCategories"
                            >
                                Administrar categorías
                            </button></span
                        >
                        <select
                            v-model="categoryId"
                            :disabled="
                                loadingCategories ||
                                availableCategories.length === 0
                            "
                            required
                            class="w-full rounded-md border bg-background px-3 py-2"
                        >
                            <option :value="null" disabled>
                                {{
                                    loadingCategories
                                        ? 'Cargando…'
                                        : 'Selecciona una categoría'
                                }}
                            </option>
                            <option
                                v-for="category in availableCategories"
                                :key="category.id"
                                :value="category.id"
                            >
                                {{ category.name }}
                            </option>
                        </select>
                        <span
                            v-if="
                                operationType === 'funding' &&
                                !loadingCategories &&
                                activeFundingCategories.length === 0
                            "
                            class="block rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                            >Crea o activa una categoría para enviar
                            Funding.</span
                        >
                    </label>
                    <section
                        v-if="operationType === 'funding' && showCategories"
                        class="space-y-3 rounded-md border bg-muted/20 p-4"
                    >
                        <h2 class="text-sm font-semibold">
                            Categorías de aportaciones
                        </h2>
                        <div class="flex gap-2">
                            <input
                                v-model="categoryName"
                                maxlength="100"
                                class="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                                placeholder="Nombre de categoría"
                                @keydown.enter.prevent="createCategory"
                            /><button
                                type="button"
                                :disabled="
                                    categorySaving || !categoryName.trim()
                                "
                                class="inline-flex items-center gap-1 rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                @click="createCategory"
                            >
                                <Plus class="size-4" /> Crear
                            </button>
                        </div>
                        <p v-if="categoryError" class="text-sm text-red-600">
                            {{ categoryError }}
                        </p>
                        <div class="divide-y rounded-md border bg-background">
                            <div
                                v-for="category in fundingCategories"
                                :key="category.id"
                                class="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                            >
                                <span
                                    :class="
                                        !category.is_active &&
                                        'text-muted-foreground line-through'
                                    "
                                    >{{ category.name }}</span
                                >
                                <div class="flex items-center gap-2">
                                    <button
                                        type="button"
                                        class="rounded border p-1.5"
                                        title="Editar"
                                        @click="updateCategory(category)"
                                    >
                                        <Pencil class="size-3.5" /></button
                                    ><button
                                        type="button"
                                        class="rounded border px-2 py-1 text-xs"
                                        @click="toggleCategory(category)"
                                    >
                                        {{
                                            category.is_active
                                                ? 'Desactivar'
                                                : 'Activar'
                                        }}
                                    </button>
                                </div>
                            </div>
                            <p
                                v-if="fundingCategories.length === 0"
                                class="px-3 py-4 text-center text-sm text-muted-foreground"
                            >
                                No hay categorías registradas.
                            </p>
                        </div>
                    </section>
                    <label class="space-y-1.5 text-sm"
                        ><span class="font-medium">Monto *</span
                        ><input
                            v-model.number="amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                            class="w-full rounded-md border bg-background px-3 py-2 text-right text-xl font-semibold tabular-nums"
                            placeholder="0.00"
                    /></label>
                    <label class="space-y-1.5 text-sm"
                        ><span class="font-medium">Notas</span
                        ><textarea
                            v-model="notes"
                            rows="3"
                            maxlength="1000"
                            class="w-full rounded-md border bg-background px-3 py-2"
                            placeholder="Información opcional para el cajero"
                        />
                    </label>
                    <p
                        v-if="error"
                        role="alert"
                        class="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200"
                    >
                        {{ error }}
                    </p>
                </div>
                <div
                    class="flex justify-end border-t bg-muted/20 px-5 py-4 sm:px-6"
                >
                    <button
                        type="submit"
                        :disabled="!canSubmit"
                        class="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Send class="size-4" />
                        {{ submitting ? 'Enviando…' : 'Enviar a caja' }}
                    </button>
                </div>
            </form>
        </main>
    </AppLayout>
</template>
