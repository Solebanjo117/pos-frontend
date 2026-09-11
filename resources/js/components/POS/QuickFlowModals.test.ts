// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AddCustomLineModal from './AddCustomLineModal.vue';
import QuickCustomerModal from './QuickCustomerModal.vue';
import QuickPurchaseModal from './QuickPurchaseModal.vue';

const mocks = vi.hoisted(() => ({
    getCustomerTypes: vi.fn(),
    post: vi.fn(),
    fetchActiveSuppliers: vi.fn(),
    quickReceive: vi.fn(),
    addSupplyItem: vi.fn(),
    submitting: { value: false },
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
}));

const { getCustomerTypes, post } = mocks;

vi.mock('@/services/customers', () => ({
    CustomersApiService: { getCustomerTypes: mocks.getCustomerTypes },
}));

vi.mock('@/services/api/client', () => ({
    default: { post: mocks.post },
}));

vi.mock('@/composables/useStoreSettings', () => ({
    useStoreSettings: () => ({ defaultTaxRate: () => 7 }),
}));

vi.mock('@/composables/useSuppliers', () => ({
    useSuppliers: () => ({ fetchActiveSuppliers: mocks.fetchActiveSuppliers }),
}));

vi.mock('@/composables/usePurchaseOrders', () => ({
    usePurchaseOrders: () => ({
        quickReceivePurchaseOrder: mocks.quickReceive,
        loading: mocks.submitting,
    }),
}));

vi.mock('@/composables/usePosSettings', () => ({
    usePosSettings: () => ({ currentWarehouseId: { value: 1 } }),
}));

vi.mock('@/composables/useToast', () => ({
    useToast: () => ({ error: mocks.toastError, success: mocks.toastSuccess }),
}));

vi.mock('@/services/supply-list', () => ({
    supplyListService: { addItem: mocks.addSupplyItem },
}));

describe('POS quick flow modals', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCustomerTypes.mockResolvedValue({
            data: {
                data: [
                    {
                        id: 4,
                        name: 'Individual',
                        normalized_name: 'individual',
                        base_kind: 'individual',
                        is_active: true,
                    },
                ],
            },
        });
        mocks.fetchActiveSuppliers.mockResolvedValue([]);
        mocks.submitting.value = false;
    });

    it('uses the real customer type contract and prevents duplicate submits', async () => {
        let resolvePost!: (value: unknown) => void;
        post.mockReturnValue(
            new Promise((resolve) => {
                resolvePost = resolve;
            }),
        );

        const wrapper = mount(QuickCustomerModal, { props: { show: true } });
        await flushPromises();
        const vm = wrapper.vm as any;
        vm.form.name = 'Cliente rápido';

        const first = vm.handleSubmit();
        const second = vm.handleSubmit();

        expect(post).toHaveBeenCalledTimes(1);
        expect(post).toHaveBeenCalledWith('/customers', {
            customer_type_id: 4,
            name: 'Cliente rápido',
            phone: undefined,
            email: undefined,
            credit_limit: 0,
            initial_balance: 0,
        });

        resolvePost({ data: { data: { id: 10, name: 'Cliente rápido' } } });
        await Promise.all([first, second]);
        expect(wrapper.emitted('created')).toHaveLength(1);
    });

    it('keeps backend field errors visible', async () => {
        post.mockRejectedValue({
            response: {
                data: {
                    message: 'Los datos proporcionados no son válidos.',
                    errors: { name: ['El nombre ya existe.'] },
                },
            },
        });
        const wrapper = mount(QuickCustomerModal, { props: { show: true } });
        await flushPromises();
        const vm = wrapper.vm as any;
        vm.form.name = 'Duplicado';
        await vm.handleSubmit();

        expect(wrapper.text()).toContain('El nombre ya existe.');
    });

    it('rejects fractional custom quantities and emits a valid line only once', async () => {
        const wrapper = mount(AddCustomLineModal, {
            props: { show: true, defaultTaxRate: 7 },
        });
        const vm = wrapper.vm as any;
        vm.form.custom_description = 'Instalación';
        vm.form.quantity = 1.5;
        vm.handleSubmit();
        expect(wrapper.emitted('submit')).toBeUndefined();
        expect(vm.error).toContain('numero entero');

        vm.form.quantity = 2;
        vm.handleSubmit();
        vm.handleSubmit();
        expect(wrapper.emitted('submit')).toHaveLength(1);
        expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
            custom_description: 'Instalación',
            quantity: 2,
            discount_amount: 0,
        });
    });

    it('clears stale purchase state and blocks a duplicate quick receipt', async () => {
        let resolvePurchase!: (value: unknown) => void;
        mocks.quickReceive.mockImplementation(() => {
            mocks.submitting.value = true;
            return new Promise((resolve) => {
                resolvePurchase = resolve;
            });
        });

        const product = {
            id: 20,
            name: 'Producto',
            variants: [{ id: 21, pricing: { cost: 5 } }],
            suppliers: [],
        };
        const wrapper = mount(QuickPurchaseModal, {
            props: { isOpen: true, product, initialVariantId: 21 },
            global: {
                stubs: {
                    Teleport: true,
                    SearchableSelect: true,
                },
            },
        });
        await flushPromises();
        const vm = wrapper.vm as any;
        vm.selectedSupplierId = 7;
        vm.unitCost = 5;

        const first = vm.handleQuickPurchase();
        const second = vm.handleQuickPurchase();
        expect(mocks.quickReceive).toHaveBeenCalledTimes(1);
        expect(mocks.quickReceive).toHaveBeenCalledWith(
            expect.objectContaining({
                idempotency_key: expect.stringMatching(
                    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
                ),
                supplier_id: 7,
                warehouse_id: 1,
            }),
        );

        resolvePurchase({ id: 30 });
        await Promise.all([first, second]);
        mocks.submitting.value = false;
        await wrapper.setProps({ isOpen: false });
        vm.selectedSupplierId = 99;
        await wrapper.setProps({ isOpen: true });
        await flushPromises();
        expect(vm.selectedSupplierId).toBe('');
    });
});
