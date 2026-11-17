/**
 * Models and data normalization functions for job postings and locations.
 */

export function cleanString(v) {
  return (typeof v === "string" && v.trim()) || null;
}

export function normalizeCountryName(country) {
  if (!country) return null;
  const c = country.trim();
  const low = c.toLowerCase();
  if (low === "usa" || low === "us" || low === "united states" || low === "united states of america") {
    return "United States";
  }
  if (low === "uk" || low === "united kingdom" || low === "great britain") {
    return "United Kingdom";
  }
  if (low === "uae") {
    return "United Arab Emirates";
  }
  if (low === "south korea" || low === "korea") {
    return "South Korea";
  }
  return c;
}

export const KNOWN_CITY_CANONICAL = {
  "san fransisco": "San Francisco",
  "san francisco": "San Francisco",
  "new york city": "New York",
  "nyc": "New York",
  "new york": "New York",
  "washington d.c.": "Washington, DC",
  "washington dc": "Washington, DC",
  "washington, dc": "Washington, DC",
  "washington, d.c.": "Washington, DC",
  "washington": "Washington, DC",
};

export function isCountryWideLocationName(rawName, country = null) {
  if (!rawName) return true;
  const r = rawName.toLowerCase().trim();
  if (r === "unspecified") return true;
  if (
    country &&
    (r === country.toLowerCase() ||
      (country === "United States" && (r === "usa" || r === "us")))
  ) {
    return true;
  }
  if (
    r === "remote" ||
    r.startsWith("remote -") ||
    r.startsWith("remote (") ||
    r.startsWith("remote,") ||
    r === "remote us" ||
    r === "remote usa" ||
    r === "remote uk" ||
    r === "remote canada" ||
    r === "remote germany" ||
    r === "remote italy" ||
    r === "remote european union" ||
    r === "north america" ||
    r === "europe"
  ) {
    return true;
  }
  if (country) {
    const cLow = country.toLowerCase();
    if (r.includes("remote") && r.includes(cLow)) return true;
    if (r === `remote - ${cLow}` || r === `${cLow} - remote`) return true;
  }
  return false;
}

export function normalizeCityName(rawName, locality, country = null) {
  if (isCountryWideLocationName(rawName, country)) {
    return null;
  }

  let candidate = (rawName || "").replace(/\s*\([^)]*\)/g, "").trim();
  if (candidate.includes(",")) candidate = candidate.split(",")[0].trim();

  if (
    country &&
    (candidate.toLowerCase() === country.toLowerCase() ||
      (country === "United States" &&
        (candidate.toLowerCase() === "usa" || candidate.toLowerCase() === "us")) ||
      (country === "South Korea" && candidate.toLowerCase() === "korea"))
  ) {
    candidate = locality || "";
  }
  if (!candidate && locality) candidate = locality;

  let clean = candidate.trim();
  if (!clean) return null;
  const low = clean.toLowerCase();
  if (KNOWN_CITY_CANONICAL[low]) {
    return KNOWN_CITY_CANONICAL[low];
  }
  if (country && low === country.toLowerCase()) return null;
  return clean;
}

export function readLocation(entry, role) {
  const postal = (entry && entry.address && entry.address.postalAddress) || {};
  const rawCountry = cleanString(postal.addressCountry);
  const country = normalizeCountryName(rawCountry);
  const rawLocality = cleanString(postal.addressLocality);
  const region = cleanString(postal.addressRegion);
  const rawName = (entry && entry.location) || "Unspecified";
  const city = normalizeCityName(rawName, rawLocality, country);

  return {
    name: rawName,
    city: city || null,
    role,
    locality: city || rawLocality,
    region,
    country,
  };
}

export function readJob(job, diffInfo = null, companyInfo = null) {
  const locs = [
    readLocation(job, "primary"),
    ...(job.secondaryLocations || []).map((s) => readLocation(s, "secondary")),
  ];

  let status = "active";
  if (diffInfo) {
    if (diffInfo.new_ids && diffInfo.new_ids.includes(job.id)) {
      status = "new";
    } else if (diffInfo.is_removed) {
      status = "removed";
    }
  }

  return {
    id: job.id,
    title: (job.title || "").trim(),
    url: job.jobUrl || "#",
    department: cleanString(job.department) || "General",
    team: cleanString(job.team),
    workplace: job.workplaceType ?? null,
    locs,
    status,
    company: companyInfo || job.company || null,
  };
}

export function isCountryWide(l) {
  if (!l.country) return false;
  const name = (l.name || "").toLowerCase().trim();
  const country = l.country.toLowerCase().trim();
  if (name === country || l.city === l.country) return true;
  if (name === "usa" || name === "us" || name === "united states") return true;
  if (isCountryWideLocationName(l.name, l.country)) return true;
  if (!l.locality && !l.region && (!l.city || l.city === l.country)) return true;
  return false;
}

export function cityRegion(l) {
  return [...new Set([l.city || l.locality, l.region])].filter(Boolean).join(", ");
}

export function addressNote(l) {
  if (isCountryWide(l)) {
    return (
      "anywhere in the country · " +
      (cityRegion(l) ? `feed address says ${cityRegion(l)}` : "no city in the address")
    );
  }
  const parts = [...new Set([l.city || l.locality, l.region])].filter(
    (p) => p && p !== l.name && p !== l.city
  );
  if (!l.country) parts.push("no address country in the feed");
  return parts.join(", ");
}
