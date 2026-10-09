/**
 * Marca do inAdmav.
 *
 * A chama com a estrela e a órbita, redesenhada em SVG para escalar de 16px
 * (favicon) a tela cheia sem perder o traço, e para herdar a cor do texto —
 * assim ela fica branca no tema escuro e preta no claro sem precisar de dois
 * arquivos.
 *
 * Para usar o arquivo oficial no lugar deste desenho, coloque-o em
 * `public/logo.svg` e troque <Marca /> por <img src="/logo.svg" />.
 */

type MarcaProps = {
  className?: string;
  titulo?: string;
};

export function Marca({ className = "h-8 w-8", titulo = "inAdmav" }: MarcaProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={titulo}
      fill="none"
    >
      {/* Órbita — elipse fina inclinada que envolve a chama */}
      <ellipse
        cx="50"
        cy="50"
        rx="24"
        ry="42"
        transform="rotate(-24 50 50)"
        stroke="currentColor"
        strokeWidth="0.9"
        opacity="0.75"
      />

      {/* Chama maior */}
      <path
        d="M55.5 12c1 8.5-.5 16-4.5 23.5-3.5 6.5-8.5 12-12.5 18.5-4 6.5-6 13.5-3 20.5 1.5 3.5 4 6.5 7 9-6-2-11-6.5-13.5-12.5-3-7.5-1.5-15.5 2-22.5 3.5-7 8.5-13 13-19.5C48.5 22.5 52.5 17.5 55.5 12z"
        fill="currentColor"
      />

      {/* Chama menor, deslocada — cria o vazio que dá o desenho da marca */}
      <path
        d="M58.5 33c2.5 6.5 2.5 13-.5 19.5-2.5 5.5-6.5 10-9.5 15.5-2.5 4.5-4 9.5-2.5 14.5.5 2 1.5 4 3 5.5-4.5-1-8-4.5-9.5-9-2-6-.5-12.5 2.5-18 3-5.5 7-10.5 10-16C55 40 57.5 36.5 58.5 33z"
        fill="currentColor"
      />

      {/* Estrela de dez pontas, no alto à direita */}
      <path
        d="M74 20 l2.4 6.6 6.6-2.4-4.2 5.8 6.2 3.2-6.9 1 1 6.9-5.1-4.7-4.4 5.4.9-7-6.9-1.1 6.2-3.2-4.2-5.8 6.6 2.4z"
        fill="currentColor"
      />

      {/* Brilho de quatro pontas, à esquerda */}
      <path
        d="M31 33.5c.4 3.4 1.6 4.6 5 5-3.4.4-4.6 1.6-5 5-.4-3.4-1.6-4.6-5-5 3.4-.4 4.6-1.6 5-5z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Marca + nome, para o cabeçalho da barra lateral e a tela de login. */
export function LogoCompleta({
  className = "",
  tamanho = "md",
}: {
  className?: string;
  tamanho?: "sm" | "md" | "lg";
}) {
  const escala = {
    sm: { marca: "h-6 w-6", texto: "text-base" },
    md: { marca: "h-8 w-8", texto: "text-xl" },
    lg: { marca: "h-14 w-14", texto: "text-3xl" },
  }[tamanho];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Marca className={escala.marca} />
      <span className={`${escala.texto} font-semibold tracking-tight`}>
        in<span className="font-serif italic">Admav</span>
      </span>
    </div>
  );
}
