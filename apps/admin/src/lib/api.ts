/**
 * Re-exports the Convex generated API reference for the admin dashboard.
 *
 * `@grocery/convex` is the single backend package, so the dashboard imports the
 * same typed references the backend's own tests use rather than duplicating a
 * hand-written client surface. A workspace-relative path is used because the
 * Convex package publishes no `exports` map — its `convex/_generated` directory
 * is generated content, not a published entry point.
 *
 * Replaced automatically by `npx convex codegen` in packages/convex.
 */
export { api } from "../../../../packages/convex/convex/_generated/api";
export type { Doc, Id } from "../../../../packages/convex/convex/_generated/dataModel";
