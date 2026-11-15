/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as buyer from "../buyer.js";
import type * as garages from "../garages.js";
import type * as http from "../http.js";
import type * as items from "../items.js";
import type * as keiki from "../keiki.js";
import type * as keikiHttp from "../keikiHttp.js";
import type * as lib_location from "../lib/location.js";
import type * as orders from "../orders.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";
import type * as whop from "../whop.js";
import type * as yard from "../yard.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  buyer: typeof buyer;
  garages: typeof garages;
  http: typeof http;
  items: typeof items;
  keiki: typeof keiki;
  keikiHttp: typeof keikiHttp;
  "lib/location": typeof lib_location;
  orders: typeof orders;
  seed: typeof seed;
  users: typeof users;
  whop: typeof whop;
  yard: typeof yard;
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
