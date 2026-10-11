import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { MAX_UPLOAD_BYTES, toSignaturePayload } from "./lib/uploadParams";

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

async function seedProduct(t: ReturnType<typeof newTest>) {
  const categoryId = await t.run(async (ctx) =>
    ctx.db.insert("categories", {
      nameEn: "Produce",
      nameAr: "منتجات",
      slug: "produce",
      depth: 0,
      sortOrder: 0,
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  return t.mutation(api.admin.products.createProduct, {
    nameEn: "Fuji Apples",
    nameAr: "تفاح فوجي",
    descriptionEn: "Crisp",
    descriptionAr: "مقرمش",
    unitLabel: "per 1 kg",
    sku: "PRD-0001",
    variantNameEn: "1 kg",
    variantNameAr: "١ كجم",
    priceMinor: 1250,
    stock: 10,
    now: 1000,
    categoryId,
  });
}

const validImage = {
  cloudinaryPublicId: "grocery/products/apple-01",
  format: "jpg",
  width: 800,
  height: 600,
  bytes: 120_000,
};

describe("attachProductImage", () => {
  it("stores validated metadata and records the uploader", async () => {
    const t = newTest();
    const { productId } = await seedProduct(t);

    const { imageId } = await t.mutation(api.admin.productImages.attachProductImage, {
      ...validImage,
      productId,
      now: 2000,
    });

    const image = await t.run((ctx) => ctx.db.get(imageId));
    expect(image?.cloudinaryPublicId).toBe("grocery/products/apple-01");
    expect(image?.format).toBe("jpg");
    expect(image?.bytes).toBe(120_000);
    expect(image?.uploadedBySubject).toBe(ADMIN);
    // First image on a product becomes the primary automatically.
    expect(image?.isPrimary).toBe(true);
  });

  it("rejects a format outside the signed allowlist", async () => {
    const t = newTest();
    const { productId } = await seedProduct(t);

    for (const format of ["svg", "gif", "exe", "html"]) {
      await expect(
        t.mutation(api.admin.productImages.attachProductImage, {
          ...validImage,
          format,
          productId,
          now: 2000,
        }),
      ).rejects.toThrow();
    }
  });

  it("rejects a file larger than the signed size cap", async () => {
    const t = newTest();
    const { productId } = await seedProduct(t);

    await expect(
      t.mutation(api.admin.productImages.attachProductImage, {
        ...validImage,
        bytes: MAX_UPLOAD_BYTES + 1,
        productId,
        now: 2000,
      }),
    ).rejects.toThrow();
  });

  it("rejects non-positive or implausible dimensions", async () => {
    const t = newTest();
    const { productId } = await seedProduct(t);

    for (const dims of [
      { width: 0, height: 600 },
      { width: 800, height: -1 },
      { width: 800.5, height: 600 },
      { width: 99_999, height: 600 },
    ]) {
      await expect(
        t.mutation(api.admin.productImages.attachProductImage, {
          ...validImage,
          ...dims,
          productId,
          now: 2000,
        }),
      ).rejects.toThrow();
    }
  });

  it("rejects a public id that tries to escape the upload folder", async () => {
    const t = newTest();
    const { productId } = await seedProduct(t);

    for (const publicId of ["/etc/passwd", "grocery/../../escape", "bad id!"]) {
      await expect(
        t.mutation(api.admin.productImages.attachProductImage, {
          ...validImage,
          cloudinaryPublicId: publicId,
          productId,
          now: 2000,
        }),
      ).rejects.toThrow();
    }
  });

  it("rejects the same public id twice on one product", async () => {
    const t = newTest();
    const { productId } = await seedProduct(t);
    await t.mutation(api.admin.productImages.attachProductImage, {
      ...validImage,
      productId,
      now: 2000,
    });

    await expect(
      t.mutation(api.admin.productImages.attachProductImage, {
        ...validImage,
        productId,
        now: 2100,
      }),
    ).rejects.toThrow();
  });

  it("keeps exactly one primary image when a new primary is set", async () => {
    const t = newTest();
    const { productId } = await seedProduct(t);
    const first = await t.mutation(api.admin.productImages.attachProductImage, {
      ...validImage,
      productId,
      now: 2000,
    });
    const second = await t.mutation(api.admin.productImages.attachProductImage, {
      ...validImage,
      cloudinaryPublicId: "grocery/products/apple-02",
      isPrimary: true,
      productId,
      now: 2100,
    });

    const images = await t.run((ctx) =>
      ctx.db
        .query("productImages")
        .withIndex("by_product_sortOrder", (q) => q.eq("productId", productId))
        .collect(),
    );
    expect(images.filter((i) => i.isPrimary)).toHaveLength(1);
    expect(images.find((i) => i.isPrimary)?._id).toBe(second.imageId);
    expect(images.find((i) => i._id === first.imageId)?.isPrimary).toBe(false);
  });

  it("is admin-only", async () => {
    const admin = newTest();
    const { productId } = await seedProduct(admin);

    const t = convexTest({ schema, modules }).withIdentity({ subject: CUSTOMER });
    await expect(
      t.mutation(api.admin.productImages.attachProductImage, {
        ...validImage,
        productId,
        now: 2000,
      }),
    ).rejects.toThrow();
  });
});

describe("removeProductImage", () => {
  it("promotes another image when the primary is removed", async () => {
    const t = newTest();
    const { productId } = await seedProduct(t);
    const first = await t.mutation(api.admin.productImages.attachProductImage, {
      ...validImage,
      productId,
      now: 2000,
    });
    await t.mutation(api.admin.productImages.attachProductImage, {
      ...validImage,
      cloudinaryPublicId: "grocery/products/apple-02",
      productId,
      now: 2100,
    });

    await t.mutation(api.admin.productImages.removeProductImage, {
      imageId: first.imageId,
      now: 2200,
    });

    const images = await t.run((ctx) =>
      ctx.db
        .query("productImages")
        .withIndex("by_product_sortOrder", (q) => q.eq("productId", productId))
        .collect(),
    );
    expect(images.filter((i) => i.isPrimary)).toHaveLength(1);
  });

  it("is admin-only", async () => {
    const admin = newTest();
    const { productId } = await seedProduct(admin);
    const { imageId } = await admin.mutation(api.admin.productImages.attachProductImage, {
      ...validImage,
      productId,
      now: 2000,
    });

    const t = convexTest({ schema, modules }).withIdentity({ subject: CUSTOMER });
    await expect(
      t.mutation(api.admin.productImages.removeProductImage, { imageId, now: 2200 }),
    ).rejects.toThrow();
  });
});

describe("Cloudinary signature payload", () => {
  it("sorts parameters alphabetically, as Cloudinary requires", () => {
    const params = {
      timestamp: 1_700_000_000,
      folder: "grocery/products",
      allowed_formats: "jpg,jpeg,png,webp",
      max_file_size: 5_242_880,
      eager: "c_limit",
      tags: "grocery_product",
      context: "product_id=abc",
    };

    expect(toSignaturePayload(params)).toBe(
      [
        "allowed_formats=jpg,jpeg,png,webp",
        "context=product_id=abc",
        "eager=c_limit",
        "folder=grocery/products",
        "max_file_size=5242880",
        "tags=grocery_product",
        "timestamp=1700000000",
      ].join("&"),
    );
  });

  it("excludes the secret, file, api_key and cloud_name from the signed payload", () => {
    const params = {
      timestamp: 1_700_000_000,
      folder: "grocery/products",
      allowed_formats: "jpg",
      max_file_size: 1,
      eager: "",
      tags: "",
      context: "",
    };
    const names = toSignaturePayload(params)
      .split("&")
      .map((pair) => pair.split("=")[0]);

    // Cloudinary excludes these from the signature base: the file itself is the
    // payload, and api_key / cloud_name / api_secret are never hashed in.
    expect(names).not.toContain("file");
    expect(names).not.toContain("cloud_name");
    expect(names).not.toContain("api_key");
    expect(names).not.toContain("api_secret");
    expect(toSignaturePayload(params)).not.toContain("api_secret=");
  });
});
