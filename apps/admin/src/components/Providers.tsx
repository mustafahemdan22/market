"use client";

import { useState, type ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

/**
 * Bridges Clerk's session into Convex.
 *
 * `ConvexProviderWithClerk` asks Clerk for a token minted against the "convex"
 * audience template and hands it to the Convex client. Authorization still
 * happens server-side: Convex verifies that token's signature, then applies the
 * PANDAMA_ADMIN_SUBJECTS allowlist to the verified subject. Nothing here grants
 * access on its own.
 */
export function Providers({ children }: { children: ReactNode }) {
  // Constructed once per mount so re-renders reuse a single connection.
  const [client] = useState(
    () =>
      new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://placeholder.invalid"),
  );

  return (
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
