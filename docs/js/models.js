/**
 * Models and data normalization functions for job postings and locations.
 */

export function cleanString(v) {
  return (typeof v === "string" && v.trim()) || null;
}

export function readLocation(entry, role) {
  const postal = (entry && entry.address && entry.address.postalAddress) || {};
  return {
    name: (entry && entry.location) || "Unspecified",
    role,
    locality: cleanString(postal.addressLocality),
    region: cleanString(postal.addressRegion),
    country: cleanString(postal.addressCountry),
  };
}

export function readJob(job, diffInfo = null) {
  const locs = [
    readLocation(job, "primary"),
    ...(job.secondaryLocations || []).map(s => readLocation(s, "secondary")),
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
  };
}

export function isCountryWide(l) {
  return Boolean(l.country) && (l.name === l.country || (!l.locality && !l.region));
}

export function cityRegion(l) {
  return [...new Set([l.locality, l.region])].filter(Boolean).join(", ");
}

export function addressNote(l) {
  if (isCountryWide(l)) {
    return (
      "anywhere in the country · " +
      (cityRegion(l) ? `feed address says ${cityRegion(l)}` : "no city in the address")
    );
  }
  const parts = [...new Set([l.locality, l.region])].filter(p => p && p !== l.name);
  if (!l.country) parts.push("no address country in the feed");
  return parts.join(", ");
}
