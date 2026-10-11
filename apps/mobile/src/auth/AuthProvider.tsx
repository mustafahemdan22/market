import {
  Component,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { View } from "react-native";
import { ClerkProvider, useAuth, useSession } from "@clerk/expo";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { tokenCache } from "./tokenCache";
import { setCatalogClient } from "../data/catalogService";
import { useTheme } from "../theme/ThemeProvider";
import { useI18n } from "../i18n/I18nProvider";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { Text } from "../components/ui/Text";
import { spacing } from "../theme/tokens";

/**
 * Clerk's `useSession()` in @clerk/expo@4.10.1 only ever reports the *active*
 * session, and its `status` is narrowed to "active" | "pending". It never
 * surfaces "expired". So an ended session — expired, revoked, or signed out
 * elsewhere — is observed as a signed-in -> signed-out transition, which is
 * what `hasSessionEnded` latches.
 */
export type AuthSessionStatus = "unavailable" | "loading" | "signed-out" | "pending" | "active";

interface AuthContextValue {
  /** True when a valid publishable key is present and ClerkProvider is mounted. */
  readonly isClerkConfigured: boolean;
  /** True when a Convex URL is present and the Convex provider is mounted. */
  readonly isConvexConfigured: boolean;
  /** Never a secret: this is the publishable (pk_) key only. */
  readonly publishableKey: string | null;
  /** Clerk has finished hydrating the persisted session. */
  readonly isLoaded: boolean;
  readonly isSignedIn: boolean;
  readonly sessionStatus: AuthSessionStatus;
  /** True when a previously active session ended (expired/revoked/remote sign-out). */
  readonly hasSessionEnded: boolean;
  /** Rejects with the underlying Clerk error so callers can surface it. */
  readonly signOut: () => Promise<void>;
}

const UNCONFIGURED: Omit<AuthContextValue, "signOut"> = {
  isClerkConfigured: false,
  isConvexConfigured: false,
  publishableKey: null,
  isLoaded: false,
  isSignedIn: false,
  sessionStatus: "unavailable",
  hasSessionEnded: false,
};

const AuthContext = createContext<AuthContextValue>({
  ...UNCONFIGURED,
  signOut: () => Promise.reject(new Error("Clerk is not configured")),
});

export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? null;
const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL ?? null;

/**
 * A publishable key is the only Clerk credential that may reach the client.
 * Anything that does not look like one is rejected before ClerkProvider mounts,
 * so a malformed value produces an explicit error rather than a blank app.
 */
export function isValidPublishableKey(value: string | null): boolean {
  return typeof value === "string" && /^pk_(test|live)_[A-Za-z0-9_-]{8,}$/.test(value.trim());
}

function ConvexWrapper({ children }: { readonly children: ReactNode }) {
  const convexClient = useMemo(
    () => (CONVEX_URL && CONVEX_URL.startsWith("http") ? new ConvexReactClient(CONVEX_URL) : null),
    [],
  );

  // Hand the client to the catalogue service so screens read live Convex data
  // instead of fixtures. When no URL is configured this stays null and the
  // service falls back to the bundled fixtures.
  useEffect(() => {
    setCatalogClient(convexClient, process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? null);
    return () => {
      setCatalogClient(null);
    };
  }, [convexClient]);

  if (!convexClient) {
    return <>{children}</>;
  }

  return (
    <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

/**
 * Bridges Clerk's hook state into the app-level context.
 * Must render inside <ClerkProvider> — the hooks throw otherwise.
 */
function ClerkStateBridge({ children }: { readonly children: ReactNode }) {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { session, isLoaded: sessionLoaded } = useSession();

  const wasSignedInRef = useRef(false);
  const [hasSessionEnded, setHasSessionEnded] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      wasSignedInRef.current = true;
    } else if (isLoaded && !isSignedIn && wasSignedInRef.current) {
      setHasSessionEnded(true);
    }
  }, [isLoaded, isSignedIn]);

  const value = useMemo<AuthContextValue>(() => {
    const ready = isLoaded && sessionLoaded;

    let sessionStatus: AuthSessionStatus;
    if (!ready) {
      sessionStatus = "loading";
    } else if (!isSignedIn || !session) {
      sessionStatus = "signed-out";
    } else {
      sessionStatus = session.status === "pending" ? "pending" : "active";
    }

    return {
      isClerkConfigured: true,
      isConvexConfigured: Boolean(CONVEX_URL && CONVEX_URL.startsWith("http")),
      publishableKey: CLERK_PUBLISHABLE_KEY,
      isLoaded: ready,
      isSignedIn: Boolean(isSignedIn),
      sessionStatus,
      hasSessionEnded,
      signOut: async () => {
        await signOut();
      },
    };
  }, [isLoaded, sessionLoaded, isSignedIn, session, hasSessionEnded, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Clerk failed to initialise.";
}

interface ClerkErrorBoundaryProps {
  readonly children: ReactNode;
  readonly onRetry: () => void;
}

interface ClerkErrorBoundaryState {
  readonly message: string | null;
}

/**
 * Clerk throws during initialisation for things the app cannot recover from by
 * itself: a revoked instance, a blocked network, a malformed key. Without a
 * boundary those surface as a blank screen, which reads as "auth silently
 * broken". This makes the failure visible instead of hiding it.
 */
class ClerkErrorBoundary extends Component<ClerkErrorBoundaryProps, ClerkErrorBoundaryState> {
  public override state: ClerkErrorBoundaryState = { message: null };

  public static getDerivedStateFromError(error: unknown): ClerkErrorBoundaryState {
    return { message: describeError(error) };
  }

  public override componentDidCatch(error: unknown): void {
    this.setState({ message: describeError(error) });
  }

  public override render(): ReactNode {
    const { message } = this.state;
    if (message !== null) {
      return <ClerkFailureNotice message={message} onRetry={this.props.onRetry} />;
    }
    return this.props.children;
  }
}

interface ClerkFailureNoticeProps {
  readonly message: string;
  readonly onRetry: () => void;
}

function ClerkFailureNotice({ message, onRetry }: ClerkFailureNoticeProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <View
      style={{ padding: spacing[5], backgroundColor: colors.surface.canvas, flex: 1 }}
      accessibilityRole="alert"
    >
      <Text variant="h3" style={{ marginBottom: spacing[3] }}>
        {t("auth.errorTitle")}
      </Text>
      <Banner message={message} tone="danger" />
      <Text variant="caption" tone="secondary" style={{ marginTop: spacing[3] }}>
        {t("auth.errorSupportHint")}
      </Text>
      <Button
        label={t("action.retry")}
        onPress={onRetry}
        variant="secondary"
        size="md"
        style={{ marginTop: spacing[4] }}
      />
    </View>
  );
}

export interface AuthProviderProps {
  readonly children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [resetKey, setResetKey] = useState(0);
  const isClerkConfigured = useMemo(() => isValidPublishableKey(CLERK_PUBLISHABLE_KEY), []);
  const isConvexConfigured = useMemo(
    () => Boolean(CONVEX_URL && CONVEX_URL.startsWith("http")),
    [],
  );

  const unconfiguredValue = useMemo<AuthContextValue>(
    () => ({
      ...UNCONFIGURED,
      isConvexConfigured,
      signOut: () => Promise.reject(new Error("Clerk is not configured")),
    }),
    [isConvexConfigured],
  );

  if (!isClerkConfigured || !CLERK_PUBLISHABLE_KEY) {
    return <AuthContext.Provider value={unconfiguredValue}>{children}</AuthContext.Provider>;
  }

  return (
    <ClerkErrorBoundary
      key={resetKey}
      onRetry={() => {
        setResetKey((prev) => prev + 1);
      }}
    >
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
        <ClerkStateBridge>
          <ConvexWrapper>{children}</ConvexWrapper>
        </ClerkStateBridge>
      </ClerkProvider>
    </ClerkErrorBoundary>
  );
}
