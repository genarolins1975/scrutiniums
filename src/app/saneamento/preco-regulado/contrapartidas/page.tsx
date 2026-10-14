import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Fonte, Nota, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { SubnavPreco } from "@/components/saneamento/PrecoRegulado";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { ROTA } from "@/lib/saneamento/capitulos";
import { ESTUDOS } from "@/lib/saneamento/dados/estudos";
import { TARIFAS } from "@/lib/saneamento/tarifas";
import { calcularConta } from "@/lib/saneamento/conta";
import { prestador } from "@/lib/saneamento/gold";
import { inteiro, numero, reais, reaisCompacto } from "@/lib/saneamento/formato";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "O preço autorizado está associado a melhor serviço?",
  description: "Premissas das decisões tarifárias, obrigações, resultados observados e providências do regulador; preço e indicadores de serviço lado a lado, sem nota composta.",
  alternates: { canonical: `${ROTA}/preco-regulado/contrapartidas` },
};

export default function Pagina() {
  const porPrestador = [...new Set(TARIFAS.map((t) => t.prestadorSinisa))].map((pid) => {
    const ts = TARIFAS.filter((t) => t.prestadorSinisa === pid);
    const p = prestador(pid);
    return { pid, ts, p };
  });
  return (
    <>
      <Cabecalho atual="preco-regulado/contrapartidas" />
      <MarcaVisita secao="saneamento:preco-contrapartidas" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={5}
          rotuloExtra="5.4"
          titulo="O preço autorizado está associado a melhor serviço?"
          texto={
            <p>
              Uma decisão tarifária parte de premissas: investimentos, metas de cobertura, perdas e qualidade. A pergunta é o que foi assumido, o
              que foi entregue, como se verificou e o que o regulador fez. O painel mostra essas relações apenas quando documentadas e coloca preço e
              serviço lado a lado, sem somá-los numa nota.
            </p>
          }
          recorte={<>Os dois estudos de caso (ARSESP e AGEPAR) e os cinco prestadores com tabela verificada; indicadores de serviço do SINISA 2024.</>}
          situacao="parcial"
          pendencia="Aferições anuais das metas contratuais pelos reguladores não foram localizadas para 2026; o resultado observado usa o SINISA 2024, anterior aos ciclos em análise."
        />
        <SubnavPreco atual="contrapartidas" />

        {ESTUDOS.map((e) => (
          <Secao key={e.id} id={`matriz-${e.id}`} titulo={`${e.regulador} e ${e.prestador.split(" (")[0]}: da premissa à providência`}>
            <div className="tabela-scroll" tabIndex={0} role="region" aria-label={`Matriz de contrapartidas, ${e.regulador} (rolável)`}>
              <table className="w-full min-w-[60rem] border-collapse text-sm">
                <caption className="sr-only">Premissa da decisão, obrigação, resultado observado e providência regulatória</caption>
                <thead>
                  <tr className="border-b border-carvao text-left">
                    <th scope="col" className="w-1/4 py-2 pr-4 font-medium">Premissa da decisão</th>
                    <th scope="col" className="w-1/4 py-2 pr-4 font-medium">Obrigação</th>
                    <th scope="col" className="w-1/4 py-2 pr-4 font-medium">Resultado observado</th>
                    <th scope="col" className="w-1/4 py-2 font-medium">Providência regulatória</th>
                  </tr>
                </thead>
                <tbody>
                  {e.obrigacoes.map((o) => (
                    <tr key={o.premissa} className="border-b border-linha align-top">
                      <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">
                        {o.premissa}
                        <span className="block text-xs text-carvao-muted">{o.fonte}</span>
                      </th>
                      <td className="py-2 pr-4 text-carvao">{o.obrigacao}</td>
                      <td className="py-2 pr-4 text-carvao">{o.resultado}</td>
                      <td className="py-2 text-carvao">{o.providencia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Secao>
        ))}

        <Secao
          id="lado-a-lado"
          titulo="Preço e serviço lado a lado"
          texto="Conta residencial de 10 m³ (tabelas vigentes em 2026) ao lado do que cada prestador declarou ao SINISA para 2024, somado nos municípios em que atua. Períodos diferentes, de propósito visíveis."
        >
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Preço e indicadores de serviço por prestador (rolável)">
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <caption className="sr-only">Conta simulada e indicadores declarados por prestador</caption>
              <thead>
                <tr className="border-b border-carvao text-left">
                  <th scope="col" className="py-2 pr-4 font-medium">Prestador</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Conta de 10 m³ (2026)</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Municípios com água (2024)</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Pessoas atendidas com água</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Perdas na distribuição</th>
                  <th scope="col" className="py-2 text-right font-medium">Investimento em água e esgoto</th>
                </tr>
              </thead>
              <tbody>
                {porPrestador.map(({ pid, ts, p }) => (
                  <tr key={pid} className="border-b border-linha align-top">
                    <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">
                      {p ? (
                        <Link href={`${ROTA}/prestadores/${pid}`} className="underline decoration-linha underline-offset-4 hover:decoration-obee">
                          {p.sigla ?? p.nome}
                        </Link>
                      ) : (
                        pid
                      )}
                      <span className="block text-xs text-carvao-muted">{ts.map((t) => t.regulador)[0]}</span>
                    </th>
                    <td className="py-2 pr-4 text-right tabular-nums text-carvao">
                      {ts.map((t) => (
                        <span key={t.id} className="block">
                          {reais(calcularConta(t.categorias.residencial, 10).total)}
                          {ts.length > 1 && <span className="text-xs text-carvao-muted"> {t.id.endsWith("curitiba") ? "Curitiba" : "demais"}</span>}
                        </span>
                      ))}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-carvao">{inteiro(p?.municipios_agua.length)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-carvao">{inteiro(p?.populacao_atendida_agua)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-carvao">{p?.perdas_distribuicao_pct == null ? "sem dado" : `${numero(p.perdas_distribuicao_pct, 1)}%`}</td>
                    <td className="py-2 text-right tabular-nums text-carvao">
                      {reaisCompacto((p?.investimento_agua ?? 0) + (p?.investimento_esgoto ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Ressalva
            permite="Ver, para os mesmos prestadores, o preço vigente e a escala, as perdas e o investimento declarados, cada um com sua fonte e seu ano."
            naoPermite="Dizer que tarifa alta prova ineficiência ou que tarifa baixa prova bom atendimento. Contextos de mananciais, densidade, renda e escopo de serviço diferem; a tabela não tem nota composta nem ordem de mérito."
          />
          <Nota>
            Perdas: fórmula oficial do IAG2013 aplicada às somas de volumes declarados pelo prestador em todos os municípios em que atua, calculada pelo
            Observatório. Investimento: prestador e Estado, reais correntes de 2024. A ficha de cada prestador traz os componentes e o perímetro.
          </Nota>
          <Fonte>Tabelas verificadas (5.1); Ministério das Cidades, SINISA 2025 (ano de referência 2024), planilhas por prestador e município.</Fonte>
        </Secao>
      </main>
    </>
  );
}
