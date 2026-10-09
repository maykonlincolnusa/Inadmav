"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Estrutura } from "@/components/navegacao";
import { Protegido } from "@/components/protegido";
import { AreaTexto, Botao, Campo, Carregando, Cartao, Erro, Etiqueta, Modal, Selecao, Vazio, avisar } from "@/components/ui";
import { IconeMais } from "@/components/icones";
import { api } from "@/lib/api";
import { data, hojeISO } from "@/lib/formato";
import { useSessao } from "@/lib/sessao";
import { podeEditarPessoas, ROTULO_CATEGORIA_TAREFA, ROTULO_STATUS_TAREFA, type CategoriaTarefa, type Pessoa, type StatusTarefa, type Tarefa, type TarefaEntrada } from "@/lib/tipos";

export default function Secretaria() { return <Protegido><Conteudo /></Protegido>; }

function Conteudo() {
  const { usuario } = useSessao();
  const permitido = podeEditarPessoas(usuario?.papel);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("abertas");
  const [busca, setBusca] = useState("");
  const [formAberto, setFormAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Tarefa | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [limite, setLimite] = useState(12);
  const hoje = hojeISO();
  const carregar = useCallback(async () => {
    if (!permitido) return;
    setCarregando(true); setErro(null);
    try {
      const [t, p] = await Promise.all([api.tarefas(), api.pessoas()]);
      setTarefas(t); setPessoas(p);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível carregar as pendências."); }
    finally { setCarregando(false); }
  }, [permitido]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { setLimite(12); }, [filtro, busca]);
  const abertas = tarefas.filter((t) => t.status !== "concluida");
  const atrasada = (t: Tarefa) => t.status !== "concluida" && Boolean(t.prazo && t.prazo < hoje);
  const lista = useMemo(() => tarefas.filter((t) => {
    if (filtro === "abertas" && t.status === "concluida") return false;
    if (filtro === "atrasadas" && !(t.status !== "concluida" && t.prazo && t.prazo < hoje)) return false;
    if (filtro === "concluidas" && t.status !== "concluida") return false;
    return `${t.titulo} ${t.responsavel ?? ""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"));
  }), [tarefas, filtro, busca, hoje]);

  async function mudarStatus(t: Tarefa, status: StatusTarefa) {
    setSalvandoId(t.id);
    try {
      const salva = await api.atualizarTarefa(t.id, { status });
      setTarefas((itens) => itens.map((item) => item.id === salva.id ? salva : item));
      avisar(status === "concluida" ? "Pendência concluída" : "Situação atualizada");
    } catch (e) { avisar(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setSalvandoId(null); }
  }

  if (!permitido) return <Estrutura titulo="Secretaria"><Vazio titulo="Área da secretaria" descricao="Seu perfil não tem acesso aos atendimentos internos." /></Estrutura>;
  return <Estrutura titulo="Secretaria" acao={<Botao onClick={() => { setEmEdicao(null); setFormAberto(true); }}><IconeMais className="h-4 w-4" />Nova pendência</Botao>}>
    <div className="mb-6"><h2 className="font-serif text-2xl font-semibold">O que precisa ser resolvido</h2><p className="mt-1 text-sm text-texto-suave">Organize atendimentos, documentos, visitas e retornos da secretaria.</p></div>
    {carregando ? <Carregando /> : erro ? <Erro mensagem={erro} aoTentar={carregar} /> : <>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">{[
        ["Em aberto", abertas.length, "abertas"], ["Com prazo vencido", abertas.filter(atrasada).length, "atrasadas"], ["Concluídas", tarefas.length - abertas.length, "concluidas"],
      ].map(([rotulo, valor, id]) => <button key={id} onClick={() => setFiltro(String(id))} aria-pressed={filtro === id} className={`cartao p-5 text-left transition hover:border-borda-forte ${filtro === id ? "ring-1 ring-acento" : ""}`}><span className="text-sm text-texto-suave">{rotulo}</span><strong className="tabular mt-2 block text-3xl">{valor}</strong></button>)}</div>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]"><Campo rotulo="Buscar pendência" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Título ou responsável" /><Selecao rotulo="Exibir" value={filtro} onChange={(e) => setFiltro(e.target.value)}><option value="abertas">Em aberto</option><option value="atrasadas">Prazo vencido</option><option value="concluidas">Concluídas</option><option value="todas">Todas</option></Selecao></div>
      <Cartao>{!lista.length ? <Vazio titulo="Nenhuma pendência nesta lista" descricao="Registre um atendimento para acompanhar os próximos passos." /> : <div className="divide-y divide-borda">{lista.slice(0, limite).map((t) => <article key={t.id} className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap gap-2"><Etiqueta>{ROTULO_CATEGORIA_TAREFA[t.categoria]}</Etiqueta><Etiqueta variante={t.status === "concluida" ? "neutra" : "contorno"}>{ROTULO_STATUS_TAREFA[t.status]}</Etiqueta>{t.prioridade === "alta" && <Etiqueta variante="forte">Prioridade alta</Etiqueta>}{atrasada(t) && <Etiqueta variante="alerta">Prazo vencido</Etiqueta>}</div><h3 className="break-words font-semibold">{t.titulo}</h3></div><Botao variante="secundario" tamanho="sm" onClick={() => { setEmEdicao(t); setFormAberto(true); }}>Editar</Botao></div>
        {t.descricao && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-texto-suave">{t.descricao}</p>}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-texto-suave"><span>Prazo: {t.prazo ? data(t.prazo) : "sem prazo"}</span><span>Responsável: {t.responsavel || "a definir"}</span>{t.pessoa_id && <Link href={`/pessoas/${t.pessoa_id}`} className="font-medium underline">{pessoas.find((p) => p.id === t.pessoa_id)?.nome || "Ver ficha vinculada"}</Link>}</div>
        <div className="mt-4 flex flex-wrap gap-2">{t.status !== "concluida" ? <><Botao tamanho="sm" disabled={salvandoId !== null} onClick={() => void mudarStatus(t, "concluida")}>Concluir</Botao>{t.status === "aberta" && <Botao tamanho="sm" variante="secundario" disabled={salvandoId !== null} onClick={() => void mudarStatus(t, "andamento")}>Iniciar atendimento</Botao>}</> : <Botao tamanho="sm" variante="secundario" disabled={salvandoId !== null} onClick={() => void mudarStatus(t, "aberta")}>Reabrir</Botao>}</div>
      </article>)}</div>}</Cartao>
      {lista.length > limite && <Botao className="mt-4" variante="secundario" onClick={() => setLimite(limite + 12)}>Mostrar mais</Botao>}
    </>}
    <Formulario aberto={formAberto} tarefa={emEdicao} pessoas={pessoas} responsavelPadrao={usuario?.nome ?? ""} aoFechar={() => setFormAberto(false)} aoSalvar={carregar} />
  </Estrutura>;
}

function Formulario({ aberto, tarefa, pessoas, responsavelPadrao, aoFechar, aoSalvar }: {
  aberto: boolean; tarefa: Tarefa | null; pessoas: Pessoa[]; responsavelPadrao: string; aoFechar: () => void; aoSalvar: () => Promise<void>;
}) {
  const [dados, setDados] = useState<TarefaEntrada>({ titulo: "", categoria: "atendimento", prioridade: "normal", prazo: null, responsavel: null, pessoa_id: null, descricao: null });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (!aberto) return;
    setDados(tarefa ? { titulo: tarefa.titulo, categoria: tarefa.categoria, prioridade: tarefa.prioridade, prazo: tarefa.prazo, responsavel: tarefa.responsavel, pessoa_id: tarefa.pessoa_id, descricao: tarefa.descricao }
      : { titulo: "", categoria: "atendimento", prioridade: "normal", prazo: null, responsavel: responsavelPadrao || null, pessoa_id: null, descricao: null });
    setErro(null);
  }, [aberto, tarefa, responsavelPadrao]);
  async function salvar() {
    setSalvando(true); setErro(null);
    try { if (tarefa) await api.atualizarTarefa(tarefa.id, dados); else await api.criarTarefa(dados); aoFechar(); avisar("Pendência salva"); await aoSalvar(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setSalvando(false); }
  }
  return <Modal aberto={aberto} titulo={tarefa ? "Editar pendência" : "Nova pendência"} aoFechar={() => { if (!salvando) aoFechar(); }} rodape={<><Botao variante="secundario" disabled={salvando} onClick={aoFechar}>Cancelar</Botao><Botao type="submit" form="form-tarefa" carregando={salvando}>Salvar pendência</Botao></>}>
    <form id="form-tarefa" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
      <Campo rotulo="O que precisa ser feito?" required minLength={3} maxLength={140} value={dados.titulo} onChange={(e) => setDados({ ...dados, titulo: e.target.value })} placeholder="Ex.: preparar carta de transferência" />
      <div className="grid gap-3 sm:grid-cols-2"><Selecao rotulo="Tipo" value={dados.categoria} onChange={(e) => setDados({ ...dados, categoria: e.target.value as CategoriaTarefa })}>{(Object.keys(ROTULO_CATEGORIA_TAREFA) as CategoriaTarefa[]).map((c) => <option key={c} value={c}>{ROTULO_CATEGORIA_TAREFA[c]}</option>)}</Selecao><Selecao rotulo="Prioridade" value={dados.prioridade} onChange={(e) => setDados({ ...dados, prioridade: e.target.value as "normal" | "alta" })}><option value="normal">Normal</option><option value="alta">Alta</option></Selecao></div>
      <div className="grid gap-3 sm:grid-cols-2"><Campo rotulo="Prazo" type="date" value={dados.prazo || ""} onChange={(e) => setDados({ ...dados, prazo: e.target.value || null })} /><Campo rotulo="Responsável" maxLength={100} value={dados.responsavel || ""} onChange={(e) => setDados({ ...dados, responsavel: e.target.value || null })} placeholder="Nome de quem vai resolver" /></div>
      <Selecao rotulo="Pessoa vinculada" value={dados.pessoa_id || ""} onChange={(e) => setDados({ ...dados, pessoa_id: e.target.value || null })}><option value="">Sem vínculo com uma pessoa</option>{dados.pessoa_id && !pessoas.some((p) => p.id === dados.pessoa_id) && <option value={dados.pessoa_id}>Ficha arquivada vinculada</option>}{pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Selecao>
      <AreaTexto rotulo="Detalhes e próximos passos" maxLength={2000} value={dados.descricao || ""} onChange={(e) => setDados({ ...dados, descricao: e.target.value || null })} />
      {erro && <p role="alert" className="text-sm text-perigo">{erro}</p>}
    </form>
  </Modal>;
}
