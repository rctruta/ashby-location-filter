/**
 * Models and data normalization functions for job postings and locations.
 */

export function cleanString(v) {
  return (typeof v === "string" && v.trim()) || null;
}

import {
  classifyScope,
  normalizeCountry,
  normalizeLocation,
  normalizeMetro,
} from "./normalizers/location_normalizer.js";

// Re-export for compatibility with other components
export const normalizeCountryName = normalizeCountry;
export const normalizeCityName = normalizeMetro;
export const isCountryWideLocationName = (name, country) => {
  const scope = classifyScope(name, country);
  return scope === "country" || scope === "global";
};

export function readLocation(entry, role) {
  const postal = (entry && entry.address && entry.address.postalAddress) || {};
  const rawCountry = cleanString(postal.addressCountry);
  const rawLocality = cleanString(postal.addressLocality);
  const region = cleanString(postal.addressRegion);
  const rawName = (entry && entry.location) || "Unspecified";

  const norm = normalizeLocation({
    rawName,
    locality: rawLocality,
    region,
    country: rawCountry,
  });

  return {
    name: norm.rawName,
    city: norm.canonicalCity,
    role,
    locality: norm.canonicalCity || rawLocality,
    region: norm.canonicalRegion || region,
    country: norm.canonicalCountry,
    scope: norm.scope,
    isRemote: norm.isRemote,
    displayName: norm.displayName,
    compoundKey: norm.compoundKey,
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
  if (l.scope === "country" || l.scope === "global") return true;
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
