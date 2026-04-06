# Handoff — 2026-04-06 (Session 2)

## Ziel dieser Session
Issues #1+#2 implementieren, Bug-Review (30 Bugs gefixt), Proxmox LXC Deployment, Tizen TV App auf Samsung Q80T installieren, Abo-System + Video-Dauer + Spracheingabe.

## Erledigt
- [x] Issue #1: Suchhistorie-Dropdown
- [x] Issue #2: Qualitätswahl im Player
- [x] 30 Bugs gefixt (2 Review-Runden mit 3 parallelen Agenten)
- [x] Issue #3: LXC Container 103 auf Proxmox (192.168.178.76:8080)
- [x] Issue #4: Tizen .wgt App auf Samsung GQ65Q80T installiert (Package: YnOBqFPHf4)
- [x] Sound-Fix: Combined video+audio Format statt separate Streams
- [x] Desktop-Browser-Support (Space, Escape, Maus, Click-Handler)
- [x] Trending-Fallback (Playlist + Suche wenn Feed kaputt)
- [x] Abo-System: Subscribe-Button im Player + Abo-Feed Tab
- [x] Video-Dauer-Badge auf Thumbnails
- [x] Spracheingabe-Attribute am Suchfeld

## Bekannte Bugs (nächste Session)
- [ ] #7: Abos/Verlauf-Tab-Buttons nicht per D-Pad fokussierbar
- [ ] #8: Profil-Wechsel-Button (Topbar rechts) reagiert nicht
- [ ] #5: Frontend /app Pfad-Cleanup
- [ ] #6: History zeigt nur video_id statt Titel

## Entscheidungen
- **Combined Format statt DASH**: `best[ext=mp4]` statt `bestvideo+bestaudio` — Tizen TV kann keine separaten Streams mergen
- **Package ID YnOBqFPHf4**: Samsung TVs brauchen 10-char alphanumerische IDs, nicht frei wählbar
- **Tizen Standard-Zertifikat**: Reicht für Developer Mode, kein Samsung Account nötig
- **Abo-Feed serverseitig**: Backend holt Videos aller Kanäle via yt-dlp Channel-Feed (kann bei vielen Abos langsam werden)
- **Trending Fallback-Kette**: YouTube Feed → Playlist → Suche (weil yt-dlp Trending oft kaputt)

## Infrastruktur
- LXC 103 "tizentube": 192.168.178.76, Debian 13, Docker, autostart
- Samsung TV: 192.168.178.45, Developer Mode aktiv, sdb Port 26101 offen
- Tizen Studio CLI: ~/tizen-studio/ (sdb, tizen CLI)
- TV Deploy: `tizen install -n tizen/TizenTube.wgt -s 192.168.178.45:26101`
- TV Starten: `tizen run -p YnOBqFPHf4.TizenTube -s 192.168.178.45:26101`
- LXC Update: `ssh root@192.168.178.51 "pct exec 103 -- bash -c 'cd /opt/tizentube && git pull && docker compose up -d --build'"`

## Empfohlener erster Schritt nächste Session
Issue #7 fixen: Tab-Navigation in der Topbar per D-Pad implementieren (UP/DOWN zwischen Topbar und Content, LEFT/RIGHT zwischen Tabs).
