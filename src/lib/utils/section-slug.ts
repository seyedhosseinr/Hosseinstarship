/**
 * Stable slug for a section title — used as element ID for scroll navigation.
 * Shared between YieldTab and sidebar micro-navigation.
 */
export function sectionSlug(title: string) {
  return `yield-section-${title.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "-")}`;
}
