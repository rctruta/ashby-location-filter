/**
 * Models and data normalization functions for job postings and locations.
 */

export function cleanString(v) {
  return (typeof v === "string" && v.trim()) || null;
}

export function normalizeCityName(rawName, locality) {
  if (locality && locality.trim()) return locality.trim();
  if (!rawName) return null;
  let city = rawName.replace(/\s*\([^)]*\)/g, "").trim();
  if (city.includes(",")) {
    city = city.split(",")[0].trim();
  }
  return city || rawName;
}

export function readLocation(entry, role) {
  const postal = (entry && entry.address && entry.address.postalAddress) || {};
  const locality = cleanString(postal.addressLocality);
  const region = cleanString(postal.addressRegion);
  const country = cleanString(postal.addressCountry);
  const rawName = (entry && entry.location) || "Unspecified";
  const city = normalizeCityName(rawName, locality);

  return {
    name: rawName,
    city: city || rawName,
    role,
    locality,
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
  return (
    l.name === l.country ||
    l.city === l.country ||
    (!l.locality && !l.region && (!l.city || l.city === l.country))
  );
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
