/**
 * Cloudinary signed-upload parameter construction.
 *
 * PURE — no I/O, no crypto, no SDK. Kept separate so the exact string that gets
 * signed can be unit-tested without the Convex Node runtime.
 *
 * Cloudinary's algorithm: every parameter that will be sent (except `file`,
 * `cloud_name`, `resource_type` and `api_key`) is joined as `name=value` pairs
 * sorted alphabetically by name, the API secret is appended with no separator,
 * and the result is hashed.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "webp"] as const;

/** Parameters the client is allowed to influence, beyond the server-chosen set. */
export interface SignedUploadParams {
  readonly timestamp: number;
  readonly folder: string;
  readonly allowed_formats: string;
  readonly max_file_size: number;
  readonly eager: string;
  readonly tags: string;
  readonly context: string;
}

export class UploadParamError extends Error {}

function assertSafe(value: string, field: string, pattern: RegExp): void {
  if (!pattern.test(value)) {
    throw new UploadParamError(`Unsafe value for ${field}.`);
  }
}

export interface BuildUploadParamsInput {
  readonly timestamp: number;
  readonly folder: string;
  readonly productId: string;
}

/**
 * Build the full signed parameter set. Every value is server-chosen: the client
 * contributes no field that widens what it may upload or where.
 */
export function buildSignedUploadParams(input: BuildUploadParamsInput): SignedUploadParams {
  if (!Number.isInteger(input.timestamp) || input.timestamp <= 0) {
    throw new UploadParamError("timestamp must be a positive integer (Unix seconds).");
  }

  // Folder is server-controlled and signed, so a client cannot direct an upload
  // outside the intended prefix. No slashes beyond the configured prefix.
  assertSafe(input.folder, "folder", /^[A-Za-z0-9][A-Za-z0-9_-]*(\/[A-Za-z0-9][A-Za-z0-9_-]*)*$/);

  // Free-text only reaches Cloudinary through `context`; strip anything that
  // could terminate the parameter or inject another one.
  assertSafe(input.productId, "productId", /^[A-Za-z0-9_-]{1,64}$/);

  return {
    timestamp: input.timestamp,
    folder: input.folder,
    allowed_formats: ALLOWED_FORMATS.join(","),
    max_file_size: MAX_UPLOAD_BYTES,
    eager: "c_limit,w_1200,h_1200,dpr_auto,q_auto,f_auto",
    tags: "grocery_product",
    context: `product_id=${input.productId}`,
  };
}

/**
 * Produce the exact string Cloudinary hashes.
 * Exported so tests can assert the ordering rule rather than trusting it.
 */
export function toSignaturePayload(params: SignedUploadParams): string {
  return Object.entries(params)
    .map(([name, value]) => [name, String(value)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
}
