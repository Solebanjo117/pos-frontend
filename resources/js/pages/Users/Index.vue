<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3';
import axios from 'axios';
import {
    CheckCircle2,
    Filter,
    Plus,
    RotateCcw,
    Search,
    ShieldCheck,
    Store,
    UserRound,
    Users,
    XCircle,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useToast } from '@/composables/useToast';
import AppLayout from '@/layouts/AppLayout.vue';
import SettingsLayout from '@/layouts/settings/Layout.vue';

const toast = useToast();

interface Warehouse {
    id: number;
    name: string;
}

interface User {
    id: number;
    name: string;
    username?: string;
    email: string;
    role: string;
    is_active: boolean;
    warehouses?: Warehouse[];
}

const props = defineProps<{ users: User[] }>();

const search = ref('');
const roleFilter = ref('all');
const statusFilter = ref('all');
const pendingUser = ref<User | null>(null);
const pendingAction = ref<'deactivate' | 'reactivate' | null>(null);
const actionLoading = ref(false);

const roleBadgeClass: Record<string, string> = {
    admin: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900',
    manager:
        'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900',
    buyer: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
    seller: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
    cashier:
        'bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-800',
    assistant:
        'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-900',
};

const roleLabel: Record<string, string> = {
    admin: 'Administrador',
    manager: 'Gerente',
    buyer: 'Comprador',
    seller: 'Vendedor',
    cashier: 'Cajero',
    assistant: 'Secretari@',
};

const roleOptions = computed(() =>
    Array.from(new Set(props.users.map((user) => user.role))).sort(),
);

const userMetrics = computed(() => {
    const active = props.users.filter((user) => user.is_active).length;
    const inactive = props.users.length - active;
    const admins = props.users.filter((user) => user.role === 'admin').length;
    const withoutWarehouse = props.users.filter(
        (user) => user.role !== 'admin' && (user.warehouses?.length ?? 0) === 0,
    ).length;

    return { active, inactive, admins, withoutWarehouse };
});

const filteredUsers = computed(() => {
    const term = search.value.trim().toLowerCase();

    return props.users.filter((user) => {
        const matchesSearch =
            !term ||
            [
                user.name,
                user.username,
                user.email,
                roleLabel[user.role],
                user.role,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(term));

        const matchesRole =
            roleFilter.value === 'all' || user.role === roleFilter.value;

        const matchesStatus =
            statusFilter.value === 'all' ||
            (statusFilter.value === 'active' && user.is_active) ||
            (statusFilter.value === 'inactive' && !user.is_active);

        return matchesSearch && matchesRole && matchesStatus;
    });
});

const openActionModal = (user: User, action: 'deactivate' | 'reactivate') => {
    pendingUser.value = user;
    pendingAction.value = action;
};

const closeActionModal = () => {
    if (actionLoading.value) {
        return;
    }

    pendingUser.value = null;
    pendingAction.value = null;
};

const submitUserAction = async () => {
    if (!pendingUser.value || !pendingAction.value) {
        return;
    }

    actionLoading.value = true;
    try {
        if (pendingAction.value === 'deactivate') {
            await axios.delete(`/users/${pendingUser.value.id}`);
            toast.success('Usuario desactivado');
        } else {
            await axios.put(`/users/${pendingUser.value.id}`, {
                is_active: true,
            });
            toast.success('Usuario reactivado');
        }

        closeActionModal();
        router.reload({ only: ['users'] });
    } catch (e: any) {
        toast.error(
            e.response?.data?.message || 'No se pudo actualizar el usuario',
        );
    } finally {
        actionLoading.value = false;
    }
};
</script>

