"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormPessoa } from "@/components/form-pessoa";
import { IconeMais, IconePessoas } from "@/components/icones";
import { Estrutura } from "@/components/navegacao";
import { Protegido } from "@/components/protegido";
import { Abas, Avatar, Botao, Campo, Carregando, Cartao, Erro, Etiqueta, Modal, Selecao, Vazio, avisar } from "@/components/ui";
import { api } from "@/lib/api";
import { baixarCSV } from "@/lib/exportacao";
import { hojeISO, nascimentoTexto } from "@/lib/formato";
import { useSessao } from "@/lib/sessao";
import { podeEditarPessoas, ROTULO_GRUPO, ROTULO_SITUACAO, type Cargo, type Celula, type GrupoCargo, type Pessoa, type Situacao } from "@/lib/tipos";

const GRUPOS = Object.keys(ROTULO_GRUPO) as GrupoCargo[];
type Aba = "todos" | "novos" | "arquivados" | GrupoCargo;
const POR_PAGINA = 12;
const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export default function PaginaPessoas() {
  return <Protegido><Suspense fallback={<Carregando />}><Conteudo /></Suspense></Protegido>;
}

function Conteudo() {
  const { usuario } = useSessao();
  const podeEditar = podeEditarPessoas(usuario?.papel);
  const parametros = useSearchParams();
  const roteador = useRouter();
  const candidata = parametros.get("aba") ?? "todos";
  const aba: Aba = ["todos", "novos", "arquivados", ...GRUPOS].includes(candidata) ? candidata as Aba : "todos";
  const arquivados = aba === "arquivados";
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("");
  const [celula, setCelula] = useState("");
  const filtro = parametros.get("filtro") ?? "";
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [celulas, setCelulas] = useState<Celula[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [formAberto, setFormAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Pessoa | null>(null);
  const [paraArquivar, setParaArquivar] = useState<Pessoa | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [confirmarConferencia, setConfirmarConferencia] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [pagina, setPagina] = useState(1);
  const sequencia = useRef(0);

  const carregar = useCallback(async () => {
    const chamada = ++sequencia.current;
    setCarregando(true); setErro(null);
    try {
      const [p, c, cel] = await Promise.all([api.pessoas({ arquivados }), api.cargos(), api.celulas()]);
      if (chamada !== sequencia.current) return;
      setPessoas(p); setCargos(c); setCelulas(cel); setSelecionados([]);
    } catch (e) {
      if (chamada === sequencia.current) setErro(e instanceof Error ? e.message : "Não foi possível carregar os cadastros.");
    } finally { if (chamada === sequencia.current) setCarregando(false); }
  }, [arquivados]);

  useEffect(() => { void carregar(); return () => { sequencia.current++; }; }, [carregar]);
  useEffect(() => {
    if (parametros.get("novo") === "1" && podeEditar) { setEmEdicao(null); setFormAberto(true); }
  }, [parametros, podeEditar]);
  useEffect(() => { setPagina(1); setSelecionados([]); }, [aba, busca, situacao, celula, filtro]);

  function navegar(chave: string, valor: string) {
    const query = new URLSearchParams(parametros.toString());
    if (valor) query.set(chave, valor); else query.delete(chave);
    query.delete("novo");
    roteador.replace(`/pessoas?${query.toString()}`, { scroll: false });
  }
  function fecharForm() { setFormAberto(false); if (parametros.has("novo")) navegar("novo", ""); }
  const pendentes = pessoas.filter((p) => !p.revisado).length;
  const lista = useMemo(() => pessoas.filter((p) => {
    if (aba === "novos" && p.revisado) return false;
    if (GRUPOS.includes(aba as GrupoCargo) && p.cargo_grupo !== aba) return false;
    if (situacao && p.situacao !== situacao) return false;
    if (celula === "sem" ? Boolean(p.celula_id) : celula && p.celula_id !== celula) return false;
    if (filtro === "sem_contato" && (p.telefone || p.email)) return false;
    if (filtro === "sem_nascimento" && p.nascimento) return false;
    const termo = normalizar(busca.trim());
    return !termo || normalizar([p.nome, p.telefone, p.email, p.endereco].join(" ")).includes(termo);
  }), [pessoas, aba, situacao, celula, filtro, busca]);
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas);
  const visiveis = lista.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);
  const abas = [
    { id: "todos" as Aba, rotulo: "Todos" },
    { id: "novos" as Aba, rotulo: "A conferir", total: arquivados ? undefined : pendentes },
    ...GRUPOS.map((g) => ({ id: g as Aba, rotulo: g === "membresia" ? "Sem cargo" : ROTULO_GRUPO[g] })),
    { id: "arquivados" as Aba, rotulo: "Arquivados" },
  ];

  async function executar(acao: () => Promise<unknown>, mensagem: string) {
    setOcupado(true);
    try { await acao(); avisar(mensagem); setParaArquivar(null); setConfirmarConferencia(false); await carregar(); }
    catch (e) { avisar(e instanceof Error ? e.message : "Não foi possível salvar. Tente novamente."); }
    finally { setOcupado(false); }
  }
  function exportar() {
    baixarCSV(`admav-pessoas-${hojeISO()}.csv`, [
      ["Nome", "Situação", "Cargo", "Nascimento", "Telefone", "E-mail", "Endereço", "Célula", "Conferido", "Arquivado"],
      ...lista.map((p) => [p.nome, ROTULO_SITUACAO[p.situacao], p.cargo_nome, nascimentoTexto(p.nascimento), p.telefone, p.email, p.endereco, p.celula_nome, p.revisado ? "Sim" : "Não", p.arquivado ? "Sim" : "Não"]),
    ]);
  }
  function selecao(p: Pessoa) {
    return podeEditar && !arquivados && !p.revisado ? <input type="checkbox" aria-label={`Selecionar ${p.nome}`} checked={selecionados.includes(p.id)}
      onChange={(e) => setSelecionados((ids) => e.target.checked ? [...ids, p.id] : ids.filter((id) => id !== p.id))} className="h-4 w-4 accent-acento" /> : null;
  }
  function acoes(p: Pessoa) {
    return podeEditar && <div className="nao-imprimir flex flex-wrap gap-1">
      <Botao variante="fantasma" tamanho="sm" onClick={() => { setEmEdicao(p); setFormAberto(true); }}>Editar</Botao>
      {arquivados ? <Botao variante="secundario" tamanho="sm" disabled={ocupado} onClick={() => void executar(() => api.atualizarPessoa(p.id, { arquivado: false }), "Cadastro restaurado")}>Restaurar</Botao>
        : <Botao variante="fantasma" tamanho="sm" onClick={() => setParaArquivar(p)}>Arquivar</Botao>}
    </div>;
  }

  return <Estrutura titulo="Pessoas" pendentes={arquivados ? undefined : pendentes}
    acao={podeEditar && <Botao onClick={() => { setEmEdicao(null); setFormAberto(true); }}><IconeMais className="h-4 w-4" />Nova pessoa</Botao>}>
    <div className="mb-6"><h2 className="font-serif text-2xl font-semibold">Cadastros da igreja</h2>
      <p className="mt-1 text-sm text-texto-suave">Encontre uma pessoa, atualize a ficha ou confira os cadastros recebidos.</p></div>
    <div className="nao-imprimir mb-5 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr]">
      <Campo rotulo="Buscar pessoa" placeholder="Nome, telefone, e-mail ou endereço" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <Selecao rotulo="Vínculo com a igreja" value={situacao} onChange={(e) => setSituacao(e.target.value)}><option value="">Todos os vínculos</option>
        {(Object.keys(ROTULO_SITUACAO) as Situacao[]).map((s) => <option key={s} value={s}>{ROTULO_SITUACAO[s]}</option>)}</Selecao>
      <Selecao rotulo="Célula" value={celula} onChange={(e) => setCelula(e.target.value)}><option value="">Todas as células</option><option value="sem">Sem célula</option>
        {celulas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Selecao>
    </div>
    {filtro && <div className="nao-imprimir mb-4 flex items-center gap-3 text-sm"><Etiqueta>{filtro === "sem_contato" ? "Sem telefone ou e-mail" : "Sem data de nascimento"}</Etiqueta><Botao variante="fantasma" tamanho="sm" onClick={() => navegar("filtro", "")}>Limpar filtro</Botao></div>}
    {arquivados && <p className="mb-4 text-sm text-texto-suave">Fichas preservadas para consulta. Restaure uma pessoa para voltar às listas de trabalho.</p>}
    <Cartao>
      <Abas abas={abas} ativa={aba} aoTrocar={(a) => navegar("aba", a === "todos" ? "" : a)} />
      {carregando ? <Carregando /> : erro ? <Erro mensagem={erro} aoTentar={carregar} /> : <>
        <div className="nao-imprimir flex flex-wrap items-center gap-2 border-b border-borda px-4 py-3">
          <p className="mr-auto text-sm text-texto-suave"><b className="text-texto">{lista.length}</b> {lista.length === 1 ? "pessoa encontrada" : "pessoas encontradas"}</p>
          {podeEditar && !arquivados && visiveis.some((p) => !p.revisado) && <Botao tamanho="sm" variante="secundario" onClick={() => setSelecionados(visiveis.filter((p) => !p.revisado).map((p) => p.id))}>Selecionar pendentes desta página</Botao>}
          {selecionados.length > 0 && <Botao tamanho="sm" onClick={() => setConfirmarConferencia(true)}>Conferir {selecionados.length} selecionados</Botao>}
          <Botao tamanho="sm" variante="secundario" disabled={!lista.length} onClick={exportar}>Exportar CSV</Botao>
          <Botao tamanho="sm" variante="secundario" disabled={!lista.length} onClick={() => window.print()}>Imprimir</Botao>
        </div>
        {!lista.length ? <Vazio icone={<IconePessoas className="h-9 w-9" />} titulo="Nenhuma pessoa nesta lista" descricao="Ajuste os filtros ou cadastre uma pessoa usando o botão acima." /> : <>
          <div className="nao-imprimir divide-y divide-borda md:hidden">{visiveis.map((p) => <article key={p.id} className="space-y-3 p-4">
            <div className="flex items-center gap-3">{selecao(p)}<Avatar nome={p.nome} tamanho="sm" /><Link className="font-semibold underline-offset-4 hover:underline" href={`/pessoas/${p.id}`}>{p.nome}</Link></div>
            <div className="flex flex-wrap gap-2"><Etiqueta>{ROTULO_SITUACAO[p.situacao]}</Etiqueta>{p.cargo_nome && <Etiqueta>{p.cargo_nome}</Etiqueta>}{!p.revisado && <Etiqueta variante="forte">A conferir</Etiqueta>}</div>
            <p className="text-sm text-texto-suave">{nascimentoTexto(p.nascimento)} · {p.telefone || p.email || "Sem contato"}</p>{acoes(p)}
          </article>)}</div>
          <div className="hidden overflow-x-auto md:block print:block"><table className="w-full text-left text-sm">
            <caption className="so-impressao p-4 text-left font-semibold">ADMAV Sede · {lista.length} cadastros · {hojeISO()}</caption>
            <thead className="border-b border-borda bg-superficie-2 text-xs text-texto-suave"><tr><th className="nao-imprimir px-3 py-3"><span className="sr-only">Seleção</span></th><th className="p-3">Nome e vínculo</th><th className="p-3">Cargo</th><th className="p-3">Nascimento</th><th className="p-3">Contato</th><th className="nao-imprimir p-3">Ações</th></tr></thead>
            <tbody>{lista.map((p, i) => <tr key={p.id} className={`border-b border-borda last:border-0 hover:bg-superficie-2 ${i < (paginaAtual - 1) * POR_PAGINA || i >= paginaAtual * POR_PAGINA ? "hidden print:table-row" : ""}`}>
              <td className="nao-imprimir p-3">{selecao(p)}</td><td className="p-3"><Link className="font-semibold hover:underline" href={`/pessoas/${p.id}`}>{p.nome}</Link><div className="mt-1 flex flex-wrap gap-1 text-xs text-texto-suave">{ROTULO_SITUACAO[p.situacao]} · {p.celula_nome || "Sem célula"}{!p.revisado && <Etiqueta variante="forte">A conferir</Etiqueta>}</div></td>
              <td className="p-3">{p.cargo_nome || "—"}</td><td className="tabular whitespace-nowrap p-3">{nascimentoTexto(p.nascimento)}</td><td className="p-3">{p.telefone || "—"}<span className="block text-xs text-texto-suave">{p.email}</span></td><td className="nao-imprimir p-3">{acoes(p)}</td>
            </tr>)}</tbody></table></div>
          <div className="nao-imprimir flex items-center justify-between gap-3 px-4 py-4"><Botao variante="secundario" tamanho="sm" disabled={paginaAtual === 1} onClick={() => { setPagina(paginaAtual - 1); setSelecionados([]); }}>Anterior</Botao><span className="text-xs text-texto-suave">Página {paginaAtual} de {paginas}</span><Botao variante="secundario" tamanho="sm" disabled={paginaAtual === paginas} onClick={() => { setPagina(paginaAtual + 1); setSelecionados([]); }}>Próxima</Botao></div>
        </>}
      </>}
    </Cartao>
    <FormPessoa aberto={formAberto} pessoa={emEdicao} cargos={cargos} celulas={celulas} aoFechar={fecharForm} aoSalvar={carregar} />
    <Modal aberto={Boolean(paraArquivar)} titulo="Arquivar cadastro" aoFechar={() => { if (!ocupado) setParaArquivar(null); }} rodape={<><Botao variante="secundario" disabled={ocupado} onClick={() => setParaArquivar(null)}>Cancelar</Botao><Botao carregando={ocupado} onClick={() => paraArquivar && void executar(() => api.removerPessoa(paraArquivar.id), "Cadastro arquivado")}>Arquivar</Botao></>}>
      <p className="text-sm">Arquivar <b>{paraArquivar?.nome}</b>? A ficha sai das listas de trabalho e de aniversariantes. Os dados são preservados e podem ser restaurados na aba Arquivados.</p>
    </Modal>
    <Modal aberto={confirmarConferencia} titulo="Confirmar conferência" aoFechar={() => { if (!ocupado) setConfirmarConferencia(false); }} rodape={<><Botao variante="secundario" disabled={ocupado} onClick={() => setConfirmarConferencia(false)}>Voltar</Botao><Botao carregando={ocupado} onClick={() => void executar(() => api.conferirCadastros(selecionados), "Cadastros conferidos")}>Confirmar conferência</Botao></>}>
      <p className="text-sm">Você conferiu os dados dos {selecionados.length} cadastros selecionados? Somente eles serão marcados como conferidos.</p>
    </Modal>
  </Estrutura>;
}
