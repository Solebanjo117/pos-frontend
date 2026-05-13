<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3';
import {
    Save,
    Plus,
    Trash2,
    Search,
    Package,
    MoreVertical,
    Pencil,
    ExternalLink,
} from 'lucide-vue-next';
import { ref, computed, onMounted, watch } from 'vue';
import ProductVariantFormModal from '@/components/Products/ProductVariantFormModal.vue';
import ProductVariantPickerModal from '@/components/Products/ProductVariantPickerModal.vue';
import PurchaseOrderSection from '@/components/PurchaseOrders/PurchaseOrderSection.vue';
import PurchaseOrderToolbar from '@/components/PurchaseOrders/PurchaseOrderToolbar.vue';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import SearchableSelect, {
    type SelectOption,
} from '@/components/ui/SearchableSelect.vue';
import { usePosSettings } from '@/composables/usePosSettings';
import { usePurchaseOrders } from '@/composables/usePurchaseOrders';
import { useSuppliers } from '@/composables/useSuppliers';
import AppLayout from '@/layouts/AppLayout.vue';
import apiClient from '@/services/api/client';
import { purchaseOrdersService } from '@/services/purchase-orders';
import { suppliersService } from '@/services/suppliers';
import type { ProductVariantSelection } from '@/types/product-variant-picker';
import type {
    CreatePurchaseOrderData,
    PurchaseOrderCandidateItem,
    PurchaseOrderCandidateSource,
    PurchaseOrderWarning,
} from '@/types/purchase-order';

const props = defineProps<{ purchaseOrderId?: number }>();

const {
    loading,
    error,
    createPurchaseOrder,
    updatePurchaseOrder,
    fetchPurchaseOrderById,
    purchaseOrder,
} = usePurchaseOrders();
const { fetchActiveSuppliers } = useSuppliers();
const {
    fetchSettings,
    initWarehouse,
    currentWarehouseId,
    getDefaultWarehouseId,
} = usePosSettings();

const isEditing = computed(() => !!props.purchaseOrderId);

const suppliers = ref<any[]>([]);
const warehouses = ref<any[]>([]);
const productFilterCategories = ref<Array<{ id: number; name: string }>>([]);
const productFilterBrands = ref<Array<{ id: number; name: string }>>([]);
const productSearch = ref('');
const searchResults = ref<any[]>([]);
const searchingProducts = ref(false);
const showProductPicker = ref(false);
const showVariantEditModal = ref(false);
const variantEditTarget = ref<{
    productId: number;
    variantId: number;
    productName: string;
} | null>(null);
const pickerProducts = ref<any[]>([]);
const pickerTotal = ref(0);
const pickerCurrentPage = ref(1);
const pickerLastPage = ref(1);
const pickerLoading = ref(false);
const pickerLoadingMore = ref(false);
const pickerFilters = ref<{
    query: string;
    category_ids?: number[];
    brand_ids?: number[];
    min_price?: number;
    max_price?: number;
    in_stock?: boolean;
    sort?: string;
}>({ query: '' });
const entryMode = ref<'manual' | 'list'>('manual');
const candidateSource = ref<PurchaseOrderCandidateSource>('low_stock');
const candidateSupplyDate = ref(new Date().toISOString().split('T')[0]);
const candidateRows = ref<
    Array<
        PurchaseOrderCandidateItem & {
            selected: boolean;
            quantity: number;
            units_per_package: number;
            cost: number;
            tax_rate: number;
        }
    >
>([]);
const loadingCandidates = ref(false);
const candidateError = ref<string | null>(null);
const supplierWarnings = ref<PurchaseOrderWarning[]>([]);
const selectedSupplierBrandIds = ref<number[]>([]);
const selectedSupplierProductLinks = ref<any[]>([]);

const form = ref<CreatePurchaseOrderData>({
    supplier_id: 0,
    warehouse_id: 0,
    supplier_invoice_number: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_date: '',
    tax_amount: 0,
    shipping_cost: 0,
    notes: '',
    source_supply_list_item_ids: [],
    items: [],
});

const subtotal = computed(() =>
    form.value.items.reduce(
        (sum, item: any) =>
            sum +
            item.quantity_ordered *
                (item.units_per_package ?? 1) *
                item.unit_cost,
        0,
    ),
);

const normalizeTaxRate = (value: unknown): number => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return 7;
    }

    return Math.max(0, Math.min(100, Math.round(parsed)));
};

const normalizeQuantity = (value: unknown): number => {
    const parsed = Math.floor(Number(value) || 1);
    return Math.max(1, isNaN(parsed) ? 1 : parsed);
};

const itemSubtotal = (item: any): number =>
    Number(item.quantity_ordered || 0) *
    Number(item.units_per_package || 1) *
    Number(item.unit_cost || 0);

function syncAutoTax(item: any) {
    if (!item._taxManual) {
        item.tax_amount = Math.round(itemSubtotal(item) * 0.07 * 100) / 100;
    }
}

const itemTaxAmount = (item: any): number => {
    if (item._taxManual) return Number(item.tax_amount || 0);
    return Math.round(itemSubtotal(item) * 0.07 * 100) / 100;
};

const itemLineTotal = (item: any): number =>
    itemSubtotal(item) + Number(item.misc_cost || 0) + itemTaxAmount(item);

const taxTotal = computed(() =>
    form.value.items.reduce((sum, item: any) => sum + itemTaxAmount(item), 0),
);

const miscTotal = computed(() =>
    form.value.items.reduce(
        (sum, item: any) => sum + Number(item.misc_cost || 0),
        0,
    ),
);

const total = computed(
    () =>
        subtotal.value +
        taxTotal.value +
        miscTotal.value +
        (form.value.shipping_cost || 0),
);

const supplierOptions = computed<SelectOption[]>(() => [
    { value: 0, label: 'Selecciona un proveedor' },
    ...suppliers.value.map((s) => ({ value: s.id, label: s.name })),
]);

