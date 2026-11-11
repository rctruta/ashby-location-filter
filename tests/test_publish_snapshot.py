"""The published snapshot holds only what the config names."""
import json

import pytest
from pydantic import ValidationError

from tools.publish_snapshot import ROOT, PublishConfig, load_config, select

FEED = {
    "jobs": [
        {"id": "a", "title": "Listed", "isListed": True, "descriptionHtml": "<p>x</p>"},
        {"id": "b", "title": "Hidden", "isListed": False, "descriptionHtml": "<p>y</p>"},
    ]
}


def test_select_keeps_only_named_fields_of_listed_postings():
    selection = select(FEED, ["id", "title"])
    assert selection.postings == [{"id": "a", "title": "Listed"}]
    assert selection.held_back == ["descriptionHtml", "isListed"]
    assert selection.unlisted == 1


def test_select_refuses_a_posting_missing_a_named_field():
    with pytest.raises(ValueError, match="team"):
        select(FEED, ["id", "team"])


def test_config_refuses_an_unknown_key():
    raw = load_config().model_dump(mode="json")
    raw["posting_feilds"] = []
    with pytest.raises(ValidationError):
        PublishConfig.model_validate(raw)


def test_committed_snapshot_matches_the_config():
    config = load_config()
    published = json.loads((ROOT / config.output).read_text(encoding="utf-8"))
    assert published["source"] == config.source.model_dump(mode="json")
    assert published["jobs"], "the published snapshot has no postings"
    for job in published["jobs"]:
        assert list(job) == config.posting_fields
