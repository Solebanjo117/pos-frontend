<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useStoreSettings } from '@/composables/useStoreSettings';

const props = defineProps<{
    show: boolean;
    defaultTaxRate?: number;
}>();

const emit = defineEmits<{
    close: [];
    submit: [
        payload: {
            custom_description: string;
            product_sku?: string;
            quantity: number;
            unit_price: number;
            tax_percent: number;
            discount_percent: number;
            discount_amount?: number;
            notes?: string;
        },
    ];
}>();
const { defaultTaxRate: storeDefaultTaxRate } = useStoreSettings();

const form = reactive({
    custom_description: '',
    product_sku: 'MISC',
    quantity: 1,
    unit_price: 0,
    tax_percent: props.defaultTaxRate ?? storeDefaultTaxRate(),
    discount_percent: 0,
    discount_amount: 0,
    notes: '',
});

const error = ref<string | null>(null);
const submitted = ref(false);

const resetForm = () => {
    form.custom_description = '';
    form.product_sku = 'MISC';
    form.quantity = 1;
    form.unit_price = 0;
    form.tax_percent = props.defaultTaxRate ?? storeDefaultTaxRate();
    form.discount_percent = 0;
    form.discount_amount = 0;
    form.notes = '';
    error.value = null;
    submitted.value = false;
};

watch(
    () => props.show,
    (visible) => {
        if (visible) {
            resetForm();
        }
    },
);

const handleSubmit = () => {
    if (submitted.value) return;
    error.value = null;

    if (!form.custom_description.trim()) {
        error.value = 'La descripcion es obligatoria.';
        return;
    }

    if (form.quantity <= 0 || !Number.isInteger(Number(form.quantity))) {
        error.value = 'La cantidad debe ser un numero entero mayor a 0.';
        return;
    }

    if (form.unit_price < 0) {
        error.value = 'El precio no puede ser negativo.';
        return;
    }

    const grossSubtotal = Number(form.quantity) * Number(form.unit_price);
    if (Number(form.discount_amount) > grossSubtotal) {
        error.value =
            'El descuento no puede superar el importe bruto de la línea.';
        return;
    }

    submitted.value = true;
    emit('submit', {
        custom_description: form.custom_description.trim(),
        product_sku: form.product_sku.trim() || 'MISC',
        quantity: Number(form.quantity),
        unit_price: Math.max(0, Number(form.unit_price) || 0),
        tax_percent: Math.max(0, Number(form.tax_percent) || 0),
        discount_percent: Math.max(
            0,
            Math.min(100, Number(form.discount_percent) || 0),
        ),
        discount_amount: Math.max(0, Number(form.discount_amount) || 0),
        notes: form.notes.trim() || undefined,
    });
};
</script>

<template>
    <Teleport to="body">
        <div
            v-if="show"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            @click.self="emit('close')"
        >
            <div
                class="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-border dark:bg-card"
            >
                <div class="mb-4 flex items-center justify-between">
                    <h3
                        class="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        Agregar linea miscelanea
                    </h3>
                    <button
                        type="button"
                        class="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-muted"
                        @click="emit('close')"
                    >
                        Cerrar
                    </button>
                </div>

                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div class="md:col-span-2">
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Descripcion</label
                        >
                        <input
                            v-model="form.custom_description"
                            type="text"
                            placeholder="Servicio de instalacion, mano de obra, ajuste especial..."
                            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >SKU</label
                        >
                        <input
                            v-model="form.product_sku"
                            type="text"
                            placeholder="MISC"
                            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Cantidad</label
                        >
                        <input
                            v-model.number="form.quantity"
                            type="number"
                            min="1"
                            step="1"
                            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Precio unitario</label
                        >
                        <input
                            v-model.number="form.unit_price"
                            type="number"
                            min="0"
                            step="0.01"
                            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div>
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Impuesto (%)</label
                        >
                        <input
                            v-model.number="form.tax_percent"
                            type="number"
                            min="0"
                            step="0.01"
                            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div class="md:col-span-2">
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Descuento $</label
                        >
                        <input
                            v-model.number="form.discount_amount"
                            type="number"
                            min="0"
                            :max="form.quantity * form.unit_price"
                            step="0.01"
                            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>

                    <div class="md:col-span-2">
                        <label
                            class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >Notas internas (opcional)</label
                        >
                        <textarea
                            v-model="form.notes"
                            rows="2"
                            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-border dark:bg-muted dark:text-white"
                        />
                    </div>
                </div>

                <p
                    v-if="error"
                    class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
                >
                    {{ error }}
                </p>

                <div class="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-border dark:text-gray-300 dark:hover:bg-muted"
                        @click="emit('close')"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        :disabled="submitted"
                        @click="handleSubmit"
                    >
                        Agregar linea
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
