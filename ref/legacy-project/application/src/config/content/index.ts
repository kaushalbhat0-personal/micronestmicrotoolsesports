export * from "./guides";
export * from "./glossary";
export * from "./use-cases";

// Validation: duplicate slugs, missing references
import { GUIDES } from "./guides";
import { GLOSSARY } from "./glossary";
import { USE_CASES } from "./use-cases";

export function validateContentRegistry() {
  const allSlugs = [
    ...GUIDES.map((g: { slug: string }) => `guides/${g.slug}`),
    ...GLOSSARY.map((g: { slug: string }) => `glossary/${g.slug}`),
    ...USE_CASES.map((g: { slug: string }) => `use-cases/${g.slug}`),
  ];
  const dup = allSlugs.filter((s, i) => allSlugs.indexOf(s) !== i);
  if (dup.length) throw new Error(`Duplicate content slugs: ${dup.join(", ")}`);
}
