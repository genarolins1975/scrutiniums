/**
 * Estado de prontidão de um destino ou de uma coleção, com forma única em toda a plataforma (Iniciativa 4 do parecer de UX
 * de 21/10/2026): glifo e texto, nunca só cor. Quatro valores:
 *
 * - `publicado`: página com dados na cobertura declarada;
 * - `parcial`: no ar, com parte da cobertura ("cobertura parcial");
 * - `preparacao`: consta do catálogo, ainda sem página ("em preparação"); um destino nesse estado nunca é link;
 * - `piloto`: no ar como etapa piloto, com escopo reduzido declarado.
 *
 * Substitui "Estados · Piloto", "Versão em desenvolvimento.", "Em desenvolvimento", "(previsto)", "em preparação" e "Em
 * integração" escritos à mão; `src/tests/entrada-molde.test.ts` reprova as formas antigas.
 */
export type Prontidao = "publicado" | "parcial" | "preparacao" | "piloto";

const TEXTO: Record<Prontidao, { pt: string; en: string; glifo: string }> = {
  publicado: { pt: "publicado", en: "published", glifo: "●" },
  parcial: { pt: "cobertura parcial", en: "partial coverage", glifo: "◐" },
  preparacao: { pt: "em preparação", en: "in preparation", glifo: "○" },
  piloto: { pt: "piloto", en: "pilot", glifo: "◇" },
};

/** O texto do selo, para quem precisa dele fora do componente (aria-label, título de aba). */
export function textoProntidao(valor: Prontidao, idioma: "pt" | "en" = "pt"): string {
  return TEXTO[valor][idioma];
}

export function SeloProntidao({
  valor,
  idioma = "pt",
  detalhe,
  className = "",
}: Readonly<{
  valor: Prontidao;
  idioma?: "pt" | "en";
  /** Complemento só para leitor de tela (o que o estado quer dizer naquele destino). */
  detalhe?: string;
  className?: string;
}>) {
  const t = TEXTO[valor];
  return (
    <span data-prontidao={valor} className={`inline-flex items-baseline gap-1 whitespace-nowrap text-xs normal-case tracking-normal text-mineral ${className}`}>
      <span aria-hidden="true">{t.glifo}</span>
      {t[idioma]}
      {detalhe && <span className="sr-only">: {detalhe}</span>}
    </span>
  );
}