const warehouseOptions = computed<SelectOption[]>(() => [
    { value: 0, label: 'Selecciona un almacén' },
    ...warehouses.value.map((w) => ({ value: w.id, label: w.name })),
]);

const selectedCandidateCount = computed(
    () => candidateRows.value.filter((row) => row.selected).length,
);

const toolbarTitle = computed(() =>
    isEditing.value
        ? `PO: ${purchaseOrder.value?.po_number || props.purchaseOrderId}`
        : 'Nueva OC individual',
);

const toolbarSubtitle = computed(() => {
    const supplier = suppliers.value.find(
        (item) => Number(item.id) === Number(form.value.supplier_id),
    )?.name;
    const warehouse = warehouses.value.find(
        (item) => Number(item.id) === Number(form.value.warehouse_id),
    )?.name;

    return [supplier, warehouse, `$${total.value.toFixed(2)}`]
        .filter(Boolean)
        .join(' | ');
});

const canLoadCandidates = computed(
    () => !!form.value.supplier_id && !!form.value.warehouse_id,
);

function supplierRelationFor(row: any) {
    const supplierId = Number(form.value.supplier_id);
    if (!supplierId) {
        return null;
    }

    if (Array.isArray(row.suppliers)) {
        const directRelation = row.suppliers.find(
            (supplier: any) => Number(supplier.id) === supplierId,
        );

        if (directRelation) {
            return directRelation;
        }
    }

    const variantId = Number(row.id ?? row.variant_id ?? 0) || null;
    const productId = Number(row.product_id ?? 0) || null;
    const productLink = selectedSupplierProductLinks.value.find(
        (link) =>
            productId &&
            Number(link.product_id) === productId &&
            ((variantId && Number(link.variant_id) === variantId) ||
                link.variant_id === null ||
                link.variant_id === undefined),
    );

    if (productLink) {
        return productLink;
    }

    const brandId = Number(row.brand_id ?? row.brand?.id ?? 0) || null;
    if (
        brandId &&
        selectedSupplierBrandIds.value.some((id) => Number(id) === brandId)
    ) {
        return {
            id: supplierId,
            supplier_cost: null,
            lead_time_days: null,
            minimum_order_quantity: null,
        };
    }

    return null;
}

async function loadSelectedSupplierContext() {
    const supplierId = Number(form.value.supplier_id);

    if (!supplierId) {
        selectedSupplierBrandIds.value = [];
        selectedSupplierProductLinks.value = [];
        return;
    }

    try {
        const [supplierResponse, brands] = await Promise.all([
            suppliersService.getById(supplierId),
            suppliersService.getBrands(supplierId),
        ]);

        selectedSupplierBrandIds.value = (brands || []).map((brand: any) =>
            Number(brand.id),
        );
        selectedSupplierProductLinks.value = (
            supplierResponse.products || []
        ).map((link: any) => ({
            product_id: Number(link.product_id),
            variant_id:
                link.variant_id === null || link.variant_id === undefined
                    ? null
                    : Number(link.variant_id),
            supplier_cost: link.supplier_cost,
            lead_time_days: link.lead_time_days,
            minimum_order_quantity: link.minimum_order_quantity,
            is_preferred: link.is_preferred,
        }));
    } catch (e) {
        selectedSupplierBrandIds.value = [];
        selectedSupplierProductLinks.value = [];
    }
}

function preselectCurrentWarehouse() {
    if (isEditing.value || form.value.warehouse_id) {
        return;
    }

    const resolvedWarehouseId =
        currentWarehouseId.value ?? getDefaultWarehouseId() ?? null;

    if (
        resolvedWarehouseId &&
        warehouses.value.some(
            (warehouse) => Number(warehouse.id) === Number(resolvedWarehouseId),
        )
    ) {
        form.value.warehouse_id = Number(resolvedWarehouseId);
    }
}

function candidateKey(row: {
    product_id: number;
    variant_id?: number | null;
}): string {
    return `${row.variant_id ?? 'nv'}|${row.product_id}`;
}

async function searchProducts() {
    if (productSearch.value.length < 2) {
        searchResults.value = [];
        return;
    }
    searchingProducts.value = true;
    try {
        const { data } = await apiClient.get('/products', {
            params: {
                search: productSearch.value,
                per_page: 20,
                with_variants: true,
            },
        });
        const products: any[] = data.data || [];
        const query = productSearch.value.toLowerCase();

        // Flatten products → variants, one entry per variant
        // Then keep only variants whose own fields match the search term
        const variantRows: any[] = [];
        for (const product of products) {
            const variants = product.variants?.length
                ? product.variants
                : product.default_variant
                  ? [product.default_variant]
                  : [];
            for (const variant of variants) {
                const brandName =
                    variant.brand?.name || product.brand?.name || '';
                const sku = variant.sku || product.sku || '';
                const supplierRelation = supplierRelationFor(variant);

                // Only include this variant if it directly matches the query
                const matches =
                    product.name.toLowerCase().includes(query) ||
                    sku.toLowerCase().includes(query) ||
                    brandName.toLowerCase().includes(query);

                if (!matches) continue;

                variantRows.push({
                    variant_id: variant.id,
                    product_id: product.id,
                    product_name: product.name,
                    sku,
                    brand_id: variant.brand_id || product.brand?.id || null,
                    brand_name: brandName,
                    suppliers: variant.suppliers ?? [],
                    is_supplied_by_selected_supplier: !!supplierRelation,
                    supplier_lead_time_days:
                        supplierRelation?.lead_time_days ?? null,
                    supplier_minimum_order_quantity:
                        supplierRelation?.minimum_order_quantity ?? null,
                    cost_base: variant.pricing?.cost_base ?? product.pricing?.cost_base ?? null,
                    cost_miscellaneous: variant.pricing?.cost_miscellaneous ?? product.pricing?.cost_miscellaneous ?? null,
                    cost:
                        supplierRelation?.supplier_cost ??
                        variant.pricing?.cost ??
                        product.pricing?.cost ??
                        0,
                });
            }
        }
        searchResults.value = variantRows;
    } catch (e) {
        searchResults.value = [];
    } finally {
        searchingProducts.value = false;
    }
}

