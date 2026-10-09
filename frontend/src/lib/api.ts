"use client";

/**
 * Cliente da API do inAdmav.
 *
 * Anexa o ID token do Firebase em cada chamada e traduz erro de HTTP em
 * mensagem que a pessoa entende — a secretaria não deve ver "422".
 */

import { obterAuth } from "./firebase";
import type {
  Aniversariante,
  Cargo,
  Celula,
  Evento,
  GrupoCargo,
  Lancamento,
  ListaAniversariantes,
  OpcoesFormulario,
  PainelResumo,
  Pessoa,
  PessoaEntrada,
  PessoaOpcao,
  ResumoFinanceiro,
  Situacao,
  TipoLancamento,
  Usuario,
  Tarefa,
  TarefaEntrada,
  StatusTarefa,
} from "./tipos";

const BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8080";
const PREFIXO = "/api/v1";

export class ErroApi extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroApi";
  }

  /** Erro de permissão pede uma tela diferente de erro de rede. */
  get ehPermissao() {
    return this.status === 403;
  }
  get ehNaoAutenticado() {
    return this.status === 401;
  }
  get ehNaoEncontrado() {
    return this.status === 404;
  }
}

async function token(): Promise<string | null> {
  const usuario = obterAuth().currentUser;
  if (!usuario) return null;
  return usuario.getIdToken();
}

type Opcoes = {
  metodo?: "GET" | "POST" | "PATCH" | "DELETE";
  corpo?: unknown;
  autenticado?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
};

