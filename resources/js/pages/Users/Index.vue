<script setup lang="ts">
import { ref } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import SettingsLayout from '@/layouts/settings/Layout.vue'
import Heading from '@/components/Heading.vue'
import axios from 'axios'
import { useToast } from '@/composables/useToast'

const toast = useToast()

interface User {
    id: number
    name: string
    email: string
    role: string
    is_active: boolean
}

// Users come from Inertia server-side props (no cross-origin auth issues)
const props = defineProps<{ users: User[] }>()
const users = ref<User[]>(props.users)

const roleBadgeClass: Record<string, string> = {
    admin:   'bg-red-100 text-red-700',
    manager: 'bg-blue-100 text-blue-700',
    buyer:   'bg-yellow-100 text-yellow-700',
    seller:  'bg-green-100 text-green-700',
    cashier: 'bg-gray-100 text-gray-700',
    assistant: 'bg-purple-100 text-purple-700',
}
const roleLabel: Record<string, string> = {
    admin:   'Administrador',
    manager: 'Gerente',
    buyer:   'Comprador',
    seller:  'Vendedor',
    cashier: 'Cajero',
    assistant: 'Secretari@',
}

const deactivate = async (user: User) => {
    if (!confirm(`¿Desactivar a ${user.name}?`)) return
    try {
        await axios.delete(`/users/${user.id}`)
        toast.success('Usuario desactivado')
        router.reload({ only: ['users'] })
    } catch (e: any) {
        toast.error(e.response?.data?.message || 'Error al desactivar usuario')
    }
}

const reactivate = async (user: User) => {
    try {
        await axios.put(`/users/${user.id}`, { is_active: true })
        toast.success('Usuario reactivado')
        router.reload({ only: ['users'] })
    } catch (e: any) {
        toast.error(e.response?.data?.message || 'Error al reactivar usuario')
    }
}
</script>

<template>
    <AppLayout :breadcrumbs="[{ title: 'Usuarios', href: '/users' }]">
        <Head title="Usuarios" />

        <SettingsLayout>
            <div class="space-y-6">
                <div class="flex items-center justify-between">
                    <Heading
                        variant="small"
                        title="Gestión de Usuarios"
                        description="Administra los accesos y roles del sistema"
                    />
                    <a
                        href="/users/create"
                        class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
                    >
                        + Nuevo Usuario
                    </a>
                </div>

                <div class="rounded-xl border bg-card shadow-sm overflow-hidden">
                    <table class="w-full text-sm">
                        <thead class="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                            <tr>
                                <th class="px-4 py-3 text-left">Nombre</th>
                                <th class="px-4 py-3 text-left">Email</th>
                                <th class="px-4 py-3 text-left">Rol</th>
                                <th class="px-4 py-3 text-left">Estado</th>
                                <th class="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-border">
                            <tr v-for="user in users" :key="user.id" class="hover:bg-muted/30 transition-colors">
                                <td class="px-4 py-3 font-medium">{{ user.name }}</td>
                                <td class="px-4 py-3 text-muted-foreground">{{ user.email }}</td>
                                <td class="px-4 py-3">
                                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" :class="roleBadgeClass[user.role] ?? 'bg-gray-100 text-gray-700'">
                                        {{ roleLabel[user.role] ?? user.role }}
                                    </span>
                                </td>
                                <td class="px-4 py-3">
                                    <span class="inline-flex items-center gap-1 text-xs font-medium" :class="user.is_active ? 'text-green-600' : 'text-gray-400'">
                                        <span class="h-1.5 w-1.5 rounded-full" :class="user.is_active ? 'bg-green-500' : 'bg-gray-300'"></span>
                                        {{ user.is_active ? 'Activo' : 'Inactivo' }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-right space-x-1">
                                    <a :href="`/users/${user.id}/edit`" class="rounded px-2 py-1 text-xs font-medium text-blue-600 dark:text-primary hover:bg-blue-50 transition-colors">Editar</a>
                                    <button v-if="user.is_active"  @click="deactivate(user)" class="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">Desactivar</button>
                                    <button v-else @click="reactivate(user)" class="rounded px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 transition-colors">Reactivar</button>
                                </td>
                            </tr>
                            <tr v-if="users.length === 0">
                                <td colspan="5" class="px-4 py-8 text-center text-muted-foreground">No hay usuarios. Crea el primero.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </SettingsLayout>
    </AppLayout>
</template>
