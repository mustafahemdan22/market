# Architecture — Grocery Marketplace

**Status:** Proposed (Phase A — no code written yet)
**Last reviewed:** 2026-10-10
**Owner:** Principal Engineer

---

## 1. Purpose

This document defines the system architecture for a production grocery marketplace consisting of a
customer mobile application, a server-authoritative backend, and an administrative dashboard.

It is a **design proposal**, not a description of working software. No application code exists yet.
Every capability described here is planned work, tracked in [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md).

---

## 2. Verified Environment Baseline

Measured on the target machine (`D:\market`, Windows, 2026-10-10):

| Item         | Value              | Notes                                                               |
| ------------ | ------------------ | ------------------------------------------------------------------- |
| Project root | `D:\market`        | Was empty at start of Phase A. Nothing was overwritten.             |
| Node.js      | `v24.14.0`         | Exceeds Expo SDK 57 minimum (22.13.x) and Convex minimum (>=20).    |
| npm          | `11.9.0`           | Native workspaces available.                                        |
| Git          | `2.55.0.windows.2` | Repository **not yet initialised** — `D:\market` is not a git repo. |
| OS           | win32              | iOS builds require EAS cloud builds (no macOS host).                |

### 2.1 Version compatibility findings (verified against npm registry + vendor docs)

These were checked, not assumed. Several are non-obvious and would have broken the build.

| Package                         | Version      | Finding                                                                                                                                                                                                                                                                           | Status      |
| ------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `typescript`                    | **6.0.3**    | npm `latest` is **7.0.2**, but `typescript-eslint@8.71.1` declares peer `typescript: ">=4.8.4 <6.1.0"`. Expo SDK 57 templates pin `~6.0.3`. **TS 6.0.3 is the ceiling** until typescript-eslint supports TS 7.                                                                    | ✅ Verified |
| `expo`                          | `~57.0.27`   | Expo SDK 57 → React Native 0.86, React 19.2.3. Released 2026-06-30.                                                                                                                                                                                                               | ✅ Verified |
| `react`                         | `19.2.3`     | **Single React version across the monorepo.** Expo requires exactly `19.2.3`; `@clerk/nextjs@7.9.13` peer accepts `~19.2.3`; Next 16 accepts `^19.0.0`. 19.2.3 is the intersection. Do not independently bump React in `apps/admin`.                                              | ✅ Verified |
| `react-native`                  | `0.86.3`     | Pinned by the `expo-template-default@57.0.29` manifest. Do not set manually.                                                                                                                                                                                                      | ✅ Verified |
| `expo-router`                   | `~57.0.25`   | Requires `expo-linking ~57.0.12`, `expo-constants ~57.0.21`, `expo-screens ~4.26.0`, `react-native-safe-area-context >=5.4.0`, `react-native-gesture-handler`. **SDK 56+ removed support for importing `@react-navigation/*` in app code** — use `expo-router` entry points only. | ✅ Verified |
| `convex`                        | `1.46.0`     | Ships `convex/react-clerk` — the Clerk provider needed. No separate `convex-react` package exists.                                                                                                                                                                                | ✅ Verified |
| **`@clerk/expo`**               | **`4.10.0`** | **Use this, NOT `@clerk/clerk-expo`.** `npm view @clerk/clerk-expo deprecated` returns: _"@clerk/clerk-expo is deprecated. Migrate to @clerk/expo"_. Peer `expo: ">=54 <58"` (includes 57).                                                                                       | ✅ Verified |
| `@clerk/nextjs`                 | `7.9.13`     | Peer `next: ^15.2.8 \|\| ... \|\| ^16.0.10 \|\| ^16.1.0-0`. Compatible with Next 16.4.                                                                                                                                                                                            | ✅ Verified |
| `next`                          | `16.4.0`     | **`next lint` is REMOVED.** Must use the ESLint CLI. `next build` no longer runs ESLint. See §7.2.                                                                                                                                                                                | ✅ Verified |
| `eslint`                        | `10.12.0`    | `eslint-config-next@16.4.0` and `eslint-config-expo@57.0.2` both accept it. `typescript-eslint@8.71.1` accepts `^10.0.0`.                                                                                                                                                         | ✅ Verified |
| `zod`                           | `4.6.5`      | v4. `@hookform/resolvers@5.9.1` peer accepts `^3.25.0 \|\| ^4.0.0`.                                                                                                                                                                                                               | ✅ Verified |
| `vitest`                        | `5.0.3`      | Single test runner for backend, shared, and admin. See §8.                                                                                                                                                                                                                        | ✅ Verified |
| `convex-test`                   | `0.0.60`     | Peer `convex: ^1.43.0` — satisfied by 1.46.0. Primary backend test harness.                                                                                                                                                                                                       | ✅ Verified |
| `@convex-dev/rate-limiter`      | **`0.4.1`**  | Official Convex component. Peer `convex: ^1.43.0`, `react: ^18.2.0 \|\| ^19.0.0`. _(An earlier draft of this doc cited 0.3.2 — corrected.)_                                                                                                                                       | ✅ Verified |
| `cloudinary`                    | `2.11.0`     | Server-side only. Never bundled to a client.                                                                                                                                                                                                                                      | ✅ Verified |
| `@testing-library/react-native` | `14.1.0`     | **Requires `test-renderer@^1.2` (not `react-test-renderer`) and peers `jest >=29`.** RNTL 14 is still **beta**.                                                                                                                                                                   | ⚠️ See §8.2 |
| `vitest-expo`                   | `57.1.0`     | Expo preset for Vitest.                                                                                                                                                                                                                                                           | ⚠️ See §8.2 |

