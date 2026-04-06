from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import yt_dlp
import httpx
import json
import uuid
import os

app = FastAPI(title="TizenTube Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.environ.get("TIZENTUBE_DATA_DIR", "./data/profiles")
os.makedirs(DATA_DIR, exist_ok=True)

# ─── Modelle ───────────────────────────────────────────────

class Profile(BaseModel):
    name: str
    avatar_color: str = "#1565C0"

class Subscription(BaseModel):
    channel_id: str
    channel_name: str
    thumbnail: str = ""

# ─── Helper ────────────────────────────────────────────────

def profile_path(profile_id: str):
    return f"{DATA_DIR}/{profile_id}"

def load_json(path: str, default):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default

def save_json(path: str, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

# ─── Profile ───────────────────────────────────────────────

@app.get("/profiles")
def get_profiles():
    profiles = []
    if not os.path.exists(DATA_DIR):
        return []
    for pid in os.listdir(DATA_DIR):
        meta_path = f"{profile_path(pid)}/profile.json"
        if os.path.exists(meta_path):
            meta = load_json(meta_path, {})
            profiles.append({"id": pid, **meta})
    return profiles

@app.post("/profiles")
def create_profile(profile: Profile):
    pid = str(uuid.uuid4())[:8]
    os.makedirs(profile_path(pid), exist_ok=True)
    save_json(f"{profile_path(pid)}/profile.json", profile.model_dump())
    save_json(f"{profile_path(pid)}/subscriptions.json", [])
    save_json(f"{profile_path(pid)}/playlists.json", [])
    save_json(f"{profile_path(pid)}/history.json", [])
    return {"id": pid, **profile.model_dump()}

@app.delete("/profiles/{profile_id}")
def delete_profile(profile_id: str):
    import shutil
    path = profile_path(profile_id)
    if not os.path.exists(path):
        raise HTTPException(404, "Profil nicht gefunden")
    shutil.rmtree(path)
    return {"ok": True}

# ─── Abonnements ───────────────────────────────────────────

@app.get("/profiles/{profile_id}/subscriptions")
def get_subscriptions(profile_id: str):
    return load_json(f"{profile_path(profile_id)}/subscriptions.json", [])

@app.post("/profiles/{profile_id}/subscriptions")
def add_subscription(profile_id: str, sub: Subscription):
    path = f"{profile_path(profile_id)}/subscriptions.json"
    subs = load_json(path, [])
    if not any(s["channel_id"] == sub.channel_id for s in subs):
        subs.append(sub.model_dump())
        save_json(path, subs)
    return subs

@app.delete("/profiles/{profile_id}/subscriptions/{channel_id}")
def remove_subscription(profile_id: str, channel_id: str):
    path = f"{profile_path(profile_id)}/subscriptions.json"
    subs = load_json(path, [])
    subs = [s for s in subs if s["channel_id"] != channel_id]
    save_json(path, subs)
    return subs

@app.post("/profiles/{profile_id}/sync")
async def sync_from_pipepipe(profile_id: str, file: UploadFile = File(...)):
    content = await file.read()
    data = json.loads(content)
    subs = []
    for entry in data.get("subscriptions", []):
        url = entry.get("url", "")
        channel_id = url.split("/")[-1] if url else ""
        if channel_id:
            subs.append({
                "channel_id": channel_id,
                "channel_name": entry.get("name", ""),
                "thumbnail": ""
            })
    save_json(f"{profile_path(profile_id)}/subscriptions.json", subs)
    return {"imported": len(subs)}

# ─── Watch History ──────────────────────────────────────────

@app.get("/profiles/{profile_id}/history")
def get_history(profile_id: str):
    return load_json(f"{profile_path(profile_id)}/history.json", [])

@app.post("/profiles/{profile_id}/history/{video_id}")
def add_to_history(profile_id: str, video_id: str, progress: float = 0):
    path = f"{profile_path(profile_id)}/history.json"
    history = load_json(path, [])
    history = [h for h in history if h["video_id"] != video_id]
    history.insert(0, {"video_id": video_id, "progress": progress})
    history = history[:100]
    save_json(path, history)
    return {"ok": True}

# ─── YouTube Suche & Video ──────────────────────────────────

@app.get("/search")
def search(q: str, limit: int = 20):
    ydl_opts = {
        "quiet": True,
        "extract_flat": True,
        "skip_download": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        result = ydl.extract_info(f"ytsearch{limit}:{q}", download=False)
        entries = result.get("entries", [])
        return [
            {
                "id": e.get("id"),
                "title": e.get("title"),
                "channel": e.get("channel") or e.get("uploader"),
                "duration": e.get("duration"),
                "thumbnail": f"https://i.ytimg.com/vi/{e.get('id')}/hqdefault.jpg",
            }
            for e in entries if e.get("id")
        ]

@app.get("/video/{video_id}")
def get_video(video_id: str, quality: str = "1080"):
    height = int(quality) if quality.isdigit() else 1080
    ydl_opts = {
        "quiet": True,
        "format": f"bestvideo[ext=mp4][height<={height}]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "skip_download": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
        return {
            "id": video_id,
            "title": info.get("title"),
            "channel": info.get("channel") or info.get("uploader"),
            "description": info.get("description", "")[:500],
            "duration": info.get("duration"),
            "stream_url": info.get("url"),
            "thumbnail": info.get("thumbnail"),
        }

@app.get("/trending")
def trending():
    ydl_opts = {
        "quiet": True,
        "extract_flat": True,
        "skip_download": True,
        "playlistend": 20,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        result = ydl.extract_info("https://www.youtube.com/feed/trending?gl=DE", download=False)
        entries = result.get("entries", [])
        return [
            {
                "id": e.get("id"),
                "title": e.get("title"),
                "channel": e.get("channel") or e.get("uploader"),
                "thumbnail": f"https://i.ytimg.com/vi/{e.get('id')}/hqdefault.jpg",
            }
            for e in entries if e.get("id")
        ]

@app.get("/playlist/{playlist_id}")
def get_playlist(playlist_id: str):
    ydl_opts = {
        "quiet": True,
        "extract_flat": True,
        "skip_download": True,
        "playlistend": 50,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        result = ydl.extract_info(f"https://www.youtube.com/playlist?list={playlist_id}", download=False)
        entries = result.get("entries", [])
        return {
            "title": result.get("title"),
            "videos": [
                {
                    "id": e.get("id"),
                    "title": e.get("title"),
                    "thumbnail": f"https://i.ytimg.com/vi/{e.get('id')}/hqdefault.jpg",
                }
                for e in entries if e.get("id")
            ]
        }

# ─── SponsorBlock ───────────────────────────────────────────

@app.get("/sponsorblock/{video_id}")
async def sponsorblock(video_id: str):
    url = f"https://sponsor.ajay.app/api/skipSegments?videoID={video_id}&categories=[\"sponsor\",\"intro\",\"outro\",\"selfpromo\"]"
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(url, timeout=5)
            if r.status_code == 200:
                return r.json()
            return []
        except Exception:
            return []

# ─── Health ─────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}

# ─── Static Files (Frontend) ───────────────────────────────

app.mount("/", StaticFiles(directory="src/frontend", html=True), name="frontend")
