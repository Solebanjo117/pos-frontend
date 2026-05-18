<script setup lang="ts">
import { Form, Head, Link } from '@inertiajs/vue3';
import InputError from '@/components/InputError.vue';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/login';
import {
    User,
    Lock,
    ArrowRight,
    ShoppingCart,
    BarChart3,
    Package,
    Receipt,
} from 'lucide-vue-next';
import { ref } from 'vue';

defineProps<{
    status?: string;
    canRegister: boolean;
}>();

const showPassword = ref(false);
</script>

<template>
    <Head title="HermeX — Inicio de Sesión">
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossorigin="anonymous"
        />
        <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
            rel="stylesheet"
        />
    </Head>

    <div class="welcome-page">
        <!-- Left Section: Login -->
        <div class="login-section">
            <div class="login-card">
                <!-- Avatar Icon -->
                <div class="avatar-icon">
                    <User :size="28" :stroke-width="1.5" />
                </div>

                <!-- Title -->
                <h1 class="login-title">INICIO DE SESIÓN</h1>
                <p class="login-subtitle">Identifícate para continuar</p>

                <!-- Status message -->
                <div v-if="status" class="status-msg">
                    {{ status }}
                </div>

                <!-- Login Form -->
                <Form
                    v-bind="store.form()"
                    :reset-on-success="['password']"
                    v-slot="{ errors, processing }"
                    class="login-form"
                >
                    <!-- Username / Email -->
                    <div class="field-group">
                        <label for="email" class="field-label">USUARIO</label>
                        <div class="input-wrapper">
                            <User
                                class="input-icon"
                                :size="18"
                                :stroke-width="1.5"
                            />
                            <input
                                id="email"
                                type="text"
                                name="email"
                                required
                                autofocus
                                :tabindex="1"
                                autocomplete="username"
                                placeholder="Nombre de usuario o correo"
                                class="login-input"
                            />
                        </div>
                        <InputError :message="errors.email" />
                    </div>

                    <!-- Password -->
                    <div class="field-group">
                        <label for="password" class="field-label"
                            >CONTRASEÑA</label
                        >
                        <div class="input-wrapper">
                            <Lock
                                class="input-icon"
                                :size="18"
                                :stroke-width="1.5"
                            />
                            <input
                                id="password"
                                :type="showPassword ? 'text' : 'password'"
                                name="password"
                                required
                                :tabindex="2"
                                autocomplete="current-password"
                                placeholder="••••••••"
                                class="login-input"
                            />
                        </div>
                        <InputError :message="errors.password" />
                    </div>

                    <!-- Submit -->
                    <button
                        type="submit"
                        class="submit-btn"
                        :tabindex="3"
                        :disabled="processing"
                        data-test="login-button"
                    >
                        <Spinner v-if="processing" class="spinner" />
                        <span v-else class="submit-text">
                            INGRESAR
                            <ArrowRight :size="18" :stroke-width="2" />
                        </span>
                    </button>
                </Form>

                <!-- Footer -->
                <p class="login-footer">HERMEX V2.0</p>
            </div>
        </div>

        <!-- Right Section: Welcome/Branding -->
        <div class="welcome-section">
            <div class="welcome-content">
                <div class="welcome-icons">
                    <div class="icon-bubble"><ShoppingCart :size="28" /></div>
                    <div class="icon-bubble"><BarChart3 :size="28" /></div>
                    <div class="icon-bubble"><Package :size="28" /></div>
                    <div class="icon-bubble"><Receipt :size="28" /></div>
                </div>

                <h2 class="welcome-title">Bienvenido a <span>HermeX</span></h2>
                <p class="welcome-desc">
                    Gestiona inventario, ventas y clientes desde una sola
                    plataforma. Tu punto de venta inteligente.
                </p>

                <img
                    src="/images/hermespos.jpeg"
                    alt="HermeX"
                    class="welcome-hero"
                />

                <div class="welcome-features">
                    <div class="feature">
                        <div class="feature-dot"></div>
                        <span>Punto de Venta</span>
                    </div>
                    <div class="feature">
                        <div class="feature-dot"></div>
                        <span>Inventario</span>
                    </div>
                    <div class="feature">
                        <div class="feature-dot"></div>
                        <span>Reportes</span>
                    </div>
                    <div class="feature">
                        <div class="feature-dot"></div>
                        <span>Clientes</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════ */
/* BASE / RESET                               */
/* ═══════════════════════════════════════════ */
.welcome-page {
    display: flex;
    min-height: 100vh;
    font-family:
        'Inter',
        system-ui,
        -apple-system,
        sans-serif;
    background: #0a0a0a;
}

/* ═══════════════════════════════════════════ */
/* LEFT: LOGIN                                */
/* ═══════════════════════════════════════════ */
.login-section {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000000;
    padding: 2rem;
    position: relative;
}

