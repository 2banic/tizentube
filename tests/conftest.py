import pytest
from fastapi.testclient import TestClient
import os

@pytest.fixture
def data_dir(tmp_path):
    """Temporary data directory for test isolation."""
    return str(tmp_path / "profiles")

@pytest.fixture
def client(data_dir, monkeypatch):
    """Test client with isolated data directory."""
    monkeypatch.setenv("TIZENTUBE_DATA_DIR", data_dir)
    import importlib
    import src.backend.main as main_module
    importlib.reload(main_module)
    from src.backend.main import app
    return TestClient(app)
