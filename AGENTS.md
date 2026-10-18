# AGENTS.md — HermeX POS

## Architecture

Monolithic Laravel 12 app with an Inertia.js + Vue 3 frontend. Despite the repo name, this is a full-stack app — backend routes, controllers, and models are here too.

- **Entry point**: `resources/js/app.ts` (Inertia SPA bootstrap)
- **SSR entry**: `resources/js/ssr.ts`
- **Pages**: `resources/js/pages/` — each subdirectory maps to an Inertia route (e.g. `pages/POS/Index.vue`)
- **Path alias**: `@/` → `resources/js/`

## Tech Stack

- **Backend**: Laravel 12, PHP 8.2+, PostgreSQL, Laravel Fortify (auth), Spatie Activity Log
- **Frontend**: Vue 3, TypeScript, Inertia.js, Tailwind CSS v4, shadcn-vue (new-york-v4 style), VueUse
- **Build**: Vite 8 with `laravel-vite-plugin` 3 and `@laravel/vite-plugin-wayfinder`
- **Testing**: Pest PHP plus Vitest 3, Vue Test Utils and jsdom for frontend unit tests
- **Lint/Format**: Pint (PHP), ESLint 9 flat config (JS/Vue/TS), Prettier with `prettier-plugin-tailwindcss`

## Commands

```bash
# Dev (runs server + queue + vite concurrently)
composer dev

# Dev with SSR
composer dev:ssr

# Build
npm run build

# Frontend unit tests
npm run test:unit

# Lint
npm run lint              # ESLint --fix
composer lint             # pint --parallel

# Format check
npm run format:check      # Prettier check on resources/

# Format write
npm run format            # Prettier write on resources/

# Test (clears config, checks pint, runs Pest)
composer test

# Test directly
./vendor/bin/pest

# Type check
npx vue-tsc --noEmit
```

If Vitest, Vue Test Utils or jsdom cannot be resolved, treat the local `node_modules` as stale and restore it reproducibly from `package-lock.json` before diagnosing source failures. The dependency ranges declared by `package.json` are authoritative.

## Key Conventions

- **API client**: `resources/js/services/api/client.ts` — Axios with CSRF token + cookie-based auth (NOT JWT Bearer). Uses `VITE_API_BASE_URL` env var (default `/api/v1`)
- **Wayfinder**: Auto-generates route helpers in `resources/js/routes/` and action helpers in `resources/js/actions/`. Run `php artisan wayfinder:generate` after modifying routes.
- **Composables**: Data hooks in `resources/js/composables/` (e.g. `useProducts.ts`, `usePOS.ts`) — follow existing patterns when adding new ones
- **UI components**: `resources/js/components/ui/` — shadcn-vue components, managed via `npx shadcn-vue@latest add <component>`. ESLint ignores this directory.
- **Services**: `resources/js/services/` — API call modules; `services/api/` has the Axios client and domain-specific API modules
- **Types**: `resources/js/types/` — TypeScript interfaces mirroring backend models
- **Error handling**: API client dispatches `api:forbidden` (403), `api:server-error` (500), and `api:network-error` custom events on `window`. Handle via `useToast` or custom listeners.
- **Auth flow**: Cookie-based (Sanctum-style) with CSRF token from `<meta>` tag. 401 responses auto-redirect to `/login`.

## Additional Skills

Installed on 2026-10-06 in the user-level `$CODEX_HOME/skills` directory (default: `~/.codex/skills`). Use the configured directory when it differs from the default links below.

Before working in a relevant domain, read the matching `SKILL.md` and the references its workflow requires. Load only applicable skills. Explicit user instructions and project conventions take precedence over generic skill advice.

| Skill | When to use |
|-------|-------------|
| [vue-best-practices](../../.codex/skills/vue-best-practices/SKILL.md) | Vue 3 components, TypeScript, reactivity, props/events, and composables. |
| [vue-testing-best-practices](../../.codex/skills/vue-testing-best-practices/SKILL.md) | Vitest and Vue Test Utils coverage, asynchronous behavior, component mocks, and E2E test design. |
| [supabase-postgres-best-practices](../../.codex/skills/supabase-postgres-best-practices/SKILL.md) | PostgreSQL schema, migrations, indexes, query plans, connection management, and concurrency. |
| [web-design-guidelines](../../.codex/skills/web-design-guidelines/SKILL.md) | UI accessibility and UX reviews: keyboard/focus behavior, forms, responsive layout, and interaction states. |
| [vite](../../.codex/skills/vite/SKILL.md) | Vite configuration, build failures, plugins, assets, and SSR; check the installed project version. |
| [webapp-testing](../../.codex/skills/webapp-testing/SKILL.md) | Browser verification, screenshots, browser logs, and integration flows using Python and Playwright. |

