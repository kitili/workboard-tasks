type TapTask = {
  title: string;
  departmentSlug: string | null;
  labels?: string[];
};

/** The board card for a TAP line, even after the 1–5 title has been edited. */
export function taskForTapLine<T extends TapTask>(tasks: T[], slug: string, code: string, catalogTitle: string) {
  const rock = `Rock ${code}`;
  const exact = `${code} ${catalogTitle}`;
  return (
    tasks.find((row) => row.departmentSlug === slug && row.labels?.includes(rock)) ??
    tasks.find((row) => row.departmentSlug === slug && row.title === exact)
  );
}
