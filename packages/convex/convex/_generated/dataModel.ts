/**
 * Hand-maintained stand-in for Convex codegen output.
 *
 * `npx convex codegen` requires CONVEX_DEPLOYMENT, and producing it via
 * `npx convex dev` would create an external Convex deployment — out of scope
 * for this work. These files mirror what codegen emits so the backend
 * typechecks and runs under `convex-test` with no deployment linked.
 *
 * Written as `.ts` rather than codegen's `.js` + `.d.ts` pair so the module is
 * part of the type-aware program; a split pair left the consumer types
 * unresolved for ESLint's typed rules.
 *
 * REGENERATE with `npx convex codegen` once a deployment is linked, and delete
 * this note.
 */
import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  TableNamesInDataModel,
} from "convex/server";
import type { GenericId } from "convex/values";
import type schema from "../schema.js";

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
export type TableNames = TableNamesInDataModel<DataModel>;
export type Doc<TableName extends TableNames> = DocumentByName<DataModel, TableName>;
export type Id<TableName extends TableNames | "_storage" | "_scheduled_functions"> =
  GenericId<TableName>;
