"use client";

/**
 * Componentes base do inAdmav.
 *
 * Monocromático: o destaque vem da inversão (fundo escuro sobre claro, ou
 * o contrário), não de cor. Só a ação destrutiva usa vermelho.
 */

import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export function cx(...partes: (string | false | null | undefined)[]): string {
  return partes.filter(Boolean).join(" ");
}

// --- Botão ----------------------------------------------------------------

type VarianteBotao = "primario" | "secundario" | "fantasma" | "perigo";
type TamanhoBotao = "sm" | "md" | "lg";

const VARIANTES: Record<VarianteBotao, string> = {
  primario:
    "bg-acento text-inverso hover:opacity-90 disabled:opacity-40 shadow-sutil",
  secundario:
    "border border-borda-forte bg-superficie text-texto hover:bg-superficie-2 disabled:opacity-40",
  fantasma: "text-texto-suave hover:bg-superficie-2 hover:text-texto",
  perigo: "bg-perigo text-white hover:opacity-90 disabled:opacity-40",
};

const TAMANHOS: Record<TamanhoBotao, string> = {
  sm: "h-8 px-3 text-[0.82rem] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-[0.95rem] gap-2",
};

export function Botao({
  variante = "primario",
  tamanho = "md",
  className,
  carregando,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  carregando?: boolean;
}) {
  return (
    <button
      className={cx(
        "inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition",
        "disabled:cursor-not-allowed",
        VARIANTES[variante],
        TAMANHOS[tamanho],
        className,
      )}
      {...props}
      type={props.type ?? "button"}
      disabled={props.disabled || carregando}
      aria-busy={carregando || undefined}
    >
      {carregando && <Girando />}
      {children}
    </button>
  );
}

function Girando() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// --- Campos ---------------------------------------------------------------

const BASE_CAMPO =
  "w-full rounded-lg border border-borda-forte bg-superficie px-3 py-2.5 text-sm text-texto " +
  "placeholder:text-texto-fraco transition outline-none " +
  "focus:border-acento focus:ring-2 focus:ring-acento/15 disabled:opacity-50";

export function Campo({
  rotulo,
  dica,
  erro,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  rotulo?: string;
  dica?: string;
  erro?: string;
}) {
  return (
    <label className="block">
      {rotulo && (
        <span className="rotulo-campo">
          {rotulo}
          {dica && <span className="font-normal text-texto-fraco"> — {dica}</span>}
        </span>
      )}
      <input
        className={cx(BASE_CAMPO, erro && "border-perigo ring-2 ring-perigo/15", className)}
        {...props}
      />
      {erro && <span className="mt-1 block text-xs text-perigo">{erro}</span>}
    </label>
  );
}

export function Selecao({
  rotulo,
  dica,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  rotulo?: string;
  dica?: string;
}) {
  return (
    <label className="block">
      {rotulo && (
        <span className="rotulo-campo">
          {rotulo}
          {dica && <span className="font-normal text-texto-fraco"> — {dica}</span>}
        </span>
      )}
      <select className={cx(BASE_CAMPO, "cursor-pointer", className)} {...props}>
        {children}
      </select>
    </label>
  );
}

