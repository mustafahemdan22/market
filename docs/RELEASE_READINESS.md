# Panda Market — Setup, Run & Release Readiness

Commands are **Windows CMD** unless marked otherwise. Run from `D:\market`.

---

## 1. Environment variables

No real values here. Full contract: `.env.example` (placeholders only).

### `apps/mobile/.env.local` — public client values

| Variable                            | Source                                            |
| ----------------------------------- | ------------------------------------------------- |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys → Publishable key      |
| `EXPO_PUBLIC_CONVEX_URL`            | Convex Dashboard → Settings → URL & Deploy Key    |
| `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary Console → settings (public identifier) |

### `apps/admin/.env.local` — public client values

| Variable                            | Source                     |
| ----------------------------------- | -------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Same Clerk publishable key |
| `NEXT_PUBLIC_CONVEX_URL`            | Same Convex deployment URL |

### Convex runtime (Dashboard → Environment Variables) — **server only**

| Variable                                                | Classification                                           |
| ------------------------------------------------------- | -------------------------------------------------------- |
| `CLERK_FRONTEND_API_URL` _or_ `CLERK_JWT_ISSUER_DOMAIN` | config — `auth.config.ts` accepts either                 |
| `PANDAMA_ADMIN_SUBJECTS`                                | **the admin allowlist** — comma-separated Clerk user IDs |
| `CLERK_SECRET_KEY`                                      | secret                                                   |
| `CLERK_WEBHOOK_SIGNING_SECRET`                          | secret                                                   |
| `CLOUDINARY_CLOUD_NAME`                                 | semi-public identifier                                   |
| `CLOUDINARY_API_KEY`                                    | semi-public                                              |
| `CLOUDINARY_API_SECRET`                                 | **secret — never leaves Convex**                         |

**Never** place any of these behind an `EXPO_PUBLIC_*` / `NEXT_PUBLIC_*` prefix.

---

## 2. Install

```cmd
cd /d D:\market
npm install
```

## 3. Verify

```cmd
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build --workspace @grocery/admin
```

Expected: typecheck/lint/format clean; **135 tests** (71 Convex, 51 shared,
13 mobile); `next build` succeeds.

## 4. Run

```cmd
npm run mobile
```

```cmd
npm run dev --workspace @grocery/admin
```

```cmd
npx convex dev
```

---

## 5. Integration status

| Integration                              | Status      | Evidence                                                           |
| ---------------------------------------- | ----------- | ------------------------------------------------------------------ |
| Convex schema + functions                | **PASS**    | 71 `convex-test` tests; deployment responds to `npx convex data`   |
| Public catalogue                         | **PASS**    | anonymous reads, archived products hidden, no admin fields leaked  |
| Cart                                     | **PASS**    | ownership, duplicate-merge, no inventory movement on add           |
| Checkout / orders                        | **PASS**    | idempotency, server-side totals, reservation, cancel-releases-once |
| Inventory ledger                         | **PASS**    | level + movement written in one transaction; never below reserved  |
| Mobile → Convex                          | **PASS**    | `expo export` bundles; screens read via `catalogService`           |
| Admin → Convex                           | **PASS**    | `next build` succeeds; product CRUD wired                          |
| Admin authorization                      | **PARTIAL** | server guards pass tests; **no live authenticated round-trip yet** |
| Clerk authentication                     | **BLOCKED** | no verified Clerk session has been exercised end-to-end            |
| Cloudinary upload                        | **BLOCKED** | signing action is unit-tested only; no live upload performed       |
| Customer checkout screen                 | **FAIL**    | no UI; backend ready, screen not built                             |
| Admin product edit / category / image UI | **FAIL**    | not built                                                          |
| Wishlist, addresses, coupons             | **FAIL**    | not implemented                                                    |

## 6. Production blockers

1. **Clerk** — needs a verified session to prove `ConvexProviderWithClerk`
   actually propagates identity. See `docs/LIVE_VERIFICATION.md` §7–8.
2. **Cloudinary** — `attachProductImage` validates metadata _shape_ but does not
   re-read the asset via the Admin API, so an admin could record inaccurate
   dimensions. Close this with a verifying action, or accept it knowingly.
3. **Compromised Cloudinary secret** — treat as burned. Rotate in the Cloudinary
   console, then set the new value in the Convex deployment
   (`npx convex env set CLOUDINARY_API_SECRET <new>`). It must never be printed
   or committed. The old value was exposed during development.
4. **Payment** — `paymentMethod: "card"` is accepted but **no payment provider
   is integrated**. COD works; card orders would sit at `pending_payment`
   forever. Do not enable card checkout until a verified webhook path exists.
5. **`npm audit`** — 30 advisories (19 high) remain, pinned against Expo SDK 57
   by decision. See `SECURITY.md` §13; the gate does not currently pass.
6. **Order lifecycle** — only `placeOrder` and `cancelOrder` exist. Status
   transitions (`confirmed` → `preparing` → `out_for_delivery` → `delivered`)
   and the `commit` stock movement are **not implemented**, so reserved stock is
   never converted to `onHand - reserved` at dispatch.
7. **No refunds, coupons, or address book.**

## 7. Development vs production

Keep them fully separate. Production must use a **separate Clerk instance** so a
dev session token cannot authenticate against production — Convex verifies the
issuer, so a mixed issuer means every production request is rejected (or, worse,
a dev identity is honoured).

Do **not** run `npx convex deploy` without explicit authorization.

---

## 8. Security notes

- Admin authorization is `PANDAMA_ADMIN_SUBJECTS` checked against the
  **Clerk-verified subject**. No email comparison, no client role, no
  user-supplied admin id exists in the codebase.
- Money is server-authoritative. `placeOrder` recomputes every price from
  `productVariants`; a client-supplied total is never read.
- The shipped mobile bundle was scanned: it contains a Clerk **publishable** key
  (public by design, inlined from a git-ignored file) and **no secret-shaped
  value**. No `node:crypto` reaches the React Native bundle — the generated
  `api.js` is a runtime proxy that never imports the `"use node"` signer.
- `.env.example` must hold placeholders only. Two live Clerk keys were
  previously committed there; that must not recur.
