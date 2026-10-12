/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_categories from "../admin/categories.js";
import type * as admin_orders from "../admin/orders.js";
import type * as admin_productImages from "../admin/productImages.js";
import type * as admin_products from "../admin/products.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_catalog from "../lib/catalog.js";
import type * as lib_customer from "../lib/customer.js";
import type * as lib_inventory from "../lib/inventory.js";
import type * as lib_orderStatus from "../lib/orderStatus.js";
import type * as lib_uploadParams from "../lib/uploadParams.js";
import type * as lib_validate from "../lib/validate.js";
import type * as media from "../media.js";
import type * as public_cart from "../public/cart.js";
import type * as public_catalog from "../public/catalog.js";
import type * as public_orders from "../public/orders.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/categories": typeof admin_categories;
  "admin/orders": typeof admin_orders;
  "admin/productImages": typeof admin_productImages;
  "admin/products": typeof admin_products;
  "lib/auth": typeof lib_auth;
  "lib/catalog": typeof lib_catalog;
  "lib/customer": typeof lib_customer;
  "lib/inventory": typeof lib_inventory;
  "lib/orderStatus": typeof lib_orderStatus;
  "lib/uploadParams": typeof lib_uploadParams;
  "lib/validate": typeof lib_validate;
  media: typeof media;
  "public/cart": typeof public_cart;
  "public/catalog": typeof public_catalog;
  "public/orders": typeof public_orders;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
