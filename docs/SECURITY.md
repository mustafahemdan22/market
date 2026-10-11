# Security — Grocery Marketplace

**Status:** Proposed (Phase A — nothing implemented yet)
**Last reviewed:** 2026-10-10
**Related:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`DATA_MODEL.md`](./DATA_MODEL.md)

---

## 1. Security Principles

1. **The server is the only authority.** Prices, discounts, totals, roles, stock, and order status
   are computed or verified in Convex. Client values are display hints at best.
2. **Deny by default.** A function without an explicit guard call is treated as a bug and caught by
   a lint rule plus a test that asserts every public function is guarded.
3. **Authenticate and authorize separately.** "Is this a real user?" (Clerk) is a different question
   from "May this user touch this row?" (ownership check).
4. **Secrets live only in the Convex runtime.** No secret is ever in a client bundle, a log line,
   a screenshot, or git.

---

## 2. Threat Model

| # | Threat | Control | Verified by |
|---|---|---|---|
| T1 | Anonymous user calls a protected mutation | Auth guard rejects when `getUserIdentity()` is null | P0 authz tests |
| T2 | User A reads/edits User B's cart, address, or order | Ownership check: `doc.userId !== userId` ⇒ throw, on **every** row access | P0 authz tests |
| T3 | Client sends a fake `priceMinor` to reduce the total | Checkout recomputes `unitPrice` from `productVariants`; client arg is never read | P0 pricing tests |
| T4 | Client claims `role: "admin"` | `role` is not a function argument anywhere; it lives in `users` and is set by webhook/allowlist or admin mutation | Compile-time (no such arg exists) + P0 test |
| T5 | Client over-requests stock to oversell | Stock decremented only inside the serializable `placeOrder` transaction with a re-read of `inventoryLevels` | Concurrency test |
| T6 | Double-tap on "Place order" creates two orders | `orders.by_user_idempotencyKey` lookup **inside the same mutation as the insert**. Convex indexes do not enforce uniqueness; the serializable transaction does. | Idempotency test (10 concurrent, same key) |
| T6b | Concurrent duplicate SKU / slug / coupon-code / order-number / payment-ref writes | Read-then-write in one mutation, reading the exact index range that the insert writes to (`DATA_MODEL.md` §1.2) | Uniqueness test suite |
| T6c | Coupon global usage limit exceeded by racing checkouts | Redemption count read via `by_coupon` in-transaction; insert writes the same range ⇒ OCC forces re-read | Coupon race test (10 concurrent, limit 3) |
| T6d | Reservation released twice (cancel racing expiry sweep) | `inventoryMovements.by_order_variant_reason` guard makes `release` exactly-once | Release-exactly-once test |
| T7 | Forged Clerk webhook promotes a user to admin | Svix signature verified before parsing; `role` assigned only from a server-side allowlist | P0 webhook test |
| T8 | Forged payment webhook marks an order paid | Provider signature verified with a constant-time compare before any mutation | P0 webhook test |
| T9 | `api_secret` leaks into the mobile bundle | Secret exists only in Convex env; client receives a short-lived signature | Build-output grep in CI |
| T10 | Unsigned Cloudinary upload used to host arbitrary files | Uploads are **signed**; the server decides which params are signable | Signed-upload test |
| T11 | A suspended user places an order | Guard checks `users.status !== "suspended"` | P0 test |
| T12 | IDOR through a guessed `_id` | Convex `_id`s are not sequential/guessable, **and** ownership is checked regardless | P0 test |
| T13 | Admin UI hidden button bypassed by direct API call | Every admin function calls `requireAdmin()`; the UI check is cosmetic | P0 test |
| T14 | Coupon abuse via racing checkout | Redemption counts re-read inside the checkout transaction | Concurrency test |
| T15 | Secrets in git history | `.gitignore` + CI secret scan | CI |
| T16 | Cost/DoS via unbounded queries | No `.collect()` on unbounded sets; pagination caps rows read | Code review + lint rule |
| T17 | Stale cart coupon grants an invalid discount | Coupon conditions re-evaluated from scratch at checkout | P0 pricing test |

---

## 3. Authentication

