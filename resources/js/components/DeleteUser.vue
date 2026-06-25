<script setup lang="ts">
import { Form } from '@inertiajs/vue3';
import { AlertTriangle, Trash2 } from 'lucide-vue-next';
import { useTemplateRef } from 'vue';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import InputError from '@/components/InputError.vue';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const passwordInput = useTemplateRef('passwordInput');
</script>

<template>
    <section
        class="rounded-lg border border-red-200 bg-red-50/70 p-4 dark:border-red-900/60 dark:bg-red-950/20"
    >
        <div
            class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
            <div class="flex gap-3">
                <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                >
                    <AlertTriangle class="h-4 w-4" />
                </div>
                <div>
                    <h2
                        class="text-sm font-semibold text-red-900 dark:text-red-100"
                    >
                        Eliminar cuenta
                    </h2>
                    <p
                        class="mt-1 max-w-xl text-sm text-red-800/80 dark:text-red-200/80"
                    >
                        Esta accion elimina el acceso de tu cuenta. Confirmala
                        solo si ya no usaras el sistema.
                    </p>
                </div>
            </div>

            <Dialog>
                <DialogTrigger as-child>
                    <Button
                        variant="destructive"
                        class="gap-2"
                        data-test="delete-user-button"
                    >
                        <Trash2 class="h-4 w-4" />
                        Eliminar
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <Form
                        v-bind="ProfileController.destroy.form()"
                        reset-on-success
                        @error="() => passwordInput?.$el?.focus()"
                        :options="{ preserveScroll: true }"
                        class="space-y-6"
                        v-slot="{ errors, processing, reset, clearErrors }"
                    >
                        <DialogHeader class="space-y-3">
                            <DialogTitle
                                >Confirmar eliminacion de cuenta</DialogTitle
                            >
                            <DialogDescription>
                                Ingresa tu contrasena para confirmar esta
                                accion. No podras recuperar el acceso desde esta
                                pantalla.
                            </DialogDescription>
                        </DialogHeader>

                        <div class="grid gap-2">
                            <Label for="password">Contrasena actual</Label>
                            <Input
                                id="password"
                                type="password"
                                name="password"
                                ref="passwordInput"
                                placeholder="Contrasena"
                            />
                            <InputError :message="errors.password" />
                        </div>

                        <DialogFooter class="gap-2">
                            <DialogClose as-child>
                                <Button
                                    variant="secondary"
                                    @click="
                                        () => {
                                            clearErrors();
                                            reset();
                                        }
                                    "
                                >
                                    Cancelar
                                </Button>
                            </DialogClose>

                            <Button
                                type="submit"
                                variant="destructive"
                                :disabled="processing"
                                data-test="confirm-delete-user-button"
                            >
                                Eliminar cuenta
                            </Button>
                        </DialogFooter>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    </section>
</template>