<template>
    <AppLayout :breadcrumbs="[{ title: 'Usuarios', href: '/users' }]">
        <Head title="Usuarios" />

        <SettingsLayout>
            <div class="space-y-6">
                <header
                    class="flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between"
                >
                    <div class="flex items-start gap-3">
                        <div
                            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                        >
                            <Users class="h-5 w-5" />
                        </div>
                        <div>
                            <h2 class="text-lg font-semibold text-foreground">
                                Gestion de usuarios
                            </h2>
                            <p class="text-sm text-muted-foreground">
                                Accesos, roles y almacenes disponibles para cada
                                usuario.
                            </p>
                        </div>
                    </div>

                    <Link
                        href="/users/create"
                        class="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                    >
                        <Plus class="h-4 w-4" />
                        Nuevo usuario
                    </Link>
                </header>

                <div class="grid gap-3 md:grid-cols-4">
                    <div class="rounded-lg border bg-card p-4">
                        <p
                            class="text-xs font-medium text-muted-foreground uppercase"
                        >
                            Activos
                        </p>
                        <p class="mt-2 text-2xl font-semibold text-emerald-600">
                            {{ userMetrics.active }}
                        </p>
                    </div>
                    <div class="rounded-lg border bg-card p-4">
                        <p
                            class="text-xs font-medium text-muted-foreground uppercase"
                        >
                            Inactivos
                        </p>
                        <p
                            class="mt-2 text-2xl font-semibold text-muted-foreground"
                        >
                            {{ userMetrics.inactive }}
                        </p>
                    </div>
                    <div class="rounded-lg border bg-card p-4">
                        <p
                            class="text-xs font-medium text-muted-foreground uppercase"
                        >
                            Administradores
                        </p>
                        <p class="mt-2 text-2xl font-semibold text-red-600">
                            {{ userMetrics.admins }}
                        </p>
                    </div>
                    <div class="rounded-lg border bg-card p-4">
                        <p
                            class="text-xs font-medium text-muted-foreground uppercase"
                        >
                            Sin almacen
                        </p>
                        <p
                            class="mt-2 text-2xl font-semibold"
                            :class="
                                userMetrics.withoutWarehouse
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                            "
                        >
                            {{ userMetrics.withoutWarehouse }}
                        </p>
                    </div>
                </div>

                <section class="rounded-lg border bg-card p-4">
                    <div class="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
                        <div class="relative">
                            <Search
                                class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                                v-model="search"
                                type="search"
                                placeholder="Buscar por nombre, usuario, correo o rol"
                                class="h-10 w-full rounded-md border bg-background pr-3 pl-9 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div class="relative">
                            <Filter
                                class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            />
                            <select
                                v-model="roleFilter"
                                class="h-10 w-full rounded-md border bg-background pr-3 pl-9 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="all">Todos los roles</option>
                                <option
                                    v-for="role in roleOptions"
                                    :key="role"
                                    :value="role"
                                >
                                    {{ roleLabel[role] ?? role }}
                                </option>
                            </select>
                        </div>
                        <select
                            v-model="statusFilter"
                            class="h-10 w-full rounded-md border bg-background px-3 text-sm transition outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="all">Todos los estados</option>
                            <option value="active">Activos</option>
                            <option value="inactive">Inactivos</option>
                        </select>
                    </div>
                </section>

                <div class="overflow-hidden rounded-lg border bg-card">
                    <table class="w-full text-sm">
                        <thead
                            class="bg-muted/50 text-xs text-muted-foreground uppercase"
                        >
                            <tr>
                                <th class="px-4 py-3 text-left">Usuario</th>
                                <th class="px-4 py-3 text-left">Rol</th>
                                <th class="px-4 py-3 text-left">Almacenes</th>
                                <th class="px-4 py-3 text-left">Estado</th>
                                <th class="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-border">
                            <tr
                                v-for="user in filteredUsers"
                                :key="user.id"
                                class="transition-colors hover:bg-muted/30"
                            >
                                <td class="px-4 py-3">
                                    <div class="flex items-center gap-3">
                                        <div
                                            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                                        >
                                            <UserRound class="h-4 w-4" />
                                        </div>
                                        <div class="min-w-0">
                                            <p
                                                class="font-medium text-foreground"
                                            >
                                                {{ user.name }}
                                            </p>
                                            <p
                                                class="truncate text-xs text-muted-foreground"
                                            >
                                                {{ user.email }}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-4 py-3">
                                    <span
                                        class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1"
                                        :class="
                                            roleBadgeClass[user.role] ??
                                            'bg-gray-100 text-gray-700 ring-gray-200'
                                        "
                                    >
                                        {{ roleLabel[user.role] ?? user.role }}
                                    </span>
                                </td>
                                <td class="px-4 py-3">
                                    <div
                                        v-if="user.role === 'admin'"
                                        class="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                                    >
                                        <ShieldCheck class="h-3.5 w-3.5" />
                                        Todos
                                    </div>
                                    <div
                                        v-else-if="user.warehouses?.length"
                                        class="flex max-w-xs flex-wrap gap-1"
                                    >
                                        <span
                                            v-for="warehouse in user.warehouses.slice(
                                                0,
                                                2,
                                            )"
                                            :key="warehouse.id"
                                            class="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                        >
                                            <Store class="h-3 w-3" />
                                            {{ warehouse.name }}
                                        </span>
                                        <span
                                            v-if="user.warehouses.length > 2"
                                            class="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                        >
                                            +{{ user.warehouses.length - 2 }}
                                        </span>
                                    </div>
                                    <span
                                        v-else
                                        class="text-xs font-medium text-amber-600"
                                    >
                                        Sin almacen
                                    </span>
                                </td>
                                <td class="px-4 py-3">
                                    <span
                                        class="inline-flex items-center gap-1.5 text-xs font-semibold"
                                        :class="
                                            user.is_active
                                                ? 'text-emerald-600'
                                                : 'text-muted-foreground'
                                        "
                                    >
                                        <CheckCircle2
                                            v-if="user.is_active"
                                            class="h-3.5 w-3.5"
                                        />
                                        <XCircle v-else class="h-3.5 w-3.5" />
                                        {{
                                            user.is_active
                                                ? 'Activo'
                                                : 'Inactivo'
                                        }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <div class="inline-flex items-center gap-1">
                                        <Link
                                            :href="`/users/${user.id}/edit`"
                                            class="rounded-md px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                                        >
                                            Editar
                                        </Link>
                                        <button
                                            v-if="user.is_active"
                                            @click="
                                                openActionModal(
                                                    user,
                                                    'deactivate',
                                                )
                                            "
                                            class="rounded-md px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                                        >
                                            Desactivar
                                        </button>
                                        <button
                                            v-else
                                            @click="
                                                openActionModal(
                                                    user,
                                                    'reactivate',
                                                )
                                            "
                                            class="rounded-md px-2.5 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                        >
                                            Reactivar
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <tr v-if="filteredUsers.length === 0">
                                <td
                                    colspan="5"
                                    class="px-4 py-10 text-center text-muted-foreground"
                                >
                                    No hay usuarios con esos filtros.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <Teleport to="body">
                <div
                    v-if="pendingUser && pendingAction"
                    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    @click.self="closeActionModal"
                >
                    <div
                        class="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl"
                    >
                        <h3 class="text-base font-semibold text-foreground">
                            {{
                                pendingAction === 'deactivate'
                                    ? 'Desactivar usuario'
                                    : 'Reactivar usuario'
                            }}
                        </h3>
                        <p class="mt-2 text-sm text-muted-foreground">
                            {{
                                pendingAction === 'deactivate'
                                    ? `Desactivar a ${pendingUser.name} bloquea su acceso al sistema.`
                                    : `Reactivar a ${pendingUser.name} habilita nuevamente su acceso.`
                            }}
                        </p>

                        <div class="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                class="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                                @click="closeActionModal"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                :disabled="actionLoading"
                                class="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                                :class="
                                    pendingAction === 'deactivate'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-emerald-600 hover:bg-emerald-700'
                                "
                                @click="submitUserAction"
                            >
                                <RotateCcw
                                    v-if="pendingAction === 'reactivate'"
                                    class="h-4 w-4"
                                />
                                {{
                                    actionLoading
                                        ? 'Procesando...'
                                        : pendingAction === 'deactivate'
                                          ? 'Desactivar'
                                          : 'Reactivar'
                                }}
                            </button>
                        </div>
                    </div>
                </div>
            </Teleport>
        </SettingsLayout>
    </AppLayout>
</template>
