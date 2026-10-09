/** Formatação de datas, valores e nomes, sempre em pt-BR. */

import { MESES, type Nascimento } from "./tipos";

export function iniciais(nome: string): string {
  return (nome || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function primeiroNome(nome: string): string {
  return (nome || "").trim().split(/\s+/)[0] ?? "";
}

export function moeda(valor: string | number): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(n) ? n : 0);
}

/** 'AAAA-MM-DD' -> '25/08/2026'. Sem `new Date`, que desloca por fuso. */
export function data(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

export function dataPorExtenso(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return iso;
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

export function nascimentoTexto(n: Nascimento | null | undefined): string {
  if (!n) return "—";
  const base = `${String(n.dia).padStart(2, "0")}/${String(n.mes).padStart(2, "0")}`;
  return n.ano ? `${base}/${n.ano}` : base;
}

export function nomeMes(mes: number): string {
  return MESES[mes - 1] ?? "";
}

export function capitalizar(texto: string): string {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";
}

/** Competência 'AAAA-MM' -> 'agosto de 2026'. */
export function competenciaTexto(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${nomeMes(mes)} de ${ano}`;
}

export function competenciaAtual(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
}

export function hojeISO(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(
    h.getDate(),
  ).padStart(2, "0")}`;
}

export function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function dataLongaHoje(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Plural simples: 1 pessoa / 3 pessoas. */
export function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

/**
 * Copia texto para a área de transferência.
 *
 * A API moderna exige contexto seguro; o `execCommand` cobre o resto — e a
 * igreja pode abrir isso em rede local sem HTTPS.
 */
export async function copiar(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    /* cai no método antigo */
  }
  try {
    const area = document.createElement("textarea");
    area.value = texto;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Dias de um mês, respeitando 29/02 como data de nascimento válida. */
export function diasDoMes(mes: number): number {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1] ?? 31;
}
