import { createContext, useContext, useMemo, type ReactNode } from "react";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { tokenCache } from "./tokenCache";

interface AuthContextValue {
  readonly isClerkConfigured: boolean;
  readonly isConvexConfigured: boolean;
  readonly publishableKey: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  isClerkConfigured: false,
  isConvexConfigured: false,
  publishableKey: null,
});

export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}

// Read public environment variables bundled into Expo client
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? null;
const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL ?? null;

// Initialize Convex client if URL is supplied
let convexClient: ConvexReactClient | null = null;
if (CONVEX_URL && CONVEX_URL.startsWith("http")) {
  convexClient = new ConvexReactClient(CONVEX_URL);
}

interface ConvexWrapperProps {
  readonly children: ReactNode;
}

function ConvexWrapper({ children }: ConvexWrapperProps) {
  if (!convexClient) {
    // Convex not yet linked; render children directly
    return <>{children}</>;
  }

  return (
    <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

export interface AuthProviderProps {
  readonly children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const isClerkConfigured = useMemo(
    () => Boolean(CLERK_PUBLISHABLE_KEY && CLERK_PUBLISHABLE_KEY.startsWith("pk_")),
    [],
  );
  const isConvexConfigured = useMemo(
    () => Boolean(CONVEX_URL && CONVEX_URL.startsWith("http")),
    [],
  );

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      isClerkConfigured,
      isConvexConfigured,
      publishableKey: CLERK_PUBLISHABLE_KEY,
    }),
    [isClerkConfigured, isConvexConfigured],
  );

  if (!isClerkConfigured || !CLERK_PUBLISHABLE_KEY) {
    // Clerk publishable key is pending; render context for honest UI indication
    return (
      <AuthContext.Provider value={contextValue}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      <ClerkProvider
        publishableKey={CLERK_PUBLISHABLE_KEY}
        tokenCache={tokenCache}
      >
        <ConvexWrapper>{children}</ConvexWrapper>
      </ClerkProvider>
    </AuthContext.Provider>
  );
}
