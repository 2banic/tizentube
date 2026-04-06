import pytest
from fastapi.testclient import TestClient
import tempfile
import os

@pytest.fixture
def data_dir(tmp_path):
    """Temporary data directory for test isolation."""
    return str(tmp_path / "profiles")

@pytest.fixture
def client(data_dir):
    """Test client with isolated data directory."""
    os.environ["TIZENTUBE_DATA_DIR"] = data_dir
    # Re-import to pick up env var
    import importlib
    import src.backend.main as main_module
    importlib.reload(main_module)
    from src.backend.main import app
    return TestClient(app)
