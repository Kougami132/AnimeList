export function extractBangumiSubjectId(
  frontmatter: Record<string, unknown> | null | undefined,
): number | null {
  if (!frontmatter || typeof frontmatter !== "object") return null;

  // 1. Explicit source_provider === "bangumi"
  if (frontmatter.source_provider === "bangumi" && frontmatter.source_id != null) {
    const parsed = Number(frontmatter.source_id);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }

  // 2. Check source_urls
  const urls = Array.isArray(frontmatter.source_urls)
    ? frontmatter.source_urls
    : typeof frontmatter.source_urls === "string"
      ? [frontmatter.source_urls]
      : [];

  for (const url of urls) {
    if (typeof url === "string") {
      const match = url.match(/(?:bgm\.tv|bangumi\.tv)\/subject\/(\d+)/);
      if (match) {
        const parsed = Number(match[1]);
        if (Number.isInteger(parsed) && parsed > 0) return parsed;
      }
    }
  }

  // 3. If source_provider is explicitly set to another provider, do not match source_id
  if (frontmatter.source_provider && frontmatter.source_provider !== "bangumi") {
    return null;
  }

  // 4. Fallback: if media_type is anime or absent, and source_id is numeric
  if (frontmatter.source_id != null && (frontmatter.media_type === "anime" || !frontmatter.media_type)) {
    const parsed = Number(frontmatter.source_id);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }

  return null;
}
