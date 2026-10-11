import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Fresh Market — Admin</h1>
      <p className="text-sm text-neutral-600">
        Product, category, stock and image management for store staff.
      </p>
      <Link
        href="/products"
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Open product catalogue
      </Link>
    </main>
  );
}
