"""Backend tests for Jobsite photo-estimate feature + regressions."""
import io
import os
import time
import wave
import struct
import math
import pytest
import requests
from PIL import Image, ImageDraw

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = BASE_URL + "/api"

TS = int(time.time())
EMAIL = f"qa+{TS}@example.com"
PASS = "password123"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    # register
    r = s.post(f"{API}/auth/register", json={"email": EMAIL, "password": PASS, "business_name": "QA Painting"})
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    s.headers["Authorization"] = f"Bearer {token}"
    return s


@pytest.fixture(scope="module")
def job_id(session):
    r = session.get(f"{API}/jobs")
    assert r.status_code == 200
    jobs = r.json()
    assert len(jobs) >= 1
    return jobs[0]["id"]


def _make_jpeg_bytes():
    """Real JPEG w/ visual features: an interior wall/room drawing."""
    im = Image.new("RGB", (800, 600), (230, 225, 215))
    d = ImageDraw.Draw(im)
    # floor
    d.rectangle([0, 450, 800, 600], fill=(120, 90, 60))
    # walls trim
    d.rectangle([0, 440, 800, 460], fill=(240, 240, 240))
    # window
    d.rectangle([120, 120, 320, 320], fill=(180, 210, 240), outline=(60, 50, 40), width=6)
    d.line([220, 120, 220, 320], fill=(60, 50, 40), width=4)
    d.line([120, 220, 320, 220], fill=(60, 50, 40), width=4)
    # door
    d.rectangle([500, 180, 660, 450], fill=(160, 120, 80), outline=(60, 40, 20), width=4)
    d.ellipse([640, 310, 655, 325], fill=(200, 180, 30))
    # texture noise
    for x in range(0, 800, 40):
        d.line([(x, 0), (x, 440)], fill=(220, 215, 205), width=1)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def _make_wav_bytes(seconds=1.0, freq=440.0):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        frames = []
        for i in range(int(16000 * seconds)):
            val = int(0.3 * 32767 * math.sin(2 * math.pi * freq * i / 16000))
            frames.append(struct.pack("<h", val))
        w.writeframes(b"".join(frames))
    return buf.getvalue()


# --------- /api/transcribe ---------

def test_transcribe_missing_file_422(session):
    r = session.post(f"{API}/transcribe")
    assert r.status_code == 422


def test_transcribe_with_wav(session):
    wav = _make_wav_bytes()
    files = {"file": ("voice.wav", wav, "audio/wav")}
    r = session.post(f"{API}/transcribe", files=files, timeout=60)
    # whisper may return empty text on sine wave; success or 502 both acceptable, but assert structure
    assert r.status_code in (200, 502), r.text
    if r.status_code == 200:
        data = r.json()
        assert "text" in data
        assert isinstance(data["text"], str)


# --------- /api/jobs/{id}/analyze-photos ---------

def test_analyze_photos_zero_photos_400(session, job_id):
    r = session.post(f"{API}/jobs/{job_id}/analyze-photos",
                     data={"description": "paint walls"})
    # FastAPI returns 422 for missing required File(...); accept either
    assert r.status_code in (400, 422)


def test_analyze_photos_empty_description_400(session, job_id):
    jpeg = _make_jpeg_bytes()
    files = [("photos", ("room.jpg", jpeg, "image/jpeg"))]
    r = session.post(f"{API}/jobs/{job_id}/analyze-photos", files=files,
                     data={"description": "   "})
    assert r.status_code == 400


def test_analyze_photos_success(session, job_id):
    jpeg = _make_jpeg_bytes()
    files = [("photos", ("room.jpg", jpeg, "image/jpeg"))]
    data = {"description": "Interior repaint of living room walls, two coats, keep trim as-is"}
    r = session.post(f"{API}/jobs/{job_id}/analyze-photos", files=files, data=data, timeout=180)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "scope_summary" in body and isinstance(body["scope_summary"], str)
    assert "items" in body and isinstance(body["items"], list) and len(body["items"]) >= 1
    assert "assumptions" in body
    assert "photo_ids" in body and len(body["photo_ids"]) == 1
    # save on module for build test
    pytest.analysis_result = body


