"use client";

import { useEffect, useRef, useState } from "react";
import { MESES, type Nascimento } from "@/lib/tipos";
import { capitalizar } from "@/lib/formato";
import { Campo, Selecao } from "@/components/ui";

/** Mantém a digitação parcial sem apagar dia, mês ou os primeiros dígitos do ano. */
export function CampoNascimento({ valor, aoMudar, erro }: {
  valor: Nascimento | null; aoMudar: (n: Nascimento | null) => void; erro?: string;
}) {
  const [dia, setDia] = useState(String(valor?.dia ?? ""));
  const [mes, setMes] = useState(String(valor?.mes ?? ""));
  const [ano, setAno] = useState(String(valor?.ano ?? ""));
  const emitido = useRef(JSON.stringify(valor));

  useEffect(() => {
    const recebido = JSON.stringify(valor);
    if (recebido === emitido.current) return;
    emitido.current = recebido;
    setDia(String(valor?.dia ?? ""));
    setMes(String(valor?.mes ?? ""));
    setAno(String(valor?.ano ?? ""));
  }, [valor]);

  function atualizar(d: string, m: string, a: string) {
    setDia(d); setMes(m); setAno(a);
    const novo = d && m && (!a || a.length === 4)
      ? { dia: Number(d), mes: Number(m), ano: a ? Number(a) : null } : null;
    emitido.current = JSON.stringify(novo);
    aoMudar(novo);
  }

  return <fieldset>
    <legend className="rotulo-campo">Data de nascimento <span className="font-normal text-texto-suave">· ano opcional</span></legend>
    <div className="grid grid-cols-[0.9fr_1.5fr_1fr] gap-2.5">
      <Selecao aria-label="Dia" value={dia} required={Boolean(mes || ano)} onChange={(e) => atualizar(e.target.value, mes, ano)}>
        <option value="">Dia</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
      </Selecao>
      <Selecao aria-label="Mês" value={mes} required={Boolean(dia || ano)} onChange={(e) => atualizar(dia, e.target.value, ano)}>
        <option value="">Mês</option>
        {MESES.map((nome, i) => <option key={nome} value={i + 1}>{capitalizar(nome)}</option>)}
      </Selecao>
      <Campo aria-label="Ano" inputMode="numeric" pattern="[0-9]{4}" maxLength={4}
        title="Informe os quatro dígitos do ano ou deixe em branco." placeholder="Ano" value={ano}
        onChange={(e) => atualizar(dia, mes, e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} />
    </div>
    {erro && <p role="alert" className="mt-1 text-xs text-perigo">{erro}</p>}
  </fieldset>;
}
