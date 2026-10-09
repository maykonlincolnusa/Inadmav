"use client";

/**
 * Formulário aberto de cadastro.
 *
 * Pensado para um tablet na entrada da igreja ou um link no grupo: a
 * própria pessoa preenche e o registro cai direto na lista da secretaria,
 * marcado como novo. É a resposta ao "fica muito complicado ter tudo
 * manualmente" — ninguém precisa digitar centenas de fichas.
 *
 * Sem login, e de propósito mais estreito que o cadastro interno: aqui não
 * se define papel administrativo nem se marca ninguém como conferido.
 */

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { CampoNascimento } from "@/components/campo-nascimento";
import { IconeCheck } from "@/components/icones";
import { LogoCompleta, Marca } from "@/components/logo";
import { AreaDeAvisos, Botao, Campo, Carregando, Erro, Selecao } from "@/components/ui";
import { apiPublica } from "@/lib/api";
import {
  ROTULO_GRUPO,
  ROTULO_SITUACAO,
  type GrupoCargo,
  type Nascimento,
  type OpcoesFormulario,
  type Situacao,
} from "@/lib/tipos";

const ORDEM_GRUPOS: GrupoCargo[] = ["ministerio", "diaconato", "cooperacao"];

export default function FormularioPublico() {
  const { igreja } = useParams<{ igreja: string }>();

  const [opcoes, setOpcoes] = useState<OpcoesFormulario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [concluido, setConcluido] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      setOpcoes(await apiPublica.opcoes(igreja));
    } catch (e) {
      setErroCarga(
        e instanceof Error ? e.message : "Não foi possível abrir o formulário.",
      );
    } finally {
      setCarregando(false);
    }
  }, [igreja]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="min-h-screen bg-fundo px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center text-center">
          <Marca className="mb-4 h-14 w-14" />
          <h1 className="font-serif text-2xl font-medium tracking-tight">
            Ficha de cadastro
          </h1>
          <p className="mt-1.5 text-sm text-texto-suave">
            {opcoes?.igreja_nome ?? "Igreja"} — preencha seus dados.
            <br />
            Leva menos de um minuto.
          </p>
        </div>

        <div className="rounded-2xl border border-borda bg-superficie p-6 shadow-sutil sm:p-7">
          {carregando ? (
            <Carregando texto="Abrindo formulário..." />
          ) : erroCarga ? (
            <Erro mensagem={erroCarga} aoTentar={carregar} />
          ) : concluido ? (
            <TelaConcluido
              primeiroNome={concluido}
              aoNovo={() => setConcluido(null)}
            />
          ) : (
            opcoes && (
              <Formulario
                igrejaId={igreja}
                opcoes={opcoes}
                aoConcluir={setConcluido}
              />
            )
          )}
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-texto-fraco">
          Seus dados ficam apenas com a secretaria da igreja.
          <br />
          <LogoCompleta tamanho="sm" className="mt-3 justify-center opacity-60" />
        </p>
      </div>
      <AreaDeAvisos />
    </div>
  );
}

function Formulario({
  igrejaId,
  opcoes,
  aoConcluir,
}: {
  igrejaId: string;
  opcoes: OpcoesFormulario;
  aoConcluir: (primeiroNome: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState<Nascimento | null>(null);
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("visitante");
  const [cargoId, setCargoId] = useState("");
  const [celulaId, setCelulaId] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro("Por favor, preencha seu nome.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await apiPublica.cadastrar(igrejaId, {
        nome: nome.trim(),
        nascimento,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        endereco: endereco.trim() || null,
        situacao,
        cargo_id: cargoId || null,
        celula_id: celulaId || null,
      });
      aoConcluir(r.primeiro_nome);
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : "Não foi possível enviar. Tente novamente.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo
        rotulo="Nome completo"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Como está no seu documento"
        autoComplete="name"
        required
      />

      <CampoNascimento valor={nascimento} aoMudar={setNascimento} />

      <Campo
        rotulo="Telefone / WhatsApp"
        type="tel"
        inputMode="tel"
        value={telefone}
        onChange={(e) => setTelefone(e.target.value)}
        placeholder="(00) 90000-0000"
        autoComplete="tel"
      />

      <Campo
        rotulo="E-mail"
        dica="opcional"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@exemplo.com"
        autoComplete="email"
      />

      <Campo
        rotulo="Endereço"
        value={endereco}
        onChange={(e) => setEndereco(e.target.value)}
        placeholder="Rua, número, bairro, cidade"
        autoComplete="street-address"
      />

      <div className="flex items-center gap-3 py-2 text-[0.7rem] font-semibold uppercase tracking-widest text-texto-fraco">
        <span className="h-px flex-1 bg-borda" />
        Na igreja
        <span className="h-px flex-1 bg-borda" />
      </div>

      <Selecao
        rotulo="Você é"
        value={situacao}
        onChange={(e) => setSituacao(e.target.value as Situacao)}
      >
        {(Object.keys(ROTULO_SITUACAO) as Situacao[]).map((s) => (
          <option key={s} value={s}>
            {ROTULO_SITUACAO[s]}
          </option>
        ))}
      </Selecao>

      <Selecao
        rotulo="Cargo"
        dica="se tiver"
        value={cargoId}
        onChange={(e) => setCargoId(e.target.value)}
      >
        <option value="">Não tenho cargo</option>
        {ORDEM_GRUPOS.map((grupo) => {
          const doGrupo = opcoes.cargos.filter((c) => c.grupo === grupo);
          if (doGrupo.length === 0) return null;
          return (
            <optgroup key={grupo} label={ROTULO_GRUPO[grupo]}>
              {doGrupo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </optgroup>
          );
        })}
      </Selecao>

      {opcoes.celulas.length > 0 && (
        <Selecao
          rotulo="Célula"
          dica="se participar"
          value={celulaId}
          onChange={(e) => setCelulaId(e.target.value)}
        >
          <option value="">Não participo de célula</option>
          {opcoes.celulas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>
      )}

      {erro && (
        <p className="rounded-lg bg-perigo-suave px-3 py-2.5 text-sm text-perigo">
          {erro}
        </p>
      )}

      <Botao
        type="submit"
        tamanho="lg"
        className="mt-2 w-full"
        carregando={enviando}
      >
        Enviar cadastro
      </Botao>
    </form>
  );
}

function TelaConcluido({
  primeiroNome,
  aoNovo,
}: {
  primeiroNome: string;
  aoNovo: () => void;
}) {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-acento text-inverso">
        <IconeCheck className="h-8 w-8" />
      </div>
      <h2 className="font-serif text-2xl font-semibold">
        Obrigado, {primeiroNome}!
      </h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-texto-suave">
        Seu cadastro foi enviado para a secretaria da igreja.
        <br />
        Que Deus abençoe sua vida.
      </p>
      {/* No tablet da entrada, a próxima pessoa já começa a preencher. */}
      <Botao variante="secundario" className="mt-7 w-full" onClick={aoNovo}>
        Cadastrar outra pessoa
      </Botao>
    </div>
  );
}