export function AreaTexto({
  rotulo,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { rotulo?: string }) {
  return (
    <label className="block">
      {rotulo && <span className="rotulo-campo">{rotulo}</span>}
      <textarea
        className={cx(BASE_CAMPO, "min-h-[84px] resize-y", className)}
        {...props}
      />
    </label>
  );
}

// --- Etiquetas ------------------------------------------------------------

export function Etiqueta({
  children,
  variante = "neutra",
  className,
}: {
  children: ReactNode;
  variante?: "neutra" | "forte" | "contorno" | "alerta";
  className?: string;
}) {
  const estilos = {
    neutra: "bg-superficie-3 text-texto-suave",
    forte: "bg-acento text-inverso",
    contorno: "border border-borda-forte text-texto-suave",
    alerta: "border border-perigo/40 bg-perigo-suave text-perigo",
  }[variante];

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium",
        estilos,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Círculo com as iniciais — a marca não tem foto de membro. */
export function Avatar({
  nome,
  tamanho = "md",
  destaque,
}: {
  nome: string;
  tamanho?: "sm" | "md" | "lg";
  destaque?: boolean;
}) {
  const escala = {
    sm: "h-8 w-8 text-[0.7rem]",
    md: "h-10 w-10 text-xs",
    lg: "h-16 w-16 text-lg",
  }[tamanho];

  const letras = /^\d+$/.test(nome) ? nome : (nome || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={cx(
        "flex shrink-0 items-center justify-center rounded-lg font-semibold",
        destaque
          ? "bg-acento text-inverso"
          : "bg-superficie-3 text-texto-suave",
        escala,
      )}
      aria-hidden
    >
      {letras}
    </div>
  );
}

// --- Cartão e cabeçalhos --------------------------------------------------

export function Cartao({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("cartao overflow-hidden", className)}>{children}</div>;
}

export function CabecalhoSecao({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          {titulo}
        </h2>
        {descricao && (
          <p className="mt-0.5 text-sm text-texto-suave">{descricao}</p>
        )}
      </div>
      {acao}
    </div>
  );
}

// --- Estados --------------------------------------------------------------

export function Vazio({
  titulo,
  descricao,
  icone,
  acao,
}: {
  titulo: string;
  descricao?: string;
  icone?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {icone && <div className="mb-3 text-texto-fraco">{icone}</div>}
      <h3 className="font-serif text-lg font-medium">{titulo}</h3>
      {descricao && (
        <p className="mt-1 max-w-sm text-sm text-texto-suave">{descricao}</p>
      )}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}

export function Carregando({ texto = "Carregando..." }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2.5 py-16 text-sm text-texto-suave">
      <Girando />
      {texto}
    </div>
  );
}

export function Erro({
  mensagem,
  aoTentar,
}: {
  mensagem: string;
  aoTentar?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-perigo-suave text-perigo">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" strokeWidth="2" stroke="currentColor">
          <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <p className="max-w-sm text-sm text-texto-suave">{mensagem}</p>
      {aoTentar && (
        <Botao variante="secundario" tamanho="sm" onClick={aoTentar}>
          Tentar de novo
        </Botao>
      )}
    </div>
  );
}

// --- Aviso destacado ------------------------------------------------------

export function Aviso({
  children,
  acao,
}: {
  children: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="nao-imprimir mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-borda-forte bg-superficie-2 px-4 py-3.5">
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 shrink-0 text-texto"
        fill="none"
        strokeWidth="2"
        stroke="currentColor"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
      </svg>
      <div className="min-w-[200px] flex-1 text-sm text-texto-suave">{children}</div>
      {acao}
    </div>
  );
}

// --- Modal ----------------------------------------------------------------

export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  rodape,
  largura = "md",
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: "md" | "lg";
}) {
  const refCaixa = useRef<HTMLDivElement>(null);
  const fecharRef = useRef(aoFechar);
  fecharRef.current = aoFechar;

  useEffect(() => {
    if (!aberto) return;
    const focoAnterior = document.activeElement as HTMLElement | null;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fecharRef.current();
      if (e.key === "Tab") {
        const campos = Array.from(refCaixa.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ) ?? []).filter((campo) => campo.getClientRects().length > 0);
        const primeiro = campos[0];
        const ultimo = campos[campos.length - 1];
        if (!primeiro) { e.preventDefault(); refCaixa.current?.focus(); }
        else if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      }
    };
    document.addEventListener("keydown", aoTeclar);
    // Trava a rolagem do fundo enquanto o modal está aberto.
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Foca o primeiro campo: quem cadastra em série já começa digitando.
    const primeiro = refCaixa.current?.querySelector<HTMLElement>(
      "input, select, textarea",
    );
    const timer = setTimeout(() => (primeiro ?? refCaixa.current)?.focus(), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
      focoAnterior?.focus();
    };
  }, [aberto]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid animate-aparecer place-items-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div
        ref={refCaixa}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-label={titulo}
        className={cx(
          "scroll-fino max-h-[90vh] w-full animate-surgir overflow-auto rounded-2xl border border-borda bg-superficie shadow-flutuante",
          largura === "lg" ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <div className="px-6 pt-6">
          <h3 className="font-serif text-xl font-semibold tracking-tight">
            {titulo}
          </h3>
          {descricao && (
            <p className="mt-1 text-sm text-texto-suave">{descricao}</p>
          )}
        </div>
        <div className="px-6 py-5">{children}</div>
        {rodape && (
          <div className="sticky bottom-0 flex justify-end gap-2.5 border-t border-borda bg-superficie px-6 py-4">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Aviso flutuante ------------------------------------------------------

let mostrarGlobal: ((m: string) => void) | null = null;

export function avisar(mensagem: string) {
  mostrarGlobal?.(mensagem);
}

export function AreaDeAvisos() {
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    mostrarGlobal = (m: string) => {
      setMensagem(m);
      setTimeout(() => setMensagem(null), 3200);
    };
    return () => {
      mostrarGlobal = null;
    };
  }, []);

  if (!mensagem) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="nao-imprimir fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-surgir rounded-xl bg-acento px-5 py-3 text-sm font-medium text-inverso shadow-flutuante"
    >
      {mensagem}
    </div>
  );
}

// --- Abas -----------------------------------------------------------------

export function Abas<T extends string>({
  abas,
  ativa,
  aoTrocar,
}: {
  abas: { id: T; rotulo: string; total?: number; destaque?: boolean }[];
  ativa: T;
  aoTrocar: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      className="nao-imprimir scroll-fino flex gap-1 overflow-x-auto border-b border-borda px-3 pt-3"
    >
      {abas.map((aba) => {
        const selecionada = aba.id === ativa;
        return (
          <button
            key={aba.id}
            role="tab"
            aria-selected={selecionada}
            onClick={() => aoTrocar(aba.id)}
            className={cx(
              "flex shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-3.5 pb-2.5 pt-2 text-sm font-medium transition",
              selecionada
                ? "border-acento text-texto"
                : "border-transparent text-texto-suave hover:bg-superficie-2 hover:text-texto",
            )}
          >
            {aba.rotulo}
            {aba.total !== undefined && (
              <span
                className={cx(
                  "tabular rounded-full px-1.5 py-0.5 text-[0.68rem] font-semibold",
                  selecionada
                    ? "bg-acento text-inverso"
                    : aba.destaque
                      ? "border border-borda-forte text-texto"
                      : "bg-superficie-3 text-texto-suave",
                )}
              >
                {aba.total}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
