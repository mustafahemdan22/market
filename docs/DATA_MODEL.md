# Data Model — Grocery Marketplace

**Status:** Proposed (Phase A / A.2 — schema NOT implemented)
**Last reviewed:** 2026-10-10 (Phase A.2 audit)
**Related:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`SECURITY.md`](./SECURITY.md)

---

## 0. Phase A.2 audit corrections

The first draft of this document contained claims that the official Convex documentation does not
support. They are corrected here. See §1.2 and §1.3 for the underlying platform facts.

| #   | Original claim                                          | Status                       | Correction                                                                              |
| --- | ------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| 1   | "`clerkUserId` is unique"                               | ❌ **False as written**      | Convex indexes do **not** enforce uniqueness. See §1.2 and §3.1.                        |
| 2   | "`sku` unique", "`slug` unique", "`orderNumber`" unique | ❌ **False as written**      | Same. See §1.2.                                                                         |
| 3   | "`orders.idempotencyKey` unique index"                  | ❌ **Misleading**            | The index gives O(log n) _lookup_, not enforcement. See §3.11.                          |
| 4   | "`payments.providerRef` unique when present"            | ❌ **False**                 | See §3.12.                                                                              |
| 5   | `currency: v.literal("USD")`                            | ⚠️ **Reversible-but-costly** | Target market unconfirmed. Replaced with a validated string + central config. See §1.4. |
| 6   | Only "32 indexes per table" documented                  | ⚠️ **Incomplete**            | Full verified limit table added in §1.5.                                                |
| 7   | Inventory described as `onHand`/`reserved` fields only  | ⚠️ **Incomplete**            | Full reservation lifecycle added in §3.6.                                               |
| 8   | "a retried transaction never double-decrements"         | ✅ Correct, but unexplained  | Mechanism documented in §1.3.                                                           |

---

## 1. Platform foundations

### 1.1 Conventions

| Rule                                                               | Rationale                                                                                                        |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Money is always an integer in minor units** (`priceMinor: 349`)  | Floating-point currency arithmetic produces silent rounding errors. Display formatting is a client concern only. |
| Every table has `createdAt` / `updatedAt` (`v.number()`, ms epoch) | Convex provides `_creationTime` but not an update timestamp. Ordering by `updatedAt` is a common admin need.     |
| Every user-owned table has a `by_user` index                       | Without it, listing a user's rows is an unbounded `.collect()`.                                                  |
| No document stores derived totals that can drift                   | `orderItems` are the source of truth; totals are recomputed from them inside the checkout mutation.              |
| Soft delete only where history matters (`products`, `categories`)  | Hard delete would orphan historical `orderItems`.                                                                |
| Snapshots on `orderItems`                                          | A past invoice must not change when a product is renamed or repriced.                                            |

### 1.2 ⚠️ Convex does NOT enforce uniqueness — verified