### 3.1 Clerk as identity provider

```
mobile app / admin dashboard
        │  Clerk session token (JWT)
        │  iss = https://<instance>.clerk.accounts.dev
        │  aud = "convex"
        ▼
Convex ── convex/auth.config.ts ──► verifies signature via Clerk JWKS
        │
        ▼
  ctx.auth.getUserIdentity()  →  { subject, tokenIdentifier, email, ... }
```

`convex/auth.config.ts`:

```ts
import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
```

- `CLERK_JWT_ISSUER_DOMAIN` is set on the **Convex dashboard**, not in the repo.
  *(Naming note: Convex's own guide calls this `CLERK_JWT_ISSUER_DOMAIN`; Clerk's integration
  guide calls the same value `CLERK_FRONTEND_API_URL`. They hold the same Frontend API URL. We use
  Convex's name because it is set in the Convex dashboard.)*
- Dev and production use **different Clerk instances** with different issuer domains, so a token
  minted in dev cannot authenticate against production.
- Convex caches JWKS automatically and refreshes on unknown `kid`. Signature, `exp`, and `aud`
  are all validated by Convex, not by our code.
- The Clerk Dashboard's **Convex integration must be activated**, which provisions the `aud:
  "convex"` claim mapping. Without it, every request is rejected as unauthenticated.
- For the mobile app, Clerk's **Native API must be enabled** in the Dashboard, and
  `publishableKey` must be passed **explicitly** to `<ClerkProvider>` — env vars inside
  `node_modules` are not inlined during production React Native builds.
- `ConvexProviderWithClerk` calls `getToken({ template: "convex" })`. An open bug
  ([convex-js#156](https://github.com/get-convex/convex-js/issues/156)) reports that on Expo, a
  sign-out → sign-in cycle can leave Convex unauthenticated despite a valid session. Phase D must
  include a regression test for re-authentication.

### 3.2 Client wiring

| App | Provider |
|---|---|
| Mobile | `ClerkProvider` (from `@clerk/expo`) → `ConvexProviderWithClerk` (from `convex/react-clerk`) |
| Admin | `ClerkProvider` (from `@clerk/nextjs`) → `ConvexProviderWithClerk` |

`convex` exports `convex/react-clerk`. There is no separate `convex-react` package — a common
mistake that produces a module-not-found error at startup.

### 3.3 What is NOT trusted from the token

Even though the JWT is cryptographically verified, these are **never** read from it for
authorization decisions:

- `role` — read from the `users` table, so a role change takes effect immediately rather than
  waiting for token refresh.
- Any price, discount, or total.
- Any ownership claim (`userId`, `cartId`, `orderId`).

**Reason:** session tokens are cached by the SDK (default 60s lifetime). A role revoked by an admin
would otherwise remain effective for up to a minute. Server-side role lookup costs one indexed read
and closes that window entirely.

---

## 4. Authorization

### 4.1 Roles

| Role | Capabilities |
|---|---|
| `customer` | Browse, cart, wishlist, own addresses, own orders, checkout |
| `admin` | All customer capabilities, plus product/inventory/coupon/user/order management |

There is no client-side role. `users.role` is assigned by:
1. The Clerk webhook handler, when the user's Clerk ID appears in the `ADMIN_USER_IDS` server-side
   allowlist (bootstrapping the first admin), or
2. An `admin`-guarded mutation (promotion/demotion, always audited).

### 4.2 Guard primitives (planned, `packages/convex/lib/auth.ts`)

```ts
requireUser(ctx)        → User   // throws if unauthenticated or suspended
requireAdmin(ctx)       → User   // throws if not admin
requireOwned(ctx, doc)  → void   // throws unless doc.userId === user._id
```

Every public function's **first statement** is one of these. A lint rule (custom ESLint rule or a
`convex-test` test that imports every public function) enforces it.

### 4.3 Authorization matrix

| Function | Anonymous | Customer | Admin | Notes |
|---|---|---|---|---|
| `catalog.listProducts` | ✅ read | ✅ | ✅ | Only `status: "active"` |
| `catalog.getProduct` | ✅ read | ✅ | ✅ | Same filter |
| `catalog.search` | ✅ read | ✅ | ✅ | |
| `cart.get` | ❌ | ✅ own | ✅ own | Resolved by `by_user` index |
| `cart.addItem` | ❌ | ✅ own | ✅ own | `cartId` derived from user |
| `cart.updateItem` | ❌ | ✅ own | ✅ own | `requireOwned` |
| `cart.clear` | ❌ | ✅ own | ✅ own | |
| `wishlist.*` | ❌ | ✅ own | ✅ own | |
| `addresses.*` | ❌ | ✅ own | ✅ own | |
| `orders.placeOrder` | ❌ | ✅ own | ✅ own | Transaction; see §5 |
| `orders.listMine` | ❌ | ✅ own | ✅ own | Paged |
| `orders.getById` | ❌ | ✅ own | ✅ any | `requireOwned` unless admin |
| `orders.updateStatus` | ❌ | ❌ | ✅ | Audited |
| `orders.refund` | ❌ | ❌ | ✅ | Audited; amount capped |
| `admin.products.*` | ❌ | ❌ | ✅ | |
| `admin.inventory.*` | ❌ | ❌ | ✅ | Writes a movement row |
| `admin.coupons.*` | ❌ | ❌ | ✅ | |
| `admin.users.setRole` | ❌ | ❌ | ✅ | Cannot demote self; audited |
| `media.createUploadSignature` | ❌ | ✅ | ✅ | Admin gets product-scoped signature |
| `media.deleteAsset` | ❌ | ❌ | ✅ | |
| `webhooks.clerk` | — | — | — | Svix signature verified |
| `webhooks.payments` | — | — | — | Provider signature verified |

**Rule:** the admin dashboard's route guards are a UX convenience only. The matrix above is
enforced in Convex.

---

## 5. Order Integrity

Five independent layers protect the checkout path:

| Layer | Mechanism | Prevents |
|---|---|---|
| 1. Auth guard | `requireUser` | Anonymous checkout |
| 2. Suspension check | `users.status` | Suspended-user checkout |
| 3. Price recomputation | `unitPrice` read from `productVariants` | Client-supplied price |
| 4. Serializable transaction | Entire Convex mutation is one OCC transaction | Oversell, partial writes, lost update |
| 5. Idempotency key | Unique `orders.by_idempotencyKey` | Duplicate orders on retry |

### 5.1 Why the transaction alone is not enough

Convex's serializable OCC guarantees no two *committed* transactions interleave incorrectly, but it
does not make a logically-wrong mutation correct. Two specific traps:

**Trap 1 — splitting a check from its write.** If checkout read `available` in one function and
decremented it in another, a race would be possible. Therefore the read, the check, the decrement,
and the movement insert are all **in one function body**.

**Trap 2 — assuming an index is a constraint.** Convex does **not** enforce uniqueness on indexed
values. `by_sku` makes lookup fast; it does not prevent two rows sharing a SKU. Uniqueness comes
only from reading the index range and writing to it **in the same transaction** — see
`DATA_MODEL.md` §1.2. A mutation that inserts without that prior indexed read has **no** uniqueness
guarantee at all.

**Trap 3 — non-determinism inside a mutation.** Mutations must be deterministic: no `Date.now()`,
no `Math.random()`, no network I/O. `placeOrder` takes `now` as an argument. A non-deterministic
value would differ between the original attempt and an OCC retry, silently corrupting the result.

### 5.2 Order status transitions

```
pending_payment ──► confirmed ──► preparing ──► out_for_delivery ──► delivered
       │                │              │               │
       └────────────────┴──────────────┴───────────────┴──► cancelled
```

- Transitions are validated against an explicit adjacency map in server code.
- A client can only request `confirmed` → `cancelled` (their own order, if not yet preparing).
  Everything else requires `requireAdmin()`.
- Every transition writes an `auditLogs` row and appends to `inventoryMovements` when stock is
  restored — exactly once, guarded by an existing-movement check.

---

## 6. Environment Variables & Secrets

### 6.1 Classification

| Variable | Where | Classification | Notes |
|---|---|---|---|
| `CONVEX_DEPLOYMENT` | repo `.env.local` | Public | Deployment name only |
| `EXPO_PUBLIC_CONVEX_URL` | Expo `.env` | Public | Prefixed ⇒ in client bundle |
| `NEXT_PUBLIC_CONVEX_URL` | Next `.env` | Public | Prefixed ⇒ in client bundle |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Expo `.env` | Public | Publishable by design |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Next `.env` | Public | |
| `CLERK_JWT_ISSUER_DOMAIN` | **Convex dashboard** | Config | Not a secret, but not committed |
| `CLERK_SECRET_KEY` | **Convex dashboard** + Next server | **Secret** | Admin user management only |
| `CLERK_WEBHOOK_SIGNING_SECRET` | **Convex dashboard** | **Secret** | Verifies Clerk webhooks |
| `CLOUDINARY_CLOUD_NAME` | Convex dashboard | Semi-public | Identifier |
| `CLOUDINARY_API_KEY` | **Convex dashboard** | Semi-public | Safe to expose; secret is not |
| `CLOUDINARY_API_SECRET` | **Convex dashboard** | **Secret** | Never leaves Convex |
| `CLOUDINARY_UPLOAD_FOLDER` | Convex dashboard | Config | `grocery/` prefix |
| `STRIPE_SECRET_KEY` | **Convex dashboard** | **Secret** | Phase F, deferred |
| `STRIPE_WEBHOOK_SECRET` | **Convex dashboard** | **Secret** | Phase F, deferred |
| `ADMIN_USER_IDS` | **Convex dashboard** | Config | Comma-separated Clerk IDs allowed to self-promote |
| `SUPPORTED_CURRENCIES` | **Convex dashboard** | Config | Currency allowlist for `DATA_MODEL.md` §1.4. Default unresolved — D1 |
| `DEFAULT_CURRENCY` | **Convex dashboard** | Config | Display currency. Default unresolved — D1 |
| `TAX_INCLUSIVE` | **Convex dashboard** | Config | Whether VAT is included in displayed price. Unresolved — D2 |
| `RESERVATION_TTL_MS` | **Convex dashboard** | Config | Reservation expiry window. Unresolved — D3 |

> **Currency and tax are deliberately config, not constants.** Both are unresolved business
> decisions (D1, D2). Encoding either as a literal would force a two-phase schema migration the
> moment the answer arrives.

### 6.2 Rules

1. `.env.example` is committed and lists **every** key with a placeholder value and a comment
   describing where it belongs.
2. `.gitignore` ignores `.env`, `.env.local`, `.env.*.local` and re-includes `.env.example`.
3. Anything named `*_SECRET`, `*_KEY` (non-publishable), or `*_TOKEN` lives **only** in the Convex
   dashboard or the Next server runtime. Never in a mobile `.env`.
4. `NEXT_PUBLIC_*` and `EXPO_PUBLIC_*` are prefixes that **force** inclusion in a client bundle.
   If a value is sensitive, it must never be given one of these names. This is enforced by review.
5. CI runs a secret scan (e.g. `gitleaks`) on every push and fails the build on a hit.
6. CI runs a build-output grep asserting `CLOUDINARY_API_SECRET` and `CLERK_SECRET_KEY` do not
   appear in the built mobile JS bundle. A hit fails the build.

---

## 7. Image Upload Security

Uploads go **directly from client to Cloudinary** so large images never transit the backend.

```
Admin (authenticated)
  │ POST /media/createUploadSignature  (Convex mutation, requireAdmin)
  │   ├─ verify role, verify target product is writable
  │   ├─ build params: timestamp, folder, allowed_formats, eager, tags
  │   ├─ sign with api_secret  →  SHA hex digest
  │   └─ return ONLY { signature, timestamp, api_key, cloud_name, folder, allowed_formats }
  ▼
{ signature, timestamp, api_key, cloud_name, folder, allowed_formats }
  │
  │ POST https://api.cloudinary.com/v1_1/<cloud_name>/image/upload
  │ (client sends back exactly the signed values, byte-identical)
  ▼
Cloudinary → { public_id, secure_url, width, height, ... }
  │
  │ confirmUpload (Convex mutation, requireAdmin)  — server re-reads the asset via Admin API
  ▼
productImages row inserted
```

**Controls**

| Control | Why |
|---|---|
| Signature expires after 1 hour (Cloudinary-enforced, timestamp-based) | Limits replay |
| `folder` is **server-chosen** and signed | Client cannot write outside the intended folder |
| `allowed_formats` is signed | Blocks upload of HTML/SVG-with-script and other non-image payloads |
| **Every client-sent param must be in the signed set** | Cloudinary rejects any unsigned or altered param with `Invalid Signature`. This is the load-bearing control. |
| Server-side size limit via Cloudinary account Usage Limits | Cloudinary rejects oversized uploads; the *server* enforces the ceiling, not the client |
| Client-side `maxFileSize` check in the admin UI | Fast feedback only — never treated as a security control |
| Only the `public_id` is persisted | Client cannot inject an arbitrary URL as an image source |
| `confirmUpload` re-reads the asset server-side | Prevents a client from claiming an arbitrary `public_id`/dimensions |
| All image reads are public CDN GETs | No PII, no auth needed, fully cacheable |
| Deletion is `requireAdmin` + audited | Prevents abuse of the delete endpoint |

**Two corrections made during Phase A review** (both were wrong in the first draft):

1. `constraining_format` is **not** a signed-upload parameter. The correct control is
   `allowed_formats`, which *is* part of the signed parameter set.
2. There is **no** signed parameter that caps upload size. Cloudinary enforces file size through
   the account's Usage Limits setting. Client-side size checks are UX, not security.

**Signature generation rules** (from Cloudinary's documented algorithm — must be implemented exactly):

1. Choose the Unix timestamp in seconds that will be sent in the upload.
2. Build the string to sign: every parameter that will be sent, **except** `file`, `cloud_name`,
   `resource_type`, and `api_key`, as `name=value` pairs joined with `&`, **sorted alphabetically
   by parameter name**.
3. Append `api_secret` with no separator.
4. Hash (SHA-1 or SHA-256; SHA-256 preferred) → hex digest is the `signature`.

The client must then send the file, `api_key`, `signature`, and **exactly** the same parameter
names and values that were hashed. Any mismatch produces `Invalid Signature`.

**Rejected alternative:** an unsigned upload preset. Cloudinary's own guidance is explicit — an
exposed unsigned preset "can be used with a different account to have resources uploaded to the
original account without approval". Anyone holding the app bundle could upload arbitrary files.
The signed flow is used instead.


---

## 8. Payment Security

Payments are **deferred to Phase F**, but the boundary is designed now so it cannot be bolted on
incorrectly.

| Rule | Detail |
|---|---|
| Amount comes from the order | The amount sent to the provider is `orders.totalMinor`, computed server-side. |
| Client never confirms payment | `POST /webhooks/payments` with a verified provider signature is the **only** path to `paymentStatus: "paid"`. |
| Signature verification | Provider's signing scheme, HMAC over the **raw** request body, constant-time comparison, checked before parsing. |
| Raw body required | Verifying a re-serialized body is a classic bypass. The handler reads `request.text()` first. |
| Idempotent handler | `by_providerRef` uniqueness means a redelivered webhook is a no-op. |
| Replay window | Timestamps older than the provider's tolerance are rejected. |
| No card data touches our servers | Card entry happens in the provider's hosted field/SDK. We never see a PAN. |

Cash-on-delivery orders are created with `paymentStatus: "unpaid"` and are only marked paid by an
admin action on delivery.

---

## 9. Input Validation

| Boundary | Mechanism |
|---|---|
| Client → Convex | Convex `v.*` validators on every argument (required and enforced) |
| Complex payloads | Zod schemas from `packages/shared`, applied inside the handler |
| Webhook bodies | Signature verified, then parsed with Zod; unknown fields rejected |
| Admin forms | React Hook Form + Zod resolver for immediate feedback — **and** the server re-validates |
| Environment config | A Zod schema validates `process.env` at Convex startup; the app fails fast on a missing key |

Client-side validation is a UX affordance only. Every rule is re-applied server-side.

---

## 10. Rate Limiting & Abuse Prevention

Using the official `@convex-dev/rate-limiter` component (**v0.4.1**, peer `convex: ^1.43.0`), applied to:

| Operation | Limit |
|---|---|
| `cart.addItem` | 30 / minute / user |
| `orders.placeOrder` | 5 / minute / user |
| `catalog.search` | 60 / minute / IP-ish key |
| `media.createUploadSignature` | 20 / hour / user |
| Clerk webhook | 120 / minute (provider key) |

Rate limits return `retryAfter`, which the client surfaces to the user rather than silently failing.

---

## 11. Observability & Error Handling

| Concern | Approach |
|---|---|
| Sensitive data in logs | No tokens, secrets, full card data, or full addresses are ever logged. Addresses log `userId` + city only. |
| Client-facing errors | `ConvexError` with a stable machine code and a human message. Stack traces never reach the client. |
| Unknown errors | Logged server-side with a correlation id; the client sees a generic message + the id. |
| Failed payments / webhooks | Recorded in `payments.failureReason`; surfaced in the admin dashboard. |
| Audit trail | Every privileged mutation writes `auditLogs` in the same transaction. |
| Crash reporting | Expo: `expo-updates` channel separation + optional Sentry. Web: Next.js error boundaries + optional Sentry. |

---

## 12. Dependency & Supply Chain

| Control | Tooling |
|---|---|
| Version pinning | Exact versions in `package.json`; a committed `package-lock.json` |
| Vulnerability audit | `npm audit --audit-level=high` in CI, non-zero exit fails the build |
| Automated updates | Dependabot or Renovate, PR-only, never auto-merge to `main` |
| Licence audit | `license-checker` in CI; flags GPL/AGPL conflicts |
| Secret scan | `gitleaks` on every push |

---

## 13. Production Readiness Checklist (Security)

- [ ] Every public function begins with `requireUser` / `requireAdmin` — enforced by a test that enumerates the public API surface.
- [ ] Authorization matrix test suite passes (every row of §4.3, both positive and negative).
- [ ] Checkout ignores all client-supplied monetary values — proven by a test that sends `priceMinor: 0`.
- [ ] **20 concurrent `placeOrder` calls for 10 units ⇒ exactly 10 succeed, `available === 0`, never negative.**
- [ ] **10 concurrent checkouts with the same idempotency key ⇒ exactly 1 order, 1 reservation, 9 replays.**
- [ ] **10 concurrent checkouts against a coupon with `usageLimit: 3` ⇒ exactly 3 redemptions.**
- [ ] **Concurrent duplicate SKU / slug / coupon-code writes ⇒ exactly one row survives.**
- [ ] **Cancellation racing the expiry sweep ⇒ reservation released exactly once.**
- [ ] **Duplicate webhook delivered 5× ⇒ exactly one state change.**
- [ ] Out-of-order webhook (`refunded` before `captured`) does not regress state.
- [ ] Payment webhook with an amount mismatch does not mark the order paid.
- [ ] Refunds cannot exceed the captured amount; a refund creates no inventory movement.
- [ ] Price changed between cart-load and checkout ⇒ the customer is charged the new price.
- [ ] Archived product in cart ⇒ checkout aborts with a per-line reason, not an opaque failure.
- [ ] Forged Clerk webhook is rejected.
- [ ] Forged payment webhook is rejected.
- [ ] Build-output grep confirms no secret in the mobile bundle.
- [ ] `.env.example` is complete and contains no real values.
- [ ] `gitleaks` passes on full history.
- [ ] `npm audit --audit-level=high` is clean.
- [ ] Rate limits are active on checkout, search, and upload signing.
- [ ] Suspended users are blocked from all write paths.
- [ ] Audit log rows exist for every admin mutation.
- [ ] Rate limiting and auth guards reviewed by a second engineer.

> **Note on the concurrency tests.** These are written *before* the implementation they cover.
> `Promise.allSettled` (not `Promise.all`) is required — the latter rejects on the first failure and
> would hide exactly the races these tests exist to detect. Full test definitions are in
> [`IMPLEMENTATION_PLAN.md` §7](./IMPLEMENTATION_PLAN.md).
