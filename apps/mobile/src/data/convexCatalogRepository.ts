import type {
  CatalogFilterOptions,
  CatalogRepository,
  Category,
  Product,
  ProductVariant,
} from "./catalogRepository";

/**
 * Adapts a Convex catalogue document to the shape the mobile UI already renders.
 *
 * The mobile `Product` interface predates the Convex schema and carries a few
 * fields the backend does not model (origin, discountPercent, isOrganic). Those
 * are deliberately mapped to neutral defaults rather than faked: inventing an
 * origin or an organic badge would show the customer something untrue.
 *
 * MONEY: the backend stores integer minor units (1250 = EGP 12.50) and the
 * customer-facing shelf price is final and VAT-inclusive, so `priceMinor` maps
 * through unchanged and no tax line is ever added here.
 */

interface ConvexVariant {
  _id: string;
  nameEn: string;
  nameAr: string;
  sku: string;
  priceMinor: number;
  compareAtPriceMinor?: number | undefined;
  isDefault: boolean;
  available: number;
}

interface ConvexProduct {
  _id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  brand?: string | undefined;
  unitLabel: string;
  priceMinor: number;
  compareAtPriceMinor?: number | undefined;
  categorySlug?: string | undefined;
  imagePublicId: string | null;
  available: boolean;
  variants?: ConvexVariant[];
  images?: string[];
}

/**
 * Cloudinary delivery URLs are DERIVED from the stored public id, never
 * persisted. `f_auto,q_auto` lets the CDN pick modern formats and quality.
 */
export function cloudinaryImageUrl(cloudName: string, publicId: string, width = 800): string {
  // Guarded inside the helper as well as at the call site: without a cloud name
  // the result would be a broken image URL rendered as if it were real content.
  if (cloudName.length === 0 || publicId.length === 0) return "";
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_${width}/${publicId}`;
}

function toProduct(raw: ConvexProduct, cloudName: string | null): Product {
  const images =
    raw.imagePublicId !== null && cloudName !== null
      ? [cloudinaryImageUrl(cloudName, raw.imagePublicId)]
      : [];

  const variants: ProductVariant[] | undefined = raw.variants?.map((v) => ({
    id: v._id,
    name: v.nameEn,
    nameAr: v.nameAr,
    priceMinor: v.priceMinor,
    sku: v.sku,
    inStock: v.available > 0,
  }));

  const compareAt = raw.compareAtPriceMinor;

  // Cart lines reference a variant, so the add-to-cart affordance needs a
  // concrete id. Prefer the variant flagged default, then the first with stock.
  // Otherwise leave it undefined rather than guessing at a reference.
  const defaultVariantId =
    raw.variants?.find((v) => v.isDefault)?.id ?? raw.variants?.find((v) => v.available > 0)?.id;

  return {
    id: raw._id,
    slug: raw.slug,
    name: raw.nameEn,
    nameAr: raw.nameAr,
    description: raw.descriptionEn,
    descriptionAr: raw.descriptionAr,
    categorySlug: raw.categorySlug ?? "",
    priceMinor: raw.priceMinor,
    unit: raw.unitLabel,
    unitAr: raw.unitLabel,
    // Derived, not stored: availability comes from the server's own
    // onHand - reserved calculation.
    stockQuantity: raw.variants?.reduce((n, v) => n + v.available, 0) ?? (raw.available ? 1 : 0),
    inStock: raw.available,
    origin: "",
    originAr: "",
    images,
    ...(compareAt === undefined ? {} : { compareAtPriceMinor: compareAt }),
    ...(compareAt !== undefined && compareAt > raw.priceMinor
      ? { discountPercent: Math.round(((compareAt - raw.priceMinor) / compareAt) * 100) }
      : {}),
    ...(variants === undefined ? {} : { variants }),
    ...(defaultVariantId === undefined ? {} : { defaultVariantId }),
  };
}

type CatalogClient = {
  listCategories: () => Promise<
    Array<{ slug: string; nameEn: string; nameAr: string; productCount: number }>
  >;
  listProducts: (args: {
    categorySlug?: string;
    search?: string;
    inStockOnly?: boolean;
    limit?: number;
  }) => Promise<ConvexProduct[]>;
  getProductBySlug: (args: { slug: string }) => Promise<ConvexProduct | null>;
};

/**
 * Convex-backed catalogue. Used when the app is pointed at a real deployment;
 * `createCatalogRepository` falls back to fixtures otherwise, so the app is
 * always runnable and never shows an empty screen just because it is offline.
 */
export function createConvexCatalogRepository(
  client: CatalogClient,
  cloudName: string | null,
): CatalogRepository {
  return {
    async listCategories(): Promise<Category[]> {
      const rows = await client.listCategories();
      return rows.map((row) => ({
        slug: row.slug,
        name: row.nameEn,
        nameAr: row.nameAr,
        // The backend does not model a category icon; the mobile UI falls back
        // to a default glyph rather than showing a misleading icon.
        iconName: "basket-outline",
        itemCount: row.productCount,
        imageUrl: "",
      }));
    },

    async listProducts(filters?: CatalogFilterOptions): Promise<Product[]> {
      const args: Parameters<CatalogClient["listProducts"]>[0] = { limit: 60 };
      if (filters?.categorySlug !== undefined) args.categorySlug = filters.categorySlug;
      if (filters?.query !== undefined && filters.query.trim().length > 0) {
        args.search = filters.query.trim();
      }
      if (filters?.inStockOnly === true) args.inStockOnly = true;

      const rows = await client.listProducts(args);
      let products = rows.map((row) => toProduct(row, cloudName));

      // These two flags have no backend representation yet; they are filtered
      // locally only when the server could not have applied them.
      if (filters?.organicOnly === true) products = products.filter(() => false);
      if (filters?.dealsOnly === true) {
        products = products.filter((p) => p.compareAtPriceMinor !== undefined);
      }
      return products;
    },

    async getProduct(slug: string): Promise<Product | null> {
      const row = await client.getProductBySlug({ slug });
      return row === null ? null : toProduct(row, cloudName);
    },

    async searchProducts(query: string): Promise<Product[]> {
      return this.listProducts({ query });
    },

    async getFeaturedDeals(): Promise<Product[]> {
      const rows = await client.listProducts({ limit: 12 });
      return rows
        .map((row) => toProduct(row, cloudName))
        .filter((p) => p.compareAtPriceMinor !== undefined);
    },
  };
}
