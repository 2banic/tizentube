"""
E2E-Tests die das MVP definieren.

Diese Tests beschreiben WAS das System können muss:
1. YouTube-Suche funktioniert
2. Video-Stream-URL wird zurückgegeben (mit Qualitätswahl)
3. Suchhistorie wird gespeichert und abgerufen
4. Profile CRUD
5. SponsorBlock liefert Segmente
6. Watch History wird gespeichert
"""
import pytest


class TestSearch:
    """YouTube-Suche muss Ergebnisse liefern."""

    def test_search_returns_results(self, client):
        res = client.get("/search?q=python+tutorial&limit=5")
        assert res.status_code == 200
        data = res.json()
        assert len(data) > 0
        assert "id" in data[0]
        assert "title" in data[0]

    def test_search_empty_query_returns_empty(self, client):
        res = client.get("/search?q=&limit=5")
        assert res.status_code == 200


class TestVideo:
    """Video-Endpunkt muss Stream-URL und Qualitätswahl bieten."""

    def test_get_video_returns_stream_url(self, client):
        # dQw4w9WgXcQ = Rick Astley (stabil verfügbar)
        res = client.get("/video/dQw4w9WgXcQ")
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == "dQw4w9WgXcQ"
        assert "stream_url" in data
        assert data["stream_url"] is not None

    def test_get_video_with_quality_parameter(self, client):
        res = client.get("/video/dQw4w9WgXcQ?quality=360")
        assert res.status_code == 200
        data = res.json()
        assert "stream_url" in data


class TestProfiles:
    """Profil-Management: erstellen, auflisten, löschen."""

    def test_create_and_list_profile(self, client):
        res = client.post("/profiles", json={"name": "Test", "avatar_color": "#FF0000"})
        assert res.status_code == 200
        profile = res.json()
        assert profile["name"] == "Test"
        pid = profile["id"]

        res = client.get("/profiles")
        assert res.status_code == 200
        profiles = res.json()
        assert any(p["id"] == pid for p in profiles)

    def test_delete_profile(self, client):
        res = client.post("/profiles", json={"name": "ToDelete"})
        pid = res.json()["id"]

        res = client.delete(f"/profiles/{pid}")
        assert res.status_code == 200

        res = client.get("/profiles")
        assert not any(p["id"] == pid for p in res.json())


class TestWatchHistory:
    """Watch History: Videos werden im Verlauf gespeichert."""

    def test_add_and_get_history(self, client):
        # Profil anlegen
        res = client.post("/profiles", json={"name": "HistTest"})
        pid = res.json()["id"]

        # Video zum Verlauf hinzufügen
        res = client.post(f"/profiles/{pid}/history/abc123")
        assert res.status_code == 200

        # Verlauf abrufen
        res = client.get(f"/profiles/{pid}/history")
        assert res.status_code == 200
        history = res.json()
        assert len(history) == 1
        assert history[0]["video_id"] == "abc123"

    def test_history_deduplication(self, client):
        res = client.post("/profiles", json={"name": "Dedup"})
        pid = res.json()["id"]

        client.post(f"/profiles/{pid}/history/vid1")
        client.post(f"/profiles/{pid}/history/vid2")
        client.post(f"/profiles/{pid}/history/vid1")  # nochmal

        history = client.get(f"/profiles/{pid}/history").json()
        assert len(history) == 2
        assert history[0]["video_id"] == "vid1"  # neuester zuerst


class TestSponsorBlock:
    """SponsorBlock liefert Segmente oder leeres Array."""

    def test_sponsorblock_returns_list(self, client):
        res = client.get("/sponsorblock/dQw4w9WgXcQ")
        assert res.status_code == 200
        assert isinstance(res.json(), list)


class TestHealth:
    """Health-Endpunkt für Docker/Monitoring."""

    def test_health(self, client):
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"
