import { ref, computed } from 'vue';
import { CustomersApiService } from '@/services/customers';
import type {
    Customer,
    CustomerFilters,
    CustomerFormData,
    CustomerBalanceSummary,
} from '@/types/customer';

export function useCustomers() {
    const customers = ref<Customer[]>([]);
    const currentCustomer = ref<Customer | null>(null);
    const balanceSummary = ref<CustomerBalanceSummary | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);

    // Pagination
    const currentPage = ref(1);
    const lastPage = ref(1);
    const total = ref(0);
    const perPage = ref(15);

    // Filters
    const filters = ref<CustomerFilters>({
        search: '',
        type: undefined,
        status: undefined,
        has_credit: undefined,
        order_by: 'name',
        order_direction: 'asc',
    });

    /**
     * Fla fetch all customers
     */
    const fetchCustomers = async (page = 1) => {
        loading.value = true;
        error.value = null;

        try {
            const response = await CustomersApiService.getCustomers(
                filters.value,
                page,
                perPage.value,
            );
            customers.value = response.data.data;
            currentPage.value = response.data.current_page;
            lastPage.value = response.data.last_page;
            total.value = response.data.total;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al cargar clientes';
            console.error('Error fetching customers:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Fetch single customer
     */
    const fetchCustomer = async (id: number) => {
        loading.value = true;
        error.value = null;

        try {
            const response = await CustomersApiService.getCustomer(id);
            currentCustomer.value = response.data.customer;
            balanceSummary.value = response.data.balance_summary;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al cargar cliente';
            console.error('Error fetching customer:', err);
        } finally {
            loading.value = false;
        }
    };

    /**
     * Search customers (autocomplete)
     */
    const searchCustomers = async (query: string, limit = 10) => {
        try {
            return await CustomersApiService.searchCustomers(query, limit);
        } catch (err: any) {
            console.error('Error searching customers:', err);
            return [];
        }
    };

    /**
     * Create new customer
     */
    const createCustomer = async (data: CustomerFormData) => {
        loading.value = true;
        error.value = null;

        try {
            const customer = await CustomersApiService.createCustomer(data);
            // Refresh list — wrap in try/catch so a refresh failure doesn't block the UI
            try {
                await fetchCustomers(currentPage.value);
            } catch {
                // List refresh failed, but creation succeeded — don't block
            }
            return customer;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al crear cliente';
            console.error('Error creating customer:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Update customer
     */
    const updateCustomer = async (
        id: number,
        data: Partial<CustomerFormData>,
    ) => {
        loading.value = true;
        error.value = null;

        try {
            const customer = await CustomersApiService.updateCustomer(id, data);
            await fetchCustomers(currentPage.value); // Refresh list
            return customer;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al actualizar cliente';
            console.error('Error updating customer:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Delete customer
     */
    const deleteCustomer = async (id: number) => {
        loading.value = true;
        error.value = null;

        try {
            await CustomersApiService.deleteCustomer(id);
            await fetchCustomers(currentPage.value);
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al eliminar cliente';
            console.error('Error deleting customer:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Adjust customer balance
     */
    const adjustBalance = async (
        id: number,
        amount: number,
        reason: string,
    ) => {
        loading.value = true;
        error.value = null;

        try {
            const response = await CustomersApiService.adjustBalance(
                id,
                amount,
                reason,
            );
            if (currentCustomer.value && currentCustomer.value.id === id) {
                currentCustomer.value.current_balance =
                    response.data.new_balance;
            }
            return response;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error al ajustar saldo';
            console.error('Error adjusting balance:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Apply filters and fetch
     */
    const applyFilters = async () => {
        currentPage.value = 1;
        await fetchCustomers(1);
    };

    /**
     * Clear filters
     */
    const clearFilters = () => {
        filters.value = {
            search: '',
            type: undefined,
            status: undefined,
            has_credit: undefined,
            order_by: 'name',
            order_direction: 'asc',
        };
        applyFilters();
    };

    return {
        // State
        customers,
        currentCustomer,
        balanceSummary,
        loading,
        error,
        filters,

        // Pagination
        currentPage,
        lastPage,
        total,
        perPage,

        // Methods
        fetchCustomers,
        fetchCustomer,
        searchCustomers,
        createCustomer,
        updateCustomer,
        deleteCustomer,
        adjustBalance,
        applyFilters,
        clearFilters,
    };
}
