<script setup lang="ts">
import { computed } from 'vue';
import { Link } from '@inertiajs/vue3';
import {
    Archive,
    Brush,
    KeyRound,
    LockKeyhole,
    ShieldCheck,
    Store,
    User,
    Users,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/composables/useAuth';
import { useCurrentUrl } from '@/composables/useCurrentUrl';
import { toUrl } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editProfile } from '@/routes/profile';
import { show } from '@/routes/two-factor';
import { edit as editPassword } from '@/routes/user-password';
import { type NavItem } from '@/types';

const { isAdmin } = useAuth();
const { isCurrentUrl } = useCurrentUrl();

const baseNavItems: NavItem[] = [
    {
        title: 'Mi cuenta',
        href: editProfile(),
        icon: User,
    },
    {
        title: 'Contrasena',
        href: editPassword(),
        icon: KeyRound,
    },
    {
        title: 'Doble factor',
        href: show(),
        icon: ShieldCheck,
    },
    {
        title: 'Apariencia',
        href: editAppearance(),
        icon: Brush,
    },
];

const sidebarNavItems = computed<NavItem[]>(() => [
    ...baseNavItems,
    ...(isAdmin.value
        ? [
              { title: 'Tienda', href: '/settings/store', icon: Store },
              { title: 'Usuarios', href: '/users', icon: Users },
              { title: 'Backups', href: '/settings/backups', icon: Archive },
          ]
        : []),
]);
</script>

<template>
    <div class="px-4 py-5 md:px-6">
        <div
            class="mb-5 flex flex-col gap-3 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between"
        >
            <div>
                <div
                    class="mb-2 inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                    <LockKeyhole class="h-3.5 w-3.5" />
                    Configuracion
                </div>
                <h1
                    class="text-xl font-semibold tracking-normal text-foreground"
                >
                    Administracion del sistema
                </h1>
                <p class="mt-1 text-sm text-muted-foreground">
                    Cuenta, seguridad, tienda, usuarios y respaldos.
                </p>
            </div>
        </div>

        <div class="flex flex-col gap-6 lg:flex-row lg:gap-8">
            <aside class="w-full lg:w-56">
                <nav
                    class="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:flex lg:flex-col"
                    aria-label="Configuracion"
                >
                    <Button
                        v-for="item in sidebarNavItems"
                        :key="toUrl(item.href ?? '')"
                        variant="ghost"
                        :class="[
                            'h-9 justify-start gap-2 rounded-md px-3 text-sm',
                            {
                                'bg-muted font-semibold text-foreground':
                                    isCurrentUrl(item.href ?? ''),
                            },
                        ]"
                        as-child
                    >
                        <Link :href="item.href">
                            <component :is="item.icon" class="h-4 w-4" />
                            <span class="truncate">{{ item.title }}</span>
                        </Link>
                    </Button>
                </nav>
            </aside>

            <Separator class="lg:hidden" />

            <main class="min-w-0 flex-1">
                <slot />
            </main>
        </div>
    </div>
</template>