async function fetchPickerProducts(append = false) {
    if (append && pickerCurrentPage.value >= pickerLastPage.value) {
        return;
    }

    if (append) {
        pickerLoadingMore.value = true;
    } else {
        pickerLoading.value = true;
        pickerCurrentPage.value = 1;
    }

    try {
        const page = append ? pickerCurrentPage.value + 1 : 1;
        const filters = pickerFilters.value;
        const { data } = await apiClient.get('/products', {
            params: {
                search: filters.query || undefined,
                category_id: filters.category_ids,
                brand_id: filters.brand_ids,
                min_price: filters.min_price,
                max_price: filters.max_price,
                in_stock: filters.in_stock,
                sort: filters.sort,
                page,
                per_page: 20,
                with_variants: true,
            },
        });

        const rows = data.data || [];
        pickerProducts.value = append
            ? [...pickerProducts.value, ...rows]
            : rows;
        pickerCurrentPage.value = data.meta?.current_page ?? page;
        pickerLastPage.value = data.meta?.last_page ?? page;
        pickerTotal.value = data.meta?.total ?? rows.length;
    } finally {
        pickerLoading.value = false;
        pickerLoadingMore.value = false;
    }
}

async function fetchProductFilterOptions() {
    try {
        const [categoriesResponse, brandsResponse] = await Promise.all([
            apiClient.get('/categories'),
            apiClient.get('/brands'),
        ]);

        productFilterCategories.value =
            categoriesResponse.data.data ?? categoriesResponse.data ?? [];
        productFilterBrands.value =
            brandsResponse.data.data ?? brandsResponse.data ?? [];
    } catch (e) {
        productFilterCategories.value = [];
        productFilterBrands.value = [];
    }
}

async function openProductPicker() {
    showProductPicker.value = true;
    pickerFilters.value = { query: productSearch.value };
    await loadSelectedSupplierContext();
    fetchPickerProducts();
}

function handlePickerSearch(filters: typeof pickerFilters.value) {
    pickerFilters.value = filters;
    productSearch.value = filters.query;
    fetchPickerProducts();
}

function addVariantSelections(selections: ProductVariantSelection[]) {
    selections.forEach(
        ({
            product,
            variant,
            quantity,
            unitCost,
            miscCost,
            supplierMatch,
            minimumOrderQuantity,
        }) => {
            if (
                form.value.items.find(
                    (item: any) =>
                        candidateKey(item) ===
                        candidateKey({
                            product_id: product.id,
                            variant_id: variant?.id ?? null,
                        }),
                )
            ) {
                return;
            }

            if (
                form.value.supplier_id &&
                supplierMatch === false &&
                !confirm(
                    'Esta variante no esta vinculada al proveedor seleccionado. Puedes continuar, pero la OC quedara con una advertencia. Deseas agregarla?',
                )
            ) {
                return;
            }

            const finalQty = normalizeQuantity(minimumOrderQuantity || quantity || 1);

            form.value.items.push({
                product_id: product.id,
                variant_id: variant?.id ?? null,
                quantity_ordered: finalQty,
                units_per_package: 1,
                unit_cost: unitCost || 0,
                misc_cost: miscCost || 0,
                tax_amount:
                    Math.round(
                        finalQty *
                            (unitCost || 0) *
                            0.07 *
                            100,
                    ) / 100,
                _taxManual: false,
                notes: '',
                _name: product.name,
                _sku: variant?.sku || product.sku_base || 'N/A',
                _brand: variant?.brand?.name || product.brand?.name || '',
            } as any);
        },
    );

    productSearch.value = '';
    searchResults.value = [];
    showProductPicker.value = false;
}

function addProduct(row: any) {
    // row is already a flat variant object from searchResults
    if (
        form.value.items.find((i: any) => candidateKey(i) === candidateKey(row))
    )
        return;

    if (
        form.value.supplier_id &&
        !row.is_supplied_by_selected_supplier &&
        !confirm(
            'Esta variante no está vinculada al proveedor seleccionado. Puedes continuar, pero la OC quedará con una advertencia. ¿Deseas agregarla?',
        )
    ) {
        return;
    }

    const qty = normalizeQuantity(row.supplier_minimum_order_quantity || 1);
    const unitCost = Number(row.cost_base ?? row.cost ?? 0);
    const miscCost = Number(row.cost_miscellaneous ?? 0);

    form.value.items.push({
        product_id: row.product_id,
        variant_id: row.variant_id,
        quantity_ordered: qty,
        units_per_package: 1,
        unit_cost: unitCost,
        misc_cost: miscCost,
        tax_amount:
            Math.round(
                qty *
                    unitCost *
                    0.07 *
                    100,
            ) / 100,
        _taxManual: false,
        notes: '',
        // Extra display fields (not sent to API)
        _name: row.product_name,
        _sku: row.sku,
        _brand: row.brand_name,
    } as any);
    productSearch.value = '';
    searchResults.value = [];
}

function removeItem(index: number) {
    const [removed] = form.value.items.splice(index, 1) as any[];
    const sourceIds = [
        ...(removed?._source_supply_list_item_ids ?? []),
        removed?._source_supply_list_item_id,
    ].filter(Boolean);

    if (sourceIds.length && form.value.source_supply_list_item_ids) {
        form.value.source_supply_list_item_ids =
            form.value.source_supply_list_item_ids.filter(
                (id) => !sourceIds.includes(id),
            );
    }
}

