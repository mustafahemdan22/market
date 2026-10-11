import { describe, expect, it } from "vitest";
import { cloudinaryImageUrl, createConvexCatalogRepository } from "./convexCatalogRepository";

const CLOUD = "dfq1xxerr";

/** Mock client method that resolves a fixed value. */
const resolved =
  <T>(value: T) =>
  (): Promise<T> =>
    Promise.resolve(value);

const rawProduct = {
  _id: "p1",
  slug: "fuji-apples",
  nameEn: "Fuji Apples",
  nameAr: "تفاح فوجي",
  descriptionEn: "Crisp red apples",
  descriptionAr: "تفاح أحمر",
  brand: "Panda",
  unitLabel: "per 1 kg",
  priceMinor: 1250,
  compareAtPriceMinor: 1500,
  categorySlug: "produce",
  imagePublicId: "grocery/products/apple",
  available: true,
  variants: [
    {
      _id: "v1",
      nameEn: "1 kg",
      nameAr: "١ كجم",
      sku: "PRD-0001",
      priceMinor: 1250,
      compareAtPriceMinor: undefined,
      isDefault: true,
      available: 4,
    },
  ],
};

function repo() {
  return createConvexCatalogRepository(
    {
      listCategories: resolved([
        { slug: "produce", nameEn: "Produce", nameAr: "منتجات", productCount: 1 },
      ]),
      listProducts: resolved([rawProduct]),
      getProductBySlug: resolved(rawProduct),
    },
    CLOUD,
  );
}

describe("cloudinaryImageUrl", () => {
  it("derives a transformed delivery URL from the stored public id", () => {
    expect(cloudinaryImageUrl(CLOUD, "grocery/products/apple", 400)).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,w_400/grocery/products/apple`,
    );
  });

  it("emits no URL when the cloud name or public id is missing", () => {
    // A malformed URL would render as a broken image presented as real content.
    expect(cloudinaryImageUrl("", "grocery/products/apple")).toBe("");
    expect(cloudinaryImageUrl(CLOUD, "")).toBe("");
  });
});

describe("Convex product adapter", () => {
  it("passes price minor units through unchanged (no VAT line added)", async () => {
    const product = await repo().getProduct("fuji-apples");
    expect(product?.priceMinor).toBe(1250);
    expect(product).not.toHaveProperty("taxMinor");
    expect(product).not.toHaveProperty("totalMinor");
  });

  it("derives a discount only when compare-at exceeds the selling price", async () => {
    const product = await repo().getProduct("fuji-apples");
    expect(product?.discountPercent).toBe(17); // (1500 - 1250) / 1500
  });

  it("omits the discount when compare-at is absent", async () => {
    const r = createConvexCatalogRepository(
      {
        listCategories: resolved([]),
        listProducts: resolved([{ ...rawProduct, compareAtPriceMinor: undefined }]),
        getProductBySlug: resolved({ ...rawProduct, compareAtPriceMinor: undefined }),
      },
      CLOUD,
    );
    const product = await r.getProduct("fuji-apples");
    expect(product?.compareAtPriceMinor).toBeUndefined();
    expect(product?.discountPercent).toBeUndefined();
  });

  it("omits the discount when compare-at is lower than the selling price", async () => {
    const r = createConvexCatalogRepository(
      {
        listCategories: resolved([]),
        listProducts: resolved([{ ...rawProduct, compareAtPriceMinor: 1000 }]),
        getProductBySlug: resolved({ ...rawProduct, compareAtPriceMinor: 1000 }),
      },
      CLOUD,
    );
    expect((await r.getProduct("fuji-apples"))?.discountPercent).toBeUndefined();
  });

  it("takes availability from the server, never invents it", async () => {
    const r = createConvexCatalogRepository(
      {
        listCategories: resolved([]),
        listProducts: resolved([{ ...rawProduct, available: false, variants: [] }]),
        getProductBySlug: resolved({ ...rawProduct, available: false, variants: [] }),
      },
      CLOUD,
    );
    const product = await r.getProduct("fuji-apples");
    expect(product?.inStock).toBe(false);
    expect(product?.stockQuantity).toBe(0);
  });

  it("sums variant availability into stockQuantity", async () => {
    expect((await repo().getProduct("fuji-apples"))?.stockQuantity).toBe(4);
  });

  it("produces no image entry when there is no stored public id", async () => {
    const r = createConvexCatalogRepository(
      {
        listCategories: resolved([]),
        listProducts: resolved([{ ...rawProduct, imagePublicId: null }]),
        getProductBySlug: resolved({ ...rawProduct, imagePublicId: null }),
      },
      CLOUD,
    );
    expect((await r.getProduct("fuji-apples"))?.images).toEqual([]);
  });

  it("leaves origin blank rather than inventing one", async () => {
    expect((await repo().getProduct("fuji-apples"))?.origin).toBe("");
  });

  it("maps categories with a usable icon name", async () => {
    const categories = await repo().listCategories();
    expect(categories[0]?.slug).toBe("produce");
    expect(categories[0]?.nameAr).toBe("منتجات");
    expect(categories[0]?.iconName.length).toBeGreaterThan(0);
  });

  it("forwards trimmed filters to the server", async () => {
    let seen: Record<string, unknown> = {};
    const r = createConvexCatalogRepository(
      {
        listCategories: resolved([]),
        listProducts: (args: { categorySlug?: string; search?: string; inStockOnly?: boolean }) => {
          seen = args;
          return Promise.resolve([]);
        },
        getProductBySlug: resolved(null),
      },
      CLOUD,
    );
    await r.listProducts({ categorySlug: "produce", inStockOnly: true, query: " apple " });
    expect(seen).toMatchObject({ categorySlug: "produce", inStockOnly: true, search: "apple" });
  });

  it("returns null for a missing product rather than an empty object", async () => {
    const r = createConvexCatalogRepository(
      {
        listCategories: resolved([]),
        listProducts: resolved([]),
        getProductBySlug: resolved(null),
      },
      CLOUD,
    );
    expect(await r.getProduct("nope")).toBeNull();
  });
});
