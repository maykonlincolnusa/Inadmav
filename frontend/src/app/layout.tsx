import type { Metadata, Viewport } from "next";

import { AreaDeAvisos } from "@/components/ui";
import { ProvedorSessao, ProvedorTema } from "@/lib/sessao";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "inAdmav",
    template: "%s · inAdmav",
  },
  description:
    "Gestão de membresia, cargos, aniversariantes e finanças da igreja.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0B0C" },
  ],
};

export default function LayoutRaiz({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/*
          Aplica o tema salvo antes da primeira pintura. Sem isso, quem usa
          o tema escuro vê um lampejo branco a cada carregamento.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('inadmav:tema');if(t&&t!=='sistema')document.documentElement.setAttribute('data-tema',t)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="font-sans">
        <ProvedorTema>
          <ProvedorSessao>
            {children}
            <AreaDeAvisos />
          </ProvedorSessao>
        </ProvedorTema>
      </body>
    </html>
  );
}
