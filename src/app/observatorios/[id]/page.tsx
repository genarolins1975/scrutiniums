import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { EntradaFamilias, type ColecaoEntrada } from "@/components/observatorios/EntradaFamilias";
import { ATALHOS, OBSERVATORIOS, observatorio, paineis, type ObservatorioId } from "@/lib/observatorios/registro";
import { dominio } from "@/lib/dominios";
import { escalaFamilias, orcamentoFamilia } from "@/lib/observatorios/entradas/familias";
import { portas } from "@/lib/perguntas/portas";

/**
 * Entradas com conta dos observatórios que reúnem várias coleções. Rota
 * fechada: não consta de src/lib/rotasPublicas.ts. Estática, lida das golds
 * no build. Só o Observatório das Famílias tem entrada própria nesta etapa;
 * os demais seguem pela página aberta e pelas coleções.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

/** Observatórios com entrada própria, declarada no registro (campo `entrada`). */
const ENTRADAS = OBSERVATORIOS.filter((o) => o.entrada).map((o) => o.id);

export function generateStaticParams() {
  return ENTRADAS.map((id) => ({ id }));
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  if (!ENTRADAS.includes(params.id as ObservatorioId)) notFound();
  const o = observatorio(params.id as ObservatorioId);
  return { title: `${o.nome}: ${o.pergunta}`, robots: { index: false } };
}

/** Coleções do observatório com os painéis próprios e os atalhos, cada atalho com a coleção que o mantém. */
function colecoesDe(id: ObservatorioId): ColecaoEntrada[] {
  const todos = paineis();
  return observatorio(id).colecoes.map((c) => {
    const proprios = todos.filter((p) => p.observatorio === id && p.colecao === c.id).map((p) => ({ titulo: p.titulo, href: p.rota }));
    const atalhos = ATALHOS.filter((x) => x.observatorio === id && x.colecao === c.id).flatMap((x) => {
      const dono = todos.find((p) => p.rota === x.rota);
      return dono ? [{ titulo: dono.titulo, href: dono.rota, origem: dominio(dono.origem).nomeCurto }] : [];
    });
    return { id: c.id, nome: c.nome, href: c.href, paineis: [...proprios, ...atalhos] };
  });
}

export default function EntradaObservatorioPage({ params }: { params: { id: string } }) {
  if (params.id !== "familias") notFound();
  const porta = portas().find((p) => p.id === "familias");
  return (
    <>
      <PublicHeader />
      <EntradaFamilias
        pergunta={observatorio("familias").pergunta}
        escala={escalaFamilias()}
        colecoes={colecoesDe("familias")}
        orcamento={orcamentoFamilia()}
        caminhos={porta?.caminhos ?? []}
      />
      <Footer />
    </>
  );
}
