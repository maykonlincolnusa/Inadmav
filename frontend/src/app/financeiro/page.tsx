"use client";

import { useCallback, useEffect, useState } from "react";

import {
  IconeCarteira,
  IconeDireita,
  IconeEsquerda,
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
  cx,
} from "@/components/ui";
import { api } from "@/lib/api";
import {
  competenciaAtual,
  competenciaTexto,
  data as fmtData,
  hojeISO,
  moeda,
} from "@/lib/formato";
import { useSessao } from "@/lib/sessao";
import {
  podeEditarFinanceiro,
  podeVerFinanceiro,
  ROTULO_TIPO_LANCAMENTO,
  type Lancamento,
  type PessoaOpcao,
  type ResumoFinanceiro,
  type TipoLancamento,
} from "@/lib/tipos";

export default function PaginaFinanceiro() {
  return (
    <Protegido>
      <ConteudoFinanceiro />
    </Protegido>
  );
}

function ConteudoFinanceiro() {
  const { usuario } = useSessao();
  const podeEditar = podeEditarFinanceiro(usuario?.papel);

  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [paraRemover, setParaRemover] = useState<Lancamento | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [l, r, p] = await Promise.all([
        api.lancamentos(competencia),
        api.resumoFinanceiro(competencia),
        api.pessoasOpcoesFinanceiro(),
      ]);
      setLancamentos(l);
      setResumo(r);
      setPessoas(p);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar o financeiro.");
    } finally {
      setCarregando(false);
    }
  }, [competencia]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function navegar(passo: number) {
    const [ano, mes] = competencia.split("-").map(Number);
    const d = new Date(ano, mes - 1 + passo, 1);
    setCompetencia(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }

  async function remover() {
    if (!paraRemover) return;
    try {
      await api.removerLancamento(paraRemover.id);
      avisar("Lançamento removido");
      setParaRemover(null);
      await carregar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível remover.");
    }
  }

  if (!podeVerFinanceiro(usuario?.papel)) {
    return (
      <Estrutura titulo="Financeiro">
        <Cartao>
          <Vazio
            icone={<IconeCarteira className="h-10 w-10" />}
            titulo="Acesso restrito"
            descricao="Apenas a tesouraria e a administração da igreja acessam o financeiro."
          />
        </Cartao>
      </Estrutura>
    );
  }

  return (
    <Estrutura
      titulo="Financeiro"
      acao={
        podeEditar && (
          <Botao onClick={() => setFormAberto(true)}>
            <IconeMais className="h-4 w-4" />
            <span className="hidden sm:inline">Novo lançamento</span>
          </Botao>
        )
      }
    >
      <div className="mb-6 flex items-center gap-1 rounded-xl border border-borda-forte bg-superficie p-1 w-fit">
        <button
          onClick={() => navegar(-1)}
          className="rounded-lg p-2 transition hover:bg-superficie-2"
          aria-label="Mês anterior"
        >
          <IconeEsquerda className="h-4 w-4" />
        </button>
        <span className="min-w-[168px] px-3 text-center font-serif text-lg font-semibold capitalize">
          {competenciaTexto(competencia)}
        </span>
        <button
          onClick={() => navegar(1)}
          className="rounded-lg p-2 transition hover:bg-superficie-2"
          aria-label="Próximo mês"
        >
          <IconeDireita className="h-4 w-4" />
        </button>
      </div>

      {resumo && (
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <Resumo rotulo="Entradas" valor={resumo.entradas} nota="Dízimos, ofertas e receitas" />
          <Resumo rotulo="Saídas" valor={resumo.saidas} nota="Despesas e pagamentos" />
          <Resumo
            rotulo="Saldo do mês"
            valor={resumo.saldo}
            nota={
              Number(resumo.saldo) >= 0
                ? "Resultado positivo"
                : "Atenção: resultado negativo"
            }
            destaque
            negativo={Number(resumo.saldo) < 0}
          />
        </div>
      )}

      <Cartao>
        {carregando ? (
          <Carregando />
        ) : erro ? (
          <Erro mensagem={erro} aoTentar={carregar} />
        ) : lancamentos.length === 0 ? (
          <Vazio
            icone={<IconeCarteira className="h-10 w-10" />}
            titulo="Nenhum lançamento neste mês"
            descricao="Registre dízimos, ofertas e despesas para acompanhar as finanças."
            acao={
              podeEditar ? (
                <Botao onClick={() => setFormAberto(true)}>
                  <IconeMais className="h-4 w-4" />
                  Novo lançamento
                </Botao>
              ) : undefined
            }
          />
        ) : (
          <div className="scroll-fino overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-borda bg-superficie-2">
                  {["Descrição", "Tipo", "Contribuinte", "Data", "Valor", ""].map(
                    (h, i) => (
                      <th
                        key={h || i}
                        className={cx(
                          "px-5 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-texto-fraco",
                          i === 4 && "text-right",
                        )}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l) => {
                  const saida = l.tipo === "saida";
                  return (
                    <tr
                      key={l.id}
                      className="border-b border-borda last:border-0 hover:bg-superficie-2"
                    >
                      <td className="px-5 py-3 text-sm font-medium">
                        {l.descricao ?? "Lançamento"}
                        {l.categoria && (
                          <span className="block text-xs font-normal text-texto-fraco">
                            {l.categoria}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Etiqueta variante={saida ? "contorno" : "neutra"}>
                          {ROTULO_TIPO_LANCAMENTO[l.tipo]}
                        </Etiqueta>
                      </td>
                      <td className="px-5 py-3 text-sm text-texto-suave">
                        {l.pessoa_nome ?? "—"}
                      </td>
                      <td className="tabular px-5 py-3 text-sm">
                        {fmtData(l.data)}
                      </td>
                      <td className="tabular px-5 py-3 text-right text-sm font-semibold">
                        {saida ? "−" : "+"} {moeda(l.valor)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        {podeEditar && (
                          <button
                            onClick={() => setParaRemover(l)}
                            className="rounded-md p-1.5 text-texto-fraco transition hover:bg-perigo-suave hover:text-perigo"
                            aria-label="Remover lançamento"
                          >
                            <IconeLixeira className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      <FormLancamento
        aberto={formAberto}
        pessoas={pessoas}
        aoFechar={() => setFormAberto(false)}
        aoSalvar={carregar}
      />

      <Modal
        aberto={Boolean(paraRemover)}
        aoFechar={() => setParaRemover(null)}
        titulo="Remover lançamento"
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
          Deseja remover este lançamento de{" "}
          <b className="font-semibold text-texto">
            {paraRemover && moeda(paraRemover.valor)}
          </b>
          ?
        </p>
      </Modal>
    </Estrutura>
  );
}

function Resumo({
  rotulo,
  valor,
  nota,
  destaque,
  negativo,
}: {
  rotulo: string;
  valor: string;
  nota: string;
  destaque?: boolean;
  negativo?: boolean;
}) {
  return (
    <div className={cx("cartao p-5", destaque && "border-borda-forte")}>
      <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-texto-fraco">
        {rotulo}
      </p>
      <p
        className={cx(
          "tabular mt-3 font-serif text-2xl font-semibold tracking-tight",
          negativo && "text-perigo",
        )}
      >
        {moeda(valor)}
      </p>
      <p className="mt-1.5 text-xs text-texto-suave">{nota}</p>
    </div>
  );
}

function FormLancamento({
  aberto,
  pessoas,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  pessoas: PessoaOpcao[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoLancamento>("dizimo");
  const [valor, setValor] = useState("");
  const [dataLanc, setDataLanc] = useState(hojeISO());
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [pessoaId, setPessoaId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setTipo("dizimo");
    setValor("");
    setDataLanc(hojeISO());
    setCategoria("");
    setDescricao("");
    setPessoaId("");
    setErro(null);
  }, [aberto]);

  async function salvar() {
    const n = Number(valor.replace(",", "."));
    if (!n || n <= 0) {
      setErro("Informe um valor maior que zero.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await api.criarLancamento({
        tipo,
        valor: n.toFixed(2),
        data: dataLanc,
        categoria: categoria.trim() || null,
        descricao: descricao.trim() || null,
        pessoa_id: pessoaId || null,
      });
      avisar("Lançamento registrado");
      aoSalvar();
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  // Dízimo ligado a quem contribuiu permite recibo e acompanhamento — é o
  // único tipo em que identificar a pessoa faz sentido por padrão.
  const pedeContribuinte = tipo === "dizimo" || tipo === "oferta";

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo lançamento"
      descricao="Entrada ou saída financeira"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} carregando={salvando}>
            Adicionar
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Selecao
            rotulo="Tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoLancamento)}
          >
            {(Object.keys(ROTULO_TIPO_LANCAMENTO) as TipoLancamento[]).map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_LANCAMENTO[t]}
              </option>
            ))}
          </Selecao>
          <Campo
            rotulo="Valor (R$)"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Data"
            type="date"
            value={dataLanc}
            onChange={(e) => setDataLanc(e.target.value)}
          />
          <Campo
            rotulo="Categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Ex.: Missões"
          />
        </div>

        {pedeContribuinte && (
          <Selecao
            rotulo="Contribuinte"
            dica="opcional, permite emitir recibo"
            value={pessoaId}
            onChange={(e) => setPessoaId(e.target.value)}
          >
            <option value="">Não identificar</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Selecao>
        )}

        <Campo
          rotulo="Descrição"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: Oferta do culto de domingo"
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
