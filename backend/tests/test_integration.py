"""Executar somente contra desenvolvimento; todas as escritas usam rollback."""
import unittest
from unittest.mock import patch
from uuid import uuid4

import psycopg
from fastapi.testclient import TestClient

from app.main import app


class IntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_context = TestClient(app)
        cls.client = cls.client_context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_context.__exit__(None, None, None)

    def test_health_and_documentation(self):
        self.assertEqual(self.client.get("/health").json(), {"status": "ok"})
        response = self.client.get("/health/db")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["database"], "conectado")
        self.assertEqual(self.client.get("/docs").status_code, 200)

    def test_database_unavailable_does_not_leak_details(self):
        with patch.object(app.state.db_pool, "connection", side_effect=psycopg.OperationalError("private")):
            response = self.client.get("/health/db")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "Banco indisponivel"})

    def test_parameterized_write_and_rollback(self):
        email = f"Teste-{uuid4()}@EXEMPLO.invalid"
        with app.state.db_pool.connection() as conn:
            with conn.transaction(force_rollback=True):
                row = conn.execute(
                    """INSERT INTO safradireta.conta(tipo,email_acesso,senha_hash,telefone_recuperacao)
                       VALUES(%s,%s,%s,%s) RETURNING id,email_acesso""",
                    ("PF", email, "hash-ficticio-apenas-teste", "31999990000"),
                ).fetchone()
                self.assertEqual(row["email_acesso"], email)
                # Nome com aspas comprova o uso de parametros, sem concatenacao SQL.
                conn.execute("INSERT INTO safradireta.perfil_pf(conta_id,nome) VALUES(%s,%s)",
                             (row["id"], "Teste D'Avila"))
                with self.assertRaises(psycopg.errors.UniqueViolation):
                    with conn.transaction():
                        conn.execute(
                            """INSERT INTO safradireta.conta(tipo,email_acesso,senha_hash,telefone_recuperacao)
                               VALUES(%s,%s,%s,%s)""", ("PF", email, "teste", "teste")
                        )
            self.assertIsNone(conn.execute("SELECT id FROM safradireta.conta WHERE email_acesso=%s", (email,)).fetchone())


if __name__ == "__main__":
    unittest.main()
