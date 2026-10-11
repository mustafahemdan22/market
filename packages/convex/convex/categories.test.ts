import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

const ADMIN = "user_admin_001";
const CUSTOMER = "user_customer_001";

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

const productArgs = {
  nameEn: "Fuji Apples",
  nameAr: "تفاح فوجي",
  descriptionEn: "Crisp red apples",
  descriptionAr: "تفاح أحمر مقرمش",
  unitLabel: "per 1 kg",
  sku: "PRD-0001",
  variantNameEn: "1 kg",
  variantNameAr: "١ كجم",
  priceMinor: 1250,
  stock: 10,
  now: 1000,
};

describe("createCategory", () => {
  it("creates an active category", async () => {
    const t = newTest();
    const { categoryId } = await t.mutation(api.admin.categories.createCategory, {
      nameEn: "Dairy",
      nameAr: "ألبان",
      now: 1000,
    });

    const category = await t.run((ctx) => ctx.db.get(categoryId));
    expect(category?.slug).toBe("dairy");
    expect(category?.isActive).toBe(true);
    expect(category?.updatedBySubject).toBe(ADMIN);
  });

  it("allocates a unique slug on duplicate names", async () => {
    const t = newTest();
    await t.mutation(api.admin.categories.createCategory, {
      nameEn: "Dairy",
      nameAr: "ألبان",
      now: 1000,
    });
    const second = await t.mutation(api.admin.categories.createCategory, {
      nameEn: "Dairy",
      nameAr: "ألبان",
      now: 1000,
    });

    const category = await t.run((ctx) => ctx.db.get(second.categoryId));
    expect(category?.slug).toBe("dairy-2");
  });

  it("rejects an empty name", async () => {
    const t = newTest();
    await expect(
      t.mutation(api.admin.categories.createCategory, {
        nameEn: "   ",
        nameAr: "ألبان",
        now: 1000,
      }),
    ).rejects.toThrow();
  });

  it("is admin-only", async () => {
    const t = convexTest({ schema, modules }).withIdentity({ subject: CUSTOMER });
    await expect(
      t.mutation(api.admin.categories.createCategory, {
        nameEn: "Dairy",
        nameAr: "ألبان",
        now: 1000,
      }),
    ).rejects.toThrow();
  });
});

describe("setCategoryActive", () => {
  it("disables a category that has no active products", async () => {
    const t = newTest();
    const { categoryId } = await t.mutation(api.admin.categories.createCategory, {
      nameEn: "Dairy",
      nameAr: "ألبان",
      now: 1000,
    });

    const result = await t.mutation(api.admin.categories.setCategoryActive, {
      categoryId,
      isActive: false,
      now: 2000,
    });
    expect(result.isActive).toBe(false);
  });

  it("refuses to disable a category that still has active products", async () => {
    const t = newTest();
    const { categoryId } = await t.mutation(api.admin.categories.createCategory, {
      nameEn: "Dairy",
      nameAr: "ألبان",
      now: 1000,
    });
    await t.mutation(api.admin.products.createProduct, { ...productArgs, categoryId });

    await expect(
      t.mutation(api.admin.categories.setCategoryActive, {
        categoryId,
        isActive: false,
        now: 2000,
      }),
    ).rejects.toThrow();
  });

  it("allows disabling once the products are archived", async () => {
    const t = newTest();
    const { categoryId } = await t.mutation(api.admin.categories.createCategory, {
      nameEn: "Dairy",
      nameAr: "ألبان",
      now: 1000,
    });
    const { productId } = await t.mutation(api.admin.products.createProduct, {
      ...productArgs,
      categoryId,
    });
    await t.mutation(api.admin.products.updateProductStatus, {
      productId,
      status: "archived",
      now: 1500,
    });

    const result = await t.mutation(api.admin.categories.setCategoryActive, {
      categoryId,
      isActive: false,
      now: 2000,
    });
    expect(result.isActive).toBe(false);
  });

  it("is admin-only", async () => {
    const admin = newTest();
    const { categoryId } = await admin.mutation(api.admin.categories.createCategory, {
      nameEn: "Dairy",
      nameAr: "ألبان",
      now: 1000,
    });

    const t = convexTest({ schema, modules }).withIdentity({ subject: CUSTOMER });
    await expect(
      t.mutation(api.admin.categories.setCategoryActive, {
        categoryId,
        isActive: false,
        now: 2000,
      }),
    ).rejects.toThrow();
  });
});

describe("listCategories", () => {
  it("is admin-only", async () => {
    const t = convexTest({ schema, modules });
    await expect(t.query(api.admin.categories.listCategories, {})).rejects.toThrow();
  });

  it("reports the product count per category", async () => {
    const t = newTest();
    const { categoryId } = await t.mutation(api.admin.categories.createCategory, {
      nameEn: "Dairy",
      nameAr: "ألبان",
      now: 1000,
    });
    await t.mutation(api.admin.products.createProduct, { ...productArgs, categoryId });

    const rows = await t.query(api.admin.categories.listCategories, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]?.productCount).toBe(1);
  });
});
