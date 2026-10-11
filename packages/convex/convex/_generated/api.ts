/**
 * Hand-maintained stand-in for Convex codegen output. See dataModel.ts for why
 * this is not generated yet. Regenerate with `npx convex codegen`.
 *
 * Registered Convex functions carry extra runtime members beyond
 * `FunctionReference`, so the module namespaces are not directly assignable to
 * `ApiFromModules`. Codegen erases this the same way; the cast is applied once,
 * at construction, and every call site still gets fully typed arguments.
 */
import type { ApiFromModules } from "convex/server";
import * as categories from "../admin/categories";
import * as productImages from "../admin/productImages";
import * as products from "../admin/products";
import * as media from "../media";

type ModuleMap = {
  "admin/categories": typeof categories;
  "admin/productImages": typeof productImages;
  "admin/products": typeof products;
  media: typeof media;
};

const fullApi = {
  admin: {
    categories,
    productImages,
    products,
  },
  media,
} as unknown as ApiFromModules<ModuleMap>;

export const api = fullApi;
