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
src/frontend/          # index.html, style.css, app.js
data/profiles/         # Runtime-Daten (gitignored)
tests/                 # e2e/, integration/, unit/
```

## Entwicklung

```bash
# Backend starten
cd /home/basti/projects/tizentube
uvicorn src.backend.main:app --host 0.0.0.0 --port 8080 --reload

# Tests
pytest tests/

# Docker
docker compose up --build
```

## API-Endpunkte

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| GET | `/health` | Health Check |
| GET | `/profiles` | Alle Profile |
| POST | `/profiles` | Profil erstellen |
| DELETE | `/profiles/{id}` | Profil löschen |
| GET | `/profiles/{id}/subscriptions` | Abos eines Profils |
| POST | `/profiles/{id}/subscriptions` | Abo hinzufügen |
| DELETE | `/profiles/{id}/subscriptions/{channel}` | Abo entfernen |
| POST | `/profiles/{id}/sync` | PipePipe/NewPipe Import |
| GET | `/profiles/{id}/history` | Verlauf |
| POST | `/profiles/{id}/history/{video}` | Zum Verlauf hinzufügen |
| GET | `/search?q=...&limit=20` | YouTube Suche |
| GET | `/video/{id}?quality=1080` | Stream-URL (quality: 360/720/1080) |
| GET | `/trending` | Trending DE |
| GET | `/playlist/{id}` | Playlist |
| GET | `/sponsorblock/{id}` | SponsorBlock Segmente |

## Konventionen

- Commits: Conventional Commits (feat/fix/chore)
- Python: keine Type Annotations erzwingen, einfach halten
- Frontend: Vanilla JS, kein Framework — muss auf Tizen TV laufen
- D-Pad Navigation: alle UI-Elemente müssen per Pfeiltasten + Enter bedienbar sein
- API gibt immer JSON zurück

## MVP-Features (v1.0)

- [x] Profile (CRUD)
- [x] YouTube Suche
- [x] Video abspielen mit Stream-URL
- [x] SponsorBlock Integration
- [x] Abo-Verwaltung + PipePipe Import
- [x] Watch History
- [ ] Suchhistorie (localStorage + UI)
- [ ] Qualitätswahl im Player (360/720/1080)
