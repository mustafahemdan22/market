/**
 * Catalog Repository Interface — Data access boundary
 * Decouples presentation components from the eventual Convex backend.
 * Phase B uses fixtures; Phase C implements this against Convex.
 */

export interface ProductVariant {
  readonly id: string;
  readonly name: string;
  readonly nameAr: string;
  readonly priceMinor: number;
  readonly sku: string;
  readonly inStock: boolean;
}

export interface Product {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly nameAr: string;
  readonly description: string;
  readonly descriptionAr: string;
  readonly categorySlug: string;
  readonly priceMinor: number; // In minor units (e.g. 1250 = 12.50 EGP)
  readonly compareAtPriceMinor?: number;
  readonly discountPercent?: number;
  readonly unit: string; // e.g. "1 kg", "500g", "1 bunch"
  readonly unitAr: string;
  readonly stockQuantity: number;
  readonly inStock: boolean;
  readonly isOrganic?: boolean;
  readonly isDeal?: boolean;
  readonly origin: string;
  readonly originAr: string;
  readonly images: readonly string[];
  readonly variants?: readonly ProductVariant[];
  /**
   * The variant a one-tap "add to cart" should use.
   *
   * Present only when the data came from Convex, because a cart line is a
   * VARIANT reference and there is nothing to reference against in the bundled
   * fixtures. Its absence is a real, visible state: the UI says the cart is
   * unavailable rather than pretending a local line was added.
   */
  readonly defaultVariantId?: string;
}

export interface Category {
  readonly slug: string;
  readonly name: string;
  readonly nameAr: string;
  readonly iconName: string;
  readonly itemCount: number;
  readonly imageUrl: string;
}

export interface CatalogFilterOptions {
  readonly categorySlug?: string;
  readonly dealsOnly?: boolean;
  readonly organicOnly?: boolean;
  readonly inStockOnly?: boolean;
  readonly query?: string;
}

export interface CatalogRepository {
  listCategories(): Promise<Category[]>;
  listProducts(filters?: CatalogFilterOptions): Promise<Product[]>;
  getProduct(slug: string): Promise<Product | null>;
  searchProducts(query: string): Promise<Product[]>;
  getFeaturedDeals(): Promise<Product[]>;
}