# --------- /api/jobs/{id}/build-estimate ---------

def test_build_estimate_matches_rate_card(session, job_id):
    # Use exact rate card names
    items = [
        {"description": "Interior wall prep & patching", "rate_item_name": "Interior wall prep & patching",
         "unit": "sq ft", "quantity_basis": "wall_area", "quantity": None, "note": ""},
        {"description": "Paint - first coat interior", "rate_item_name": "Paint - first coat interior",
         "unit": "sq ft", "quantity_basis": "wall_area", "quantity": None, "note": ""},
        {"description": "Paint - second coat interior", "rate_item_name": "Paint - second coat interior",
         "unit": "sq ft", "quantity_basis": "wall_area", "quantity": None, "note": ""},
        # Unknown item -> needs_price
        {"description": "Popcorn ceiling removal", "rate_item_name": None,
         "unit": "sq ft", "quantity_basis": "ceiling_area", "quantity": None, "note": ""},
    ]
    payload = {"items": items, "wall_area": 600, "ceiling_area": 200, "trim_lf": 80, "coats": 1}
    r = session.post(f"{API}/jobs/{job_id}/build-estimate", json=payload)
    assert r.status_code == 200, r.text
    lines = r.json()["line_items"]
    # 'second coat' dropped due to coats=1 -> 3 remaining
    descs = [l["description"] for l in lines]
    assert "Paint - second coat interior" not in descs
    assert len(lines) == 3
    # First matched has price
    prep = next(l for l in lines if l["description"] == "Interior wall prep & patching")
    assert prep["needs_price"] is False
    assert prep["unit_price"] > 0
    assert prep["quantity"] == 600
    assert prep["line_total"] == round(600 * prep["unit_price"], 2)
    # unmatched
    pop = next(l for l in lines if l["rate_item_id"] is None or l["needs_price"])
    assert pop["needs_price"] is True
    assert pop["unit_price"] == 0
    assert pop["line_total"] == 0


def test_build_estimate_second_coat_kept_when_coats_2(session, job_id):
    items = [
        {"description": "Paint - second coat interior", "rate_item_name": "Paint - second coat interior",
         "unit": "sq ft", "quantity_basis": "wall_area", "quantity": None, "note": ""},
    ]
    r = session.post(f"{API}/jobs/{job_id}/build-estimate",
                     json={"items": items, "wall_area": 500, "ceiling_area": 0, "trim_lf": 0, "coats": 2})
    assert r.status_code == 200
    lines = r.json()["line_items"]
    assert len(lines) == 1
    assert lines[0]["needs_price"] is False


# --------- Regressions ---------

def test_put_estimate_regression(session, job_id):
    payload = {
        "line_items": [{"description": "Test line", "quantity": 2, "unit": "each",
                        "unit_price": 50, "line_total": 100}],
        "tax_rate": 8.25, "status": "draft", "notes": "regression"
    }
    r = session.put(f"{API}/jobs/{job_id}/estimate", json=payload)
    assert r.status_code == 200
    d = r.json()
    assert d["subtotal"] == 100
    assert d["tax"] == round(100 * 0.0825, 2)
    assert d["total"] == round(100 + d["tax"], 2)


def test_get_job_regression(session, job_id):
    r = session.get(f"{API}/jobs/{job_id}")
    assert r.status_code == 200
    j = r.json()
    for k in ("client", "estimate", "expenses", "logs", "hours"):
        assert k in j


def test_rate_card_add_persists(session):
    r = session.post(f"{API}/rate-card", json={
        "name": "TEST_popcorn removal", "unit": "sq ft", "unit_price": 3.25,
        "category": "labor", "confirmed": True,
    })
    assert r.status_code == 200
    r2 = session.get(f"{API}/rate-card")
    names = [x["name"] for x in r2.json()]
    assert "TEST_popcorn removal" in names
