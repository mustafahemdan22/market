import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery_experimental } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api, type Id } from "../data/convexApi";
import { useAuthContext } from "../auth/AuthProvider";

/**
 * The cart is SERVER-AUTHORITATIVE.
 *
 * There is no local cart array and no client-side price arithmetic. A cart line
 * points at a VARIANT, not a product: price and stock both live on the variant,
 * so that is the only level at which "add 2 of this" means anything. Every
 * number the UI shows — subtotal, line count, availability — is produced by
 * `public/cart.getCart` inside Convex and rendered verbatim.
 *
 * `DATA_MODEL.md` §3.6.4: carts hold no reservation. Availability is a snapshot
 * of `onHand - reserved` at read time, and checkout re-validates it, so a line
 * can turn unavailable while it sits in the cart. Those lines are surfaced with
 * an `issue` code rather than silently dropped.
 *
 * Delivery and tax are NOT computed here. The server is the only authority for
 * them and no value has been agreed for either, so the client shows the
 * server-computed subtotal and nothing more. Inventing a "free delivery at
 * X" banner would state a commercial fact nobody has decided.
 */

type CartQueryData = FunctionReturnType<typeof api.public.cart.getCart>;
export type CartLine = CartQueryData["items"][number];

/** Why a line cannot currently be bought. `null` means it is sellable. */
export type CartLineIssue = CartLine["issue"];

export type CartStatus =
  /** No Convex deployment configured, so there is nowhere to keep a cart. */
  | "unconfigured"
  /** Clerk is loaded and the visitor is signed out. */
  | "signed-out"
  /** Clerk has not finished hydrating the session yet. */
  | "unknown"
  | "loading"
  | "ready"
  | "error";

export interface CartContextValue {
  readonly status: CartStatus;
  readonly lines: readonly CartLine[];
  /** Server-computed subtotal of sellable lines only. */
  readonly subtotalMinor: number;
  readonly itemCount: number;
  /** True when at least one line is unavailable or short on stock. */
  readonly hasBlockingLines: boolean;
  readonly errorMessage: string | null;
  /** True only when a write would actually reach the server. */
  readonly canMutate: boolean;
  readonly quantityForVariant: (variantId: string | undefined) => number;
  readonly add: (variantId: string, quantity: number) => Promise<boolean>;
  readonly setQuantity: (itemId: string, quantity: number) => Promise<boolean>;
  readonly remove: (itemId: string) => Promise<boolean>;
  readonly clearError: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** Used when no backend is mounted at all: every screen still renders. */
const UNCONFIGURED: CartContextValue = {
  status: "unconfigured",
  lines: [],
  subtotalMinor: 0,
  itemCount: 0,
  hasBlockingLines: false,
  errorMessage: null,
  canMutate: false,
  quantityForVariant: () => 0,
  add: () => Promise.resolve(false),
  setQuantity: () => Promise.resolve(false),
  remove: () => Promise.resolve(false),
  clearError: () => {},
};

export function CartProvider({ children }: { readonly children: ReactNode }) {
  const { isConvexConfigured, isClerkConfigured } = useAuthContext();

  // A component-level branch, never a conditional hook call: when no Convex
  // provider is mounted, `useQuery` would throw for want of a client.
  if (!isConvexConfigured || !isClerkConfigured) {
    return <CartContext.Provider value={UNCONFIGURED}>{children}</CartContext.Provider>;
  }

  return <LiveCartProvider>{children}</LiveCartProvider>;
}

function LiveCartProvider({ children }: { readonly children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuthContext();
  const [writeError, setWriteError] = useState<string | null>(null);

  const active = isLoaded && isSignedIn;

  // The object form is used instead of the positional `useQuery` because the
  // project requires an explicit error state on every screen; the positional
  // form can only surface a failure by throwing into an error boundary, which
  // renders a blank page instead of a recoverable state.
  const result = useQuery_experimental({
    query: api.public.cart.getCart,
    args: active ? {} : "skip",
  });

  const addToCart = useMutation(api.public.cart.addToCart);
  const updateCartItem = useMutation(api.public.cart.updateCartItem);
  const removeCartItem = useMutation(api.public.cart.removeCartItem);

  const report = useCallback((error: unknown): boolean => {
    setWriteError(error instanceof Error ? error.message : "The cart could not be updated.");
    return false;
  }, []);

  const add = useCallback(
    async (variantId: string, quantity: number): Promise<boolean> => {
      setWriteError(null);
      try {
        await addToCart({ variantId: variantId as Id<"productVariants">, quantity, now: Date.now() });
        return true;
      } catch (error) {
        return report(error);
      }
    },
    [addToCart, report],
  );

  const setQuantity = useCallback(
    async (itemId: string, quantity: number): Promise<boolean> => {
      setWriteError(null);
      try {
        await updateCartItem({ itemId: itemId as Id<"cartItems">, quantity, now: Date.now() });
        return true;
      } catch (error) {
        return report(error);
      }
    },
    [updateCartItem, report],
  );

  const remove = useCallback(
    async (itemId: string): Promise<boolean> => {
      setWriteError(null);
      try {
        await removeCartItem({ itemId: itemId as Id<"cartItems">, now: Date.now() });
        return true;
      } catch (error) {
        return report(error);
      }
    },
    [removeCartItem, report],
  );

  const quantityForVariant = useCallback(
    (variantId: string | undefined): number => {
      if (variantId === undefined) return 0;
      if (result.status !== "success") return 0;
      return result.data.items.find((line) => line.variantId === variantId)?.quantity ?? 0;
    },
    [result],
  );

  const value = useMemo<CartContextValue>(() => {
    if (!isLoaded) {
      return { ...UNCONFIGURED, status: "unknown" };
    }
    if (!isSignedIn) {
      return { ...UNCONFIGURED, status: "signed-out" };
    }
    if (result.status === "pending") {
      return { ...UNCONFIGURED, status: "loading" };
    }
    if (result.status === "error") {
      return {
        ...UNCONFIGURED,
        status: "error",
        errorMessage: result.error instanceof Error ? result.error.message : "Cart unavailable.",
      };
    }

    const { items, subtotalMinor, itemCount } = result.data;
    return {
      status: "ready",
      lines: items,
      subtotalMinor,
      itemCount,
      hasBlockingLines: items.some((line) => line.issue !== null),
      errorMessage: writeError,
      canMutate: true,
      quantityForVariant,
      add,
      setQuantity,
      remove,
      clearError: () => {
        setWriteError(null);
      },
    };
  }, [isLoaded, isSignedIn, result, writeError, quantityForVariant, add, setQuantity, remove]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * Exists so a hook used outside the provider fails with a sentence instead of
 * `null`. Reading the cart from a screen that never mounted the provider is a
 * wiring bug, not a runtime condition to handle.
 */
export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (value === null) {
    throw new Error("useCart must be used inside <CartProvider>.");
  }
  return value;
}

/** Translate a line's `issue` code into an i18n key suffix. */
export function cartIssueKey(issue: CartLineIssue): string | null {
  switch (issue) {
    case null:
      return null;
    case "unavailable":
      return "cart.issueUnavailable";
    case "out_of_stock":
      return "cart.issueOutOfStock";
    case "insufficient_stock":
      return "cart.issueInsufficient";
  }
}