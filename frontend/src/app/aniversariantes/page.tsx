"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  IconeBolo,
  IconeCopiar,
  IconeDireita,
  IconeEsquerda,
  IconeImprimir,
  IconeTelefone,
} from "@/components/icones";
import { Estrutura } from "@/components/navegacao";
import { Protegido } from "@/components/protegido";
import {
  Botao,
  Carregando,
  Cartao,
  Erro,
  Selecao,
  Vazio,
  avisar,
  cx,
} from "@/components/ui";
import { api } from "@/lib/api";
import { capitalizar, copiar, nomeMes, plural } from "@/lib/formato";
import { ROTULO_GRUPO, type GrupoCargo, type ListaAniversariantes } from "@/lib/tipos";

const GRUPOS: GrupoCargo[] = ["ministerio", "diaconato", "cooperacao", "membresia"];

export default function PaginaAniversariantes() {
  return (
    <Protegido>
      <ConteudoAniversariantes />
    </Protegido>
  );
}

function ConteudoAniversariantes() {
  const hoje = new Date();
  // Começa no mês corrente, mas a navegação é o ponto: a secretaria consulta
  // em agosto quem faz aniversário em setembro, para preparar com folga.
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [grupo, setGrupo] = useState<GrupoCargo | "">("");

  const [lista, setLista] = useState<ListaAniversariantes | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setLista(await api.aniversariantes(mes, ano, grupo || undefined));
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Erro ao carregar aniversariantes.",
      );
    } finally {
      setCarregando(false);
    }
  }, [mes, ano, grupo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function navegar(passo: number) {
    let novoMes = mes + passo;
    let novoAno = ano;
    if (novoMes > 12) {
      novoMes = 1;
      novoAno += 1;
    } else if (novoMes < 1) {
      novoMes = 12;
      novoAno -= 1;
    }
    setMes(novoMes);
    setAno(novoAno);
  }

  const noMesAtual =
    mes === hoje.getMonth() + 1 && ano === hoje.getFullYear();

  async function copiarLista() {
    if (!lista) return;
    const ok = await copiar(lista.texto_para_compartilhar);
    avisar(
      ok
        ? "Lista copiada — é só colar no grupo da igreja"
        : "Não foi possível copiar automaticamente",
    );
  }

  return (
    <Estrutura titulo="Aniversariantes">
      <div className="so-impressao mb-5 border-b-2 border-texto pb-3">
        <h2 className="font-serif text-2xl font-semibold">
          Aniversariantes de {capitalizar(nomeMes(mes))} de {ano}
        </h2>
        <p className="text-sm">
          {grupo ? `${ROTULO_GRUPO[grupo]} · ` : ""}
          {plural(lista?.total ?? 0, "pessoa", "pessoas")}
        </p>
      </div>

      <div className="nao-imprimir mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-borda-forte bg-superficie p-1">
          <button
            onClick={() => navegar(-1)}
            className="rounded-lg p-2 transition hover:bg-superficie-2"
            aria-label="Mês anterior"
          >
            <IconeEsquerda className="h-4 w-4" />
          </button>
          <span className="min-w-[168px] px-3 text-center font-serif text-lg font-semibold capitalize">
            {nomeMes(mes)} de {ano}
          </span>
          <button
            onClick={() => navegar(1)}
            className="rounded-lg p-2 transition hover:bg-superficie-2"
            aria-label="Próximo mês"
          >
            <IconeDireita className="h-4 w-4" />
          </button>
        </div>

        {!noMesAtual && (
          <Botao
            variante="fantasma"
            tamanho="sm"
            onClick={() => {
              setMes(hoje.getMonth() + 1);
              setAno(hoje.getFullYear());
            }}
          >
            Voltar para o mês atual
          </Botao>
        )}

        <div className="flex-1" />

        <Selecao
          value={grupo}
          onChange={(e) => setGrupo(e.target.value as GrupoCargo | "")}
          className="w-auto"
          aria-label="Filtrar por cargo"
        >
          <option value="">Todos os cargos</option>
          {GRUPOS.map((g) => (
            <option key={g} value={g}>
              {ROTULO_GRUPO[g]}
            </option>
          ))}
        </Selecao>

        <Botao variante="secundario" onClick={copiarLista} disabled={!lista?.total}>
          <IconeCopiar className="h-4 w-4" />
          <span className="hidden sm:inline">Copiar lista</span>
        </Botao>

        <Botao onClick={() => window.print()} disabled={!lista?.total}>
          <IconeImprimir className="h-4 w-4" />
          <span className="hidden sm:inline">Imprimir</span>
        </Botao>
      </div>

      <Cartao>
        {carregando ? (
          <Carregando />
        ) : erro ? (
          <Erro mensagem={erro} aoTentar={carregar} />
        ) : !lista || lista.total === 0 ? (
          <Vazio
            icone={<IconeBolo className="h-10 w-10" />}
            titulo={`Nenhum aniversariante em ${nomeMes(mes)}`}
            descricao={
              grupo
                ? "Tente remover o filtro de cargo."
                : "Cadastre a data de nascimento das pessoas e esta lista se preenche sozinha."
            }
          />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {lista.aniversariantes.map((a) => (
              <div
                key={a.id}
                className={cx(
                  "flex items-center gap-4 rounded-xl border p-3.5 transition",
                  a.eh_hoje
                    ? "border-acento bg-superficie-2"
                    : "border-borda bg-superficie hover:border-borda-forte",
                )}
              >
                <div
                  className={cx(
                    "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl leading-none",
                    a.eh_hoje
                      ? "bg-acento text-inverso"
                      : "bg-superficie-3 text-texto",
                  )}
                >
                  <span className="tabular font-serif text-xl font-semibold">
                    {String(a.dia).padStart(2, "0")}
                  </span>
                  <span className="mt-1 text-[0.6rem] uppercase tracking-widest opacity-70">
                    {nomeMes(a.mes).slice(0, 3)}
                  </span>
                </div>

                <Link href={`/pessoas/${a.id}`} className="min-w-0 flex-1 group">
                  <p className="truncate text-sm font-semibold group-hover:underline">
                    {a.nome}
                  </p>
                  <p className="truncate text-xs text-texto-suave">
                    {a.idade_que_faz != null
                      ? `faz ${a.idade_que_faz} anos`
                      : "idade não informada"}
                    {a.cargo_nome && ` · ${a.cargo_nome}`}
                    {a.eh_hoje && " · é hoje!"}
                  </p>
                </Link>

                {a.whatsapp_url && (
                  <a
                    href={a.whatsapp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Parabenizar no WhatsApp"
                    className="nao-imprimir flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-borda-forte transition hover:bg-acento hover:text-inverso"
                  >
                    <IconeTelefone className="h-4 w-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Cartao>
    </Estrutura>
  );
}
