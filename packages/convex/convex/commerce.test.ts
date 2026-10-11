import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

const ADMIN = "user_admin_001";
const CUSTOMER = "user_customer_001";
const ATTACKER = "user_attacker_001";

let previousAllowlist: string | undefined;

beforeEach(() => {
  previousAllowlist = process.env.PANDAMA_ADMIN_SUBJECTS;
  process.env.PANDAMA_ADMIN_SUBJECTS = ADMIN;
});

afterEach(() => {
  if (previousAllowlist === undefined) {
    delete process.env.PANDAMA_ADMIN_SUBJECTS;
  } else {
    process.env.PANDAMA_ADMIN_SUBJECTS = previousAllowlist;
  }
});

/**
 * ONE backend per test. `convexTest()` instances do NOT share data, so seeding
 * and asserting must happen against the same instance. `withIdentity` returns
 * another accessor over the SAME backend, which is how a single test acts as
 * admin and as customer.
 */
function backend() {
  return convexTest({ schema, modules });
}

type Backend = ReturnType<typeof backend>;

async function seed(t: Backend, stock = 10) {
  const a = t.withIdentity({ subject: ADMIN });
  const { categoryId } = await a.mutation(api.admin.categories.createCategory, {
    nameEn: "Produce",
    nameAr: "منتجات",
    now: 1000,
  });
  const created = await a.mutation(api.admin.products.createProduct, {
    nameEn: "Fuji Apples",
    nameAr: "تفاح فوجي",
    descriptionEn: "Crisp",
    descriptionAr: "مقرمش",
    categoryId,
    unitLabel: "per 1 kg",
    sku: "PRD-0001",
    variantNameEn: "1 kg",
    variantNameAr: "١ كجم",
    priceMinor: 1250,
    stock,
    now: 1000,
  });
  return { categoryId, ...created };
}

const shipping = {
  shippingName: "Sarah Miller",
  shippingPhone: "+201000000000",
  shippingLine1: "213 Degla St",
  shippingCity: "Cairo",
  paymentMethod: "cod" as const,
  now: 2000,
};

describe("public catalogue", () => {
  it("is readable by an anonymous visitor", async () => {
    const t = backend();
    await seed(t);

    const anon = t.withIdentity({});
    const products = await anon.query(api.public.catalog.listProducts, {});
    expect(products.length).toBe(1);
    expect(products[0]?.nameEn).toBe("Fuji Apples");
    expect(products[0]?.available).toBe(true);
  });

  it("never exposes draft or archived products", async () => {
    const t = backend();
    const { productId } = await seed(t);
    await t.withIdentity({ subject: ADMIN }).mutation(api.admin.products.updateProductStatus, {
      productId,
      status: "archived",
      now: 1500,
    });

    const anon = t.withIdentity({});
    expect((await anon.query(api.public.catalog.listProducts, {})).length).toBe(0);
    expect(
      await anon.query(api.public.catalog.getProductBySlug, { slug: "fuji-apples" }),
    ).toBeNull();
  });

  it("does not leak admin-only fields", async () => {
    const t = backend();
    await seed(t);
    const [product] = await t.withIdentity({}).query(api.public.catalog.listProducts, {});

    expect(product).not.toHaveProperty("createdBySubject");
    expect(product).not.toHaveProperty("updatedBySubject");
    expect(product).not.toHaveProperty("searchText");
  });

  it("reports availability from onHand minus reserved", async () => {
    const t = backend();
    const { variantId } = await seed(t, 5);
    await t.run(async (ctx) => {
      const level = await ctx.db
        .query("inventoryLevels")
        .withIndex("by_variant", (q) => q.eq("variantId", variantId))
        .unique();
      await ctx.db.patch(level!._id, { reserved: 5 });
    });

    const [product] = await t.withIdentity({}).query(api.public.catalog.listProducts, {});
    expect(product?.available).toBe(false);
  });

  it("filters out unavailable products when asked", async () => {
    const t = backend();
    const { variantId } = await seed(t, 3);
    await t.run(async (ctx) => {
      const level = await ctx.db
        .query("inventoryLevels")
        .withIndex("by_variant", (q) => q.eq("variantId", variantId))
        .unique();
      await ctx.db.patch(level!._id, { reserved: 3 });
    });

    const anon = t.withIdentity({});
    expect((await anon.query(api.public.catalog.listProducts, {})).length).toBe(1);
    expect((await anon.query(api.public.catalog.listProducts, { inStockOnly: true })).length).toBe(
      0,
    );
  });

  it("scopes a product detail to its active variants", async () => {
    const t = backend();
    await seed(t, 4);
    const detail = await t
      .withIdentity({})
      .query(api.public.catalog.getProductBySlug, { slug: "fuji-apples" });

    expect(detail?.variants.length).toBe(1);
    expect(detail?.variants[0]?.available).toBe(4);
    expect(detail?.variants[0]?.sku).toBe("PRD-0001");
  });
});

