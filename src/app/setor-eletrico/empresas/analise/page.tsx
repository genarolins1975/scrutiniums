import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/energia/LinkSemPrefetch";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { EmpresasLeitura } from "@/components/energia/EmpresasLeitura";
import { EmpresasIndisponivel } from "@/components/energia/EmpresasPagina";
import { lerGold, integra } from "@/lib/energia/gold";
import { lerSerie } from "@/lib/energia/empresas-arquivos";
import { prepararEmpresas } from "@/lib/energia/empresas-leitura";
import type { EmpresasGold, SeriesFinanceiras, CadeiaSocietaria } from "@/lib/energia/tipos-empresas";
import copel from "../../../../../public/energia/estudos/copel-2025.json";
import { dataBR, num } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { ESTUDO_COPEL_EN, temTraducao, traduzir } from "@/lib/energia/i18n/empresas-leiloes";
import s from "@/components/energia/LeiturasIntegradas.module.css";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia(
    "/setor-eletrico/empresas/analise",
    { title: tx("Empresas: controle, resultado, investimento e estratégia", "Companies: control, earnings, investment and strategy"), alternates: { canonical: "/setor-eletrico/empresas/analise" } },
    anterior,
  );
}
const n = (x: number) => num(x, 1);
/** Segmento do estudo da Copel no idioma da página (a gold do estudo é só em português). */
const segmento = (x: string) => traduzir(ESTUDO_COPEL_EN, x);

