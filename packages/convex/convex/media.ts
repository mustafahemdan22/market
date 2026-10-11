"use node";

import { createHash } from "node:crypto";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import {
  ALLOWED_FORMATS,
  buildSignedUploadParams,
  toSignaturePayload,
  MAX_UPLOAD_BYTES,
} from "./lib/uploadParams";

/**
 * Generate short-lived, admin-only Cloudinary signed upload parameters.
 *
 * SECURITY MODEL
 * - The API secret never leaves this function. Only the derived signature is
 *   returned, and only to a caller who already passed requireAdmin.
 * - Signing happens server-side. There is no client-side signing code path.
 * - The returned parameter set is fully server-chosen: folder, formats, size
 *   cap, tags. The client cannot widen any of them, because Cloudinary rejects
 *   any request whose params differ from the signed set.
 * - No Cloudinary Node SDK is used inside a query or mutation. This is an
 *   action, which is the only Convex function type permitted network I/O.
 */
export const createUploadSignature = action({
  args: {
    productId: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const folder = process.env.CLOUDINARY_UPLOAD_FOLDER ?? "grocery/products";

    const missing = [
      ["CLOUDINARY_CLOUD_NAME", cloudName],
      ["CLOUDINARY_API_KEY", apiKey],
      ["CLOUDINARY_API_SECRET", apiSecret],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      // Names only — values are never echoed back or logged.
      throw new Error(`Cloudinary is not configured. Missing: ${missing.join(", ")}`);
    }

    // Cloudinary expects Unix SECONDS.
    const timestamp = Math.floor(args.now / 1000);
    const params = buildSignedUploadParams({ timestamp, folder, productId: args.productId });

    const signature = createHash("sha256")
      .update(toSignaturePayload(params) + apiSecret)
      .digest("hex");

    return {
      cloudName: cloudName as string,
      apiKey: apiKey as string,
      signature,
      params,
      // Advisory only for immediate client feedback. The real ceiling is
      // Cloudinary's account Usage Limits, enforced server-side by Cloudinary.
      maxBytes: MAX_UPLOAD_BYTES,
      allowedFormats: ALLOWED_FORMATS,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    };
  },
});
