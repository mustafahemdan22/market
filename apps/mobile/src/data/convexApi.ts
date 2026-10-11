/**
 * Re-exports the Convex generated API reference for the mobile app.
 *
 * `@grocery/convex` publishes no `exports` map (its `convex/_generated`
 * directory is codegen output, not a package entry point), so the dashboard and
 * the app both reach it through a workspace-relative path. `metro.config.js`
 * grants Metro the watch folder and the hoisted module paths this needs.
 */
export { api } from "../../../../packages/convex/convex/_generated/api";
