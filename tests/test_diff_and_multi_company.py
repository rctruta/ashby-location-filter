"""Tests for diff engine, feed fetching, and multi-company manifest generation."""
import json
from pathlib import Path
from unittest.mock import MagicMock, patch

from tools.client import fetch_feed
from tools.diff_engine import compute_diff
from tools.publish_snapshot import CompanyConfig, PublishConfig, write_manifest


def test_diff_engine_no_previous_snapshot():
    current = [{"id": "1", "title": "Job 1"}, {"id": "2", "title": "Job 2"}]
    diff = compute_diff(None, current)
    assert diff["new_ids"] == []
    assert diff["removed_jobs"] == []
    assert diff["summary"] == {"active": 2, "new": 0, "removed": 0}


def test_diff_engine_identifies_new_and_removed_jobs():
    prev = {
        "jobs": [
            {"id": "1", "title": "Job 1"},
            {"id": "2", "title": "Job 2 (to be removed)"},
        ]
    }
    current = [
        {"id": "1", "title": "Job 1"},
        {"id": "3", "title": "Job 3 (new)"},
    ]
    diff = compute_diff(prev, current)
    assert diff["new_ids"] == ["3"]
    assert len(diff["removed_jobs"]) == 1
    assert diff["removed_jobs"][0]["id"] == "2"
    assert diff["summary"] == {"active": 2, "new": 1, "removed": 1}


def test_fetch_feed_from_file(tmp_path: Path):
    sample = {"jobs": [{"id": "abc", "title": "Test Engineer"}]}
    feed_file = tmp_path / "sample_feed.json"
    feed_file.write_text(json.dumps(sample), encoding="utf-8")

    loaded = fetch_feed(feed_file)
    assert loaded == sample


def test_fetch_feed_http(monkeypatch):
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps({"jobs": []}).encode("utf-8")
    mock_response.__enter__.return_value = mock_response

    with patch("urllib.request.urlopen", return_value=mock_response):
        data = fetch_feed("https://example.com/feed.json")
        assert data == {"jobs": []}


def test_write_manifest(tmp_path: Path):
    manifest_rel = Path("docs/data/manifest.json")
    config = PublishConfig(
        posting_fields=["id", "title"],
        companies=[
            CompanyConfig(
                id="cohere",
                name="Cohere",
                provider="Ashby",
                feed_url="https://api.ashbyhq.com/posting-api/job-board/cohere",
                output=Path("docs/data/cohere.json"),
            ),
            CompanyConfig(
                id="ramp",
                name="Ramp",
                provider="Ashby",
                feed_url="https://api.ashbyhq.com/posting-api/job-board/ramp",
                output=Path("docs/data/ramp.json"),
            ),
        ],
        manifest_output=manifest_rel,
    )

    with patch("tools.publish_snapshot.ROOT", tmp_path):
        write_manifest(config)
        manifest_file = tmp_path / manifest_rel
        assert manifest_file.exists()
        content = json.loads(manifest_file.read_text(encoding="utf-8"))
        assert len(content["companies"]) == 2
        assert content["companies"][0]["id"] == "cohere"
        assert content["companies"][0]["snapshot"] == "data/cohere.json"
        assert content["companies"][1]["id"] == "ramp"
        assert content["companies"][1]["snapshot"] == "data/ramp.json"
