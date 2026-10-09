"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { FormPessoa } from "@/components/form-pessoa";
import {
  IconeCheck,
  IconeEditar,
  IconeImprimir,
  IconeLixeira,
  IconeTelefone,
  IconeVoltar,
} from "@/components/icones";
import { Estrutura } from "@/components/navegacao";
import { Protegido } from "@/components/protegido";
import {
  Avatar,
  Aviso,
  Botao,
  Carregando,
  Cartao,
  Erro,
  Etiqueta,
  Modal,
  avisar,
} from "@/components/ui";
import { api } from "@/lib/api";
import { data as fmtData, nascimentoTexto } from "@/lib/formato";
import { useSessao } from "@/lib/sessao";
import {
  podeEditarPessoas,
  ROTULO_GRUPO,
  ROTULO_SITUACAO,
  type Cargo,
  type Celula,
  type Pessoa,
} from "@/lib/tipos";

export default function PaginaFicha() {
  return (
    <Protegido>
      <ConteudoFicha />
    </Protegido>
  );
}

function ConteudoFicha() {
  const { id } = useParams<{ id: string }>();
  const roteador = useRouter();
  const { usuario } = useSessao();
  const podeEditar = podeEditarPessoas(usuario?.papel);

  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [celulas, setCelulas] = useState<Celula[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [p, c, cel] = await Promise.all([
        api.pessoa(id),
        api.cargos(),
        api.celulas(),
      ]);
      setPessoa(p);
      setCargos(c);
      setCelulas(cel);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar a ficha.");
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function conferir() {
    if (!pessoa) return;
    try {
      await api.conferirCadastros([pessoa.id]);
      avisar("Cadastro conferido");
      await carregar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível conferir.");
    }
  }

  async function remover() {
    if (!pessoa) return;
    try {
      await api.removerPessoa(pessoa.id);
      avisar("Registro removido");
      roteador.push("/pessoas");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível remover.");
    }
  }

  const novo = pessoa?.origem === "formulario" && !pessoa.revisado;

  return (
    <Estrutura titulo={pessoa?.nome ?? "Ficha"}>
      <Link
        href="/pessoas"
        className="nao-imprimir mb-5 inline-flex items-center gap-2 text-sm font-medium text-texto-suave transition hover:text-texto"
      >
        <IconeVoltar className="h-4 w-4" />
        Voltar para Pessoas
      </Link>

      {carregando && <Carregando />}
      {erro && <Erro mensagem={erro} aoTentar={carregar} />}

      {pessoa && !carregando && (
        <>
          {novo && (
            <Aviso
              acao={
                podeEditar && (
                  <Botao tamanho="sm" onClick={conferir}>
                    <IconeCheck className="h-4 w-4" />
                    Marcar como conferido
                  </Botao>
                )
              }
            >
              Cadastro recebido pelo{" "}
              <b className="font-semibold text-texto">formulário aberto</b> em{" "}
              {fmtData(pessoa.criado_em?.slice(0, 10))}. Confira os dados antes
              de considerar oficial.
            </Aviso>
          )}

          <Cartao>
            <div className="flex flex-wrap items-center gap-5 border-b border-borda px-6 py-6">
              <Avatar nome={pessoa.nome} tamanho="lg" />
              <div className="min-w-[200px] flex-1">
                <h2 className="font-serif text-2xl font-semibold leading-tight tracking-tight">
                  {pessoa.nome}
                </h2>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {pessoa.cargo_nome && (
                    <Etiqueta variante="forte">{pessoa.cargo_nome}</Etiqueta>
                  )}
                  <Etiqueta>{ROTULO_SITUACAO[pessoa.situacao]}</Etiqueta>
                  {pessoa.celula_nome && (
                    <Etiqueta variante="contorno">{pessoa.celula_nome}</Etiqueta>
                  )}
                </div>
              </div>

              <div className="nao-imprimir flex flex-wrap gap-2">
                {pessoa.whatsapp_url && (
                  <a
                    href={pessoa.whatsapp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Botao variante="secundario" tamanho="sm">
                      <IconeTelefone className="h-4 w-4" />
                      WhatsApp
                    </Botao>
                  </a>
                )}
                <Botao
                  variante="secundario"
                  tamanho="sm"
                  onClick={() => window.print()}
                >
                  <IconeImprimir className="h-4 w-4" />
                  Imprimir
                </Botao>
                {podeEditar && (
                  <>
                    <Botao
                      variante="secundario"
                      tamanho="sm"
                      onClick={() => setEditando(true)}
                    >
                      <IconeEditar className="h-4 w-4" />
                      Editar
                    </Botao>
                    <Botao
                      variante="perigo"
                      tamanho="sm"
                      onClick={() => setConfirmandoRemocao(true)}
                    >
                      <IconeLixeira className="h-4 w-4" />
                      Remover
                    </Botao>
                  </>
                )}
              </div>
            </div>

            <dl className="grid sm:grid-cols-2">
              <Dado titulo="Data de nascimento">
                {pessoa.nascimento ? (
                  <>
                    <span className="tabular">
                      {nascimentoTexto(pessoa.nascimento)}
                    </span>
                    <span className="ml-2 text-sm font-normal text-texto-fraco">
                      {pessoa.idade != null
                        ? `(${pessoa.idade} anos)`
                        : "(ano não informado)"}
                    </span>
                  </>
                ) : null}
              </Dado>

              <Dado titulo="Cargo">
                {pessoa.cargo_nome ? (
                  <>
                    {pessoa.cargo_nome}
                    <span className="ml-2 text-sm font-normal text-texto-fraco">
                      · {ROTULO_GRUPO[pessoa.cargo_grupo]}
                    </span>
                  </>
                ) : null}
              </Dado>

              <Dado titulo="Telefone">
                {pessoa.telefone ? (
                  pessoa.whatsapp_url ? (
                    <a
                      href={pessoa.whatsapp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4 hover:text-texto-suave"
                    >
                      {pessoa.telefone}
                    </a>
                  ) : (
                    pessoa.telefone
                  )
                ) : null}
              </Dado>

              <Dado titulo="E-mail">
                {pessoa.email ? (
                  <a
                    href={`mailto:${pessoa.email}`}
                    className="break-all underline underline-offset-4 hover:text-texto-suave"
                  >
                    {pessoa.email}
                  </a>
                ) : null}
              </Dado>

              <Dado titulo="Endereço" largo>
                {pessoa.endereco}
              </Dado>

              <Dado titulo="Célula">{pessoa.celula_nome}</Dado>

              <Dado titulo="Cadastrado em">
                {pessoa.criado_em ? (
                  <>
                    <span className="tabular">
                      {fmtData(pessoa.criado_em.slice(0, 10))}
                    </span>
                    {pessoa.origem === "formulario" && (
                      <span className="ml-2 text-sm font-normal text-texto-fraco">
                        · via formulário
                      </span>
                    )}
                  </>
                ) : null}
              </Dado>

              {pessoa.observacoes && (
                <Dado titulo="Observações" largo>
                  {pessoa.observacoes}
                </Dado>
              )}
            </dl>
          </Cartao>

          <FormPessoa
            aberto={editando}
            pessoa={pessoa}
            cargos={cargos}
            celulas={celulas}
            aoFechar={() => setEditando(false)}
            aoSalvar={carregar}
          />

          <Modal
            aberto={confirmandoRemocao}
            aoFechar={() => setConfirmandoRemocao(false)}
            titulo="Remover pessoa"
            descricao="Esta ação não pode ser desfeita."
            rodape={
              <>
                <Botao
                  variante="secundario"
                  onClick={() => setConfirmandoRemocao(false)}
                >
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
              <b className="font-semibold text-texto">{pessoa.nome}</b> do
              cadastro da igreja?
            </p>
          </Modal>
        </>
      )}
    </Estrutura>
  );
}

function Dado({
  titulo,
  children,
  largo,
}: {
  titulo: string;
  children: ReactNode;
  largo?: boolean;
}) {
  const vazio =
    children === null || children === undefined || children === "" || children === false;

  return (
    <div
      className={`border-b border-borda px-6 py-4 ${
        largo ? "sm:col-span-2" : "sm:odd:border-r"
      }`}
    >
      <dt className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-texto-fraco">
        {titulo}
      </dt>
      <dd
        className={`text-[0.95rem] ${
          vazio ? "text-texto-fraco" : "font-medium text-texto"
        }`}
      >
        {vazio ? "Não informado" : children}
      </dd>
    </div>
  );
}
