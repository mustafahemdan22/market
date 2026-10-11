# Design System — Premium Grocery Marketplace (Mobile)

**Status:** Phase B Step A — design specification, for review
**Last written:** 2026-10-10
**Applies to:** `apps/mobile` (Expo SDK 57, React Native 0.86.3, expo-router)
**Related:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`DATA_MODEL.md`](./DATA_MODEL.md) · [`SECURITY.md`](./SECURITY.md)

---

## 0. Scope of this document

This specifies the visual and structural foundation for the customer app. **No code is written yet**
at the time of writing; this is the specification Step B implements.

**Explicitly out of scope for Phase B:** authentication, cart persistence, checkout, payment,
order placement. Those require Clerk credentials and a linked Convex deployment, neither of which
exists yet (blockers B1, B2).

---

## 1. Design principles

| Principle | Consequence in this system |
|---|---|
| **Photography is the product** | Product imagery gets the largest real estate on a card. Chrome is quiet. |
| **Price is scannable in under a second** | Price, unit, and discount form one visual cluster, never split across a card. |
| **Restraint over decoration** | One accent colour, used only for price/savings/primary action. No gradients on surfaces, at most one subtle scrim. |
| **Depth through spacing, not shadow** | Elevation is expressed primarily through spacing and surface tint. Shadows are minimal and low-opacity. |
| **Every screen has four states** | Loading, empty, error, success. A screen that renders only data is incomplete. |
| **Honest about stock** | "Out of stock" and "only N left" are shown, never hidden until checkout. |
| **Accessibility is structural** | 44pt minimum targets, roles and labels on every control, contrast ≥ 4.5:1 for text. |

---

## 2. Design tokens

All tokens live in `apps/mobile/src/theme/tokens.ts`. **No component may hardcode a colour, size, or
spacing value.** Tokens are the only source.

### 2.1 Colour — brand and semantic

Light theme is primary; dark is defined and supported but validated in a later phase.

| Token | Light | Usage |
|---|---|---|
| `brand.600` | `#0E7C5A` | Primary actions, active states, price emphasis |
| `brand.700` | `#0A5F45` | Pressed state |
| `brand.50`  | `#E8F5F0` | Tint backgrounds, badge fills |
| `accent.500` | `#D97706` | **Savings/discount only.** Never for general emphasis. |
| `accent.50`  | `#FEF3C7` | Discount badge fill |
| `success.600` | `#15803D` | In stock, order confirmed |
| `warning.600` | `#B45309` | Low stock |
| `danger.600`  | `#B91C1C` | Out of stock, errors, destructive |
| `danger.50`   | `#FEE2E2` | Error surfaces |

**Neutrals** — `neutral.0 #FFFFFF`, `neutral.50 #F8FAF9`, `neutral.100 #F1F5F3`,
`neutral.200 #E2E8E5`, `neutral.400 #94A3A0`, `neutral.600 #52605C`, `neutral.800 #1F2A27`,
`neutral.900 #131C1A`

**Surfaces** — `surface.canvas #F8FAF9`, `surface.card #FFFFFF`, `surface.subtle #F1F5F3`,
`surface.inverse #131C1A`

**Semantic** — `text.primary #131C1A`, `text.secondary #52605C`, `text.muted #94A3A0`,
`text.inverse #FFFFFF`, `text.brand #0E7C5A`, `text.danger #B91C1C`,
`border.subtle #E2E8E5`, `border.strong #94A3A0`

