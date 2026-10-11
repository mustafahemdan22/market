"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "../lib/api";
import { formatEgp, STORE_LOCALE } from "../lib/format";
import { EmptyState, LoadingState } from "./States";

const STATUSES = ["all", "active", "draft", "archived"] as const;
type StatusFilter = (typeof STATUSES)[number];

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "All",
  active: "Active",
  draft: "Draft",
  archived: "Archived",
};

type ProductRow = {
  _id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  priceMinor: number;
  status: string;
  updatedAt: number;
};

export function ProductList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const trimmed = search.trim();
  const args =
    trimmed.length === 0 && status === "all"
      ? {}
      : {
          ...(trimmed.length === 0 ? {} : { search: trimmed }),
          ...(status === "all" ? {} : { status }),
        };

  const products = useQuery(api.admin.products.listProducts, args);

  if (products === undefined) {
    // Also covers the authorization failure: the server rejects the query and
    // Convex never returns a value, so the screen stays on "loading" rather
    // than pretending the catalogue is simply empty.
    return <LoadingState label="Loading products" />;
  }

  const rows = products as ProductRow[];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Products</h1>
          <p className="text-sm text-neutral-600">{rows.length} shown</p>
        </div>
        <Link
          href="/products/new"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          New product
        </Link>
      </header>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder="Product name or slug"
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
            }}
            className="rounded-md border border-neutral-300 px-3 py-2"
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No products match"
          description="Adjust the search or status filter, or create a new product."
          action={
            <Link href="/products/new" className="text-sm font-medium text-brand-600 underline">
              New product
            </Link>
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-start text-sm">
            <caption className="sr-only">Product catalogue</caption>
            <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-600">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  Product
                </th>
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  Slug
                </th>
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  Price
                </th>
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  Updated
                </th>
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => (
                <tr key={product._id} className="border-b border-neutral-100 last:border-0">
                  <th scope="row" className="px-4 py-3 text-start font-normal">
                    <span className="block font-medium">{product.nameEn}</span>
                    <span className="block text-xs text-neutral-600">{product.nameAr}</span>
                  </th>
                  <td className="tabular px-4 py-3 text-neutral-700">{product.slug}</td>
                  <td className="tabular px-4 py-3">
                    {formatEgp(product.priceMinor, STORE_LOCALE)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                      {product.status}
                    </span>
                  </td>
                  <td className="tabular px-4 py-3 text-neutral-600">
                    {new Date(product.updatedAt).toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <StatusToggle productId={product._id} current={product.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusToggle({ productId, current }: { productId: string; current: string }) {
  const setStatus = useMutation(api.admin.products.updateProductStatus);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = current === "active" ? "archived" : "active";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setPending(true);
          // `now` is an argument: a Convex mutation must stay deterministic.
          setStatus({ productId: productId as Id<"products">, status: next, now: Date.now() })
            .catch((err: unknown) => {
              // Surface the server's verdict; never swallow it.
              setError(err instanceof Error ? err.message : "Update failed");
            })
            .finally(() => {
              setPending(false);
            });
        }}
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50"
      >
        {next === "archived" ? "Archive" : "Activate"}
      </button>
      {error ? (
        <span className="max-w-[16rem] text-end text-xs text-danger-600" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
