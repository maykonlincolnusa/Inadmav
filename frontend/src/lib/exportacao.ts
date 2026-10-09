/** CSV para planilhas: protege o arquivo contra fórmulas vindas de dados cadastrados. */
function celula(valor: string | number | null | undefined): string {
  let texto = String(valor ?? "");
  if (/^[\s]*[=+@-]/.test(texto) || /^[\t\r\n]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

export function montarCSV(linhas: (string | number | null | undefined)[][]): string {
  return `\uFEFF${linhas.map((linha) => linha.map(celula).join(";")).join("\r\n")}`;
}

export function baixarCSV(
  nome: string,
  linhas: (string | number | null | undefined)[][],
): void {
  const url = URL.createObjectURL(
    new Blob([montarCSV(linhas)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