function openVariantEdit(idx: number) {
    const item = form.value.items[idx] as any;
    if (!item?.variant_id) return;
    variantEditTarget.value = {
        productId: item.product_id,
        variantId: item.variant_id,
        productName: item._name || 'Producto',
    };
    showVariantEditModal.value = true;
}

function handleVariantSaved(savedVariant: any) {
    if (!variantEditTarget.value) return;
    const { productId, variantId } = variantEditTarget.value;

    form.value.items.forEach((item: any) => {
        if (
            Number(item.product_id) === Number(productId) &&
            Number(item.variant_id) === Number(variantId)
        ) {
            if (savedVariant.brand?.name) item._brand = savedVariant.brand.name;
            if (savedVariant.sku) item._sku = savedVariant.sku;

            const newCostBase = Number(
                savedVariant._costBase ?? savedVariant.pricing?.cost_base ?? 0,
            );
            const newCostMisc = Number(
                savedVariant._costMiscellaneous ??
                    savedVariant.pricing?.cost_miscellaneous ??
                    0,
            );

            if (newCostBase > 0) {
                item.unit_cost = newCostBase;
                item.misc_cost = newCostMisc;
                syncAutoTax(item);
            }
        }
    });

    showVariantEditModal.value = false;
    variantEditTarget.value = null;
}

async function loadCandidateRows() {
    if (!canLoadCandidates.value) {
        candidateError.value = 'Selecciona proveedor y almacen primero';
        return;
    }

    loadingCandidates.value = true;
    candidateError.value = null;
    candidateRows.value = [];

    try {
        const rows = await purchaseOrdersService.getSupplierCandidates({
            supplier_id: Number(form.value.supplier_id),
            warehouse_id: Number(form.value.warehouse_id),
            source: candidateSource.value,
            supply_date:
                candidateSource.value === 'daily'
                    ? candidateSupplyDate.value
                    : undefined,
        });

        candidateRows.value = rows.map((row) => ({
            ...row,
            selected: false,
            quantity: normalizeQuantity(row.suggested_quantity || 1),
            units_per_package: Number((row as any).units_per_package || 1),
            cost: Number(row.unit_cost ?? row.cost_base ?? row.cost ?? 0),
            misc_cost: Number((row as any).cost_miscellaneous || 0),
            tax_rate: normalizeTaxRate(row.tax_rate),
        }));
    } catch (e: any) {
        candidateError.value =
            e.response?.data?.message || 'Error al cargar el listado';
    } finally {
        loadingCandidates.value = false;
    }
}

function toggleAllCandidates(checked: boolean) {
    candidateRows.value = candidateRows.value.map((row) => ({
        ...row,
        selected: checked,
    }));
}

function addSelectedCandidates() {
    const selected = candidateRows.value.filter((row) => row.selected);

    selected.forEach((row) => {
        const existing = form.value.items.find(
            (item: any) => candidateKey(item) === candidateKey(row),
        ) as any;

        if (existing) {
            existing.quantity_ordered += normalizeQuantity(row.quantity);
            if (!existing.units_per_package) {
                existing.units_per_package = normalizeQuantity(row.units_per_package);
            }

            if (!existing.unit_cost && row.cost) {
                existing.unit_cost = row.cost;
            }

            if (!existing.misc_cost && (row as any).misc_cost) {
                existing.misc_cost = (row as any).misc_cost;
            }

            syncAutoTax(existing);

            if (row.source_supply_list_item_id) {
                existing._source_supply_list_item_ids = [
                    ...(existing._source_supply_list_item_ids ?? []),
                    row.source_supply_list_item_id,
                ].filter(
                    (id: number, index: number, ids: number[]) =>
                        ids.indexOf(id) === index,
                );
            }
        } else {
            const finalQty = normalizeQuantity(row.quantity);
            const finalUnits = normalizeQuantity(row.units_per_package);

            form.value.items.push({
                product_id: row.product_id,
                variant_id: row.variant_id ?? null,
                quantity_ordered: finalQty,
                units_per_package: finalUnits,
                unit_cost: Number(row.cost || 0),
                misc_cost: Number((row as any).misc_cost || 0),
                tax_amount:
                    Math.round(
                        finalQty *
                            finalUnits *
                            Number(row.cost || 0) *
                            (normalizeTaxRate(row.tax_rate) / 100) *
                            100,
                    ) / 100,
                _taxManual: normalizeTaxRate(row.tax_rate) !== 7,
                notes: row.notes || '',
                _name: row.product_name,
                _sku: row.sku || 'N/A',
                _brand: '',
                _source_supply_list_item_id: row.source_supply_list_item_id,
                _source_supply_list_item_ids: row.source_supply_list_item_id
                    ? [row.source_supply_list_item_id]
                    : [],
            } as any);
        }

        if (row.source_supply_list_item_id) {
            const ids = form.value.source_supply_list_item_ids ?? [];
            if (!ids.includes(row.source_supply_list_item_id)) {
                form.value.source_supply_list_item_ids = [
                    ...ids,
                    row.source_supply_list_item_id,
                ];
            }
        }
    });

    candidateRows.value = candidateRows.value.map((row) =>
        row.selected ? { ...row, selected: false } : row,
    );
}

