/**
 * Filtering engine supporting multi-faceted filters:
 * Search text, Company, Location hierarchy, Department hierarchy, Workplace, and Diff status.
 */

export function locationTest(loc) {
  if (!loc || loc.kind === "all") return null;
  if (loc.kind === "country") return l => l.country === loc.country;
  if (loc.kind === "place") return l => l.country === loc.country && l.name === loc.name;
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

export function filterJobs(jobs, state) {
  return jobs.filter(job => {
    if (!passesSearch(job, state.search)) return false;
    if (!passesWorkplace(job, state.workplaces)) return false;
    if (!passesStatus(job, state.status)) return false;

    if (state.viewMode === "department") {
      const deptCheck = departmentTest(state.dept);
      if (deptCheck && !deptCheck(job)) return false;
    } else {
      // "location" mode
      const locMatches = hitsLocation(job, state.loc);
      if (state.loc && state.loc.kind !== "all" && locMatches.length === 0) return false;
    }

    return true;
  });
}

export function countForLocation(jobs, state, loc) {
  return jobs.filter(j => {
    if (!passesSearch(j, state.search)) return false;
    if (!passesWorkplace(j, state.workplaces)) return false;
    if (!passesStatus(j, state.status)) return false;
    return hitsLocation(j, loc).length > 0;
  }).length;
}

export function countForDepartment(jobs, state, dept) {
  const deptCheck = departmentTest(dept);
  return jobs.filter(j => {
    if (!passesSearch(j, state.search)) return false;
    if (!passesWorkplace(j, state.workplaces)) return false;
    if (!passesStatus(j, state.status)) return false;
    return deptCheck ? deptCheck(j) : true;
  }).length;
}