### 2.2 Known ecosystem hazards (verified)

| Hazard                                                         | Detail                                                                                                                                                 | Mitigation                                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **`@clerk/clerk-expo` is deprecated**                          | Installing it produces a deprecation notice and a stale Core-2 API.                                                                                    | Pin `@clerk/expo@4.10.0`.                                                                                                     |
| **`Stack.Protected redirectTo` is SDK 58+**                    | The `redirectTo` prop does **not** exist in SDK 57.                                                                                                    | Use the `useAuth()` + `<Redirect>` pattern in SDK 57. `Stack.Protected guard={...}` works, but redirects to the anchor route. |
| **`@react-navigation/*` imports removed in SDK 56+**           | Direct imports fail.                                                                                                                                   | Use `expo-router` exports and `withLayoutContext` for custom navigators.                                                      |
| **Clerk requires an explicit `publishableKey` prop on Expo**   | _"Environment variables inside node_modules are not inlined during production React Native builds, so the prop must be passed explicitly."_            | Pass `publishableKey` explicitly in the root `ClerkProvider`.                                                                 |
| **Clerk Native API must be enabled**                           | Required for any Expo integration using `@clerk/expo`.                                                                                                 | Clerk Dashboard → Native applications → enable Native API.                                                                    |
| **`ConvexProviderWithClerk` can stay unauthenticated on Expo** | [convex-js#156](https://github.com/get-convex/convex-js/issues/156): sign out → sign back in can leave Convex unauthenticated despite a valid session. | Phase D must include an explicit regression test for re-authentication.                                                       |

### 2.3 Explicitly rejected

- **TanStack Query** — Convex is itself a reactive server-state cache (`useQuery` re-subscribes and
  diffs automatically). Adding a second cache creates two sources of truth and duplicated
  invalidation logic.
- **Redux** — no requirement that justifies the boilerplate. Zustand covers local UI state.
- **Prisma / Drizzle / Postgres** — Convex **is** the authoritative database. A second store would
  violate the single-source-of-truth rule.
- **`@clerk/clerk-expo`** — deprecated in favour of `@clerk/expo`. Not used.
- **Unsigned Cloudinary upload presets** — simpler, but anyone with the app bundle could upload
  arbitrary files. Replaced by the server-signed flow (§ `SECURITY.md`).
- **An offline write queue** — Convex does not queue offline mutations. A custom queue would
  silently reorder operations against a transactional backend.

---

## 2.4 Sources Consulted

Every claim marked ✅ above was checked against one of these. Nothing was assumed.

| Area                                                   | Source                                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Package versions & peers                               | `npm view <pkg> version` / `peerDependencies` / `deprecated` / `exports` — 2026-10-10                  |
| Expo/React Native pinning                              | `expo-template-default@57.0.29` and `expo-template-blank-typescript@57.0.29` manifests                 |
| Expo SDK 57 → RN 0.86 / React 19.2.3                   | Expo SDK reference table, `docs.expo.dev/versions/v57.0.0.md`                                          |
| Expo Router SDK 56 removal of `@react-navigation/*`    | `docs.expo.dev/versions/latest/sdk/router`                                                             |
| Expo Router protected routes / `Stack.Protected`       | `docs.expo.dev/router/advanced/protected`                                                              |
| Clerk + Expo install, config plugins, Core 3           | `docs.expo.dev/guides/using-clerk`                                                                     |
| Clerk ↔ Convex integration                             | `clerk.com/docs/guides/development/integrations/databases/convex`                                      |
| `ConvexProviderWithClerk` contract                     | `docs.convex.dev/api/modules/react_clerk` + `convex-js` source                                         |
| Convex auth (`getUserIdentity`, HTTP action behaviour) | `docs.convex.dev/auth/functions-auth`                                                                  |
| Convex OCC / serializable isolation                    | `docs.convex.dev/database/advanced/occ`, `stack.convex.dev/how-convex-works`                           |
| Convex full-text search limits                         | `docs.convex.dev/search/text-search`                                                                   |
| Convex pagination                                      | `docs.convex.dev/database/pagination` + `convex-js/src/server/pagination.ts`                           |
| Convex HTTP actions                                    | `docs.convex.dev/functions/http-actions`                                                               |
| Convex testing / `convex-test`                         | `docs.convex.dev/testing/convex-test`                                                                  |
| Rate limiter component                                 | `convex.dev/components/rate-limiter`                                                                   |
| Next.js 16 `next lint` removal                         | `nextjs.org/docs/app/guides/upgrading/version-16`                                                      |
| Cloudinary signed upload                               | `cloudinary.com/documentation/authentication_signatures`, `cloudinary_npm/docs/sign-browser-upload.md` |
| RNTL 14 requirements                                   | `oss.callstack.com/react-native-testing-library/docs/start/migration-v14`                              |

### 2.5 Fact vs. assumption

| Statement                                                       | Type                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| All package versions and peer ranges in §2.1                    | **Confirmed** — queried from the registry on 2026-10-10            |
| All behavioural constraints in §2.2                             | **Confirmed** — vendor documentation                               |
| Convex OCC gives serializable isolation across a whole mutation | **Confirmed** — vendor documentation                               |
| Business rules (tax, fees, order states)                        | **Assumption** — awaiting stakeholder input, see §11.1             |
| Payment provider = Stripe                                       | **Assumption** — unconfirmed                                       |
| Whether `vitest-expo@57.1.0` + RNTL 14 actually works together  | **Unverified** — see §8.2. Must be proven in Phase B, not assumed. |
| Everything else in this document                                | **Design proposal** — not implemented, not tested                  |

---

## 3. System Topology

```
┌──────────────────────────┐      ┌──────────────────────────┐
│   apps/mobile            │      │   apps/admin             │
│   Expo SDK 57 + RN 0.86  │      │   Next.js 16 (App Router)│
│   expo-router            │      │   React 19.2.3           │
│   Clerk Expo             │      │   Clerk Next.js          │
└───────────┬──────────────┘      └───────────┬──────────────┘
            │                                 │
            │  Clerk session JWT              │  Clerk session JWT
            │  (aud: "convex")                │  (aud: "convex")
            ▼                                 ▼
      ┌───────────────────────────────────────────────┐
      │            packages/convex  (BACKEND)         │
      │  auth.config.ts   → verifies Clerk JWT       │
      │  schema.ts        → single source of truth   │
      │  public/          → client-callable          │
      │  internal/        → server-only, unreachable │
      │  http.ts          → webhooks (Clerk, pay)    │
      └───────────┬───────────────────────┬───────────┘
                  │                       │
                  ▼                       ▼
        ┌──────────────┐        ┌──────────────────────┐
        │  Cloudinary  │        │  Payment provider    │
        │  (images)    │        │  (Stripe — deferred) │
        │  signed      │        │  webhook-verified    │
        │  uploads     │        └──────────────────────┘
        └──────────────┘
```

### 3.1 Trust boundaries

| Boundary                   | Rule                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Client → Backend           | **Untrusted.** Every argument is validated; every price/discount/role/total is recomputed server-side.                        |
| Backend → Cloudinary       | Trusted. `api_secret` never leaves the Convex runtime.                                                                        |
| Client → Cloudinary        | Untrusted. Client obtains a **short-lived server-signed parameter set**, then uploads directly. Client never sees the secret. |
| Payment provider → Backend | Untrusted until signature-verified on the webhook endpoint.                                                                   |
| Admin UI → Backend         | Authenticated **and** role-checked per function. UI hiding is not authorization.                                              |

---

## 4. Repository Structure

An npm-workspaces monorepo. Three deployable units plus one shared library.

```
D:\market
├─ package.json                  # root: workspaces, shared scripts
├─ tsconfig.base.json            # strict compiler options, shared by all
├─ eslint.config.mjs             # flat config (required by ESLint 10 / Next 16)
├─ .prettierrc.json
├─ .env.example                  # documented keys, NO real secrets
├─ .gitignore                    # includes .env*, !.env.example
├─ .nvmrc                        # 24
│
├─ docs/
│  ├─ ARCHITECTURE.md            # this file
│  ├─ DATA_MODEL.md              # tables, indexes, invariants
│  ├─ SECURITY.md                # threat model, authz matrix, controls
│  └─ IMPLEMENTATION_PLAN.md     # phased checklist, testing strategy
│
├─ packages/
│  ├─ convex/                    # THE BACKEND (deployable unit 1)
│  │  ├─ convex/
│  │  │  ├─ schema.ts            # table + index definitions
│  │  │  ├─ auth.config.ts       # Clerk JWT issuer configuration
│  │  │  ├─ http.ts              # HTTP router (webhooks)
│  │  │  ├─ _generated/          # codegen output — COMMITTED.
│  │  │  │                        # ⚠ CURRENTLY HAND-WRITTEN, NOT GENERATED.
│  │  │  │                        # `npx convex codegen` needs CONVEX_DEPLOYMENT,
│  │  │  │                        # and only `convex dev` can set that — which
│  │  │  │                        # creates an external deployment. Stubs work
│  │  │  │                        # (47 tests pass) but MUST be regenerated once
│  │  │  │                        # a deployment is linked. See its README.md.
│  │  │  ├─ lib/                 # auth guards, pricing engine, money
│  │  │  ├─ model/               # data-access functions (one per table)
│  │  │  ├─ public/              # queries/mutations callable by clients
│  │  │  └─ internal/            # server-only; not exposed to clients
│  │  ├─ convex.config.json
│  │  └─ package.json
│  │
│  └─ shared/                    # code shared by backend + both frontends
│     ├─ src/
│     │  ├─ domain/              # Zod schemas + inferred types
│     │  ├─ constants/           # order statuses, role names, limits
│     │  └─ utils/               # pure helpers (money formatting, slugs)
│     └─ package.json
│
├─ apps/
│  ├─ mobile/                    # THE CUSTOMER APP (deployable unit 2)
│  │  ├─ app/                    # expo-router file-based routes
│  │  ├─ src/
│  │  │  ├─ components/          # reusable UI (design system)
│  │  │  ├─ features/            # feature-sliced screens + hooks
│  │  │  ├─ hooks/
│  │  │  ├─ providers/
│  │  │  └─ theme/               # tokens, light/dark, RTL-aware
│  │  ├─ app.config.ts
│  │  ├─ eas.json
│  │  └─ package.json
│  │
│  └─ admin/                     # THE ADMIN DASHBOARD (deployable unit 3)
│     ├─ src/
│     │  ├─ app/                 # Next.js App Router
│     │  ├─ components/          # shared + admin-specific UI
│     │  ├─ features/
│     │  └─ lib/
│     ├─ next.config.ts
│     └─ package.json
│
└─ .github/workflows/            # CI: lint, typecheck, test, build
```

### 4.1 Why this shape

- **`packages/convex`** is a workspace, not a top-level `convex/` folder, so the backend has its
  own `package.json`, its own dependency versions, and its own test setup — without dragging
  React Native or Next.js into the server build.
- **`packages/shared`** holds Zod schemas and domain constants. The backend and both frontends
  import the _same_ schema, so a validation rule is defined once. It must stay dependency-free
  (Zod only) so it can be consumed by Convex, Metro, and Next.js without conflicts.
- **`apps/mobile` and `apps/admin` never import from each other.** Shared code goes through
  `packages/shared`. This prevents the admin dashboard from accidentally bundling mobile-only code.

---

## 5. Layering Model

Strict, one-directional. A violation is a lint/architecture failure, not a code-review note.

```
┌──────────────────────────────────────────┐
│  Presentation  (app/, src/app/)          │  Screens & routes. No business rules.
├──────────────────────────────────────────┤
│  Feature logic (features/, hooks/)       │  Client-side orchestration & view state.
├──────────────────────────────────────────┤
│  Domain contracts (packages/shared)      │  Zod schemas, types, constants. Pure.
└──────────────────────────────────────────┘
                    ▲ validated at
┌──────────────────────────────────────────┐
│  Server domain (packages/convex/model)   │  THE ONLY place business rules live.
├──────────────────────────────────────────┤
│  Server data access                      │  ctx.db + indexed queries.
└──────────────────────────────────────────┘
```

**Enforced rules**

1. No `convex/_generated` import in `apps/mobile` or `apps/admin`. Frontends import the generated
   _API reference_ (`convex/_generated/api`) only, never the data model.
2. No pricing, discount, tax, or stock arithmetic in any client file. Clients display numbers the
   server produced.
3. No `fetch` to Convex from a screen. All data access goes through `useQuery` / `useMutation` /
   `usePaginatedQuery`.
4. Every public Convex function starts with an auth guard (§6 of SECURITY.md).

---

## 6. Backend Design (packages/convex)

### 6.1 Function types and their constraints

| Type                                 | May call `ctx.db`                  | May do network I/O | Used for                                           |
| ------------------------------------ | ---------------------------------- | ------------------ | -------------------------------------------------- |
| `query`                              | Read only                          | **No**             | Reads: catalog, cart, orders                       |
| `mutation`                           | Read + write                       | **No**             | Writes: cart ops, order creation, stock            |
| `action`                             | No (uses `runQuery`/`runMutation`) | **Yes**            | Cloudinary upload, payment calls, webhooks         |
| `internalQuery` / `internalMutation` | Yes                                | No                 | Server-only helpers. **Not reachable by clients.** |
| `internalAction`                     | No                                 | Yes                | Server-only external calls                         |

This is not style preference. A Convex `mutation` is a serializable database transaction; any
non-deterministic operation (network call, `Date.now()`, `Math.random()`) inside one breaks the
transaction model. Mutations must use `ctx.scheduler` or an action when deferral is needed.

### 6.2 Transactional guarantees

Convex runs the **entire** mutation as one ACID transaction with **serializable isolation** and
optimistic concurrency control (OCC). This is the primary defence against overselling and duplicate
orders — no application-level locking is required or permitted.

**Verified platform facts** (see [`DATA_MODEL.md` §1.3](./DATA_MODEL.md) for citations):

| Fact                                                                                      | Design consequence                                                               |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| The read set records **index ranges**, not just returned documents                        | Enables the uniqueness pattern in `DATA_MODEL.md` §1.2                           |
| Conflicting mutations are **retried automatically**, with a bounded number of attempts    | Handler code must be idempotent and re-derive state on every attempt             |
| Mutations must be **deterministic** — no `Date.now()`, no `Math.random()`, no network I/O | `placeOrder` receives `now` as an argument; deferrals go through `ctx.scheduler` |
| Hot documents (a shared counter) are the primary OCC failure mode                         | Order numbers use a **sharded daily sequence**, not a global counter             |

Two further guarantees are used deliberately:

1. **Reactive query cache.** A `mutation` invalidates every subscribed query that read the affected
   documents. Stock decrements therefore propagate to open product pages automatically.
2. **Idempotency.** `orders` carries a per-user `idempotencyKey` with a supporting index. A retried
   checkout (double-tap, network retry, client crash) re-runs, finds the committed order, and
   returns it. The **index provides the lookup; the transaction provides the guarantee** — Convex
   indexes do not enforce uniqueness.

### 6.5 Currency handling

Prices are stored as **integer minor units** with a validated `currency` string, not a
`v.literal(...)`. The target currency is resolved from config in `packages/shared`. This means
switching market does **not** require a schema migration — only a config value and a
locale-aware formatter. See `DATA_MODEL.md` §1.4 and open decision **D1**.

### 6.3 Query strategy

| Need                           | Mechanism                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| Catalog browse / filter / sort | `.withIndex()` on purpose-built indexes + `.paginate()`                            |
| Text/typeahead search          | `.withSearchIndex()` on a denormalised `searchText` field                          |
| Cart / order detail            | Direct `_id` lookup via index                                                      |
| Any `.collect()`               | **Forbidden** unless the result set is provably bounded (e.g. a user's addresses). |

Convex search limits that shape the design: max 16 search terms per query, max 16 filter fields
per index, max 32 indexes per table, max 1024 documents scanned per search query. Category and
brand filtering therefore uses `filterFields` on the search index rather than post-filtering.

### 6.4 HTTP surface

`convex/http.ts` exposes exactly two unauthenticated routes:

| Route                     | Purpose                                            | Auth                 |
| ------------------------- | -------------------------------------------------- | -------------------- |
| `POST /webhooks/clerk`    | User created/updated/deleted sync, role assignment | Clerk Svix signature |
| `POST /webhooks/payments` | Payment settlement confirmation                    | Provider signature   |

`getUserIdentity()` **throws** rather than returning `null` inside an HTTP action. Both handlers
must therefore verify their own signature _before_ touching `ctx.auth`. Everything else is reached
through the Functions API, which carries the Clerk JWT.

---

## 7. Frontend Design

### 7.1 Mobile (Expo SDK 57 + expo-router)

| Concern    | Decision                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Navigation | `expo-router` file-based routes. Tabs at the root; modals as nested stacks. Import from `expo-router` entry points only — SDK 56+ removed `@react-navigation/*` imports.                               |
| Auth       | `@clerk/expo` `ClerkProvider` (pass `publishableKey` **explicitly**) → `ConvexProviderWithClerk` (`convex/react-clerk`). Token cache from `@clerk/expo/token-cache` (iOS Keychain / Android Keystore). |
| State      | Server state → Convex hooks. Ephemeral UI state → Zustand (`useCartDrawer`, `useFilters`).                                                                                                             |
| Forms      | React Hook Form + `@hookform/resolvers/zod` for checkout and admin forms.                                                                                                                              |
| Images     | `expo-image` with Cloudinary transformation URLs. No raw Cloudinary URLs stored.                                                                                                                       |
| Offline    | `expo-network` connectivity hook → explicit offline banner and disabled mutations. **No offline write queue** (see §7.4).                                                                              |
| RTL        | Layout uses `flexDirection: "row"`, never `row-reverse`; icons mirror via `I18nManager`.                                                                                                               |
| A11y       | Every control has an `accessibilityRole` and label; min 44×44pt touch target.                                                                                                                          |
| Updates    | EAS Update for JS-only changes; native changes require a new build.                                                                                                                                    |

### 7.2 Admin (Next.js 16)

| Concern | Decision                                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Router  | App Router. Server components for layout/chrome, client components for data-bound tables.                                                                                                   |
| Auth    | `@clerk/nextjs`. **Defense in depth:** the dashboard also checks the role via a Convex query and renders a 403 boundary, because Clerk middleware alone does not know the Convex-side role. |
| Styling | Tailwind CSS v4 with a token layer shared in spirit with the mobile theme.                                                                                                                  |
| Tables  | Server-paginated via Convex `usePaginatedQuery`. Never render an unbounded list.                                                                                                            |
| Lint    | `eslint` CLI directly — **`next lint` no longer exists in Next 16.**                                                                                                                        |

### 7.3 Loading / empty / error / success states

Every screen renders four explicit states. A screen that can only render "data" is incomplete.

| State   | Mobile                                                         | Admin                        |
| ------- | -------------------------------------------------------------- | ---------------------------- |
| Loading | Skeleton matching final layout                                 | Skeleton rows / table shell  |
| Empty   | Illustration + primary CTA + explanation                       | "No records" + create action |
| Error   | Retry button + plain-language message + error code in dev only | Toast + inline field errors  |
| Success | Optimistic update + confirmation                               | Toast + refetch              |

### 7.4 Offline and failure handling — deliberate limitation

Convex mutations do not queue offline. When the device is offline, a mutation **fails immediately**
and the user sees an explicit error. This is honest behaviour, not a bug, and is preferable to a
hidden write queue that could silently reorder operations.

The cart is therefore persisted **server-side** (not in local storage), so an offline user who
previously synced retains their cart when connectivity returns.

---

## 8. Testing Strategy

### 8.1 Tooling

| Scope             | Runner                 | Library                                         | Config                             | Confidence                   |
| ----------------- | ---------------------- | ----------------------------------------------- | ---------------------------------- | ---------------------------- |
| Backend logic     | **Vitest**             | `convex-test@0.0.60` + `@edge-runtime/vm`       | Convex runtime env                 | ✅ Documented by Convex      |
| Shared schemas    | **Vitest**             | —                                               | `packages/shared/vitest.config.ts` | ✅ Safe                      |
| Admin components  | **Vitest**             | `@testing-library/react@16.3.3`, `jsdom@30.1.2` | `jsdom` environment                | ✅ Safe                      |
| Mobile components | **Vitest (tentative)** | `vitest-expo@57.1.0` + RNTL `14.1.0`            | Expo preset                        | ⚠️ **Unverified — see §8.2** |
| E2E (admin)       | **Playwright**         | `@playwright/test@1.64.0`                       | Phase F                            | ✅ Standard                  |

`convex-test` is the decisive choice: it runs actual Convex functions against a real in-memory
backend with **real transactional semantics**, supports seeding, and can simulate authenticated
identities via `t.withIdentity(...)`. That means authorization tests exercise the actual guard code
rather than a mock of it. Its documented setup requires `@edge-runtime/vm` alongside it.

### 8.2 Mobile testing — an unresolved toolchain risk

This is recorded as a **known risk**, not a solved problem.

**The conflict:** `@testing-library/react-native@14.1.0` declares these peers:

```json
{ "jest": ">=29.0.0", "react": ">=19.0.0", "react-native": ">=0.78", "test-renderer": "^1.0.0" }
```

It peers on **Jest**, not Vitest, and RNTL 14 is still **beta**. Meanwhile `vitest-expo@57.1.0`
exists but is not documented by either vendor as a supported pairing with RNTL 14.

**Additional constraint:** RNTL 14 replaced `react-test-renderer` with the newer `test-renderer`
package (`test-renderer@^1.2` is the line matching React 19.2). `react-test-renderer` does **not**
support React 19+ and must not be installed.

**Resolution — decided by evidence, in this order:**

1. **Spike first.** In Phase B, install both candidates and run one trivial RNTL render test.
2. If `vitest-expo` + RNTL 14 works → use Vitest everywhere. One runner, one config style.
3. If it does not → **use `jest-expo@57.0.5` for `apps/mobile` only.** Vitest remains for backend,
   shared, and admin. A second runner scoped to one workspace is an acceptable cost; a broken or
   flaky test suite is not.

**This decision must be made by running the spike, not by reading this document.**

### 8.2 What must be tested (not everything)

Tests are written for **business flows and security boundaries**, per the brief — not for coverage
numbers.

| Priority | Suite             | Examples                                                                                                                                                         |
| -------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Authorization     | Customer A cannot read Customer B's cart/orders/addresses. Non-admin is rejected from every admin function. Anonymous is rejected from every protected function. |
| P0       | Pricing           | Server ignores client-supplied price. Coupon stacking, expiry, min-order, per-user caps. Rounding is correct at every boundary.                                  |
| P0       | Inventory         | Concurrent checkout never drives stock below zero. Cancelling an order restores stock exactly once.                                                              |
| P0       | Idempotency       | Same idempotency key twice ⇒ one order.                                                                                                                          |
| P0       | Webhook auth      | Unsigned/forged Clerk or payment webhook is rejected.                                                                                                            |
| P1       | Domain logic      | Slug generation, money formatting, address validation.                                                                                                           |
| P1       | Mobile components | Cart line item, quantity stepper, empty state, price formatting.                                                                                                 |
| P1       | Admin components  | Product form validation, role-gated navigation.                                                                                                                  |
| P2       | E2E               | Admin login → create product → appears in catalog.                                                                                                               |

### 8.3 Quality gates

Every phase must pass, in order. A phase is not complete if any gate fails.

```
npm run lint        # ESLint 10 flat config, zero errors
npm run typecheck   # tsc --noEmit, strict, across all workspaces
npm test            # Vitest across backend + shared + admin
npm run build       # convex codegen check + next build + expo export preflight
```

---

## 9. Environment Configuration

Full key list and rules live in [`SECURITY.md` §6](./SECURITY.md). Summary of the discipline:

- `.env.example` documents every key with a placeholder. **No real secret is ever committed.**
- `.gitignore` ignores `.env`, `.env.local`, `.env.*.local` and explicitly re-includes `.env.example`.
- Convex runtime secrets are set via `npx convex env set` — they live in the Convex dashboard, not
  in the repo and not in any client bundle.
- Client-visible variables use the `EXPO_PUBLIC_` / `NEXT_PUBLIC_` prefixes, and **only**
  non-secret values are ever given those prefixes.
- A CI secret scan runs on every push.

---

## 10. Deployment

| Unit    | Target                             | Process                                                                     |
| ------- | ---------------------------------- | --------------------------------------------------------------------------- |
| Backend | Convex Cloud                       | `npx convex dev` (shared dev deployment) → `npx convex deploy` (production) |
| Admin   | Vercel or container host           | `npm run build` in `apps/admin`; env vars set in the host's dashboard       |
| Mobile  | EAS Build → App Store / Play Store | `eas build --profile production`; `eas update` for JS-only releases         |

Production isolation: the production Convex deployment uses a **separate Clerk instance** (a
production Clerk app with its own issuer domain). Dev and prod JWT issuers never mix.

---

## 11. Assumptions

| #      | Assumption                                                                                                                                    | Risk if wrong | Resolution                                                                                                                               |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A1     | ~~Single currency (USD)~~ **Revised in A.2**: currency is a validated config value, not a hardcoded literal. Target market still unconfirmed. | Low           | Integer minor units is correct for any currency. Switching market is a config change, not a migration. **See D1.**                       |
| A2     | Cash-on-delivery is supported in addition to card payments                                                                                    | Low           | Payment layer is provider-agnostic from day one.                                                                                         |
| A3     | Two launch locales: **Arabic (`ar-EG`) RTL and English (`en`) LTR**                                                                           | Low           | Confirmed by the Phase B brief. Architecture is locale-agnostic; adding a locale is a folder + one entry.                                |
| A4     | Clerk is the sole identity provider                                                                                                           | Low           | `auth.config.ts` supports multiple providers by design.                                                                                  |
| A5     | Delivery is managed in-house (order status tracked manually by staff)                                                                         | Medium        | A courier integration would add an outbound webhook consumer; the order state machine already has the extension point.                   |
| A6     | Orders are placed only through the mobile app; the admin dashboard manages them but does not place them                                       | Low           |                                                                                                                                          |
| A7     | Ratings/reviews are out of scope for v1                                                                                                       | Low           | Product row already reserves `ratingAvg` / `ratingCount`.                                                                                |
| A8     | Single-vendor marketplace (one retailer), not multi-tenant                                                                                    | Medium        | A `vendorId` column would be added to products; no table restructure needed.                                                             |
| **A9** | **Carts do not reserve stock** — reservation happens only at `placeOrder`.                                                                    | Medium        | Prevents abandoned carts stranding inventory, at the cost of surfacing out-of-stock at checkout. Deliberate; see `DATA_MODEL.md` §3.6.4. |

### 11.1 Open decisions — require stakeholder input

Tracked formally as **D1–D6** in [`DATA_MODEL.md` §8.2](./DATA_MODEL.md).

| #      | Question                                                                 | Impact if unanswered                                                                                                   |
| ------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **D1** | **Target currency — EGP or USD?**                                        | Blocks final display formatting and gateway selection. Schema is already currency-agnostic, so this is a config value. |
| **D2** | **Tax model — VAT included in displayed price, or added at checkout?**   | Determines whether the cart renders a separate tax line and shapes the pricing engine.                                 |
| **D3** | **Reservation TTL for unpaid card orders?** (30 min suggested)           | Affects checkout copy and the expiry sweep schedule.                                                                   |
| **D4** | **Admin tiers** — single `admin`, or `staff` / `superadmin`?             | Grows the RBAC table; guard design is unaffected.                                                                      |
| **D5** | **Payment provider** — Stripe assumed. Confirm country of incorporation. | Phase F scope.                                                                                                         |
| **D6** | **Refund policy** and who may issue refunds.                             | Blocks refund mutations.                                                                                               |

### 11.2 Resolved during Phase A.2

| Question                                              | Resolution                                                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Do Convex indexes enforce uniqueness?                 | **No.** Replaced all "unique index" claims with the verified read-then-write-in-one-mutation pattern (`DATA_MODEL.md` §1.2).          |
| Are Convex indexes enforced for values or only names? | **Names only.** Corroborated by open upstream issue convex-ents#51.                                                                   |
| What are the real platform limits?                    | Now fully tabulated with citations (`DATA_MODEL.md` §1.5) — includes **16 fields per index**, which the first draft omitted entirely. |
| Does `maximumRowsRead` bound search queries?          | **No** — not enforced for search. Catalog search must cap in application code.                                                        |
| How does stock behave across the order lifecycle?     | Fully specified: reserve → commit / release / return, with an exactly-once release guard (`DATA_MODEL.md` §3.6).                      |
| Is a global order counter safe?                       | **No** — hot-document OCC failure. Replaced with a sharded daily sequence.                                                            |

---

## 12. Cross-References

- Table definitions, indexes, and invariants → [`DATA_MODEL.md`](./DATA_MODEL.md)
- Threat model, authorization matrix, secret handling → [`SECURITY.md`](./SECURITY.md)
- Phased checklist, acceptance criteria → [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)