async function handleSubmit() {
    supplierWarnings.value = [];

    if (!form.value.supplier_id || !form.value.warehouse_id) {
        alert('Selecciona proveedor y almacén');
        return;
    }

    if (form.value.items.length === 0) {
        alert('Agrega al menos un producto');
        return;
    }
    try {
        const payload = {
            ...form.value,
            tax_amount: Number(taxTotal.value.toFixed(2)),
            items: form.value.items.map((item: any) => ({
                product_id: item.product_id,
                variant_id: item.variant_id,
                quantity_ordered: item.quantity_ordered,
                units_per_package: item.units_per_package || 1,
                unit_cost: item.unit_cost,
                misc_cost: item.misc_cost || 0,
                tax_amount: itemTaxAmount(item),
                notes: item.notes || '',
            })),
        };

        if (isEditing.value && props.purchaseOrderId) {
            const updated = await updatePurchaseOrder(
                props.purchaseOrderId,
                payload,
            );
            router.visit(`/purchase-orders/${updated.id}`);
        } else {
            const created = await createPurchaseOrder(payload);
            supplierWarnings.value = created.warnings ?? [];

            if (supplierWarnings.value.length) {
                alert(
                    supplierWarnings.value
                        .map((warning) => warning.message)
                        .join('\n'),
                );
            }

            router.visit(`/purchase-orders/${created.data.id}`);
        }
    } catch (e) {}
}

onMounted(async () => {
    // Load suppliers and warehouses
    await fetchSettings();
    await initWarehouse();
    await fetchProductFilterOptions();
    suppliers.value = await fetchActiveSuppliers();
    try {
        const { data } = await apiClient.get('/warehouses');
        warehouses.value = data.data || data || [];
        preselectCurrentWarehouse();
    } catch (e) {
        console.error('Error loading warehouses', e);
    }

    // If editing, load existing purchase order
    if (isEditing.value && props.purchaseOrderId) {
        await fetchPurchaseOrderById(props.purchaseOrderId);

        if (purchaseOrder.value) {
            // Populate form with existing data
            form.value = {
                supplier_id: purchaseOrder.value.supplier_id,
                warehouse_id: purchaseOrder.value.warehouse_id,
                supplier_invoice_number:
                    purchaseOrder.value.supplier_invoice_number || '',
                order_date: purchaseOrder.value.order_date,
                expected_date: purchaseOrder.value.expected_date || '',
                tax_amount: Number(purchaseOrder.value.tax_amount) || 0,
                shipping_cost: Number(purchaseOrder.value.shipping_cost) || 0,
                notes: purchaseOrder.value.notes || '',
                source_supply_list_item_ids: [],
                items: purchaseOrder.value.items.map((item: any) => ({
                    product_id: item.product_id,
                    variant_id: item.variant_id,
                    quantity_ordered: item.quantity_ordered,
                    units_per_package: item.units_per_package || 1,
                    unit_cost: Number(item.unit_cost),
                    misc_cost: Number(item.misc_cost || 0),
                    tax_amount: Number(item.tax_amount || 0),
                    _taxManual: true, // Existing records treated as manual to preserve exact amounts
                    notes: item.notes || '',
                    // Extra display fields
                    _name:
                        item.variant?.product?.name ||
                        item.product?.name ||
                        'Producto',
                    _sku: item.variant?.sku || item.product?.sku || 'N/A',
                    _brand: item.variant?.brand?.name || '',
                })),
            };
        }
    }
});

watch(
    () => form.value.supplier_id,
    () => {
        loadSelectedSupplierContext();
    },
);
</script>

