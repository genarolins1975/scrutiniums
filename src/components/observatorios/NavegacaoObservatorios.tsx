import Link from "next/link";
import type { DominioId } from "@/lib/dominios";
import { Nome } from "@/components/i18n/Nome";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { OBSERVATORIOS, OBSERVATORIO_PRINCIPAL, destinoObservatorio, type ObservatorioId } from "@/lib/observatorios/lista";

/**
 * Abas dos seis observatórios nos cabeçalhos dos painéis: as mesmas do
 * cabeçalho público e da barra da aplicação do Crédito (public/obs/index.html).
 * Dentro dos painéis, quem tem conta vai à entrada do observatório ou à sua
 * seção na escolha pós login. A aba destacada é o observatório em que está o
 * núcleo da coleção corrente. Os nomes são nomes próprios: em inglês ficam em
 * português, marcados com Nome.
 */
export const ABAS_OBSERVATORIOS: { id: ObservatorioId; href: string; rotulo: string }[] = OBSERVATORIOS.map((o) => ({
  id: o.id,
  href: destinoObservatorio(o),
  rotulo: o.nomeCurto,
}));

export function NavegacaoObservatorios({ atual }: { atual: DominioId }) {
  const idioma = idiomaEnergia();
  const corrente = OBSERVATORIO_PRINCIPAL[atual];
  return <nav aria-label={tx("Observatórios da Scrutiniums", "Scrutiniums observatories", idioma)} className="obs-dominios">
    {ABAS_OBSERVATORIOS.map(({ id, href, rotulo }) => <Link key={id} href={href} prefetch={false} aria-current={corrente === id ? "true" : undefined}><Nome>{rotulo}</Nome></Link>)}
  </nav>;
}
