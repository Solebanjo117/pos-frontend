<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed, ref, watch } from 'vue';
import {
    Dialog,
    DialogFooter,
    DialogHeader,
    DialogScrollContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { brandsService } from '@/services/brands';
import { suppliersService } from '@/services/suppliers';
import type {
    CreateSupplierData,
    Supplier,
    SupplierRelationships,
} from '@/types/supplier';

const props = defineProps<{ open: boolean; supplier?: Supplier | null }>();
const emit = defineEmits<{
    'update:open': [value: boolean];
    saved: [supplier: Supplier];
}>();
const saving = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});
const brands = ref<Array<{ id: number; name: string }>>([]);
const relationships = ref<SupplierRelationships | null>(null);
const form = ref<CreateSupplierData>({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Panamá',
    payment_terms: '',
    lead_time_days: 0,
    notes: '',
    status: 'active',
    brand_ids: [],
});
const title = computed(() =>
    props.supplier ? 'Editar proveedor' : 'Nuevo proveedor',
);
const validationMessages = computed(() =>
    Object.entries(fieldErrors.value).flatMap(([field, messages]) =>
        messages.map((message) => ({ field, message })),
    ),
);

async function hydrate() {
    loading.value = true;
    error.value = null;
    fieldErrors.value = {};
    relationships.value = null;
    try {
        brands.value = await brandsService.getAllActive();
        let supplier = props.supplier;
        if (supplier) {
            const response = await suppliersService.getById(supplier.id);
            supplier = response.data;
            relationships.value = response.relationships ?? null;
        }
        form.value = {
            name: supplier?.name ?? '',
            contact_name: supplier?.contact_name ?? '',
            email: supplier?.email ?? '',
            phone: supplier?.phone ?? '',
            address: supplier?.address ?? '',
            city: supplier?.city ?? '',
            country: supplier?.country ?? 'Panamá',
            payment_terms: supplier?.payment_terms ?? '',
            lead_time_days: supplier?.lead_time_days ?? 0,
            notes: supplier?.notes ?? '',
            status: supplier?.status ?? 'active',
            brand_ids: supplier?.brands?.map((brand) => brand.id) ?? [],
        };
    } catch (exception: any) {
        error.value =
            exception.response?.data?.message ??
            'No se pudo cargar el proveedor.';
    } finally {
        loading.value = false;
    }
}
function toggleBrand(id: number) {
    const ids = form.value.brand_ids ?? [];
    form.value.brand_ids = ids.includes(id)
        ? ids.filter((value) => value !== id)
        : [...ids, id];
}
async function submit() {
    if (!form.value.name || saving.value) return;
    saving.value = true;
    error.value = null;
    fieldErrors.value = {};
    try {
        const supplier = props.supplier
            ? await suppliersService.update(props.supplier.id, form.value)
            : await suppliersService.create(form.value);
        emit('saved', supplier);
        emit('update:open', false);
    } catch (exception: any) {
        const responseErrors = exception.response?.data?.errors;
        if (responseErrors && typeof responseErrors === 'object') {
            fieldErrors.value = responseErrors;
        }
        error.value =
            exception.response?.data?.message ?? 'No se pudo guardar.';
    } finally {
        saving.value = false;
    }
}
watch(
    () => props.open,
    (open) => {
        if (open) void hydrate();
    },
);
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)"
        ><DialogScrollContent class="max-h-[92vh] max-w-3xl"
            ><DialogHeader
                ><DialogTitle>{{ title }}</DialogTitle></DialogHeader
            >
            <div v-if="loading" class="py-10 text-center text-muted-foreground">
                Cargando...
            </div>
            <form v-else class="space-y-6" @submit.prevent="submit">
                <div
                    v-if="error || validationMessages.length"
                    class="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                >
                    <p v-if="error">{{ error }}</p>
                    <ul
                        v-if="validationMessages.length"
                        class="mt-1 list-disc pl-5"
                    >
                        <li
                            v-for="item in validationMessages"
                            :key="`${item.field}-${item.message}`"
                        >
                            {{ item.message }}
                        </li>
                    </ul>
                </div>
                <section class="grid gap-4 md:grid-cols-2">
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Proveedor *</label
                        ><input
                            v-model="form.name"
                            required
                            :aria-invalid="Boolean(fieldErrors.name)"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        />
                        <p
                            v-if="fieldErrors.name?.[0]"
                            class="mt-1 text-xs text-destructive"
                        >
                            {{ fieldErrors.name[0] }}
                        </p>
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Contacto</label
                        ><input
                            v-model="form.contact_name"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Email</label
                        ><input
                            v-model="form.email"
                            type="email"
                            :aria-invalid="Boolean(fieldErrors.email)"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        />
                        <p
                            v-if="fieldErrors.email?.[0]"
                            class="mt-1 text-xs text-destructive"
                        >
                            {{ fieldErrors.email[0] }}
                        </p>
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Teléfono</label
                        ><input
                            v-model="form.phone"
                            :aria-invalid="Boolean(fieldErrors.phone)"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        />
                        <p
                            v-if="fieldErrors.phone?.[0]"
                            class="mt-1 text-xs text-destructive"
                        >
                            {{ fieldErrors.phone[0] }}
                        </p>
                    </div>
                    <div class="md:col-span-2">
                        <label class="mb-1 block text-sm font-medium"
                            >Dirección</label
                        ><textarea
                            v-model="form.address"
                            rows="2"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Términos de pago</label
                        ><input
                            v-model="form.payment_terms"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        />
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium"
                            >Entrega estimada (días)</label
                        ><input
                            v-model.number="form.lead_time_days"
                            type="number"
                            min="0"
                            class="w-full rounded-md border bg-background px-3 py-2"
                        />
                    </div>
                </section>
                <section class="space-y-3 border-t pt-5">
                    <div>
                        <h3 class="font-semibold">Marcas suministradas</h3>
                        <p class="text-xs text-muted-foreground">
                            Relación directa del catálogo. Las categorías se
                            calculan desde productos y compras.
                        </p>
                    </div>
                    <div
                        class="grid max-h-48 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2 md:grid-cols-3"
                    >
                        <label
                            v-for="brand in brands"
                            :key="brand.id"
                            class="flex items-center gap-2 text-sm"
                            ><input
                                type="checkbox"
                                :checked="form.brand_ids?.includes(brand.id)"
                                @change="toggleBrand(brand.id)"
                            />
                            {{ brand.name }}</label
                        >
                    </div>
                    <p
                        v-if="fieldErrors.brand_ids?.[0]"
                        class="text-xs text-destructive"
                    >
                        {{ fieldErrors.brand_ids[0] }}
                    </p>
                </section>
                <section v-if="relationships" class="space-y-3 border-t pt-5">
                    <div class="flex items-center justify-between">
                        <h3 class="font-semibold">Relaciones reales</h3>
                        <Link
                            :href="`/suppliers/${supplier?.id}`"
                            class="text-sm text-primary hover:underline"
                            >Ver perfil completo</Link
                        >
                    </div>
                    <div class="grid gap-3 sm:grid-cols-3">
                        <div class="rounded-md border p-3">
                            <p class="text-xs text-muted-foreground">
                                Productos configurados
                            </p>
                            <p class="text-xl font-bold">
                                {{ relationships.configured_products_count }}
                            </p>
                        </div>
                        <div class="rounded-md border p-3">
                            <p class="text-xs text-muted-foreground">
                                Órdenes relacionadas
                            </p>
                            <p class="text-xl font-bold">
                                {{ relationships.purchase_orders_count }}
                            </p>
                        </div>
                        <div class="rounded-md border p-3">
                            <p class="text-xs text-muted-foreground">
                                CxP abiertas
                            </p>
                            <p class="text-xl font-bold">
                                {{
                                    relationships.accounts_payable_orders_count
                                }}
                            </p>
                        </div>
                    </div>
                    <div>
                        <p
                            class="mb-2 text-xs font-semibold text-muted-foreground uppercase"
                        >
                            Categorías derivadas
                        </p>
                        <div class="flex flex-wrap gap-2">
                            <span
                                v-for="category in relationships.categories"
                                :key="category.id"
                                class="rounded-full border px-2 py-1 text-xs"
                                >{{ category.name }} ·
                                {{
                                    category.source === 'both'
                                        ? 'configurada y comprada'
                                        : category.source === 'configured'
                                          ? 'configurada'
                                          : 'comprada'
                                }}</span
                            ><span
                                v-if="relationships.categories.length === 0"
                                class="text-sm text-muted-foreground"
                                >Sin categorías derivadas.</span
                            >
                        </div>
                    </div>
                </section>
                <div>
                    <label class="mb-1 block text-sm font-medium">Notas</label
                    ><textarea
                        v-model="form.notes"
                        rows="3"
                        class="w-full rounded-md border bg-background px-3 py-2"
                    />
                </div>
                <DialogFooter
                    ><button
                        type="button"
                        class="rounded-md border px-4 py-2"
                        @click="emit('update:open', false)"
                    >
                        Cancelar</button
                    ><button
                        type="submit"
                        class="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                        :disabled="saving || !form.name"
                    >
                        {{ saving ? 'Guardando...' : 'Guardar proveedor' }}
                    </button></DialogFooter
                >
            </form>
        </DialogScrollContent></Dialog
    >
</template>
