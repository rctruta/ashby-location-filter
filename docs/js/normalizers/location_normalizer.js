/**
 * @module location_normalizer
 * Standalone, zero-dependency canonical location normalizer and scope classifier
 * designed for Applicant Tracking System (ATS) job board feeds.
 *
 * Compatible with Ashby, Greenhouse, Lever, Workday, and custom ATS feeds.
 * Can be run in the browser or Node.js.
 */

// ============================================================================
// 1. Geographic Reference Standards (ISO 3166-1 Country Registry)
// ============================================================================

export const COUNTRY_CANONICAL_MAP = new Map([
  // North America
  ["usa", "United States"],
  ["us", "United States"],
  ["united states", "United States"],
  ["united states of america", "United States"],
  ["u.s.", "United States"],
  ["u.s.a.", "United States"],
  ["ca", "Canada"],
  ["can", "Canada"],
  ["canada", "Canada"],
  ["mex", "Mexico"],
  ["mexico", "Mexico"],

  // Europe & UK
  ["uk", "United Kingdom"],
  ["gb", "United Kingdom"],
  ["gbr", "United Kingdom"],
  ["great britain", "United Kingdom"],
  ["united kingdom", "United Kingdom"],
  ["england", "United Kingdom"],
  ["scotland", "United Kingdom"],
  ["wales", "United Kingdom"],
  ["northern ireland", "United Kingdom"],
  ["de", "Germany"],
  ["deu", "Germany"],
  ["germany", "Germany"],
  ["deutschland", "Germany"],
  ["fr", "France"],
  ["fra", "France"],
  ["france", "France"],
  ["es", "Spain"],
  ["esp", "Spain"],
  ["spain", "Spain"],
  ["españa", "Spain"],
  ["it", "Italy"],
  ["ita", "Italy"],
  ["italy", "Italy"],
  ["italia", "Italy"],
  ["ie", "Ireland"],
  ["irl", "Ireland"],
  ["ireland", "Ireland"],
  ["republic of ireland", "Ireland"],
  ["nl", "Netherlands"],
  ["nld", "Netherlands"],
  ["netherlands", "Netherlands"],
  ["holland", "Netherlands"],
  ["be", "Belgium"],
  ["bel", "Belgium"],
  ["belgium", "Belgium"],
  ["ch", "Switzerland"],
  ["che", "Switzerland"],
  ["switzerland", "Switzerland"],
  ["se", "Sweden"],
  ["swe", "Sweden"],
  ["sweden", "Sweden"],
  ["no", "Norway"],
  ["nor", "Norway"],
  ["norway", "Norway"],
  ["dk", "Denmark"],
  ["dnk", "Denmark"],
  ["denmark", "Denmark"],
  ["pl", "Poland"],
  ["pol", "Poland"],
  ["poland", "Poland"],
  ["pt", "Portugal"],
  ["prt", "Portugal"],
  ["portugal", "Portugal"],
  ["at", "Austria"],
  ["aut", "Austria"],
  ["austria", "Austria"],
  ["cz", "Czech Republic"],
  ["cze", "Czech Republic"],
  ["czech republic", "Czech Republic"],
  ["czechia", "Czech Republic"],
  ["ro", "Romania"],
  ["rou", "Romania"],
  ["romania", "Romania"],
  ["hu", "Hungary"],
  ["hun", "Hungary"],
  ["hungary", "Hungary"],
  ["hr", "Croatia"],
  ["hrv", "Croatia"],
  ["croatia", "Croatia"],
  ["ee", "Estonia"],
  ["est", "Estonia"],
  ["estonia", "Estonia"],
  ["european union", "European Union"],
  ["eu", "European Union"],
  ["europe", "European Union"],

  // Asia Pacific
  ["au", "Australia"],
  ["aus", "Australia"],
  ["australia", "Australia"],
  ["nz", "New Zealand"],
  ["nzl", "New Zealand"],
  ["new zealand", "New Zealand"],
  ["sg", "Singapore"],
  ["sgp", "Singapore"],
  ["singapore", "Singapore"],
  ["jp", "Japan"],
  ["jpn", "Japan"],
  ["japan", "Japan"],
  ["kr", "South Korea"],
  ["kor", "South Korea"],
  ["korea", "South Korea"],
  ["south korea", "South Korea"],
  ["republic of korea", "South Korea"],
  ["ph", "Philippines"],
  ["phl", "Philippines"],
  ["philippines", "Philippines"],
  ["in", "India"],
  ["ind", "India"],
  ["india", "India"],

  // Middle East & Latin America
  ["ae", "United Arab Emirates"],
  ["are", "United Arab Emirates"],
  ["uae", "United Arab Emirates"],
  ["united arab emirates", "United Arab Emirates"],
  ["sa", "Saudi Arabia"],
  ["sau", "Saudi Arabia"],
  ["saudi arabia", "Saudi Arabia"],
  ["il", "Israel"],
  ["isr", "Israel"],
  ["israel", "Israel"],
  ["br", "Brazil"],
  ["bra", "Brazil"],
  ["brazil", "Brazil"],
  ["brasil", "Brazil"],
]);

