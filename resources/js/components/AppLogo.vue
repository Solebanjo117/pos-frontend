<script setup lang="ts">
import { onMounted } from 'vue';
import AppLogoIcon from '@/components/AppLogoIcon.vue';
import { useStoreSettings } from '@/composables/useStoreSettings';

const { settings, fetchSettings } = useStoreSettings();
// Ensure settings are loaded (composable is singleton, won't double-fetch)
onMounted(() => fetchSettings());
</script>

<template>
    <!-- Logo image or fallback icon -->
    <div
        class="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-md bg-transparent"
    >
        <img
            v-if="settings.store_logo_url"
            :src="settings.store_logo_url"
            :alt="settings.store_name"
            class="size-8 object-contain"
        />
        <AppLogoIcon v-else class="size-6" />
    </div>
    <div class="ml-1 grid flex-1 text-left text-sm">
        <span class="mb-0.5 truncate leading-tight font-semibold">
            {{ settings.store_name || 'HermeX POS' }}
        </span>
    </div>
</template>
