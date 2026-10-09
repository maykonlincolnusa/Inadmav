"use client";

/** Guarda de rota: nenhuma tela interna aparece antes da sessão resolver. */

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Marca } from "@/components/logo";
import { useSessao } from "@/lib/sessao";

export function Protegido({ children }: { children: ReactNode }) {
  const { carregando, usuario, usuarioFirebase } = useSessao();
  const roteador = useRouter();

  useEffect(() => {
    if (carregando) return;
    // Sem login, ou logado sem papel na igreja: volta para a entrada, que
    // sabe explicar os dois casos.
    if (!usuarioFirebase || !usuario) roteador.replace("/entrar");
  }, [carregando, usuario, usuarioFirebase, roteador]);

  if (carregando || !usuario) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fundo">
        <Marca className="h-10 w-10 animate-pulse text-texto-fraco" />
        <span className="sr-only">Carregando</span>
      </div>
    );
  }

  return <>{children}</>;
}
