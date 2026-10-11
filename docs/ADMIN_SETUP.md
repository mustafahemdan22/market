# Admin Dashboard — Setup

Manual configuration required before the dashboard can authenticate or load data.
**Nothing in this document has been performed.** No Clerk, Convex or Cloudinary
resource was created or modified.

---

## 0. `.env.example` must contain placeholders ONLY

> **`.env.example` is a committed, tracked template. It must never contain a
> real key, a real secret, or a real deployment URL — not even a test-mode one,
> and not even one that looks harmless.**
>
> This file is a **contract**, not a configuration. It documents _which_
> variables exist and _where_ each value is set. Real values belong in:
>
> - `apps/admin/.env.local` (public client values) — git-ignored
> - `apps/mobile/.env` (public client values) — git-ignored
> - the **Convex Dashboard** Environment Variables page (server secrets)
>
> `.gitignore` already excludes `.env`, `.env.local` and `.env.*.local` at any
> depth, and re-includes `.env.example`. That protection only holds while
> `.env.example` genuinely contains placeholders.

An earlier revision of this repository had two live Clerk keys committed at
`.env.example` lines 15 and 31 (a publishable key and a **secret key**). They
were removed during the security audit. Do not reintroduce that class of leak.

**Verification after any edit to `.env.example`:**

```bash
# Must print PLACEHOLDER for every hit, never REAL-LOOKING
Select-String -Path .env.example -Pattern 'sk_(live|test)_[A-Za-z0-9_\-]{16,}|pk_(live|test)_[A-Za-z0-9_\-]{16,}|whsec_[A-Za-z0-9]{16,}|https://[a-z0-9-]+\.convex\.cloud'
```

The only values permitted to look "real" are non-secret configuration:
`CLOUDINARY_UPLOAD_FOLDER` (a folder prefix) and `DEFAULT_CURRENCY` (an ISO
currency code).

---

## 1. What the code already enforces

Admin authorization is **server-side and cannot be bypassed from the browser**.

| Control                                                          | Where                                                      |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Clerk JWT signature verified by Convex                           | `packages/convex/convex/auth.config.ts`                    |
| Caller identity read from the verified token only                | `packages/convex/convex/lib/auth.ts` → `getUserIdentity()` |
| Admin allowlist from server env `PANDAMA_ADMIN_SUBJECTS`         | `packages/convex/convex/lib/auth.ts` → `requireAdmin()`    |
| Fails closed when the allowlist is unset/empty                   | `isAdminSubject()` returns `false` when the set is empty   |
| Every admin mutation/query starts with `await requireAdmin(ctx)` | `packages/convex/convex/admin/*.ts`                        |
| Email is never used as an authorization rule                     | No email comparison exists anywhere in the code            |

The dashboard UI contains no role check. Hiding a button grants nothing; the
Convex function rejects the call regardless of what the page renders.

---

## 2. Find the Clerk User ID for the owner

The owner email is `mustafa.hemdan22@gmail.com`. It is used **only** to look up
an ID — it is never embedded in code as an authorization rule.

1. Sign in to the Clerk Dashboard: https://dashboard.clerk.com
2. Select your application (development instance).
3. Go to **Users**.
4. Click the user whose email is `mustafa.hemdan22@gmail.com`.
   If the user does not exist yet, create them first
   (**Users → Invite user**), then complete email verification.
5. The URL bar shows the user id, for example
   `https://dashboard.clerk.com/accounts/<INSTANCE_ID>/users/<USER_ID>`.
6. Copy the **final path segment** after `/users/`. It starts with `user_`.

If you prefer the API, from the Clerk Dashboard **API Keys** page, generate a
secret key and run:

```bash
curl -s "https://api.clerk.com/v1/users?email_address=mustafa.hemdan22@gmail.com" \
  -H "Authorization: Bearer <CLERK_SECRET_KEY>"
```

Copy `id` from the first array element. **Do not commit the secret key.**

---

## 3. Enable the Clerk Native API (mobile only)

1. Clerk Dashboard → **Configure → Native applications**
2. Enable the **Native API**.

Required by `@clerk/expo` on the mobile client. Not required for the admin app.

---

## 4. Configure the Convex JWT template

Convex verifies Clerk tokens against Clerk's JWKS, which requires the `convex`
audience to exist.

1. Clerk Dashboard → **Configure → JWT Templates**
2. If a **convex** template already exists, open it and note the issuer.
3. If not, click **New JWT Template**, name it `convex`, and use Clerk's
   Convex integration, or set:
   - **Claims**: `{"aud": "convex"}`
   - **Lifetime**: 60 seconds
