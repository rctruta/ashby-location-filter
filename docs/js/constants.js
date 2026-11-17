export const MANIFEST_URL = "data/manifest.json";
export const DEFAULT_COMPANY = "all";

export const WORKPLACES = [
  ["Remote", "Remote"],
  ["Hybrid", "Hybrid"],
  ["OnSite", "On-site"],
  [null, "Not specified"],
];

export const STATUS_OPTIONS = [
  ["all", "All statuses"],
  ["active", "Active only"],
  ["new", "Newly added"],
  ["removed", "Delisted only"],
];

export const GROUP_MODES = [
  ["company", "Group by Company"],
  ["department", "Group by Department"],
  ["location", "Group by Location"],
  ["flat", "Flat List"],
];

// Harmonious, curated palette of hues (0-360) for dynamic company branding
export const COMPANY_PALETTE_HUES = [
  262, // Violet (Cohere)
  88,  // Lime Green (Ramp)
  232, // Indigo (Linear)
  332, // Rose/Pink (InfluxData)
  24,  // Coral/Orange (Ashby)
  180, // Teal
  200, // Sky Blue
  45,  // Gold/Amber
  290, // Magenta
  150, // Emerald
];

export function getCompanyHue(companyId) {
  if (!companyId) return 220;
  let hash = 0;
  const str = String(companyId).toLowerCase().trim();
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  const index = Math.abs(hash) % COMPANY_PALETTE_HUES.length;
  return COMPANY_PALETTE_HUES[index];
}
