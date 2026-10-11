import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { nowArg, recordAudit } from "../lib/catalog";
import { invalid, requireText } from "../lib/validate";
import { ALLOWED_FORMATS, MAX_UPLOAD_BYTES } from "../lib/uploadParams";

/**
 * Persist validated image metadata after a direct client→Cloudinary upload.
 *
 * This is a plain mutation, NOT an action: no Cloudinary SDK call happens here,
 * and the API secret is not involved at any point. The client uploads the file
 * to Cloudinary using parameters signed by `createUploadSignature`, then reports
 * the resulting metadata back, which is re-validated before it is stored.
 *
 * Only the public id is persisted. No delivery URL is stored — clients derive
 * transformation URLs so the CDN shape never becomes stale stored data.
 */
export const attachProductImage = mutation({
  args: {
    productId: v.id("products"),
    cloudinaryPublicId: v.string(),
    format: v.string(),
    width: v.number(),
    height: v.number(),
    bytes: v.number(),
    alt: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const now = nowArg(args.now);

    const product = await ctx.db.get(args.productId);
    if (product === null) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Product not found." });
    }

    // --- Metadata validation -------------------------------------------------
    // A client can call this directly with fabricated numbers, so nothing is
    // taken on trust: format must be on the signed allowlist, dimensions must be
    // plausible, and the byte count must sit inside the signed size cap.
    const publicId = requireText(args.cloudinaryPublicId, "public id", 200);

    if (!/^[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(publicId)) {
      invalid("Image public id contains unsupported characters.");
    }
    // A public id must not try to escape the configured upload folder prefix.
    if (publicId.startsWith("/") || publicId.includes("..")) {
      invalid("Image public id must be a relative path inside the upload folder.");
    }

    const format = args.format.toLowerCase();
    if (!(ALLOWED_FORMATS as readonly string[]).includes(format)) {
      invalid(`Image format must be one of: ${ALLOWED_FORMATS.join(", ")}.`);
    }

    if (!Number.isInteger(args.width) || args.width <= 0 || args.width > 20_000) {
      invalid("Image width must be a positive whole number under 20000.");
    }
    if (!Number.isInteger(args.height) || args.height <= 0 || args.height > 20_000) {
      invalid("Image height must be a positive whole number under 20000.");
    }
    if (!Number.isInteger(args.bytes) || args.bytes <= 0) {
      invalid("Image size must be a positive whole number of bytes.");
    }
    if (args.bytes > MAX_UPLOAD_BYTES) {
      invalid(`Image exceeds the ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit.`);
    }

    // --- Duplicate / primary invariants ------------------------------------
    const existing = await ctx.db
      .query("productImages")
      .withIndex("by_product_sortOrder", (q) => q.eq("productId", args.productId))
      .collect();

    const duplicate = existing.find((img) => img.cloudinaryPublicId === publicId);
    if (duplicate !== undefined) {
      throw new ConvexError({
        code: "DUPLICATE_IMAGE",
        message: "This image is already attached to the product.",
      });
    }

    const makePrimary = args.isPrimary ?? existing.length === 0;

    // Exactly one primary per product. Read the whole range, clear the
    // incumbent, then set the new one — all in this transaction.
    if (makePrimary) {
      for (const image of existing) {
        if (image.isPrimary) {
          await ctx.db.patch(image._id, { isPrimary: false });
        }
      }
    }

    const imageId = await ctx.db.insert("productImages", {
      productId: args.productId,
      cloudinaryPublicId: publicId,
      format,
      width: args.width,
      height: args.height,
      bytes: args.bytes,
      alt: args.alt === undefined ? product.nameEn : requireText(args.alt, "Alt text", 200),
      sortOrder: existing.length,
      isPrimary: makePrimary,
      uploadedBySubject: actor,
      createdAt: now,
    });

    await recordAudit(ctx, {
      actorSubject: actor,
      action: "product.image.attach",
      entity: "productImages",
      entityId: imageId,
      after: { publicId, format, width: args.width, height: args.height, bytes: args.bytes },
      now,
    });

    return { imageId, cloudinaryPublicId: publicId };
  },
});

/** Remove an image reference. Admin only, always audited. */
export const removeProductImage = mutation({
  args: {
    imageId: v.id("productImages"),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const now = nowArg(args.now);

    const image = await ctx.db.get(args.imageId);
    if (image === null) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Image not found." });
    }

    await ctx.db.delete(args.imageId);

    // Never leave a product with zero primary images; promote the next one.
    if (image.isPrimary) {
      const remaining = await ctx.db
        .query("productImages")
        .withIndex("by_product_sortOrder", (q) => q.eq("productId", image.productId))
        .collect();
      const next = remaining[0];
      if (next !== undefined) {
        await ctx.db.patch(next._id, { isPrimary: true });
      }
    }

    await recordAudit(ctx, {
      actorSubject: actor,
      action: "product.image.remove",
      entity: "productImages",
      entityId: args.imageId,
      before: { publicId: image.cloudinaryPublicId },
      now,
    });

    return { removed: true };
  },
});
