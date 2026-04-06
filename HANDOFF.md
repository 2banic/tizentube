# Handoff — 2026-04-06

## Ziel dieser Session
TizenTube-Projekt bootstrappen: v2-Code als Basis, GitHub Repo, Docker Setup, MVP-Issues, dann Issues #1+#2 implementieren und intensives Bug-Review.

## Erledigt
- [x] Projekt-Scaffold aus v2-Code (/tmp/yt-files/yt2/) in src/backend + src/frontend aufgeteilt
- [x] Git init, GitHub Repo 2banic/tizentube angelegt mit Labels + Milestone v1.0 MVP
- [x] CLAUDE.md, Dockerfile, docker-compose.yml, E2E-Tests
- [x] Issue #1: Suchhistorie-Dropdown mit D-Pad Navigation (localStorage, max 20)
- [x] Issue #2: Qualitätswahl im Player (1080/720/360p, GREEN-Taste, Position bleibt)
- [x] 30 Bugs gefixt in 2 Review-Runden (3 parallele Review-Agenten)
- [x] Vault: Projektnotiz + Projektübersicht aktualisiert

## Naechste Schritte
1. Issue #3: Docker auf Proxmox LXC (192.168.178.51) deployen und von Tizen TV testen
2. Issue #4: Tizen .wgt Paketierung (config.xml, Signierung)
3. Frontend: API-URL muss auf `/app` Prefix umgestellt werden (StaticFiles jetzt unter /app)
4. Frontend zeigt bei History nur video_id statt Titel — Video-Metadaten im History-Eintrag mitspeichern

## Entscheidungen (mit Begruendung)
- **StaticFiles auf /app statt /**: Mount auf "/" shadowed alle API-Routen. /app ist sicher, Frontend muss angepasst werden.
- **JSON-Dateien statt DB**: Für <100 Profile ausreichend, kein DB-Setup auf dem TV-Backend nötig.
- **channel_id Regex UC+22**: YouTube Channel-IDs folgen diesem Format, verhindert SSRF bei zukünftigen Channel-Feed-Features.
- **Kein ffmpeg im Docker**: Alle yt-dlp Calls nutzen skip_download=True, ffmpeg wird nie gebraucht.

## Sackgassen (NICHT wiederholen!)
- Keine in dieser Session.

## Geaenderte Dateien
- `src/backend/main.py` — Komplett überarbeitet: Validation, Error Handling, StaticFiles-Pfad
- `src/frontend/app.js` — Suchhistorie, Quality-Selector, 15 Bug-Fixes
- `src/frontend/index.html` — Search-Dropdown, Quality-Button
- `src/frontend/style.css` — Search-History-Styles
- `Dockerfile` — Non-root user, healthcheck, kein ffmpeg
- `docker-compose.yml` — Healthcheck hinzugefügt
- `requirements.txt` — Gepinnt, nur Prod-Deps
- `requirements-dev.txt` — Neu: Test-Deps separiert
- `.dockerignore` — Neu
- `tests/e2e/test_mvp.py` — Valide Test-IDs
- `tests/conftest.py` — monkeypatch statt globale ENV-Mutation

## Aktueller Zustand
- Tests: 5/5 grün (lokale Tests ohne YouTube-API)
- Docker: noch nicht deployed (Issue #3)
- Build: OK, pushed to main
- GitHub: Issues #1+#2 closed, #3+#4 offen

## Empfohlener erster Schritt
Frontend `app.js` anpassen: API-Calls müssen weiterhin auf `/` gehen (API-Routen), aber die HTML-Seite wird unter `/app` serviert. Testen ob das im Browser funktioniert, dann Docker-Deploy auf Proxmox.
