/**
 * @module location_normalizer
 * Standalone, zero-dependency canonical location normalizer and scope classifier
 * for ATS job board feeds (Ashby, Greenhouse, Lever, Workday).
 *
 * Combines Unicode CLDR (via native Intl.DisplayNames) with domain-specific ATS rules.
 */

import {
  COUNTRY_SYNONYMS,
  GLOBAL_SCOPES,
  METRO_ALIASES,
  SUBDIVISIONS,
} from "./geo_aliases.js";

// ============================================================================
// 1. Unicode CLDR Standard Region Resolver (Native ECMAScript Intl API)
// ============================================================================

let intlRegionNames = null;
try {
  if (typeof Intl !== "undefined" && Intl.DisplayNames) {
    intlRegionNames = new Intl.DisplayNames(["en"], { type: "region" });
  }
} catch {
  // Graceful fallback for non-standard environments
  intlRegionNames = null;
}

// Recruiter decorator removal pattern: (HQ), [Hybrid], (Office), [Remote], etc.
const DECORATORS_REGEX =
  /\s*(\[[^\]]*\]|\((?:hq|headquarters|office|tech hub|hybrid|remote|onsite|on-site|americas|emea|apac|latam|flex)[^)]*\))\s*/gi;

// ============================================================================
// 2. Normalization Functions
// ============================================================================

/**
 * Normalizes any country name, code, or synonym to ISO standard English common name.
 * Uses native Unicode CLDR (Intl.DisplayNames) for standard ISO codes with fallback to synonym registry.
 *
 * @param {string|null} country
 * @returns {string|null}
 */
export function normalizeCountry(country) {
  if (!country || typeof country !== "string") return null;
  const clean = country.trim().toLowerCase();
  if (!clean) return null;

  // 1. Check known recruiter synonym registry (e.g. "USA", "UK", "UAE", "Korea")
  if (COUNTRY_SYNONYMS[clean]) {
    return COUNTRY_SYNONYMS[clean];
  }

  // 2. Check native Unicode CLDR via Intl.DisplayNames for standard 2-letter ISO codes (e.g. "IS", "UY", "NO", "DE")
  if (clean.length === 2 && intlRegionNames) {
    try {
      const standardName = intlRegionNames.of(clean.toUpperCase());
      if (standardName && standardName !== clean.toUpperCase()) {
        return standardName;
      }
    } catch {
      // Ignore invalid ISO code exceptions
    }
  }

  // 3. Open-world fallback: return trimmed string cleanly
  return country.trim();
}

/**
 * Strips recruiter decorators like (HQ), [Hybrid], (Office) from location text.
 * @param {string} text
 * @returns {string}
 */
export function stripDecorators(text) {
  if (!text) return "";
  return text.replace(DECORATORS_REGEX, " ").replace(/\s+/g, " ").trim();
}

/**
 * Classifies the geographical scope of a job location.
 * Distinguishes global/multi-national, country-wide, state/region-wide, and metro/local postings.
 *
 * @param {string} rawLocation
 * @param {string|null} country
 * @returns {"global" | "country" | "region" | "metro" | "unspecified"}
 */
