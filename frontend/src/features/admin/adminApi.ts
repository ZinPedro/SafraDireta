export interface AdminSessionResponse {
  token: string;
  tipo: "ADMIN";
  conta_id: string;
  nome: string;
  email: string;
}

export interface EmpresaPendenteApi {
  conta_id: string;
  razao_social: string;
  cnpj: string;
  estado: string;
}

export interface ListaEmpresasPendentesApiResponse {
  empresas: EmpresaPendenteApi[];
  total: number;
}

export interface AvaliacaoDocumentoInput {
  resultado: "APROVADA" | "RECUSADA";
  motivo_recusa?: string;
}

export interface AplicarPunicaoInput {
  motivo: string;
  tipo_punicao: "SUSPENSAO_TEMPORARIA" | "ADVERTENCIA" | "BANIMENTO";
  dias_duracao?: number;
}

function extrairMensagemErro(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const anyData = data as Record<string, unknown>;

  if (typeof anyData.detail === "string") {
    return anyData.detail;
  }
  if (anyData.detail && typeof anyData.detail === "object") {
    const detailObj = anyData.detail as Record<string, unknown>;
    if (detailObj.erro && typeof detailObj.erro === "object") {
      const errObj = detailObj.erro as Record<string, unknown>;
      if (typeof errObj.mensagem === "string") return errObj.mensagem;
    }
    if (typeof detailObj.message === "string") return detailObj.message;
  }
  if (Array.isArray(anyData.detail) && anyData.detail.length > 0) {
    const first = anyData.detail[0];
    if (first && typeof first === "object" && typeof first.msg === "string") {
      return first.msg;
    }
  }
  if (typeof anyData.message === "string") {
    return anyData.message;
  }
  return fallback;
}

export async function loginAdminApi(payload: {
  email: string;
  senha: string;
  pin: string;
}): Promise<{ ok: true; data: AdminSessionResponse } | { ok: false; erro: string }> {
  try {
    const res = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        ok: false,
        erro: extrairMensagemErro(
          body,
          "Credenciais administrativas ou PIN de segurança inválidos."
        ),
      };
    }

    return { ok: true, data: body as AdminSessionResponse };
  } catch (error) {
    return {
      ok: false,
      erro: error instanceof Error ? error.message : "Erro ao conectar com servidor.",
    };
  }
}

export async function listarEmpresasPendentesApi(
  token: string
): Promise<{ ok: true; data: ListaEmpresasPendentesApiResponse } | { ok: false; erro: string }> {
  try {
    const res = await fetch("/api/admin/empresas/pendentes", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        ok: false,
        erro: extrairMensagemErro(body, "Falha ao listar empresas pendentes."),
      };
    }

    return { ok: true, data: body as ListaEmpresasPendentesApiResponse };
  } catch (error) {
    return {
      ok: false,
      erro: error instanceof Error ? error.message : "Erro ao conectar com servidor.",
    };
  }
}

export async function avaliarDocumentoApi(
  documentoId: string,
  payload: AvaliacaoDocumentoInput,
  token: string
): Promise<{ ok: true; mensagem: string } | { ok: false; erro: string }> {
  try {
    const res = await fetch(`/api/admin/empresas/documentos/${documentoId}/avaliar`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        ok: false,
        erro: extrairMensagemErro(body, "Falha ao avaliar documento."),
      };
    }

    return {
      ok: true,
      mensagem: (body?.mensagem as string) || "Documento avaliado com sucesso.",
    };
  } catch (error) {
    return {
      ok: false,
      erro: error instanceof Error ? error.message : "Erro ao conectar com servidor.",
    };
  }
}

export async function suspenderContaApi(
  contaId: string,
  payload: AplicarPunicaoInput,
  token: string
): Promise<{ ok: true; mensagem: string } | { ok: false; erro: string }> {
  try {
    const res = await fetch(`/api/admin/contas/${contaId}/suspender`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        ok: false,
        erro: extrairMensagemErro(body, "Falha ao suspender conta."),
      };
    }

    return {
      ok: true,
      mensagem: (body?.mensagem as string) || "Conta suspensa com sucesso.",
    };
  } catch (error) {
    return {
      ok: false,
      erro: error instanceof Error ? error.message : "Erro ao conectar com servidor.",
    };
  }
}
