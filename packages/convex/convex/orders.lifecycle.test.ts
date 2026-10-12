import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
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

async function readLevel(t: Backend, variantId: Id<"productVariants">) {
  return t.run(async (ctx) =>
    ctx.db
      .query("inventoryLevels")
      .withIndex("by_variant", (q) => q.eq("variantId", variantId))
      .unique(),
  );
}

describe("order placement", () => {
  it("confirms a cash-on-delivery order at placement, not at dispatch", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2000 });

    const placed = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "cod-confirm",
    });

    expect(placed.status).toBe("confirmed");
    const stored = await t.run((ctx) => ctx.db.get(placed.orderId));
    expect(stored?.status).toBe("confirmed");
    expect(stored?.paymentStatus).toBe("unpaid");

    // The customer-facing read agrees.
    const detail = await c.query(api.public.orders.getOrder, { orderId: placed.orderId });
    expect(detail.status).toBe("confirmed");
    expect(detail.cancellable).toBe(true);
  });

  it("refuses a card order instead of parking it at pending_payment", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2000 });

    await expect(
      c.mutation(api.public.orders.placeOrder, {
        ...shipping,
        paymentMethod: "card",
        idempotencyKey: "card-1",
      }),
    ).rejects.toThrow();

    expect((await t.run((ctx) => ctx.db.query("orders").collect())).length).toBe(0);
    // The cart is untouched, so the customer can still check out with COD.
    expect((await c.query(api.public.cart.getCart, {})).items.length).toBe(1);
  });

  it("reports a real itemCount on the order list", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 3, now: 2000 });
    await c.mutation(api.public.orders.placeOrder, { ...shipping, idempotencyKey: "count-1" });

    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 2, now: 2100 });
    await c.mutation(api.public.orders.placeOrder, { ...shipping, idempotencyKey: "count-2", now: 2100 });

    const orders = await c.query(api.public.orders.listMyOrders, {});
    expect(orders.map((o) => o.itemCount).sort()).toEqual([2, 3]);
  });
});

describe("transitionOrderStatus", () => {
  it("rejects an anonymous caller", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2000 });
    const placed = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "guard-1",
    });

    await expect(
      t
        .withIdentity({})
        .mutation(api.admin.orders.transitionOrderStatus, {
          orderId: placed.orderId,
          to: "preparing",
          now: 3000,
        }),
    ).rejects.toThrow();
  });

  it("rejects an authenticated non-admin", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2000 });
    const placed = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "guard-2",
    });

    await expect(
      t.withIdentity({ subject: ATTACKER }).mutation(api.admin.orders.transitionOrderStatus, {
        orderId: placed.orderId,
        to: "preparing",
        now: 3000,
      }),
    ).rejects.toThrow();
  });

  it("rejects an unknown status", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2000 });
    const placed = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "guard-3",
    });

    await expect(
      t.withIdentity({ subject: ADMIN }).mutation(api.admin.orders.transitionOrderStatus, {
        orderId: placed.orderId,
        to: "teleported",
        now: 3000,
      }),
    ).rejects.toThrow();
  });

  it("walks a confirmed order through to delivered", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 2, now: 2000 });
    const placed = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "happy-1",
    });
    const a = t.withIdentity({ subject: ADMIN });

    const preparing = await a.mutation(api.admin.orders.transitionOrderStatus, {
      orderId: placed.orderId,
      to: "preparing",
      now: 3000,
    });
    expect(preparing.from).toBe("confirmed");
    expect(preparing.to).toBe("preparing");

    const dispatched = await a.mutation(api.admin.orders.transitionOrderStatus, {
      orderId: placed.orderId,
      to: "out_for_delivery",
      now: 3100,
    });
    expect(dispatched.committedLines).toBe(1);

    const delivered = await a.mutation(api.admin.orders.transitionOrderStatus, {
      orderId: placed.orderId,
      to: "delivered",
      now: 3200,
    });
    expect(delivered.from).toBe("out_for_delivery");

    const stored = await t.run((ctx) => ctx.db.get(placed.orderId));
    expect(stored?.status).toBe("delivered");
    // COD: authorised at dispatch because the courier collects on delivery.
    expect(stored?.paymentStatus).toBe("authorized");

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLogs")
        .withIndex("by_entity_createdAt", (q) => q.eq("entity", "orders"))
        .collect(),
    );
    expect(audits.length).toBe(3);
  });

  it("rejects a skipped step", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2000 });
    const placed = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "skip-1",
    });

    // confirmed -> out_for_delivery is not an edge in the adjacency map.
    await expect(
      t
        .withIdentity({ subject: ADMIN })
        .mutation(api.admin.orders.transitionOrderStatus, {
          orderId: placed.orderId,
          to: "out_for_delivery",
          now: 3000,
        }),
    ).rejects.toThrow();

    expect((await t.run((ctx) => ctx.db.get(placed.orderId)))?.status).toBe("confirmed");
  });

  it("rejects a status regression", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2000 });
    const placed = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "regress-1",
    });
    const a = t.withIdentity({ subject: ADMIN });

    await a.mutation(api.admin.orders.transitionOrderStatus, {
      orderId: placed.orderId,
      to: "preparing",
      now: 3000,
    });

    await expect(
      a.mutation(api.admin.orders.transitionOrderStatus, {
        orderId: placed.orderId,
        to: "confirmed",
        now: 3100,
      }),
    ).rejects.toThrow();
  });

  it("treats a repeat of the current status as a no-op, not an error", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2000 });
    const placed = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "noop-1",
    });

    const result = await t
      .withIdentity({ subject: ADMIN })
      .mutation(api.admin.orders.transitionOrderStatus, {
        orderId: placed.orderId,
        to: "confirmed",
        now: 3000,
      });

    expect(result.changed).toBe(false);
  });

  it("exposes the allowed transitions for an order", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2000 });
    const placed = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "allowed-1",
    });

    const allowed = await t
      .withIdentity({ subject: ADMIN })
      .query(api.admin.orders.listAllowedTransitions, { orderId: placed.orderId });
    expect(allowed.status).toBe("confirmed");
    expect([...allowed.allowed].sort()).toEqual(["cancelled", "preparing"]);
  });
});

