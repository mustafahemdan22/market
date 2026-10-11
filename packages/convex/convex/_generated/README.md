# WARNING — hand-written, NOT generated

**These files are hand-maintained placeholders, not real Convex codegen output.**

| File           | What it stands in for                                                     |
| -------------- | ------------------------------------------------------------------------- |
| `server.ts`    | `queryGeneric` / `mutationGeneric` / `actionGeneric` bound to `DataModel` |
| `dataModel.ts` | `DataModelFromSchemaDefinition<typeof schema>`                            |
| `api.ts`       | The `ApiFromModules` reference tree                                       |

## Why

`npx convex codegen` refuses to run without `CONVEX_DEPLOYMENT`:

```
✖ No CONVEX_DEPLOYMENT set, run `npx convex dev` to configure a Convex project
```

The only supported way to generate this directory is `npx convex dev`, which
**creates or links an external Convex deployment**. That is an external-resource
action and was explicitly out of scope, so the stubs were written by hand.

They are functional: `convex-test`, `tsc` and ESLint all resolve against them
correctly, and 47 backend tests pass. But they are a stand-in, not the real
thing.

## Regenerate as the FIRST step after linking a deployment

```bash
cd packages/convex
npx convex codegen
```

Then:

1. Delete the "hand-maintained stand-in" comment at the top of
   `dataModel.ts` and `server.ts`.
2. `git diff packages/convex/convex/_generated/` — review the diff before
   committing. Expect the generated `server.ts` to export the same builders,
   plus a `httpAction` and `anyApi` helper that the stub omits.
3. Re-run the gates; they must stay green:
   ```bash
   npm run typecheck && npm run lint && npm test
   ```
4. If the regenerated files are dropped as `.js` + `.d.ts` pairs instead of
   `.ts`, ESLint's type-aware rules will fail with "error typed" on every
   consumer, because a split pair falls outside the TypeScript program. Either
   keep them as `.ts` or re-add the ignore _and_ exclude them from the program
   deliberately — do not leave it half-done.

## Two API facts this stub encodes

Recorded because both were verified against the installed Convex 1.46.0 and
both are easy to get wrong:

1. `ctx.auth.getUserIdentity()` is **async** — it returns
   `Promise<UserIdentity | null>`. Every guard is `await`ed.
2. The builders must be annotated as `QueryBuilder<DataModel, "public">` etc.
   A bare `export const query = queryGeneric` loses the `DataModel` binding and
   silently degrades every document type in every handler to `any`.
