"""Write the published snapshot from a saved job board feed.

Only listed postings are kept, and only the posting fields the config names.
Every field held back is logged on each run.
"""
import argparse
import json
import logging
from datetime import date
from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, HttpUrl

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = Path(__file__).with_suffix(".yaml")

log = logging.getLogger(__name__)


class Source(BaseModel):
    model_config = ConfigDict(extra="forbid")

    board: str
    provider: str
    feed_url: HttpUrl
    downloaded: date


class PublishConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: Source
    output: Path
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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("feed", type=Path, help="saved feed JSON to publish from")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    config = load_config()
    feed = json.loads(args.feed.read_text(encoding="utf-8"))
    selection = select(feed, config.posting_fields)

    published = {
        "source": config.source.model_dump(mode="json"),
        "jobs": selection.postings,
    }
    output = ROOT / config.output
    output.write_text(
        json.dumps(published, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )

    log.info("read %s", args.feed)
    log.info("wrote %d postings to %s", len(selection.postings), output)
    log.info("dropped %d unlisted postings", selection.unlisted)
    log.info("held back fields: %s", ", ".join(selection.held_back) or "none")


if __name__ == "__main__":
    main()