export function classifyScope(rawLocation, country = null) {
  if (!rawLocation || typeof rawLocation !== "string") return "unspecified";
  const raw = rawLocation.trim().toLowerCase();
  if (!raw || raw === "unspecified") return "unspecified";
  const stripped = stripDecorators(rawLocation).toLowerCase();

  // 1. Multi-national or global broad scope
  if (GLOBAL_SCOPES.has(raw) || GLOBAL_SCOPES.has(stripped)) return "global";

  // 2. Direct country match
  const directCountry = COUNTRY_SYNONYMS[raw];
  if (directCountry) return "country";
  if (raw.length === 2 && intlRegionNames) {
    try {
      if (intlRegionNames.of(raw.toUpperCase())) return "country";
    } catch {
      // not a country code
    }
  }

  // 3. Remote and anywhere patterns
  if (
    raw === "remote" ||
    raw.startsWith("remote -") ||
    raw.startsWith("remote (") ||
    raw.startsWith("remote,") ||
    raw.startsWith("anywhere in") ||
    raw.startsWith("anywhere -") ||
    raw.startsWith("remote ")
  ) {
    const suffix = raw
      .replace(/^anywhere\s+(in\s+)?/i, "")
      .replace(/^remote\s*/i, "")
      .replace(/^[-–—_,() ]+/, "")
      .replace(/\[.*?\]|\(.*?\)/g, "")
      .replace(/[.\-_]+$/, "")
      .trim();

    // Check if suffix is a state/province subdivision (e.g. "California", "Texas", "CA")
    if (
      SUBDIVISIONS[suffix] ||
      Object.values(SUBDIVISIONS).some((v) => v.name.toLowerCase() === suffix)
    ) {
      return "region";
    }

    // Check if suffix resolves to a country
    if (
      COUNTRY_SYNONYMS[suffix] ||
      (suffix.length === 2 && intlRegionNames)
    ) {
      return "country";
    }

    return "country";
  }

  // 4. Country context match (e.g. raw string contains "remote" + country name)
  if (country) {
    const cLow = country.toLowerCase();
    if (raw.includes("remote") && raw.includes(cLow)) return "country";
    if (raw === `remote - ${cLow}` || raw === `${cLow} - remote`) return "country";
  }

  return "metro";
}

/**
 * Normalizes a city/metro name against canonical gazetteer, recruiter aliases, and open-world fallback.
 *
 * @param {string|null} rawName
 * @param {string|null} locality
 * @param {string|null} country
 * @param {string|null} region
 * @returns {string|null}
 */
export function normalizeMetro(rawName, locality = null, country = null, region = null) {
  const scope = classifyScope(rawName, country);
  if (scope === "global" || scope === "country" || scope === "unspecified") {
    return null;
  }

  let candidate = stripDecorators(rawName || "");

  // Handle standard "City, State/Country" separation
  if (candidate.includes(",")) {
    const parts = candidate.split(",");
    candidate = parts[0].trim();
  }

  // Remove trailing parentheticals
  candidate = candidate.replace(/\s*\([^)]*\)/g, "").trim();

  // If candidate is a country name or alias, fall back to postal locality
  if (country) {
    const cLow = country.toLowerCase();
    const candLow = candidate.toLowerCase();
    if (
      candLow === cLow ||
      (country === "United States" && (candLow === "usa" || candLow === "us")) ||
      (country === "South Korea" && candLow === "korea")
    ) {
      candidate = locality || "";
    }
  }

  if (!candidate && locality) {
    candidate = locality;
  }

  const clean = candidate.trim();
  if (!clean) return null;

  const low = clean.toLowerCase();

  // Check recruiter typo / alias registry
  if (METRO_ALIASES[low]) {
    return METRO_ALIASES[low];
  }

  if (country && low === country.toLowerCase()) return null;

  // Washington D.C. special case
  if (
    country === "United States" &&
    low === "washington" &&
    (!region || region.toLowerCase() === "dc" || region.toLowerCase().includes("columbia"))
  ) {
    return "Washington, DC";
  }

  // Open-world fallback: return the clean city name directly (e.g. Bratislava, Nagoya, Groningen)
  return clean;
}

/**
 * Full Canonical Location Normalization Pipeline.
 * Consumes raw ATS location fields and outputs a canonical, structured location object.
 *
 * @param {Object} rawInput
 * @param {string} [rawInput.rawName] - Raw location string typed by recruiter (e.g. "San Francisco, CA")
 * @param {string} [rawInput.locality] - postalAddress.addressLocality (e.g. "San Fransisco")
 * @param {string} [rawInput.region] - postalAddress.addressRegion (e.g. "California ")
 * @param {string} [rawInput.country] - postalAddress.addressCountry (e.g. "USA")
 * @returns {Object} CanonicalNormalizedLocation
 */
