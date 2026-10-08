import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.errors import conflito, registrar_handlers


class Corpo(BaseModel):
    email: str


def criar_app():
    app = FastAPI()
    registrar_handlers(app)

    @app.get("/conflito")
    def rota_conflito():
        raise conflito("E-mail já cadastrado.", {"email": "Já existe uma conta com este e-mail."})

    @app.post("/validar")
    def rota_validar(corpo: Corpo):
        return corpo

    return app


class ErrosTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(criar_app())

    def test_erro_de_negocio_usa_formato_padrao(self):
        resposta = self.client.get("/conflito")
        self.assertEqual(resposta.status_code, 409)
        self.assertEqual(resposta.json()["erro"]["codigo"], "CONFLITO")
        self.assertIn("email", resposta.json()["erro"]["campos"])

    def test_validacao_devolve_erros_por_campo(self):
        resposta = self.client.post("/validar", json={})
        self.assertEqual(resposta.status_code, 422)
        self.assertIn("email", resposta.json()["erro"]["campos"])


if __name__ == "__main__":
    unittest.main()