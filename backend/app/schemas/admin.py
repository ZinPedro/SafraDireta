from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

# Schemas de Autenticação
class AdminLoginSchema(BaseModel):
    email: EmailStr
    senha: str = Field(..., min_length=1)
    pin: str = Field(..., min_length=6, max_length=6, description="PIN de 6 dígitos")

class AdminSessionResponseSchema(BaseModel):
    token: str
    tipo: str = "ADMIN"
    conta_id: str
    nome: str
    email: str

# Schemas do Dossiê PJ
class AvaliacaoDocumentoSchema(BaseModel):
    resultado: str = Field(..., description="'APROVADA' ou 'RECUSADA'")
    motivo_recusa: Optional[str] = Field(
        None, 
        description="Obrigatório caso o resultado seja 'RECUSADA'"
    )

class EmpresaPendenteSchema(BaseModel):
    conta_id: UUID
    razao_social: str
    cnpj: str
    estado: str
    
class ListaEmpresasPendentesResponse(BaseModel):
    empresas: List[EmpresaPendenteSchema]
    total: int


# Schemas de Governança
class AplicarPunicaoSchema(BaseModel):
    motivo: str = Field(..., min_length=5, description="Motivo detalhado da sanção")
    tipo_punicao: str = Field(..., description="'SUSPENSAO_TEMPORARIA', 'ADVERTENCIA' ou 'BANIMENTO'")
    dias_duracao: Optional[int] = Field(None, description="Quantidade de dias (caso seja temporária)")