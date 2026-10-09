import Link from "next/link";

/** Os mesmos destinos e rótulos da barra de Crédito (public/obs/index.html). */
export function NavegacaoObservatorios({ atual }: { atual: "credito" | "energia" | "eficiencia" }) {
  return <nav aria-label="Observatórios da Scrutiniums" className="obs-dominios">
    {[
      ["credito", "/observatorio", "Crédito"],
      ["energia", "/setor-eletrico", "Setor Elétrico"],
      ["eficiencia", "/eficiencia-estatal", "Eficiência Estatal"],
    ].map(([id, href, rotulo]) => <Link key={id} href={href} prefetch={false} aria-current={atual === id ? "true" : undefined}>{rotulo}</Link>)}
  </nav>;
}