4. Copy the **issuer** shown on that page. It looks like
   `https://<instance>.clerk.accounts.dev`.

> This is the value for `CLERK_FRONTEND_API_URL` (Convex's own guide calls the
> same URL `CLERK_JWT_ISSUER_DOMAIN`). Both names are read by `auth.config.ts`.

---

## 5. Add the admin allowlist to Convex

Two options. Both set a **server-only** value; neither writes a credential into
the repository.

### Option A — local development

```bash
# from the repository root, once a Convex deployment is linked
npx convex env set PANDAMA_ADMIN_SUBJECTS user_abc123,user_xyz789
```

### Option B — Convex Dashboard

1. Open the Convex Dashboard for your deployment.
2. **Settings → Environment Variables**.
3. Add:

   | Name                       | Value                                   |
   | -------------------------- | --------------------------------------- |
   | `CLERK_FRONTEND_API_URL`   | `https://<instance>.clerk.accounts.dev` |
   | `PANDAMA_ADMIN_SUBJECTS`   | `user_abc123,user_xyz789`               |
   | `CLOUDINARY_CLOUD_NAME`    | your Cloudinary cloud name              |
   | `CLOUDINARY_API_KEY`       | your Cloudinary API key                 |
   | `CLOUDINARY_API_SECRET`    | your Cloudinary API secret              |
   | `CLOUDINARY_UPLOAD_FOLDER` | `grocery/products`                      |

Multiple admins are comma-separated with no spaces. The list is compared against
the **verified Clerk subject**, so the values must be user ids (`user_...`),
not emails.

---

## 6. Link a Convex deployment

Not yet done — this creates an external resource, so it is deliberately
outstanding.

```bash
npx convex dev          # interactive: choose or create a deployment
```

Once linked, regenerate the API reference so the hand-maintained stub is
replaced by real codegen output:

```bash
cd packages/convex && npx convex codegen
```

Then delete the two "hand-maintained stand-in" comments in
`packages/convex/convex/_generated/`.

---

## 7. Cloudinary signed uploads

Implemented as `createUploadSignature` in `packages/convex/convex/media.ts`
(a Convex `"use node"` action).

- Requires an authenticated admin (`requireAdmin`).
- Returns `cloudName`, `apiKey`, `signature` and the signed parameter set.
- **Never returns `CLOUDINARY_API_SECRET`.** The secret is read inside the
  action, hashed with the parameter payload, and discarded.
- No Cloudinary SDK runs inside a query or mutation. Only this action performs
  the signing.
- `CLOUDINARY_UPLOAD_FOLDER` is server-chosen and signed, so a client cannot
  write outside that prefix.
- `allowed_formats` is signed: `jpg, jpeg, png, webp`.
- `max_file_size` is signed at 5 MB. Cloudinary's own account **Usage Limits**
  remain the authoritative ceiling.

**No unsigned upload preset is used.** An exposed unsigned preset lets anyone
with the app bundle upload arbitrary files to your account.

After upload, `attachProductImage` persists validated metadata. Only the
**public id** is stored — never a full delivery URL — so clients derive
transformation URLs and the CDN shape never becomes stale stored data.

---

## 8. Public client variables

Copy `.env.example` to `apps/admin/.env.local` and fill in:

| Variable                            | Where it comes from                            |
| ----------------------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys → Publishable key   |
| `NEXT_PUBLIC_CONVEX_URL`            | Convex Dashboard → Settings → URL & Deploy Key |

Both are public by design. The dashboard renders an explicit "not configured"
screen listing whichever is missing rather than an empty catalogue, so a
misconfiguration is never mistaken for "no data".

---

## 9. Values that must NEVER reach the client

| Value                          | Why                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `CLERK_SECRET_KEY`             | Full Backend API access. Server-only.                                               |
| `CLOUDINARY_API_SECRET`        | Lets anyone sign arbitrary uploads to your account.                                 |
| `CLOUDINARY_API_KEY`           | Semi-public, but kept server-side in this design.                                   |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Forges webhooks if leaked.                                                          |
| `PANDAMA_ADMIN_SUBJECTS`       | The admin allowlist. Leaking it tells an attacker exactly which accounts to target. |

Never give any of these an `EXPO_PUBLIC_*`, `NEXT_PUBLIC_*` or other
client-inlined prefix. There is no client-side signing code path in this
repository, and no admin token is ever accepted from the browser.
