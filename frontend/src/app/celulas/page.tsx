"use client";

import { useCallback, useEffect, useState } from "react";

import {
  IconeCelulas,
  IconeEditar,
  IconeLixeira,
  IconeMais,
} from "@/components/icones";
import { Estrutura } from "@/components/navegacao";
import { Protegido } from "@/components/protegido";
import {
  Botao,
  Campo,
  Carregando,
  Cartao,
  Erro,
  Etiqueta,
  Modal,
  Selecao,
  Vazio,
  avisar,
} from "@/components/ui";
import { api } from "@/lib/api";
import { plural } from "@/lib/formato";
import { useSessao } from "@/lib/sessao";
import { DIAS_SEMANA, podeEditarPessoas, type Celula } from "@/lib/tipos";

export default function PaginaCelulas() {
  return (
    <Protegido>
      <ConteudoCelulas />
    </Protegido>
  );
}

function ConteudoCelulas() {
  const { usuario } = useSessao();
  const podeEditar = podeEditarPessoas(usuario?.papel);

  const [celulas, setCelulas] = useState<Celula[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [emEdicao, setEmEdicao] = useState<Celula | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [paraRemover, setParaRemover] = useState<Celula | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setCelulas(await api.celulas());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar células.");
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
      const r = await api.removerCelula(paraRemover.id);
      avisar(
        r.pessoas_desvinculadas > 0
          ? `Célula removida · ${plural(r.pessoas_desvinculadas, "pessoa ficou", "pessoas ficaram")} sem célula`
          : "Célula removida",
      );
      setParaRemover(null);
      await carregar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível remover.");
    }
  }

  return (
    <Estrutura
      titulo="Células"
      acao={
        podeEditar && (
          <Botao
            onClick={() => {
              setEmEdicao(null);
              setFormAberto(true);
            }}
          >
            <IconeMais className="h-4 w-4" />
            <span className="hidden sm:inline">Nova célula</span>
          </Botao>
        )
      }
    >
      <Cartao>
        {carregando ? (
          <Carregando />
        ) : erro ? (
          <Erro mensagem={erro} aoTentar={carregar} />
        ) : celulas.length === 0 ? (
          <Vazio
            icone={<IconeCelulas className="h-10 w-10" />}
            titulo="Nenhuma célula ainda"
            descricao="Crie células e pequenos grupos para organizar o cuidado e o discipulado."
            acao={
              podeEditar ? (
                <Botao onClick={() => setFormAberto(true)}>
                  <IconeMais className="h-4 w-4" />
                  Nova célula
                </Botao>
              ) : undefined
            }
          />
        ) : (
          <div className="scroll-fino overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-borda bg-superficie-2">
                  {["Célula", "Líder", "Encontro", "Pessoas", ""].map((h, i) => (
                    <th
                      key={h || i}
                      className="px-5 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-texto-fraco"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {celulas.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-borda last:border-0 hover:bg-superficie-2"
                  >
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium">{c.nome}</p>
                      <p className="text-xs text-texto-fraco">
                        {c.endereco ?? "Local não informado"}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-sm">{c.lider_nome ?? "—"}</td>
                    <td className="px-5 py-3 text-sm">
                      {c.dia_semana_nome ?? "—"}
                      {c.horario && (
                        <span className="text-texto-fraco"> · {c.horario}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Etiqueta>{c.total_pessoas}</Etiqueta>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      {podeEditar && (
                        <>
                          <button
                            onClick={() => {
                              setEmEdicao(c);
                              setFormAberto(true);
                            }}
                            className="rounded-md p-1.5 text-texto-fraco transition hover:bg-superficie-3 hover:text-texto"
                            aria-label={`Editar ${c.nome}`}
                          >
                            <IconeEditar className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setParaRemover(c)}
                            className="rounded-md p-1.5 text-texto-fraco transition hover:bg-perigo-suave hover:text-perigo"
                            aria-label={`Remover ${c.nome}`}
                          >
                            <IconeLixeira className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      <FormCelula
        aberto={formAberto}
        celula={emEdicao}
        aoFechar={() => setFormAberto(false)}
        aoSalvar={carregar}
      />

      <Modal
        aberto={Boolean(paraRemover)}
        aoFechar={() => setParaRemover(null)}
        titulo="Remover célula"
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
          <b className="font-semibold text-texto">{paraRemover?.nome}</b>? As
          pessoas vinculadas ficarão sem célula, mas continuam cadastradas.
        </p>
      </Modal>
    </Estrutura>
  );
}

function FormCelula({
  aberto,
  celula,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  celula: Celula | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [lider, setLider] = useState("");
  const [dia, setDia] = useState<string>("");
  const [horario, setHorario] = useState("");
  const [endereco, setEndereco] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setNome(celula?.nome ?? "");
    setLider(celula?.lider_nome ?? "");
    setDia(celula?.dia_semana != null ? String(celula.dia_semana) : "");
    setHorario(celula?.horario ?? "");
    setEndereco(celula?.endereco ?? "");
    setErro(null);
  }, [aberto, celula]);

  async function salvar() {
    if (!nome.trim()) {
      setErro("O nome da célula é obrigatório.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const dados = {
      nome: nome.trim(),
      lider_nome: lider.trim() || null,
      dia_semana: dia === "" ? null : Number(dia),
      horario: horario.trim() || null,
      endereco: endereco.trim() || null,
    };
    try {
      if (celula) {
        await api.atualizarCelula(celula.id, dados);
        avisar("Alterações salvas");
      } else {
        await api.criarCelula(dados);
        avisar("Célula criada");
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
      titulo={celula ? "Editar célula" : "Nova célula"}
      descricao="Grupo pequeno de cuidado e discipulado"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} carregando={salvando}>
            {celula ? "Salvar alterações" : "Criar"}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Campo
          rotulo="Nome da célula"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Célula Vida Nova"
          required
        />
        <Campo
          rotulo="Líder"
          value={lider}
          onChange={(e) => setLider(e.target.value)}
          placeholder="Nome do líder"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Selecao
            rotulo="Dia do encontro"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
          >
            <option value="">—</option>
            {DIAS_SEMANA.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </Selecao>
          <Campo
            rotulo="Horário"
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            placeholder="19:30"
          />
        </div>
        <Campo
          rotulo="Bairro / local"
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          placeholder="Ex.: Centro"
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