// ============================================================================
// 2. Subdivisions (US States & Canadian Provinces)
// ============================================================================

export const SUBDIVISIONS = new Map([
  // US States
  ["al", { name: "Alabama", country: "United States" }],
  ["ak", { name: "Alaska", country: "United States" }],
  ["az", { name: "Arizona", country: "United States" }],
  ["ar", { name: "Arkansas", country: "United States" }],
  ["ca", { name: "California", country: "United States" }],
  ["co", { name: "Colorado", country: "United States" }],
  ["ct", { name: "Connecticut", country: "United States" }],
  ["de", { name: "Delaware", country: "United States" }],
  ["fl", { name: "Florida", country: "United States" }],
  ["ga", { name: "Georgia", country: "United States" }],
  ["hi", { name: "Hawaii", country: "United States" }],
  ["id", { name: "Idaho", country: "United States" }],
  ["il", { name: "Illinois", country: "United States" }],
  ["in", { name: "Indiana", country: "United States" }],
  ["ia", { name: "Iowa", country: "United States" }],
  ["ks", { name: "Kansas", country: "United States" }],
  ["ky", { name: "Kentucky", country: "United States" }],
  ["la", { name: "Louisiana", country: "United States" }],
  ["me", { name: "Maine", country: "United States" }],
  ["md", { name: "Maryland", country: "United States" }],
  ["ma", { name: "Massachusetts", country: "United States" }],
  ["mi", { name: "Michigan", country: "United States" }],
  ["mn", { name: "Minnesota", country: "United States" }],
  ["ms", { name: "Mississippi", country: "United States" }],
  ["mo", { name: "Missouri", country: "United States" }],
  ["mt", { name: "Montana", country: "United States" }],
  ["ne", { name: "Nebraska", country: "United States" }],
  ["nv", { name: "Nevada", country: "United States" }],
  ["nh", { name: "New Hampshire", country: "United States" }],
  ["nj", { name: "New Jersey", country: "United States" }],
  ["nm", { name: "New Mexico", country: "United States" }],
  ["ny", { name: "New York", country: "United States" }],
  ["nc", { name: "North Carolina", country: "United States" }],
  ["nd", { name: "North Dakota", country: "United States" }],
  ["oh", { name: "Ohio", country: "United States" }],
  ["ok", { name: "Oklahoma", country: "United States" }],
  ["or", { name: "Oregon", country: "United States" }],
  ["pa", { name: "Pennsylvania", country: "United States" }],
  ["ri", { name: "Rhode Island", country: "United States" }],
  ["sc", { name: "South Carolina", country: "United States" }],
  ["sd", { name: "South Dakota", country: "United States" }],
  ["tn", { name: "Tennessee", country: "United States" }],
  ["tx", { name: "Texas", country: "United States" }],
  ["ut", { name: "Utah", country: "United States" }],
  ["vt", { name: "Vermont", country: "United States" }],
  ["va", { name: "Virginia", country: "United States" }],
  ["wa", { name: "Washington", country: "United States" }],
  ["wv", { name: "West Virginia", country: "United States" }],
  ["wi", { name: "Wisconsin", country: "United States" }],
  ["wy", { name: "Wyoming", country: "United States" }],
  ["dc", { name: "Washington, DC", country: "United States" }],

  // Canadian Provinces
  ["ab", { name: "Alberta", country: "Canada" }],
  ["bc", { name: "British Columbia", country: "Canada" }],
  ["mb", { name: "Manitoba", country: "Canada" }],
  ["nb", { name: "New Brunswick", country: "Canada" }],
  ["nl", { name: "Newfoundland and Labrador", country: "Canada" }],
  ["ns", { name: "Nova Scotia", country: "Canada" }],
  ["on", { name: "Ontario", country: "Canada" }],
  ["pe", { name: "Prince Edward Island", country: "Canada" }],
  ["qc", { name: "Quebec", country: "Canada" }],
  ["sk", { name: "Saskatchewan", country: "Canada" }],
]);

// ============================================================================
// 3. Metro Aliases & ATS Recruiter Typos
// ============================================================================

