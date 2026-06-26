<script setup lang="ts">
import { Send, Save } from 'lucide-vue-next';
import { computed, reactive, ref } from 'vue';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/composables/useAuth';
import { changelogApi } from '@/services/api/changelog';

const emit = defineEmits<{
    saved: [];
}>();

const { hasRole } = useAuth();
const canManageChangelog = computed(() => hasRole(['admin', 'manager']));

const form = reactive({
    title: '',
    body: '',
    category: 'operations',
});

const saving = ref(false);
const message = ref<string | null>(null);
const error = ref<string | null>(null);

const canSubmit = computed(
    () => form.title.trim() !== '' && form.body.trim() !== '' && !saving.value,
);

const resetForm = () => {
    form.title = '';
    form.body = '';
    form.category = 'operations';
};

const submit = async (publish: boolean) => {
    if (!canSubmit.value) return;

    saving.value = true;
    message.value = null;
    error.value = null;

    try {
        const response = await changelogApi.createEntry({
            title: form.title.trim(),
            body: form.body.trim(),
            category: form.category,
            publish,
        });

        message.value =
            response.message ||
            (publish ? 'Nota publicada.' : 'Borrador guardado.');
        resetForm();
        emit('saved');
    } catch (err: any) {
        error.value =
            err?.response?.data?.message || 'No se pudo guardar la nota.';
    } finally {
        saving.value = false;
    }
};
</script>

<template>
    <form
        v-if="canManageChangelog"
        class="space-y-3 rounded-lg border bg-muted/20 p-3"
        @submit.prevent="submit(false)"
    >
        <div class="grid gap-2 sm:grid-cols-[1fr_160px]">
            <input
                v-model="form.title"
                type="text"
                maxlength="120"
                placeholder="Titulo de la nota"
                class="h-9 rounded-md border border-input bg-background px-3 text-sm transition-colors outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            <select
                v-model="form.category"
                class="h-9 rounded-md border border-input bg-background px-3 text-sm transition-colors outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            >
                <option value="operations">Operaciones</option>
                <option value="catalog">Catalogo</option>
                <option value="pos">POS</option>
                <option value="imports">Importadores</option>
                <option value="pricing">Precios</option>
                <option value="stability">Estabilidad</option>
                <option value="general">General</option>
            </select>
        </div>

        <textarea
            v-model="form.body"
            maxlength="1000"
            rows="3"
            placeholder="Describe el cambio para release notes"
            class="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />

        <div
            class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <p class="text-xs text-muted-foreground">
                Se guarda como borrador salvo que publiques ahora.
            </p>
            <div class="flex flex-wrap gap-2">
                <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    :disabled="!canSubmit"
                >
                    <Save class="size-4" />
                    Guardar borrador
                </Button>
                <Button
                    type="button"
                    size="sm"
                    :disabled="!canSubmit"
                    @click="submit(true)"
                >
                    <Send class="size-4" />
                    Publicar ahora
                </Button>
            </div>
        </div>

        <p
            v-if="message"
            class="text-xs font-medium text-emerald-600 dark:text-emerald-400"
        >
            {{ message }}
        </p>
        <p
            v-if="error"
            class="text-xs font-medium text-red-600 dark:text-red-400"
        >
            {{ error }}
        </p>
    </form>
</template>
