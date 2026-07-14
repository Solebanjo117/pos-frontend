<script setup lang="ts">
import { Clock3, Edit3, Save, X } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import {
    fetchBusinessDatetime,
    updateBusinessDatetime,
    type BusinessDatetimeAudit,
    type BusinessDatetimeRecordType,
} from '@/services/business-datetime';
import { formatReportDateTime } from '@/utils/formatters';

const props = withDefaults(
    defineProps<{
        recordType: BusinessDatetimeRecordType;
        recordId: number;
        createdAt?: string | null;
        businessDatetime?: string | null;
        compact?: boolean;
    }>(),
    {
        createdAt: null,
        businessDatetime: null,
        compact: false,
    },
);

const emit = defineEmits<{
    updated: [businessDatetime: string | null];
}>();

const { isAdmin } = useAuth();
const toast = useToast();

const editing = ref(false);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const localBusinessDatetime = ref<string | null>(props.businessDatetime);
const audits = ref<BusinessDatetimeAudit[]>([]);
const form = ref({
    business_datetime: '',
    reason: '',
});

watch(
    () => props.businessDatetime,
    (value) => {
        localBusinessDatetime.value = value ?? null;
    },
);

onMounted(() => {
    if (!props.compact) {
        void loadAudit();
    }
});

const effectiveDatetime = computed(
    () => localBusinessDatetime.value || props.createdAt || null,
);

const latestAudit = computed(() => audits.value[0] ?? null);

function formatDateTime(value?: string | null): string {
    return formatReportDateTime(value);
}

function toDateTimeLocal(value?: string | null): string {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
}

async function loadAudit(): Promise<void> {
    if (!isAdmin.value || loading.value) return;

    loading.value = true;
    error.value = null;

    try {
        const detail = await fetchBusinessDatetime(
            props.recordType,
            props.recordId,
        );
        localBusinessDatetime.value = detail.business_datetime ?? null;
        audits.value = detail.audits ?? [];
    } catch (err: any) {
        error.value =
            err.response?.data?.message ||
            err.message ||
            'No se pudo cargar el historial.';
    } finally {
        loading.value = false;
    }
}

async function startEditing(): Promise<void> {
    form.value = {
        business_datetime: toDateTimeLocal(effectiveDatetime.value),
        reason: '',
    };
    editing.value = true;
    await loadAudit();
}

function cancelEditing(): void {
    editing.value = false;
    error.value = null;
}

async function save(): Promise<void> {
    if (!form.value.business_datetime || form.value.reason.trim().length < 5) {
        error.value = 'Indica fecha/hora y un motivo de al menos 5 caracteres.';
        return;
    }

    saving.value = true;
    error.value = null;

    try {
        const detail = await updateBusinessDatetime(
            props.recordType,
            props.recordId,
            {
                business_datetime: form.value.business_datetime,
                reason: form.value.reason.trim(),
            },
        );

        localBusinessDatetime.value = detail.business_datetime ?? null;
        audits.value = detail.latest_audit
            ? [detail.latest_audit, ...audits.value]
            : audits.value;
        editing.value = false;
        emit('updated', localBusinessDatetime.value);
        toast.success('Fecha/hora operativa actualizada.');
    } catch (err: any) {
        const validationErrors = err.response?.data?.errors;
        const validationMessage =
            validationErrors && typeof validationErrors === 'object'
                ? Object.values(validationErrors as Record<string, unknown>)
                      .flatMap((value) =>
                          Array.isArray(value) ? value : [value],
                      )
                      .filter((value): value is string => typeof value === 'string')
                      .join(' ')
            : null;
        error.value =
            validationMessage ||
            err.response?.data?.message ||
            err.message ||
            'No se pudo actualizar la fecha/hora operativa.';
        toast.error(error.value ?? 'No se pudo actualizar la fecha/hora operativa.');
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <div
        :class="[
            'rounded-md border border-gray-200 bg-white text-sm dark:border-border dark:bg-card',
            compact ? 'p-2' : 'p-3',
        ]"
    >
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
                <p
                    class="flex items-center gap-1 text-xs font-semibold uppercase text-gray-500"
                >
                    <Clock3 class="h-3.5 w-3.5" />
                    Fecha y hora
                </p>
                <p class="mt-1 font-medium text-gray-950 dark:text-white">
                    {{ formatDateTime(effectiveDatetime) }}
                </p>
                <p class="mt-0.5 text-xs text-gray-500">
                    Real: {{ formatDateTime(props.createdAt) }}
                </p>
                <p
                    v-if="latestAudit"
                    class="mt-1 truncate text-xs text-gray-500"
                    :title="latestAudit.reason"
                >
                    Ultimo ajuste: {{ latestAudit.changed_by?.name || 'Admin' }}
                    · {{ formatDateTime(latestAudit.changed_at) }}
                </p>
            </div>

            <button
                v-if="isAdmin && !editing"
                type="button"
                class="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200 dark:hover:bg-muted"
                @click="startEditing"
            >
                <Edit3 class="h-3.5 w-3.5" />
                Editar
            </button>
        </div>

        <div v-if="editing" class="mt-3 space-y-2">
            <input
                v-model="form.business_datetime"
                type="datetime-local"
                class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-background dark:text-white"
            />
            <textarea
                v-model="form.reason"
                rows="2"
                placeholder="Motivo obligatorio"
                class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-background dark:text-white"
            />
            <p v-if="error" class="text-xs font-medium text-red-600">
                {{ error }}
            </p>
            <div class="flex justify-end gap-2">
                <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:text-gray-200 dark:hover:bg-muted"
                    @click="cancelEditing"
                >
                    <X class="h-3.5 w-3.5" />
                    Cancelar
                </button>
                <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    :disabled="saving"
                    @click="save"
                >
                    <Save class="h-3.5 w-3.5" />
                    {{ saving ? 'Guardando...' : 'Guardar' }}
                </button>
            </div>
        </div>
    </div>
</template>
