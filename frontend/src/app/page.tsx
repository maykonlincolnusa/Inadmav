import { redirect } from "next/navigation";

/** A raiz sempre abre a entrada; a própria tela encaminha sessões ativas ao painel. */
export default function Raiz() {
  redirect("/entrar");
}
