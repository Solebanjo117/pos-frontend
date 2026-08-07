<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3';
import axios from 'axios';
import {
    Check,
    KeyRound,
    Save,
    ShieldCheck,
    Store,
    UserRound,
    Users,
    X,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useToast } from '@/composables/useToast';
import AppLayout from '@/layouts/AppLayout.vue';
import SettingsLayout from '@/layouts/settings/Layout.vue';

const props = defineProps<{
    userId?: number;
    userData?: {
        id: number;
        name: string;
        username: string;
        email: string;
        role: string;
        is_active: boolean;
        can_manage_financial_adjustments?: boolean;
        warehouse_ids?: number[];
    };
    warehouses?: { id: number; name: string }[];
}>();

const toast = useToast();

const VALID_ROLES = [
    { value: 'admin', label: 'Administrador' },
    { value: 'manager', label: 'Gerente' },
    { value: 'seller', label: 'Vendedor' },
    { value: 'cashier', label: 'Cajero' },
    { value: 'buyer', label: 'Comprador' },
    { value: 'assistant', label: 'Secretari@' },
];

const isEditMode = computed(() => !!props.userId);
const pageTitle = computed(() =>
    isEditMode.value ? 'Editar usuario' : 'Nuevo usuario',
);
const isAdminRole = computed(() => form.value.role === 'admin');
const canReceiveFinancialAdjustmentPermission = computed(() =>
    ['admin', 'manager'].includes(form.value.role),
);
const selectedWarehouseCount = computed(() => form.value.warehouse_ids.length);

const form = ref({
    name: props.userData?.name ?? '',
    username: props.userData?.username ?? '',
    email: props.userData?.email ?? '',
    password: '',
    password_confirmation: '',
    role: props.userData?.role ?? 'cashier',
    is_active: props.userData?.is_active ?? true,
    can_manage_financial_adjustments:
        props.userData?.can_manage_financial_adjustments ??
        props.userData?.role === 'admin',
    warehouse_ids: props.userData?.warehouse_ids ?? ([] as number[]),
});

const errors = ref<Record<string, string>>({});
const loading = ref(false);

const toggleWarehouse = (id: number) => {
    const idx = form.value.warehouse_ids.indexOf(id);
    if (idx >= 0) {
        form.value.warehouse_ids.splice(idx, 1);
    } else {
        form.value.warehouse_ids.push(id);
    }
};

const selectAllWarehouses = () => {
    form.value.warehouse_ids =
        props.warehouses?.map((warehouse) => warehouse.id) ?? [];
};

const deselectAllWarehouses = () => {
    form.value.warehouse_ids = [];
};

const validate = (): boolean => {
    errors.value = {};

    if (!form.value.name.trim()) {
        errors.value.name = 'El nombre es requerido';
    }

    if (!form.value.username.trim()) {
        errors.value.username = 'El nombre de usuario es requerido';
    }

    if (!form.value.email.trim()) {
        errors.value.email = 'El email es requerido';
    }

    if (!isEditMode.value && !form.value.password) {
        errors.value.password = 'La contrasena es requerida';
    }

    if (
        form.value.password &&
        form.value.password !== form.value.password_confirmation
    ) {
        errors.value.password_confirmation = 'Las contrasenas no coinciden';
    }

    if (!isAdminRole.value && form.value.warehouse_ids.length === 0) {
        errors.value.warehouse_ids = 'Debe asignar al menos un almacen';
    }

    return Object.keys(errors.value).length === 0;
};

