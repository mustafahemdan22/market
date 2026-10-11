import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

const ADMIN = "user_admin_001";

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

function newTest() {
  return convexTest({ schema, modules }).withIdentity({ subject: ADMIN });
}

async function seedCategory(t: ReturnType<typeof newTest>, name = "Fresh Produce") {
  return t.run(async (ctx) =>
    ctx.db.insert("categories", {
      nameEn: name,
      nameAr: "منتجات طازجة",
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      depth: 0,
      sortOrder: 0,
      isActive: true,
      createdAt: 1000,
      updatedAt: 1000,
    }),
  );
}

const validProduct = {
  nameEn: "Fuji Apples",
  nameAr: "تفاح فوجي",
  descriptionEn: "Crisp red apples",
  descriptionAr: "تفاح أحمر مقرمش",
  unitLabel: "per 1 kg",
  sku: "PRD-apple-fuji-001",
  variantNameEn: "1 kg",
  variantNameAr: "١ كجم",
  priceMinor: 1250,
  stock: 40,
  now: 1000,
};

describe("createProduct", () => {
  it("creates the product, its first variant and its stock level atomically", async () => {
    const t = newTest();
    const categoryId = await seedCategory(t);

    const { productId, variantId } = await t.mutation(api.admin.products.createProduct, {
      ...validProduct,
      categoryId,
    });

    const state = await t.run(async (ctx) => {
      const product = await ctx.db.get(productId);
      const variant = await ctx.db.get(variantId);
      const levels = await ctx.db
        .query("inventoryLevels")
        .withIndex("by_variant", (q) => q.eq("variantId", variantId))
        .collect();
      const movements = await ctx.db.query("inventoryMovements").collect();
      return { product, variant, levels, movements };
    });

    expect(state.product?.slug).toBe("fuji-apples");
    expect(state.product?.priceMinor).toBe(1250);
    expect(state.variant?.isDefault).toBe(true);
    expect(state.levels).toHaveLength(1);
    expect(state.levels[0]?.onHand).toBe(40);
    expect(state.levels[0]?.reserved).toBe(0);
    // Initial stock is always ledgered.
    expect(state.movements).toHaveLength(1);
    expect(state.movements[0]?.reason).toBe("restock");
    expect(state.movements[0]?.onHandDelta).toBe(40);
  });

  it("rejects a fractional price instead of rounding it", async () => {
    const t = newTest();
    const categoryId = await seedCategory(t);

    await expect(
      t.mutation(api.admin.products.createProduct, {
        ...validProduct,
        priceMinor: 1250.5,
        categoryId,
      }),
    ).rejects.toThrow();
  });

  it("rejects a zero or negative price", async () => {
    const t = newTest();
    const categoryId = await seedCategory(t);

    for (const priceMinor of [0, -1]) {
      await expect(
        t.mutation(api.admin.products.createProduct, {
          ...validProduct,
          priceMinor,
          categoryId,
        }),
      ).rejects.toThrow();
    }
  });

  it("rejects negative stock", async () => {
    const t = newTest();
    const categoryId = await seedCategory(t);

    await expect(
      t.mutation(api.admin.products.createProduct, {
        ...validProduct,
        stock: -5,
        categoryId,
      }),
    ).rejects.toThrow();
  });

  it("rejects a duplicate SKU after normalisation", async () => {
    const t = newTest();
    const categoryId = await seedCategory(t);
    await t.mutation(api.admin.products.createProduct, { ...validProduct, categoryId });

    // Different case + whitespace must collide, because normalisation runs
    // before the uniqueness read.
    await expect(
      t.mutation(api.admin.products.createProduct, {
        ...validProduct,
        nameEn: "Another Product",
        nameAr: "منتج آخر",
        sku: "prd-apple-fuji-001",
        categoryId,
      }),
    ).rejects.toThrow();
  });

  it("allocates a unique slug for a duplicate name", async () => {
    const t = newTest();
    const categoryId = await seedCategory(t);
    await t.mutation(api.admin.products.createProduct, {
      ...validProduct,
      sku: "PRD-0002",
      categoryId,
    });

    const second = await t.mutation(api.admin.products.createProduct, {
      ...validProduct,
      sku: "PRD-0003",
      categoryId,
    });

    const product = await t.run((ctx) => ctx.db.get(second.productId));
    expect(product?.slug).toBe("fuji-apples-2");
  });

  it("rejects a product in a disabled category", async () => {
    const t = newTest();
    const categoryId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("categories", {
        nameEn: "Archived",
        nameAr: "مؤرشف",
        slug: "archived",
        depth: 0,
        sortOrder: 0,
        isActive: false,
        createdAt: 1,
        updatedAt: 1,
      });
      return id;
    });

    await expect(
      t.mutation(api.admin.products.createProduct, { ...validProduct, categoryId }),
    ).rejects.toThrow();
  });
});

