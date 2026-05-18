import { ref } from 'vue';
import apiClient from '@/services/api/client';

export interface ProductFitment {
    id: number;
    product_id: number;
    engine_id: number;
    notes?: string;
    engine?: {
        id: number;
        engine_code: string;
        displacement: string;
        fuel_type: string;
        model?: {
            id: number;
            name: string;
            year_from?: number;
            year_to?: number;
            make?: {
                id: number;
                name: string;
            };
        };
    };
}

export function useProductFitment(productId: number) {
    const fitments = ref<ProductFitment[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    // Fetch existing fitments for this product
    const fetchFitments = async () => {
        loading.value = true;
        error.value = null;
        try {
            const response = await apiClient.get(
                `/products/${productId}/compatibility`,
            );
            fitments.value = response.data.data;
        } catch (err: any) {
            error.value =
                err.response?.data?.message || 'Error loading fitment data';
        } finally {
            loading.value = false;
        }
    };

    // Add a new fitment (compatibility)
    const addFitment = async (engineId: number, notes?: string) => {
        loading.value = true;
        error.value = null;
        try {
            const response = await apiClient.post('/product-compatibility', {
                product_id: productId,
                engine_id: engineId,
                notes: notes,
            });

            // Optimistically update list or handle duplicate gracefully
            const newFitment = response.data.data;

            // Check if it already existed in our list (rare race condition or idempotent backend response)
            const existingIndex = fitments.value.findIndex(
                (f) => f.engine_id === engineId,
            );
            if (existingIndex === -1) {
                fitments.value.push(newFitment);
            }

            return newFitment;
        } catch (err: any) {
            error.value = err.response?.data?.message || 'Error adding fitment';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    // Remove a fitment
    const removeFitment = async (fitmentId: number) => {
        // Optimistic remove for UI Responsiveness
        const originalList = [...fitments.value];
        fitments.value = fitments.value.filter((f) => f.id !== fitmentId);

        try {
            await apiClient.delete(`/product-compatibility/${fitmentId}`);
        } catch (err: any) {
            // Revert on error
            fitments.value = originalList;
            error.value =
                err.response?.data?.message || 'Error removing fitment';
            alert('Failed to remove compatibility');
        }
    };

    return {
        fitments,
        loading,
        error,
        fetchFitments,
        addFitment,
        removeFitment,
    };
}
