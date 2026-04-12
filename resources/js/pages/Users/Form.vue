<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import AppLayout from '@/layouts/AppLayout.vue'
import SettingsLayout from '@/layouts/settings/Layout.vue'
import Heading from '@/components/Heading.vue'
import axios from 'axios'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
    userId?: number
    userData?: { id: number; name: string; username: string; email: string; role: string; is_active: boolean; warehouse_ids?: number[] }
    warehouses?: { id: number; name: string }[]
}>()

const toast = useToast()

const VALID_ROLES = [
    { value: 'admin',     label: 'Administrador' },
    { value: 'manager',   label: 'Gerente' },
    { value: 'seller',    label: 'Vendedor' },
    { value: 'cashier',   label: 'Cajero' },
    { value: 'buyer',     label: 'Comprador' },
    { value: 'assistant', label: 'Secretari@' },
]

const isEditMode = computed(() => !!props.userId)
const pageTitle  = computed(() => isEditMode.value ? 'Editar Usuario' : 'Nuevo Usuario')
const isAdminRole = computed(() => form.value.role === 'admin')

const form = ref({
    name: props.userData?.name ?? '',
    username: props.userData?.username ?? '',
    email: props.userData?.email ?? '',
    password: '',
    password_confirmation: '',
    role: props.userData?.role ?? 'cashier',
    is_active: props.userData?.is_active ?? true,
    warehouse_ids: props.userData?.warehouse_ids ?? [] as number[],
})

const errors = ref<Record<string, string>>({})
const loading = ref(false)

const toggleWarehouse = (id: number) => {
    const idx = form.value.warehouse_ids.indexOf(id)
    if (idx >= 0) {
        form.value.warehouse_ids.splice(idx, 1)
    } else {
        form.value.warehouse_ids.push(id)
    }
}

const selectAllWarehouses = () => {
    if (props.warehouses) {
        form.value.warehouse_ids = props.warehouses.map(w => w.id)
    }
}

const deselectAllWarehouses = () => {
    form.value.warehouse_ids = []
}

const validate = (): boolean => {
    errors.value = {}
    if (!form.value.name.trim()) errors.value.name = 'El nombre es requerido'
    if (!form.value.username.trim()) errors.value.username = 'El nombre de usuario es requerido'
    if (!form.value.email.trim()) errors.value.email = 'El email es requerido'
    if (!isEditMode.value && !form.value.password) errors.value.password = 'La contraseña es requerida'
    if (form.value.password && form.value.password !== form.value.password_confirmation)
        errors.value.password_confirmation = 'Las contraseñas no coinciden'
    if (!isAdminRole.value && form.value.warehouse_ids.length === 0) 
        errors.value.warehouse_ids = 'Debe asignar al menos un almacén'
    return Object.keys(errors.value).length === 0
}

