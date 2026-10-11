# Live Verification Plan — NOT YET EXECUTED

Every step below is **pending approval**. Nothing in this document has been run.
No Convex deployment is linked, and no Clerk, Convex or Cloudinary resource has
been created or modified.

Run these in order. Each phase has a gate — stop if the gate fails.

---

## Phase 0 — Pre-flight

```bash
cd D:\market
npm run typecheck && npm run lint && npm test
```

**Gate:** all green before touching anything external.

Confirm the working tree is clean and that no secret has leaked:

```bash
git status --short
Select-String -Path .env.example -Pattern 'sk_(live|test)_[A-Za-z0-9_\-]{16,}|pk_(live|test)_[A-Za-z0-9_\-]{16,}|https://[a-z0-9-]+\.convex\.cloud'
```

**Gate:** every hit reads `placeholder`. `.env.example` must never hold a real
value (see `ADMIN_SETUP.md` §0).

---

## Phase 1 — Link the Convex deployment

⚠ **This creates or links an external resource. Requires explicit approval.**

An existing development deployment was observed during the audit (its name is
in the pre-audit `.env.example`); it is **not** recorded in the current
placeholder file and must be selected deliberately, not auto-created.

### Option A — link the existing deployment (preferred)

```bash
cd D:\market
npx convex dev
```

At the prompt choose **"Use an existing deployment"** and enter the deployment
name, or let the CLI infer it. Do **not** choose "create a new deployment"
unless that is explicitly intended.

### Option B — create a fresh dev deployment

Only if no existing one is suitable. This provisions real infrastructure.

### Record what happened

After a successful link, `packages/convex/` will contain a `.env.local` with
`CONVEX_DEPLOYMENT`. That file is git-ignored. Confirm:

```bash
git status --short   # .env.local must NOT appear
```

**Gate:** deployment linked, `.env.local` ignored by git, no secret staged.

---

## Phase 2 — Regenerate `_generated/`

```bash
cd packages/convex
npx convex codegen
```

### Compare against the hand-written stubs

```bash
cd D:\market
git diff --stat packages/convex/convex/_generated/
git diff packages/convex/convex/_generated/
```

**Expected differences and how to handle each:**

| Difference                                                       | Action                                                                                                                                                                                                     |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codegen emits `server.js` + `server.d.ts` instead of `server.ts` | Keep the generated split **and** delete the hand-written `.ts`. Then re-check ESLint: a `.js`/`.d.ts` pair falls outside the TS program and consumers degrade to `any`. See `_generated/README.md` step 4. |
| `httpAction` / `anyApi` appear                                   | Expected. They were omitted from the stub. Remove the stub.                                                                                                                                                |
| `DataModel` / `QueryCtx` / `MutationCtx` exports                 | Expected. Keep codegen's.                                                                                                                                                                                  |
| Codegen writes to a different path                               | Do not hand-move files; stop and report.                                                                                                                                                                   |

Then remove the hand-written stubs that codegen superseded, delete the
"hand-maintained stand-in" comments, and update `_generated/README.md` to
state the files are now genuinely generated.

**Gate — must all be green after regeneration:**

```bash
cd D:\market
npm run typecheck && npm run lint && npm test && npm run format:check
npm run build --workspace @grocery/admin
```

Expect **98 tests** (47 Convex + 51 shared). A drop means the regenerated
types changed a contract the tests assert.

---

## Phase 3 — Clerk: find the admin User ID

The owner is `mustafa.hemdan22@gmail.com`. This email is used **only** to look
up an ID — it is never an authorization rule.

1. Clerk Dashboard → your **development** instance → **Users**.
2. Find `mustafa.hemdan22@gmail.com`. If absent, **Users → Invite user**.
3. Open the user; the URL ends `/users/<USER_ID>`. Copy that final segment
   (`user_...`).

**Gate:** a `user_...` id is written down. Never write it into a source file.

---

## Phase 4 — Clerk: Convex JWT template

1. Clerk Dashboard → **Configure → JWT Templates**.
2. Confirm a template named `convex` exists with claim `{"aud": "convex"}`.
   Create it if missing (60s lifetime).
3. Copy the **issuer** shown on the page — the Frontend API URL.

**Gate:** issuer recorded, and it is a real value held only in Convex env.

---

## Phase 5 — Set server environment variables

```bash
cd D:\market
npx convex env set CLERK_FRONTEND_API_URL https://<instance>.clerk.accounts.dev
npx convex env set PANDAMA_ADMIN_SUBJECTS <USER_ID_FROM_PHASE_3>
npx convex env set CLOUDINARY_CLOUD_NAME <cloud_name>
npx convex env set CLOUDINARY_API_KEY <api_key>
npx convex env set CLOUDINARY_API_SECRET <api_secret>
npx convex env set CLOUDINARY_UPLOAD_FOLDER grocery/products
```

Multiple admins are comma-separated **user ids**, never emails:

```
PANDAMA_ADMIN_SUBJECTS=user_abc123,user_xyz789
```

Do **not** run these without the values to hand. Nothing echoes a secret value
back into `.env.example`.

**Gate:** `npx convex env list` shows the names set. **Do not paste the output
of that command into a report** — it may display values.

---

## Phase 6 — Configure the admin client

Create `apps/admin/.env.local` (git-ignored):

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
```

```bash
git status --short   # must not list .env.local
```

**Gate:** values present locally, nothing tracked.

---

## Phase 7 — Verify admin sign-in and admin-only mutations

```bash
npm run dev --workspace @grocery/admin
```

Open `http://localhost:3000/products` and sign in as the admin account.

