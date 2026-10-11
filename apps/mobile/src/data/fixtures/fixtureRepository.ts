import type {
  CatalogFilterOptions,
  CatalogRepository,
  Category,
  Product,
} from "../catalogRepository";
import { FIXTURE_CATEGORIES, FIXTURE_PRODUCTS } from "./products.fixture";

export class FixtureCatalogRepository implements CatalogRepository {
  async listCategories(): Promise<Category[]> {
    // Artificial small delay to mimic async behavior and test skeleton states
    await new Promise((res) => setTimeout(() => res(undefined), 60));
    return [...FIXTURE_CATEGORIES];
  }

  async listProducts(filters: CatalogFilterOptions = {}): Promise<Product[]> {
    await new Promise((res) => setTimeout(() => res(undefined), 80));
    let items = [...FIXTURE_PRODUCTS];

    if (filters.categorySlug) {
      items = items.filter((p) => p.categorySlug === filters.categorySlug);
    }

    if (filters.dealsOnly) {
      items = items.filter((p) => Boolean(p.isDeal));
    }

    if (filters.organicOnly) {
      items = items.filter((p) => Boolean(p.isOrganic));
    }

    if (filters.inStockOnly) {
      items = items.filter((p) => p.inStock);
    }

    if (filters.query && filters.query.trim().length > 0) {
      const q = filters.query.trim().toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.nameAr.includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.descriptionAr.includes(q),
      );
    }

    return items;
  }

  async getProduct(slug: string): Promise<Product | null> {
    await new Promise((res) => setTimeout(() => res(undefined), 60));
    const found = FIXTURE_PRODUCTS.find((p) => p.slug === slug);
    return found ? { ...found } : null;
  }

  async searchProducts(query: string): Promise<Product[]> {
    return this.listProducts({ query });
  }

  async getFeaturedDeals(): Promise<Product[]> {
    return this.listProducts({ dealsOnly: true });
  }
}

export const catalogRepository: CatalogRepository = new FixtureCatalogRepository();
