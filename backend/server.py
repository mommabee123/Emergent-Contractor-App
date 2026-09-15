"""Jobsite backend - FastAPI + MongoDB.
Single-user-per-account contractor paperwork app.
"""
import base64
import io
import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, List, Literal, Optional

import bcrypt
import jwt
import requests
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import (APIRouter, Depends, FastAPI, File, Form, Header,
                     HTTPException, Query, Response, UploadFile, status)
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image, ImageOps
from receipt_expenses import ExpenseIn, expense_public, expense_summary, save_expense, register_receipt_routes
from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- MongoDB ----------
mongo_url = os.environ["MONGO_URL"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ["DB_NAME"]]

# ---------- Config ----------
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
JWT_EXP_DAYS = 30
APP_NAME = os.environ.get("APP_NAME", "jobsite")

# ---------- Storage ----------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
storage_key: Optional[str] = None


def init_storage(force: bool = False) -> Optional[str]:
    global storage_key
    if storage_key and not force:
        return storage_key
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as e:
        logging.error(f"storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage unavailable")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 404:
        # key may be stale
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple[bytes, str]:
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------- Models ----------
def _oid_to_str(v):
    if isinstance(v, ObjectId):
        return str(v)
    return v


PyObjectId = Annotated[str, BeforeValidator(_oid_to_str)]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ---------- Auth ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXP_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


bearer = HTTPBearer(auto_error=False)


async def current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    auth: Optional[str] = Query(None),
) -> dict:
    token = None
    if creds:
        token = creds.credentials
    elif auth:
        token = auth
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        uid = payload["sub"]
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": uid})
    if not user:
        raise HTTPException(401, "User not found")
    return user


