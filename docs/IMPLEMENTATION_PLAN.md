# Implementation Plan — Grocery Marketplace

**Status:** Phase A complete. **Phase B not started.**
**Last updated:** 2026-10-10
**Related:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`DATA_MODEL.md`](./DATA_MODEL.md) · [`SECURITY.md`](./SECURITY.md)

---

## 1. Progress Summary

| Phase | Scope                                                                   | Status          |
| ----- | ----------------------------------------------------------------------- | --------------- |
| **A** | Requirements, architecture, data model, security plan, testing strategy | ✅ **Complete** |
| B     | Design system and UI foundations                                        | ⬜ Not started  |
| C     | Database, authentication, backend                                       | ⬜ Not started  |
| D     | Customer mobile app                                                     | ⬜ Not started  |
| E     | Admin dashboard                                                         | ⬜ Not started  |
| F     | Integration, security hardening, performance, release                   | ⬜ Not started  |

**Files produced so far** (all in `D:\market\docs\`, no application code):

| File                     | Purpose                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `ARCHITECTURE.md`        | Stack, verified versions, sources, repo structure, layering, testing, deployment, assumptions |
| `DATA_MODEL.md`          | 16 tables, indexes, invariants, checkout transaction, migration strategy                      |
| `SECURITY.md`            | 17 threats, authn/authz, authorization matrix, secrets, uploads, payments                     |
| `IMPLEMENTATION_PLAN.md` | this file — phased checklist, gates, blockers                                                 |

### 1.1 Corrections made in Phase A final review

Phase A was re-verified against vendor documentation before being called complete. Five errors in
the first draft were found and fixed. They are listed because a planning document that has never
been checked is worth nothing:

| #   | Error in first draft                                                 | Correction                                                                                                     |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Listed `@clerk/clerk-expo@2.20.0` as the Expo SDK                    | That package is **deprecated**. Correct SDK is `@clerk/expo@4.10.0` (peer `expo: ">=54 <58"`).                 |
| 2   | Cited `@convex-dev/rate-limiter@0.3.2`                               | Current version is **0.4.1**.                                                                                  |
| 3   | Asserted Cloudinary `constraining_format` as a signed-upload control | Not a signed-upload parameter. The correct control is `allowed_formats`.                                       |
| 4   | Asserted a signed parameter could cap upload size                    | No such parameter exists. Size is enforced by Cloudinary account Usage Limits; client-side checks are UX only. |
| 5   | Implied RNTL 14 + Vitest was a settled choice                        | RNTL 14 peers on **Jest**, not Vitest, and is beta. Now recorded as an open risk with a Phase B spike.         |

Two further hazards were added that were not previously documented: `Stack.Protected redirectTo`
is SDK 58+ only, and `ConvexProviderWithClerk` has a known re-authentication bug on Expo.

---

## 2. Blockers Before Phase C

These are **hard blockers** — Phase C cannot be completed without them. They are listed first
because they require human action outside this environment.

| #      | Blocker                                                                                                                                                                                                                        | Why it blocks                                                                                                   | Owner                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------ |
| B1     | **No Convex project linked to this repo.** A deployment exists (`impartial-curlew-234`), but no `CONVEX_DEPLOYMENT` in this repo and no `packages/convex/package.json`. `npx convex dev` fails fast without that package.json. | The backend cannot be pushed, so no real query can be written or tested against a live deployment.              | Engineer + Product owner |
| B2     | **No Clerk account/instance.** Neither a publishable nor a secret key exists in the environment.                                                                                                                               | `auth.config.ts` needs a real issuer domain; the mobile app cannot authenticate.                                | Product owner            |
| B3     | **No Cloudinary account.** No cloud name, API key, or secret.                                                                                                                                                                  | Signed uploads cannot be implemented or tested.                                                                 | Product owner            |
| B4     | **Payment provider decision** (D5).                                                                                                                                                                                            | Determines whether card payments land in Phase C or Phase F.                                                    | Product owner            |
| B5     | **Tax model decision** (D2).                                                                                                                                                                                                   | Changes the pricing engine and whether the cart renders a tax line.                                             | Product owner            |
| B6     | ~~`D:\market` is not a git repository.~~                                                                                                                                                                                       | **RESOLVED** — repo initialized. Still **unborn**: no commits.                                                  | —                        |
| **B7** | **Currency decision (D1)** — EGP or USD.                                                                                                                                                                                       | Does **not** block the schema (currency is a validated string, not a literal). Blocks final display formatting. | Product owner            |
| **B8** | **Reservation TTL (D3)**, **admin tiers (D4)**, **refund policy (D6)**.                                                                                                                                                        | Checkout copy, RBAC table, refund mutations.                                                                    | Product owner            |

**Phases B and the non-blocked parts of C (schema, guards, pricing engine, uniqueness patterns,
tests via `convex-test`) can proceed while B1–B8 are pending**, because `convex-test` runs a real
in-memory Convex backend without a cloud account.

---

## 3. Phase A — Requirements & Architecture ✅

| #    | Deliverable                                                | Status                     |
| ---- | ---------------------------------------------------------- | -------------------------- |
| A.1  | Workspace inspection; confirmed empty, nothing overwritten | ✅                         |
| A.2  | Toolchain inventory (Node 24.14.0, npm 11.9.0, Git 2.55.0) | ✅                         |
| A.3  | Version compatibility verified against npm + vendor docs   | ✅                         |
| A.4  | Architecture document                                      | ✅ `ARCHITECTURE.md`       |
| A.5  | Repository structure                                       | ✅ `ARCHITECTURE.md` §4    |
| A.6  | Core data model                                            | ✅ `DATA_MODEL.md`         |
| A.7  | Security plan + authorization matrix                       | ✅ `SECURITY.md`           |
| A.8  | Testing strategy                                           | ✅ `ARCHITECTURE.md` §8    |
| A.9  | Environment variable plan                                  | ✅ `SECURITY.md` §6        |
| A.10 | Deployment plan                                            | ✅ `ARCHITECTURE.md` §10   |
| A.11 | Documented assumptions (A1–A8)                             | ✅ `ARCHITECTURE.md` §11   |
| A.12 | Open questions for stakeholder                             | ✅ `ARCHITECTURE.md` §11.1 |
| A.13 | Implementation checklist                                   | ✅ this file               |

**Key decisions recorded in Phase A**

| Decision                                          | Rationale                                                                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript **6.0.3**, not 7.0.2                   | `typescript-eslint@8.71.1` peer-caps at `<6.1.0`. npm `latest` would break linting.                                              |
| Single React **19.2.3** across all apps           | The only version satisfying Expo 57 _and_ `@clerk/nextjs@7.9.13`.                                                                |
| **`@clerk/expo@4.10.0`**, not `@clerk/clerk-expo` | The latter is officially deprecated.                                                                                             |
| ESLint 10 flat config, **not** `next lint`        | `next lint` was removed in Next.js 16. `next build` no longer lints, so lint must be its own CI step.                            |
| `convex/react-clerk`, not `convex-react`          | The latter does not exist; it is an export of the `convex` package.                                                              |
| Vitest for backend/shared/admin; mobile TBD       | `convex-test` runs real Convex functions with real transactional semantics. Mobile runner pending a Phase B spike — see §4 B.16. |
| npm workspaces, not Turborepo/Nx                  | Three packages. A task runner is unjustified overhead.                                                                           |
| Money as integer minor units                      | Avoids floating-point rounding.                                                                                                  |
| Stock in a separate `inventoryLevels` table       | Enables an auditable ledger and exactly-once restoration.                                                                        |
| No offline write queue                            | Convex does not queue; a fake queue would silently reorder operations.                                                           |
| Signed Cloudinary uploads with `allowed_formats`  | `constraining_format` is not a signed parameter; size limits come from account Usage Limits.                                     |

---

## 4. Phase B — Design System & UI Foundations

**Goal:** shared visual language and reusable primitives, with no business logic and no backend.

### B tasks

| #    | Task                                                                                                                                                                                                                            | Output             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| B.1  | `git init`, `.gitignore`, `.editorconfig`, `LICENSE`                                                                                                                                                                            | Repo hygiene       |
| B.2  | Root `package.json` with workspaces + scripts                                                                                                                                                                                   | Monorepo skeleton  |
| B.3  | `tsconfig.base.json` — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`                                                                                                                                       | Type safety        |
| B.4  | `eslint.config.mjs` (flat), `eslint-config-expo`, `eslint-config-next`                                                                                                                                                          | Linting            |
| B.5  | `.prettierrc.json` + `prettier-plugin-tailwindcss`                                                                                                                                                                              | Formatting         |
| B.6  | `.env.example` — every key documented, no real values                                                                                                                                                                           | Config contract    |
| B.7  | `.github/workflows/ci.yml` — lint, typecheck, test, build, secret scan                                                                                                                                                          | CI baseline        |
| B.8  | `packages/shared`: Zod schemas for address, product, cart, order, coupon                                                                                                                                                        | Domain contracts   |
| B.9  | `packages/shared`: constants (statuses, roles, limits, error codes)                                                                                                                                                             | Single source      |
| B.10 | `packages/shared`: pure utils (money format, slug, clamp) — 100% tested                                                                                                                                                         | Pure logic         |
| B.11 | Mobile theme: color, spacing, typography, radius, elevation tokens                                                                                                                                                              | Design tokens      |
| B.12 | Mobile primitives: `Text`, `Button`, `Input`, `Card`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`                                                                                                                           | Component library  |
| B.13 | Admin Tailwind v4 theme mirroring the mobile tokens                                                                                                                                                                             | Visual parity      |
| B.14 | Admin primitives: `DataTable`, `FormField`, `Dialog`, `Toast`, `StatusPill`                                                                                                                                                     | Component library  |
| B.15 | RTL + accessibility pass on all primitives                                                                                                                                                                                      | A11y baseline      |
| B.16 | **Spike: prove the mobile test runner works.** Try `vitest-expo@57.1.0` + RNTL `14.1.0` with one trivial render test. If it fails, fall back to `jest-expo@57.0.5` for `apps/mobile` only. **Record which runner won and why.** | Toolchain decision |
| B.17 | Vitest configured for shared; all utils green                                                                                                                                                                                   | Test harness       |

### Gate B — all must pass

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

- Zero ESLint errors across every workspace.
- Zero TypeScript errors with `strict` + `noUncheckedIndexedAccess`.
- 100% pass on `packages/shared` tests.
- `next build` succeeds on a placeholder admin route.
- `expo export --platform web` succeeds on the placeholder mobile app (proves the RN bundle resolves).
- CI runs green on a push.

### Definition of done for Phase B

- A new screen can be built from existing primitives alone, with correct loading/empty/error states.
- No secrets in `.env.example`; CI secret scan passes.
- Dark mode, RTL, and screen-reader labels verified on every primitive.

---

## 5. Phase C — Database, Authentication & Backend

**Goal:** the authoritative server. Blocked on B1–B5 for live verification; unblocked for local work via `convex-test`.

### C tasks

| #    | Task                                                                         | Depends on |
| ---- | ---------------------------------------------------------------------------- | ---------- |
| C.1  | `packages/convex` workspace + `convex/` directory                            | —          |
| C.2  | `schema.ts` — all 16 tables with indexes and the search index                | —          |
| C.3  | `auth.config.ts` + `lib/env.ts` (Zod-validated env, fails fast)              | —          |
| C.4  | `lib/auth.ts` — `requireUser`, `requireAdmin`, `requireOwned`                | —          |
| C.5  | `lib/money.ts`, `lib/slug.ts` — pure, unit-tested                            | —          |
| C.6  | `lib/pricing.ts` — the pricing engine (subtotal, coupon, delivery, tax)      | B5         |
| C.7  | `model/` — data access per table                                             | C.2        |
| C.8  | `public/catalog.ts` — list, get, search, filter, sort, paginate              | C.7        |
| C.9  | `public/cart.ts` + `public/wishlist.ts`                                      | C.7        |
| C.10 | `public/addresses.ts` — with the single-default invariant                    | C.7        |
| C.11 | `public/orders.ts` — **`placeOrder` transaction**                            | C.6, C.7   |
| C.12 | `internal/admin/*` — products, inventory, coupons, users, order status       | C.4        |
| C.13 | `public/media.ts` — signed Cloudinary upload                                 | B3         |
| C.14 | `http.ts` — Clerk webhook (signature verified)                               | B2         |
| C.15 | Rate limiting via `@convex-dev/rate-limiter`                                 | C.4        |
| C.16 | Clerk JWT wired end-to-end (`ConvexProviderWithClerk`)                       | B1, B2     |
| C.17 | **P0 test suite** (see §7)                                                   | C.4–C.15   |
| C.18 | Scheduled mutation: expire abandoned `pending_payment` orders, restore stock | C.11       |
| C.19 | Structured error handling (`ConvexError` codes)                              | —          |
| C.20 | Seed script for a realistic dev catalog (**dev only**, clearly labelled)     | C.8        |

### Gate C

- Every P0 test in §7 passes, including concurrency and idempotency.
- A test enumerating the public API surface proves **every** function is auth-guarded.
- A test posting `priceMinor: 0` to `placeOrder` proves the server ignores it.
- 20 concurrent `placeOrder` calls for a 10-unit product produce exactly 10 successful orders and
  leave `available === 0` — never negative.
- `npx convex dev` pushes cleanly to a real deployment; `npx convex deploy` works to prod.
- `npm run lint && npm run typecheck && npm test && npm run build` all green.

---

## 6. Phase D — Customer Mobile Application

| #    | Task                                                                                                                                                                         | Notes                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| D.1  | Expo Router route tree: `(auth)`, `(tabs)`, `product/[slug]`, `cart`, `checkout`, `orders`, `account`                                                                        | File-based                |
| D.2  | Root providers: `ClerkProvider` (explicit `publishableKey`) → `ConvexProviderWithClerk` → theme → safe area                                                                  | Composition order matters |
| D.3  | Auth screens: sign in, sign up, verify, forgot password                                                                                                                      | Clerk flows               |
| D.4  | Route protection. **SDK 57 caveat:** `Stack.Protected`'s `redirectTo` prop is SDK 58+, so use the `useAuth()` + `<Redirect>` pattern in the `(auth)`/`(tabs)` layout guards. | UX only; server enforces  |
| D.5  | Home: categories, featured products, search entry                                                                                                                            |                           |
| D.6  | Catalog: filter sheet, sort menu, infinite scroll via `usePaginatedQuery`                                                                                                    |                           |
| D.7  | Product detail: gallery, variant picker, quantity, add-to-cart                                                                                                               |                           |
| D.8  | Search with debounce + typeahead                                                                                                                                             |                           |
| D.9  | Cart: lines, quantity stepper, remove, coupon field, live totals from the server                                                                                             | **No client math**        |
| D.10 | Checkout: address form (RHF + Zod), address book, payment method, place order                                                                                                | Includes idempotency key  |
| D.11 | Order confirmation + order history + order detail with status timeline                                                                                                       |                           |
| D.12 | Account: profile, addresses CRUD, logout                                                                                                                                     |                           |
| D.13 | Offline banner via `expo-network`; mutations disabled while offline                                                                                                          | Honest failure            |
| D.14 | Loading/empty/error states on every screen                                                                                                                                   | Non-negotiable            |
| D.15 | RTL + accessibility pass on all screens                                                                                                                                      |                           |
| D.16 | Component tests with RNTL                                                                                                                                                    |                           |
| D.17 | **Regression test for sign-out → sign-in leaving Convex unauthenticated** (convex-js#156)                                                                                    | Known upstream bug        |
| D.18 | EAS project config, `eas.json` profiles, app icons, splash                                                                                                                   |                           |

### Gate D

- A user can register → browse → search → add to cart → apply a coupon → check out → view the order.
- Every screen has all four states.
- Lint, typecheck, tests, and `expo export` all green.
- No secret appears in the bundle (CI grep).

---

## 7. P0 Backend Test Suite (built in Phase C, extended thereafter)

Every item is a **named test file**, not a category. These must be written **before** the
implementation they cover, not after — a concurrency test written afterwards tests whatever the
implementation happened to do.

Run with `convex-test` against a real in-memory Convex backend, which reproduces genuine
transactional and OCC semantics. `Promise.allSettled` is used deliberately: `Promise.all` rejects on
the first failure and would mask exactly the races these tests exist to detect.

### 7.1 Concurrency and inventory (the oversell defences)

| File                                     | Assertion                                                                                                                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory.lastItem.test.ts`             | 10 units in stock; **20 concurrent** `placeOrder` calls each wanting 1 unit ⇒ **exactly 10 succeed**, 10 reject, `available === 0`, **never negative**, exactly 10 `reserve` movements. |
| `inventory.multiLineCheckout.test.ts`    | A cart with 3 variants where one is short ⇒ the **whole** transaction aborts. No partial order, no partial stock movement, cart untouched.                                              |
| `inventory.reserveCommitRelease.test.ts` | Reserve (+reserved) → commit (−onHand, −reserved) → release are individually correct, and `available` returns to its original value across the cycle.                                   |
| `inventory.releaseExactlyOnce.test.ts`   | Cancellation and the expiry sweep race on the same order ⇒ `reserved` released **once**. Assert `by_order_variant_reason` contains exactly one `release` movement.                      |
| `inventory.cancelAfterDispatch.test.ts`  | Cancelling after `commit` produces a `return` movement (+onHand), **not** a `release`. Guards against restoring stock that already left the warehouse.                                  |
| `inventory.negativeGuard.test.ts`        | `available < quantity` ⇒ checkout aborts with a per-line reason, never a silent partial success.                                                                                        |
| `inventory.cartNoReservation.test.ts`    | Adding to cart creates **no** `inventoryMovements` row. Confirms §3.6.4 (carts do not hold stock).                                                                                      |

### 7.2 Idempotency and duplicate writes

| File                                   | Assertion                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `orders.idempotency.test.ts`           | Same key twice ⇒ **one** order, **one** stock reservation, second call returns `replayed: true`.                                            |
| `orders.idempotencyConcurrent.test.ts` | **10 concurrent** `placeOrder` calls, same user + same key ⇒ exactly 1 order, 1 reservation, 9 replays. The headline duplicate-submit test. |
| `orders.idempotencyScope.test.ts`      | Two **different** users with the **same** key each get their own order. Verifies per-user scoping (§3.11.1).                                |
| `orders.idempotencyRequired.test.ts`   | Omitting `idempotencyKey` ⇒ argument-validation error. The field is required, not optional.                                                 |
| `orders.sequentialNumber.test.ts`      | Concurrent checkouts ⇒ distinct `orderNumber`s from the sharded daily sequence; no duplicates, no gaps that matter.                         |

### 7.3 Uniqueness (the §1.2 pattern)

Each proves both the happy path **and** that the guarantee comes from the transaction, not the index.

| File                                | Assertion                                                                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uniqueness.sku.test.ts`            | Concurrent insert of the same SKU ⇒ exactly one succeeds. Case variants (`abc` / `ABC`) collide because normalisation happens **before** the read. |
| `uniqueness.slug.test.ts`           | Same for product and category slugs; collision suffix allocation is unique under concurrency.                                                      |
| `uniqueness.couponCode.test.ts`     | Same for coupon codes, uppercased first.                                                                                                           |
| `uniqueness.defaultAddress.test.ts` | Concurrent "set default" ⇒ exactly one address has `isDefault: true`.                                                                              |
| `uniqueness.primaryImage.test.ts`   | Concurrent "set primary" ⇒ exactly one primary image per product.                                                                                  |
| `uniqueness.cart.test.ts`           | Concurrent first-add-to-cart ⇒ one cart, one line per variant.                                                                                     |
| `uniqueness.wishlist.test.ts`       | Double-tap save ⇒ one `wishlistItems` row.                                                                                                         |
| `uniqueness.clerkUser.test.ts`      | Concurrent (redelivered) Clerk webhooks ⇒ one `users` row.                                                                                         |

### 7.4 Authorization

| File                                  | Assertion                                                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `authz.guard.test.ts`                 | Enumerate the public API surface; every exported function rejects an anonymous caller. Catches an unguarded function added later. |
| `authz.ownership.test.ts`             | User A cannot read/update/delete User B's cart, wishlist, addresses, orders.                                                      |
| `authz.admin.test.ts`                 | Non-admins rejected from every `admin/*` function.                                                                                |
| `authz.suspension.test.ts`            | Suspended users cannot write.                                                                                                     |
| `authz.roleNotClientSupplied.test.ts` | No public function accepts a `role` argument.                                                                                     |
| `authz.noUserRow.test.ts`             | A valid Clerk identity with no `users` row returns "provisioning in progress", not a crash.                                       |

### 7.5 Pricing and coupons

| File                                     | Assertion                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pricing.serverAuthority.test.ts`        | `placeOrder` with `priceMinor: 0` ⇒ full real price charged.                                                                    |
| `pricing.priceChangeMidCheckout.test.ts` | Admin reprices a variant between cart-load and checkout ⇒ customer is charged the new price, never the stale one.               |
| `pricing.coupon.test.ts`                 | Expiry, min-subtotal, per-user cap, global cap, max-discount clamp, stacking.                                                   |
| `pricing.couponRace.test.ts`             | **10 concurrent** checkouts against a coupon with `usageLimit: 3` ⇒ exactly 3 redemptions. Proves §3.10's index-range argument. |
| `pricing.couponStale.test.ts`            | Cart coupon expired since being applied ⇒ checkout rejects explicitly, does not silently drop the discount.                     |
| `pricing.rounding.test.ts`               | Percent discount rounding is correct at every boundary (0, 1 cent, half-cent, exact 100%).                                      |
| `pricing.currency.test.ts`               | Totals carry the correct `currency`; a mismatched currency is rejected, never silently converted.                               |

### 7.6 Webhooks and payments

| File                                 | Assertion                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `webhooks.clerkSignature.test.ts`    | Unsigned and forged Clerk webhooks rejected. A valid one upserts the user.       |
| `webhooks.paymentSignature.test.ts`  | Forged payment webhook cannot mark an order paid.                                |
| `webhooks.duplicateDelivery.test.ts` | Same event delivered **5×** ⇒ exactly one state change, all return 200.          |
| `webhooks.unknownReference.test.ts`  | Event for an unknown `providerRef` ⇒ **no** payment row created; 200 returned.   |
| `webhooks.amountMismatch.test.ts`    | Provider amount ≠ `orders.totalMinor` ⇒ not marked paid; `failureCode` recorded. |
| `webhooks.replayWindow.test.ts`      | Event with a stale timestamp ⇒ rejected.                                         |
| `webhooks.outOfOrder.test.ts`        | `refunded` arriving before `captured` ⇒ state does **not** regress.              |
| `refunds.cumulativeLimit.test.ts`    | Refunds totalling more than the captured amount ⇒ rejected.                      |
| `refunds.noAutoRestock.test.ts`      | Issuing a refund creates **no** inventory movement.                              |

### 7.7 Operational edge cases

| File                                 | Assertion                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `edge.archivedProductInCart.test.ts` | Archived product in cart ⇒ checkout aborts with a per-line reason; cart renders the state. |
| `edge.emptyCartCheckout.test.ts`     | Checkout on an empty cart ⇒ clear error, no order.                                         |
| `edge.maxQuantity.test.ts`           | Quantity cap enforced; integer-only quantities rejected.                                   |
| `edge.negativeTotal.test.ts`         | A discount exceeding the subtotal is clamped; `totalMinor >= 0` always holds.              |

### 7.8 What is deliberately NOT tested

Explicitly out of scope, so nobody adds them later by reflex:

- **Pure function unit tests for money formatting** — these live in `packages/shared` with plain
  Vitest, not here.
- **Rendering** — component tests belong to the mobile package.
- **Load/performance tests** — Phase F; they need a realistic dataset, not fixtures.
- **Anything asserting Convex enforces uniqueness** — it does not. These tests assert _our_
  transaction does.

---

## 8. Phase E — Admin Dashboard

| #    | Task                                                                               |
| ---- | ---------------------------------------------------------------------------------- |
| E.1  | Clerk auth + `requireAdmin` gate + 403 boundary                                    |
| E.2  | Dashboard shell: nav, user menu, responsive sidebar                                |
| E.3  | Product list: paginated table, search, filter by status/category                   |
| E.4  | Product editor: RHF + Zod, variants, category, images via signed Cloudinary upload |
| E.5  | Inventory: levels table, manual adjustment writing a movement row, low-stock view  |
| E.6  | Order queue: filter by status, order detail, status transitions, refund action     |
| E.7  | Coupon management: create/edit, limits, deactivate                                 |
| E.8  | User management: list, search, promote/demote, suspend                             |
| E.9  | Audit log viewer                                                                   |
| E.10 | Component tests; Playwright E2E for the critical admin flow                        |

### Gate E

- A non-admin cannot reach any admin page (verified by E2E, not just by UI hiding).
- Every admin mutation writes an `auditLogs` row (asserted by test).
- Full lint/typecheck/test/build green.

---

## 9. Phase F — Integration, Security, Performance, Release

| #    | Task                                                                         | Notes         |
| ---- | ---------------------------------------------------------------------------- | ------------- |
| F.1  | **Payments** — provider SDK, webhook handler with raw-body HMAC verification | Blocked on B4 |
| F.2  | Payment state machine + reconciliation                                       |               |
| F.3  | Full security checklist from `SECURITY.md` §13                               |               |
| F.4  | `gitleaks` + `npm audit --audit-level=high` in CI                            |               |
| F.5  | Bundle-size and image-delivery audit                                         |               |
| F.6  | Query performance review — confirm every hot query is index-backed           |               |
| F.7  | Error monitoring wired to both apps                                          |               |
| F.8  | Production Convex deployment + separate Clerk prod instance                  |               |
| F.9  | Admin deployed to a host with env vars in the host dashboard                 |               |
| F.10 | EAS production build + store submission                                      |               |
| F.11 | Runbook: rollback, restore stock procedure, key rotation, incident response  |               |
| F.12 | End-to-end UAT against a staging deployment                                  |               |

### Gate F — production readiness

Every item in `SECURITY.md` §13 is checked. Payment flow verified with real (test-mode) transactions
and confirmed-failed transactions. Rollback rehearsed. Monitoring confirmed to deliver an alert.

---

## 10. Cross-Phase Quality Gates

Run in order; a phase is incomplete if any gate fails.

```bash
npm run lint        # ESLint 10 flat config — zero errors
npm run typecheck   # tsc --noEmit — strict + noUncheckedIndexedAccess
npm test            # Vitest — backend (convex-test), shared, admin, mobile
npm run build       # convex codegen check + next build + expo export preflight
```

| Gate    | Standard                                                  |
| ------- | --------------------------------------------------------- |
| Lint    | 0 errors, 0 warnings                                      |
| Types   | 0 errors; `any` disallowed outside generated/vendor code  |
| Tests   | 100% pass; no skipped or `.only` tests committed          |
| Build   | All three build targets succeed                           |
| Secrets | No real secret in any `.env` committed; bundle grep clean |

---

## 11. Definition of Done (System-Level)

The application is production-ready only when **all** of the following are verified — not merely
"it compiles":

1. ✅ Authorization verified by tests across the full matrix, including negative cases.
2. ✅ Order processing reliable — idempotent, transactional, concurrency-safe.
3. ✅ Inventory validated on every write path, with an auditable ledger.
4. ✅ Image uploads signed and constrained.
5. ✅ Meaningful tests for critical flows and security boundaries.
6. ✅ Environment configuration fully documented, no real secrets in source control.
7. ✅ Operational error handling with correlation ids and no PII in logs.
8. ✅ Reproducible release: one documented command sequence from clean clone to production.
9. ✅ Rollback rehearsed.
10. ✅ Monitoring confirmed to alert on failure.

---

## 12. Immediate Next Actions

1. **Resolve blockers B1–B6.** B6 (git init) requires no external input and can be done now.
2. **Answer open questions Q1–Q6** in `ARCHITECTURE.md` §11.1.
3. **Confirm Phase B scope** — the checklist above is a proposal, not an agreed plan.
4. On approval: execute Phase B, then run the Gate B commands and report actual output.

**No claim in this document asserts that a test, build, or deployment has passed.** As of
2026-10-10, no application code exists and no command has been run against a real deployment.
