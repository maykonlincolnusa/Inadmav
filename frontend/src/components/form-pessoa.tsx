"use client";

/** Modal de cadastro e edição de pessoa. */

import { useEffect, useState } from "react";

import { CampoNascimento } from "@/components/campo-nascimento";
import { AreaTexto, Botao, Campo, Modal, Selecao, avisar } from "@/components/ui";
import { api } from "@/lib/api";
import {
  ROTULO_GRUPO,
  ROTULO_SITUACAO,
  type Cargo,
  type Celula,
  type GrupoCargo,
  type Nascimento,
  type Pessoa,
  type PessoaEntrada,
  type Situacao,
} from "@/lib/tipos";

const ORDEM_GRUPOS: GrupoCargo[] = ["ministerio", "diaconato", "cooperacao"];

export function FormPessoa({
  aberto,
  pessoa,
  cargos,
  celulas,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  pessoa: Pessoa | null;
  cargos: Cargo[];
  celulas: Celula[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const editando = Boolean(pessoa);

  const [nome, setNome] = useState("");
  const [cargoId, setCargoId] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("membro");
  const [nascimento, setNascimento] = useState<Nascimento | null>(null);
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [celulaId, setCelulaId] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Recarrega os campos toda vez que o modal abre, para não vazar dados de
  // um cadastro anterior no próximo.
  useEffect(() => {
    if (!aberto) return;
    setNome(pessoa?.nome ?? "");
    setCargoId(pessoa?.cargo_id ?? "");
    setSituacao(pessoa?.situacao ?? "membro");
    setNascimento(pessoa?.nascimento ?? null);
    setTelefone(pessoa?.telefone ?? "");
    setEmail(pessoa?.email ?? "");
    setEndereco(pessoa?.endereco ?? "");
    setCelulaId(pessoa?.celula_id ?? "");
    setObservacoes(pessoa?.observacoes ?? "");
    setErro(null);
  }, [aberto, pessoa]);

  async function salvar() {
    if (!nome.trim()) {
      setErro("O nome é obrigatório.");
      return;
    }
    setSalvando(true);
    setErro(null);

    const dados: PessoaEntrada = {
      nome: nome.trim(),
      cargo_id: cargoId || null,
      situacao,
      nascimento,
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      endereco: endereco.trim() || null,
      celula_id: celulaId || null,
      observacoes: observacoes.trim() || null,
    };

    try {
      if (pessoa) {
        await api.atualizarPessoa(pessoa.id, dados);
        avisar("Alterações salvas");
      } else {
        await api.criarPessoa(dados);
        avisar("Pessoa cadastrada");
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
      aoFechar={() => { if (!salvando) aoFechar(); }}
      titulo={editando ? "Editar pessoa" : "Nova pessoa"}
      descricao="Cadastro de membro, congregado ou visitante"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao type="submit" form="form-pessoa" carregando={salvando}>
            {editando ? "Salvar alterações" : "Adicionar"}
          </Botao>
        </>
      }
    >
      <form id="form-pessoa" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
        <Campo
          rotulo="Nome completo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Como está no documento"
          autoComplete="off"
          minLength={2}
          maxLength={140}
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelecaoCargo
            cargos={cargos}
            valor={cargoId}
            aoMudar={setCargoId}
          />
          <Selecao
            rotulo="Situação"
            value={situacao}
            onChange={(e) => setSituacao(e.target.value as Situacao)}
          >
            {(Object.keys(ROTULO_SITUACAO) as Situacao[]).map((s) => (
              <option key={s} value={s}>
                {ROTULO_SITUACAO[s]}
              </option>
            ))}
          </Selecao>
        </div>

        <CampoNascimento valor={nascimento} aoMudar={setNascimento} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Telefone"
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(00) 90000-0000"
          />
          <Campo
            rotulo="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
          />
        </div>

        <Campo
          rotulo="Endereço"
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          placeholder="Rua, número, bairro, cidade"
        />

        <Selecao
          rotulo="Célula"
          value={celulaId}
          onChange={(e) => setCelulaId(e.target.value)}
        >
          <option value="">Nenhuma célula</option>
          {celulas.filter((c) => c.ativa || c.id === celulaId).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>

        <AreaTexto
          rotulo="Observações"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Anotações da secretaria sobre esta pessoa"
        />

        {erro && (
          <p className="rounded-lg bg-perigo-suave px-3 py-2 text-sm text-perigo">
            {erro}
          </p>
        )}
      </form>
    </Modal>
  );
}

/**
 * Cargos agrupados por grupo no <optgroup>.
 *
 * A pessoa que cadastra pensa "é um diácono", não "é o cargo nº 5" — o
 * agrupamento é o mesmo das abas da listagem, então a cabeça não troca de
 * modelo mental entre uma tela e outra.
 */
function SelecaoCargo({
  cargos,
  valor,
  aoMudar,
}: {
  cargos: Cargo[];
  valor: string;
  aoMudar: (v: string) => void;
}) {
  return (
    <Selecao
      rotulo="Cargo"
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
    >
      <option value="">Sem cargo</option>
      {ORDEM_GRUPOS.map((grupo) => {
        const doGrupo = cargos.filter((c) => c.grupo === grupo && (c.ativo || c.id === valor));
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
  );
}
