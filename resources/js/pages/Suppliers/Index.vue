<script setup lang="ts">
import { Head, Link, usePage } from '@inertiajs/vue3';
import {
    Download,
    Eye,
    Pencil,
    Plus,
    Search,
    Trash2,
    Upload,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import Pagination from '@/components/Pagination.vue';
import SupplierDialog from '@/components/Suppliers/SupplierDialog.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { brandsService } from '@/services/brands';
import { categoriesService } from '@/services/categories';
import { suppliersService } from '@/services/suppliers';
import type { Brand } from '@/types/brand';
import type { Category } from '@/types/category';
import type { Supplier } from '@/types/supplier';
import { canManageCatalog as hasCatalogManagementRole } from '@/utils/catalogPermissions';

type Tab = 'categories' | 'brands' | 'suppliers';
const page = usePage();
const canManageCatalog = computed(() =>
    hasCatalogManagementRole((page.props.auth?.user as any)?.role),
);
const activeTab = ref<Tab>('categories');
const search = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const categories = ref<Category[]>([]);
const brands = ref<Brand[]>([]);
const suppliers = ref<Supplier[]>([]);
const summary = ref({
    categories: 0,
    brands: 0,
    suppliers: 0,
    active_suppliers: 0,
});
const pagination = ref({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
});
const supplierDialogOpen = ref(false);
const editingSupplier = ref<Supplier | null>(null);
const selectedIds = ref<number[]>([]);

const visibleCategories = computed(() => {
    const term = search.value.trim().toLocaleLowerCase();
    return term
        ? categories.value.filter((item) =>
              item.name.toLocaleLowerCase().includes(term),
          )
        : categories.value;
});
const importHref = computed(() => `/${activeTab.value}/import`);

function updateUrl(push = true) {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeTab.value);
    if (search.value) url.searchParams.set('search', search.value);
    else url.searchParams.delete('search');
    if (push) window.history.pushState({}, '', url);
    else window.history.replaceState({}, '', url);
}

async function load(page = 1) {
    loading.value = true;
    error.value = null;
    try {
        summary.value = await suppliersService.getCatalogSummary();
        if (activeTab.value === 'categories') {
            categories.value = await categoriesService.getAllWithParent();
            pagination.value = {
                current_page: 1,
                last_page: 1,
                per_page: categories.value.length,
                total: categories.value.length,
            };
        } else if (activeTab.value === 'brands') {
            const response = await brandsService.getAll({
                search: search.value || undefined,
                page,
                per_page: 15,
            } as any);
            brands.value = response.data;
            pagination.value = {
                current_page: response.current_page,
                last_page: response.last_page,
                per_page: response.per_page,
                total: response.total,
            };
        } else {
            const response = await suppliersService.getAll({
                search: search.value || undefined,
                page,
                per_page: 15,
            });
            suppliers.value = response.data;
            pagination.value = {
                current_page: response.current_page,
                last_page: response.last_page,
                per_page: response.per_page,
                total: response.total,
            };
        }
    } catch (exception: any) {
        error.value =
            exception.response?.data?.message ??
            'No se pudo cargar el catálogo.';
    } finally {
        loading.value = false;
    }
}

async function selectTab(tab: Tab, push = true) {
    activeTab.value = tab;
    search.value = '';
    selectedIds.value = [];
    updateUrl(push);
    await load();
}
async function applySearch() {
    updateUrl(false);
    await load();
}
function openSupplier(supplier?: Supplier) {
    editingSupplier.value = supplier ?? null;
    supplierDialogOpen.value = true;
    const url = new URL(window.location.href);
    url.searchParams.set('action', supplier ? 'edit' : 'create');
    if (supplier) url.searchParams.set('id', String(supplier.id));
    else url.searchParams.delete('id');
    window.history.replaceState({}, '', url);
}
function closeSupplier(value: boolean) {
    supplierDialogOpen.value = value;
    if (!value) {
        const url = new URL(window.location.href);
        url.searchParams.delete('action');
        url.searchParams.delete('id');
        window.history.replaceState({}, '', url);
    }
}
async function remove(
    entity: 'category' | 'brand' | 'supplier',
    item: { id: number; name: string },
) {
    if (entity !== 'supplier' && !canManageCatalog.value) return;
    if (!confirm(`¿Eliminar ${item.name}?`)) return;
    try {
        if (entity === 'supplier') await suppliersService.delete(item.id);
        else
            await suppliersService.bulkCatalogAction(entity, 'delete', [
                item.id,
            ]);
        await load(pagination.value.current_page);
    } catch (exception: any) {
        const blocked = exception.response?.data?.blocked;
        alert(
            blocked?.[item.id] ??
                exception.response?.data?.message ??
                'No se puede eliminar este registro.',
        );
    }
}
async function bulk(action: 'delete' | 'deactivate') {
    if (
        !canManageCatalog.value ||
        !selectedIds.value.length ||
        !confirm(
            `¿Aplicar la acción a ${selectedIds.value.length} registro(s)?`,
        )
    )
        return;
    const entity =
        activeTab.value === 'categories'
            ? 'category'
            : activeTab.value === 'brands'
              ? 'brand'
              : 'supplier';
    try {
        await suppliersService.bulkCatalogAction(
            entity,
            action,
            selectedIds.value,
        );
        selectedIds.value = [];
        await load(pagination.value.current_page);
    } catch (exception: any) {
        alert(
            exception.response?.data?.message ?? 'No se aplicó ningún cambio.',
        );
    }
}
async function saved() {
    await load(pagination.value.current_page);
}

