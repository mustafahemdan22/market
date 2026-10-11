import type { AuthConfig } from "convex/server";

/**
 * Clerk ⇄ Convex authentication.
 *
 * The issuer is read from the Convex runtime environment — never hardcoded.
 * Convex's own guide names this `CLERK_JWT_ISSUER_DOMAIN`; Clerk's integration
 * guide calls the same URL `CLERK_FRONTEND_API_URL`. Both are read so either
 * naming works, with the Clerk name taking precedence.
 *
 * `applicationID: "convex"` matches the audience of Clerk's "convex" JWT
 * template. Changing the audience in Clerk means changing this value too.
 */
const issuer = process.env.CLERK_FRONTEND_API_URL ?? process.env.CLERK_JWT_ISSUER_DOMAIN;

export default {
  providers: issuer
    ? [
        {
          domain: issuer,
          applicationID: "convex",
        },
      ]
    : [],
} satisfies AuthConfig;
