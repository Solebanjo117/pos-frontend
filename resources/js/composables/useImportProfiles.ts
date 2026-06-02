import { ref, type Ref } from 'vue';
import { importService } from '@/services/import';
import type { ImportProfile } from '@/types/import';

export interface UseImportProfilesOptions {
    entity: string;
    fieldMapping: Ref<Record<string, string>>;
    importMode: Ref<string>;
    selectedSheetIndex: Ref<number | null>;
}

export function useImportProfiles({
    entity,
    fieldMapping,
    importMode,
    selectedSheetIndex,
}: UseImportProfilesOptions) {
    const importProfiles = ref<ImportProfile[]>([]);
    const selectedProfileId = ref<number | null>(null);
    const profileDialogOpen = ref(false);
    const profileName = ref('');
    const profileSaving = ref(false);

    const loadImportProfiles = async (): Promise<void> => {
        if (!entity) {
            importProfiles.value = [];
            return;
        }

        const response = await importService.listProfiles(entity);
        importProfiles.value = response.data ?? [];
    };

    const applySelectedProfile = (): void => {
        const profile = importProfiles.value.find(
            (candidate) => candidate.id === selectedProfileId.value,
        );
        if (!profile) {
            return;
        }

        fieldMapping.value = { ...profile.mapping };
        if (profile.mode) {
            importMode.value = profile.mode;
        }
        if (profile.sheet_index !== undefined) {
            selectedSheetIndex.value = profile.sheet_index;
        }
    };

    const openProfileDialog = (): void => {
        profileName.value = '';
        profileDialogOpen.value = true;
    };

    const saveCurrentProfile = async (): Promise<ImportProfile | null> => {
        if (profileName.value.trim().length < 3) {
            return null;
        }

        profileSaving.value = true;
        try {
            const profile = await importService.saveProfile(entity, {
                name: profileName.value.trim(),
                mapping: fieldMapping.value,
                mode: importMode.value,
                sheet_index: selectedSheetIndex.value,
            });
            profileDialogOpen.value = false;
            selectedProfileId.value = profile.id;
            await loadImportProfiles();

            return profile;
        } finally {
            profileSaving.value = false;
        }
    };

    return {
        importProfiles,
        selectedProfileId,
        profileDialogOpen,
        profileName,
        profileSaving,
        loadImportProfiles,
        applySelectedProfile,
        openProfileDialog,
        saveCurrentProfile,
    };
}