| #    | Check                                   | Expected                                                       |
| ---- | --------------------------------------- | -------------------------------------------------------------- |
| 7.1  | Product list loads                      | Table renders; empty state if no products                      |
| 7.2  | Create a product                        | 201-style success banner; row appears                          |
| 7.3  | New product has a variant + stock level | SKU normalised to uppercase                                    |
| 7.4  | Duplicate SKU                           | **Rejected** — surfaces the server error, not a silent success |
| 7.5  | Price `12.50`                           | Stored as `1250`; list shows EGP 12.50                         |
| 7.6  | Price `12.505`                          | **Rejected** (not silently rounded)                            |
| 7.7  | Stock below `reserved`                  | **Rejected**                                                   |
| 7.8  | Set stock                               | A ledger row appears in `inventoryMovements`                   |
| 7.9  | Change price                            | Product display cache matches the variant price                |
| 7.10 | Archive a product                       | Status flips; an `auditLogs` row is written                    |
| 7.11 | Disable a category with active products | **Rejected**                                                   |
| 7.12 | Reload                                  | Signed-in session persists (Clerk token cache)                 |

**Gate:** every row behaves as specified. Any `FORBIDDEN` on the admin account
means `PANDAMA_ADMIN_SUBJECTS` holds the wrong id — stop and re-check Phase 3/5.

---

## Phase 8 — Confirm non-admins are rejected (the critical negative test)

Create or use a **second** Clerk account that is **not** on the allowlist.
Never add it to `PANDAMA_ADMIN_SUBJECTS`.

Belt **and** braces — test the UI and the API directly:

1. **UI:** sign in as the non-admin. The dashboard must not display privileged
   actions.
2. **API (the real test):** with that same session, call a mutation directly,
   bypassing all UI:

   ```js
   // in the browser console on the admin origin, while signed in as non-admin
   await window.__convex.mutation(api.admin.products.updateProductStatus, {
     productId: "<some product id>",
     status: "archived",
     now: Date.now(),
   });
   ```

   **Expected:** rejects with `FORBIDDEN`. A hidden button proves nothing — this
   call proves the server refuses it.

3. **Anonymous:** call the same mutation with no session. **Expected:**
   `UNAUTHENTICATED`.
4. **Fail-closed:** temporarily run with `PANDAMA_ADMIN_SUBJECTS` unset.

   **Expected:** even the real admin is rejected. Restore it afterwards.

**Gate:** all four reject. The UI hiding the button while the API still allows
the call is a P0 failure — stop immediately.

---

## Phase 9 — Cloudinary signed upload

1. In the admin, create a product.
2. Request an upload signature (this calls the `createUploadSignature` action).
3. Inspect the response. It **must** contain `cloudName`, `apiKey`,
   `signature`, `params`. It must **never** contain `api_secret`.
4. Upload a file directly to `https://api.cloudinary.com/v1_1/<cloud>/image/upload`
   with exactly the returned parameter set, plus `file` and `api_key`.

| #    | Case                                         | Expected                                                                              |
| ---- | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| 9.1  | Valid `jpg`/`png`/`webp`                     | 200, returns a `public_id`                                                            |
| 9.2  | `svg`, `gif`, or `html`                      | **Rejected** (`allowed_formats` is signed)                                            |
| 9.3  | File over 5 MB                               | **Rejected**                                                                          |
| 9.4  | Alter any signed param before sending        | Cloudinary returns `Invalid Signature`                                                |
| 9.5  | Non-admin requests a signature               | **Rejected** by `requireAdmin`                                                        |
| 9.6  | Attach valid metadata                        | Row stored with `publicId`, `format`, `width`, `height`, `bytes`, `uploadedBySubject` |
| 9.7  | Forged metadata (`bytes: 1` for a 4 MB file) | **Accepted by design** — see caveat below                                             |
| 9.8  | `publicId` = `../../etc/passwd`              | **Rejected**                                                                          |
| 9.9  | Duplicate `publicId` on same product         | **Rejected**                                                                          |
| 9.10 | Remove the primary image                     | Another image is promoted                                                             |

> **Caveat on 9.7.** `attachProductImage` validates metadata _shape_ (format on
> the allowlist, plausible dimensions, size under the cap) but does **not** call
> the Cloudinary Admin API to re-read the asset. A determined admin can therefore
> store inaccurate dimensions/bytes for an image they really did upload. Closing
> that gap means an action that fetches asset metadata server-side before the
> mutation. Tracked as a production blocker; not fixed here.

**Gate:** 9.1–9.6, 9.8–9.10 pass; 9.7 is a known, documented limitation.

---

## Phase 10 — Close out

```bash
cd D:\market
npm run typecheck && npm run lint && npm test && npm run format:check
npm run build --workspace @grocery/admin
git status --short
```

Record for the report: which checks passed, which could not run, and any
blocker. Do **not** run `npx convex deploy` — that is production.

---

## Still blocked after this plan

| Blocker                                                                        | Status                                       |
| ------------------------------------------------------------------------------ | -------------------------------------------- |
| `attachProductImage` does not verify metadata against the Cloudinary Admin API | Open                                         |
| No image URL is persisted, so the customer app cannot yet render these images  | By design; needs a transformation-URL helper |
| No product edit screen (only create + status toggle)                           | Open                                         |
| No category CRUD screen (only the Convex functions)                            | Open                                         |
| `SECURITY.md` §13 `npm audit --audit-level=high` gate does not pass            | Deferred by decision                         |
| Mobile Clerk auth still unverified end-to-end                                  | Open                                         |
