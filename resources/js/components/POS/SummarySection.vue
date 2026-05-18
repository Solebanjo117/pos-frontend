<script setup lang="ts">
import { User, IdCard, CheckCircle2, Plus } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { formatCurrency } from '@/utils/formatters';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';

const props = defineProps<{
    subtotal: number;
    taxAmount: number;
    total: number;
    discountAmount?: number;
    customerId: number | string | null | undefined;
    sellerId: number | string | null | undefined;
    customers: Array<{
        id: number;
        name: string;
        document_number?: string;
        phone?: string | null;
    }>;
    users: Array<{ id: number; name: string }>;
    canEditSeller?: boolean;
}>();

const emit = defineEmits([
    'update:customerId',
    'update:sellerId',
    'open-quick-customer',
]);

const selectedCustomer = computed(() => {
    if (!props.customerId) return null;
    return props.customers.find((c) => c.id === props.customerId);
});

const selectedSeller = computed(() => {
    if (!props.sellerId) return null;
    return props.users.find((u) => u.id === props.sellerId);
});

const customerOptions = computed(() => {
    const opts = [{ value: null as number | null, label: 'Público General' }];
    if (props.customers) {
        opts.push(
            ...props.customers.map((c) => ({
                value: c.id,
                label: c.name,
                sublabel: c.document_number || c.phone || undefined,
            })),
        );
    }
    return opts;
});

const sellerOptions = computed(() => {
    const opts = [
        { value: null as number | null, label: 'Seleccionar Vendedor' },
    ];
    if (props.users) {
        opts.push(
            ...props.users.map((u) => ({
                value: u.id,
                label: u.name,
            })),
        );
    }
    return opts;
});

const internalCustomerId = ref<number | string | null>(
    props.customerId || null,
);
const internalSellerId = ref<number | string | null>(props.sellerId || null);

watch(
    () => props.customerId,
    (val) => {
        internalCustomerId.value = val || null;
    },
);

watch(
    () => props.sellerId,
    (val) => {
        internalSellerId.value = val || null;
    },
);
</script>

<template>
    <div class="flex flex-col gap-4">
        <!-- Customer & Seller Form -->
        <div class="space-y-4">
            <!-- Cliente Input Group -->
            <div>
                <label
                    class="mb-1 block text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400"
                >
                    Cliente
                </label>
                <div class="flex items-center gap-2">
                    <SearchableSelect
                        v-model="internalCustomerId"
                        :options="customerOptions"
                        placeholder="Público General"
                        @update:modelValue="
                            (val) => emit('update:customerId', val)
                        "
                        class="flex-1"
                        :class="
                            selectedCustomer
                                ? 'border-blue-400 ring-1 ring-blue-400 dark:border-blue-600 dark:ring-blue-600'
                                : ''
                        "
                    />
                    <button
                        @click="emit('open-quick-customer')"
                        title="Crear cliente rápido"
                        class="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                    >
                        <Plus :size="20" />
                    </button>
                </div>
            </div>

            <!-- Vendedor Input Group -->
            <div>
                <label
                    class="mb-1 block text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400"
                >
                    Vendedor
                </label>
                <SearchableSelect
                  v-model="internalSellerId"
                  :options="sellerOptions"
                  :disabled="props.canEditSeller === false"
                  placeholder="Seleccionar Vendedor"
                    @update:modelValue="(val) => emit('update:sellerId', val)"
                    :class="
                        selectedSeller
                            ? 'border-blue-400 ring-1 ring-blue-400 dark:border-blue-600 dark:ring-blue-600'
                            : ''
                    "
                />
            </div>
        </div>

        <!-- Divider -->
        <div class="my-1 h-px bg-gray-100 dark:bg-border"></div>

        <!-- Summary Card -->
        <div
            class="relative overflow-hidden rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10"
        >
            <div
                class="pointer-events-none absolute top-0 right-0 -mt-8 -mr-8 h-24 w-24 rounded-bl-full bg-blue-100 opacity-40 dark:bg-blue-900/30"
            ></div>

            <div class="relative z-10 space-y-2">
                <div
                    class="flex justify-between text-sm text-gray-600 dark:text-gray-300"
                >
                    <span>Subtotal</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{
                        formatCurrency(subtotal)
                    }}</span>
                </div>
                <div
                    v-if="discountAmount && discountAmount > 0"
                    class="flex justify-between text-sm text-green-600 dark:text-green-400"
                >
                    <span>Descuento</span>
                    <span class="font-medium"
                        >-{{ formatCurrency(discountAmount) }}</span
                    >
                </div>
                <div
                    class="flex justify-between text-sm text-gray-600 dark:text-gray-300"
                >
                    <span>ITBMS</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{
                        formatCurrency(taxAmount)
                    }}</span>
                </div>

                <div class="my-2 h-px bg-blue-200/50 dark:bg-blue-900/50"></div>

                <div class="flex items-end justify-between">
                    <span
                        class="mb-0.5 text-base font-bold text-gray-800 dark:text-gray-200"
                        >TOTAL</span
                    >
                    <span
                        class="text-3xl font-bold text-blue-600 dark:text-blue-400 dark:text-primary"
                        >{{ formatCurrency(total) }}</span
                    >
                </div>
            </div>
        </div>
    </div>
</template>
