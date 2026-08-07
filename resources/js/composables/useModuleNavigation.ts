import { computed } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useStoreSettings } from '@/composables/useStoreSettings';
import {
    findModuleForPath,
    getVisibleModuleById,
    getVisibleModules,
    type ModuleId,
} from '@/navigation/modules';

export function useModuleNavigation() {
    const { role, canManageFinancialAdjustments } = useAuth();
    const { settings, fetchSettings } = useStoreSettings();

    const features = computed(() => ({
        workOrdersEnabled: settings.value.modules_work_orders_enabled,
        financialAdjustmentsEnabled: canManageFinancialAdjustments.value,
    }));

    const modules = computed(() =>
        getVisibleModules(role.value, features.value),
    );

    const getModule = (moduleId: ModuleId) =>
        computed(() =>
            getVisibleModuleById(moduleId, role.value, features.value),
        );

    return {
        modules,
        getModule,
        findModuleForPath,
        fetchSettings,
    };
}
