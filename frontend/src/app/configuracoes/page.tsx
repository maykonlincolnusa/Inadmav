"use client";

import { useCallback, useEffect, useState } from "react";

import { IconeCopiar, IconeFormulario, IconeMais } from "@/components/icones";
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
  avisar,
} from "@/components/ui";
import { api } from "@/lib/api";
import { copiar } from "@/lib/formato";
import { useSessao } from "@/lib/sessao";
import {
  ehAdmin,
  podeEditarPessoas,
  ROTULO_GRUPO,
  ROTULO_PAPEL,
  type Cargo,
  type Papel,
  type Usuario,
} from "@/lib/tipos";

export default function PaginaConfiguracoes() {
  return (
    <Protegido>
      <ConteudoConfiguracoes />
    </Protegido>
  );
}

function ConteudoConfiguracoes() {
  const { usuario } = useSessao();
  const admin = ehAdmin(usuario?.papel);

  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [convidando, setConvidando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [c, u] = await Promise.all([
        api.cargos(),
        admin ? api.usuarios() : Promise.resolve([] as Usuario[]),
      ]);
      setCargos(c);
      setUsuarios(u);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setCarregando(false);
    }
  }, [admin]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const linkFormulario =
    typeof window !== "undefined" && usuario
      ? `${window.location.origin}/cadastro/${usuario.igreja_id}`
      : "";

  return (
    <Estrutura titulo="Configurações">
      {carregando ? (
        <Carregando />
      ) : erro ? (
        <Erro mensagem={erro} aoTentar={carregar} />
      ) : (
        <div className="space-y-5">
          {/* --- Formulário aberto --- */}
          <Cartao>
            <div className="border-b border-borda px-6 py-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <IconeFormulario className="h-4 w-4" />
                Formulário de cadastro
              </h3>
              <p className="mt-1 text-sm text-texto-suave">
                Abra este link num tablet na entrada da igreja, ou mande no
                grupo: a pessoa preenche os próprios dados e eles caem direto
                na lista de Pessoas, marcados como novos para conferência.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 px-6 py-4">
              <input
                readOnly
                value={linkFormulario}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-borda bg-superficie-2 px-3 py-2 text-sm text-texto-suave"
              />
              <Botao
                variante="secundario"
                onClick={async () => {
                  const ok = await copiar(linkFormulario);
                  avisar(ok ? "Link copiado" : "Copie o link manualmente");
                }}
              >
                <IconeCopiar className="h-4 w-4" />
                Copiar
              </Botao>
              <a href={linkFormulario} target="_blank" rel="noopener noreferrer">
                <Botao>Abrir</Botao>
              </a>
            </div>
          </Cartao>

          {/* --- Cargos --- */}
          <Cartao>
            <div className="border-b border-borda px-6 py-4">
              <h3 className="text-sm font-semibold">Cargos da igreja</h3>
              <p className="mt-1 text-sm text-texto-suave">
                A nomenclatura varia entre ministérios. Ajuste aqui para bater
                com a ADMAV — as abas da tela de Pessoas seguem estes grupos.
              </p>
            </div>
            <div className="divide-y divide-borda">
              {cargos.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 px-6 py-3"
                >
                  <span className="flex-1 text-sm font-medium">{c.nome}</span>
                  <Etiqueta variante="contorno">
                    {ROTULO_GRUPO[c.grupo]}
                  </Etiqueta>
                  <Etiqueta>
                    {c.total_pessoas} {c.total_pessoas === 1 ? "pessoa" : "pessoas"}
                  </Etiqueta>
                </div>
              ))}
              {cargos.length === 0 && (
                <p className="px-6 py-8 text-center text-sm text-texto-suave">
                  Nenhum cargo cadastrado.
                </p>
              )}
            </div>
          </Cartao>

          {/* --- Usuários (só admin) --- */}
          {admin && (
            <Cartao>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-6 py-4">
                <div>
                  <h3 className="text-sm font-semibold">Quem tem acesso</h3>
                  <p className="mt-1 text-sm text-texto-suave">
                    Cada pessoa vê só o que o papel dela permite. O tesoureiro
                    não precisa do endereço de todo mundo.
                  </p>
                </div>
                <Botao tamanho="sm" onClick={() => setConvidando(true)}>
                  <IconeMais className="h-4 w-4" />
                  Convidar
                </Botao>
              </div>
              <div className="divide-y divide-borda">
                {usuarios.map((u) => (
                  <div
                    key={u.uid}
                    className="flex flex-wrap items-center gap-3 px-6 py-3"
                  >
                    <div className="min-w-[180px] flex-1">
                      <p className="text-sm font-medium">
                        {u.nome ?? u.email ?? "—"}
                      </p>
                      {u.nome && u.email && (
                        <p className="text-xs text-texto-fraco">{u.email}</p>
                      )}
                    </div>
                    <Etiqueta variante={u.ativo ? "contorno" : "alerta"}>
                      {u.ativo ? ROTULO_PAPEL[u.papel] : "Desativado"}
                    </Etiqueta>
                  </div>
                ))}
              </div>
            </Cartao>
          )}

          {/* --- Nota sobre dados --- */}
          <Cartao>
            <div className="px-6 py-5">
              <h3 className="text-sm font-semibold">Sobre os dados</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-texto-suave">
                Ficha de membro é dado pessoal sensível pela LGPD, porque
                revela filiação religiosa. Os dados ficam no Firestore do
                projeto da igreja, o acesso é por papel, e o formulário aberto
                grava sempre como &quot;novo&quot; até a secretaria conferir.
              </p>
            </div>
          </Cartao>
        </div>
      )}

      {admin && (
        <ModalConvite
          aberto={convidando}
          aoFechar={() => setConvidando(false)}
          aoSalvar={carregar}
        />
      )}
    </Estrutura>
  );
}

function ModalConvite({
  aberto,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<Papel>("secretaria");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setEmail("");
    setNome("");
    setPapel("secretaria");
    setErro(null);
  }, [aberto]);

  async function convidar() {
    if (!email.trim()) {
      setErro("Informe o e-mail.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await api.convidarUsuario({
        email: email.trim(),
        nome: nome.trim() || undefined,
        papel,
      });
      avisar("Convite liberado");
      aoSalvar();
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível convidar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Convidar para o sistema"
      descricao="A pessoa cria a conta com este e-mail e já entra com o papel definido."
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao onClick={convidar} carregando={salvando}>
            Liberar acesso
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Campo
          rotulo="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="secretaria@igreja.com"
          required
        />
        <Campo
          rotulo="Nome"
          dica="opcional"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da pessoa"
        />
        <Selecao
          rotulo="Papel"
          value={papel}
          onChange={(e) => setPapel(e.target.value as Papel)}
        >
          {(Object.keys(ROTULO_PAPEL) as Papel[]).map((p) => (
            <option key={p} value={p}>
              {ROTULO_PAPEL[p]}
            </option>
          ))}
        </Selecao>
        {erro && (
          <p className="rounded-lg bg-perigo-suave px-3 py-2 text-sm text-perigo">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  );
}