export default function AnaliseEmpresas() {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) return <EmpresasIndisponivel />;
  const series = lerSerie<SeriesFinanceiras>(g.series.financas);
  const cadeia = lerSerie<CadeiaSocietaria>(g.series.cadeia);
  const empresas = prepararEmpresas(g.financas.companhias, series?.series ?? {}, cadeia);
  const limites = temTraducao(ESTUDO_COPEL_EN, copel.limites) ? traduzir(ESTUDO_COPEL_EN, copel.limites) : <TrechoPortugues regiao="copel-limites">{copel.limites}</TrechoPortugues>;
  return <><CabecalhoEnergia atual="empresas" /><main id="conteudo" tabIndex={-1} className="ed-pagina">
    <header className={s.section}><Link className={s.link} href="/setor-eletrico/empresas">{tx("← Empresas do setor", "← Companies in the sector")}</Link><p className={s.eyebrow}>{tx("Análise empresarial com dados públicos", "Company analysis with public data")}</p><h1 className={s.title}>{tx("Quem controla. Onde ganha. Onde investe.", "Who controls. Where it earns. Where it invests.")}</h1><p className={s.intro}>{tx(
      "Combine estrutura societária, resultado e caixa. Depois avance aos segmentos e aos planos declarados pela administração: cada dimensão responde a uma pergunta diferente.",
      "Combine shareholding structure, earnings and cash. Then move on to the segments and the plans declared by management: each dimension answers a different question.",
    )}</p><p className={s.note}>{tx(
      <>DFP anual até {g.financas.periodos.ultimo_exercicio}; ITR até {dataBR(g.financas.periodos.ultimo_trimestre)} no comparador financeiro. Esta leitura usa exercícios completos. As datas societárias e dos estudos documentais são próprias.</>,
      <>Annual DFP up to {g.financas.periodos.ultimo_exercicio}; ITR up to {dataBR(g.financas.periodos.ultimo_trimestre)} in the financial comparator. This reading uses complete fiscal years. The shareholding dates and those of the documentary studies are their own.</>,
    )}</p></header>
    <EmpresasLeitura empresas={empresas} periodoControle={g.datas.polimero_referencia ?? tx("não informada", "not reported")} />
    <section id="estudos-empresas" className={s.section} aria-labelledby="estudos-empresas-titulo"><p className={s.eyebrow}>{tx("Do agregado ao segmento · estudo documental", "From the aggregate to the segment · documentary study")}</p><h2 id="estudos-empresas-titulo" className={s.title}>{tx("Copel: resultado e investimento por negócio.", "Copel: earnings and investment by business.")}</h2><p className={s.intro}>{tx(
      "Exercício de 2025, conforme reportado pela companhia. EBITDA e investimento respondem a perguntas diferentes.",
      "Fiscal year 2025, as reported by the company. EBITDA and investment answer different questions.",
    )}</p><div className={s.grid}>
      <div><h3>{tx("Onde investiu? · R$ milhões", "Where did it invest? · R$ million")}</h3>{copel.investimentos.map(x => <div key={x.segmento} className={s.barRow}><span>{segmento(x.segmento)}</span><div className={s.barTrack} aria-hidden="true"><span className={s.bar} style={{ width: `${100 * x["2025"] / 3000}%` }} /></div><span>{n(x["2025"])}</span></div>)}<p className={s.note}>{tx(
        `Barras partem de zero; escala comum de 0 a R$ 3.000 milhões. Total: R$ ${n(copel.total_investimentos["2025"])} milhões. Distribuição: ${n(100 * 2959 / copel.total_investimentos["2025"])}% do total.`,
        `Bars start at zero; common scale from 0 to R$ 3,000 million. Total: R$ ${n(copel.total_investimentos["2025"])} million. Distribution: ${n(100 * 2959 / copel.total_investimentos["2025"])}% of the total.`,
      )}</p></div>
      <div className={s.tableWrap} tabIndex={0} role="region" aria-label={tx("EBITDA por segmento da Copel", "Copel EBITDA by segment")}><table className={s.table}><caption>{tx("EBITDA reportado de 2025 · R$ milhões", "Reported EBITDA for 2025 · R$ million")}</caption><thead><tr><th scope="col">{tx("Segmento", "Segment")}</th><th scope="col">EBITDA</th></tr></thead><tbody>{copel.ebitda_2025.map(x => <tr key={x.segmento}><th scope="row">{segmento(x.segmento)}</th><td>{n(x.valor)}</td></tr>)}<tr><th scope="row">{tx("Total", "Total")}</th><td>{n(copel.total_ebitda_2025)}</td></tr></tbody></table></div>
    </div><p className={s.note}>{limites} {tx("Não se infere retorno do investimento dividindo EBITDA pelo desembolso do mesmo ano.", "Return on investment cannot be inferred by dividing EBITDA by the same year's spending.")}</p><div className={s.sources}><a href={copel.url}>{tx("Fonte: Formulário de Referência 2026, itens 2.1 e 2.5 →", "Source: 2026 Reference Form (Formulário de Referência), items 2.1 and 2.5 →")}</a><p>{tx(
      `Consulta: ${dataBR(copel.consultado_em)}. Transcrição dos investimentos e conversão do EBITDA de R$ mil para milhões. Totais conciliados antes do arredondamento.`,
      `Consulted on: ${dataBR(copel.consultado_em)}. Transcription of the investments and conversion of EBITDA from R$ thousand to million. Totals reconciled before rounding.`,
    )}</p><a className={s.link} href="/energia/estudos/copel-2025.json" download>{tx("Baixar valores e referência em JSON", "Download values and reference as JSON")}</a></div></section>
    <section className={s.section}><p className={s.eyebrow}>{tx("Estratégia declarada · leitura documental", "Declared strategy · documentary reading")}</p><h2 className={s.title}>{tx("Equatorial: o plano anunciado e o que verificar.", "Equatorial: the announced plan and what to check.")}</h2><div className={s.grid}><article className={s.panel}><h3>{tx("O que a empresa declara", "What the company declares")}</h3><p>{tx(
      "O RI descreve crescimento por aquisições de controle, consolidação em distribuição e diversificação para transmissão, geração e saneamento. São declarações da administração; a página não informa a data de atualização.",
      "The investor relations site describes growth through control acquisitions, consolidation in distribution and diversification into transmission, generation and sanitation. These are management statements; the page does not state its update date.",
    )}</p><a className={s.link} href="https://ri.equatorialenergia.com.br/a-companhia/estrategia-e-vantagens-competitivas/">{tx("Ler a declaração no RI · consulta em 13/10/2026 →", "Read the statement on the investor relations site · consulted on Oct 13, 2026 →")}</a></article><article className={s.panel}><h3>{tx("Como acompanhar", "How to follow up")}</h3><p>{tx(
      "Confronte mudanças na cadeia societária, aquisições concluídas e endividamento. Nas distribuidoras, acompanhe perdas e continuidade. O consolidado pode incluir outros setores: seu resultado não é uma medida exclusiva do negócio de energia.",
      "Compare changes in the shareholding chain, completed acquisitions and indebtedness. In the distribution utilities, follow losses and continuity of supply. The consolidated figures may include other sectors: their result is not a measure exclusive to the energy business.",
    )}</p><Link className={s.link} href="/setor-eletrico/empresas/analise?empresa=03220438000173#leitura-empresa">{tx(<>Abrir a leitura da Equatorial →</>, <>Open the reading of <Nome>Equatorial</Nome> →</>)}</Link></article></div></section>
    <section className={s.section}><h2 className={s.title}>{tx("O que falta para uma conclusão empresarial?", "What is missing for a conclusion about a company?")}</h2><p className={s.intro}>{tx(
      "Notas por segmento, dívida por vencimento, garantias, contratos, eventos não recorrentes e a localização dos ativos completam a análise. Lucro não prova boa qualidade do serviço; uma rede de participações não prova favorecimento.",
      "Segment notes, debt by maturity, guarantees, contracts, non-recurring events and the location of the assets complete the analysis. Net income does not prove good quality of service; a network of shareholdings does not prove favoritism.",
    )}</p><div className={s.links}><Link className={s.link} href="/setor-eletrico/transicao/riscos">{tx("Conectar ativos a riscos climáticos e de mercado →", "Connect assets to climate and market risks →")}</Link><Link className={s.link} href="/setor-eletrico/empresas/controle">{tx("Controle e concentração, com cobertura →", "Control and concentration, with coverage →")}</Link></div><div className={s.sources}><p>{tx(
      <>Séries reutilizadas: <a href={g.series.financas}>demonstrações anuais e trimestrais</a> e <a href={g.series.cadeia}>cadeia societária declarada</a>. Fonte financeira: <a href="https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp">CVM — DFP</a>. Margem = lucro / receita positiva; variação anual exige anos consecutivos e base positiva. Alterações de perímetro e escala precisam ser avaliadas antes de comparar.</>,
      <>Reused series: <a href={g.series.financas}>annual and quarterly financial statements</a> and <a href={g.series.cadeia}>declared shareholding chain</a>. Financial source: <a href="https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp">CVM, DFP</a>. Margin = net income / positive revenue; the annual change requires consecutive years and a positive base. Changes in perimeter and scale need to be assessed before comparing.</>,
    )}</p></div></section>
  </main></>;
}