describe("cart", () => {
  it("rejects an anonymous caller", async () => {
    const t = backend();
    await expect(t.withIdentity({}).query(api.public.cart.getCart, {})).rejects.toThrow();
  });

  it("adds a line and returns a server-computed subtotal", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });

    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 3, now: 2000 });
    const cart = await c.query(api.public.cart.getCart, {});

    expect(cart.itemCount).toBe(3);
    expect(cart.subtotalMinor).toBe(3 * 1250);
    expect(cart.items[0]?.issue).toBeNull();
  });

  it("merges a duplicate add instead of creating a second line", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });

    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 2, now: 2000 });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2100 });

    const cart = await c.query(api.public.cart.getCart, {});
    expect(cart.items.length).toBe(1);
    expect(cart.items[0]?.quantity).toBe(3);
  });

  it("does not write an inventory movement when adding to the cart", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const before = await t.run((ctx) => ctx.db.query("inventoryMovements").collect());

    await t
      .withIdentity({ subject: CUSTOMER })
      .mutation(api.public.cart.addToCart, { variantId, quantity: 5, now: 2000 });

    expect((await t.run((ctx) => ctx.db.query("inventoryMovements").collect())).length).toBe(
      before.length,
    );
  });

  it("prevents one customer from mutating another customer's cart", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);

    const owner = t.withIdentity({ subject: CUSTOMER });
    const { itemId } = await owner.mutation(api.public.cart.addToCart, {
      variantId,
      quantity: 1,
      now: 2000,
    });

    const attacker = t.withIdentity({ subject: ATTACKER });
    await attacker.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2100 });

    await expect(
      attacker.mutation(api.public.cart.updateCartItem, { itemId, quantity: 99, now: 2200 }),
    ).rejects.toThrow();
  });

  it("surfaces an out-of-stock line instead of silently dropping it", async () => {
    const t = backend();
    const { variantId } = await seed(t, 2);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 5, now: 2000 });

    const cart = await c.query(api.public.cart.getCart, {});
    expect(cart.items[0]?.issue).toBe("insufficient_stock");
    expect(cart.subtotalMinor).toBe(0);
  });

  it("rejects a non-positive quantity", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    await expect(
      t
        .withIdentity({ subject: CUSTOMER })
        .mutation(api.public.cart.addToCart, { variantId, quantity: 0, now: 2000 }),
    ).rejects.toThrow();
  });
});

