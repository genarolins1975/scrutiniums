/**
 * Iconografia própria do Setor Elétrico: traço fino, monocromático, herdando a
 * cor do texto. Os mesmos símbolos se repetem em todo o portal (cabeçalhos,
 * mapa, cartões, verbetes) para reconhecimento imediato da grandeza. Nunca
 * carregam informação sozinhos: sempre acompanhados de rótulo.
 */
export type TipoIcone =
  | "agua"
  | "clima"
  | "hidraulica"
  | "geracao"
  | "solar"
  | "eolica"
  | "termica"
  | "carga"
  | "intercambio"
  | "rede"
  | "preco"
  | "mercado"
  | "empresas"
  | "expansao"
  | "regulacao"
  | "aprenda"
  | "dados"
  | "modelo"
  | "sistema";

const TRACOS: Record<TipoIcone, string[]> = {
  agua: ["M12 3c-3 4-6 7.5-6 11a6 6 0 0 0 12 0c0-3.5-3-7-6-11z"],
  clima: ["M7 16a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A4 4 0 0 1 17 16H7z", "M8 19l-1 2M12 19l-1 2M16 19l-1 2"],
  hidraulica: ["M3 10c3 0 3-2 6-2s3 2 6 2 3-2 6-2", "M3 16c3 0 3-2 6-2s3 2 6 2 3-2 6-2"],
  geracao: ["M13 2 4 14h7l-1 8 9-12h-7l1-8z"],
  solar: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"],
  eolica: ["M12 22v-9", "M12 11V3M12 11l6.5 3.7M12 11l-6.5 3.7", "M12 9.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"],
  termica: ["M12 22c4 0 7-3 7-7 0-3-2-5.5-3.5-7.5-.8 2-2 3-3 3.5 0-3-1-6-3-8-1 4-4.5 6-4.5 12 0 4 3 7 7 7z"],
  carga: ["M9 2v6M15 2v6", "M6 8h12v4a6 6 0 0 1-12 0V8z", "M12 18v4"],
  intercambio: ["M4 9h13l-3-3", "M20 15H7l3 3"],
  rede: ["M12 3v19", "M7 22l5-14 5 14", "M8.5 12h7", "M7 22h10"],
  preco: ["M20 12l-8 8-9-9V3h8l9 9z", "M7.5 7.5h.01"],
  mercado: ["M12 3v18", "M4 7h16", "M6 7l-3 7a3 3 0 0 0 6 0L6 7z", "M18 7l-3 7a3 3 0 0 0 6 0l-3-7", "M8 21h8"],
  empresas: ["M4 21V5l8-3v19", "M12 21V9l8 3v9", "M4 21h16", "M8 8h1M8 12h1M8 16h1M16 15h1M16 18h1"],
  expansao: ["M3 17l6-6 4 4 8-8", "M15 7h6v6"],
  regulacao: ["M6 2h9l5 5v15H6z", "M15 2v5h5", "M9 13h6M9 17h6"],
  aprenda: ["M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z", "M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"],
  dados: ["M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z", "M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6", "M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"],
  modelo: ["M6 4h12l-7 8 7 8H6"],
  sistema: ["M12 2v4M12 18v4M2 12h4M18 12h4", "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"],
};

export function IconeSetor({
  tipo,
  tamanho = 18,
  className = "",
  titulo,
}: {
  tipo: TipoIcone;
  tamanho?: number;
  className?: string;
  /** Quando o ícone é a única indicação (raro), nomeia para leitores de tela. */
  titulo?: string;
}) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={titulo ? undefined : "true"}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      focusable="false"
      className={`inline-block shrink-0 align-[-0.2em] ${className}`}
    >
      {TRACOS[tipo].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/** Ícone que representa cada fonte de geração, para uso nas legendas. */
export const ICONE_FONTE = { hidraulica: "hidraulica", termica: "termica", eolica: "eolica", solar: "solar" } as const;
