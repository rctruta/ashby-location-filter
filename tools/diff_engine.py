"""Compute the diff between previous snapshot and current postings."""
from typing import Any


def compute_diff(
    previous_snapshot: dict[str, Any] | None,
    current_postings: list[dict[str, Any]],
) -> dict[str, Any]:
    """Identify new posting IDs and postings that were removed."""
    current_ids = {job["id"] for job in current_postings}

    if not previous_snapshot:
        return {
            "new_ids": [],
            "removed_jobs": [],
            "summary": {
                "active": len(current_postings),
                "new": 0,
                "removed": 0,
            },
        }

    previous_jobs_map = {
        job["id"]: job for job in previous_snapshot.get("jobs", [])
    }
    previous_ids = set(previous_jobs_map.keys())

    new_ids = sorted(list(current_ids - previous_ids))
    removed_ids = sorted(list(previous_ids - current_ids))
    removed_jobs = [previous_jobs_map[jid] for jid in removed_ids]

    return {
        "new_ids": new_ids,
        "removed_jobs": removed_jobs,
        "summary": {
            "active": len(current_postings),
            "new": len(new_ids),
            "removed": len(removed_jobs),
        },
    }