describe("placeOrder", () => {
  it("rejects an anonymous caller", async () => {
    const t = backend();
    await expect(
      t
        .withIdentity({})
        .mutation(api.public.orders.placeOrder, { ...shipping, idempotencyKey: "k1" }),
    ).rejects.toThrow();
  });

  it("creates an order from server-side prices and reserves stock", async () => {
    const t = backend();
    const { variantId, productId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 2, now: 2000 });

    const result = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "order-key-1",
    });

    expect(result.replayed).toBe(false);
    expect(result.orderNumber).toMatch(/^GRC-\d{8}-0001$/);

    const level = await t.run(async (ctx) =>
      ctx.db
        .query("inventoryLevels")
        .withIndex("by_variant", (q) => q.eq("variantId", variantId))
        .unique(),
    );
    expect(level?.onHand).toBe(10);
    expect(level?.reserved).toBe(2);

    const reserve = (await t.run((ctx) => ctx.db.query("inventoryMovements").collect())).find(
      (m) => m.reason === "reserve",
    );
    expect(reserve?.reservedDelta).toBe(2);
    expect(reserve?.orderId).toBe(result.orderId);

    const items = await t.run(async (ctx) =>
      ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", result.orderId))
        .collect(),
    );
    expect(items[0]?.unitPriceMinor).toBe(1250);
    expect(items[0]?.lineTotalMinor).toBe(2500);
    expect(items[0]?.productId).toBe(productId);

    expect((await c.query(api.public.cart.getCart, {})).items.length).toBe(0);
  });

  it("computes totals on the server and adds no separate VAT line", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2000 });

    const result = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "k2",
    });

    const order = await t.run((ctx) => ctx.db.get(result.orderId));
    expect(order?.subtotalMinor).toBe(1250);
    expect(order?.deliveryFeeMinor).toBe(5000);
    expect(order?.totalMinor).toBe(6250);
    expect(order?.currency).toBe("EGP");
    // VAT is inside the shelf price; the order carries no tax field at all.
    expect(order).not.toHaveProperty("taxMinor");
  });

  it("is idempotent: the same key twice creates exactly one order", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 2, now: 2000 });

    const first = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "same-key",
    });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 2, now: 3000 });
    const second = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "same-key",
    });

    expect(second.replayed).toBe(true);
    expect(second.orderId).toBe(first.orderId);
    expect((await t.run((ctx) => ctx.db.query("orders").collect())).length).toBe(1);

    const level = await t.run(async (ctx) =>
      ctx.db
        .query("inventoryLevels")
        .withIndex("by_variant", (q) => q.eq("variantId", variantId))
        .unique(),
    );
    expect(level?.reserved).toBe(2);
  });

  it("rejects checkout when stock is insufficient, leaving no partial order", async () => {
    const t = backend();
    const { variantId } = await seed(t, 1);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 5, now: 2000 });

    await expect(
      c.mutation(api.public.orders.placeOrder, { ...shipping, idempotencyKey: "k3" }),
    ).rejects.toThrow();

    expect((await t.run((ctx) => ctx.db.query("orders").collect())).length).toBe(0);

    const level = await t.run(async (ctx) =>
      ctx.db
        .query("inventoryLevels")
        .withIndex("by_variant", (q) => q.eq("variantId", variantId))
        .unique(),
    );
    expect(level?.reserved).toBe(0);
    expect((await c.query(api.public.cart.getCart, {})).items.length).toBe(1);
  });

  it("rejects an empty cart", async () => {
    const t = backend();
    await expect(
      t
        .withIdentity({ subject: CUSTOMER })
        .mutation(api.public.orders.placeOrder, { ...shipping, idempotencyKey: "k4" }),
    ).rejects.toThrow();
  });

  it("issues distinct order numbers for distinct keys", async () => {
    const t = backend();
    const { variantId } = await seed(t, 20);
    const c = t.withIdentity({ subject: CUSTOMER });

    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2000 });
    const first = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "k5",
    });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2100 });
    const second = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "k6",
    });

    expect(first.orderNumber).not.toBe(second.orderNumber);
  });

  it("scopes idempotency per customer so two users cannot collide", async () => {
    const t = backend();
    const { variantId } = await seed(t, 20);
    const a = t.withIdentity({ subject: CUSTOMER });
    const b = t.withIdentity({ subject: "user_customer_002" });

    await a.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2000 });
    await b.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2000 });

    const first = await a.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "shared",
    });
    const second = await b.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "shared",
    });

    expect(second.replayed).toBe(false);
    expect(second.orderId).not.toBe(first.orderId);
  });
});

describe("order ownership and cancellation", () => {
  it("hides another customer's order", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const owner = t.withIdentity({ subject: CUSTOMER });
    await owner.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2000 });
    const placed = await owner.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "own-1",
    });

    await expect(
      t.withIdentity({ subject: ATTACKER }).query(api.public.orders.getOrder, {
        orderId: placed.orderId,
      }),
    ).rejects.toThrow();
  });

  it("releases the reservation exactly once when cancelled twice", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 3, now: 2000 });
    const placed = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "cancel-1",
    });

    await c.mutation(api.public.orders.cancelOrder, { orderId: placed.orderId, now: 3000 });
    const second = await c.mutation(api.public.orders.cancelOrder, {
      orderId: placed.orderId,
      now: 3100,
    });
    expect(second.alreadyCancelled).toBe(true);

    const level = await t.run(async (ctx) =>
      ctx.db
        .query("inventoryLevels")
        .withIndex("by_variant", (q) => q.eq("variantId", variantId))
        .unique(),
    );
    expect(level?.reserved).toBe(0);

    const releases = await t.run((ctx) =>
      ctx.db
        .query("inventoryMovements")
        .withIndex("by_order_variant_reason", (q) =>
          q.eq("orderId", placed.orderId).eq("variantId", variantId).eq("reason", "release"),
        )
        .collect(),
    );
    expect(releases.length).toBe(1);
  });

  it("refuses to cancel an order belonging to someone else", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const owner = t.withIdentity({ subject: CUSTOMER });
    await owner.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2000 });
    const placed = await owner.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "own-2",
    });

    await expect(
      t
        .withIdentity({ subject: ATTACKER })
        .mutation(api.public.orders.cancelOrder, { orderId: placed.orderId, now: 3000 }),
    ).rejects.toThrow();
  });
});
