"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "../lib/api";
import { inputToMinor } from "../lib/format";
import { LoadingState } from "./States";

type FieldErrors = Partial<Record<string, string>>;

export function ProductCreateForm() {
  const router = useRouter();
  const categories = useQuery(api.admin.categories.listCategories, {});

  const createProduct = useMutation(api.admin.products.createProduct);

  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [sku, setSku] = useState("");
  const [unitLabel, setUnitLabel] = useState("per 1 kg");

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (categories === undefined) {
    return <LoadingState label="Loading categories" />;
  }

  if (categories.length === 0) {
    return (
      <div className="card border-warning-600 bg-warning-50 p-6" role="alert">
        <h2 className="text-base font-semibold">Create a category first</h2>
        <p className="mt-1 text-sm text-neutral-700">
          A product must belong to a category, and no active categories exist yet.
        </p>
      </div>
    );
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (nameEn.trim().length === 0) next["nameEn"] = "English name is required";
    if (nameAr.trim().length === 0) next["nameAr"] = "Arabic name is required";
    if (descriptionEn.trim().length === 0)
      next["descriptionEn"] = "English description is required";
    if (descriptionAr.trim().length === 0) next["descriptionAr"] = "Arabic description is required";
    if (sku.trim().length === 0) next["sku"] = "SKU is required";
    if (inputToMinor(price) === null) {
      next["price"] = "Enter a positive price with at most 2 decimals, e.g. 12.50";
    }
    const stockNumber = Number(stock);
    if (!Number.isInteger(stockNumber) || stockNumber < 0) {
      next["stock"] = "Stock must be a whole number, 0 or more";
    }
    if (categoryId.length === 0) next["categoryId"] = "Choose a category";
    return next;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setCreated(null);

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const priceMinor = inputToMinor(price);
    if (priceMinor === null) return;

    setPending(true);
    try {
      await createProduct({
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim(),
        descriptionEn: descriptionEn.trim(),
        descriptionAr: descriptionAr.trim(),
        categoryId: categoryId as Id<"categories">,
        unitLabel: unitLabel.trim() || "per unit",
        sku: sku.trim(),
        variantNameEn: "Default",
        variantNameAr: "افتراضي",
        priceMinor,
        stock: Number(stock),
        status: "active",
        now: Date.now(),
      });
      setCreated("Product created.");
    } catch (err: unknown) {
      // The server is the authority on duplicate SKUs, categories, and auth.
      setFormError(err instanceof Error ? err.message : "Could not create the product.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="card space-y-4 p-6"
      noValidate
    >
      <h1 className="text-xl font-semibold">New product</h1>

      {formError ? (
        <p className="rounded-md border border-danger-600 bg-danger-50 p-3 text-sm" role="alert">
          {formError}
        </p>
      ) : null}
      {created ? (
        <p
          className="rounded-md border border-brand-600 bg-brand-50 p-3 text-sm"
          role="status"
          aria-live="polite"
        >
          {created}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="nameEn"
          label="English name"
          value={nameEn}
          error={errors["nameEn"]}
          onChange={setNameEn}
          dir="ltr"
        />
        <TextField
          id="nameAr"
          label="Arabic name"
          value={nameAr}
          error={errors["nameAr"]}
          onChange={setNameAr}
          dir="rtl"
        />
        <TextField
          id="descriptionEn"
          label="English description"
          value={descriptionEn}
          error={errors["descriptionEn"]}
          onChange={setDescriptionEn}
          dir="ltr"
        />
        <TextField
          id="descriptionAr"
          label="Arabic description"
          value={descriptionAr}
          error={errors["descriptionAr"]}
          onChange={setDescriptionAr}
          dir="rtl"
        />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Category</span>
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
          }}
          aria-invalid={errors["categoryId"] !== undefined}
          className="rounded-md border border-neutral-300 px-3 py-2"
        >
          <option value="">Select a category…</option>
          {categories.map((category) => (
            <option key={category._id} value={category._id}>
              {category.nameEn} / {category.nameAr}
            </option>
          ))}
        </select>
        {errors["categoryId"] ? (
          <span className="text-xs text-danger-600">{errors["categoryId"]}</span>
        ) : null}
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          id="price"
          label="Price (EGP)"
          value={price}
          error={errors["price"]}
          onChange={setPrice}
          inputMode="decimal"
          dir="ltr"
        />
        <TextField
          id="stock"
          label="Stock on hand"
          value={stock}
          error={errors["stock"]}
          onChange={setStock}
          inputMode="numeric"
          dir="ltr"
        />
        <TextField
          id="sku"
          label="SKU"
          value={sku}
          error={errors["sku"]}
          onChange={setSku}
          dir="ltr"
        />
      </div>

      <TextField
        id="unitLabel"
        label="Unit label"
        value={unitLabel}
        onChange={setUnitLabel}
        dir="ltr"
      />

      <p className="text-xs text-neutral-600">
        The stored price is the final customer-facing shelf price and already includes VAT. No tax
        line is added. Price and stock are re-validated on the server.
      </p>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create product"}
        </button>
        <button
          type="button"
          onClick={() => {
            router.push("/products");
          }}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  inputMode,
  dir,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  inputMode?: "decimal" | "numeric" | undefined;
  dir: "ltr" | "rtl";
}) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        value={value}
        dir={dir}
        inputMode={inputMode}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : undefined}
        className="rounded-md border border-neutral-300 px-3 py-2"
      />
      {error ? (
        <span id={errorId} className="text-xs text-danger-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}
