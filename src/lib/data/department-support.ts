import type { DepartmentSlug } from "@/lib/departments";
import extra from "@/lib/data/department-support.json";

export type SupportPerson = {
  name: string;
  role: string;
  slug: DepartmentSlug;
  support: true;
};

const SUPPORT = extra as Record<string, Array<{ name: string; role: string }>>;

export function supportPeople(slug?: string | null): SupportPerson[] {
  if (slug) {
    return (SUPPORT[slug] ?? []).map((person) => ({
      ...person,
      slug: slug as DepartmentSlug,
      support: true,
    }));
  }
  return Object.entries(SUPPORT).flatMap(([dept, people]) =>
    people.map((person) => ({
      ...person,
      slug: dept as DepartmentSlug,
      support: true,
    })),
  );
}