export function normalizeLocation({ rawName, locality, region, country }) {
  const normCountry = normalizeCountry(country);
  const cleanRawName = (rawName || "").trim() || "Unspecified";
  const cleanLocality = (locality || "").trim() || null;
  const cleanRegion = (region || "").trim() || null;

  const scope = classifyScope(cleanRawName, normCountry);
  const isRemote =
    scope === "global" ||
    scope === "country" ||
    scope === "region" ||
    cleanRawName.toLowerCase().includes("remote");

  const canonicalCity = normalizeMetro(cleanRawName, cleanLocality, normCountry, cleanRegion);

  // Derive composite display name
  let displayName = normCountry || "Unspecified";
  if (canonicalCity) {
    displayName = normCountry ? `${canonicalCity}, ${normCountry}` : canonicalCity;
  } else if (isRemote && normCountry) {
    displayName = `${normCountry} (Remote)`;
  } else if (cleanRawName && cleanRawName !== "Unspecified") {
    displayName = cleanRawName;
  }

  // Derive stable compound key for faceted filtering
  let compoundKey;
  if (canonicalCity && normCountry) {
    compoundKey = `p:${normCountry}|||${canonicalCity}`;
  } else if (normCountry) {
    compoundKey = `c:${normCountry}`;
  } else {
    compoundKey = `p:|||${cleanRawName}`;
  }

  return {
    rawName: cleanRawName,
    canonicalCountry: normCountry,
    canonicalRegion: cleanRegion,
    canonicalCity,
    scope,
    isRemote,
    displayName,
    compoundKey,
  };
}

/**
 * Extracts a clean Ashby board slug from a raw slug or Ashby URL.
 * Supports https://jobs.ashbyhq.com/<slug> and https://api.ashbyhq.com/posting-api/job-board/<slug>.
 *
 * @param {string|null} input
 * @returns {string|null}
 */
export function parseAshbySlug(input) {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const jobsMatch = trimmed.match(/jobs\.ashbyhq\.com\/([a-zA-Z0-9_.-]+)/i);
  if (jobsMatch) return jobsMatch[1].toLowerCase();

  const apiMatch = trimmed.match(/job-board\/([a-zA-Z0-9_.-]+)/i);
  if (apiMatch) return apiMatch[1].toLowerCase();

  const slug = trimmed.toLowerCase().replace(/[^a-z0-9_.-]/g, "");
  return slug || null;
}

/**
 * Generates ordered Ashby board slug candidates from a company name, website URL,
 * jobs.ashbyhq.com URL, or Ashby Posting API URL.
 *
 * @param {string|null} input
 * @returns {string[]}
 */
export function extractAshbyCandidates(input) {
  if (!input || typeof input !== "string") return [];
  const trimmed = input.trim();
  if (!trimmed) return [];

  // 1. Explicit Ashby job board or Posting API URL -> exact slug only
  const jobsMatch = trimmed.match(/jobs\.ashbyhq\.com\/([a-zA-Z0-9_.-]+)/i);
  if (jobsMatch) return [jobsMatch[1].toLowerCase()];

  const apiMatch = trimmed.match(/job-board\/([a-zA-Z0-9_.-]+)/i);
  if (apiMatch) return [apiMatch[1].toLowerCase()];

  // 2. General website URL (e.g. https://www.linear.app/careers or notion.so)
  if (/^https?:\/\//i.test(trimmed) || /^[a-z0-9-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) {
    try {
      const normalizedUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      const urlObj = new URL(normalizedUrl);
      const hostParts = urlObj.hostname
        .toLowerCase()
        .replace(/^www\./, "")
        .split(".")
        .filter(Boolean);
      const domainRoot = hostParts.length >= 2 ? hostParts[hostParts.length - 2] : hostParts[0];
      if (domainRoot) {
        const compact = domainRoot.replace(/[^a-z0-9]/g, "");
        return [...new Set([domainRoot, compact].filter(Boolean))];
      }
    } catch {
      // Fall through to name parsing
    }
  }

  // 3. Plain company name or slug (e.g. "Influx Data", "Linear", "OpenAI")
  const lower = trimmed.toLowerCase();
  const compact = lower.replace(/[^a-z0-9]/g, "");
  const hyphenated = lower.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const rawSlug = lower.replace(/[^a-z0-9_.-]/g, "");

  return [...new Set([rawSlug, compact, hyphenated].filter(Boolean))];
}
