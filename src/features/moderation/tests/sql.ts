// Shared static-SQL test helper (P11). Negative assertions (no privilege,
// no forbidden object) must run against executable SQL, not the header prose
// that documents the very thing being forbidden. Strips `--` line comments
// and collapses whitespace for stable matching.

export function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => {
      const marker = line.indexOf("--");
      return marker === -1 ? line : line.slice(0, marker);
    })
    .join("\n");
}
