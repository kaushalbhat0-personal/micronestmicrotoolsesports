export * from "./guides";
export * from "./glossary";
export * from "./use-cases";

// Validation: duplicate slugs, missing references
export function validateContentRegistry() {
  const allSlugs = [
    ...require("./guides").GUIDES.map((g: { slug: string }) => `guides/${g.slug}`),
    ...require("./glossary").GLOSSARY.map((g: { slug: string }) => `glossary/${g.slug}`),
    ...require("./use-cases").USE_CASES.map((g: { slug: string }) => `use-cases/${g.slug}`),
  ];
  const dup = allSlugs.filter((s, i) => allSlugs.indexOf(s) !== i);
  if (dup.length) throw new Error(`Duplicate content slugs: ${dup.join(", ")}`);
}
