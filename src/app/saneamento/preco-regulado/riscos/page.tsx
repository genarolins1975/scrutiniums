import type { Metadata } from "next";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { Abertura, Fonte, Nota, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { SubnavPreco } from "@/components/saneamento/PrecoRegulado";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { ROTA } from "@/lib/saneamento/capitulos";
import { ESTUDOS } from "@/lib/saneamento/dados/estudos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Quem assume os riscos e quem paga pelos desvios?",
  description: "Repartição documentada de riscos de demanda, inadimplência, energia, obras e eventos extraordinários nos casos Sabesp (ARSESP) e Sanepar (AGEPAR).",
  alternates: { canonical: `${ROTA}/preco-regulado/riscos` },
};

export default function Pagina() {
  return (
    <>
      <header>
        <CabecalhoPlataforma colecao="saneamento" destinoConta="/saneamento" />
        <NavegacaoColecao colecao="saneamento" />
      </header>
      <MarcaVisita secao="saneamento:preco-riscos" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={5}
          rotuloExtra="5.5"
          titulo="Quem assume os riscos e quem paga pelos desvios?"
          texto={
            <p>
              Menos consumo, mais inadimplência, energia mais cara, obra atrasada: cada contrato ou norma diz quem arca com o desvio e por qual
              mecanismo. O painel transcreve o que os documentos dizem, sem deduzir repasse que eles não preveem, e separa pleito, decisão e efeito.
            </p>
          }
          recorte={<>Contrato de Concessão 01/2024 da Sabesp e notas técnicas da ARSESP; Nota Técnica 006/2025 e resoluções da AGEPAR para a Sanepar.</>}
          situacao="parcial"
          pendencia="Cenários de sensibilidade não são exibidos: os parâmetros públicos não permitem reproduzi-los com segurança. Outros contratos da amostra ainda não foram lidos."
        />
        <SubnavPreco atual="riscos" />
        {ESTUDOS.map((e) => (
          <Secao key={e.id} id={`riscos-${e.id}`} titulo={`${e.regulador} e ${e.prestador.split(" (")[0]}`} texto={e.modelo}>
            <div className="tabela-scroll" tabIndex={0} role="region" aria-label={`Matriz de riscos, ${e.regulador} (rolável)`}>
              <table className="w-full min-w-[52rem] border-collapse text-sm">
                <caption className="sr-only">Evento, quem suporta segundo o documento, mecanismo e fonte</caption>
                <thead>
                  <tr className="border-b border-carvao text-left">
                    <th scope="col" className="py-2 pr-4 font-medium">Evento</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Quem suporta, segundo o documento</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Mecanismo</th>
                    <th scope="col" className="py-2 font-medium">Fonte</th>
                  </tr>
                </thead>
                <tbody>
                  {e.riscos.map((r) => (
                    <tr key={r.evento} className="border-b border-linha align-top">
                      <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">{r.evento}</th>
                      <td className="py-2 pr-4 font-medium text-carvao">{r.quem}</td>
                      <td className="py-2 pr-4 text-carvao">{r.como}</td>
                      <td className="py-2 text-xs text-carvao-muted">{r.fonte}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Secao>
        ))}
        <Ressalva
          permite="Saber como cada documento reparte riscos e por qual mecanismo um desvio chega, ou não, à tarifa."
          naoPermite="Prever o próximo reajuste ou tratar um pleito como decisão: pedido, decisão e implementação são etapas diferentes, e reconhecimentos provisórios podem ser revistos."
        />
        <Nota titulo="Referência nacional">
          A NR ANA 5/2024 dispõe sobre a matriz de riscos de contratos de água e esgoto. A comparação com cada contrato exige a leitura das cláusulas
          e da comprovação de adesão do regulador, ainda não feita nesta entrega.
        </Nota>
        <Fonte>Documentos e localizadores em cada linha; originais com sha256 no subpainel 5.2.</Fonte>
      </main>
    </>
  );
}
