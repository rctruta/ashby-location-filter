"""Validate and add a new company Ashby job board to the pipeline.

Tests the remote endpoint, confirms listed postings, appends to
tools/publish_snapshot.yaml, and publishes the snapshot.
"""
import argparse
from datetime import date
import json
import logging
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

import yaml

from tools.publish_snapshot import (
    CONFIG_PATH,
    ROOT,
    CompanyConfig,
    load_config,
    publish_one,
    write_manifest,
)

log = logging.getLogger(__name__)


def extract_slug(input_str: str) -> str:
    """Extract company slug from a name, slug, or full URL."""
    cleaned = input_str.strip()
    if "/" in cleaned:
        parsed = urllib.parse.urlparse(cleaned)
        path = parsed.path.strip("/")
        parts = path.split("/")
        return parts[-1]
    return cleaned.lower()


def validate_ashby_endpoint(api_url: str) -> tuple[bool, str, dict[str, Any] | None]:
    """Test if an Ashby posting endpoint is valid and returns listed jobs."""
    try:
        req = urllib.request.Request(
            api_url,
            headers={"User-Agent": "ashby-location-filter/1.0"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if not isinstance(data, dict) or "jobs" not in data:
                return False, "Response is not a valid Ashby job board payload (missing 'jobs' array).", None
            return True, "Valid Ashby endpoint", data
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}: {e.reason}", None
    except Exception as e:
        return False, f"Connection failed: {e}", None


def add_company(identifier: str, display_name: str | None = None, dry_run: bool = False) -> bool:
    """Verify endpoint and add company to publish_snapshot.yaml."""
    config = load_config()
    slug = extract_slug(identifier)
    name = display_name or slug.capitalize()

    # Check if company already configured
    existing = next((c for c in config.companies if c.id == slug), None)
    if existing:
        log.warning("Company '%s' is already registered in config (%s).", slug, existing.output)
        return False

    # Derive URL using configured company URL pattern
    sample_url = str(config.companies[0].feed_url)
    base_url = re.sub(r"/[^/]+$", f"/{slug}", sample_url)

    log.info("Testing Ashby endpoint: %s", base_url)
    is_valid, message, feed_data = validate_ashby_endpoint(base_url)

    if not is_valid or not feed_data:
        log.error("Validation failed for '%s': %s", slug, message)
        return False

    jobs = feed_data.get("jobs", [])
    listed = [j for j in jobs if j.get("isListed") is True]
    log.info("✓ Validation successful! Found %d jobs (%d listed).", len(jobs), len(listed))

    output_rel = Path(f"docs/data/{slug}.json")
    # Validate configuration via Pydantic model
    CompanyConfig(
        id=slug,
        name=name,
        provider="Ashby",
        feed_url=base_url,
        output=output_rel,
    )

    if dry_run:
        log.info("[DRY-RUN] Verified successfully. Would write to %s and update YAML.", output_rel)
        return True

    # Read raw yaml, append, write back
    raw_yaml = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))
    raw_yaml.setdefault("companies", []).append({
        "id": slug,
        "name": name,
        "provider": "Ashby",
        "feed_url": base_url,
        "output": str(output_rel),
    })
    CONFIG_PATH.write_text(yaml.dump(raw_yaml, sort_keys=False), encoding="utf-8")
    log.info("✓ Appended '%s' to %s", slug, CONFIG_PATH)

    # Publish snapshot and update manifest
    reloaded_config = load_config()
    source_info = {
        "board": name,
        "provider": "Ashby",
        "feed_url": base_url,
        "downloaded": date.today().isoformat(),
    }
    publish_one(source_info, feed_data, output_rel, reloaded_config.posting_fields)
    write_manifest(reloaded_config)
    log.info("✓ Published snapshot and updated manifest for '%s'!", name)
    return True


def remove_company(identifier: str, dry_run: bool = False) -> bool:
    """Remove a company from publish_snapshot.yaml, delete its snapshot, and update manifest."""
    slug = extract_slug(identifier)
    config = load_config()
    existing = next((c for c in config.companies if c.id == slug), None)
    if not existing:
        log.error("Company '%s' is not registered in %s.", slug, CONFIG_PATH)
        return False

    snapshot_file = ROOT / existing.output
    if dry_run:
        log.info(
            "[DRY-RUN] Would remove '%s' from %s and delete %s.",
            slug,
            CONFIG_PATH,
            snapshot_file,
        )
        return True

    raw_yaml = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))
    raw_yaml["companies"] = [
        c for c in raw_yaml.get("companies", []) if c.get("id") != slug
    ]
    CONFIG_PATH.write_text(yaml.dump(raw_yaml, sort_keys=False), encoding="utf-8")
    log.info("✓ Removed '%s' from %s", slug, CONFIG_PATH)

    if snapshot_file.exists():
        snapshot_file.unlink()
        log.info("✓ Deleted snapshot %s", snapshot_file)

    reloaded_config = load_config()
    write_manifest(reloaded_config)
    log.info("✓ Updated manifest (%d companies remaining).", len(reloaded_config.companies))
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("company", help="Company slug, name, or Ashby board identifier (e.g. 'notion')")
    parser.add_argument("--name", help="Display name (e.g. 'Notion')")
    parser.add_argument("--remove", action="store_true", help="Remove company from config, delete snapshot, and update manifest")
    parser.add_argument("--dry-run", action="store_true", help="Test and validate without modifying files")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if args.remove:
        success = remove_company(args.company, args.dry_run)
    else:
        success = add_company(args.company, args.name, args.dry_run)
    if not success:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
