"use client";

import type { ConvexReactClient } from "convex/react";
import { api } from "./convexApi";
import type {
  CatalogFilterOptions,
  CatalogRepository,
  Category,
  Product,
} from "./catalogRepository";
import { FixtureCatalogRepository } from "./fixtures/fixtureRepository";
import { createConvexCatalogRepository } from "./convexCatalogRepository";

/**
 * Single data source for the whole mobile app.
 *
 * The app always has a working repository:
 *  - pointed at a Convex deployment  -> live catalogue
 *  - no deployment configured       -> bundled fixtures
 *
 * Falling back is a developer-experience decision, NOT a claim that live data
 * is present. `getDataSource()` exposes which one is active so the UI can say so
 * instead of silently showing sample products as if they were real stock.
 */

interface CatalogListArgs {
  categorySlug?: string;
  search?: string;
  inStockOnly?: boolean;
  limit?: number;
}

let convexClient: ConvexReactClient | null = null;
let cloudName: string | null = null;

export type DataSource = "convex" | "fixtures";

export function setCatalogClient(
  client: ConvexReactClient | null,
  cloudinaryCloudName: string | null = null,
): void {
  convexClient = client;
  cloudName = cloudinaryCloudName;
}

export function getDataSource(): DataSource {
  return convexClient === null ? "fixtures" : "convex";
}

const fixtures = new FixtureCatalogRepository();

function active(): CatalogRepository {
  const client = convexClient;
  if (client === null) return fixtures;
  return createConvexCatalogRepository(
    {
      listCategories: () => client.query(api.public.catalog.listCategories, {}),
      listProducts: (args: CatalogListArgs) => client.query(api.public.catalog.listProducts, args),
      getProductBySlug: (args: { slug: string }) =>
        client.query(api.public.catalog.getProductBySlug, args),
    },
    cloudName,
  );
}

/**
 * Stable object identity, so screens can safely list it in effect dependencies
 * without re-fetching on every render.
 */
export const catalogRepository: CatalogRepository = {
  listCategories: (): Promise<Category[]> => active().listCategories(),
  listProducts: (filters?: CatalogFilterOptions): Promise<Product[]> =>
    active().listProducts(filters),
  getProduct: (slug: string): Promise<Product | null> => active().getProduct(slug),
  searchProducts: (query: string): Promise<Product[]> => active().searchProducts(query),
  getFeaturedDeals: (): Promise<Product[]> => active().getFeaturedDeals(),
};