> **Official documentation says:** _"Each index consists of: 1. A name. **Must be unique per
> table.** 2. An ordered list of fields to index."_
> — [Convex: Indexes](https://docs.convex.dev/database/reading-data/indexes)
> _(docs.convex.dev/production/state/limits, checked 2026-10-10)_

**Only the index NAME must be unique.** There is no `unique: true` modifier, no
`unique(…)` declaration, and no UNIQUE constraint anywhere in the Convex schema API. The word
"unique" in the docs refers to the index name, not to the indexed values.

Corroborating evidence: [convex-ents#51 — "Uniqueness is not enforced when writing concurrently"]
(https://github.com/get-convex/convex-ents/issues/51) is an open upstream issue describing exactly
this gap, raised by a Convex core contributor.

**Consequence:** a "unique index" in this schema is a _lookup accelerator_, not a constraint. Two
concurrent `ctx.db.insert()` calls with the same SKU **will both succeed** unless the surrounding
mutation does something else.

**The pattern that actually works — read-then-write in one mutation**

Because a Convex mutation is a serializable transaction, and OCC tracks the **index range** it
read (not merely the documents returned), this is safe:

```ts
// Inside ONE mutation
const existing = await ctx.db
  .query("productVariants")
  .withIndex("by_sku", (q) => q.eq("sku", normalizedSku))
  .unique();

if (existing !== null) {
  throw new ConvexError({ code: "DUPLICATE_SKU" });
}

await ctx.db.insert("productVariants", { sku: normalizedSku /* ... */ });
```

Why it holds:

1. The `withIndex(...).unique()` call reads the `by_sku` index range for `normalizedSku` and records
   it in the transaction's **read set**.
2. The subsequent `insert` writes a key into that _same_ index range.
3. If a concurrent transaction committed an insert into that range first, the committer detects
   the overlap and **aborts** this transaction with an OCC conflict.
4. Convex **retries** the mutation. On retry, the `unique()` now returns the row the other
   transaction committed, so the duplicate is detected.

**Three rules that must hold, or the pattern silently breaks:**

| Rule                                                                       | Why it matters                                                                                                                               |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| The uniqueness check and the insert must be in the **same mutation body**  | Splitting them across two functions reintroduces the race.                                                                                   |
| The check must query **via an index on the same field**                    | OCC detects conflicts on _index ranges read_. An unindexed `.filter()` scan may not register the range the same way, and is O(n) regardless. |
| Never rely on `.unique()` throwing to mean "already exists" across retries | After an OCC retry the world has changed. Re-derive state on every attempt; never cache a pre-retry read.                                    |

**Anti-pattern to avoid:** a plain `ctx.db.insert()` with no prior indexed read. Two concurrent
inserts with the same value both commit.

### 1.3 OCC, retries, and what a mutation may assume

> **Official documentation:**
> [OCC and Atomicity](https://docs.convex.dev/database/advanced/occ) ·
> [How Convex Works](https://stack.convex.dev/how-convex-works) ·
> [Errors and Warnings](https://docs.convex.dev/error.md)

| Fact                                                                                                | Source                                                        | Design consequence                                                                               |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A Convex mutation **is** the transaction. No `BEGIN`/`COMMIT`.                                      | [Overview](https://docs.convex.dev/understanding/overview)    | All read+write for one business operation lives in one function body.                            |
| Isolation is **serializable** via optimistic concurrency control — not merely snapshot isolation.   | [OCC](https://docs.convex.dev/database/advanced/occ)          | Any interleaving of committed transactions equals some serial order. No write skew.              |
| The **read set records index ranges**, not just returned documents.                                 | [How Convex Works](https://stack.convex.dev/how-convex-works) | Enables the uniqueness pattern in §1.2.                                                          |
| Conflicting mutations are **retried automatically** by the runtime.                                 | [Errors](https://docs.convex.dev/error.md)                    | Handler code may re-execute. It must be idempotent.                                              |
| Retries are **bounded**; a persistently hot document eventually throws a write-conflict error.      | [Errors](https://docs.convex.dev/error.md)                    | Hot counters need sharding or a different design (§3.11).                                        |
| Determinism is required: **no `Date.now()`, no `Math.random()`, no network I/O inside a mutation.** | [Overview](https://docs.convex.dev/understanding/overview)    | Use `ctx.scheduler` or an action. `Date.now()` must be passed in as an argument from the caller. |

**⚠️ Design rule this imposes:** `placeOrder` receives `now` as an argument from the calling
action/query wrapper, not from `Date.now()` inside the mutation. Coupon windows and reservation
expiry both depend on it.

**Hot-document warning.** Convex's own guidance is that the most common OCC failure is many
mutations writing the same document — a global counter, a "last updated" row. Order-number
generation (§3.11) explicitly avoids this.

### 1.4 Currency — configurable, not hardcoded

The original draft hardcoded `v.literal("USD")` in two tables. The target market has **not** been
confirmed, and hardcoding forces a two-phase schema migration to change.

**Decision:** store `currency` as a `v.string()` validated at the write boundary against a central
allowlist in `packages/shared`, and resolve the display currency from config.

| Property         | Value                                                             |
| ---------------- | ----------------------------------------------------------------- |
| Storage          | Integer minor units, `v.number()`, always                         |
| `currency` field | `v.string()` — validated, not `v.literal()`                       |
| Allowlist        | `packages/shared/src/domain/currency.ts` → `SUPPORTED_CURRENCIES` |
| Default          | Set by config; **currently unresolved — see §8 D1**               |
| Known exponent   | EGP = 2 (piastres), USD = 2 (cents), EUR = 2, SAR = 2, AED = 2    |

Egyptian Pound (EGP) and US Dollar (USD) both use **2 minor units**, so adopting EGP changes no
arithmetic — only the `currency` value and locale-aware formatting. That is deliberately why minor
units were chosen.

> **Do not assume tax policy.** Whether VAT is inclusive of the displayed price or added at
> checkout is **unresolved** (§8 D2). It changes both the pricing engine and whether the UI shows a
> separate tax line. The schema supports `taxMinor` either way; the engine is not yet specified.

### 1.5 Verified Convex limits

From [docs.convex.dev/production/state/limits](https://docs.convex.dev/production/state/limits) and
[Full Text Search](https://docs.convex.dev/search/text-search), checked 2026-10-10.

| Limit                                   | Value      | Relevance here                                                 |
| --------------------------------------- | ---------- | -------------------------------------------------------------- |
| Indexes per table                       | **32**     | See §4 budget.                                                 |
| **Fields per index**                    | **16**     | Not previously documented. No index here exceeds 2.            |
| Index name length                       | 64 chars   | Fine.                                                          |
| Documents scanned per function          | **32,000** | Bounds `.collect()`.                                           |
| Data read per function                  | **16 MiB** | Bounds large joins.                                            |
| Documents written per function          | **16,000** | Bounds bulk operations.                                        |
| Data written per function               | **16 MiB** | Bounds bulk operations.                                        |
| Index ranges read per function          | **4,096**  | Bounds the number of `db.get`/`db.query` calls.                |
| Search indexes per table                | **4**      | `products` uses 1.                                             |
| Filter fields per search index          | **16**     | `products` uses 3.                                             |
| **Terms per search query**              | **16**     | Truncate long search input.                                    |
| **Filter expressions per search query** | **8**      | Bounds the filter sheet.                                       |
| Max term length                         | 32 B       | Long terms are silently dropped.                               |
| **Max search result set**               | **1,024**  | `collect()` **throws** past this. Use `.take()`/`.paginate()`. |
| Search index limit / max results        | 4 / 1024   | —                                                              |
| Document size                           | **1 MiB**  | Order snapshots must stay well under.                          |
| Fields per document                     | 1,024      | —                                                              |
| Field nesting depth                     | 16         | Address snapshot uses 1.                                       |

> **⚠️ `paginationOpts.maximumRowsRead` and `maximumBytesRead` are NOT enforced for search queries.**
> Source: [`convex-js/src/server/pagination.ts`](https://github.com/get-convex/convex-js/blob/main/src/server/pagination.ts)
> — _"Currently this is not enforced for search queries."_
> Catalog search must therefore enforce its own page cap in code, not rely on pagination options.

### 1.6 Index field requirements

- A `searchIndex` requires the table to also have a **regular index whose first field is the same
  `searchField`** (e.g. `by_searchText`). This is a schema-construction requirement.
- Index **field order** determines range-query capability — equality filters must come before range
  filters.
- Fields named in `filterFields` must exist on the document.

---

## 2. Entity Relationship Summary

```
users ──1:N──> addresses
  │               (owned; guarded by owner check)
  ├──1:1──> carts ──1:N──> cartItems ──N:1──> productVariants ──N:1──> products ──N:1──> categories
  ├──1:N──> wishlistItems ────────────────N:1──> products
  ├──1:N──> orders ──1:N──> orderItems ──N:1──> productVariants / products
  ├──1:N──> couponRedemptions ──N:1──> coupons
  ├──1:N──> payments ──1:N──> refunds
  └──1:N──> auditLogs (actor)

productVariants ──1:1──> inventoryLevels ──1:N──> inventoryMovements
products ──1:N──> productImages
categories ──1:N──> categories   (self-referencing, parentId, depth ≤ 2)
```

---

## 3. Tables

> Every uniqueness invariant below is implemented with the **read-then-write-inside-one-mutation**
> pattern in §1.2. Each is marked `[U]` so none is missed.

### 3.1 `users`

Local mirror of the Clerk identity. Clerk is authoritative for credentials, sessions, and password
policy; this table holds only what Convex needs to authorize and render.

```ts
users: defineTable({
  clerkUserId: v.string(),          // identity.subject — the stable join key  [U]
  email: v.optional(v.string()),
  role: v.union(v.literal("customer"), v.literal("admin")),
  status: v.union(v.literal("active"), v.literal("suspended")),

  displayName: v.optional(v.string()),
  phone: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  preferredLocale: v.optional(v.string()),   // BCP-47, e.g. "en", "ar-EG"

  lastLoginAt: v.optional(v.number()),
})
  .index("by_clerkUserId", ["clerkUserId"])
  .index("by_email", ["email"])
  .index("by_role", ["role"]),
```

**Invariants**

- `[U]` **One row per Clerk user.** The Clerk webhook handler (HTTP action) resolves the user inside
  a single mutation:
  1. `withIndex("by_clerkUserId").unique()` — records the index range in the read set.
  2. If found → `patch` (convergent on webhook redelivery).
  3. If `null` → `insert`.

  Clerk **retries webhooks** on non-2xx, so a redelivery is expected. Because step 1 and step 3 are
  in one transaction, a redelivery concurrent with the first delivery cannot create a second row —
  the second aborts on OCC and retries, then finds the row created by the first.

  **The `by_clerkUserId` index provides the lookup, not the guarantee.** See §1.2.

- `role` is **never** accepted as a client argument. It is set by the webhook handler from a
  server-side `ADMIN_USER_IDS` allowlist, or by an `requireAdmin()`-guarded mutation.
- A `suspended` user keeps their rows (orders, addresses) but is rejected by every guard.
- A `users` row **must exist** before any other table can reference `userId`. Guards return a
  distinct "account provisioning in progress" error rather than crashing.

### 3.2 `addresses`

```ts
addresses: defineTable({
  userId: v.id("users"),
  label: v.string(),                // "Home", "Work"
  recipientName: v.string(),
  phone: v.string(),
  line1: v.string(),
  line2: v.optional(v.string()),
  city: v.string(),
  region: v.optional(v.string()),   // state / province
  postalCode: v.string(),
  countryCode: v.string(),          // ISO 3166-1 alpha-2
  deliveryNotes: v.optional(v.string()),
  isDefault: v.boolean(),
})
  .index("by_user", ["userId"])
  .index("by_user_default", ["userId", "isDefault"]),
```

**Invariants**

- Read/write/delete require `address.userId === resolvedUser._id`. Checked inside the function,
  never inferred from a client-passed user id.
- **Default address, concurrent-safe.** Setting a default reads _all_ the user's addresses via
  `by_user`, patches every `isDefault: true` row to `false`, then patches the target to `true` —
  all inside one mutation. Because the mutation reads the whole `by_user` index range, two
  concurrent "set default" calls conflict and retry; the last writer wins and exactly one default
  survives. `by_user_default` makes the post-state assertable with a single point read.

### 3.3 `categories`

```ts
categories: defineTable({
  name: v.string(),
  slug: v.string(),                 // [U] normalised, URL-safe
  parentId: v.optional(v.id("categories")),
  depth: v.number(),                // 0 = root, 1 = subcategory
  imagePublicId: v.optional(v.string()),   // Cloudinary public_id, NOT a URL
  sortOrder: v.number(),
  isActive: v.boolean(),
})
  .index("by_slug", ["slug"])
  .index("by_parent_sortOrder", ["parentId", "sortOrder"])
  .index("by_active_depth", ["isActive", "depth"]),
```

**Invariants**

- `[U]` `slug` unique. Same read-then-write pattern (§1.2) on `by_slug`. Collisions from a
  human-friendly slug are resolved by appending `-2`, `-3`, … **inside the same mutation**, re-reading
  until a free slug is found.
- `depth` capped at 2 in validation to keep browse queries index-friendly.
- Deleting a category with children or products is rejected — archive instead (`isActive: false`).

### 3.4 `products`

```ts
products: defineTable({
  categoryId: v.id("categories"),
  name: v.string(),
  slug: v.string(),                 // [U]
  description: v.string(),
  brand: v.optional(v.string()),

  // Denormalised from the cheapest active variant, for list views ONLY.
  // The checkout mutation NEVER reads these — it reads productVariants.
  priceMinor: v.number(),
  compareAtPriceMinor: v.optional(v.number()),   // strike-through "was" price

  unitLabel: v.string(),            // "per 500 g"
  status: v.union(
    v.literal("draft"),
    v.literal("active"),
    v.literal("archived"),
  ),

  searchText: v.string(),           // name + brand + category + keywords, lowercased
  tags: v.optional(v.array(v.string())),

  ratingAvg: v.optional(v.number()),
  ratingCount: v.optional(v.number()),

  createdBy: v.id("users"),
})
  .index("by_slug", ["slug"])
  .index("by_category_status", ["categoryId", "status"])
  .index("by_status_createdAt", ["status", "createdAt"])
  .index("by_searchText", ["searchText"])            // REQUIRED companion to searchIndex
  .searchIndex("search_products", {
    searchField: "searchText",
    filterFields: ["categoryId", "status", "brand"],
  }),
```

**Invariants**

- `[U]` `slug` unique — §1.2 pattern on `by_slug`.
- Only `status: "active"` products appear in public catalog queries.
- `priceMinor` is a **display cache**, recomputed whenever any variant price changes. Checkout never
  reads it.
- `searchText` is rebuilt server-side whenever name/brand/category changes. Never client-supplied.
- **Price change during checkout**: checkout re-reads `productVariants.priceMinor` inside the
  transaction. A concurrent admin price edit either commits before the read (customer pays the new
  price) or conflicts and forces a retry (customer sees the new price). The customer can never be
  charged a stale price the server has already superseded.

### 3.5 `productVariants`

```ts
productVariants: defineTable({
  productId: v.id("products"),
  sku: v.string(),                  // [U] normalised to UPPERCASE
  name: v.string(),                 // "500 g", "1 L"
  priceMinor: v.number(),
  compareAtPriceMinor: v.optional(v.number()),
  weightGrams: v.optional(v.number()),

  isDefault: v.boolean(),
  isActive: v.boolean(),
  sortOrder: v.number(),
})
  .index("by_product", ["productId", "sortOrder"])
  .index("by_sku", ["sku"]),
```

**Invariants**

- `[U]` `sku` unique, uppercased **before** the uniqueness read so case variants collide as intended.
- Exactly one `isDefault: true` per product. Enforced inside the create/update mutation by reading
  the product's variants via `by_product`, patching the incumbent, then patching the new one — one
  transaction, so OCC serialises concurrent edits.
- **Stock is NOT stored here.** See §3.6.

### 3.6 `inventoryLevels`, `inventoryMovements` and the reservation lifecycle

Separating the current level from an append-only ledger makes stock auditable and makes every
transition reversible and auditable.

```ts
inventoryLevels: defineTable({
  variantId: v.id("productVariants"),
  onHand: v.number(),        // physical units in the warehouse
  reserved: v.number(),      // units committed to open orders, not yet shipped
  updatedAt: v.number(),
})
  .index("by_variant", ["variantId"]),

inventoryMovements: defineTable({
  variantId: v.id("productVariants"),
  onHandDelta: v.number(),   // change to onHand
  reservedDelta: v.number(), // change to reserved
  reason: v.union(
    v.literal("reserve"),            // order placed, awaiting payment
    v.literal("commit"),             // payment confirmed → goods leave the shelf
    v.literal("release"),            // payment failed / expired / cancelled → hold lifted
    v.literal("restock"),
    v.literal("adjustment"),
    v.literal("damaged"),
    v.literal("return"),             // goods returned after delivery
  ),
  orderId: v.optional(v.id("orders")),
  actorId: v.optional(v.id("users")),
  note: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_variant_createdAt", ["variantId", "createdAt"])
  .index("by_order", ["orderId"])
  .index("by_order_variant_reason", ["orderId", "variantId", "reason"]),  // [U]
```

#### 3.6.1 Definitions

| Term            | Formula             | Meaning                                                        |
| --------------- | ------------------- | -------------------------------------------------------------- |
| `onHand`        | stored              | Physical units in the warehouse                                |
| `reserved`      | stored              | Units committed to open orders awaiting shipment               |
| **`available`** | `onHand - reserved` | **What a new customer may buy.** Never stored; always derived. |

`available` is the only number the storefront shows and the only number checkout compares against.

#### 3.6.2 Lifecycle — every transition

| #   | Event                      | `onHand` | `reserved` | Movement `reason` | `onHandDelta` / `reservedDelta` | Guard                                  |
| --- | -------------------------- | -------- | ---------- | ----------------- | ------------------------------- | -------------------------------------- |
| 1   | **Checkout (reserve)**     | —        | `+qty`     | `reserve`         | `0` / `+qty`                    | Abort if `available < qty`             |
| 2   | **Payment confirmed**      | —        | —          | —                 | no movement                     | Signature-verified webhook only        |
| 3   | **Fulfilment / dispatch**  | `-qty`   | `-qty`     | `commit`          | `-qty` / `-qty`                 | Only from `confirmed`/`preparing`      |
| 4   | **Payment failed**         | —        | `-qty`     | `release`         | `0` / `-qty`                    | One release per `(orderId, variantId)` |
| 5   | **Reservation expiry**     | —        | `-qty`     | `release`         | `0` / `-qty`                    | Scheduled sweep; same guard as #4      |
| 6   | **Cancel before dispatch** | —        | `-qty`     | `release`         | `0` / `-qty`                    | One release per `(orderId, variantId)` |
| 7   | **Cancel after dispatch**  | `+qty`   | —          | `return`          | `+qty` / `0`                    | Distinct reason; audited               |
| 8   | **Customer return**        | `+qty`   | —          | `return`          | `+qty` / `0`                    | Admin action + audit log               |
| 9   | **Restock**                | `+qty`   | —          | `restock`         | `+qty` / `0`                    | Admin action + audit log               |
| 10  | **Damage / write-off**     | `-qty`   | —          | `damaged`         | `-qty` / `0`                    | Admin action + audit log               |

**Events 4, 5 and 6 are mutually exclusive and each fires at most once.**
`by_order_variant_reason` lets the release path ask _"has a `release` movement already been written
for this (order, variant)?"_ in one indexed read. If a cancellation and an expiry sweep race, the
second one's read hits the first's movement, aborts, retries, then sees it and no-ops. **Stock can
never be released twice.**

#### 3.6.3 Core invariants

- **The oversell defence.** Checkout re-reads `inventoryLevels` inside the transaction and aborts if
  `available < qty`. The whole function is one serializable transaction, so two buyers racing for
  the last unit cannot both succeed — the second conflicts on the `by_variant` index range, retries,
  re-reads the decremented level, and fails the availability check.
- **`inventoryLevels` write and `inventoryMovements` insert always share one mutation.** OCC commits
  both or neither, so the ledger can never drift from the level.
- **Retried mutations never double-apply.** On OCC retry the entire handler re-executes against
  fresh state; it re-reads `inventoryLevels` and re-derives the delta rather than reusing a value
  computed before the conflict.
- `available` is **never stored** and **never accepted from a client**.
- `reserved > 0` with no open order, or `onHand < 0`, is an invariant violation and must raise an
  alert rather than self-heal silently.

#### 3.6.4 Multiple carts (explicitly non-blocking)

Carts hold **no reservation**. `reserved` is written only by `placeOrder`. A customer's unsaved cart
never locks stock. This is a deliberate retail trade-off: it prevents cart-abandonment from
stranding inventory, at the cost of surfacing "out of stock" at checkout rather than at add-to-cart.
It is surfaced honestly in the UI rather than hidden.

### 3.7 `productImages`

```ts
productImages: defineTable({
  productId: v.id("products"),
  cloudinaryPublicId: v.string(),   // "grocery/apples/fuji"
  width: v.number(),
  height: v.number(),
  alt: v.string(),
  sortOrder: v.number(),
  isPrimary: v.boolean(),
})
  .index("by_product_sortOrder", ["productId", "sortOrder"])
  .index("by_product_primary", ["productId", "isPrimary"]),   // [U] exactly one primary
```

**Invariants**

- Only `cloudinaryPublicId` is stored. **No full URLs are persisted** — clients build transformed
  URLs (`f_auto,q_auto,w_800`) so delivery is optimised and no CDN URL becomes a stale dependency.
- Exactly one `isPrimary` per product, enforced by reading the product's images via
  `by_product_sortOrder`, clearing the incumbent, then setting the new one — all in one mutation, so
  OCC serialises concurrent edits. `by_product_primary` makes the post-state assertable in one read.
- **Archived products keep their images.** `orderItems` snapshots `imagePublicId`, so deleting an
  asset cannot rewrite historical invoices.

### 3.8 `carts` and `cartItems`

One active cart per user, created lazily on first add.

```ts
carts: defineTable({
  userId: v.id("users"),            // [U] exactly one active cart per user
  couponCode: v.optional(v.string()),   // applied code; re-validated at checkout
  updatedAt: v.number(),
})
  .index("by_user", ["userId"]),

cartItems: defineTable({
  cartId: v.id("carts"),
  variantId: v.id("productVariants"),
  quantity: v.number(),             // integer 1..MAX_CART_QUANTITY
  addedAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_cart", ["cartId"])
  .index("by_cart_variant", ["cartId", "variantId"]),   // [U] one line per variant
```

**Invariants**

- `[U]` One cart per user: `withIndex("by_user").unique()` then insert — §1.2 pattern. A race
  between "first add to cart" on two devices aborts one insert rather than creating two carts.
- `cartId` is always resolved from the authenticated user. A client-supplied `cartId` is ignored.
- `[U]` `by_cart_variant` backs both "already in cart ⇒ increment" and "add" without a scan.
  The add path reads that index range and patches-or-inserts in one transaction, so double-tapping
  "add to cart" cannot create two lines.
- **No price is stored.** The cart view joins to `productVariants` for display and re-reads
  everything at checkout.
- **Archived/out-of-stock lines are surfaced, not silently dropped.** The cart still renders them
  with a clear state so the customer understands why checkout will fail.

### 3.9 `wishlistItems`

```ts
wishlistItems: defineTable({
  userId: v.id("users"),
  productId: v.id("products"),
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_product", ["userId", "productId"]),   // [U]
```

**Invariants**

- `[U]` Save/remove reads `by_user_product` and patches-or-inserts in one transaction, so a
  double-tap cannot create a duplicate row.

### 3.10 `coupons` and `couponRedemptions`

```ts
coupons: defineTable({
  code: v.string(),                      // [U] normalised to UPPERCASE
  kind: v.union(
    v.literal("percent"),                // value = 0..100
    v.literal("fixed"),                  // value = minor units
    v.literal("free_delivery"),
  ),
  value: v.number(),
  minSubtotalMinor: v.optional(v.number()),
  maxDiscountMinor: v.optional(v.number()),
  startsAt: v.number(),
  endsAt: v.optional(v.number()),
  usageLimit: v.optional(v.number()),       // total redemptions
  usageLimitPerUser: v.optional(v.number()),
  isActive: v.boolean(),
})
  .index("by_code", ["code"])
  .index("by_active", ["isActive"]),

couponRedemptions: defineTable({
  couponId: v.id("coupons"),
  userId: v.id("users"),
  orderId: v.id("orders"),
  amountMinor: v.number(),
  createdAt: v.number(),
})
  .index("by_coupon", ["couponId"])
  .index("by_coupon_user", ["couponId", "userId"]),
```

**Invariants — re-evaluated server-side at checkout, always, from scratch**

1. `[U]` `code` unique (uppercased before the read) — §1.2 pattern.
2. `isActive === true`.
3. `startsAt <= now < endsAt` (when `endsAt` is set). `now` is passed in, not `Date.now()` (§1.3).
4. `subtotalMinor >= minSubtotalMinor` (when set).
5. Count of `couponRedemptions` for this coupon `< usageLimit` (when set).
6. Count for `(couponId, userId)` `< usageLimitPerUser` (when set).
7. `discount = clamp(calculated, 0, maxDiscountMinor)` and `discount <= subtotalMinor`.

A code stored in `carts.couponCode` is a **display hint only**. Conditions 1–7 are re-evaluated from
scratch inside the checkout transaction; a stale or tampered client value cannot influence the total.

**Coupon race (explicitly resolved).** Conditions 5 and 6 are count-based, so two concurrent
checkouts could both read "9 used" and both decide the limit is 10. This is safe **only because
the count is read via `by_coupon` inside the checkout transaction** and the redemption row is
inserted into that same table in the same transaction:

1. Checkout reads the `by_coupon` index range → recorded in the read set.
2. Checkout inserts a `couponRedemptions` row → writes into that range.
3. A concurrent redemption committed first ⇒ OCC abort ⇒ retry ⇒ re-read count ⇒ now over limit ⇒
   checkout fails with `COUPON_LIMIT_REACHED`.

**Without the indexed read in the same transaction, this race is real.** Do not "optimise" the count
into a cached counter field on `coupons` — that reintroduces the race and adds a hot document.

### 3.11 `orders` and `orderItems`

```ts
orders: defineTable({
  userId: v.id("users"),
  orderNumber: v.string(),              // [U] human-facing, e.g. "GRC-20261010-0042"

  status: v.union(
    v.literal("pending_payment"),
    v.literal("confirmed"),
    v.literal("preparing"),
    v.literal("out_for_delivery"),
    v.literal("delivered"),
    v.literal("cancelled"),
  ),
  paymentMethod: v.union(v.literal("cod"), v.literal("card")),
  paymentStatus: v.union(
    v.literal("unpaid"),
    v.literal("authorized"),
    v.literal("paid"),
    v.literal("failed"),
    v.literal("refunded"),
  ),

  // ---- Address SNAPSHOT ----
  // Copied at checkout so a later address edit cannot rewrite history.
  shippingAddress: v.object({
    recipientName: v.string(), phone: v.string(),
    line1: v.string(), line2: v.optional(v.string()),
    city: v.string(), region: v.optional(v.string()),
    postalCode: v.string(), countryCode: v.string(),
    deliveryNotes: v.optional(v.string()),
  }),

  // ---- Money, all server-computed. currency is validated, not v.literal. (§1.4)
  subtotalMinor: v.number(),
  discountMinor: v.number(),
  deliveryFeeMinor: v.number(),
  taxMinor: v.number(),
  totalMinor: v.number(),
  currency: v.string(),

  couponCode: v.optional(v.string()),
  idempotencyKey: v.optional(v.string()),   // [U] scoped per user
  customerNote: v.optional(v.string()),
  cancelledReason: v.optional(v.string()),

  // Reservation lifecycle support
  reservationExpiresAt: v.optional(v.number()),   // set for pending_payment orders
  cancelledAt: v.optional(v.number()),
  deliveredAt: v.optional(v.number()),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user_createdAt", ["userId", "createdAt"])
  .index("by_status_createdAt", ["status", "createdAt"])
  .index("by_orderNumber", ["orderNumber"])
  .index("by_user_idempotencyKey", ["userId", "idempotencyKey"])   // [U]
  .index("by_status_reservationExpiry", ["status", "reservationExpiresAt"]),
```

```ts
orderItems: defineTable({
  orderId: v.id("orders"),
  productId: v.optional(v.id("products")),   // optional: product may be hard-deleted
  variantId: v.optional(v.id("productVariants")),
  sku: v.string(),                          // snapshot
  name: v.string(),                         // snapshot
  variantName: v.string(),                  // snapshot
  imagePublicId: v.optional(v.string()),    // snapshot
  unitPriceMinor: v.number(),               // snapshot
  quantity: v.number(),
  lineTotalMinor: v.number(),               // snapshot
})
  .index("by_order", ["orderId"]),
```

#### 3.11.1 Idempotency — full specification

| Aspect                      | Decision                                                                                                                                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scope**                   | **Per user.** Keyed by `(userId, idempotencyKey)`, not globally. Two different users may legitimately generate the same UUID; scoping prevents cross-user collisions and prevents user A from reading user B's order via a guessed key.               |
| **Format**                  | Client-generated UUID v4, created when the user opens the checkout screen. Stable across retries.                                                                                                                                                     |
| **Lifecycle**               | Written once, never modified. Retained as long as the order.                                                                                                                                                                                          |
| **Lookup**                  | `withIndex("by_user_idempotencyKey", q => q.eq("userId", uid).eq("idempotencyKey", key)).unique()` — the index range is recorded, so a concurrent insert conflicts.                                                                                   |
| **Concurrent duplicate**    | Two `placeOrder` calls with the same key: both read the range and find nothing; both try to insert; the second **aborts on OCC**, retries, re-reads, finds the committed order, and returns it. **Exactly one order, exactly one stock reservation.** |
| **Retry behaviour**         | Returns the existing order with a flag `replayed: true`. The client treats it as success.                                                                                                                                                             |
| **Scope of the key**        | Covers the entire checkout operation. A _changed_ cart must generate a **new** key; reusing a key with different contents returns the original order, by design.                                                                                      |
| **Failure mode if omitted** | `idempotencyKey` is **required** for `placeOrder`, not optional. An omitted key is an argument-validation error.                                                                                                                                      |

**Why the index alone is not enough:** as established in §1.2, the index gives an O(log n) lookup.
The guarantee comes from the lookup happening _inside the same mutation_ as the insert.

#### 3.11.2 Order number generation — avoiding a hot document

Order numbers must be human-readable and unique. The naive counter is exactly the hot-document
anti-pattern Convex warns about (§1.3).

| Approach                       | Verdict                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single global counter document | ❌ **Rejected.** Every checkout writes the same row → serialised, OCC conflicts, retry storms.                                                                                                    |
| **Sharded daily counter**      | ✅ **Chosen.** `orderSequences: { day: "20261010", lastValue: number }`. Contention is bounded to one row per day; peak checkout volume per day is far below Convex's mutation throughput limits. |
| Random suffix                  | ✅ Acceptable fallback if sharding ever proves insufficient.                                                                                                                                      |

Generation happens inside `placeOrder`, reads `by_day`, increments, patches — one transaction with
the order insert. `[U]` guaranteed by the same read-then-write pattern: the day-sequence row is read
_and written_ in the same transaction, so two concurrent checkouts on the same day conflict, retry,
and receive distinct numbers.

#### 3.11.3 The checkout transaction

`placeOrder` is one Convex mutation. `now` is an **argument**, not `Date.now()` (§1.3).

| Step | Action                                                                                                          | Abort condition                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 0    | `requireUser`; resolve `users` row                                                                              | Unauthenticated / suspended / no user row                                              |
| 0a   | **Idempotency check.** Look up `(userId, key)`. If found → return that order with `replayed: true` and **stop** | —                                                                                      |
| 1    | Load the cart via `by_user`                                                                                     | No cart / empty cart                                                                   |
| 2    | Load `cartItems` via `by_cart`; load each variant; load each product                                            | —                                                                                      |
| 3    | Load each `inventoryLevels` via `by_variant`                                                                    | Missing level row                                                                      |
| 4    | **Validate availability**                                                                                       | `variant.isActive === false`, `product.status !== "active"`, or `available < quantity` |
| 5    | **Recompute `unitPriceMinor` from the variant.** Client-supplied prices are discarded entirely                  | `priceMinor <= 0`                                                                      |
| 6    | Re-evaluate the coupon from scratch (§3.10)                                                                     | Any coupon condition fails → fail loudly, do not silently drop                         |
| 7    | Compute delivery fee and tax from server config                                                                 | —                                                                                      |
| 8    | Derive `totalMinor`; assert `totalMinor >= 0`                                                                   | Negative total                                                                         |
| 9    | Allocate `orderNumber` via the sharded daily sequence (§3.11.2)                                                 | Sequence collision → retry                                                             |
| 10   | Insert the `orders` row                                                                                         | —                                                                                      |
| 11   | Insert all `orderItems` rows                                                                                    | —                                                                                      |
| 12   | For each line: `reserved += qty` and insert an `inventoryMovements` row with `reason: "reserve"`                | `available` check                                                                      |
| 13   | Delete the `cartItems` rows                                                                                     | —                                                                                      |
| 14   | Insert `couponRedemptions` if a coupon applied                                                                  | Limit re-check                                                                         |
| 15   | Set `reservationExpiresAt = now + RESERVATION_TTL_MS` for card orders                                           | —                                                                                      |

Because the whole function is one serializable transaction, steps 10–15 either all commit or none
do. A conflict (two buyers racing for the last unit) aborts and retries the **entire** mutation —
partial writes are impossible, and because every step re-derives from fresh state on retry, nothing
is double-applied.

#### 3.11.4 Order status state machine

```
pending_payment ──(payment webhook)──► confirmed ──► preparing ──► out_for_delivery ──► delivered
       │                                  │              │                │
       │(failed / expired)                └──────────────┴────────────────┘
       ▼                                            ▼
   cancelled  ◄────(customer, before preparing)── cancelled   [releases reservation]
                                                                   [after dispatch: return]
```

| Transition                             | Who                           | Side effects                         |
| -------------------------------------- | ----------------------------- | ------------------------------------ |
| `pending_payment → confirmed`          | **Verified webhook only**     | —                                    |
| `pending_payment → cancelled`          | Customer (own order) or admin | `release` movement                   |
| `pending_payment → cancelled` (expiry) | Scheduled sweep               | `release` movement (guarded, §3.6.2) |
| `confirmed → preparing`                | Admin                         | —                                    |
| `preparing → out_for_delivery`         | Admin                         | `commit` movement (`onHand -= qty`)  |
| `out_for_delivery → delivered`         | Admin                         | Sets `deliveredAt`                   |
| `delivered → (refund)`                 | Admin                         | `return` movement if restocked       |

A customer may cancel **only** their own order and **only** before `preparing`. Everything else
requires `requireAdmin()`. Every transition writes an `auditLogs` row.

### 3.12 `payments` and `refunds`

```ts
payments: defineTable({
  orderId: v.id("orders"),
  attempt: v.number(),               // 1, 2, 3… one row per payment attempt
  method: v.union(v.literal("cod"), v.literal("card")),
  status: v.union(
    v.literal("pending"),
    v.literal("authorized"),
    v.literal("captured"),
    v.literal("failed"),
    v.literal("refunded"),
    v.literal("partially_refunded"),
  ),
  amountMinor: v.number(),
  currency: v.string(),              // validated (§1.4)
  provider: v.optional(v.string()),        // "stripe"
  providerRef: v.optional(v.string()),     // [U] provider-side payment id
  failureCode: v.optional(v.string()),
  failureMessage: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_order", ["orderId"])
  .index("by_providerRef", ["providerRef"])          // [U]
  .index("by_order_attempt", ["orderId", "attempt"]),

refunds: defineTable({
  paymentId: v.id("payments"),
  orderId: v.id("orders"),
  amountMinor: v.number(),
  reason: v.optional(v.string()),
  providerRefundRef: v.optional(v.string()),
  createdBy: v.id("users"),          // admin who issued it
  createdAt: v.number(),
})
  .index("by_order", ["orderId"])
  .index("by_payment", ["paymentId"]),
```

#### 3.12.1 Payment attempts

Each checkout attempt with a card creates a `payments` row with an incrementing `attempt` number,
allowing retries after a failure without losing history. `by_order_attempt` makes the sequence
assertable. Only one row may be in `captured` per order.

#### 3.12.2 `[U]` Provider reference

`providerRef` is unique **per provider**, so a redelivered webhook or a double-charge attempt maps
to exactly one `payments` row. Implemented with the §1.2 read-then-write pattern on
`by_providerRef` inside the webhook mutation. **The index alone provides no guarantee.**

#### 3.12.3 Webhook handling — verified signature, idempotent, replay-safe

| Requirement               | Implementation                                                                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Signature first**       | Verify the provider signature **before parsing the body**. Read `request.text()` once, verify against that exact raw string, then parse. Re-serialising a parsed body and verifying that is a classic bypass.    |
| **Constant-time compare** | Timing-safe comparison of the computed and received signatures.                                                                                                                                                  |
| **Timestamp tolerance**   | Reject events outside a tolerance window (e.g. 5 min) to block replay.                                                                                                                                           |
| **Duplicate delivery**    | Lookup `by_providerRef`. If a `payments` row already exists for this event, no-op and return 200. Payment providers **guarantee at-least-once** delivery, so duplicates are normal, not exceptional.             |
| **Unknown reference**     | Do **not** create a payment. Record and return 200 so the provider stops retrying; surface for manual review. Creating a row from an unknown event is how fraudulent state gets created.                         |
| **Amount mismatch**       | If the provider amount ≠ `orders.totalMinor`, mark the payment `failed`, record `failureCode: "AMOUNT_MISMATCH"`, and **do not** mark the order paid. Alert.                                                     |
| **Ordering**              | A `refunded`/`failed` event arriving before its `captured` event must not regress state. Transitions are validated against an explicit adjacency map; out-of-order events are recorded and ignored, not applied. |

#### 3.12.4 Refund rules

| Rule           | Detail                                                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authority      | `requireAdmin()` + `auditLogs` row in the same transaction                                                                                                 |
| Cumulative cap | `sum(refunds.amountMinor) + newAmount <= payments.amountMinor`, read inside the transaction                                                                |
| Never negative | A refund may not exceed the captured amount                                                                                                                |
| Provider truth | Refund state is driven by the provider's webhook, not by the local mutation's return value. The mutation records intent; the webhook confirms.             |
| Stock          | A refund does **not** automatically restock. Restocking is a separate, explicit admin action (`return` movement) — returned goods must be inspected first. |

### 3.13 `auditLogs`

Append-only record of every privileged mutation.

```ts
auditLogs: defineTable({
  actorId: v.id("users"),
  actorRole: v.string(),
  action: v.string(),          // "product.update", "order.refund", "user.suspend"
  entity: v.string(),          // "products" | "orders" | ...
  entityId: v.string(),
  before: v.optional(v.string()),   // JSON string — avoids schema churn on diffs
  after: v.optional(v.string()),
  ip: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_actor_createdAt", ["actorId", "createdAt"])
  .index("by_entity_createdAt", ["entity", "createdAt"]),
```

**Invariants**

- Written inside the same mutation as the privileged change.
- Never updated or deleted. There is no update function for this table.

---

## 4. Index budget (verified limit: 32 per table, 16 fields per index)

| Table                | Regular | Search | Total | Fields/index max | Limit 32 |
| -------------------- | ------- | ------ | ----- | ---------------- | -------- |
| `products`           | 4       | 1      | 5     | 2                | OK       |
| `productVariants`    | 2       | 0      | 2     | 2                | OK       |
| `inventoryMovements` | 3       | 0      | 3     | 3                | OK       |
| `inventoryLevels`    | 1       | 0      | 1     | 1                | OK       |
| `cartItems`          | 2       | 0      | 2     | 2                | OK       |
| `wishlistItems`      | 2       | 0      | 2     | 2                | OK       |
| `couponRedemptions`  | 2       | 0      | 2     | 2                | OK       |
| `orders`             | 5       | 0      | 5     | 2                | OK       |
| `payments`           | 3       | 0      | 3     | 2                | OK       |
| `productImages`      | 2       | 0      | 2     | 2                | OK       |
| `addresses`          | 2       | 0      | 2     | 2                | OK       |
| all others           | ≤ 3     | 0      | ≤ 3   | ≤ 2              | OK       |

No table approaches the 32-index or 16-field limits.

---

## 5. Query → Index mapping

| Query                               | Index used                                   | Bounded?                          |
| ----------------------------------- | -------------------------------------------- | --------------------------------- |
| Product by slug (public)            | `products.by_slug`                           | Yes                               |
| Catalog page filtered by category   | `products.by_category_status`                | `.paginate()`                     |
| Catalog sorted newest               | `products.by_status_createdAt`               | `.paginate()`                     |
| Search + category filter            | `products.search_products`                   | `.take()` — **own cap**, see §1.5 |
| Typeahead suggestions               | `products.search_products`                   | `.take(8)`                        |
| Variants for a product              | `productVariants.by_product`                 | Yes                               |
| Stock for N variants                | `inventoryLevels.by_variant`                 | N point reads                     |
| Cart lines                          | `cartItems.by_cart`                          | User-bounded                      |
| "Is this variant in the cart?"      | `cartItems.by_cart_variant`                  | Yes                               |
| Duplicate wishlist guard            | `wishlistItems.by_user_product`              | Yes                               |
| Order history (paged)               | `orders.by_user_createdAt`                   | `.paginate()`                     |
| Admin order queue by status         | `orders.by_status_createdAt`                 | `.paginate()`                     |
| Expiring reservations               | `orders.by_status_reservationExpiry`         | Scheduled batch                   |
| Idempotency lookup                  | `orders.by_user_idempotencyKey`              | Yes                               |
| Per-user coupon usage               | `couponRedemptions.by_coupon_user`           | Yes                               |
| Has this reservation been released? | `inventoryMovements.by_order_variant_reason` | Yes                               |
| Payment webhook dedup               | `payments.by_providerRef`                    | Yes                               |

**No `.collect()` on an unbounded set anywhere.** `.collect()` appears only where a single user's
ownership bounds the result (their addresses, their wishlist).

---

## 6. Pagination policy

| Surface                              | Strategy                                                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog, order history, admin tables | `paginationOptsValidator` + `.paginate()`, surfaced through Convex's `usePaginatedQuery`.                                                      |
| Search results                       | `.paginate()` **plus** an explicit application-level cap. `maximumRowsRead`/`maximumBytesRead` are **not enforced for search queries** (§1.5). |
| Typeahead                            | `.take(8)` — never paginated.                                                                                                                  |
| Cart / wishlist / addresses          | Single-user bounded; `.take(n)` with a documented ceiling.                                                                                     |

Every paginated query sets `maximumBytesRead` / `maximumRowsRead` **where Convex enforces them**, and
additionally enforces its own cap in application code where it does not.

---

## 7. Data retention

| Data                                   | Policy                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------- |
| Orders, order items, payments, refunds | Retained indefinitely. Financial record.                                  |
| `auditLogs`                            | Retained indefinitely.                                                    |
| `inventoryMovements`                   | Retained indefinitely. Reconciliation.                                    |
| Addresses                              | User-deletable; the snapshot inside the order survives deletion.          |
| Carts                                  | Abandoned carts older than 30 days are purgeable by a scheduled mutation. |
| Expired `pending_payment` orders       | Released by the scheduled sweep; rows retained as financial records.      |

---

## 8. Migrations and unresolved decisions

### 8.1 Migration procedure

Convex validates all existing documents against the schema on every push; a push fails if any
document does not match. Changing a field type on a populated table therefore requires two phases:

1. Deploy with the field added as `v.optional(...)`.
2. Backfill in a scheduled mutation (idempotent — re-runnable).
3. Deploy again making the field required.

`convex-helpers`' `migration()` helper is available. Production backfills run during a maintenance
window with the previous deployment still live.

### 8.2 Unresolved business decisions

| ID     | Decision                                                                                                                           | Status  | Blocks                                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| **D1** | **Target currency.** `v.literal("USD")` removed in favour of validated `v.string()` + config allowlist (§1.4). Default unresolved. | ❓ Open | Display formatting, payment gateway. EGP vs USD is a **value change, not a schema migration** — deliberately de-risked. |
| **D2** | **Tax model.** VAT inclusive in displayed price, or added at checkout?                                                             | ❓ Open | Pricing engine, cart UI layout (whether a tax line renders).                                                            |
| **D3** | **Reservation TTL.** Expiry window for `pending_payment` card orders. Suggested default 30 min; needs commercial sign-off.         | ❓ Open | Checkout copy, sweep schedule.                                                                                          |
| **D4** | **Admin tiers.** Single `admin` role vs. `staff`/`superadmin`.                                                                     | ❓ Open | RBAC table growth; guard design is unaffected.                                                                          |
| **D5** | **Payment provider.** Stripe assumed.                                                                                              | ❓ Open | Phase F.                                                                                                                |
| **D6** | **Refund policy** and who may issue refunds.                                                                                       | ❓ Open | Refund mutations.                                                                                                       |

### 8.3 Operational edge cases — resolution summary

| Edge case                            | Resolution                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Price changes mid-checkout           | §3.4 — checkout re-reads variant price in-transaction; OCC forces consistency.                                         |
| Product archived mid-checkout        | §3.11.3 step 4 — checkout aborts with a per-line reason; the cart surfaces it rather than failing opaquely.            |
| Coupon invalid at checkout           | §3.10 — re-evaluated from scratch; failure is explicit, never a silent drop.                                           |
| Coupon race (§ usageLimit)           | §3.10 — safe **only** because the count read and redemption insert share a transaction.                                |
| Multiple carts / double add          | §3.8 — one cart per user, one line per variant, both via §1.2.                                                         |
| Two default addresses                | §3.2 — whole-set read + patch in one transaction; last writer wins, exactly one default.                               |
| Two primary product images           | §3.7 — same pattern.                                                                                                   |
| Concurrent cancellation + expiry     | §3.6.2 — `by_order_variant_reason` guard makes release exactly-once.                                                   |
| Double-tap "place order"             | §3.11.1 — required idempotency key; second call replays.                                                               |
| Concurrent cancellation of one order | §3.11.4 — transition validated against the adjacency map; second call is a no-op returning the current status.         |
| Webhook redelivery                   | §3.12.3 — provider-ref dedup, returns 200.                                                                             |
| Webhook arrives out of order         | §3.12.3 — adjacency map prevents state regression.                                                                     |
| Amount mismatch on webhook           | §3.12.3 — fail + alert, never mark paid.                                                                               |
| Reservation expiry sweep vs. payment | §3.6.2 — both paths guard on the same `(orderId, variantId)` movement; whichever commits first wins, the other no-ops. |
| Carts holding stock                  | §3.6.4 — deliberately **not** reserved; surfaced honestly at checkout.                                                 |

---

## 9. Related

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — stack, layering, testing, deployment
- [`SECURITY.md`](./SECURITY.md) — threat model, authorization matrix, secrets
- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) — phases, gates, blockers
