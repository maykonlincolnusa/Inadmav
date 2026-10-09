"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Marca } from "@/components/logo";
import { useSessao } from "@/lib/sessao";

/** Raiz: manda para o painel ou para a entrada, conforme a sessao. */
export default function Raiz() {
  const roteador = useRouter();
  const { carregando, usuario } = useSessao();

  useEffect(() => {
    if (carregando) return;
    roteador.replace(usuario ? "/painel" : "/entrar");
  }, [carregando, usuario, roteador]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-fundo">
      <Marca className="h-10 w-10 animate-pulse text-texto-fraco" />
      <span className="sr-only">Carregando</span>
    </div>
  );
}