describe("updateProductPrice", () => {
  async function seedProduct(t: ReturnType<typeof newTest>) {
    const categoryId = await seedCategory(t);
    const created = await t.mutation(api.admin.products.createProduct, {
      ...validProduct,
      categoryId,
    });
    return { ...created, categoryId };
  }

  it("writes the variant price and recomputes the product cache", async () => {
    const t = newTest();
    const { productId, variantId } = await seedProduct(t);

    const result = await t.mutation(api.admin.products.updateProductPrice, {
      variantId,
      priceMinor: 2000,
      now: 2000,
    });

    expect(result.priceMinor).toBe(2000);
    expect(result.productPriceMinor).toBe(2000);

    const product = await t.run((ctx) => ctx.db.get(productId));
    const variant = await t.run((ctx) => ctx.db.get(variantId));
    // The display cache must never drift from the authoritative variant price.
    expect(product?.priceMinor).toBe(2000);
    expect(variant?.priceMinor).toBe(2000);
  });

  it("rejects a non-positive price", async () => {
    const t = newTest();
    const { variantId } = await seedProduct(t);

    await expect(
      t.mutation(api.admin.products.updateProductPrice, { variantId, priceMinor: 0, now: 2000 }),
    ).rejects.toThrow();
  });

  it("rejects a compare-at price that is not above the selling price", async () => {
    const t = newTest();
    const { variantId } = await seedProduct(t);

    await expect(
      t.mutation(api.admin.products.updateProductPrice, {
        variantId,
        priceMinor: 2000,
        compareAtPriceMinor: 1500,
        now: 2000,
      }),
    ).rejects.toThrow();
  });

  it("is admin-only", async () => {
    const t = convexTest({ schema, modules }).withIdentity({ subject: "user_customer_001" });
    const admin = newTest();
    const categoryId = await seedCategory(admin);
    const { variantId } = await admin.mutation(api.admin.products.createProduct, {
      ...validProduct,
      categoryId,
    });

    await expect(
      t.mutation(api.admin.products.updateProductPrice, { variantId, priceMinor: 2000, now: 2000 }),
    ).rejects.toThrow();
  });
});

