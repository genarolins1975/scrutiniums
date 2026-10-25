import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { RotuloContexto } from "@/components/layout/RotuloContexto";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { Municipio, Metodo, DownloadsEducacao } from "@/components/educacao/PainelEducacao";
import { consultarMunicipio, goldEducacao, rotuloPorte } from "@/lib/educacao/dados";
import { hrefFichaMunicipio, hrefMunicipio } from "@/lib/educacao/paginas";
import { num } from "@/lib/educacao/formato";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

export const dynamic = "force-dynamic";
type Props = { params: { ibge: string } };
export function generateMetadata({ params }: Props): Metadata {
  const c = consultarMunicipio(params.ibge);
  return { title: tituloNaColecao(c.estado === "ok" ? `Educação em ${c.m.nome} (${c.uf})` : "Município não encontrado", "/educacao-municipal"), alternates: { canonical: hrefFichaMunicipio(params.ibge) } };
}
export default function FichaMunicipio({ params }: Props) {
  const c = consultarMunicipio(params.ibge);
  if (c.estado !== "ok") notFound();
  const g = goldEducacao();
  const { m, uf, arquivo } = c;
  return <>
    <header><CabecalhoPlataforma observatorio="servicos-publicos" destinoConta={hrefFichaMunicipio(m.id)} fontes={["educacao"]} /><NavegacaoColecao colecao="educacao" /></header>
    <main id="conteudo-educacao" className="edm-ficha">
      <header>
        <RotuloContexto rota="/educacao-municipal" />
        <h1>Educação em {m.nome} ({uf})</h1>
        <p>{arquivo.nome_uf} · código do Instituto Brasileiro de Geografia e Estatística (IBGE) {m.id} · {num(m.pop)} habitantes em {g.fontes.populacao.ano} · {rotuloPorte(g, m.porte) ?? "Porte sem dado"}. Fonte: IBGE.</p>
        <Link href={hrefMunicipio(m.id)} prefetch={false} className="edm-link inline-flex min-h-[44px] items-center">Voltar ao resumo da cidade</Link>
      </header>
      <Municipio g={g} m={m} uf={uf} arquivo={arquivo} />
      <section className="edm-sub" aria-label="Downloads com conta"><DownloadsEducacao /></section>
      <Recolhido id="metodo-ficha" titulo="Método e fontes" resumo="Conceitos, fontes, conferências e arquivos para baixar." className="mt-12"><Metodo g={g} semDownloads /></Recolhido>
    </main>
  </>;
}
