"""Preparacao compartilhada dos testes de integracao."""
import pytest
from fastapi.testclient import TestClient

from app import ratelimit
from app.database import get_connection
from app.main import app


@pytest.fixture(autouse=True)
def _zerar_limite_de_login():
    """O limite de tentativas fica em memoria; zera para um teste nao afetar o outro."""
    ratelimit.resetar()
    yield


@pytest.fixture()
def client():
    """Cliente HTTP com banco real; tudo que o teste grava e desfeito no fim."""
    with TestClient(app) as c:
        with app.state.db_pool.connection() as conn:
            with conn.transaction(force_rollback=True):
                app.dependency_overrides[get_connection] = lambda: conn
                c.db = conn  # para o teste olhar o banco direto
                try:
                    yield c
                finally:
                    app.dependency_overrides.clear()