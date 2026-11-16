"""Write the published snapshot from a saved or live job board feed.

Only listed postings are kept, and only the posting fields the config names.
Every field held back is logged on each run. Supports diffing against
previous snapshots and multi-company publishing.
"""
import argparse
import json
import logging
from datetime import date
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, HttpUrl

from tools.client import fetch_feed
from tools.diff_engine import compute_diff

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = Path(__file__).with_suffix(".yaml")

log = logging.getLogger(__name__)


class CompanyConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    provider: str = "Ashby"
    feed_url: HttpUrl
    output: Path


class PublishConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    companies: list[CompanyConfig]
    manifest_output: Path
    posting_fields: list[str]


class Selection(BaseModel):
    postings: list[dict]
    held_back: list[str]
    unlisted: int


def load_config(path: Path = CONFIG_PATH) -> PublishConfig:
    return PublishConfig.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))


def select(feed: dict, fields: list[str]) -> Selection:
    """Keep listed postings and the named fields; report everything else."""
    listed = [job for job in feed["jobs"] if job.get("isListed") is True]
    for job in listed:
        missing = [field for field in fields if field not in job]
        if missing:
            raise ValueError(f"posting {job.get('id')} has no field {missing}")
    return Selection(
        postings=[{field: job[field] for field in fields} for job in listed],
        held_back=sorted({key for job in listed for key in job} - set(fields)),
        unlisted=len(feed["jobs"]) - len(listed),
    )


def publish_one(
    source_info: dict[str, Any],
    feed_data: dict[str, Any],
    output_path: Path,
    posting_fields: list[str],
) -> tuple[int, dict[str, Any]]:
    """Filter, diff, and publish a single company's snapshot."""
    selection = select(feed_data, posting_fields)

    full_output = ROOT / output_path
    full_output.parent.mkdir(parents=True, exist_ok=True)

    previous_snapshot: dict[str, Any] | None = None
    if full_output.exists():
        try:
            previous_snapshot = json.loads(full_output.read_text(encoding="utf-8"))
        except Exception as e:
            log.warning("Could not read previous snapshot at %s: %s", full_output, e)

    diff = compute_diff(previous_snapshot, selection.postings)

    published = {
        "source": source_info,
        "jobs": selection.postings,
        "diff": diff,
    }

    full_output.write_text(
        json.dumps(published, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )

    log.info("wrote %d postings to %s", len(selection.postings), full_output)
    log.info("diff: +%d new, -%d removed", diff["summary"]["new"], diff["summary"]["removed"])
    log.info("dropped %d unlisted postings", selection.unlisted)
    log.info("held back fields: %s", ", ".join(selection.held_back) or "none")

    return len(selection.postings), diff


def write_manifest(config: PublishConfig) -> None:
    """Write the manifest of available companies for the frontend."""
    manifest_path = ROOT / config.manifest_output
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    entries = []
    for c in config.companies:
        # Snapshot path relative to docs/
        rel_output = c.output
        if str(rel_output).startswith("docs/"):
            rel_output = Path(*rel_output.parts[1:])

        entries.append(
            {
                "id": c.id,
                "name": c.name,
                "provider": c.provider,
                "feed_url": str(c.feed_url),
                "snapshot": str(rel_output),
            }
        )

    manifest_data = {"companies": entries}
    manifest_path.write_text(
        json.dumps(manifest_data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    log.info("wrote manifest with %d companies to %s", len(entries), manifest_path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("feed", nargs="?", type=str, default=None, help="saved feed JSON path or URL")
    parser.add_argument("--company", type=str, help="publish specific company by id from config")
    parser.add_argument("--all", action="store_true", help="publish all companies in config")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    config = load_config()

    if args.company:
        match = next((c for c in config.companies if c.id == args.company), None)
        if not match:
            available = ", ".join(c.id for c in config.companies)
            raise ValueError(f"Company '{args.company}' not found. Available: {available}")
        log.info("Publishing company: %s (%s)", match.name, match.id)
        feed_source = args.feed if args.feed else str(match.feed_url)
        feed_data = fetch_feed(feed_source)
        source_info = {
            "board": match.name,
            "provider": match.provider,
            "feed_url": str(match.feed_url),
            "downloaded": date.today().isoformat(),
        }
        publish_one(source_info, feed_data, match.output, config.posting_fields)
        write_manifest(config)
        return

    # Publish all companies in config (default when no single company specified)
    for company in config.companies:
        log.info("Publishing company: %s (%s)", company.name, company.id)
        feed_data = fetch_feed(str(company.feed_url))
        source_info = {
            "board": company.name,
            "provider": company.provider,
            "feed_url": str(company.feed_url),
            "downloaded": date.today().isoformat(),
        }
        publish_one(source_info, feed_data, company.output, config.posting_fields)

    write_manifest(config)


if __name__ == "__main__":
    main()
