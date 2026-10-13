import type { Metadata } from "next";
import Link from "@/components/energia/LinkSemPrefetch";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { EmpresasLeitura } from "@/components/energia/EmpresasLeitura";
import { EmpresasIndisponivel } from "@/components/energia/EmpresasPagina";
import { lerGold, integra } from "@/lib/energia/gold";
import { lerSerie } from "@/lib/energia/empresas-arquivos";
import { prepararEmpresas } from "@/lib/energia/empresas-leitura";
import type { EmpresasGold, SeriesFinanceiras, CadeiaSocietaria } from "@/lib/energia/tipos-empresas";
import copel from "../../../../../public/energia/estudos/copel-2025.json";
import { dataBR } from "@/lib/energia/formato";
import s from "@/components/energia/LeiturasIntegradas.module.css";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Empresas: controle, resultado, investimento e estratégia", alternates: { canonical: "/setor-eletrico/empresas/analise" } };
const n = (x: number) => x.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function AnaliseEmpresas() {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) return <EmpresasIndisponivel />;
  const series = lerSerie<SeriesFinanceiras>(g.series.financas);
  const cadeia = lerSerie<CadeiaSocietaria>(g.series.cadeia);
  const empresas = prepararEmpresas(g.financas.companhias, series?.series ?? {}, cadeia);
  return <><CabecalhoEnergia atual="empresas" /><main id="conteudo" tabIndex={-1} className="ed-pagina">
    <header className={s.section}><Link className={s.link} href="/setor-eletrico/empresas">← Empresas do setor</Link><p className={s.eyebrow}>Análise empresarial com dados públicos</p><h1 className={s.title}>Quem controla. Onde ganha. Onde investe.</h1><p className={s.intro}>Combine estrutura societária, resultado e caixa. Depois avance aos segmentos e aos planos declarados pela administração: cada dimensão responde a uma pergunta diferente.</p><p className={s.note}>DFP anual até {g.financas.periodos.ultimo_exercicio}; ITR até {dataBR(g.financas.periodos.ultimo_trimestre)} no comparador financeiro. Esta leitura usa exercícios completos. As datas societárias e dos estudos documentais são próprias.</p></header>
    <EmpresasLeitura empresas={empresas} periodoControle={g.datas.polimero_referencia ?? "não informada"} />
    <section id="estudos-empresas" className={s.section} aria-labelledby="estudos-empresas-titulo"><p className={s.eyebrow}>Do agregado ao segmento · estudo documental</p><h2 id="estudos-empresas-titulo" className={s.title}>Copel: resultado e investimento por negócio.</h2><p className={s.intro}>Exercício de 2025, conforme reportado pela companhia. EBITDA e investimento respondem a perguntas diferentes.</p><div className={s.grid}>
      <div><h3>Onde investiu? · R$ milhões</h3>{copel.investimentos.map(x => <div key={x.segmento} className={s.barRow}><span>{x.segmento}</span><div className={s.barTrack} aria-hidden="true"><span className={s.bar} style={{ width: `${100 * x["2025"] / 3000}%` }} /></div><span>{n(x["2025"])}</span></div>)}<p className={s.note}>Barras partem de zero; escala comum de 0 a R$ 3.000 milhões. Total: R$ {n(copel.total_investimentos["2025"])} milhões. Distribuição: {n(100 * 2959 / copel.total_investimentos["2025"])}% do total.</p></div>
      <div className={s.tableWrap} tabIndex={0} role="region" aria-label="EBITDA por segmento da Copel"><table className={s.table}><caption>EBITDA reportado de 2025 · R$ milhões</caption><thead><tr><th scope="col">Segmento</th><th scope="col">EBITDA</th></tr></thead><tbody>{copel.ebitda_2025.map(x => <tr key={x.segmento}><th scope="row">{x.segmento}</th><td>{n(x.valor)}</td></tr>)}<tr><th scope="row">Total</th><td>{n(copel.total_ebitda_2025)}</td></tr></tbody></table></div>
    </div><p className={s.note}>{copel.limites} Não se infere retorno do investimento dividindo EBITDA pelo desembolso do mesmo ano.</p><div className={s.sources}><a href={copel.url}>Fonte: Formulário de Referência 2026, itens 2.1 e 2.5 →</a><p>Consulta: {dataBR(copel.consultado_em)}. Transcrição dos investimentos e conversão do EBITDA de R$ mil para milhões. Totais conciliados antes do arredondamento.</p><a className={s.link} href="/energia/estudos/copel-2025.json" download>Baixar valores e referência em JSON</a></div></section>
    <section className={s.section}><p className={s.eyebrow}>Estratégia declarada · leitura documental</p><h2 className={s.title}>Equatorial: o plano anunciado e o que verificar.</h2><div className={s.grid}><article className={s.panel}><h3>O que a empresa declara</h3><p>O RI descreve crescimento por aquisições de controle, consolidação em distribuição e diversificação para transmissão, geração e saneamento. São declarações da administração; a página não informa a data de atualização.</p><a className={s.link} href="https://ri.equatorialenergia.com.br/a-companhia/estrategia-e-vantagens-competitivas/">Ler a declaração no RI · consulta em 13/10/2026 →</a></article><article className={s.panel}><h3>Como acompanhar</h3><p>Confronte mudanças na cadeia societária, aquisições concluídas e endividamento. Nas distribuidoras, acompanhe perdas e continuidade. O consolidado pode incluir outros setores: seu resultado não é uma medida exclusiva do negócio de energia.</p><Link className={s.link} href="/setor-eletrico/empresas/analise?empresa=03220438000173#leitura-empresa">Abrir a leitura da Equatorial →</Link></article></div></section>
    <section className={s.section}><h2 className={s.title}>O que falta para uma conclusão empresarial?</h2><p className={s.intro}>Notas por segmento, dívida por vencimento, garantias, contratos, eventos não recorrentes e a localização dos ativos completam a análise. Lucro não prova boa qualidade do serviço; uma rede de participações não prova favorecimento.</p><div className={s.links}><Link className={s.link} href="/setor-eletrico/transicao/riscos">Conectar ativos a riscos climáticos e de mercado →</Link><Link className={s.link} href="/setor-eletrico/empresas/controle">Controle e concentração, com cobertura →</Link></div><div className={s.sources}><p>Séries reutilizadas: <a href={g.series.financas}>demonstrações anuais e trimestrais</a> e <a href={g.series.cadeia}>cadeia societária declarada</a>. Fonte financeira: <a href="https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp">CVM — DFP</a>. Margem = lucro / receita positiva; variação anual exige anos consecutivos e base positiva. Alterações de perímetro e escala precisam ser avaliadas antes de comparar.</p></div></section>
  </main></>;
}