describe("updateProductStock", () => {
  async function seedProduct(t: ReturnType<typeof newTest>) {
    const categoryId = await seedCategory(t);
    return t.mutation(api.admin.products.createProduct, { ...validProduct, categoryId });
  }

  it("sets stock and writes a matching ledger row", async () => {
    const t = newTest();
    const { variantId } = await seedProduct(t);

    const result = await t.mutation(api.admin.products.updateProductStock, {
      variantId,
      onHand: 12,
      reason: "adjustment",
      note: "Stock count correction",
      now: 2000,
    });

    expect(result.onHand).toBe(12);
    expect(result.available).toBe(12);

    const movements = await t.run((ctx) => ctx.db.query("inventoryMovements").collect());
    const latest = movements.at(-1);
    expect(latest?.onHandDelta).toBe(12 - 40);
    expect(latest?.reason).toBe("adjustment");
    expect(latest?.actorSubject).toBe(ADMIN);
  });

  it("rejects negative stock", async () => {
    const t = newTest();
    const { variantId } = await seedProduct(t);

    await expect(
      t.mutation(api.admin.products.updateProductStock, { variantId, onHand: -1, now: 2000 }),
    ).rejects.toThrow();
  });

  it("refuses to set stock below the amount already reserved", async () => {
    const t = newTest();
    const { variantId } = await seedProduct(t);

    // Simulate an open order holding 10 units.
    await t.run(async (ctx) => {
      const level = await ctx.db
        .query("inventoryLevels")
        .withIndex("by_variant", (q) => q.eq("variantId", variantId))
        .unique();
      await ctx.db.patch(level!._id, { reserved: 10 });
    });

    await expect(
      t.mutation(api.admin.products.updateProductStock, { variantId, onHand: 5, now: 2000 }),
    ).rejects.toThrow();
  });

  it("does not write a movement when the value is unchanged", async () => {
    const t = newTest();
    const { variantId } = await seedProduct(t);
    const before = await t.run((ctx) => ctx.db.query("inventoryMovements").collect());

    await t.mutation(api.admin.products.updateProductStock, {
      variantId,
      onHand: 40,
      now: 2000,
    });

    const after = await t.run((ctx) => ctx.db.query("inventoryMovements").collect());
    expect(after).toHaveLength(before.length);
  });

  it("is admin-only", async () => {
    const admin = newTest();
    const categoryId = await seedCategory(admin);
    const { variantId } = await admin.mutation(api.admin.products.createProduct, {
      ...validProduct,
      categoryId,
    });

    const t = convexTest({ schema, modules }).withIdentity({ subject: "user_customer_001" });
    await expect(
      t.mutation(api.admin.products.updateProductStock, { variantId, onHand: 1, now: 2000 }),
    ).rejects.toThrow();
  });
});

describe("updateProductStatus", () => {
  async function seedProduct(t: ReturnType<typeof newTest>) {
    const categoryId = await seedCategory(t);
    return t.mutation(api.admin.products.createProduct, { ...validProduct, categoryId });
  }

  it("changes status and records an audit row", async () => {
    const t = newTest();
    const { productId } = await seedProduct(t);

    const result = await t.mutation(api.admin.products.updateProductStatus, {
      productId,
      status: "archived",
      now: 2000,
    });
    expect(result.status).toBe("archived");

    const product = await t.run((ctx) => ctx.db.get(productId));
    expect(product?.status).toBe("archived");
    expect(product?.updatedAt).toBe(2000);

    const audits = await t.run((ctx) => ctx.db.query("auditLogs").collect());
    expect(audits.some((a) => a.action === "product.status.update")).toBe(true);
  });

  it("rejects an unknown status value", async () => {
    const t = newTest();
    const { productId } = await seedProduct(t);

    await expect(
      t.mutation(api.admin.products.updateProductStatus, {
        productId,
        status: "deleted",
        now: 2000,
      }),
    ).rejects.toThrow();
  });

  it("is admin-only", async () => {
    const admin = newTest();
    const categoryId = await seedCategory(admin);
    const { productId } = await admin.mutation(api.admin.products.createProduct, {
      ...validProduct,
      categoryId,
    });

    const t = convexTest({ schema, modules }).withIdentity({ subject: "user_customer_001" });
    await expect(
      t.mutation(api.admin.products.updateProductStatus, {
        productId,
        status: "archived",
        now: 2000,
      }),
    ).rejects.toThrow();
  });
});

describe("listProducts", () => {
  it("is admin-only and rejects anonymous callers", async () => {
    const t = convexTest({ schema, modules });
    await expect(t.query(api.admin.products.listProducts, {})).rejects.toThrow();
  });

  it("returns created products for an admin", async () => {
    const t = newTest();
    const categoryId = await seedCategory(t);
    await t.mutation(api.admin.products.createProduct, { ...validProduct, categoryId });

    const rows = await t.query(api.admin.products.listProducts, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]?.nameEn).toBe("Fuji Apples");
    expect(rows[0]?.imagePublicId).toBeNull();
  });
});
