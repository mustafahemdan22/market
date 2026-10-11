import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

/**
 * Authorization is driven by PANDAMA_ADMIN_SUBJECTS, a server-only environment
 * variable. Each test sets it explicitly and restores it afterwards so no test
 * can accidentally pass because another left the allowlist populated.
 */
const ADMIN_SUBJECT = "user_admin_001";
const CUSTOMER_SUBJECT = "user_customer_001";

function withAllowlist(subjects: string | undefined): void {
  if (subjects === undefined) {
    delete process.env.PANDAMA_ADMIN_SUBJECTS;
  } else {
    process.env.PANDAMA_ADMIN_SUBJECTS = subjects;
  }
}

function newTest() {
  return convexTest({ schema, modules });
}

async function seedCategory(t: ReturnType<typeof newTest>) {
  return t.run(async (ctx) => {
    const id = await ctx.db.insert("categories", {
      nameEn: "Fresh Produce",
      nameAr: "منتجات طازجة",
      slug: "fresh-produce",
      depth: 0,
      sortOrder: 0,
      isActive: true,
      createdAt: 1000,
      updatedAt: 1000,
    });
    return id;
  });
}

const baseProductArgs = {
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

describe("requireAdmin authorization", () => {
  it("rejects an anonymous caller", async () => {
    withAllowlist(ADMIN_SUBJECT);
    const t = newTest();
    const categoryId = await seedCategory(t);

    await expect(
      t.mutation(api.admin.products.createProduct, { ...baseProductArgs, categoryId }),
    ).rejects.toThrow();
  });

  it("rejects an authenticated non-admin", async () => {
    withAllowlist(ADMIN_SUBJECT);
    const t = newTest();
    const categoryId = await seedCategory(t);

    await expect(
      t.withIdentity({ subject: CUSTOMER_SUBJECT }).mutation(api.admin.products.createProduct, {
        ...baseProductArgs,
        categoryId,
      }),
    ).rejects.toThrow();
  });

  it("fails closed when the allowlist is unset", async () => {
    withAllowlist(undefined);
    const t = newTest();
    const categoryId = await seedCategory(t);

    await expect(
      t.withIdentity({ subject: ADMIN_SUBJECT }).mutation(api.admin.products.createProduct, {
        ...baseProductArgs,
        categoryId,
      }),
    ).rejects.toThrow();
  });

  it("allows a listed admin", async () => {
    withAllowlist(`someone_else,${ADMIN_SUBJECT}`);
    const t = newTest();
    const categoryId = await seedCategory(t);

    const result = await t
      .withIdentity({ subject: ADMIN_SUBJECT })
      .mutation(api.admin.products.createProduct, { ...baseProductArgs, categoryId });

    expect(result.productId).toBeTruthy();
    expect(result.variantId).toBeTruthy();
  });
});