async function chamar<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const { metodo = "GET", corpo, autenticado = true, query } = opcoes;

  const url = new URL(`${BASE}${PREFIXO}${caminho}`);
  if (query) {
    for (const [chave, valor] of Object.entries(query)) {
      if (valor !== undefined && valor !== null && valor !== "") {
        url.searchParams.set(chave, String(valor));
      }
    }
  }

  const cabecalhos: Record<string, string> = {};
  if (corpo !== undefined) cabecalhos["Content-Type"] = "application/json";

  if (autenticado) {
    const t = await token();
    if (!t) throw new ErroApi(401, "Sua sessão terminou. Entre novamente.");
    cabecalhos["Authorization"] = `Bearer ${t}`;
  }

  let resposta: Response;
  try {
    resposta = await fetch(url.toString(), {
      method: metodo,
      headers: cabecalhos,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroApi(0, "Sem conexão com o servidor. Verifique a internet.");
  }

  if (resposta.status === 204) return undefined as T;

  if (!resposta.ok) {
    let detalhe = `Erro ${resposta.status}`;
    try {
      const dados = await resposta.json();
      if (typeof dados.detail === "string") {
        detalhe = dados.detail;
      } else if (Array.isArray(dados.detail)) {
        // Erro de validação do Pydantic: mostra a primeira mensagem, que
        // já vem em português vinda dos validadores do domínio.
        detalhe = dados.detail[0]?.msg ?? detalhe;
        detalhe = detalhe.replace(/^Value error,\s*/, "");
      }
    } catch {
      /* resposta sem corpo JSON */
    }
    throw new ErroApi(resposta.status, detalhe);
  }

  return resposta.json() as Promise<T>;
}

// --- Painel ---------------------------------------------------------------

export const api = {
  tarefas: () => chamar<Tarefa[]>("/secretaria/tarefas"),
  criarTarefa: (dados: TarefaEntrada) => chamar<Tarefa>("/secretaria/tarefas", { metodo: "POST", corpo: dados }),
  atualizarTarefa: (id: string, dados: Partial<TarefaEntrada> & { status?: StatusTarefa }) =>
    chamar<Tarefa>(`/secretaria/tarefas/${encodeURIComponent(id)}`, { metodo: "PATCH", corpo: dados }),
  painel: () => chamar<PainelResumo>("/painel"),
  eu: () => chamar<Usuario>("/eu"),
  igreja: () =>
    chamar<{ id: string; nome: string; cadastro_publico_ativo: boolean }>(
      "/igreja",
    ),

  // --- Pessoas ------------------------------------------------------------

  pessoas: (filtros?: {
    grupo?: GrupoCargo;
    cargo_id?: string;
    celula_id?: string;
    situacao?: Situacao;
    pendentes?: boolean;
    arquivados?: boolean;
    busca?: string;
  }) => chamar<Pessoa[]>("/pessoas", { query: filtros }),

  pessoasOpcoesFinanceiro: () =>
    chamar<PessoaOpcao[]>("/pessoas/opcoes-financeiro"),

  pessoa: (id: string) => chamar<Pessoa>(`/pessoas/${id}`),

  criarPessoa: (dados: PessoaEntrada) =>
    chamar<Pessoa>("/pessoas", { metodo: "POST", corpo: dados }),

  atualizarPessoa: (
    id: string,
    dados: Partial<PessoaEntrada & { revisado: boolean; arquivado: boolean }>,
  ) =>
    chamar<Pessoa>(`/pessoas/${id}`, { metodo: "PATCH", corpo: dados }),

  removerPessoa: (id: string) =>
    chamar<void>(`/pessoas/${id}`, { metodo: "DELETE" }),

  conferirCadastros: (ids: string[]) =>
    chamar<{ conferidos: number }>("/pessoas/conferir", {
      metodo: "POST",
      corpo: { ids },
    }),

  // --- Aniversariantes ----------------------------------------------------

  aniversariantes: (mes?: number, ano?: number, grupo?: GrupoCargo) =>
    chamar<ListaAniversariantes>("/aniversariantes", {
      query: { mes, ano, grupo },
    }),

  // --- Cargos e células ---------------------------------------------------

  cargos: () => chamar<Cargo[]>("/cargos"),
  criarCargo: (dados: { nome: string; grupo: GrupoCargo; ordem?: number }) =>
    chamar<Cargo>("/cargos", { metodo: "POST", corpo: dados }),
  atualizarCargo: (id: string, dados: Partial<Cargo>) =>
    chamar<{ ok: boolean }>(`/cargos/${id}`, { metodo: "PATCH", corpo: dados }),
  removerCargo: (id: string) =>
    chamar<{ removido: boolean; pessoas_desvinculadas: number }>(
      `/cargos/${id}`,
      { metodo: "DELETE" },
    ),

  celulas: () => chamar<Celula[]>("/celulas"),
  criarCelula: (dados: Partial<Celula> & { nome: string }) =>
    chamar<{ id: string }>("/celulas", { metodo: "POST", corpo: dados }),
  atualizarCelula: (id: string, dados: Partial<Celula>) =>
    chamar<{ ok: boolean }>(`/celulas/${id}`, { metodo: "PATCH", corpo: dados }),
  removerCelula: (id: string) =>
    chamar<{ removida: boolean; pessoas_desvinculadas: number }>(
      `/celulas/${id}`,
      { metodo: "DELETE" },
    ),

  // --- Eventos ------------------------------------------------------------

  eventos: (futuros = false) =>
    chamar<Evento[]>("/eventos", { query: { futuros } }),
  criarEvento: (dados: Partial<Evento> & { titulo: string; data: string }) =>
    chamar<Evento>("/eventos", { metodo: "POST", corpo: dados }),
  atualizarEvento: (id: string, dados: Partial<Evento>) =>
    chamar<Evento>(`/eventos/${id}`, { metodo: "PATCH", corpo: dados }),
  removerEvento: (id: string) =>
    chamar<void>(`/eventos/${id}`, { metodo: "DELETE" }),

  // --- Financeiro ---------------------------------------------------------

  lancamentos: (competencia?: string, tipo?: TipoLancamento) =>
    chamar<Lancamento[]>("/financeiro/lancamentos", {
      query: { competencia, tipo },
    }),
  resumoFinanceiro: (competencia?: string) =>
    chamar<ResumoFinanceiro>("/financeiro/resumo", { query: { competencia } }),
  criarLancamento: (dados: {
    tipo: TipoLancamento;
    valor: string;
    data: string;
    categoria?: string | null;
    descricao?: string | null;
    pessoa_id?: string | null;
  }) =>
    chamar<{ id: string }>("/financeiro/lancamentos", {
      metodo: "POST",
      corpo: dados,
    }),
  removerLancamento: (id: string) =>
    chamar<void>(`/financeiro/lancamentos/${id}`, { metodo: "DELETE" }),

  // --- Usuários -----------------------------------------------------------

  usuarios: () => chamar<Usuario[]>("/usuarios"),
  convidarUsuario: (dados: {
    email: string;
    papel: string;
    nome?: string;
    celula_id?: string;
  }) =>
    chamar<{ convidado: string }>("/usuarios/convidar", {
      metodo: "POST",
      corpo: dados,
    }),
  atualizarUsuario: (uid: string, dados: { papel?: string; ativo?: boolean }) =>
    chamar<{ ok: boolean }>(`/usuarios/${uid}`, {
      metodo: "PATCH",
      corpo: dados,
    }),
};

// --- Formulário público (sem autenticação) --------------------------------

export const apiPublica = {
  opcoes: (igrejaId: string) =>
    chamar<OpcoesFormulario>(`/publico/${igrejaId}/formulario`, {
      autenticado: false,
    }),

  cadastrar: (
    igrejaId: string,
    dados: {
      nome: string;
      nascimento?: { dia: number; mes: number; ano: number | null } | null;
      telefone?: string | null;
      email?: string | null;
      endereco?: string | null;
      situacao?: Situacao;
      cargo_id?: string | null;
      celula_id?: string | null;
    },
  ) =>
    chamar<{ ok: boolean; primeiro_nome: string; mensagem: string }>(
      `/publico/${igrejaId}/cadastro`,
      { metodo: "POST", corpo: dados, autenticado: false },
    ),
};

export type { Aniversariante };