<template>
    <Head
        :title="isEditing ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'"
    />
    <AppLayout>
        <PurchaseOrderToolbar
            :title="toolbarTitle"
            :subtitle="toolbarSubtitle"
            status-label="Borrador"
            :total="`$${total.toFixed(2)}`"
        >
            <template #actions>
                <Link
                    href="/purchase-orders"
                    class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-border dark:bg-card dark:text-gray-200 dark:hover:bg-muted"
                >
                    Cancelar
                </Link>
                <button
                    type="submit"
                    form="purchase-order-form"
                    :disabled="loading || form.items.length === 0"
                    class="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                    <Save :size="16" />
                    {{ loading ? 'Guardando...' : 'Guardar cambios' }}
                </button>
            </template>
        </PurchaseOrderToolbar>

        <div class="mx-auto max-w-7xl space-y-4 p-3">
            <div
                v-if="error"
                class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30"
            >
                <p class="text-red-600 dark:text-red-400">{{ error }}</p>
            </div>

            <form
                id="purchase-order-form"
                @submit.prevent="handleSubmit"
                @keydown.enter="
                    (e: KeyboardEvent) => {
                        if ((e.target as HTMLElement)?.tagName === 'INPUT')
                            e.preventDefault();
                    }
                "
                class="space-y-6"
            >
                <!-- Order Info -->
                <PurchaseOrderSection
                    title="Datos de la orden"
                    subtitle="Proveedor, almacen, factura y notas"
                    default-open
                >
                    <div class="p-4">
                        <h2
                            class="mb-4 text-lg font-semibold text-gray-900 dark:text-white"
                        >
                            Información del Pedido
                        </h2>
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Proveedor *</label
                                >
                                <SearchableSelect
                                    v-model="form.supplier_id"
                                    :options="supplierOptions"
                                    placeholder="Selecciona un proveedor"
                                />
                            </div>
                            <div>
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Almacén destino *</label
                                >
                                <SearchableSelect
                                    v-model="form.warehouse_id"
                                    :options="warehouseOptions"
                                    placeholder="Selecciona un almacén"
                                />
                            </div>
                            <div>
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Fecha del Pedido</label
                                >
                                <input
                                    v-model="form.order_date"
                                    type="date"
                                    class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>
                            <div>
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Factura proveedor</label
                                >
                                <input
                                    v-model="form.supplier_invoice_number"
                                    type="text"
                                    maxlength="100"
                                    placeholder="Ej: ASD1221"
                                    class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>
                            <div>
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Fecha Esperada</label
                                >
                                <input
                                    v-model="form.expected_date"
                                    type="date"
                                    class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>
                            <div>
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Envio</label
                                >
                                <input
                                    v-model.number="form.shipping_cost"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                />
                            </div>
                            <div class="md:col-span-2">
                                <label
                                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >Notas</label
                                >
                                <textarea
                                    v-model="form.notes"
                                    rows="2"
                                    class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                ></textarea>
                            </div>
                        </div>
                    </div>
                </PurchaseOrderSection>

                <!-- Products -->
                <PurchaseOrderSection
                    title="Articulos"
                    subtitle="Metodo manual o listado de abastecimiento"
                    :count="form.items.length"
                    default-open
                >
                    <div class="p-4">
                        <h2
                            class="mb-4 text-lg font-semibold text-gray-900 dark:text-white"
                        >
                            Productos
                        </h2>

                        <div
                            v-if="!isEditing"
                            class="mb-4 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-border dark:bg-muted/30"
                        >
                            <button
                                type="button"
                                @click="entryMode = 'manual'"
                                :class="[
                                    'rounded-md px-4 py-2 text-sm font-medium transition',
                                    entryMode === 'manual'
                                        ? 'bg-white text-indigo-600 shadow-sm dark:bg-card dark:text-primary'
                                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white',
                                ]"
                            >
                                Manual
                            </button>
                            <button
                                type="button"
                                @click="entryMode = 'list'"
                                :class="[
                                    'rounded-md px-4 py-2 text-sm font-medium transition',
                                    entryMode === 'list'
                                        ? 'bg-white text-indigo-600 shadow-sm dark:bg-card dark:text-primary'
                                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white',
                                ]"
                            >
                                Listado
                            </button>
                        </div>

                        <!-- Product Search -->
                        <div
                            v-if="entryMode === 'manual' || isEditing"
                            class="relative mb-4"
                        >
                            <button
                                type="button"
                                class="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3 text-left text-gray-900 transition hover:bg-gray-50 dark:border-border dark:bg-muted dark:text-white dark:hover:bg-muted/70"
                                @click="openProductPicker"
                            >
                                <span class="flex items-center gap-2 text-sm">
                                    <Search class="h-4 w-4 text-gray-400" />
                                    Buscar productos y seleccionar variantes
                                </span>
                                <span class="text-xs text-gray-500">
                                    {{ form.items.length }} agregado{{
                                        form.items.length !== 1 ? 's' : ''
                                    }}
                                </span>
                            </button>
                        </div>

                        <div
                            v-else
                            class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-muted/20"
                        >
                            <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
                                <div>
                                    <label
                                        class="mb-1 block text-xs font-semibold text-gray-500 uppercase dark:text-gray-400"
                                        >Origen</label
                                    >
                                    <select
                                        v-model="candidateSource"
                                        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                    >
                                        <option value="low_stock">
                                            Stock bajo
                                        </option>
                                        <option value="daily">OC diaria</option>
                                    </select>
                                </div>
                                <div v-if="candidateSource === 'daily'">
                                    <label
                                        class="mb-1 block text-xs font-semibold text-gray-500 uppercase dark:text-gray-400"
                                        >Fecha OC diaria</label
                                    >
                                    <input
                                        v-model="candidateSupplyDate"
                                        type="date"
                                        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                    />
                                </div>
                                <div class="flex items-end gap-2 md:col-span-2">
                                    <button
                                        type="button"
                                        @click="loadCandidateRows"
                                        :disabled="
                                            loadingCandidates ||
                                            !canLoadCandidates
                                        "
                                        class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                                    >
                                        <Search :size="16" />
                                        {{
                                            loadingCandidates
                                                ? 'Cargando...'
                                                : 'Cargar listado'
                                        }}
                                    </button>
                                    <p
                                        v-if="!canLoadCandidates"
                                        class="text-xs text-amber-600 dark:text-amber-300"
                                    >
                                        Selecciona proveedor y almacen.
                                    </p>
                                </div>
                            </div>

                            <div
                                v-if="candidateError"
                                class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
                            >
                                {{ candidateError }}
                            </div>

                            <div
                                v-if="candidateRows.length"
                                class="mt-4 rounded-lg border border-gray-200 bg-white dark:border-border dark:bg-card"
                            >
                                <table
                                    class="w-full table-fixed divide-y divide-gray-200 dark:divide-border"
                                >
                                    <thead
                                        class="bg-gray-50 dark:bg-background"
                                    >
                                        <tr>
                                            <th
                                                class="w-10 px-3 py-2 text-left"
                                            >
                                                <input
                                                    type="checkbox"
                                                    :checked="
                                                        selectedCandidateCount ===
                                                        candidateRows.length
                                                    "
                                                    @change="
                                                        toggleAllCandidates(
                                                            (
                                                                $event.target as HTMLInputElement
                                                            ).checked,
                                                        )
                                                    "
                                                />
                                            </th>
                                            <th
                                                class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                                            >
                                                Producto
                                            </th>
                                            <th
                                                class="w-24 px-3 py-2 text-right text-xs font-medium whitespace-nowrap text-gray-500 uppercase"
                                            >
                                                Qty
                                            </th>
                                            <th
                                                class="w-28 px-3 py-2 text-right text-xs font-medium whitespace-nowrap text-gray-500 uppercase"
                                            >
                                                Costo
                                            </th>
                                            <th
                                                class="w-24 px-3 py-2 text-right text-xs font-medium whitespace-nowrap text-gray-500 uppercase"
                                            >
                                                ITBM
                                            </th>
                                            <th
                                                class="w-24 px-3 py-2 text-right text-xs font-medium whitespace-nowrap text-gray-500 uppercase"
                                            >
                                                Misc
                                            </th>
                                            <th
                                                class="w-32 px-3 py-2 text-right text-xs font-medium whitespace-nowrap text-gray-500 uppercase"
                                            >
                                                Total
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody
                                        class="divide-y divide-gray-200 dark:divide-border"
                                    >
                                        <tr
                                            v-for="row in candidateRows"
                                            :key="row.id"
                                            class="hover:bg-gray-50 dark:hover:bg-muted/30"
                                        >
                                            <td class="px-3 py-2">
                                                <input
                                                    v-model="row.selected"
                                                    type="checkbox"
                                                />
                                            </td>
                                            <td class="px-3 py-2">
                                                <p
                                                    class="truncate text-sm font-medium text-gray-900 dark:text-white"
                                                >
                                                    {{ row.product_name }}
                                                </p>
                                                <p
                                                    class="truncate font-mono text-xs text-gray-500"
                                                >
                                                    {{ row.sku || 'N/A' }}
                                                </p>
                                            </td>
                                            <td class="px-3 py-2">
                                                <input
                                                    v-model.number="
                                                        row.quantity
                                                    "
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    @blur="
                                                        row.quantity = normalizeQuantity(row.quantity)
                                                    "
                                                    class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-right text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                                />
                                            </td>
                                            <td class="px-3 py-2">
                                                <input
                                                    v-model.number="row.cost"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-right text-sm text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                                />
                                            </td>
                                            <td
                                                class="px-3 py-2 text-right text-sm font-medium text-gray-600 dark:text-gray-300"
                                            >
                                                ${{
                                                    (
                                                        row.quantity *
                                                        (row.units_per_package || 1) *
                                                        row.cost *
                                                        (row.tax_rate / 100)
                                                    ).toFixed(2)
                                                }}
                                            </td>
                                            <td class="px-3 py-2 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                                                $0.00
                                            </td>
                                            <td
                                                class="px-3 py-2 text-right text-sm font-medium text-gray-900 dark:text-white"
                                            >
                                                ${{
                                                    (
                                                        (row.quantity * (row.units_per_package || 1) * row.cost) *
                                                        (1 + row.tax_rate / 100)
                                                    ).toFixed(2)
                                                }}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <div
                                    class="flex justify-end border-t border-gray-200 p-3 dark:border-border"
                                >
                                    <button
                                        type="button"
                                        @click="addSelectedCandidates"
                                        :disabled="selectedCandidateCount === 0"
                                        class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                                    >
                                        <Plus :size="16" />
                                        Agregar seleccionados
                                    </button>
                                </div>
                            </div>

                            <div
                                v-else-if="!loadingCandidates"
                                class="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-border dark:text-gray-400"
                            >
                                Carga un listado para seleccionar piezas del
                                proveedor.
                            </div>
                        </div>

                        <!-- Items Table -->
                        <div v-if="form.items.length" class="border border-gray-200 dark:border-border rounded-lg">
                            <table
                                class="w-full table-fixed divide-y divide-gray-200 dark:divide-border"
                            >
                                <thead class="bg-gray-50 dark:bg-background">
                                    <tr>
                                        <th
                                            class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                                        >
                                            Producto
                                        </th>
                                        <th
                                            class="w-24 px-4 py-2 text-right text-xs font-medium whitespace-nowrap text-gray-500 uppercase"
                                        >
                                            Qty
                                        </th>
                                        <th
                                            class="w-28 px-4 py-2 text-right text-xs font-medium whitespace-nowrap text-gray-500 uppercase"
                                        >
                                            Costo
                                        </th>
                                        <th
                                            class="w-32 px-4 py-2 text-right text-xs font-medium whitespace-nowrap text-gray-500 uppercase"
                                        >
                                            ITBM
                                        </th>
                                        <th
                                            class="w-28 px-4 py-2 text-right text-xs font-medium whitespace-nowrap text-gray-500 uppercase"
                                        >
                                            Misc
                                        </th>
                                        <th
                                            class="w-32 px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"
                                        >
                                            Total
                                        </th>
                                        <th class="w-10 px-2 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody
                                    class="divide-y divide-gray-200 dark:divide-border"
                                >
                                    <tr
                                        v-for="(item, idx) in form.items"
                                        :key="idx"
                                        class="group"
                                        @contextmenu.prevent="
                                            (e: MouseEvent) => {
                                                (e.currentTarget as HTMLElement)
                                                    .querySelector<HTMLButtonElement>(
                                                        '[data-row-menu]',
                                                    )
                                                    ?.click();
                                            }
                                        "
                                    >
                                        <td class="px-4 py-2">
                                            <p
                                                class="truncate text-sm font-medium text-gray-900 dark:text-white"
                                            >
                                                {{ (item as any)._name }}
                                            </p>
                                            <p class="truncate text-xs text-gray-500">
                                                <span
                                                    v-if="(item as any)._brand"
                                                    class="mr-1 font-medium text-indigo-600 dark:text-indigo-400 dark:text-primary"
                                                    >{{
                                                        (item as any)._brand
                                                    }}</span
                                                >
                                                {{ (item as any)._sku }}
                                            </p>
                                        </td>
                                        <td class="px-4 py-2">
                                            <input
                                                v-model.number="
                                                    item.quantity_ordered
                                                "
                                                type="number"
                                                min="1"
                                                step="1"
                                                @input="
                                                    syncAutoTax(item as any)
                                                "
                                                @blur="
                                                    item.quantity_ordered = normalizeQuantity(item.quantity_ordered);
                                                    syncAutoTax(item as any);
                                                "
                                                class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-right text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                            />
                                        </td>
                                        <td class="px-4 py-2">
                                            <input
                                                v-model.number="item.unit_cost"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                @input="
                                                    syncAutoTax(item as any)
                                                "
                                                class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-right text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                            />
                                        </td>
                                        <td class="px-4 py-2">
                                            <div
                                                class="flex items-center gap-1"
                                            >
                                                <input
                                                    :value="
                                                        (item as any).tax_amount
                                                    "
                                                    @input="
                                                        (e: Event) => {
                                                            (
                                                                item as any
                                                            ).tax_amount =
                                                                parseFloat(
                                                                    (
                                                                        e.target as HTMLInputElement
                                                                    ).value,
                                                                ) || 0;
                                                            (
                                                                item as any
                                                            )._taxManual = true;
                                                        }
                                                    "
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    :title="
                                                        (item as any)._taxManual
                                                            ? 'ITBM manual — haz clic en ✕ para volver a automático'
                                                            : 'ITBM auto (7%)'
                                                    "
                                                    :class="[
                                                        'w-full rounded border px-2 py-1 text-right text-sm',
                                                        (item as any)._taxManual
                                                            ? 'border-blue-400 bg-blue-50 text-blue-900 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-100'
                                                            : 'border-gray-300 bg-white text-gray-900 dark:border-border dark:bg-muted dark:text-white',
                                                    ]"
                                                />
                                                <button
                                                    v-if="
                                                        (item as any)._taxManual
                                                    "
                                                    type="button"
                                                    title="Volver a automático (7%)"
                                                    @click="
                                                        (
                                                            item as any
                                                        )._taxManual = false;
                                                        syncAutoTax(
                                                            item as any,
                                                        );
                                                    "
                                                    class="shrink-0 rounded p-0.5 text-blue-500 hover:text-red-500"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </td>
                                        <td class="px-4 py-2">
                                            <input
                                                v-model.number="
                                                    (item as any).misc_cost
                                                "
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-right text-gray-900 dark:border-border dark:bg-muted dark:text-white"
                                            />
                                        </td>
                                        <td
                                            class="px-4 py-2 text-right text-sm font-semibold text-gray-900 dark:text-white"
                                        >
                                            ${{
                                                itemLineTotal(item).toFixed(2)
                                            }}
                                        </td>
                                        <td class="px-2 py-2 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger as-child>
                                                    <button
                                                        type="button"
                                                        data-row-menu
                                                        class="rounded p-1 text-gray-400 opacity-0 transition group-hover:opacity-100 hover:text-gray-700 focus:opacity-100 dark:hover:text-gray-200"
                                                        title="Acciones"
                                                    >
                                                        <MoreVertical
                                                            :size="16"
                                                        />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="end"
                                                    class="w-48"
                                                >
                                                    <DropdownMenuItem
                                                        v-if="
                                                            (item as any)
                                                                .product_id
                                                        "
                                                        as-child
                                                    >
                                                        <a
                                                            :href="`/products/${(item as any).product_id}`"
                                                            target="_blank"
                                                            class="flex items-center gap-2"
                                                        >
                                                            <ExternalLink
                                                                :size="14"
                                                            />
                                                            Ver producto
                                                        </a>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        :disabled="
                                                            !(item as any)
                                                                .variant_id
                                                        "
                                                        @click="
                                                            (item as any)
                                                                .variant_id &&
                                                            openVariantEdit(idx)
                                                        "
                                                        class="flex items-center gap-2"
                                                        :class="{
                                                            'cursor-not-allowed opacity-40':
                                                                !(item as any)
                                                                    .variant_id,
                                                        }"
                                                    >
                                                        <Pencil :size="14" />
                                                        Editar variante
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        @click="removeItem(idx)"
                                                        class="flex items-center gap-2 text-red-600 focus:text-red-600 dark:text-red-400"
                                                    >
                                                        <Trash2 :size="14" />
                                                        Quitar de la OC
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div v-else class="py-8 text-center text-gray-400">
                            <Package class="mx-auto mb-2" :size="36" />
                            <p class="text-sm">
                                Busca y agrega productos al pedido
                            </p>
                        </div>
                    </div>
                </PurchaseOrderSection>

                <div
                    class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-border"
                >
                    <div class="text-sm text-gray-500 dark:text-gray-400">
                        <span class="mr-4"
                            >Subtotal: ${{ subtotal.toFixed(2) }}</span
                        >
                        <span class="mr-4"
                            >ITBM: ${{ taxTotal.toFixed(2) }}</span
                        >
                        <span class="mr-4"
                            >Misc: ${{ miscTotal.toFixed(2) }}</span
                        >
                        <span
                            class="font-semibold text-gray-900 dark:text-white"
                            >Total: ${{ total.toFixed(2) }}</span
                        >
                    </div>
                    <div class="flex justify-end gap-3">
                        <Link
                            href="/purchase-orders"
                            class="rounded-lg px-4 py-2 text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-muted/50"
                        >
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            :disabled="loading || form.items.length === 0"
                            class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                            <Save :size="18" />
                            {{
                                loading
                                    ? isEditing
                                        ? 'Actualizando...'
                                        : 'Creando...'
                                    : isEditing
                                      ? 'Actualizar Orden'
                                      : 'Crear Orden de Compra'
                            }}
                        </button>
                    </div>
                </div>
            </form>
        </div>

        <ProductVariantPickerModal
            :show="showProductPicker"
            :products="pickerProducts"
            :search-query="productSearch"
            :total-count="pickerTotal"
            :has-more="pickerCurrentPage < pickerLastPage"
            :loading-more="pickerLoadingMore"
            :loading="pickerLoading"
            :categories="productFilterCategories"
            :brands="productFilterBrands"
            :selected-supplier-id="form.supplier_id || null"
            :selected-supplier-brand-ids="selectedSupplierBrandIds"
            :selected-supplier-product-links="selectedSupplierProductLinks"
            title="Seleccionar variantes para OC"
            confirm-label="Agregar a OC"
            context="purchase"
            @close="showProductPicker = false"
            @confirm="addVariantSelections"
            @load-more="fetchPickerProducts(true)"
            @search="handlePickerSearch"
        />

        <ProductVariantFormModal
            v-if="variantEditTarget"
            :open="showVariantEditModal"
            :product-id="variantEditTarget.productId"
            :variant-id="variantEditTarget.variantId"
            :product-name="variantEditTarget.productName"
            @update:open="showVariantEditModal = $event"
            @saved="handleVariantSaved"
        />
    </AppLayout>
</template>
