# TizenTube

YouTube-Client für Samsung Tizen Smart TVs — ohne Werbung, mit SponsorBlock und Profilen.

## Stack

- **Backend:** Python 3.11+ / FastAPI + yt-dlp + httpx
- **Frontend:** Vanilla HTML/JS/CSS (Tizen TV, D-Pad Navigation, 1920x1080)
- **Deployment:** Docker auf Proxmox LXC (192.168.178.51)
- **Daten:** JSON-Dateien in `data/profiles/` (kein DB)

## Projektstruktur

```
src/backend/main.py    # FastAPI App (Profiles, Search, Video, SponsorBlock)
src/frontend/          # index.html, style.css, app.js (serviert unter /app)
data/profiles/         # Runtime-Daten (gitignored)
tests/                 # e2e/, integration/, unit/
```

## Entwicklung

```bash
# Backend starten
uvicorn src.backend.main:app --host 0.0.0.0 --port 8080 --reload

# Tests (nur Prod-unabhängige)
pip install -r requirements-dev.txt
pytest tests/

# Docker
docker compose up --build
```

## API-Endpunkte

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| GET | `/health` | Health Check |
| GET | `/profiles` | Alle Profile |
| POST | `/profiles` | Profil erstellen (name max 100, avatar_color #hex) |
| DELETE | `/profiles/{id}` | Profil löschen (id: 8-char hex) |
| GET | `/profiles/{id}/subscriptions` | Abos eines Profils |
| POST | `/profiles/{id}/subscriptions` | Abo hinzufügen (channel_id: UC+22 chars) |
| DELETE | `/profiles/{id}/subscriptions/{channel}` | Abo entfernen |
| POST | `/profiles/{id}/sync` | PipePipe/NewPipe Import (max 1 MB) |
| GET | `/profiles/{id}/history` | Verlauf |
| POST | `/profiles/{id}/history/{video}` | Zum Verlauf hinzufügen (video: 11-char ID) |
| GET | `/search?q=...&limit=20` | YouTube Suche (limit max 50) |
| GET | `/video/{id}?quality=1080` | Stream-URL (quality: 360/720/1080) |
| GET | `/trending` | Trending DE |
| GET | `/playlist/{id}` | Playlist (id: 10-64 alphanumeric) |
| GET | `/sponsorblock/{id}` | SponsorBlock Segmente |

Frontend wird unter `/app` serviert (StaticFiles mount).

## Input-Validierung

Alle User-Inputs werden serverseitig validiert:
- `profile_id`: `^[a-f0-9]{8}$` + realpath-Check gegen Path Traversal
- `video_id`: `^[A-Za-z0-9_-]{11}$`
- `playlist_id`: `^[A-Za-z0-9_-]{10,64}$`
- `channel_id`: `^UC[A-Za-z0-9_-]{22}$`
- yt-dlp Exceptions werden gefangen (kein Stacktrace-Leak)

## Konventionen

- Commits: Conventional Commits (feat/fix/chore)
- Python: keine Type Annotations erzwingen, einfach halten
- Frontend: Vanilla JS, kein Framework — muss auf Tizen TV laufen
- D-Pad Navigation: alle UI-Elemente müssen per Pfeiltasten + Enter bedienbar sein
- API gibt immer JSON zurück
- innerHTML nur mit `escapeHtml()` — kein unsanitisiertes User/API-Data
- Docker: Container läuft als non-root (appuser), Healthcheck aktiv

## MVP-Features (v1.0)

- [x] Profile (CRUD)
- [x] YouTube Suche
- [x] Video abspielen mit Stream-URL
- [x] SponsorBlock Integration
- [x] Abo-Verwaltung + PipePipe Import
- [x] Watch History
- [x] Suchhistorie (localStorage + Dropdown-UI)
- [x] Qualitätswahl im Player (360/720/1080, GREEN-Taste)
- [ ] Docker Deployment auf Proxmox (#3)
- [ ] Tizen TV Paketierung .wgt (#4)
- [ ] Frontend /app Pfad-Fix (#5)
- [ ] History mit Titel statt nur video_id (#6)