describe("dispatch commits stock exactly once", () => {
  it("converts a reservation into a decrement of onHand and reserved", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 3, now: 2000 });
    const placed = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "commit-1",
    });

    const beforeDispatch = await readLevel(t, variantId);
    expect(beforeDispatch?.onHand).toBe(10);
    expect(beforeDispatch?.reserved).toBe(3);

    const a = t.withIdentity({ subject: ADMIN });
    await a.mutation(api.admin.orders.transitionOrderStatus, {
      orderId: placed.orderId,
      to: "preparing",
      now: 3000,
    });
    await a.mutation(api.admin.orders.transitionOrderStatus, {
      orderId: placed.orderId,
      to: "out_for_delivery",
      now: 3100,
    });

    const afterDispatch = await readLevel(t, variantId);
    expect(afterDispatch?.onHand).toBe(7);
    expect(afterDispatch?.reserved).toBe(0);
    // available = onHand - reserved is unchanged by a dispatch.
    expect((afterDispatch?.onHand ?? 0) - (afterDispatch?.reserved ?? 0)).toBe(7);

    const commits = await t.run((ctx) =>
      ctx.db
        .query("inventoryMovements")
        .withIndex("by_order_variant_reason", (q) =>
          q.eq("orderId", placed.orderId).eq("variantId", variantId).eq("reason", "commit"),
        )
        .collect(),
    );
    expect(commits.length).toBe(1);
    expect(commits[0]?.onHandDelta).toBe(-3);
    expect(commits[0]?.reservedDelta).toBe(-3);
  });

  it("writes one commit movement under concurrent dispatch attempts", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 2, now: 2000 });
    const placed = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "commit-race",
    });
    await t
      .withIdentity({ subject: ADMIN })
      .mutation(api.admin.orders.transitionOrderStatus, {
        orderId: placed.orderId,
        to: "preparing",
        now: 3000,
      });

    // Promise.allSettled on purpose: Promise.all rejects on the first failure
    // and would hide exactly the race this test exists to detect.
    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        t.withIdentity({ subject: ADMIN }).mutation(api.admin.orders.transitionOrderStatus, {
          orderId: placed.orderId,
          to: "out_for_delivery",
          now: 3100,
        }),
      ),
    );

    const fulfilled = attempts.filter((a) => a.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThan(0);

    const commits = await t.run((ctx) =>
      ctx.db
        .query("inventoryMovements")
        .withIndex("by_order_variant_reason", (q) =>
          q.eq("orderId", placed.orderId).eq("variantId", variantId).eq("reason", "commit"),
        )
        .collect(),
    );
    expect(commits.length).toBe(1);

    const level = await readLevel(t, variantId);
    expect(level?.onHand).toBe(8);
    expect(level?.reserved).toBe(0);
    expect((level?.onHand ?? 0) - (level?.reserved ?? 0)).toBeGreaterThanOrEqual(0);
  });

  it("does not resurrect a cancelled order", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 1, now: 2000 });
    const placed = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "cancel-then-dispatch",
    });

    await c.mutation(api.public.orders.cancelOrder, { orderId: placed.orderId, now: 3000 });

    await expect(
      t
        .withIdentity({ subject: ADMIN })
        .mutation(api.admin.orders.transitionOrderStatus, {
          orderId: placed.orderId,
          to: "preparing",
          now: 3100,
        }),
    ).rejects.toThrow();

    const level = await t.run(async (ctx) =>
      ctx.db
        .query("inventoryLevels")
        .withIndex("by_variant", (q) => q.eq("variantId", variantId))
        .unique(),
    );
    expect(level?.reserved).toBe(0);
    expect(level?.onHand).toBe(10);
  });
});

describe("admin cancellation releases exactly once", () => {
  it("releases once even when admin and customer cancel at the same time", async () => {
    const t = backend();
    const { variantId } = await seed(t, 10);
    const c = t.withIdentity({ subject: CUSTOMER });
    await c.mutation(api.public.cart.addToCart, { variantId, quantity: 4, now: 2000 });
    const placed = await c.mutation(api.public.orders.placeOrder, {
      ...shipping,
      idempotencyKey: "dual-cancel",
    });

    await Promise.allSettled([
      c.mutation(api.public.orders.cancelOrder, { orderId: placed.orderId, now: 3000 }),
      t
        .withIdentity({ subject: ADMIN })
        .mutation(api.admin.orders.transitionOrderStatus, {
          orderId: placed.orderId,
          to: "cancelled",
          now: 3000,
        }),
    ]);

    const releases = await t.run((ctx) =>
      ctx.db
        .query("inventoryMovements")
        .withIndex("by_order_variant_reason", (q) =>
          q.eq("orderId", placed.orderId).eq("variantId", variantId).eq("reason", "release"),
        )
        .collect(),
    );
    expect(releases.length).toBe(1);

    const level = await t.run(async (ctx) =>
      ctx.db
        .query("inventoryLevels")
        .withIndex("by_variant", (q) => q.eq("variantId", variantId))
        .unique(),
    );
    expect(level?.reserved).toBe(0);
    expect(level?.onHand).toBe(10);

    const stored = await t.run((ctx) => ctx.db.get(placed.orderId));
    expect(stored?.status).toBe("cancelled");
  });
});