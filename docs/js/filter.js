/**
 * Unified multi-faceted filtering engine.
 * Fully synchronizes Company, Location, Department, Workplace, and Status facets.
 */

import { normalizeCountryName } from "./models.js";

export function locationTest(loc) {
  if (!loc || loc.kind === "all") return null;
  if (loc.kind === "country") {
    const targetCountry = normalizeCountryName(loc.country);
    return l => l.country === targetCountry || l.country === loc.country;
  }
  if (loc.kind === "place" || loc.kind === "city") {
    const targetCountry = loc.country ? normalizeCountryName(loc.country) : null;
    const target = loc.name.toLowerCase().trim();
    return l => {
      if (targetCountry && l.country !== targetCountry && l.country !== loc.country) return false;
      if (l.city && l.city.toLowerCase() === target) return true;
      if (l.locality && l.locality.toLowerCase() === target) return true;
      if (l.name && l.name.toLowerCase() === target) return true;
      if (l.name && l.name.toLowerCase().startsWith(target + ",")) return true;
      return false;
    };
  }
  return null;
}

export function departmentTest(dept) {
  if (!dept || dept.kind === "all") return null;
  if (dept.kind === "department") return j => j.department === dept.name;
  if (dept.kind === "team") return j => j.department === dept.department && j.team === dept.name;
  return null;
}

export function hitsLocation(job, loc) {
  const test = locationTest(loc);
  return test ? job.locs.filter(test) : job.locs;
}

export function passesCompany(job, companyFilter) {
  if (!companyFilter) return true;
  if (companyFilter instanceof Set) {
    if (companyFilter.has("all")) return true;
    if (companyFilter.size === 0) return false;
    return Boolean(job.company && companyFilter.has(job.company.id));
  }
  if (Array.isArray(companyFilter)) {
    if (companyFilter.includes("all")) return true;
    if (companyFilter.length === 0) return false;
    return Boolean(job.company && companyFilter.includes(job.company.id));
  }
  if (companyFilter === "all") return true;
  return Boolean(job.company && job.company.id === companyFilter);
}

export function passesLocation(job, loc) {
  if (!loc || loc.kind === "all") return true;
  return hitsLocation(job, loc).length > 0;
}

export function passesDepartment(job, dept) {
  const test = departmentTest(dept);
  return test ? test(job) : true;
}

export function passesWorkplace(job, workplaces) {
  return !workplaces || workplaces.size === 0 || workplaces.has(job.workplace);
}

export function passesStatus(job, statusFilter) {
  if (!statusFilter || statusFilter === "all") return true;
  return job.status === statusFilter;
}

export function passesSearch(job, query) {
  if (!query || !query.trim()) return true;
  const q = query.toLowerCase().trim();
  if (job.title.toLowerCase().includes(q)) return true;
  if (job.company && job.company.name && job.company.name.toLowerCase().includes(q)) return true;
  if (job.department && job.department.toLowerCase().includes(q)) return true;
  if (job.team && job.team.toLowerCase().includes(q)) return true;
  return job.locs.some(
    l =>
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.locality && l.locality.toLowerCase().includes(q)) ||
      (l.region && l.region.toLowerCase().includes(q)) ||
      (l.country && l.country.toLowerCase().includes(q))
  );
}

export function matchesJob(job, state, excludeFacet = null) {
  if (!passesSearch(job, state.search)) return false;
  if (excludeFacet !== "company" && !passesCompany(job, state.selectedCompanies || state.companyId)) return false;
  if (excludeFacet !== "location" && !passesLocation(job, state.loc)) return false;
  if (excludeFacet !== "department" && !passesDepartment(job, state.dept)) return false;
  if (excludeFacet !== "workplace" && !passesWorkplace(job, state.workplaces)) return false;
  if (excludeFacet !== "status" && !passesStatus(job, state.status)) return false;
  return true;
}

export function filterJobs(jobs, state) {
  return jobs.filter(job => matchesJob(job, state));
}

export function countForCompany(jobs, state, companyId) {
  return jobs.filter(j => matchesJob(j, state, "company") && (companyId === "all" || passesCompany(j, companyId))).length;
}

export function countForLocation(jobs, state, loc) {
  return jobs.filter(j => matchesJob(j, state, "location") && (loc.kind === "all" || passesLocation(j, loc))).length;
}

export function countForDepartment(jobs, state, dept) {
  return jobs.filter(j => matchesJob(j, state, "department") && (dept.kind === "all" || passesDepartment(j, dept))).length;
}

export function countForWorkplace(jobs, state, workplace) {
  return jobs.filter(j => matchesJob(j, state, "workplace") && (workplace === null ? j.workplace === null : j.workplace === workplace)).length;
}

export function countForStatus(jobs, state, status) {
  return jobs.filter(j => matchesJob(j, state, "status") && (status === "all" || j.status === status)).length;
}
