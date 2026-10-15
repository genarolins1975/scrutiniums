import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle } from "@/components/ui/SectionHeading";
import { dataOuNaoApurado, registroErros } from "@/lib/sobre";
import { metadadosPortuguesComAlternativas } from "@/lib/i18n-metadata";

/**
 * Registro público de erros, publicado a partir de pesquisa/registro_erros.json,
 * o mesmo arquivo que a auditoria mensal (auditoria-notas.yml) atualiza.
 */
export const dynamic = "force-static";

const metadadosOriginais: Metadata = {
  title: "Registro público de erros",
  description: "Todo erro publicado pela Scrutiniums, com superfície, gravidade, datas de detecção e correção e canal de detecção. Nada é apagado.",
  alternates: { canonical: "/sobre/erros" },
};

export async function generateMetadata(_props: { params?: Record<string, string> }, parent: ResolvingMetadata): Promise<Metadata> {
  return metadadosPortuguesComAlternativas("/sobre/erros", metadadosOriginais, await parent);
}

export default function ErrosPage() {
  const { descricao, erros } = registroErros();
  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <PublicHeaderView />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <nav aria-label="Trilha" className="rotulo text-mineral">
          <Link href="/sobre" className="hover:text-bronze">Sobre</Link> / Registro de erros
        </nav>
        <PageTitle label="Política de correção" title="Registro público de erros" description={descricao} />
        <p className="mt-4 text-sm text-mineral">
          {erros.length} {erros.length === 1 ? "erro registrado" : "erros registrados"}. Data não apurada aparece como não apurada.
        </p>
        <div className="mt-8 overflow-x-auto border border-linha bg-papel">
          <table className="w-full text-sm">
            <caption className="sr-only">Erros publicados, com superfície, gravidade, detecção e correção</caption>
            <thead>
              <tr className="text-left text-xs text-mineral">
                <th scope="col" className="p-3 font-normal">Erro</th>
                <th scope="col" className="p-3 font-normal">O que aconteceu</th>
                <th scope="col" className="p-3 font-normal">Gravidade</th>
                <th scope="col" className="p-3 font-normal">Detecção</th>
                <th scope="col" className="p-3 font-normal">Correção</th>
              </tr>
            </thead>
            <tbody>
              {erros.map((e) => (
                <tr key={e.id} className="border-t border-linha align-top">
                  <th scope="row" className="p-3 text-left font-normal">
                    <span className="font-mono text-xs text-carvao">{e.id}</span>
                    <span className="mt-1 block text-xs text-mineral">{e.superficie}</span>
                  </th>
                  <td className="p-3 text-carvao-muted">{e.descricao}</td>
                  <td className="p-3 text-carvao-muted">{e.gravidade}</td>
                  <td className="p-3 text-carvao-muted">
                    {dataOuNaoApurado(e.data_deteccao)}
                    {e.canal_deteccao ? <span className="block text-xs text-mineral">canal: {e.canal_deteccao}</span> : null}
                  </td>
                  <td className="p-3 text-carvao-muted">
                    {dataOuNaoApurado(e.correcao?.data)}
                    {e.correcao?.onde ? <span className="block text-xs text-mineral">{e.correcao.onde}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </div>
  );
}
