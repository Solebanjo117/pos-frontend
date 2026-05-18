<script setup lang="ts">
import { Form, Head, Link, usePage } from '@inertiajs/vue3';
import { CheckCircle2, Mail, Save, Shield, UserRound } from 'lucide-vue-next';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import DeleteUser from '@/components/DeleteUser.vue';
import InputError from '@/components/InputError.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/AppLayout.vue';
import SettingsLayout from '@/layouts/settings/Layout.vue';
import { edit } from '@/routes/profile';
import { send } from '@/routes/verification';
import { type BreadcrumbItem } from '@/types';

type Props = {
    mustVerifyEmail: boolean;
    status?: string;
};

defineProps<Props>();

const breadcrumbItems: BreadcrumbItem[] = [
    {
        title: 'Mi cuenta',
        href: edit().url,
    },
];

const page = usePage();
const user = page.props.auth.user as unknown as {
    name: string;
    email: string;
    role: string;
    email_verified_at?: string | null;
};

const roleLabel: Record<string, string> = {
    admin: 'Administrador',
    manager: 'Gerente',
    buyer: 'Comprador',
    seller: 'Vendedor',
    cashier: 'Cajero',
    assistant: 'Secretari@',
};
</script>

<template>
    <AppLayout :breadcrumbs="breadcrumbItems">
        <Head title="Mi cuenta" />

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
                                Mi cuenta
                            </h2>
                            <p class="text-sm text-muted-foreground">
                                Datos personales, correo y estado de acceso.
                            </p>
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-2">
                        <span
                            class="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                        >
                            <Shield class="h-3.5 w-3.5" />
                            {{ roleLabel[user.role] ?? user.role }}
                        </span>
                        <span
                            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                            :class="
                                user.email_verified_at
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            "
                        >
                            <CheckCircle2
                                v-if="user.email_verified_at"
                                class="h-3.5 w-3.5"
                            />
                            <Mail v-else class="h-3.5 w-3.5" />
                            {{
                                user.email_verified_at
                                    ? 'Email verificado'
                                    : 'Email pendiente'
                            }}
                        </span>
                    </div>
                </header>

                <section class="rounded-lg border bg-card p-4">
                    <div class="mb-5">
                        <h3 class="text-base font-semibold text-foreground">
                            Informacion personal
                        </h3>
                        <p class="text-sm text-muted-foreground">
                            Estos datos identifican tu sesion dentro del POS.
                        </p>
                    </div>

                    <Form
                        v-bind="ProfileController.update.form()"
                        class="space-y-5"
                        v-slot="{ errors, processing, recentlySuccessful }"
                    >
                        <div class="grid gap-4 md:grid-cols-2">
                            <div class="grid gap-2">
                                <Label for="name">Nombre</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    :default-value="user.name"
                                    required
                                    autocomplete="name"
                                    placeholder="Nombre completo"
                                />
                                <InputError :message="errors.name" />
                            </div>

                            <div class="grid gap-2">
                                <Label for="email">Correo electronico</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    :default-value="user.email"
                                    required
                                    autocomplete="username"
                                    placeholder="correo@tienda.com"
                                />
                                <InputError :message="errors.email" />
                            </div>
                        </div>

                        <div
                            v-if="mustVerifyEmail && !user.email_verified_at"
                            class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                        >
                            Tu correo no esta verificado.
                            <Link
                                :href="send()"
                                as="button"
                                class="font-medium underline underline-offset-4"
                            >
                                Reenviar verificacion
                            </Link>
                            <div
                                v-if="status === 'verification-link-sent'"
                                class="mt-1 font-medium text-emerald-700 dark:text-emerald-300"
                            >
                                Enlace de verificacion enviado.
                            </div>
                        </div>

                        <div class="flex items-center gap-4">
                            <Button
                                :disabled="processing"
                                class="gap-2"
                                data-test="update-profile-button"
                            >
                                <Save class="h-4 w-4" />
                                Guardar cambios
                            </Button>

                            <Transition
                                enter-active-class="transition ease-in-out"
                                enter-from-class="opacity-0"
                                leave-active-class="transition ease-in-out"
                                leave-to-class="opacity-0"
                            >
                                <p
                                    v-show="recentlySuccessful"
                                    class="text-sm font-medium text-emerald-600"
                                >
                                    Cambios guardados.
                                </p>
                            </Transition>
                        </div>
                    </Form>
                </section>

                <DeleteUser />
            </div>
        </SettingsLayout>
    </AppLayout>
</template>
