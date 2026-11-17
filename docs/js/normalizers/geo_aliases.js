/**
 * @module geo_aliases
 * Canonical geographic dictionaries, recruiter typo registries, and subdivisions.
 * Separated from algorithmic parsing logic for modularity and maintainability.
 */

// Common recruiter synonyms and acronyms that differ from standard 2-letter ISO codes
export const COUNTRY_SYNONYMS = {
  // United States
  "usa": "United States",
  "us": "United States",
  "united states": "United States",
  "united states of america": "United States",
  "u.s.": "United States",
  "u.s.a.": "United States",

  // United Kingdom
  "uk": "United Kingdom",
  "gb": "United Kingdom",
  "great britain": "United Kingdom",
  "united kingdom": "United Kingdom",
  "england": "United Kingdom",
  "scotland": "United Kingdom",
  "wales": "United Kingdom",
  "northern ireland": "United Kingdom",

  // Common aliases & localized names
  "uae": "United Arab Emirates",
  "korea": "South Korea",
  "republic of korea": "South Korea",
  "deutschland": "Germany",
  "españa": "Spain",
  "italia": "Italy",
  "brasil": "Brazil",
  "holland": "Netherlands",
  "czechia": "Czech Republic",
  "european union": "European Union",
  "eu": "European Union",
  "europe": "European Union",
};

// US States & Canadian Provinces (2-letter abbreviation -> canonical name & country)
export const SUBDIVISIONS = {
  // US States
  "al": { name: "Alabama", country: "United States" },
  "ak": { name: "Alaska", country: "United States" },
  "az": { name: "Arizona", country: "United States" },
  "ar": { name: "Arkansas", country: "United States" },
  "ca": { name: "California", country: "United States" },
  "co": { name: "Colorado", country: "United States" },
  "ct": { name: "Connecticut", country: "United States" },
  "de": { name: "Delaware", country: "United States" },
  "fl": { name: "Florida", country: "United States" },
  "ga": { name: "Georgia", country: "United States" },
  "hi": { name: "Hawaii", country: "United States" },
  "id": { name: "Idaho", country: "United States" },
  "il": { name: "Illinois", country: "United States" },
  "in": { name: "Indiana", country: "United States" },
  "ia": { name: "Iowa", country: "United States" },
  "ks": { name: "Kansas", country: "United States" },
  "ky": { name: "Kentucky", country: "United States" },
  "la": { name: "Louisiana", country: "United States" },
  "me": { name: "Maine", country: "United States" },
  "md": { name: "Maryland", country: "United States" },
  "ma": { name: "Massachusetts", country: "United States" },
  "mi": { name: "Michigan", country: "United States" },
  "mn": { name: "Minnesota", country: "United States" },
  "ms": { name: "Mississippi", country: "United States" },
  "mo": { name: "Missouri", country: "United States" },
  "mt": { name: "Montana", country: "United States" },
  "ne": { name: "Nebraska", country: "United States" },
  "nv": { name: "Nevada", country: "United States" },
  "nh": { name: "New Hampshire", country: "United States" },
  "nj": { name: "New Jersey", country: "United States" },
  "nm": { name: "New Mexico", country: "United States" },
  "ny": { name: "New York", country: "United States" },
  "nc": { name: "North Carolina", country: "United States" },
  "nd": { name: "North Dakota", country: "United States" },
  "oh": { name: "Ohio", country: "United States" },
  "ok": { name: "Oklahoma", country: "United States" },
  "or": { name: "Oregon", country: "United States" },
  "pa": { name: "Pennsylvania", country: "United States" },
  "ri": { name: "Rhode Island", country: "United States" },
  "sc": { name: "South Carolina", country: "United States" },
  "sd": { name: "South Dakota", country: "United States" },
  "tn": { name: "Tennessee", country: "United States" },
  "tx": { name: "Texas", country: "United States" },
  "ut": { name: "Utah", country: "United States" },
  "vt": { name: "Vermont", country: "United States" },
  "va": { name: "Virginia", country: "United States" },
  "wa": { name: "Washington", country: "United States" },
  "wv": { name: "West Virginia", country: "United States" },
  "wi": { name: "Wisconsin", country: "United States" },
  "wy": { name: "Wyoming", country: "United States" },
  "dc": { name: "Washington, DC", country: "United States" },

  // Canadian Provinces
  "ab": { name: "Alberta", country: "Canada" },
  "bc": { name: "British Columbia", country: "Canada" },
  "mb": { name: "Manitoba", country: "Canada" },
  "nb": { name: "New Brunswick", country: "Canada" },
  "nl": { name: "Newfoundland and Labrador", country: "Canada" },
  "ns": { name: "Nova Scotia", country: "Canada" },
  "on": { name: "Ontario", country: "Canada" },
  "pe": { name: "Prince Edward Island", country: "Canada" },
  "qc": { name: "Quebec", country: "Canada" },
  "sk": { name: "Saskatchewan", country: "Canada" },
};

// Recruiter typos and tech hub abbreviations
export const METRO_ALIASES = {
  // San Francisco Bay Area & Ramp typo
  "san fransisco": "San Francisco",
  "san francisco": "San Francisco",
  "sf": "San Francisco",
  "sf bay area": "San Francisco",
  "san francisco bay area": "San Francisco",

  // New York
  "new york city": "New York",
  "nyc": "New York",
  "new york": "New York",
  "manhattan": "New York",
  "brooklyn": "New York",

  // Washington D.C.
  "washington d.c.": "Washington, DC",
  "washington dc": "Washington, DC",
  "washington, d.c.": "Washington, DC",
  "washington, dc": "Washington, DC",
  "district of columbia": "Washington, DC",

  // Tech hub regional designations
  "seattle area": "Seattle",
  "greater london": "London",
  "greater toronto area": "Toronto",
  "gta": "Toronto",
  "greater vancouver": "Vancouver",
};

// Global / Multi-national broad geographic scopes
export const GLOBAL_SCOPES = new Set([
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
