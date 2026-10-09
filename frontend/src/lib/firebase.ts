"use client";

/**
 * Firebase do lado do cliente — usado só para autenticação.
 *
 * O app nunca lê o Firestore direto: todo dado passa pela API, que valida
 * papel e igreja. Aqui só entra o suficiente para fazer login e obter o ID
 * token que acompanha cada requisição.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  browserLocalPersistence,
  setPersistence,
  type Auth,
} from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

export function obterAuth(): Auth {
  if (auth) return auth;

  app = getApps().length ? getApps()[0] : initializeApp(config);
  auth = getAuth(app);

  const emulador = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR;
  if (emulador) {
    connectAuthEmulator(auth, emulador, { disableWarnings: true });
  }

  // A secretaria fecha o navegador e volta no dia seguinte — a sessão
  // precisa sobreviver a isso.
  void setPersistence(auth, browserLocalPersistence);

  return auth;
}

/** Traduz os códigos do Firebase Auth para o que a pessoa precisa ler. */
export function mensagemDeErro(codigo: string): string {
  const mapa: Record<string, string> = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-disabled": "Esta conta foi desativada.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/too-many-requests":
      "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    "auth/network-request-failed": "Sem conexão. Verifique a internet.",
    "auth/weak-password": "A senha precisa ter ao menos 6 caracteres.",
    "auth/email-already-in-use": "Já existe uma conta com este e-mail.",
  };
  return mapa[codigo] ?? "Não foi possível entrar. Tente novamente.";
}