const submit = async () => {
    if (!validate()) return
    loading.value = true
    try {
        if (isEditMode.value) {
            const payload: any = {
                name: form.value.name,
                username: form.value.username,
                email: form.value.email,
                role: form.value.role,
                is_active: form.value.is_active,
                warehouse_ids: form.value.warehouse_ids,
            }
            if (form.value.password) {
                payload.password = form.value.password
                payload.password_confirmation = form.value.password_confirmation
            }
            await axios.put(`/users/${props.userId}`, payload)
            toast.success('Usuario actualizado')
        } else {
            await axios.post('/users', {
                name: form.value.name,
                username: form.value.username,
                email: form.value.email,
                password: form.value.password,
                password_confirmation: form.value.password_confirmation,
                role: form.value.role,
                warehouse_ids: form.value.warehouse_ids,
            })
            toast.success('Usuario creado')
        }
        router.visit('/users')
    } catch (e: any) {
        const serverErrors = e.response?.data?.errors
        if (serverErrors) Object.keys(serverErrors).forEach(k => { errors.value[k] = serverErrors[k][0] })
        else toast.error(e.response?.data?.message || 'Error al guardar usuario')
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <AppLayout :breadcrumbs="[{ title: 'Usuarios', href: '/users' }, { title: pageTitle, href: '#' }]">
        <Head :title="pageTitle" />

        <SettingsLayout>
            <div class="space-y-6 max-w-lg">
                <Heading variant="small" :title="pageTitle" :description="isEditMode ? 'Modifica los datos del usuario' : 'Crea un nuevo usuario en el sistema'" />

                <form @submit.prevent="submit" @keydown.enter="(e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') e.preventDefault() }" class="space-y-5">
                    <div class="space-y-1">
                        <label class="block text-sm font-medium">Nombre</label>
                        <input v-model="form.name" type="text" class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
                        <p v-if="errors.name" class="text-xs text-red-500">{{ errors.name }}</p>
                    </div>

                    <div class="space-y-1">
                        <label class="block text-sm font-medium">Nombre de usuario</label>
                        <input v-model="form.username" type="text" autocomplete="username" class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="ej: maria.lopez" />
                        <p v-if="errors.username" class="text-xs text-red-500">{{ errors.username }}</p>
                    </div>

                    <div class="space-y-1">
                        <label class="block text-sm font-medium">Email</label>
                        <input v-model="form.email" type="email" class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
                        <p v-if="errors.email" class="text-xs text-red-500">{{ errors.email }}</p>
                    </div>

                    <div class="space-y-1">
                        <label class="block text-sm font-medium">Rol</label>
                        <select v-model="form.role" class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                            <option v-for="r in VALID_ROLES" :key="r.value" :value="r.value">{{ r.label }}</option>
                        </select>
                    </div>

                    <!-- Warehouse Access (not shown for admins since they have access to all) -->
                    <div v-if="!isAdminRole && warehouses && warehouses.length > 0" class="space-y-2">
                        <div class="flex items-center justify-between">
                            <label class="block text-sm font-medium">Almacenes con acceso</label>
                            <div class="flex gap-2">
                                <button type="button" @click="selectAllWarehouses" class="text-xs text-primary hover:underline">Todos</button>
                                <span class="text-xs text-muted-foreground">|</span>
                                <button type="button" @click="deselectAllWarehouses" class="text-xs text-primary hover:underline">Ninguno</button>
                            </div>
                        </div>
                        <div class="rounded-md border bg-background p-3 space-y-2 max-h-48 overflow-y-auto">
                            <label
                                v-for="wh in warehouses"
                                :key="wh.id"
                                class="flex items-center gap-3 cursor-pointer rounded px-2 py-1.5 hover:bg-muted transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    :checked="form.warehouse_ids.includes(wh.id)"
                                    @change="toggleWarehouse(wh.id)"
                                    class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <span class="text-sm">{{ wh.name }}</span>
                            </label>
                        </div>
                        <p v-if="errors.warehouse_ids" class="text-xs text-red-500">{{ errors.warehouse_ids }}</p>
                        <p v-if="isAdminRole" class="text-xs text-muted-foreground">Los administradores tienen acceso a todos los almacenes automáticamente.</p>
                    </div>

                    <div v-if="isAdminRole" class="rounded-md border bg-muted/50 px-3 py-2">
                        <p class="text-xs text-muted-foreground">ℹ️ Los administradores tienen acceso a todos los almacenes automáticamente.</p>
                    </div>

                    <div class="space-y-1">
                        <label class="block text-sm font-medium">
                            Contraseña <span v-if="isEditMode" class="text-muted-foreground font-normal text-xs">(vacío = no cambiar)</span>
                        </label>
                        <input v-model="form.password" type="password" autocomplete="new-password" class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
                        <p v-if="errors.password" class="text-xs text-red-500">{{ errors.password }}</p>
                    </div>

                    <div class="space-y-1">
                        <label class="block text-sm font-medium">Confirmar Contraseña</label>
                        <input v-model="form.password_confirmation" type="password" autocomplete="new-password" class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
                        <p v-if="errors.password_confirmation" class="text-xs text-red-500">{{ errors.password_confirmation }}</p>
                    </div>

                    <div v-if="isEditMode" class="flex items-center gap-3">
                        <input id="is_active" v-model="form.is_active" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-primary" />
                        <label for="is_active" class="text-sm">Usuario activo</label>
                    </div>

                    <div class="flex items-center gap-3 pt-2">
                        <button type="submit" :disabled="loading" class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50">
                            {{ loading ? 'Guardando...' : (isEditMode ? 'Actualizar' : 'Crear Usuario') }}
                        </button>
                        <a href="/users" class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancelar</a>
                    </div>
                </form>
            </div>
        </SettingsLayout>
    </AppLayout>
</template>