.login-card {
    background: #111111;
    border-radius: 16px;
    padding: 2rem 2.5rem 1.5rem;
    width: 100%;
    max-width: 400px;
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow:
        0 4px 6px -1px rgba(0, 0, 0, 0.5),
        0 10px 15px -3px rgba(0, 0, 0, 0.3);
}

.avatar-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #1a1a1a;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.25rem;
    color: #d4af37;
    border: 2px solid rgba(212, 175, 55, 0.3);
}

.login-title {
    text-align: center;
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #ffffff;
    margin-bottom: 0.25rem;
}

.login-subtitle {
    text-align: center;
    font-size: 0.825rem;
    color: #888888;
    margin-bottom: 1.5rem;
    font-weight: 400;
}

.status-msg {
    text-align: center;
    font-size: 0.8rem;
    font-weight: 500;
    color: #d4af37;
    background: rgba(212, 175, 55, 0.1);
    border: 1px solid rgba(212, 175, 55, 0.2);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
}

/* ─── Form ──── */
.login-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.field-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.field-label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #888888;
}

.input-wrapper {
    position: relative;
}

.input-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: #d4af37;
    pointer-events: none;
}

.login-input {
    width: 100%;
    padding: 0.75rem 0.75rem 0.75rem 2.5rem;
    border: none;
    border-bottom: 1.5px solid #333333;
    background: transparent;
    font-size: 0.9rem;
    font-family: inherit;
    color: #ffffff;
    outline: none;
    transition: border-color 0.2s;
}
.login-input::placeholder {
    color: #555555;
}
.login-input:focus {
    border-color: #d4af37;
}

/* ─── Submit ──── */
.submit-btn {
    margin-top: 0.5rem;
    width: 100%;
    padding: 0.85rem 1.5rem;
    background: linear-gradient(135deg, #d4af37 0%, #aa771c 100%);
    color: #000000;
    border: none;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}
.submit-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #e5c35b 0%, #c48c26 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(212, 175, 55, 0.25);
}
.submit-btn:active:not(:disabled) {
    transform: translateY(0);
}
.submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.submit-text {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.spinner {
    width: 20px;
    height: 20px;
}

/* ─── Footer ──── */
.login-footer {
    text-align: center;
    margin-top: 1.5rem;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.15em;
    color: #555555;
}

/* ═══════════════════════════════════════════ */
/* RIGHT: WELCOME                             */
/* ═══════════════════════════════════════════ */
.welcome-section {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%);
    padding: 2rem;
    position: relative;
    overflow: hidden;
}

.welcome-section::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
        radial-gradient(
            circle at 20% 30%,
            rgba(212, 175, 55, 0.05) 0%,
            transparent 70%
        ),
        radial-gradient(
            circle at 80% 70%,
            rgba(212, 175, 55, 0.05) 0%,
            transparent 60%
        );
}

.welcome-content {
    position: relative;
    z-index: 1;
    text-align: center;
    max-width: 480px;
}

.welcome-icons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 1.5rem;
}

.icon-bubble {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: #111111;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #d4af37;
    border: 1px solid rgba(212, 175, 55, 0.2);
    box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.3),
        0 4px 8px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
}
.icon-bubble:hover {
    transform: translateY(-4px);
    border-color: rgba(212, 175, 55, 0.5);
    box-shadow:
        0 4px 12px rgba(212, 175, 55, 0.1),
        0 8px 24px rgba(212, 175, 55, 0.1);
}

.welcome-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 0.5rem;
    line-height: 1.2;
}
.welcome-title span {
    background: linear-gradient(135deg, #d4af37 0%, #aa771c 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.welcome-desc {
    font-size: 0.9rem;
    color: #aaaaaa;
    line-height: 1.5;
    margin-bottom: 1.5rem;
}

.welcome-hero {
    width: 100%;
    max-width: 320px;
    height: auto;
    max-height: 40vh;
    border-radius: 16px;
    margin: 0 auto 2rem;
    display: block;
    object-fit: cover;
    box-shadow:
        0 8px 30px rgba(0, 0, 0, 0.5),
        0 2px 8px rgba(0, 0, 0, 0.3);
}

.welcome-features {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
}

.feature {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(26, 26, 26, 0.7);
    backdrop-filter: blur(4px);
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 500;
    color: #d4af37;
    border: 1px solid rgba(212, 175, 55, 0.2);
}

.feature-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #d4af37;
}

/* ═══════════════════════════════════════════ */
/* RESPONSIVE                                 */
/* ═══════════════════════════════════════════ */
@media (max-width: 960px) {
    .welcome-page {
        flex-direction: column;
    }
    .login-section {
        padding: 2rem 1.5rem;
    }
    .welcome-section {
        padding: 2rem 1.5rem;
        min-height: auto;
    }
    .welcome-title {
        font-size: 1.5rem;
    }
    .welcome-hero {
        max-width: 260px;
    }
}
</style>
