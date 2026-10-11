"use client";

/**
 * Explicit state components.
 *
 * The brief requires loading, empty, error, success and confirmation states.
 * `AuthDenied` is deliberately its own state: "you are signed in but not an
 * administrator" is a different problem from "something went wrong", and
 * conflating them hides a misconfigured PANDAMA_ADMIN_SUBJECTS allowlist.
 */

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="card p-8 text-center text-sm text-neutral-600" role="status" aria-live="polite">
      <span className="inline-block animate-pulse">{label}…</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card p-10 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-neutral-600">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card border-danger-600 p-6" role="alert">
      <h2 className="text-base font-semibold text-danger-600">Something went wrong</h2>
      <p className="mt-1 text-sm text-neutral-700">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function AuthDenied({ message }: { message: string }) {
  return (
    <div className="card border-warning-600 bg-warning-50 p-6" role="alert">
      <h2 className="text-base font-semibold text-warning-600">Administrator access required</h2>
      <p className="mt-1 text-sm text-neutral-700">{message}</p>
      <p className="mt-3 text-xs text-neutral-600">
        Authorization is decided on the server by the <code>PANDAMA_ADMIN_SUBJECTS</code> allowlist
        read from the verified Clerk token. This page cannot grant access.
      </p>
    </div>
  );
}
