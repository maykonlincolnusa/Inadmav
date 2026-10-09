"use client";

/** Barra lateral, cabeçalho e o esqueleto de todas as telas internas. */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import {
  IconeBolo,
  IconeCalendario,
  IconeCarteira,
  IconeCelulas,
  IconeConfig,
  IconeLua,
  IconeMenu,
  IconePainel,
  IconePessoas,
  IconeSair,
  IconeSol,
} from "@/components/icones";
import { LogoCompleta } from "@/components/logo";
import { Botao, cx } from "@/components/ui";
import { useSessao, useTema } from "@/lib/sessao";
import { podeVerFinanceiro, ROTULO_PAPEL } from "@/lib/tipos";

type ItemMenu = {
  href: string;
  rotulo: string;
  Icone: (p: { className?: string }) => ReactNode;
  somenteFinanceiro?: boolean;
};

const MENU: ItemMenu[] = [
  { href: "/painel", rotulo: "Painel", Icone: IconePainel },
  { href: "/pessoas", rotulo: "Pessoas", Icone: IconePessoas },
  { href: "/aniversariantes", rotulo: "Aniversariantes", Icone: IconeBolo },
  { href: "/celulas", rotulo: "Células", Icone: IconeCelulas },
  { href: "/eventos", rotulo: "Eventos", Icone: IconeCalendario },
  {
    href: "/financeiro",
    rotulo: "Financeiro",
    Icone: IconeCarteira,
    somenteFinanceiro: true,
  },
  { href: "/configuracoes", rotulo: "Configurações", Icone: IconeConfig },
];

export function Estrutura({
  titulo,
  acao,
  pendentes,
  children,
}: {
  titulo: string;
  acao?: ReactNode;
  pendentes?: number;
  children: ReactNode;
}) {
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const caminho = usePathname();

  // Trocar de página no celular fecha a gaveta.
  useEffect(() => setGavetaAberta(false), [caminho]);

  return (
    <div className="min-h-screen bg-fundo">
      <BarraLateral
        aberta={gavetaAberta}
        aoFechar={() => setGavetaAberta(false)}
        pendentes={pendentes}
      />

      {gavetaAberta && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setGavetaAberta(false)}
          aria-hidden
        />
      )}

      <div className="lg:pl-[248px]">
        <header className="nao-imprimir sticky top-0 z-20 flex items-center gap-4 border-b border-borda bg-fundo/85 px-4 py-3.5 backdrop-blur-md lg:px-8">
          <button
            className="rounded-lg border border-borda p-2 lg:hidden"
            onClick={() => setGavetaAberta(true)}
            aria-label="Abrir menu"
          >
            <IconeMenu className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate font-serif text-xl font-semibold tracking-tight">
            {titulo}
          </h1>
          {acao}
        </header>

        <main className="mx-auto max-w-6xl animate-subir px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function BarraLateral({
  aberta,
  aoFechar,
  pendentes,
}: {
  aberta: boolean;
  aoFechar: () => void;
  pendentes?: number;
}) {
  const caminho = usePathname();
  const roteador = useRouter();
  const { usuario, sair } = useSessao();
  const { tema, definirTema } = useTema();

  const itens = MENU.filter(
    (i) => !i.somenteFinanceiro || podeVerFinanceiro(usuario?.papel),
  );

  return (
    <aside
      className={cx(
        "nao-imprimir fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-borda bg-superficie px-3 py-5 transition-transform lg:translate-x-0",
        aberta ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="px-2 pb-6">
        <LogoCompleta />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {itens.map(({ href, rotulo, Icone }) => {
          const ativo = caminho === href || caminho.startsWith(`${href}/`);
          const marcador = href === "/pessoas" && pendentes ? pendentes : null;
          return (
            <Link
              key={href}
              href={href}
              onClick={aoFechar}
              className={cx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                ativo
                  ? "bg-acento text-inverso"
                  : "text-texto-suave hover:bg-superficie-2 hover:text-texto",
              )}
            >
              <Icone className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1">{rotulo}</span>
              {marcador && (
                <span
                  className={cx(
                    "tabular rounded-full px-1.5 text-[0.68rem] font-bold",
                    ativo
                      ? "bg-inverso text-acento"
                      : "border border-borda-forte text-texto",
                  )}
                >
                  {marcador}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 border-t border-borda pt-4">
        <div className="flex items-center gap-2 px-1">
          <button
            onClick={() => definirTema(tema === "escuro" ? "claro" : "escuro")}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-borda px-3 py-2 text-xs font-medium text-texto-suave transition hover:bg-superficie-2 hover:text-texto"
            aria-label="Alternar tema"
          >
            {tema === "escuro" ? (
              <IconeSol className="h-4 w-4" />
            ) : (
              <IconeLua className="h-4 w-4" />
            )}
            {tema === "escuro" ? "Claro" : "Escuro"}
          </button>
        </div>

        <div className="rounded-lg bg-superficie-2 px-3 py-2.5">
          <p className="truncate text-xs font-medium">
            {usuario?.nome ?? usuario?.email ?? "—"}
          </p>
          <p className="text-[0.7rem] text-texto-fraco">
            {usuario ? ROTULO_PAPEL[usuario.papel] : ""}
          </p>
        </div>

        <Botao
          variante="fantasma"
          tamanho="sm"
          className="w-full justify-start"
          onClick={async () => {
            await sair();
            roteador.push("/entrar");
          }}
        >
          <IconeSair className="h-4 w-4" />
          Sair
        </Botao>
      </div>
    </aside>
  );
}
