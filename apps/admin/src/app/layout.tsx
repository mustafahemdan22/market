import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "../components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fresh Market — Admin",
  description: "Product, category, stock and image management for store staff.",
};

/**
 * Fixed at the document level for now. `dir="rtl"` lets the browser perform the
 * mirroring through logical CSS properties, so no component needs a
 * row-reverse workaround.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const body = (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );

  // Fail loudly and honestly when configuration is missing. Silently rendering
  // an empty dashboard would read as "there is no data", which is a different
  // problem from "the dashboard is not wired up yet".
  if (!clerkKey || !convexUrl) {
    const missing = [
      ...(clerkKey ? [] : ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]),
      ...(convexUrl ? [] : ["NEXT_PUBLIC_CONVEX_URL"]),
    ];
    return (
      <html lang="en" dir="ltr">
        <body className="min-h-screen antialiased">
          <main className="mx-auto max-w-2xl p-8">
            <h1 className="text-2xl font-semibold">Admin dashboard is not configured</h1>
            <p className="mt-2 text-sm text-neutral-600">
              The following public environment variables are missing:
            </p>
            <ul className="mt-3 list-disc ps-6 text-sm">
              {missing.map((name) => (
                <li key={name}>
                  <code>{name}</code>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-neutral-600">
              Copy <code>.env.example</code> to <code>apps/admin/.env.local</code> and fill in the
              values. See <code>docs/ADMIN_SETUP.md</code>.
            </p>
          </main>
        </body>
      </html>
    );
  }

  return (
    <ClerkProvider>
      <Providers>{body}</Providers>
    </ClerkProvider>
  );
}
