/**
 * Human copy for prize-splitter share-link decode failures.
 * The decoder returns structured internal codes (including raw validation
 * detail); this map is the only user-facing surface — codes are never
 * rendered. Unknown codes fall through to the tampered-link sentence.
 */
export function shareLinkErrorCopy(error: string | undefined): string {
  if (error === "version") {
    return "This share link uses an unsupported version. Please generate a new link.";
  }
  if (error === "too long") {
    return "This share link is too large.";
  }
  return "This share link is malformed or has been tampered with.";
}