> **Contrast:** `text.primary` on `surface.card` ≈ 15.8:1. `text.secondary` ≈ 7.1:1.
> `text.muted` (#94A3A0) is used **only** for decorative/disabled content — never for meaningful
> text, as it sits near 2.9:1 and would fail.

### 2.2 Typography

System font stack (no custom font download in Phase B — avoids a binary dependency and a
flash-of-unstyled-text).

| Token | Size / Line height | Weight | Usage |
|---|---|---|---|
| `type.display` | 30 / 36 | 700 | Screen titles (Home) |
| `type.h1` | 24 / 32 | 700 | Product name |
| `type.h2` | 20 / 28 | 600 | Section headers |
| `type.h3` | 17 / 24 | 600 | Card titles |
| `type.body` | 15 / 22 | 400 | Body, descriptions |
| `type.bodyStrong` | 15 / 22 | 600 | Emphasis |
| `type.caption` | 13 / 18 | 400 | Units, metadata |
| `type.label` | 13 / 16 | 600 | Badges, small labels |
| `type.price` | 19 / 24 | 700 | Price |
| `type.priceLarge` | 24 / 30 | 700 | Cart total |

**Arabic-specific rule:** Arabic glyphs need more leading than Latin at the same size. Line heights
above are tuned for both; `type.price` and larger get +2px when the active locale is `ar`.

### 2.3 Spacing — 4pt base

`0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64` (`space.0` … `space.12`)

Layout rules:
- Screen horizontal padding: `space.4` (16)
- Grid gutter: `space.3` (12)
- Card internal padding: `space.3` (12)
- Section gap: `space.6` (24)
- Card gap in a grid: `space.3` (12)

### 2.4 Radii

| Token | Value | Usage |
|---|---|---|
| `radius.sm` | 8 | Badges, small chips |
| `radius.md` | 12 | Inputs, buttons |
| `radius.lg` | 16 | Cards |
| `radius.xl` | 24 | Sheets, modals |
| `radius.full` | 999 | Pills, avatars |

### 2.5 Borders & elevation

- `border.hairline` 1px `neutral.200` — card and input outlines
- `border.focus` 2px `brand.600` — focus ring, offset 2px
- Shadows are used sparingly, only for genuinely floating surfaces (sheets, sticky bars):

| Token | iOS shadow | Android elevation |
|---|---|---|
| `elevation.card` | `opacity 0.04, radius 8, y 2` | 1 |
| `elevation.raised` | `opacity 0.08, radius 16, y 4` | 3 |
| `elevation.sheet` | `opacity 0.16, radius 24, y 8` | 8 |

### 2.6 Icon sizes

`icon.sm 16` · `icon.md 20` · `icon.lg 24` · `icon.xl 32`

Stroke width `1.75` for a consistent, non-heavy feel. Icons come from `@expo/vector-icons`
(MaterialCommunityIcons) — already bundled with Expo, so no new dependency.

### 2.7 Touch targets

- Minimum interactive: **44 × 44** (iOS HIG / Material both).
- Internal spacing between adjacent targets: **≥ 8**.
- Icons below 24px are wrapped in a 44×44 `Pressable`, never rendered bare.

### 2.8 Motion

| Token | Duration | Easing | Usage |
|---|---|---|---|
| `motion.fast` | 120 ms | `ease-out` | Press feedback, opacity |
| `motion.base` | 200 ms | `ease-in-out` | Sheet present, expand |
| `motion.slow` | 320 ms | `ease-in-out` | Skeleton shimmer cycle |

`LayoutAnimation` is **not** used for list mutations (jank on low-end Android). Only `opacity` and
`transform` are animated. No decorative animation, no looping motion except the skeleton shimmer.
All motion respects the OS "Reduce Motion" setting via `AccessibilityInfo.isReduceMotionEnabled()`.

### 2.9 Responsive rules

| Breakpoint | Width | Columns | Gutter | Card style |
|---|---|---|---|---|
| Compact | < 380 | 2 | 12 | Square image, condensed text |
| Regular | 380–767 | 2 | 12 | Square image |
| Large | ≥ 768 (tablet/foldable) | 3–4 | 16 | Taller image, full unit line |

The grid column count is computed from the container width at render time — no device-model
sniffing. The same code adapts to a foldable's unfolded width and to landscape.

---

## 3. Navigation architecture

### 3.1 Route tree (expo-router)

```
app/
├─ _layout.tsx                  # root: providers, font, direction, splash
├─ (tabs)/
│  ├─ _layout.tsx              # bottom tab navigator
│  ├─ index.tsx                # Home            → /
│  ├─ search.tsx               # Search          → /search
│  ├─ favorites.tsx            # Favorites       → /favorites
│  └─ account.tsx              # Account         → /account
├─ category/[slug].tsx         # Category browse → /category/:slug
├─ product/[slug].tsx          # Product detail  → /product/:slug
└─ cart.tsx                    # Cart            → /cart
```

### 3.2 Why these four tabs

`Home · Search · Favorites · Account` — the four things a grocery shopper does. Cart is **not** a
tab; it is reached from the header badge on Home and from the add-to-cart confirmation, because
basket frequency varies by trip while the other four are navigational anchors.

Route groups keep `(tabs)` out of the URL, so `/` is clean while the tab bar still renders.

### 3.3 Direction handling

`I18nManager.forceRTL` is **not** called at runtime. It requires a restart on Android and is
error-prone in Expo Go. Instead:

- Layout uses `flexDirection: "row"`, never `"row-reverse"`. React Native mirrors automatically
  when the layout direction is RTL.
- Margins use `marginStart`/`marginEnd`, never `marginLeft`/`marginRight`.
- Text alignment uses `textAlign: "start"`.
- Directional icons (chevrons, arrows, back) are mirrored via a single `mirror()` helper keyed on
  `isRTL()`. **Non-directional icons are never mirrored** — a shopping cart points the same way in
  both languages; a back chevron does not.
- `expo-localization` supplies the initial locale; a manual override persists to storage.

This avoids the restart requirement entirely and is testable without a device.

---

## 4. Localization & RTL strategy

### 4.1 Structure

```
src/i18n/
├─ index.ts          # createI18n, Locale type, provider
├─ locales/
│  ├─ en.ts          # English (LTR)
│  └─ ar.ts          # Arabic (Egypt) — ar-EG (RTL)
└─ keys.ts           # TranslationKey union — compile-time exhaustive
```

**A typed key union is the core mechanism.** `keys.ts` derives the key type from the English file,
so a missing Arabic key is a **TypeScript compile error**, not a runtime blank. Screens cannot
invent string keys.

### 4.2 Rules

| Rule | Rationale |
|---|---|
| **No user-facing string literals in components.** Every string comes from `t()`. | A grep for `>[A-Za-z]` inside JSX should return nothing. |
| **Translation logic is separate from business logic.** `t()` is a pure lookup; components never branch on locale for data. | Prevents locale-specific behaviour bugs. |
| **Numbers and currency go through `Intl`**, never manual concatenation. | Arabic-Indic digits, correct symbol placement, correct thousands separators. |
| **Plurals use `Intl.PluralRules`.** | Arabic has 6 plural categories (`zero`, `one`, `two`, `few`, `many`, `other`); English has 2. A naive `count === 1` check is wrong in Arabic. |
| **Never translate via concatenation.** `t("items", { n })` with a placeholder, not `` `${t("items")} ${n}` `` | Word order differs; Arabic can reorder. |
| **ICU number/currency formatting** via `Intl.NumberFormat(locale, …)` | Correct digit shaping per locale. |

### 4.3 Currency formatting

`formatMoney(minorUnits, currency, locale)` in `packages/shared`:

```ts
new Intl.NumberFormat(locale, {
  style: "currency",
  currency,           // from config, NOT hardcoded
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(minorUnits / 100);
```

Minor units are divided by 100 **only because every supported currency has exponent 2** (EGP and USD
both do). The exponent is looked up per currency, not assumed — see `DATA_MODEL.md` §1.4.

**Unresolved (D1):** the default currency. The formatter is currency-agnostic; the *value* comes from
config. EGP and USD are both implemented and correct. Nothing is hardcoded to either.

### 4.4 Sample translations

| Key | English | Arabic (Egypt) |
|---|---|---|
| `tab.home` | Home | الرئيسية |
| `tab.search` | Search | البحث |
| `tab.favorites` | Favorites | المفضلة |
| `tab.account` | Account | حسابي |
| `a11y.cartBadge` | {{count}} items in cart | {{count}} عنصر في السلة |
| `stock.out` | Out of stock | غير متوفر |
| `stock.low` | Only {{count}} left | متبقي {{count}} فقط |
| `action.addToCart` | Add to cart | أضف إلى السلة |

Arabic strings are authored in Modern Standard Arabic suitable for Egyptian retail.

---

## 5. Component inventory

Implemented in `src/components/`. Each is typed, accessible, and has all four states.

### 5.1 Primitives — `src/components/ui/`

| Component | Purpose | Key states |
|---|---|---|
| `Text` | Typographic primitive enforcing the type scale | variant, tone, alignment |
| `Button` | Primary / secondary / ghost / danger | default, pressed, disabled, loading |
| `IconButton` | 44×44 icon-only control | default, pressed, disabled, requires `accessibilityLabel` |
| `Input` | Text field | default, focused, error, disabled, with counter |
| `SearchField` | Input + clear + debounce hook | empty, typing, clearing |
| `Badge` | Discount / status pill | tones: brand, accent, success, warning, danger, neutral |
| `Price` | Amount + optional compare-at + discount | normal, discounted, large |
| `QuantityStepper` | − / value / + | min, max, disabled, clamped |
| `Skeleton` | Loading placeholder | shape variants, shimmer |
| `EmptyState` | Icon + title + body + action | with/without action |
| `ErrorState` | Message + retry | retryable, non-retryable |
| `Chip` | Filter/sort selector | selected, unselected |
| `Banner` | Inline notice | info, warning, danger, dev-only |
| `Divider` | Section rule | — |
| `Pressable` | Ripple/press wrapper with scale feedback | pressed |

### 5.2 Commerce components — `src/components/commerce/`

| Component | Purpose |
|---|---|
| `ProductCard` | Grid/list card: image, name, unit, price, discount badge, stock state, add button |
| `ProductImage` | `expo-image` with aspect ratio, fade-in, **graceful missing-image fallback** |
| `ProductGrid` | Responsive 2/3/4-column layout |
| `CategoryTile` | Category image + label, horizontal or grid |
| `SectionHeader` | Title + optional "See all" action |
| `CartBar` | Sticky bottom summary: item count + subtotal + view cart |
| `CartLineItem` | Row: thumbnail, name, unit, price, stepper, remove |
| `PriceSummary` | Subtotal / discount / delivery / tax rows + total |
| `HeaderBar` | Screen title, back, optional cart badge |

### 5.3 Rules

| Rule | Detail |
|---|---|
| **No component exceeds ~200 lines.** Split instead. |
| **Every `Pressable` has `accessibilityRole` + `accessibilityLabel`.** Enforced by review; `IconButton` makes the label a required prop so it cannot be forgotten. |
| **No component fetches data.** Data arrives as props or via a typed hook in `features/`. |
| **No component formats money inline.** They call `useFormat()` from the i18n context. |
| **No `any`.** Strict TypeScript throughout. |

---

## 6. Screen specifications

### 6.1 Splash and onboarding (if justified)
**Purpose:** App launch orientation, branding, and permissions (location/notifications) explanation.
**Justification & Policy:** Splash is native via `expo-splash-screen` to prevent white flash. Onboarding carousel is shown only on first launch, dismissible in 1 tap directly into shopping (grocery shopping must never gate browsing behind multi-step tutorials).
**Layout:** Full-height brand container, illustration/product imagery, 3 benefit slides (freshness, 30-min express delivery, transparent pricing), skip button (top end), primary "Start shopping" CTA (bottom).
**Key components:** `ProductImage`, `Text`, `Button`, `IconButton`, slide indicator dots.
**States:**
- Loading: Native splash screen holds until fonts and initial locale are loaded.
- Success: Carousel slides smoothly with swipe or next CTA.
- Error/Timeout: Falls back to instant route transition to Home after 2 seconds.
**Navigation:** "Skip" or "Start shopping" → `/` (Home); "Sign in" link → `/(auth)/sign-in`.

### 6.2 Authentication — `/(auth)/sign-in`, `/(auth)/sign-up`, `/(auth)/verify`
**Purpose:** Customer identity verification via Clerk (phone OTP or email magic link).
**Layout:** Header with close button (return to previous screen without blocking shopping) → brand logo → phone/email input → country code selector (+20 Egypt default) → OTP 6-digit input → resend timer → terms & privacy disclaimer.
**Key components:** `HeaderBar`, `Input`, `Button`, `Banner`, OTP digit fields.
**States:**
- Idle: Clean input field with focus ring.
- Submitting: Button enters loading spinner, inputs disabled.
- Error: Clear inline validation error below field (e.g. invalid phone number, wrong OTP code) + retry.
- Success: Smooth redirect back to origin route or Home.
**Navigation:** Close → return; Sign up switch → toggle sign in / sign up; Forgot/help → customer support modal.

### 6.3 Home and featured categories — `/`
**Purpose:** Orientation, fast grocery discovery, and quick access to active trip items.
**Layout:** Top header (greeting, location chip, language toggle, cart badge) → SearchField entry → Category carousel (horizontal scroll with clear badges) → "Daily Deals" horizontal product rail → "Fresh & Local Picks" 2-column responsive product grid → Sticky `CartBar` (appears when cart count > 0).
**Key components:** `HeaderBar`, `SearchField`, `CategoryTile`, `ProductCard`, `CartBar`, `Banner`.
**States:**
- Loading: Skeleton grid mirroring header, carousel chips, and 4 product cards with shimmer.
- Empty: "No products available in your area" with change-location CTA.
- Error: `ErrorState` with retry button, preserving previously cached view if available.
- Success: Full interactive feed with instant add-to-cart.
**Navigation:** Category tile → `/category/[slug]`; Product card → `/product/[slug]`; Search field tap → `/search`; CartBar tap → `/cart`.

### 6.4 Product listing and search — `/search` & `/category/[slug]`
**Purpose:** Efficiently browse catalog and find specific pantry items.
**Layout:** Sticky search bar with voice/barcode/clear action → subcategory filter chips → sticky sort & filter trigger bar (showing active filter count) → results counter → 2-column responsive product grid with infinite scroll.
**Key components:** `SearchField`, `Chip`, `ProductCard`, `ProductGrid`, `Skeleton`, `EmptyState`, `CartBar`.
**States:**
- Initial/Empty query: Recent searches chips + popular search suggestions.
- Loading: Grid skeleton cards.
- No results: `EmptyState` ("No items found for «query»") with "Clear search" and "Browse categories" actions.
- Error: `ErrorState` with retry.
- Success: Paginated product results.
**Navigation:** Product card → `/product/[slug]`; Filter button → opens filter sheet modal; Clear button → resets search query.

### 6.5 Search filters and sorting — `/search/filters` (Bottom Sheet / Modal)
**Purpose:** Refine catalog search results by department, dietary tags, price range, and availability.
**Layout:** Modal header (Title "Filters", "Reset" text button, Close icon) → Sort options (Popularity, Price low-to-high, Price high-to-low, Discount) → In-stock toggle → Dietary preferences (Organic, Halal, Gluten-free, Local) → Price range slider / inputs → Sticky footer with "Apply (N results)" button.
**Key components:** `Chip`, `Button`, `IconButton`, `Text`, `Divider`, custom range selector.
**States:**
- Active: Selected chips highlighted in `brand.50` with `brand.600` border.
- Applying: Brief button spinner during query recalculation.
- Reset: Clears all selections except default sorting.
**Navigation:** Close / Apply → dismisses sheet and updates active query parameters.

### 6.6 Product details and variants — `/product/[slug]`
**Purpose:** Deep-dive into product specifications, select weight/size variants, and configure quantity.
**Layout:** Back navigation + share + favorite action bar → Hero image gallery with aspect ratio preservation and swipe pagination → Product title, brand tag, and origin badge → Price cluster (major price, unit price, compare-at price, discount pill) → Variant selector (e.g. 500g vs 1kg, single vs pack) → Stock status line ("In stock", "Only 3 left", "Out of stock") → Quantity stepper + Sticky "Add to cart" CTA bar → Expandable accordion for description, nutrition facts, and storage instructions.
**Key components:** `ProductImage`, `Badge`, `Price`, `QuantityStepper`, `Button`, `IconButton`, `Divider`.
**States:**
- Loading: Skeleton matching hero image height, text blocks, and button bar.
- Out of stock: Quantity stepper disabled, CTA button disabled with "Out of stock" label, "Notify me" button rendered.
- Low stock: Amber warning badge ("Only {n} remaining").
- Error: `ErrorState` with "Product not found" and "Back to catalog" CTA.
**Navigation:** Back button → previous screen; Add to cart → triggers haptic feedback + updates cart state + displays inline confirmation toast; Category breadcrumb → `/category/[slug]`.

### 6.7 Shopping cart — `/cart`
**Purpose:** Review selected basket items, adjust quantities, review itemized price breakdown, and verify minimum order requirement.
**Layout:** Top header ("Shopping Cart", clear-cart option) → Order progress banner (e.g. "Add 35 EGP for Free Delivery") → List of `CartLineItem` rows (thumbnail, title, unit, price, stepper, remove button) → Coupon code input with "Apply" button → `PriceSummary` (Subtotal, Savings, Delivery fee, Estimated VAT, Total) → Sticky "Proceed to checkout" CTA.
**Key components:** `CartLineItem`, `PriceSummary`, `Input`, `Button`, `Badge`, `EmptyState`.
**States:**
- Empty: `EmptyState` ("Your cart is empty") with shopping basket illustration and "Explore Fresh Groceries" button → `/`.
- Loading: Skeleton line items with shimmer.
- Minimum order unmet: CTA disabled with progress indicator showing remaining amount needed.
- Error: Inline warning if an item's price or stock changed since addition.
**Navigation:** Item tap → `/product/[slug]`; Proceed to checkout → `/checkout` (disabled prototype notice in Phase B).

### 6.8 Address selection and checkout — `/checkout` (Phase D / Spec)
**Purpose:** Finalize delivery destination, choose delivery window (immediate vs scheduled), and select payment method.
**Layout:** Stepper header (Address → Time → Payment) → Delivery address card with "Change" action → Delivery slot selector (30-min express vs evening slots) → Delivery notes input (apartment, floor, landmark) → Payment method selection (Cash on Delivery, Credit Card, Mobile Wallet) → Final order summary → "Place Order" CTA.
**Key components:** `Card`, `Chip`, `Input`, `Button`, `PriceSummary`, `IconButton`.
**States:**
- Loading: Skeleton address cards and slot placeholders.
- Validation error: Highlighted address or missing payment fields.
- Submitting: Idempotent submission state (button spinner, back navigation blocked, touch blocked).
**Navigation:** Change address → address book modal; Place order → `/order-confirmation/[orderId]`.

### 6.9 Order confirmation and tracking — `/orders/[orderId]` (Phase D / Spec)
**Purpose:** Reassure customer after purchase, show order number, and track delivery progress in real time.
**Layout:** Success illustration / animation → Order number and estimated delivery time → Real-time status timeline (Order Placed → Preparing in Store → Out for Delivery → Delivered) → Driver contact card (when out for delivery) → Itemized invoice summary → "Back to Home" and "Help with Order" actions.
**Key components:** `Card`, `Badge`, `Button`, `IconButton`, `Divider`, Status Stepper.
**States:**
- Active tracking: Periodic poll / reactive Convex subscription updating status step and map ETA.
- Completed: Final receipt view with reorder button.
- Cancelled: Prominent cancellation alert with refund details.
**Navigation:** Back to Home → `/`; Reorder items → adds items back to cart and routes to `/cart`.

### 6.10 Order history — `/account/orders` (Phase D / Spec)
**Purpose:** View past purchases, track ongoing orders, and reorder favourite weekly baskets.
**Layout:** Filter tabs ("Active", "Past Orders") → Vertical list of order cards (Order date, order number, item count, total price, status badge, thumbnail preview strip) → "Reorder all" action button and "View Details" arrow on each card.
**Key components:** `Card`, `Badge`, `Button`, `Price`, `EmptyState`, `Skeleton`.
**States:**
- Loading: Skeleton order cards.
- Empty: `EmptyState` ("No orders yet. Your grocery history will appear here").
- Error: `ErrorState` with retry.
**Navigation:** Card tap → `/orders/[orderId]`; Reorder tap → repopulates cart.

### 6.11 Favorites / Saved items — `/favorites`
**Purpose:** Quick access to frequently purchased grocery staples and saved items.
**Layout:** Header ("Favorites", item count) → Quick "Add all available to cart" CTA → 2-column responsive product grid with immediate quantity stepper / add button → Remove heart toggle on each card.
**Key components:** `ProductCard`, `ProductGrid`, `Button`, `EmptyState`, `CartBar`.
**States:**
- Empty: `EmptyState` ("No favorites yet. Tap the heart on products you love to reorder them easily").
- Loading: Grid skeleton.
- Success: Interactive grid with live stock status.
**Navigation:** Product card → `/product/[slug]`; CartBar → `/cart`.

### 6.12 Profile and settings — `/account`
**Purpose:** Manage user preferences, language switch, delivery addresses, and support.
**Layout:** Customer profile card (name, phone, membership status) → Shopping preferences section (Language switcher: English / العربية, Dark mode toggle) → Account sections (Saved Addresses, Payment Methods, Order History) → Support & Legal (Customer Support chat, Terms of Service, Privacy Policy, App Version & Build number) → Sign out / Delete account action.
**Key components:** `Card`, `Chip`, `Button`, `IconButton`, `Divider`, `Banner`.
**States:**
- Authenticated: Displays customer name and saved information.
- Guest / Prototype: Displays polite sign-in prompt while allowing full access to language and settings.
**Navigation:** Language toggle → instant RTL/LTR switch; Addresses → address book; Support → external contact/chat.

---

## 7. Backend integration boundary

```ts
// src/data/catalogRepository.ts — the ONLY place fixture data enters
export interface CatalogRepository {
  listCategories(): Promise<Category[]>;
  listProductsByCategory(slug: string): Promise<Product[]>;
  getProduct(slug: string): Promise<Product | null>;
  searchProducts(query: string): Promise<Product[]>;
}
```

- The interface is the seam. Phase C replaces `fixtureRepository` with a `convexRepository`; **no
  component changes.**
- Components import the interface, never the implementation.
- `fixtureRepository` lives in `src/data/fixtures/` and is **guarded three ways**:
  1. `__DEV__` only — throws in a production bundle.
  2. A visible on-screen `Banner` in dev builds stating data is sample data.
  3. Files named `*.fixture.ts` and confined to one directory.

**No fake authentication, payment, order placement, or inventory change is implemented.** Cart state
is local UI state in a Zustand store, clearly labelled as session-only until the backend exists.

---

## 8. Decisions requiring approval

| # | Decision | Status |
|---|---|---|
| D1 | Default currency (EGP vs USD) | ❓ Open — formatter is currency-agnostic; no code blocks |
| D2 | VAT inclusive vs. added at checkout | ❓ Open — `PriceSummary` supports both shapes |
| D7 | **System font vs. a custom Arabic typeface** | Proposed: system font for Phase B. A bundled typeface (e.g. IBM Plex Sans Arabic) would improve Arabic rendering but adds a binary asset and a licence to track. |
| D8 | **Tabs: 4 (Home/Search/Favorites/Account) vs. 5 with Cart** | Proposed: 4, cart via header badge + sticky bar. |

---

## 9. Implementation checklist for Step B

- [ ] Monorepo skeleton per `ARCHITECTURE.md` §4 (npm workspaces)
- [ ] `packages/shared`: currency, money formatting, locale helpers + Vitest tests
- [ ] `apps/mobile`: Expo app, expo-router, TypeScript strict
- [ ] `tokens.ts` — every value in §2
- [ ] `i18n/` — typed keys, `en`, `ar`, provider, `useFormat`
- [ ] `components/ui/` — 15 primitives
- [ ] `components/commerce/` — 9 commerce components
- [ ] `data/` — repository interface + dev fixtures
- [ ] Screens: Home, Search, Category, Product, Cart, Favorites, Account
- [ ] RTL verification for every screen
- [ ] Responsive verification at <380 / 380–767 / ≥768
- [ ] `tsc --noEmit`, ESLint, Vitest all green
