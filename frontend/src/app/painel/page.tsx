"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { IconeBolo, IconeCalendario, IconeCheck, IconeFormulario, IconeMais, IconePessoas } from "@/components/icones";
import { Estrutura } from "@/components/navegacao";
import { Protegido } from "@/components/protegido";
import { Botao, Carregando, Cartao, Erro, Etiqueta, avisar } from "@/components/ui";
import { api } from "@/lib/api";
import { copiar, data, dataLongaHoje, hojeISO, moeda, primeiroNome, saudacao } from "@/lib/formato";
import { useSessao } from "@/lib/sessao";
import { podeEditarPessoas, type Aniversariante, type Evento, type PainelResumo, type Tarefa } from "@/lib/tipos";

export default function Painel() { return <Protegido><Conteudo /></Protegido>; }

function Conteudo() {
  const { usuario } = useSessao();
  const secretaria = podeEditarPessoas(usuario?.papel);
  const [resumo, setResumo] = useState<PainelResumo | null>(null);
  const [aniversariantes, setAniversariantes] = useState<Aniversariante[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const [r, a, e, t] = await Promise.all([api.painel(), api.aniversariantes(), api.eventos(true), secretaria ? api.tarefas() : Promise.resolve([])]);
      setResumo(r); setAniversariantes(a.aniversariantes); setEventos(e); setTarefas(t);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível carregar o início."); }
    finally { setCarregando(false); }
  }, [secretaria]);
  useEffect(() => { void carregar(); }, [carregar]);
  const hoje = hojeISO();
  const abertas = tarefas.filter((t) => t.status !== "concluida");
  const vencidas = abertas.filter((t) => t.prazo && t.prazo < hoje);
  const proximos = aniversariantes.filter((a) => a.dia >= Number(hoje.slice(8, 10)));

  return <Estrutura titulo="Início" pendentes={resumo?.cadastros_pendentes} acao={secretaria && <Link className="inline-flex h-10 items-center gap-2 rounded-lg bg-acento px-4 text-sm font-medium text-inverso" href="/pessoas?novo=1"><IconeMais className="h-4 w-4" />Novo cadastro</Link>}>
    <section className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-texto-suave">ADMAV Sede · Secretaria</p><h2 className="font-serif text-3xl font-semibold tracking-tight">{saudacao()}{usuario?.nome ? `, ${primeiroNome(usuario.nome)}` : ""}.</h2><p className="mt-2 text-sm capitalize text-texto-suave">{dataLongaHoje()}</p></div>
      {secretaria && <Botao variante="secundario" onClick={async () => { const ok = await copiar(`${window.location.origin}/cadastro/${usuario?.igreja_id}`); avisar(ok ? "Link do formulário copiado" : "Não foi possível copiar. Acesse Configurações para abrir o formulário."); }}><IconeFormulario className="h-4 w-4" />Copiar link de cadastro</Botao>}
    </section>
    {carregando ? <Carregando /> : erro ? <Erro mensagem={erro} aoTentar={carregar} /> : resumo && <>
      {secretaria && (resumo.cadastros_pendentes > 0 || vencidas.length > 0) && <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borda-forte bg-superficie-2 p-5"><div><h3 className="font-semibold">Precisam da sua atenção</h3><p className="mt-1 text-sm text-texto-suave">{resumo.cadastros_pendentes} cadastros a conferir · {vencidas.length} pendências com prazo vencido</p></div><Link className="text-sm font-semibold underline underline-offset-4" href={resumo.cadastros_pendentes > 0 ? "/pessoas?aba=novos" : "/secretaria"}>Abrir pendências →</Link></div>}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Pessoas cadastradas" valor={resumo.total_pessoas} detalhe={`${resumo.total_membros} membros · ${resumo.total_visitantes} visitantes`} href="/pessoas" icone={<IconePessoas className="h-4 w-4" />} />
        <Indicador rotulo="A conferir" valor={resumo.cadastros_pendentes} detalhe="Cadastros aguardando revisão" href="/pessoas?aba=novos" icone={<IconeCheck className="h-4 w-4" />} />
        <Indicador rotulo="Aniversariantes do mês" valor={resumo.aniversariantes_mes} detalhe={`${aniversariantes.filter((a) => a.eh_hoje).length} fazem aniversário hoje`} href="/aniversariantes" icone={<IconeBolo className="h-4 w-4" />} />
        <Indicador rotulo={secretaria ? "Pendências em aberto" : "Células ativas"} valor={secretaria ? abertas.length : resumo.total_celulas} detalhe={secretaria ? "Atendimentos e próximos passos" : "Grupos da igreja"} href={secretaria ? "/secretaria" : "/celulas"} icone={<IconeCalendario className="h-4 w-4" />} />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          {secretaria && <Cartao><Cabecalho titulo="Fila da secretaria" href="/secretaria" link="Ver todas" /><div className="divide-y divide-borda">{abertas.length ? abertas.slice(0, 5).map((t) => <Link key={t.id} href="/secretaria" className="flex items-center gap-3 px-5 py-4 hover:bg-superficie-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-borda"><IconeCheck className="h-4 w-4 text-texto-suave" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{t.titulo}</p><p className="mt-1 text-xs text-texto-suave">{t.responsavel || "Responsável a definir"} · {t.prazo ? data(t.prazo) : "Sem prazo"}</p></div>{t.prazo && t.prazo < hoje && <Etiqueta variante="alerta">Vencida</Etiqueta>}</Link>) : <p className="px-5 py-8 text-sm text-texto-suave">Nenhuma pendência em aberto. Registre os próximos atendimentos na Secretaria.</p>}</div></Cartao>}
          <Cartao><Cabecalho titulo="Próximos compromissos" href="/eventos" link="Ver agenda" /><div className="divide-y divide-borda">{eventos.length ? eventos.slice(0, 4).map((e) => <Link key={e.id} href="/eventos" className="flex items-center gap-4 px-5 py-4 hover:bg-superficie-2"><div className="tabular w-12 shrink-0 rounded-lg bg-superficie-2 py-2 text-center"><b className="block text-xl">{e.data.slice(8, 10)}</b><span className="text-xs text-texto-suave">{e.data.slice(5, 7)}</span></div><div><p className="text-sm font-semibold">{e.titulo}</p><p className="mt-1 text-xs text-texto-suave">{data(e.data)}{e.horario ? ` às ${e.horario}` : ""}{e.local ? ` · ${e.local}` : ""}</p></div></Link>) : <p className="px-5 py-8 text-sm text-texto-suave">Nenhum compromisso futuro. Organize os cultos e eventos na agenda.</p>}</div></Cartao>
        </div>
        <div className="space-y-5">
          <Cartao><Cabecalho titulo="Próximos aniversariantes" href="/aniversariantes" link="Ver mês" /><div className="divide-y divide-borda">{proximos.length ? proximos.slice(0, 5).map((a) => <Link key={a.id} href={`/pessoas/${a.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-superficie-2"><span className={`tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${a.eh_hoje ? "bg-acento text-inverso" : "bg-superficie-2"}`}>{String(a.dia).padStart(2, "0")}</span><p className="min-w-0 flex-1 truncate text-sm font-medium">{a.nome}</p>{a.eh_hoje && <Etiqueta variante="forte">Hoje</Etiqueta>}</Link>) : <p className="px-5 py-8 text-sm text-texto-suave">Não há mais aniversários cadastrados para este mês.</p>}</div></Cartao>
          {secretaria && <Cartao><div className="p-5"><h3 className="text-sm font-semibold">Completar cadastros</h3><p className="mt-1 text-xs text-texto-suave">Dados que ajudam no contato e nas listas da igreja.</p><Link href="/pessoas?filtro=sem_contato" className="mt-4 flex justify-between gap-3 rounded-lg bg-superficie-2 p-3 text-sm"><span>Sem telefone ou e-mail</span><b className="tabular">{resumo.cadastros_sem_contato}</b></Link><Link href="/pessoas?filtro=sem_nascimento" className="mt-2 flex justify-between gap-3 rounded-lg bg-superficie-2 p-3 text-sm"><span>Sem data de nascimento</span><b className="tabular">{resumo.cadastros_sem_nascimento}</b></Link></div></Cartao>}
          {resumo.resumo_financeiro && <Cartao><Cabecalho titulo="Financeiro do mês" href="/financeiro" link="Consultar" /><dl className="space-y-3 p-5 text-sm"><div className="flex justify-between"><dt>Entradas</dt><dd className="tabular">{moeda(resumo.resumo_financeiro.entradas)}</dd></div><div className="flex justify-between"><dt>Saídas</dt><dd className="tabular">{moeda(resumo.resumo_financeiro.saidas)}</dd></div><div className="flex justify-between border-t border-borda pt-3 font-semibold"><dt>Saldo do mês</dt><dd className="tabular">{moeda(resumo.resumo_financeiro.saldo)}</dd></div></dl></Cartao>}
        </div>
      </div>
    </>}
  </Estrutura>;
}
function Cabecalho({ titulo, href, link }: { titulo: string; href: string; link: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-borda px-5 py-4"><h3 className="text-sm font-semibold">{titulo}</h3><Link href={href} className="text-xs font-medium text-texto-suave hover:underline">{link} →</Link></div>;
}
function Indicador({ rotulo, valor, detalhe, href, icone }: { rotulo: string; valor: number; detalhe: string; href: string; icone: ReactNode }) {
  return <Link href={href} className="cartao p-5 transition hover:border-borda-forte"><span className="flex items-center gap-2 text-xs font-medium text-texto-suave">{icone}{rotulo}</span><strong className="tabular mt-3 block text-3xl tracking-tight">{valor}</strong><span className="mt-2 block text-xs text-texto-suave">{detalhe}</span></Link>;
}
