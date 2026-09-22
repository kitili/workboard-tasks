"use client";

import Link from "next/link";

export function Pager({
  page,
  pages,
  basePath,
  onPage,
}: {
  page: number;
  pages: number;
  basePath?: string;
  onPage?: (page: number) => void;
}) {
  if (pages <= 1) return null;

  const previous = page > 1 ? page - 1 : null;
  const next = page < pages ? page + 1 : null;

  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Pages">
      {onPage ? (
        <button
          type="button"
          disabled={!previous}
          onClick={() => previous && onPage(previous)}
          className="rounded-xl border border-[#002368]/20 px-4 py-2 text-sm font-medium text-[#002368] disabled:opacity-40"
        >
          Previous
        </button>
      ) : (
        <Link
          href={previous ? `${basePath}?page=${previous}` : "#"}
          aria-disabled={!previous}
          className={`rounded-xl border border-[#002368]/20 px-4 py-2 text-sm font-medium text-[#002368] ${
            previous ? "" : "pointer-events-none opacity-40"
          }`}
        >
          Previous
        </Link>
      )}
      <p className="text-sm text-[#4f555f]">
        Page {page} of {pages}
      </p>
      {onPage ? (
        <button
          type="button"
          disabled={!next}
          onClick={() => next && onPage(next)}
          className="rounded-xl border border-[#002368]/20 px-4 py-2 text-sm font-medium text-[#002368] disabled:opacity-40"
        >
          Next
        </button>
      ) : (
        <Link
          href={next ? `${basePath}?page=${next}` : "#"}
          aria-disabled={!next}
          className={`rounded-xl border border-[#002368]/20 px-4 py-2 text-sm font-medium text-[#002368] ${
            next ? "" : "pointer-events-none opacity-40"
          }`}
        >
          Next
        </Link>
      )}
    </nav>
  );
}