- Keep the existing Laravel and Pest skills active for their domains. PostgreSQL guidance must preserve Eloquent relationships, warehouse isolation, cookie/CSRF authentication, idempotency, activity logging, and SQLite-compatible ordinary tests. Verify PostgreSQL locking and concurrency separately in an isolated test database; installing a skill does not authorize applying migrations or modifying live data.
- For frontend work, apply `hermex-operations-ui` and `tailwindcss-development` alongside the relevant Vue skills. Reuse existing components and composables; generic skill examples do not authorize changing the framework, dependencies, routing, or business contracts.
- Use each project's manifest and lockfile as the version authority; a skill may describe a newer minor release. Browser checks complement Pest/Vitest and must be reported separately from automated tests.
- Browser verification must use the existing Herd-served application. Do not start or stop HTTP servers merely because a skill helper suggests it. Verify the available Python/Playwright runtime before use; skill installation does not install those dependencies. Use test data for mutating browser checks.

- Follow the [reusable UI catalog](docs/COMPONENTES-UI.md) and its existing HermeX Operations UI guide before changing screens. Preserve shared date-range behavior, filter persistence, permissions, and warehouse context.

## Reusable UI Components (required)

Before implementing or changing a screen, consult [the reusable UI catalog](docs/COMPONENTES-UI.md), then inspect the relevant component and a real consumer. Reuse suitable components proactively; the user does not need to request this explicitly. Prefer a compatible extension of a shared component when a requirement is missing, instead of creating a screen-specific variant.

- Keep the catalog current when adding, moving, removing, or changing a reusable component: record its verified path, use cases, important props/events/slots, and an existing consumer. The source code and tests remain authoritative.
- For report periods, reuse `DateRangeInput.vue` or its finance wrapper `ReportPeriod.vue`. Keep the range control visible in reports that use it, preserve both dates and synchronize applied filters across tabs, requests and exports. Distinguish a date range from a single `as_of` cutoff; see the catalog's financial-report contract.
- For UI code changes, verify desktop/mobile layout, overflow, keyboard/focus behavior, labels, dialog closing, loading/error/empty states, and filter persistence with relevant tests and synthetic data. Reusing a component alone does not prove accessibility or visual correctness.
- Use the existing HermeX Operations UI guide linked in the catalog; do not duplicate its design rules here. Preserve role checks, warehouse context, and domain-specific behavior when reusing components.

## Frontend Style

- 4-space indentation (YAML: 2-space)
- Single quotes, semicolons in JS/TS
- `singleAttributePerLine: false` in Prettier
- Tailwind classes sorted by `prettier-plugin-tailwindcss` — always run format before committing
- ESLint enforces `@typescript-eslint/consistent-type-imports` with `separate-type-imports`
- `vue/multi-word-component-names` rule is OFF
- `@typescript-eslint/no-explicit-any` is OFF

## Important Env Vars

- `VITE_API_BASE_URL` — Backend API base URL (e.g. `http://api.pos-frontend.test/api/v1`)
- `VITE_APP_NAME` — App display name
- `DB_CONNECTION=pgsql` — Production uses PostgreSQL; tests use SQLite in-memory

## CI

GitHub Actions (`tests.yml`): PHP 8.4/8.5 matrix, Node 22. Runs `composer install`, `npm i`, `npm run build`, then `./vendor/bin/pest`.

## Gotchas

- `components.json` references `tailwind.config.js` but the project uses Tailwind v4 (CSS-based config in `resources/css/app.css`, no JS config file)
- Wayfinder form variants enabled in vite.config.ts — route helpers include form method variants
- The `resources/js/routes/` directory is auto-generated by Wayfinder; do not edit manually
- The `resources/js/actions/` directory is auto-generated by Wayfinder; do not edit manually
- ESLint excludes `resources/js/components/ui/*` (shadcn-vue managed)