export const METRO_CANONICAL_MAP = new Map([
  // San Francisco Bay Area & Ramp typo
  ["san fransisco", "San Francisco"],
  ["san francisco", "San Francisco"],
  ["sf", "San Francisco"],
  ["sf bay area", "San Francisco"],
  ["san francisco bay area", "San Francisco"],

  // New York
  ["new york city", "New York"],
  ["nyc", "New York"],
  ["new york", "New York"],
  ["manhattan", "New York"],
  ["brooklyn", "New York"],

  // Washington D.C.
  ["washington d.c.", "Washington, DC"],
  ["washington dc", "Washington, DC"],
  ["washington, d.c.", "Washington, DC"],
  ["washington, dc", "Washington, DC"],
  ["district of columbia", "Washington, DC"],

  // Other common tech hubs
  ["seattle area", "Seattle"],
  ["greater london", "London"],
  ["greater toronto area", "Toronto"],
  ["gta", "Toronto"],
  ["greater vancouver", "Vancouver"],
]);

// ============================================================================
// 4. ATS Decorator & Keyword Patterns
// ============================================================================

const DECORATORS_REGEX = /\s*(\((hq|headquarters|office|hybrid|remote|onsite|on-site|americas|emea|apac|latam|us|usa|uk|canada)\)|\[(hq|headquarters|office|hybrid|remote|onsite|on-site)\])\s*/gi;

// Global / Multi-country scopes
const GLOBAL_SCOPES = new Set([
  "global",
  "worldwide",
  "anywhere",
  "apac",
  "emea",
  "latam",
  "americas",
  "europe",
  "north america",
  "remote (us or canada)",
  "remote (us/canada)",
  "remote (canada or us)",
  "remote us or canada",
  "us or canada",
]);

// ============================================================================
// 5. Normalization Functions
// ============================================================================

/**
 * Normalizes any country name, code, or synonym to ISO 3166-1 English common name.
 * @param {string|null} country
 * @returns {string|null}
 */
export function normalizeCountry(country) {
  if (!country || typeof country !== "string") return null;
  const clean = country.trim().toLowerCase();
  return COUNTRY_CANONICAL_MAP.get(clean) || (country.trim() || null);
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
 * @param {string} rawLocation
 * @param {string|null} country
 * @returns {"global" | "country" | "region" | "metro" | "unspecified"}
 */
export function classifyScope(rawLocation, country = null) {
  if (!rawLocation || typeof rawLocation !== "string") return "unspecified";
  const raw = rawLocation.trim().toLowerCase();
  if (!raw || raw === "unspecified") return "unspecified";

  if (GLOBAL_SCOPES.has(raw)) return "global";

  // Check if string matches a country name or code directly
  const directCountry = COUNTRY_CANONICAL_MAP.get(raw);
  if (directCountry) return "country";

  // Country-wide and Region-wide remote patterns
  if (
    raw === "remote" ||
    raw.startsWith("remote -") ||
    raw.startsWith("remote (") ||
    raw.startsWith("remote,") ||
    raw.startsWith("anywhere in") ||
    raw.startsWith("anywhere -") ||
    raw.startsWith("remote ")
  ) {
    let suffix = raw
      .replace(/^remote\s*[-–(,]?\s*/, "")
      .replace(/\)$/, "")
      .trim();

    // Check if suffix is a state or province (e.g. "California", "Idaho", "CA")
    if (
      SUBDIVISIONS.has(suffix) ||
      [...SUBDIVISIONS.values()].some((v) => v.name.toLowerCase() === suffix)
    ) {
      return "region";
    }

    // Check if suffix is a country
    if (
      COUNTRY_CANONICAL_MAP.has(suffix) ||
      suffix === "us" ||
      suffix === "usa" ||
      suffix === "uk" ||
      suffix === "canada" ||
      suffix === "germany" ||
      suffix === "france" ||
      suffix === "italy"
    ) {
      return "country";
    }

    return "country";
  }

  // If country provided and raw location contains "remote" + country name
  if (country) {
    const cLow = country.toLowerCase();
    if (raw.includes("remote") && raw.includes(cLow)) return "country";
    if (raw === `remote - ${cLow}` || raw === `${cLow} - remote`) return "country";
  }

  return "metro";
}

/**
 * Normalizes a city/metro name against canonical gazetteer and known recruiter variations.
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

  // If candidate is a country name or "Korea" in South Korea, fall back to locality
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
  if (METRO_CANONICAL_MAP.has(low)) {
    return METRO_CANONICAL_MAP.get(low);
  }

  if (country && low === country.toLowerCase()) return null;

  // Washington special-case: if in US and called "Washington", resolve to "Washington, DC"
  if (country === "United States" && low === "washington" && (!region || region.toLowerCase() === "dc" || region.toLowerCase().includes("columbia"))) {
    return "Washington, DC";
  }

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
