"""Tests for tools/add_company.py."""
import json
from unittest.mock import MagicMock, patch
import urllib.error

from tools.add_company import add_company, extract_slug, validate_ashby_endpoint


def test_extract_slug():
    assert extract_slug("notion") == "notion"
    assert extract_slug("Notion") == "notion"
    assert extract_slug("https://jobs.ashbyhq.com/notion") == "notion"
    assert extract_slug("https://jobs.ashbyhq.com/notion/") == "notion"
    assert extract_slug("https://api.ashbyhq.com/posting-api/job-board/notion") == "notion"


def test_ashby_endpoint_success():
    payload = {"jobs": [{"id": "1", "title": "Software Engineer", "isListed": True}]}
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps(payload).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp

    with patch("urllib.request.urlopen", return_value=mock_resp):
        is_valid, msg, data = validate_ashby_endpoint("https://example.com/api")
        assert is_valid is True
        assert "Valid Ashby" in msg
        assert data == payload


def test_ashby_endpoint_invalid_payload():
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps({"error": "not found"}).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp

    with patch("urllib.request.urlopen", return_value=mock_resp):
        is_valid, msg, data = validate_ashby_endpoint("https://example.com/api")
        assert is_valid is False
        assert data is None


def test_ashby_endpoint_http_error():
    err = urllib.error.HTTPError(
        url="https://example.com/api",
        code=404,
        msg="Not Found",
        hdrs={},
        fp=None,
    )
    with patch("urllib.request.urlopen", side_effect=err):
        is_valid, msg, data = validate_ashby_endpoint("https://example.com/api")
        assert is_valid is False
        assert "HTTP 404" in msg
        assert data is None


def test_add_company_already_existing():
    # 'cohere' is already in tools/publish_snapshot.yaml
    assert add_company("cohere") is False


def test_add_company_dry_run():
    payload = {"jobs": [{"id": "xyz", "title": "Test Lead", "isListed": True}]}
    with patch("tools.add_company.validate_ashby_endpoint", return_value=(True, "OK", payload)):
        success = add_company("testcompany", display_name="Test Company", dry_run=True)
        assert success is True
