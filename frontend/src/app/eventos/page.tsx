"use client";

import { useCallback, useEffect, useState } from "react";

import {
  IconeCalendario,
  IconeEditar,
  IconeLixeira,
  IconeMais,
} from "@/components/icones";
import { Estrutura } from "@/components/navegacao";
import { Protegido } from "@/components/protegido";
import {
  AreaTexto,
  Botao,
  Campo,
  Carregando,
  Cartao,
  Erro,
  Etiqueta,
  Modal,
  Vazio,
  avisar,
  cx,
} from "@/components/ui";
import { api } from "@/lib/api";
import { data as fmtData, hojeISO } from "@/lib/formato";
import { useSessao } from "@/lib/sessao";
import { podeEditarPessoas, type Evento } from "@/lib/tipos";

export default function PaginaEventos() {
  return (
    <Protegido>
      <ConteudoEventos />
    </Protegido>
  );
}

function ConteudoEventos() {
  const { usuario } = useSessao();
  const podeEditar = podeEditarPessoas(usuario?.papel);

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Evento | null>(null);
  const [paraRemover, setParaRemover] = useState<Evento | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setEventos(await api.eventos());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar eventos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function remover() {
    if (!paraRemover) return;
    try {
      await api.removerEvento(paraRemover.id);
      avisar("Evento removido");
      setParaRemover(null);
      await carregar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível remover.");
    }
  }

  return (
    <Estrutura
      titulo="Eventos"
      acao={
        podeEditar && (
          <Botao
            onClick={() => {
              setEmEdicao(null);
              setFormAberto(true);
            }}
          >
            <IconeMais className="h-4 w-4" />
            <span className="hidden sm:inline">Novo evento</span>
          </Botao>
        )
      }
    >
      <Cartao>
        {carregando ? (
          <Carregando />
        ) : erro ? (
          <Erro mensagem={erro} aoTentar={carregar} />
        ) : eventos.length === 0 ? (
          <Vazio
            icone={<IconeCalendario className="h-10 w-10" />}
            titulo="Nenhum evento ainda"
            descricao="Publique cultos, conferências e programações na agenda da igreja."
            acao={
              podeEditar ? (
                <Botao onClick={() => setFormAberto(true)}>
                  <IconeMais className="h-4 w-4" />
                  Novo evento
                </Botao>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-borda">
            {eventos.map((e) => (
              <div
                key={e.id}
                className={cx(
                  "flex flex-wrap items-center gap-4 px-5 py-4",
                  e.ja_passou && "opacity-55",
                )}
              >
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-superficie-3 leading-none">
                  <span className="tabular font-serif text-xl font-semibold">
                    {e.data.slice(8, 10)}
                  </span>
                  <span className="mt-1 text-[0.6rem] uppercase tracking-widest text-texto-fraco">
                    {e.data.slice(5, 7)}/{e.data.slice(2, 4)}
                  </span>
                </div>

                <div className="min-w-[180px] flex-1">
                  <p className="font-medium">{e.titulo}</p>
                  <p className="text-xs text-texto-suave">
                    {fmtData(e.data)}
                    {e.horario && ` · ${e.horario}`}
                    {e.local && ` · ${e.local}`}
                  </p>
                  {e.descricao && (
                    <p className="mt-1 line-clamp-1 text-xs text-texto-fraco">
                      {e.descricao}
                    </p>
                  )}
                </div>

                {e.ja_passou && <Etiqueta>Realizado</Etiqueta>}
                <Etiqueta variante="contorno">{e.inscritos} inscritos</Etiqueta>

                {podeEditar && (
                  <div className="whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEmEdicao(e);
                        setFormAberto(true);
                      }}
                      className="rounded-md p-1.5 text-texto-fraco transition hover:bg-superficie-3 hover:text-texto"
                      aria-label={`Editar ${e.titulo}`}
                    >
                      <IconeEditar className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setParaRemover(e)}
                      className="rounded-md p-1.5 text-texto-fraco transition hover:bg-perigo-suave hover:text-perigo"
                      aria-label={`Remover ${e.titulo}`}
                    >
                      <IconeLixeira className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Cartao>

      <FormEvento
        aberto={formAberto}
        evento={emEdicao}
        aoFechar={() => setFormAberto(false)}
        aoSalvar={carregar}
      />

      <Modal
        aberto={Boolean(paraRemover)}
        aoFechar={() => setParaRemover(null)}
        titulo="Remover evento"
        descricao="Esta ação não pode ser desfeita."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setParaRemover(null)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" onClick={remover}>
              Remover
            </Botao>
          </>
        }
      >
        <p className="text-sm text-texto-suave">
          Deseja remover{" "}
          <b className="font-semibold text-texto">{paraRemover?.titulo}</b> da
          agenda?
        </p>
      </Modal>
    </Estrutura>
  );
}

function FormEvento({
  aberto,
  evento,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  evento: Evento | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [dataEvento, setDataEvento] = useState(hojeISO());
  const [horario, setHorario] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [inscritos, setInscritos] = useState("0");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setTitulo(evento?.titulo ?? "");
    setDataEvento(evento?.data ?? hojeISO());
    setHorario(evento?.horario ?? "");
    setLocal(evento?.local ?? "");
    setDescricao(evento?.descricao ?? "");
    setInscritos(String(evento?.inscritos ?? 0));
    setErro(null);
  }, [aberto, evento]);

  async function salvar() {
    if (!titulo.trim()) {
      setErro("O título é obrigatório.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const dados = {
      titulo: titulo.trim(),
      data: dataEvento,
      horario: horario.trim() || null,
      local: local.trim() || null,
      descricao: descricao.trim() || null,
      inscritos: Number(inscritos) || 0,
    };
    try {
      if (evento) {
        await api.atualizarEvento(evento.id, dados);
        avisar("Alterações salvas");
      } else {
        await api.criarEvento(dados);
        avisar("Evento criado");
      }
      aoSalvar();
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={evento ? "Editar evento" : "Novo evento"}
      descricao="Programação publicada na agenda"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} carregando={salvando}>
            {evento ? "Salvar alterações" : "Criar"}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Campo
          rotulo="Título do evento"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex.: Conferência de Jovens"
          required
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo
            rotulo="Data"
            type="date"
            value={dataEvento}
            onChange={(e) => setDataEvento(e.target.value)}
          />
          <Campo
            rotulo="Horário"
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            placeholder="19:30"
          />
          <Campo
            rotulo="Inscritos"
            type="number"
            min={0}
            value={inscritos}
            onChange={(e) => setInscritos(e.target.value)}
          />
        </div>
        <Campo
          rotulo="Local"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="Ex.: Templo sede"
        />
        <AreaTexto
          rotulo="Descrição"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Detalhes da programação..."
        />
        {erro && (
          <p className="rounded-lg bg-perigo-suave px-3 py-2 text-sm text-perigo">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  );
}