# ---------- Schemas ----------
class RegisterReq(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    business_name: str


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class CompanyProfile(BaseModel):
    business_name: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    license_number: str = ""
    default_tax_rate: float = 0.0
    payment_instructions: str = ""
    logo_file_id: Optional[str] = None


class ClientIn(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    address: str = ""
    notes: str = ""


class JobIn(BaseModel):
    title: str
    client_id: str
    address: str = ""
    status: str = "Lead"
    start_date: Optional[str] = None
    notes: str = ""
    cover_photo_id: Optional[str] = None


class LineItem(BaseModel):
    description: str
    quantity: float = 0
    unit: str = "each"
    unit_price: float = 0
    line_total: float = 0


class EstimateIn(BaseModel):
    line_items: List[LineItem] = []
    tax_rate: float = 0
    status: str = "draft"
    notes: str = ""


class LogEntryIn(BaseModel):
    date: str
    note: str
    photo_ids: List[str] = []


class HoursEntryIn(BaseModel):
    date: str
    person: str
    hours: float
    hourly_rate: float


class RateItemIn(BaseModel):
    name: str
    unit: str
    unit_price: float
    category: str
    confirmed: bool = False


# ---------- FastAPI ----------
app = FastAPI(title="Jobsite API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("jobsite")


VALID_JOB_STATUSES = ["Lead", "Estimated", "Approved", "In Progress", "Complete", "Invoiced", "Paid"]
VALID_UNITS = ["hour", "sq ft", "linear ft", "each", "day", "square", "gal", "load"]
VALID_CATEGORIES = ["labor", "material", "equipment", "disposal"]


# ---------- Seed data ----------
SEED_RATE_CARD = [
    # Painting - core
    {"name": "Interior wall prep & patching", "unit": "sq ft", "unit_price": 1.25, "category": "labor"},
    {"name": "Caulking (windows, trim, seams)", "unit": "linear ft", "unit_price": 1.10, "category": "labor"},
    {"name": "Masking & floor protection", "unit": "sq ft", "unit_price": 0.35, "category": "labor"},
    {"name": "Primer coat (interior walls)", "unit": "sq ft", "unit_price": 0.75, "category": "labor"},
    {"name": "Paint - first coat interior", "unit": "sq ft", "unit_price": 0.95, "category": "labor"},
    {"name": "Paint - second coat interior", "unit": "sq ft", "unit_price": 0.80, "category": "labor"},
    {"name": "Ceiling paint (up to 9 ft)", "unit": "sq ft", "unit_price": 1.10, "category": "labor"},
    {"name": "Ceiling above 9 ft surcharge", "unit": "sq ft", "unit_price": 0.55, "category": "labor"},
    {"name": "Trim & door painting", "unit": "linear ft", "unit_price": 3.25, "category": "labor"},
    {"name": "Cabinet painting (per door/drawer)", "unit": "each", "unit_price": 85.00, "category": "labor"},
    {"name": "Wallpaper removal", "unit": "sq ft", "unit_price": 2.10, "category": "labor"},
    {"name": "Premium interior latex paint", "unit": "gal", "unit_price": 62.00, "category": "material"},
    # Drywall / framing
    {"name": "Drywall repair & finishing", "unit": "sq ft", "unit_price": 4.50, "category": "labor"},
    {"name": "Framing labor", "unit": "hour", "unit_price": 72.00, "category": "labor"},
    # Roofing
    {"name": "Roof tear-off", "unit": "square", "unit_price": 110.00, "category": "labor"},
    {"name": "Shingle install (architectural)", "unit": "square", "unit_price": 425.00, "category": "labor"},
    {"name": "Gutter install", "unit": "linear ft", "unit_price": 9.50, "category": "labor"},
    # Landscape
    {"name": "Sod install", "unit": "sq ft", "unit_price": 1.80, "category": "labor"},
    {"name": "Mulch install", "unit": "sq ft", "unit_price": 0.95, "category": "material"},
    {"name": "Tree/shrub removal", "unit": "each", "unit_price": 285.00, "category": "labor"},
    # Universal
    {"name": "General labor", "unit": "hour", "unit_price": 65.00, "category": "labor"},
    {"name": "Helper labor", "unit": "hour", "unit_price": 42.00, "category": "labor"},
    {"name": "Equipment rental", "unit": "day", "unit_price": 125.00, "category": "equipment"},
    {"name": "Dumpster / haul-away", "unit": "load", "unit_price": 385.00, "category": "disposal"},
    {"name": "Travel / mobilization", "unit": "each", "unit_price": 95.00, "category": "labor"},
]


async def next_job_number(user_id: str) -> int:
    doc = await db.counters.find_one_and_update(
        {"user_id": user_id, "kind": "job"},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=True,
    )
    # motor default returns after update when return_document=ReturnDocument.AFTER; but without pymongo import,
    # doc may be pre-update. Handle both cases.
    if doc and "value" in doc:
        return int(doc["value"])
    # Fallback
    d = await db.counters.find_one({"user_id": user_id, "kind": "job"})
    return int(d["value"]) if d else 1


async def seed_for_user(user_id: str):
    # Rate card
    docs = []
    for item in SEED_RATE_CARD:
        docs.append({
            "id": new_id(),
            "user_id": user_id,
            "name": item["name"],
            "unit": item["unit"],
            "unit_price": item["unit_price"],
            "category": item["category"],
            "confirmed": False,
            "created_at": now_iso(),
        })
    if docs:
        await db.rate_items.insert_many(docs)

    # Clients
    clients = [
        {"name": "Maria Chen", "phone": "(415) 555-0134", "email": "maria.chen@example.com",
         "address": "1420 Highland Park Dr, Oakland CA 94602", "notes": "Prefers weekday work; two dogs on property."},
        {"name": "Dwayne & Terri Booker", "phone": "(510) 555-0187", "email": "booker.home@example.com",
         "address": "88 Ridgemont Ave, Berkeley CA 94708", "notes": "Repeat client. Pay by check on completion."},
        {"name": "Alonzo Martinez", "phone": "(408) 555-0142", "email": "alonzo.m@example.com",
         "address": "5501 Cedar Way, San Jose CA 95120", "notes": "Property manager - approves fast."},
    ]
    client_docs = []
    for c in clients:
        client_docs.append({
            "id": new_id(),
            "user_id": user_id,
            **c,
            "archived": False,
            "created_at": now_iso(),
        })
    await db.clients.insert_many(client_docs)

    # Jobs
    jobs_spec = [
        {"client_idx": 0, "title": "Highland Park whole-house interior repaint", "status": "In Progress",
         "address": "1420 Highland Park Dr, Oakland CA 94602", "notes": "3 bed / 2 bath. Sherwin-Williams Alabaster walls, Iron Ore trim.",
         "estimate": [
             ("Interior wall prep & patching", 1850, "sq ft", 1.25),
             ("Primer coat (interior walls)", 1850, "sq ft", 0.75),
             ("Paint - first coat interior", 1850, "sq ft", 0.95),
             ("Paint - second coat interior", 1850, "sq ft", 0.80),
             ("Trim & door painting", 320, "linear ft", 3.25),
             ("Premium interior latex paint", 14, "gal", 62.00),
         ],
         "expenses": [
             {"vendor": "Sherwin-Williams", "amount": 748.00, "category": "material", "description": "12 gal Emerald + primer"},
             {"vendor": "Home Depot", "amount": 142.55, "category": "material", "description": "Tape, plastic, rollers"},
             {"vendor": "Sunbelt Rentals", "amount": 210.00, "category": "equipment", "description": "Airless sprayer 2 days"},
         ],
         "logs": [
             "Day 1: masked floors & taped trim. Filled 22 nail holes in living room.",
             "Day 2: primed all walls in bed 1-3. Dry time overnight.",
             "Day 3: first coat complete on main level. Kitchen and hall done.",
         ]},
        {"client_idx": 1, "title": "Cabinet refinish - kitchen", "status": "Approved",
         "address": "88 Ridgemont Ave, Berkeley CA 94708", "notes": "22 doors, 6 drawer fronts. Satin white.",
         "estimate": [
             ("Cabinet painting (per door/drawer)", 28, "each", 85.00),
             ("Premium interior latex paint", 4, "gal", 62.00),
             ("Masking & floor protection", 240, "sq ft", 0.35),
         ],
         "expenses": [],
         "logs": []},
        {"client_idx": 2, "title": "Exterior trim & fascia - Cedar Way", "status": "Lead",
         "address": "5501 Cedar Way, San Jose CA 95120", "notes": "Walk-through scheduled next Tuesday.",
         "estimate": [], "expenses": [], "logs": []},
        {"client_idx": 1, "title": "Deck restain & garage door", "status": "Paid",
         "address": "88 Ridgemont Ave, Berkeley CA 94708", "notes": "Completed last month.",
         "estimate": [
             ("General labor", 18, "hour", 65.00),
             ("Helper labor", 12, "hour", 42.00),
             ("Premium interior latex paint", 3, "gal", 62.00),
         ],
         "expenses": [
             {"vendor": "Ace Hardware", "amount": 88.10, "category": "material", "description": "Stain + brushes"},
         ],
         "logs": [
             "Sanded deck, taped garage panels, applied 2 coats stain.",
         ]},
    ]

    for spec in jobs_spec:
        job_num = await next_job_number(user_id)
        job_id = new_id()
        client = client_docs[spec["client_idx"]]
        job_doc = {
            "id": job_id,
            "user_id": user_id,
            "job_number": job_num,
            "title": spec["title"],
            "client_id": client["id"],
            "address": spec["address"],
            "status": spec["status"],
            "start_date": now_iso()[:10],
            "notes": spec["notes"],
            "cover_photo_id": None,
            "archived": False,
            "created_at": now_iso(),
        }
        await db.jobs.insert_one(job_doc)

        if spec["estimate"]:
            items = []
            subtotal = 0.0
            for desc, qty, unit, price in spec["estimate"]:
                total = round(qty * price, 2)
                subtotal += total
                items.append({"description": desc, "quantity": qty, "unit": unit,
                              "unit_price": price, "line_total": total})
            tax = round(subtotal * 0.0825, 2)
            est_status = "approved" if spec["status"] in ["Approved", "In Progress", "Complete", "Invoiced", "Paid"] else "draft"
            await db.estimates.insert_one({
                "id": new_id(),
                "user_id": user_id,
                "job_id": job_id,
                "line_items": items,
                "subtotal": round(subtotal, 2),
                "tax_rate": 8.25,
                "tax": tax,
                "total": round(subtotal + tax, 2),
                "status": est_status,
                "notes": "",
                "created_at": now_iso(),
            })

        for exp in spec["expenses"]:
            await db.expenses.insert_one({
                "id": new_id(),
                "user_id": user_id,
                "job_id": job_id,
                "vendor": exp["vendor"],
                "date": now_iso()[:10],
                "amount": exp["amount"],
                "category": exp["category"],
                "description": exp["description"],
                "receipt_photo_id": None,
                "created_at": now_iso(),
            })

        for i, note in enumerate(spec["logs"]):
            await db.log_entries.insert_one({
                "id": new_id(),
                "user_id": user_id,
                "job_id": job_id,
                "date": now_iso()[:10],
                "note": note,
                "photo_ids": [],
                "created_at": now_iso(),
            })


# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    init_storage()
    await db.users.create_index("email", unique=True)
    await db.jobs.create_index([("user_id", 1), ("archived", 1)])
    await db.rate_items.create_index("user_id")
    logger.info("Jobsite backend ready")


# ---------- File utils ----------
def compress_image(data: bytes, max_edge: int = 1600, quality: int = 80) -> bytes:
    try:
        im = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
        w, h = im.size
        long_edge = max(w, h)
        if long_edge > max_edge:
            scale = max_edge / long_edge
            im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=quality, optimize=True)
        return buf.getvalue()
    except Exception as e:
        logger.error(f"compress failed: {e}")
        return data


def make_thumb(data: bytes, size: int = 400) -> bytes:
    try:
        im = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
        im.thumbnail((size, size), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=75, optimize=True)
        return buf.getvalue()
    except Exception:
        return data


# ---------- Auth routes ----------
@api.post("/auth/register")
async def register(req: RegisterReq):
    if await db.users.find_one({"email": req.email.lower()}):
        raise HTTPException(400, "Email already registered")
    user_id = new_id()
    user_doc = {
        "id": user_id,
        "email": req.email.lower(),
        "password_hash": hash_password(req.password),
        "company": CompanyProfile(business_name=req.business_name, email=req.email).model_dump(),
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    await seed_for_user(user_id)
    return {"token": make_token(user_id), "user": {"id": user_id, "email": user_doc["email"], "company": user_doc["company"]}}


@api.post("/auth/login")
async def login(req: LoginReq):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    return {"token": make_token(user["id"]),
            "user": {"id": user["id"], "email": user["email"], "company": user.get("company", {})}}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return {"id": user["id"], "email": user["email"], "company": user.get("company", {})}


@api.put("/company")
async def update_company(payload: CompanyProfile, user: dict = Depends(current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"company": payload.model_dump()}})
    return payload.model_dump()


# ---------- File routes ----------
@api.post("/files/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(current_user)):
    raw = await file.read()
    ct = (file.content_type or "").lower()
    is_image = ct.startswith("image/")
    file_id = new_id()
    ext = "jpg" if is_image else (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin")
    base_path = f"{APP_NAME}/uploads/{user['id']}/{file_id}"

    if is_image:
        compressed = compress_image(raw)
        thumb = make_thumb(raw)
        main_res = put_object(f"{base_path}.jpg", compressed, "image/jpeg")
        thumb_res = put_object(f"{base_path}_thumb.jpg", thumb, "image/jpeg")
        record = {
            "id": file_id,
            "user_id": user["id"],
            "storage_path": main_res["path"],
            "thumb_path": thumb_res["path"],
            "original_filename": file.filename,
            "content_type": "image/jpeg",
            "size": main_res.get("size", len(compressed)),
            "is_image": True,
            "is_deleted": False,
            "created_at": now_iso(),
        }
    else:
        main_res = put_object(f"{base_path}.{ext}", raw, ct or "application/octet-stream")
        record = {
            "id": file_id,
            "user_id": user["id"],
            "storage_path": main_res["path"],
            "thumb_path": None,
            "original_filename": file.filename,
            "content_type": ct or "application/octet-stream",
            "size": main_res.get("size", len(raw)),
            "is_image": False,
            "is_deleted": False,
            "created_at": now_iso(),
        }
    await db.files.insert_one(record)
    return {"id": file_id, "is_image": record["is_image"]}


@api.get("/files/{file_id}")
async def get_file(file_id: str, thumb: bool = False, user: dict = Depends(current_user)):
    rec = await db.files.find_one({"id": file_id, "user_id": user["id"], "is_deleted": False})
    if not rec:
        raise HTTPException(404, "File not found")
    path = rec["thumb_path"] if (thumb and rec.get("thumb_path")) else rec["storage_path"]
    data, ct = get_object(path)
    return Response(content=data, media_type=rec.get("content_type", ct))


# ---------- Clients ----------
@api.get("/clients")
async def list_clients(user: dict = Depends(current_user), include_archived: bool = False):
    q = {"user_id": user["id"]}
    if not include_archived:
        q["archived"] = False
    docs = await db.clients.find(q, {"_id": 0}).sort("name", 1).to_list(1000)
    return docs


@api.post("/clients")
async def create_client(payload: ClientIn, user: dict = Depends(current_user)):
    doc = {"id": new_id(), "user_id": user["id"], **payload.model_dump(), "archived": False, "created_at": now_iso()}
    await db.clients.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/clients/{cid}")
async def get_client(cid: str, user: dict = Depends(current_user)):
    doc = await db.clients.find_one({"id": cid, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Client not found")
    jobs = await db.jobs.find({"user_id": user["id"], "client_id": cid, "archived": False}, {"_id": 0}).to_list(1000)
    doc["jobs"] = jobs
    return doc


@api.put("/clients/{cid}")
async def update_client(cid: str, payload: ClientIn, user: dict = Depends(current_user)):
    r = await db.clients.update_one({"id": cid, "user_id": user["id"]}, {"$set": payload.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404)
    return {"ok": True}


@api.delete("/clients/{cid}")
async def archive_client(cid: str, user: dict = Depends(current_user)):
    await db.clients.update_one({"id": cid, "user_id": user["id"]}, {"$set": {"archived": True}})
    return {"ok": True}


# ---------- Jobs ----------
@api.get("/jobs")
async def list_jobs(user: dict = Depends(current_user), include_archived: bool = False):
    q = {"user_id": user["id"]}
    if not include_archived:
        q["archived"] = False
    jobs = await db.jobs.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # enrich with money summary
    clients_map = {c["id"]: c for c in await db.clients.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)}
    for j in jobs:
        est = await db.estimates.find_one({"user_id": user["id"], "job_id": j["id"]}, {"_id": 0})
        j["contract_total"] = est["total"] if est else 0
        j["estimate_status"] = est["status"] if est else None
        exp_docs = await db.expenses.find({"user_id": user["id"], "job_id": j["id"]}, {"_id": 0}).to_list(1000)
        j["costs_to_date"] = round(sum(e["amount"] for e in exp_docs), 2)
        j["profit"] = round(j["contract_total"] - j["costs_to_date"], 2)
        j["profit_pct"] = round((j["profit"] / j["contract_total"]) * 100, 1) if j["contract_total"] else 0
        j["client"] = clients_map.get(j["client_id"])
    return jobs


@api.post("/jobs")
async def create_job(payload: JobIn, user: dict = Depends(current_user)):
    if payload.status not in VALID_JOB_STATUSES:
        raise HTTPException(400, "Invalid status")
    job_num = await next_job_number(user["id"])
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "job_number": job_num,
        **payload.model_dump(),
        "archived": False,
        "created_at": now_iso(),
    }
    await db.jobs.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/jobs/{jid}")
async def get_job(jid: str, user: dict = Depends(current_user)):
    job = await db.jobs.find_one({"id": jid, "user_id": user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(404)
    client = await db.clients.find_one({"id": job["client_id"], "user_id": user["id"]}, {"_id": 0})
    est = await db.estimates.find_one({"user_id": user["id"], "job_id": jid}, {"_id": 0})
    expenses = await db.expenses.find({"user_id": user["id"], "job_id": jid}, {"_id": 0}).sort("date", -1).to_list(1000)
    logs = await db.log_entries.find({"user_id": user["id"], "job_id": jid}, {"_id": 0}).sort("date", -1).to_list(1000)
    hours = await db.hours_entries.find({"user_id": user["id"], "job_id": jid}, {"_id": 0}).sort("date", -1).to_list(1000)
    job["client"] = client
    job["estimate"] = est
    job["expenses"] = [expense_public(e) for e in expenses]
    job["expense_summary"] = expense_summary(expenses)
    job["logs"] = logs
    job["hours"] = hours
    job["contract_total"] = est["total"] if est else 0
    job["costs_to_date"] = round(sum(e["amount"] for e in expenses), 2)
    job["profit"] = round(job["contract_total"] - job["costs_to_date"], 2)
    job["profit_pct"] = round((job["profit"] / job["contract_total"]) * 100, 1) if job["contract_total"] else 0
    return job


@api.put("/jobs/{jid}")
async def update_job(jid: str, payload: JobIn, user: dict = Depends(current_user)):
    if payload.status not in VALID_JOB_STATUSES:
        raise HTTPException(400, "Invalid status")
    r = await db.jobs.update_one({"id": jid, "user_id": user["id"]}, {"$set": payload.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404)
    return {"ok": True}


@api.delete("/jobs/{jid}")
async def archive_job(jid: str, user: dict = Depends(current_user)):
    await db.jobs.update_one({"id": jid, "user_id": user["id"]}, {"$set": {"archived": True}})
    return {"ok": True}


# ---------- Estimate ----------
def compute_totals(items: list, tax_rate: float) -> tuple[float, float, float]:
    subtotal = 0.0
    for it in items:
        it["line_total"] = round(float(it.get("quantity", 0)) * float(it.get("unit_price", 0)), 2)
        subtotal += it["line_total"]
    subtotal = round(subtotal, 2)
    tax = round(subtotal * (tax_rate / 100.0), 2)
    total = round(subtotal + tax, 2)
    return subtotal, tax, total


@api.put("/jobs/{jid}/estimate")
async def upsert_estimate(jid: str, payload: EstimateIn, user: dict = Depends(current_user)):
    job = await db.jobs.find_one({"id": jid, "user_id": user["id"]})
    if not job:
        raise HTTPException(404)
    items = [it.model_dump() for it in payload.line_items]
    subtotal, tax, total = compute_totals(items, payload.tax_rate)
    doc = {
        "line_items": items,
        "tax_rate": payload.tax_rate,
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
        "status": payload.status,
        "notes": payload.notes,
        "user_id": user["id"],
        "job_id": jid,
    }
    existing = await db.estimates.find_one({"user_id": user["id"], "job_id": jid})
    if existing:
        await db.estimates.update_one({"id": existing["id"]}, {"$set": doc})
        doc["id"] = existing["id"]
        doc["created_at"] = existing.get("created_at", now_iso())
    else:
        doc["id"] = new_id()
        doc["created_at"] = now_iso()
        await db.estimates.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------- Expenses ----------
@api.post("/jobs/{jid}/expenses")
async def add_expense(jid: str, payload: ExpenseIn, user: dict = Depends(current_user)):
    payload.job_id = jid
    return await save_expense(db, user["id"], payload)


@api.delete("/expenses/{eid}")
async def delete_expense(eid: str, user: dict = Depends(current_user)):
    result = await db.expenses.delete_one({"id": eid, "user_id": user["id"]})
    if not result.deleted_count:
        raise HTTPException(404, "Expense not found")
    return {"ok": True}


# ---------- Log entries ----------
@api.post("/jobs/{jid}/log")
async def add_log(jid: str, payload: LogEntryIn, user: dict = Depends(current_user)):
    doc = {"id": new_id(), "user_id": user["id"], "job_id": jid, **payload.model_dump(), "created_at": now_iso()}
    await db.log_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/log/{lid}")
async def delete_log(lid: str, user: dict = Depends(current_user)):
    await db.log_entries.delete_one({"id": lid, "user_id": user["id"]})
    return {"ok": True}


# ---------- Hours ----------
@api.post("/jobs/{jid}/hours")
async def add_hours(jid: str, payload: HoursEntryIn, user: dict = Depends(current_user)):
    doc = {"id": new_id(), "user_id": user["id"], "job_id": jid, **payload.model_dump(), "created_at": now_iso()}
    await db.hours_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/hours/{hid}")
async def delete_hours(hid: str, user: dict = Depends(current_user)):
    await db.hours_entries.delete_one({"id": hid, "user_id": user["id"]})
    return {"ok": True}


# ---------- Rate card ----------
@api.get("/rate-card")
async def list_rate(user: dict = Depends(current_user)):
    return await db.rate_items.find({"user_id": user["id"]}, {"_id": 0}).sort("category", 1).to_list(1000)


@api.post("/rate-card")
async def add_rate(payload: RateItemIn, user: dict = Depends(current_user)):
    doc = {"id": new_id(), "user_id": user["id"], **payload.model_dump(), "created_at": now_iso()}
    await db.rate_items.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/rate-card/{rid}")
async def update_rate(rid: str, payload: RateItemIn, user: dict = Depends(current_user)):
    r = await db.rate_items.update_one({"id": rid, "user_id": user["id"]}, {"$set": payload.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404)
    return {"ok": True}


@api.delete("/rate-card/{rid}")
async def delete_rate(rid: str, user: dict = Depends(current_user)):
    await db.rate_items.delete_one({"id": rid, "user_id": user["id"]})
    return {"ok": True}


# ---------- Dashboard summary ----------
@api.get("/dashboard/summary")
async def dashboard_summary(user: dict = Depends(current_user)):
    jobs = await db.jobs.find({"user_id": user["id"], "archived": False}, {"_id": 0}).to_list(1000)
    open_estimates = 0.0
    approved_work = 0.0
    unbilled_expenses = 0.0
    profit_month = 0.0
    profit_at_risk = 0.0
    unbilled_materials = []

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    for j in jobs:
        est = await db.estimates.find_one({"user_id": user["id"], "job_id": j["id"]}, {"_id": 0})
        expenses = await db.expenses.find({"user_id": user["id"], "job_id": j["id"]}, {"_id": 0}).to_list(1000)
        exp_total = sum(e["amount"] for e in expenses)
        if est and j['status'] in ('Complete', 'Invoiced'):
            profit_at_risk += max(0, est['total'] - exp_total)
        for expense in expenses:
            item = expense_public(expense)
            if item['unbilled_materials']:
                unbilled_materials.append({'expense_id': item['id'], 'job_id': j['id'],
                    'job_title': j['title'], 'vendor': item['vendor'], 'amount': item['billable_amount'],
                    'attachment_status': item['attachment_status']})

        if est:
            if est["status"] in ("draft", "sent"):
                open_estimates += est["total"]
            if j["status"] in ("Approved", "In Progress", "Complete", "Invoiced"):
                approved_work += est["total"]

        if j["status"] in ("In Progress", "Complete", "Approved"):
            unbilled_expenses += exp_total

        if j["status"] in ("Paid", "Invoiced") and j.get("created_at", "") >= month_start:
            if est:
                profit_month += est["total"] - exp_total

    return {
        "open_estimates": round(open_estimates, 2),
        "approved_work": round(approved_work, 2),
        "unbilled_expenses": round(unbilled_expenses, 2),
        "profit_month": round(profit_month, 2),
        "profit_at_risk": round(profit_at_risk, 2),
        "unbilled_materials": unbilled_materials,
        "unbilled_materials_total": round(sum(e['amount'] for e in unbilled_materials), 2),
    }


# ---------- Estimate from photos ----------

@api.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...), user: dict = Depends(current_user)):
    from emergentintegrations.llm.openai import OpenAISpeechToText

    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(400, "Audio too large (25MB max)")
    try:
        stt = OpenAISpeechToText(api_key=EMERGENT_KEY)
        buf = io.BytesIO(data)
        buf.name = file.filename or "voice.webm"
        resp = await stt.transcribe(
            file=buf, model="whisper-1", response_format="json", language="en",
            prompt="Contractor describing scope of work for a construction estimate: surfaces, rooms, coats, materials, exclusions.",
        )
        return {"text": resp.text}
    except Exception as e:
        logger.error(f"transcribe failed: {e}")
        raise HTTPException(502, "Transcription failed — please type the description instead.")


ANALYSIS_SYSTEM = """You are a senior estimator for residential trade work (painting, drywall, roofing, landscape).
You receive: (1) photos of a job site, (2) the contractor's own description of what the client wants done.
Your job: identify SCOPE ONLY.
- The DESCRIPTION defines what work is included and excluded. Respect it.
- The PHOTOS establish condition, surfaces, materials and complications (water damage, popcorn ceiling, wallpaper, failing paint, difficult access, high ceilings).
- If photos clearly show a surface/condition the description does not mention (e.g. popcorn ceiling when only walls were described), DO NOT silently include or omit it. Put it in "questions" with a suggested line item, and mark that item uncertain.
- NEVER guess dimensions. NEVER guess prices. Only identify work types, surfaces, materials, conditions.
Return ONLY valid JSON with this exact shape:
{
  "scope_summary": "2-4 sentence plain-English summary of the work",
  "conditions": ["short condition strings"],
  "items": [
    {
      "description": "line item description",
      "rate_item_name": "exact name from the contractor's rate card, or null if none fits",
      "unit": "sq ft | linear ft | each | hour | day | square | gal | load",
      "quantity_basis": "wall_area | ceiling_area | trim_lf | fixed",
      "quantity": 1,
      "uncertain": false,
      "question": null,
      "note": "why this line exists"
    }
  ],
  "assumptions": {"coats": 2, "ceiling_height_ft": 9, "materials_grade": "standard"}
}
Rules:
- "rate_item_name" must be copied EXACTLY from the provided rate card list, or null.
- "quantity_basis": wall_area for wall paint/prep lines, ceiling_area for ceiling lines, trim_lf for trim/baseboard, fixed with explicit quantity for per-unit work (cabinet doors, dumpster loads, etc.).
- For uncertain items (question-driven): set "uncertain": true and "question": "The ceiling appears to be popcorn texture. Include ceilings in this estimate?"
- "assumptions" values may be null if you cannot infer them."""


@api.post("/jobs/{jid}/analyze-photos")
async def analyze_photos(
    jid: str,
    photos: List[UploadFile] = File(...),
    description: str = Form(""),
    user: dict = Depends(current_user),
):
    job = await db.jobs.find_one({"id": jid, "user_id": user["id"]})
    if not job:
        raise HTTPException(404, "Job not found")
    if not description.strip():
        raise HTTPException(400, "Description is required")
    if not (1 <= len(photos) <= 5):
        raise HTTPException(400, "Upload between 1 and 5 photos")

    # store photos + build image contents
    from emergentintegrations.llm.chat import (ImageContent, LlmChat,
                                               StreamDone, TextDelta,
                                               UserMessage)

    rate_items = await db.rate_items.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    rate_names = [r["name"] for r in rate_items]

    image_contents = []
    stored_ids = []
    for f in photos:
        raw = await f.read()
        compressed = compress_image(raw)
        file_id = new_id()
        path = f"{APP_NAME}/uploads/{user['id']}/{file_id}.jpg"
        res = put_object(path, compressed, "image/jpeg")
        await db.files.insert_one({
            "id": file_id, "user_id": user["id"], "storage_path": res["path"],
            "thumb_path": None, "original_filename": f.filename or "photo.jpg",
            "content_type": "image/jpeg", "size": res.get("size", len(compressed)),
            "is_image": True, "is_deleted": False, "created_at": now_iso(),
        })
        stored_ids.append(file_id)
        image_contents.append(ImageContent(image_base64=base64.b64encode(compressed).decode()))

    prompt = (
        f"CONTRACTOR'S DESCRIPTION OF THE BID:\n{description}\n\n"
        f"CONTRACTOR'S RATE CARD (match by exact name only):\n" + "\n".join(f"- {n}" for n in rate_names) +
        "\n\nAnalyze the attached photos and return ONLY the JSON object."
    )

    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"scope-{jid}-{new_id()}",
            system_message=ANALYSIS_SYSTEM,
        ).with_model("openai", "gpt-5.4")
        text = ""
        async for ev in chat.stream_message(UserMessage(text=prompt, file_contents=image_contents)):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                break
    except Exception as e:
        logger.error(f"analysis llm failed: {e}")
        raise HTTPException(502, "Photo analysis failed. Check your connection and try again.")

    parsed = None
    try:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        parsed = json.loads(m.group(0)) if m else None
    except Exception:
        parsed = None
    if not parsed or "items" not in parsed:
        logger.error(f"analysis parse failed: {text[:500]}")
        raise HTTPException(502, "Could not read the analysis result. Try again with clearer photos.")

    return {
        "scope_summary": parsed.get("scope_summary", ""),
        "conditions": parsed.get("conditions", []),
        "items": parsed.get("items", []),
        "assumptions": parsed.get("assumptions", {}),
        "photo_ids": stored_ids,
        "description": description,
    }


class ScopeItemIn(BaseModel):
    description: str
    rate_item_name: Optional[str] = None
    unit: str = "sq ft"
    quantity_basis: str = "fixed"
    quantity: Optional[float] = None
    note: str = ""


class BuildEstimateIn(BaseModel):
    items: List[ScopeItemIn]
    wall_area: float = 0
    ceiling_area: float = 0
    trim_lf: float = 0
    coats: int = 1


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


@api.post("/jobs/{jid}/build-estimate")
async def build_estimate(jid: str, payload: BuildEstimateIn, user: dict = Depends(current_user)):
    job = await db.jobs.find_one({"id": jid, "user_id": user["id"]})
    if not job:
        raise HTTPException(404, "Job not found")
    rate_items = await db.rate_items.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    by_norm = {_norm(r["name"]): r for r in rate_items}

    basis_map = {"wall_area": payload.wall_area, "ceiling_area": payload.ceiling_area, "trim_lf": payload.trim_lf}
    lines = []
    for it in payload.items:
        dlow = it.description.lower()
        # coat filtering
        if "second coat" in dlow and payload.coats < 2:
            continue
        if "third coat" in dlow and payload.coats < 3:
            continue

        qty = None
        if it.quantity_basis in basis_map and basis_map[it.quantity_basis] > 0:
            qty = round(basis_map[it.quantity_basis], 2)
        elif it.quantity:
            qty = round(float(it.quantity), 2)
        else:
            qty = 0

        # match to user's rate card ONLY
        match = None
        if it.rate_item_name:
            match = by_norm.get(_norm(it.rate_item_name))
        if not match and it.rate_item_name:
            target = _norm(it.rate_item_name)
            for k, r in by_norm.items():
                if target and (target in k or k in target):
                    match = r
                    break

        if match:
            price = float(match["unit_price"])
            lines.append({
                "description": it.description,
                "quantity": qty,
                "unit": match["unit"],
                "unit_price": price,
                "line_total": round(qty * price, 2),
                "needs_price": False,
                "rate_item_id": match["id"],
                "note": it.note,
            })
        else:
            lines.append({
                "description": it.description,
                "quantity": qty,
                "unit": it.unit,
                "unit_price": 0,
                "line_total": 0,
                "needs_price": True,
                "rate_item_id": None,
                "note": it.note,
            })

    return {"line_items": lines}


register_receipt_routes(api, db, current_user, put_object, get_object, compress_image, make_thumb, APP_NAME, EMERGENT_KEY)
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()