onMounted(async () => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    activeTab.value =
        tab === 'brands' || tab === 'suppliers' ? tab : 'categories';
    search.value = params.get('search') ?? '';
    await load();
    const action = params.get('action');
    const id = Number(params.get('id'));
    if (activeTab.value === 'suppliers' && action === 'create') openSupplier();
    if (activeTab.value === 'suppliers' && action === 'edit' && id)
        openSupplier(
            suppliers.value.find((item) => item.id === id) ??
                (await suppliersService.getById(id)).data,
        );
    window.addEventListener('popstate', () => {
        const current = new URLSearchParams(window.location.search).get('tab');
        selectTab(
            current === 'brands' || current === 'suppliers'
                ? current
                : 'categories',
            false,
        );
    });
});
</script>

<template>
    <Head title="Catálogo de proveedores" />
    <AppLayout
        :breadcrumbs="[
            { title: 'Compras', href: '/purchases' },
            { title: 'Catálogo de proveedores', href: '/suppliers' },
        ]"
    >
        <div class="space-y-5">
            <header
                class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
                <div>
                    <h1 class="text-2xl font-bold">
                        Categorías, marcas y proveedores
                    </h1>
                    <p class="text-sm text-muted-foreground">
                        Relaciones reales de abastecimiento, productos y
                        compras.
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <Link
                        v-if="canManageCatalog"
                        :href="importHref"
                        class="inline-flex items-center gap-2 rounded-md border px-3 py-2"
                        ><Upload :size="17" /> Importar</Link
                    >
                    <button
                        class="inline-flex items-center gap-2 rounded-md border px-3 py-2"
                        @click="suppliersService.exportCatalog()"
                    >
                        <Download :size="17" /> Exportar
                    </button>
                    <Link
                        v-if="canManageCatalog && activeTab === 'categories'"
                        href="/categories/create"
                        class="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-primary-foreground"
                        ><Plus :size="17" /> Nueva categoría</Link
                    >
                    <Link
                        v-else-if="canManageCatalog && activeTab === 'brands'"
                        href="/brands/create"
                        class="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-primary-foreground"
                        ><Plus :size="17" /> Nueva marca</Link
                    >
                    <button
                        v-else-if="activeTab === 'suppliers'"
                        class="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-primary-foreground"
                        @click="openSupplier()"
                    >
                        <Plus :size="17" /> Nuevo proveedor
                    </button>
                </div>
            </header>
            <nav
                class="flex gap-1 rounded-lg border bg-muted/30 p-1"
                aria-label="Catálogo de proveedores"
            >
                <button
                    v-for="tab in [
                        ['categories', 'Categorías', summary.categories],
                        ['brands', 'Marcas', summary.brands],
                        ['suppliers', 'Proveedores', summary.suppliers],
                    ] as const"
                    :key="tab[0]"
                    class="rounded-md px-4 py-2 text-sm"
                    :class="
                        activeTab === tab[0] ? 'bg-background shadow-sm' : ''
                    "
                    @click="selectTab(tab[0])"
                >
                    {{ tab[1] }}
                    <span class="ml-1 text-muted-foreground">{{ tab[2] }}</span>
                </button>
            </nav>
            <div class="rounded-lg border bg-card p-4">
                <div class="relative max-w-xl">
                    <Search
                        class="absolute top-2.5 left-3 text-muted-foreground"
                        :size="18"
                    /><input
                        v-model="search"
                        class="w-full rounded-md border bg-background py-2 pr-3 pl-10"
                        placeholder="Buscar..."
                        @keyup.enter="applySearch"
                    />
                </div>
            </div>
            <div
                v-if="error"
                class="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive"
            >
                {{ error }}
            </div>
            <div
                v-if="canManageCatalog && selectedIds.length"
                class="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm"
            >
                <span>{{ selectedIds.length }} seleccionado(s)</span>
                <button
                    v-if="activeTab !== 'categories'"
                    class="rounded-md border px-3 py-1.5"
                    @click="bulk('deactivate')"
                >
                    Desactivar
                </button>
                <button
                    class="rounded-md border border-destructive/40 px-3 py-1.5 text-destructive"
                    @click="bulk('delete')"
                >
                    Eliminar
                </button>
            </div>
            <div class="overflow-hidden rounded-lg border bg-card">
                <div
                    v-if="loading"
                    class="p-12 text-center text-muted-foreground"
                >
                    Cargando...
                </div>
                <table v-else class="w-full text-sm">
                    <thead
                        class="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase"
                    >
                        <tr v-if="activeTab === 'categories'">
                            <th v-if="canManageCatalog" class="w-10 p-3">
                                <span class="sr-only">Seleccionar</span>
                            </th>
                            <th class="p-3">Categoría</th>
                            <th class="p-3">Padres</th>
                            <th class="p-3 text-right">Acciones</th>
                        </tr>
                        <tr v-else-if="activeTab === 'brands'">
                            <th v-if="canManageCatalog" class="w-10 p-3">
                                <span class="sr-only">Seleccionar</span>
                            </th>
                            <th class="p-3">Marca</th>
                            <th class="p-3">Proveedores</th>
                            <th class="p-3">Variantes</th>
                            <th class="p-3 text-right">Acciones</th>
                        </tr>
                        <tr v-else>
                            <th v-if="canManageCatalog" class="w-10 p-3">
                                <span class="sr-only">Seleccionar</span>
                            </th>
                            <th class="p-3">Proveedor</th>
                            <th class="p-3">Marcas</th>
                            <th class="p-3">Productos</th>
                            <th class="p-3">Estado</th>
                            <th class="p-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        <template v-if="activeTab === 'categories'">
                            <tr
                                v-for="item in visibleCategories"
                                :key="item.id"
                            >
                                <td v-if="canManageCatalog" class="p-3">
                                    <input
                                        v-model="selectedIds"
                                        type="checkbox"
                                        :value="item.id"
                                        :aria-label="`Seleccionar ${item.name}`"
                                    />
                                </td>
                                <td class="p-3 font-medium">{{ item.name }}</td>
                                <td class="p-3 text-muted-foreground">
                                    {{
                                        item.parents
                                            ?.map((p: any) => p.name)
                                            .join(', ') || 'Raíz'
                                    }}
                                </td>
                                <td class="p-3">
                                    <div
                                        v-if="canManageCatalog"
                                        class="flex justify-end gap-1"
                                    >
                                        <Link
                                            :href="`/categories/${item.id}/edit`"
                                            class="p-2"
                                            ><Pencil :size="16" /></Link
                                        ><button
                                            class="p-2 text-destructive"
                                            @click="remove('category', item)"
                                        >
                                            <Trash2 :size="16" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </template>
                        <template v-else-if="activeTab === 'brands'">
                            <tr v-for="item in brands" :key="item.id">
                                <td v-if="canManageCatalog" class="p-3">
                                    <input
                                        v-model="selectedIds"
                                        type="checkbox"
                                        :value="item.id"
                                        :aria-label="`Seleccionar ${item.name}`"
                                    />
                                </td>
                                <td class="p-3 font-medium">{{ item.name }}</td>
                                <td class="p-3">
                                    {{ (item as any).suppliers_count || 0 }}
                                </td>
                                <td class="p-3">
                                    {{
                                        (item as any).product_variants_count ||
                                        0
                                    }}
                                </td>
                                <td class="p-3">
                                    <div
                                        v-if="canManageCatalog"
                                        class="flex justify-end gap-1"
                                    >
                                        <Link
                                            :href="`/brands/${item.id}/edit`"
                                            class="p-2"
                                            ><Pencil :size="16" /></Link
                                        ><button
                                            class="p-2 text-destructive"
                                            @click="remove('brand', item)"
                                        >
                                            <Trash2 :size="16" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </template>
                        <template v-else>
                            <tr v-for="item in suppliers" :key="item.id">
                                <td v-if="canManageCatalog" class="p-3">
                                    <input
                                        v-model="selectedIds"
                                        type="checkbox"
                                        :value="item.id"
                                        :aria-label="`Seleccionar ${item.name}`"
                                    />
                                </td>
                                <td class="p-3">
                                    <Link
                                        :href="`/suppliers/${item.id}`"
                                        class="font-medium hover:underline"
                                        >{{ item.name }}</Link
                                    >
                                    <p class="text-xs text-muted-foreground">
                                        {{
                                            item.contact_name ||
                                            item.email ||
                                            'Sin contacto'
                                        }}
                                    </p>
                                </td>
                                <td class="p-3">
                                    {{ (item as any).brands_count || 0 }}
                                </td>
                                <td class="p-3">
                                    {{ item.products_count || 0 }}
                                </td>
                                <td class="p-3">
                                    {{
                                        item.status === 'active'
                                            ? 'Activo'
                                            : 'Inactivo'
                                    }}
                                </td>
                                <td class="p-3">
                                    <div class="flex justify-end gap-1">
                                        <Link
                                            :href="`/suppliers/${item.id}`"
                                            class="p-2"
                                            ><Eye :size="16" /></Link
                                        ><button
                                            class="p-2"
                                            @click="openSupplier(item)"
                                        >
                                            <Pencil :size="16" /></button
                                        ><button
                                            class="p-2 text-destructive"
                                            @click="remove('supplier', item)"
                                        >
                                            <Trash2 :size="16" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>
                <Pagination
                    v-if="pagination.last_page > 1"
                    :pagination="pagination"
                    :loading="loading"
                    @page-change="load"
                />
            </div>
        </div>
        <SupplierDialog
            :open="supplierDialogOpen"
            :supplier="editingSupplier"
            @update:open="closeSupplier"
            @saved="saved"
        />
    </AppLayout>
</template>
