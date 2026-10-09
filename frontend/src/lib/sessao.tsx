"use client";

/** Sessão do usuário e preferência de tema, compartilhados por toda a app. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as UsuarioFirebase,
} from "firebase/auth";

import { api, ErroApi } from "./api";
import { obterAuth } from "./firebase";
import type { Usuario } from "./tipos";

type Sessao = {
  carregando: boolean;
  usuarioFirebase: UsuarioFirebase | null;
  usuario: Usuario | null;
  /** Erro que impede o uso, ex.: e-mail sem acesso liberado. */
  erroAcesso: string | null;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
};

const ContextoSessao = createContext<Sessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [usuarioFirebase, setUsuarioFirebase] = useState<UsuarioFirebase | null>(
    null,
  );
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);

  const buscarPerfil = useCallback(async () => {
    try {
      setUsuario(await api.eu());
      setErroAcesso(null);
    } catch (erro) {
      setUsuario(null);
      // 403 aqui significa "autenticou no Firebase mas não tem papel na
      // igreja" — é o caso de quem criou conta sem convite.
      setErroAcesso(
        erro instanceof ErroApi && erro.ehPermissao
          ? erro.message
          : "Não foi possível carregar seu acesso.",
      );
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(obterAuth(), async (u) => {
      setUsuarioFirebase(u);
      if (u) {
        await buscarPerfil();
      } else {
        setUsuario(null);
        setErroAcesso(null);
      }
      setCarregando(false);
    });
  }, [buscarPerfil]);

  const entrar = useCallback(async (email: string, senha: string) => {
    await signInWithEmailAndPassword(obterAuth(), email.trim(), senha);
  }, []);

  const sair = useCallback(async () => {
    await signOut(obterAuth());
    setUsuario(null);
  }, []);

  const valor = useMemo(
    () => ({
      carregando,
      usuarioFirebase,
      usuario,
      erroAcesso,
      entrar,
      sair,
      recarregar: buscarPerfil,
    }),
    [carregando, usuarioFirebase, usuario, erroAcesso, entrar, sair, buscarPerfil],
  );

  return (
    <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>
  );
}

export function useSessao(): Sessao {
  const ctx = useContext(ContextoSessao);
  if (!ctx) throw new Error("useSessao precisa estar dentro de ProvedorSessao");
  return ctx;
}

// --- Tema -----------------------------------------------------------------

type Tema = "claro" | "escuro" | "sistema";
const CHAVE_TEMA = "inadmav:tema";

const ContextoTema = createContext<{
  tema: Tema;
  definirTema: (t: Tema) => void;
} | null>(null);

export function ProvedorTema({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>("sistema");

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_TEMA) as Tema | null;
      if (salvo) aplicar(salvo, setTema);
    } catch {
      /* navegador com armazenamento bloqueado — segue no tema do sistema */
    }
  }, []);

  const definirTema = useCallback((t: Tema) => {
    aplicar(t, setTema);
    try {
      localStorage.setItem(CHAVE_TEMA, t);
    } catch {
      /* sem persistência, mas o tema vale para esta sessão */
    }
  }, []);

  return (
    <ContextoTema.Provider value={{ tema, definirTema }}>
      {children}
    </ContextoTema.Provider>
  );
}

function aplicar(t: Tema, setTema: (t: Tema) => void) {
  const raiz = document.documentElement;
  if (t === "sistema") raiz.removeAttribute("data-tema");
  else raiz.setAttribute("data-tema", t);
  setTema(t);
}

export function useTema() {
  const ctx = useContext(ContextoTema);
  if (!ctx) throw new Error("useTema precisa estar dentro de ProvedorTema");
  return ctx;
}