const submit = async () => {
    if (!validate()) {
        return;
    }

    loading.value = true;
    try {
        if (isEditMode.value) {
            const payload: any = {
                name: form.value.name,
                username: form.value.username,
                email: form.value.email,
                role: form.value.role,
                is_active: form.value.is_active,
                can_manage_financial_adjustments:
                    form.value.can_manage_financial_adjustments,
                warehouse_ids: form.value.warehouse_ids,
            };

            if (form.value.password) {
                payload.password = form.value.password;
                payload.password_confirmation =
                    form.value.password_confirmation;
            }

            await axios.put(`/users/${props.userId}`, payload);
            toast.success('Usuario actualizado');
        } else {
            await axios.post('/users', {
                name: form.value.name,
                username: form.value.username,
                email: form.value.email,
                password: form.value.password,
                password_confirmation: form.value.password_confirmation,
                role: form.value.role,
                can_manage_financial_adjustments:
                    form.value.can_manage_financial_adjustments,
                warehouse_ids: form.value.warehouse_ids,
            });
            toast.success('Usuario creado');
        }

        router.visit('/users');
    } catch (e: any) {
        const serverErrors = e.response?.data?.errors;
        if (serverErrors) {
            Object.keys(serverErrors).forEach((key) => {
                errors.value[key] = serverErrors[key][0];
            });
        } else {
            toast.error(
                e.response?.data?.message || 'Error al guardar usuario',
            );
        }
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <AppLayout
        :breadcrumbs="[
            { title: 'Usuarios', href: '/users' },
            { title: pageTitle, href: '#' },
        ]"
    >
        <Head :title="pageTitle" />

        <SettingsLayout>
            <div class="space-y-6">
                <header
                    class="flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between"
                >
                    <div class="flex items-start gap-3">
                        <div
                            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                        >
                            <UserRound class="h-5 w-5" />
                        </div>
                        <div>
                            <h2 class="text-lg font-semibold text-foreground">
                                {{ pageTitle }}
                            </h2>
                            <p class="text-sm text-muted-foreground">
                                Define identidad, rol, almacenes y credenciales
                                de acceso.
                            </p>
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-2">
                        <span
                            class="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                        >
                            <ShieldCheck class="h-3.5 w-3.5" />
                            {{
                                VALID_ROLES.find(
                                    (role) => role.value === form.role,
                                )?.label
                            }}
                        </span>
                        <span
                            class="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                        >
                            <Store class="h-3.5 w-3.5" />
                            {{
                                isAdminRole
                                    ? 'Todos los almacenes'
                                    : `${selectedWarehouseCount} almacenes`
                            }}
                        </span>
                    </div>
                </header>

                <form
                    @submit.prevent="submit"
                    @keydown.enter="
                        (e: KeyboardEvent) => {
                            if ((e.target as HTMLElement)?.tagName === 'INPUT')
                                e.preventDefault();
                        }
                    "
                    class="space-y-5"
                >
                    <section class="rounded-lg border bg-card p-4">
                        <div class="mb-4 flex items-center gap-2">
                            <Users class="h-4 w-4 text-primary" />
                            <h3 class="text-sm font-semibold text-foreground">
                                Identidad
                            </h3>
                        </div>

                        <div class="grid gap-4 md:grid-cols-2">
                            <div class="space-y-1.5">
                                <label class="block text-sm font-medium"
                                    >Nombre</label
                                >
                                <input
                                    v-model="form.name"
                                    type="text"
                                    class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Nombre completo"
                                />
                                <p
                                    v-if="errors.name"
                                    class="text-xs text-red-500"
                                >
                                    {{ errors.name }}
                                </p>
                            </div>

                            <div class="space-y-1.5">
                                <label class="block text-sm font-medium">
                                    Nombre de usuario
                                </label>
                                <input
                                    v-model="form.username"
                                    type="text"
                                    autocomplete="username"
                                    class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="ej: maria.lopez"
                                />
                                <p
                                    v-if="errors.username"
                                    class="text-xs text-red-500"
                                >
                                    {{ errors.username }}
                                </p>
                            </div>

                            <div class="space-y-1.5 md:col-span-2">
                                <label class="block text-sm font-medium"
                                    >Email</label
                                >
                                <input
                                    v-model="form.email"
                                    type="email"
                                    class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="correo@tienda.com"
                                />
                                <p
                                    v-if="errors.email"
                                    class="text-xs text-red-500"
                                >
                                    {{ errors.email }}
                                </p>
                            </div>
                        </div>
                    </section>

                    <section class="rounded-lg border bg-card p-4">
                        <div class="mb-4 flex items-center gap-2">
                            <ShieldCheck class="h-4 w-4 text-primary" />
                            <h3 class="text-sm font-semibold text-foreground">
                                Rol y almacenes
                            </h3>
                        </div>

                        <div class="space-y-4">
                            <div class="space-y-1.5">
                                <label class="block text-sm font-medium"
                                    >Rol</label
                                >
                                <select
                                    v-model="form.role"
                                    class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option
                                        v-for="role in VALID_ROLES"
                                        :key="role.value"
                                        :value="role.value"
                                    >
                                        {{ role.label }}
                                    </option>
                                </select>
                            </div>

                            <div
                                v-if="isAdminRole"
                                class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
                            >
                                Los administradores tienen acceso automatico a
                                todos los almacenes.
                            </div>

                            <div
                                v-else-if="warehouses && warehouses.length > 0"
                                class="space-y-2"
                            >
                                <div
                                    class="flex items-center justify-between gap-3"
                                >
                                    <label class="block text-sm font-medium">
                                        Almacenes con acceso
                                    </label>
                                    <div class="flex items-center gap-2">
                                        <button
                                            type="button"
                                            @click="selectAllWarehouses"
                                            class="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                                        >
                                            <Check class="h-3 w-3" />
                                            Todos
                                        </button>
                                        <button
                                            type="button"
                                            @click="deselectAllWarehouses"
                                            class="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:underline"
                                        >
                                            <X class="h-3 w-3" />
                                            Ninguno
                                        </button>
                                    </div>
                                </div>

                                <div
                                    class="grid max-h-56 gap-2 overflow-y-auto rounded-md border bg-background p-3 sm:grid-cols-2"
                                >
                                    <label
                                        v-for="warehouse in warehouses"
                                        :key="warehouse.id"
                                        class="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
                                        :class="
                                            form.warehouse_ids.includes(
                                                warehouse.id,
                                            )
                                                ? 'border-primary/50 bg-primary/5'
                                                : 'border-border'
                                        "
                                    >
                                        <input
                                            type="checkbox"
                                            :checked="
                                                form.warehouse_ids.includes(
                                                    warehouse.id,
                                                )
                                            "
                                            @change="
                                                toggleWarehouse(warehouse.id)
                                            "
                                            class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <span>{{ warehouse.name }}</span>
                                    </label>
                                </div>

                                <p
                                    v-if="errors.warehouse_ids"
                                    class="text-xs text-red-500"
                                >
                                    {{ errors.warehouse_ids }}
                                </p>
                            </div>
                        </div>
                    </section>

                    <section class="rounded-lg border bg-card p-4">
                        <div class="mb-4 flex items-center gap-2">
                            <KeyRound class="h-4 w-4 text-primary" />
                            <h3 class="text-sm font-semibold text-foreground">
                                Credenciales
                            </h3>
                        </div>

                        <div class="grid gap-4 md:grid-cols-2">
                            <div class="space-y-1.5">
                                <label class="block text-sm font-medium">
                                    Contrasena
                                    <span
                                        v-if="isEditMode"
                                        class="text-xs font-normal text-muted-foreground"
                                    >
                                        (vacio = no cambiar)
                                    </span>
                                </label>
                                <input
                                    v-model="form.password"
                                    type="password"
                                    autocomplete="new-password"
                                    class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                />
                                <p
                                    v-if="errors.password"
                                    class="text-xs text-red-500"
                                >
                                    {{ errors.password }}
                                </p>
                            </div>

                            <div class="space-y-1.5">
                                <label class="block text-sm font-medium">
                                    Confirmar contrasena
                                </label>
                                <input
                                    v-model="form.password_confirmation"
                                    type="password"
                                    autocomplete="new-password"
                                    class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                                />
                                <p
                                    v-if="errors.password_confirmation"
                                    class="text-xs text-red-500"
                                >
                                    {{ errors.password_confirmation }}
                                </p>
                            </div>
                        </div>
                    </section>

                    <section
                        v-if="canReceiveFinancialAdjustmentPermission"
                        class="rounded-lg border bg-card p-4"
                    >
                        <label class="flex items-start gap-3">
                            <input
                                id="can_manage_financial_adjustments"
                                v-model="form.can_manage_financial_adjustments"
                                type="checkbox"
                                class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary"
                            />
                            <span>
                                <span class="block text-sm font-medium">
                                    Administrar ajustes financieros
                                </span>
                                <span class="text-sm text-muted-foreground">
                                    Permite crear, consultar y revertir ajustes
                                    contables trazables.
                                </span>
                            </span>
                        </label>
                    </section>

                    <section
                        v-if="isEditMode"
                        class="rounded-lg border bg-card p-4"
                    >
                        <label class="flex items-start gap-3">
                            <input
                                id="is_active"
                                v-model="form.is_active"
                                type="checkbox"
                                class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary"
                            />
                            <span>
                                <span class="block text-sm font-medium">
                                    Usuario activo
                                </span>
                                <span class="text-sm text-muted-foreground">
                                    Si esta desactivado, no podra acceder al
                                    sistema.
                                </span>
                            </span>
                        </label>
                    </section>

                    <div
                        class="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-lg md:border"
                    >
                        <Link
                            href="/users"
                            class="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                        >
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            :disabled="loading"
                            class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
                        >
                            <Save class="h-4 w-4" />
                            {{
                                loading
                                    ? 'Guardando...'
                                    : isEditMode
                                      ? 'Actualizar usuario'
                                      : 'Crear usuario'
                            }}
                        </button>
                    </div>
                </form>
            </div>
        </SettingsLayout>
    </AppLayout>
</template>
