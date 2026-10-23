import Link from "next/link";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle } from "@/components/ui/SectionHeading";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import { dataOuNaoApurado, registroErros, type ErroRegistrado } from "@/lib/sobre";
import { DESCRICAO_REGISTRO_EN, TEXTOS_ERROS } from "@/i18n/paginas/erros";
import { hrefNoIdioma } from "@/lib/i18n-href";
import type { Idioma } from "@/lib/idioma";

/**
 * Registro público de erros, publicado a partir de pesquisa/registro_erros.json,
 * o mesmo arquivo que a auditoria mensal (auditoria-notas.yml) atualiza. As
 * entradas são mantidas em português; na página inglesa elas aparecem marcadas.
 */
function TabelaErros({ erros }: { erros: ErroRegistrado[] }) {
  return (
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
  );
}

export function ErrosConteudo({ idioma }: { idioma: Idioma }) {
  const t = TEXTOS_ERROS[idioma];
  const { descricao, erros } = registroErros();
  return (
    <div className="flex min-h-screen flex-col bg-papel">
      <PublicHeaderView idioma={idioma} />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <nav aria-label={t.trilha} className="rotulo text-mineral">
          <Link href={hrefNoIdioma("/sobre", idioma)} className="hover:text-bronze">{t.sobre}</Link> / {t.trilhaAtual}
        </nav>
        <PageTitle label={t.rotulo} title={t.titulo} description={idioma === "pt" ? descricao : DESCRICAO_REGISTRO_EN} />
        <p className="mt-4 text-sm text-mineral">{t.contagem(erros.length)}</p>
        {idioma === "pt" ? (
          <TabelaErros erros={erros} />
        ) : (
          <>
            <p className="mt-4 text-sm text-mineral">{t.idiomaDoRegistro}</p>
            <div className="mt-4">
              <PortuguesApenas regiao="erros-registro"><TabelaErros erros={erros} /></PortuguesApenas>
            </div>
          </>
        )}
      </main>
      <Footer idioma={idioma} />
    </div>
  );
}
