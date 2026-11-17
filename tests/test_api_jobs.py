"""Tests for serverless endpoint api/jobs.py."""
import json
from unittest.mock import MagicMock, patch
import urllib.error

from api.jobs import fetch_company_jobs, resolve_endpoint


def test_resolve_endpoint():
    endpoint = resolve_endpoint("linear")
    assert endpoint is not None
    assert endpoint.endswith("/linear")

    assert resolve_endpoint("") is None
    assert resolve_endpoint("!!!") is None


def test_fetch_company_jobs_success():
    mock_payload = {"jobs": [{"id": "j1", "title": "Staff Engineer", "isListed": True}]}
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps(mock_payload).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp

    with patch("urllib.request.urlopen", return_value=mock_resp):
        status, body = fetch_company_jobs("cohere")
        assert status == 200
        assert body["company"] == "cohere"
        assert len(body["jobs"]) == 1
        assert body["total"] == 1


def test_fetch_company_jobs_http_error():
    err = urllib.error.HTTPError(
        url="https://example.com/api",
        code=404,
        msg="Not Found",
        hdrs={},
        fp=None,
    )
    with patch("urllib.request.urlopen", side_effect=err):
        status, body = fetch_company_jobs("nonexistent")
        assert status == 404
        assert "HTTP 404" in body["error"]


def test_fetch_company_jobs_synthetic():
    status, body = fetch_company_jobs("crafty_testing")
    assert status == 200
    assert body["company"] == "crafty_testing"
    assert body["synthetic"] is True
    assert body["total"] > 0
