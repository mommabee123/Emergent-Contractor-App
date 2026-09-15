"""Slow AI-dependent path: /receipts/analyze end-to-end (tolerant)."""
import io
import os
import time
import uuid
import pytest
import requests
from PIL import Image, ImageDraw

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = BASE_URL + "/api"
CHUNK = 1024 * 1024


def _register():
    email = f"qaai+{int(time.time())}+{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "password123",
                            "business_name": "QA AI"}, timeout=30)
    assert r.status_code == 200
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


def _receipt_bytes():
    im = Image.new("RGB", (600, 900), (250, 248, 242))
    d = ImageDraw.Draw(im)
    lines = [
        "SHERWIN WILLIAMS #4021",
        "1234 Main St",
        "01/15/2025",
        "",
        "PRO CLASSIC LATEX GAL 1 59.00 59.00",
        "MASKING TAPE 24MM 2 5.50 11.00",
        "ROLLER COVER 9IN 1 12.00 12.00",
        "",
        "SUBTOTAL   82.00",
        "TAX         6.77",
        "TOTAL      88.77",
    ]
    y = 40
    for line in lines:
        d.text((30, y), line, fill=(20, 20, 20))
        y += 40
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def _upload(s, data):
    r = s.post(f"{API}/receipts/uploads",
               json={"filename": "r.jpg", "content_type": "image/jpeg",
                     "size": len(data)}, timeout=30)
    uid = r.json()["id"]
    for idx, off in enumerate(range(0, len(data), CHUNK)):
        s.put(f"{API}/receipts/uploads/{uid}/chunks/{idx}",
              data=data[off:off + CHUNK],
              headers={"Content-Type": "application/octet-stream"}, timeout=60)
    return s.post(f"{API}/receipts/uploads/{uid}/complete", timeout=60).json()["id"]


def test_receipts_analyze_returns_extraction_and_suggestions():
    s = _register()
    fid = _upload(s, _receipt_bytes())
    r = s.post(f"{API}/receipts/analyze",
               json={"receipt_photo_id": fid}, timeout=180)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "extracted" in body and "suggestions" in body
    ext = body["extracted"]
    for k in ("vendor", "date", "subtotal", "tax", "total", "line_items", "warnings",
              "category", "category_confidence"):
        assert k in ext
    sg = body["suggestions"]
    for k in ("category", "category_reason", "job_id", "ranked_jobs", "job_reason"):
        assert k in sg
    assert isinstance(sg["ranked_jobs"], list)


def test_receipts_suggestions_manual_only():
    s = _register()
    # NOTE: Sending a `date` currently 422s due to a Pydantic bug where
    # `SuggestIn.date: Optional[date]` is interpreted as None-only when the
    # field name shadows the imported `date` type. See test below.
    r = s.post(f"{API}/receipts/suggestions",
               json={"vendor": "Shell Gas Station",
                     "description": "diesel fuel", "line_items": []}, timeout=120)
    assert r.status_code == 200, r.text
    sg = r.json()
    assert sg["job_id"] is None or isinstance(sg["job_id"], str)
    assert "ranked_jobs" in sg


def test_bug_suggestin_optional_date_rejects_valid_iso():
    """Regression assertion documenting a real bug: Optional[date] with a
    field named `date` rejects any non-null value. Refresh Suggestions and
    AI extraction date pass-through are broken. Should be xfail once fixed."""
    s = _register()
    r = s.post(f"{API}/receipts/suggestions",
               json={"vendor": "X", "date": "2025-01-10", "description": "",
                     "line_items": []}, timeout=60)
    # Currently 422 — once fixed this should be 200 and this test flipped.
    assert r.status_code == 422
    assert "none_required" in r.text
