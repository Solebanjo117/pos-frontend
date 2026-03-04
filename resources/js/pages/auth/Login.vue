<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { onMounted } from 'vue';
import { router } from '@inertiajs/vue3';

// Redirect to the welcome page which now contains the login form
onMounted(() => {
    router.visit('/');
});
</script>

<template>
    <Head title="Redireccionando…" />
    <div class="flex min-h-screen items-center justify-center">
        <p class="text-gray-500">Redireccionando…</p>
    </div>
</template>
