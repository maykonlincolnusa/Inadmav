/** Tipos espelhando os schemas do backend (backend/app/schemas). */

export type GrupoCargo = "ministerio" | "diaconato" | "cooperacao" | "membresia";
export type Situacao = "membro" | "congregado" | "visitante";
export type OrigemCadastro = "manual" | "formulario" | "importacao";
export type TipoLancamento = "dizimo" | "oferta" | "entrada" | "saida";
export type Papel =
  | "admin"
  | "secretaria"
  | "tesoureiro"
  | "lider_celula"
  | "leitor";

export const ROTULO_GRUPO: Record<GrupoCargo, string> = {
  ministerio: "Ministros",
  diaconato: "Diáconos",
  cooperacao: "Cooperadores",
  membresia: "Membros",
};

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  membro: "Membro",
  congregado: "Congregado",
  visitante: "Visitante",
};

export const ROTULO_PAPEL: Record<Papel, string> = {
  admin: "Administrador",
  secretaria: "Secretaria",
  tesoureiro: "Tesoureiro",
  lider_celula: "Líder de célula",
  leitor: "Leitor",
};

export const ROTULO_TIPO_LANCAMENTO: Record<TipoLancamento, string> = {
  dizimo: "Dízimo",
  oferta: "Oferta",
  entrada: "Outra entrada",
  saida: "Saída",
};

export const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
] as const;

export const DIAS_SEMANA = [
  "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado",
] as const;

/** Data de nascimento com ano opcional — ver backend/app/schemas/pessoa.py */
export type Nascimento = {
  dia: number;
  mes: number;
  ano: number | null;
};

export type Pessoa = {
  id: string;
  nome: string;
  cargo_id: string | null;
  situacao: Situacao;
  nascimento: Nascimento | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  celula_id: string | null;
  observacoes: string | null;
  origem: OrigemCadastro;
  revisado: boolean;
  arquivado: boolean;
  criado_em: string | null;
  atualizado_em: string | null;
  // Derivados, calculados pelo backend
  cargo_nome: string | null;
  cargo_grupo: GrupoCargo;
  celula_nome: string | null;
  idade: number | null;
  nascimento_formatado: string | null;
  whatsapp_url: string | null;
};

/** Minimal person data used where contact data is not needed. */
export type PessoaOpcao = {
  id: string;
  nome: string;
};

export type PessoaEntrada = {
  nome: string;
  cargo_id?: string | null;
  situacao?: Situacao;
  nascimento?: Nascimento | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  celula_id?: string | null;
  observacoes?: string | null;
};

export type Aniversariante = {
  id: string;
  nome: string;
  dia: number;
  mes: number;
  idade_que_faz: number | null;
  cargo_nome: string | null;
  cargo_grupo: GrupoCargo;
  telefone: string | null;
  whatsapp_url: string | null;
  eh_hoje: boolean;
};

export type ListaAniversariantes = {
  mes: number;
  ano: number;
  mes_nome: string;
  total: number;
  aniversariantes: Aniversariante[];
  texto_para_compartilhar: string;
};

export type Cargo = {
  id: string;
  nome: string;
  grupo: GrupoCargo;
  grupo_rotulo: string;
  ordem: number;
  ativo: boolean;
  total_pessoas: number;
};

export type Celula = {
  id: string;
  nome: string;
  lider_id: string | null;
  lider_nome: string | null;
  dia_semana: number | null;
  dia_semana_nome: string | null;
  horario: string | null;
  endereco: string | null;
  ativa: boolean;
  total_pessoas: number;
};

export type Evento = {
  id: string;
  titulo: string;
  data: string;
  horario: string | null;
  local: string | null;
  descricao: string | null;
  inscritos: number;
  ja_passou: boolean;
};

export type Lancamento = {
  id: string;
  tipo: TipoLancamento;
  valor: string;
  data: string;
  categoria: string | null;
  descricao: string | null;
  pessoa_id: string | null;
  pessoa_nome: string | null;
  criado_por: string | null;
};

export type ResumoFinanceiro = {
  competencia: string;
  entradas: string;
  saidas: string;
  saldo: string;
  total_lancamentos: number;
};

export type GrupoResumo = {
  grupo: GrupoCargo;
  rotulo: string;
  total: number;
};

export type PainelResumo = {
  total_pessoas: number;
  total_membros: number;
  total_visitantes: number;
  total_obreiros: number;
  por_grupo: GrupoResumo[];
  total_celulas: number;
  aniversariantes_mes: number;
  proximo_aniversariante: string | null;
  cadastros_pendentes: number;
  cadastros_sem_contato: number;
  cadastros_sem_nascimento: number;
  proximo_evento: Evento | null;
  resumo_financeiro: ResumoFinanceiro | null;
};

export type Usuario = {
  uid: string;
  email: string | null;
  nome: string | null;
  papel: Papel;
  igreja_id: string;
  celula_id: string | null;
  ativo: boolean;
  pendente: boolean;
  criado_em: string | null;
};

export type OpcoesFormulario = {
  igreja_nome: string;
  ativo: boolean;
  cargos: { id: string; nome: string; grupo: GrupoCargo }[];
  celulas: { id: string; nome: string }[];
};

/** Quem pode o quê — espelha app/core/security.py. */
export function podeEditarPessoas(papel: Papel | undefined): boolean {
  return papel === "admin" || papel === "secretaria";
}

export function podeVerFinanceiro(papel: Papel | undefined): boolean {
  return papel === "admin" || papel === "tesoureiro";
}

export function podeEditarFinanceiro(papel: Papel | undefined): boolean {
  return papel === "admin" || papel === "tesoureiro";
}

export function ehAdmin(papel: Papel | undefined): boolean {
  return papel === "admin";
}

export type StatusTarefa = "aberta" | "andamento" | "concluida";
export type CategoriaTarefa = "cadastro" | "documento" | "atendimento" | "visita" | "outro";
export const ROTULO_STATUS_TAREFA: Record<StatusTarefa, string> = {
  aberta: "Pendente", andamento: "Em andamento", concluida: "Concluída",
};
export const ROTULO_CATEGORIA_TAREFA: Record<CategoriaTarefa, string> = {
  cadastro: "Cadastro", documento: "Documento", atendimento: "Atendimento", visita: "Visita", outro: "Outro",
};
export type TarefaEntrada = {
  titulo: string; categoria: CategoriaTarefa; prioridade: "normal" | "alta";
  prazo: string | null; responsavel: string | null; pessoa_id: string | null; descricao: string | null;
};
export type Tarefa = TarefaEntrada & {
  id: string; status: StatusTarefa; criada_em: string; atualizada_em: string;
  concluida_em: string | null; criada_por: string; atualizada_por: string;
};
