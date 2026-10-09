"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";

import { LogoCompleta } from "@/components/logo";
import { Botao, Campo } from "@/components/ui";
import { mensagemDeErro } from "@/lib/firebase";
import { useSessao } from "@/lib/sessao";

export default function PaginaEntrar() {
  const roteador = useRouter();
  const { entrar, usuario, usuarioFirebase, erroAcesso, carregando, sair } =
    useSessao();

  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!carregando && usuario) roteador.replace("/painel");
  }, [carregando, usuario, roteador]);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
    } catch (err) {
      setErro(
        err instanceof FirebaseError
          ? mensagemDeErro(err.code)
          : "Senha incorreta ou erro ao entrar. Tente novamente.",
      );
    } finally {
      setEnviando(false);
    }
  }

  if (usuarioFirebase && erroAcesso) {
    return (
      <Moldura>
        <div className="text-center">
          <h2 className="font-serif text-xl font-semibold">Acesso pendente</h2>
          <p className="mt-2 text-sm text-texto-suave">{erroAcesso}</p>
          <Botao
            variante="secundario"
            className="mt-5 w-full"
            onClick={() => void sair()}
          >
            Sair
          </Botao>
        </div>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <form onSubmit={aoEnviar} className="space-y-4">
        <div className="mb-6 text-center">
          <h2 className="font-serif text-xl font-semibold tracking-tight">
            Entrar no sistema
          </h2>
          <p className="mt-1 text-sm text-texto-suave">
            Use o e-mail e a senha do seu acesso à igreja.
          </p>
        </div>

        <Campo rotulo="E-mail" type="email" autoComplete="username" required
          value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
        <Campo
          autoComplete="current-password"
          rotulo="Senha"
          type="password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="••••••••"
          erro={erro ?? undefined}
        />

        <Botao
          type="submit"
          tamanho="lg"
          className="w-full"
          carregando={enviando}
        >
          Entrar
        </Botao>
      </form>
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-fundo px-4 py-10">
      <LogoCompleta tamanho="lg" className="mb-8 flex-col gap-3 text-center" />
      <div className="w-full max-w-sm rounded-2xl border border-borda bg-superficie p-7 shadow-sutil">
        {children}
      </div>
      <p className="mt-6 text-center text-xs text-texto-fraco">
        inAdmav · gestão da igreja
      </p>
    </div>
  );
}
