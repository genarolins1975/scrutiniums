"use client";

import { useMemo } from "react";
import Link from "@/components/energia/LinkSemPrefetch";
import { Nome } from "@/components/i18n/Nome";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { leituraEmpresa, type EmpresaLeitura, type ContaLeitura } from "@/lib/energia/empresas-leitura";
import { formatos } from "@/lib/energia/formato";
import { SETOR_CVM_EN, traduzir } from "@/lib/energia/i18n/empresas-leiloes";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { useEstadoUrl } from "./useEstadoUrl";
import s from "./LeiturasIntegradas.module.css";

type Tx = <T>(pt: T, en: T) => T;

function contas(tx: Tx): { id: ContaLeitura; nome: string; tipo: string }[] {
  return [
    { id: "receita", nome: tx("Receita líquida", "Net revenue"), tipo: tx("DRE · exercício", "Income statement · fiscal year") },
    {
      id: "ebit",
      nome: tx("Resultado antes do financeiro e tributos", "Earnings before financial result and taxes (EBIT)"),
      tipo: tx("DRE · exercício; não é EBITDA", "Income statement · fiscal year; not EBITDA"),
    },
    { id: "lucro_liquido", nome: tx("Lucro ou prejuízo", "Net income or loss"), tipo: tx("DRE · exercício", "Income statement · fiscal year") },
    { id: "caixa_operacional", nome: tx("Caixa das operações", "Cash from operations"), tipo: tx("DFC · exercício", "Cash flow statement · fiscal year") },
    {
      id: "caixa_investimento",
      nome: tx("Caixa das atividades de investimento", "Cash from investing activities"),
      tipo: tx("DFC · exercício; não é CAPEX", "Cash flow statement · fiscal year; not CAPEX"),
    },
    { id: "divida_bruta", nome: tx("Empréstimos, financiamentos e debêntures", "Loans, financing and debentures"), tipo: tx("Balanço · fim do exercício", "Balance sheet · end of fiscal year") },
    { id: "caixa", nome: tx("Caixa e equivalentes", "Cash and cash equivalents"), tipo: tx("Balanço · fim do exercício", "Balance sheet · end of fiscal year") },
  ];
}

export function EmpresasLeitura({ empresas, periodoControle }: { empresas: EmpresaLeitura[]; periodoControle: string }) {
  const tx = useTx();
  const idioma = useIdioma();
  // <option> só aceita texto: na página inglesa, o nome da companhia é marcado no próprio elemento (como o <Nome> faz)
  const marcaNome = idioma === "en" ? { lang: "pt-BR", translate: "no" as const, "data-i18n-nome": "" } : {};
  const f = formatos(idioma);
  const n = (v: number | null, casas = 1) => (v === null ? tx("Sem dado", "No data") : f.num(v, casas));
  const CONTAS = contas(tx);
  const esquema = useMemo(() => ({
    empresa: campo(tiposUrl.opcao(empresas.map(e => e.cnpj)), empresas.find(e => e.cnpj === "01083200000118")?.cnpj ?? empresas[0]?.cnpj ?? ""),
    escopo: campo(tiposUrl.opcao(["con", "ind"] as const), "con"),
  }), [empresas]);
  const [v, definir] = useEstadoUrl(esquema);
  const e = empresas.find(x => x.cnpj === v.empresa);
  if (!e) return <p className={s.bridge}>{tx("Nenhuma companhia ativa disponível nesta publicação.", "No active company available in this release.")}</p>;
  const serie = e.series[v.escopo];
  const atual = serie.at(-1), anterior = serie.at(-2);
  const l = leituraEmpresa(atual, anterior);
  const fin = `/setor-eletrico/empresas/financas?fin.sel=${e.cnpj}&fin.esc=${v.escopo}`;
  return <section id="leitura-empresa" className={s.section} aria-labelledby="leitura-empresa-titulo">
    <h2 id="leitura-empresa-titulo" className={s.title}>{tx("Leia a empresa em três dimensões.", "Read the company in three dimensions.")}</h2>
    <div className={s.controls}>
      <label>{tx(`Companhia aberta · ${empresas.length} ativas na base`, `Publicly held company · ${empresas.length} active in the database`)}<select value={v.empresa} onChange={ev => definir({ empresa: ev.target.value })}>{empresas.map(x => <option key={x.cnpj} value={x.cnpj} {...marcaNome}>{x.nome}</option>)}</select></label>
      <label>{tx("Perímetro contábil", "Accounting perimeter")}<select value={v.escopo} onChange={ev => definir({ escopo: ev.target.value as "con" | "ind" })}><option value="con">{tx("Consolidado: companhia e controladas", "Consolidated: company and subsidiaries")}</option><option value="ind">{tx("Individual: somente a companhia", "Individual: the company only")}</option></select></label>
    </div>
    <p className={s.note}>{tx(
      `CNPJ ${e.cnpj} · Setor declarado à CVM: ${e.setor ?? "não informado"}. Valores nominais em R$ milhões. O filtro fica no endereço para compartilhar a mesma leitura. Empresas fechadas e outros agentes não estão integralmente cobertos.`,
      `CNPJ ${e.cnpj} · Sector declared to CVM: ${e.setor ? traduzir(SETOR_CVM_EN, e.setor, idioma) : "not reported"}. Nominal values in R$ million. The filter stays in the address so the same reading can be shared. Privately held companies and other agents are not fully covered.`,
    )}</p>
    <div className={s.grid}>
      <article className={s.topic}><p className={s.eyebrow}>{tx("01 · Propriedade e perímetro", "01 · Ownership and perimeter")}</p><h3>{tx("Quem está acima e abaixo?", "Who is above and below?")}</h3><dl>
        <div><dt>{tx("Controlador direto na cadeia declarada à ANEEL", "Direct controlling shareholder in the chain declared to ANEEL")}</dt><dd>{e.controladorDireto
          ? tx<React.ReactNode>(`${e.controladorDireto.nome ?? "Nome não informado"} · CNPJ ${e.controladorDireto.cnpj}`, <>{e.controladorDireto.nome ? <Nome>{e.controladorDireto.nome}</Nome> : "Name not reported"} · CNPJ {e.controladorDireto.cnpj}</>)
          : tx("Sem controlador direto identificável nesta cadeia. Isso não prova capital disperso ou ausência de controle.", "No identifiable direct controlling shareholder in this chain. This does not prove dispersed ownership or absence of control.")}</dd></div>
        <div><dt>{tx("Primeira controladora aberta acima na cadeia", "First publicly held parent above in the chain")}</dt><dd>{e.controladoraAberta?.nome ? <Nome>{e.controladoraAberta.nome}</Nome> : tx("Não identificada na base.", "Not identified in the database.")}</dd></div>
        <div><dt>{tx("Outras companhias abertas controladas", "Other publicly held companies controlled")}</dt><dd>{tx(
          `${e.controladasAbertas} na base. Somar suas demonstrações às da controladora pode contar o mesmo resultado duas vezes.`,
          `${e.controladasAbertas} in the database. Adding their statements to the parent's may count the same result twice.`,
        )}</dd></div>
      </dl><p className={s.note}>{tx(
        `Referência societária: ${periodoControle}. O vínculo societário e as finanças têm datas próprias. O grafo não identifica automaticamente beneficiários finais ou relações políticas.`,
        `Shareholding reference: ${periodoControle}. The shareholding link and the finances have their own dates. The graph does not automatically identify ultimate beneficial owners or political relationships.`,
      )}</p><Link className={s.link} href={`/setor-eletrico/empresas/controle?ctl.e=${e.cnpj}`}>{tx("Examinar a cadeia e seus limites →", "Examine the chain and its limits →")}</Link></article>
      <article className={s.topic}><p className={s.eyebrow}>{tx("02 · Resultado e caixa", "02 · Earnings and cash")}</p><h3>{tx("Lucro virou disponibilidade financeira?", "Did net income turn into available cash?")}</h3><p>{tx(
        "Compare o lucro com o caixa das operações e com as entradas ou saídas das atividades de investimento. Capital de giro, itens sem caixa e eventos não recorrentes podem separar as três medidas.",
        "Compare net income with cash from operations and with the inflows or outflows of investing activities. Working capital, non-cash items and non-recurring events can separate the three measures.",
      )}</p>
        {atual ? <dl><div><dt>{tx(`Exercício ${atual.ano} · ${v.escopo === "con" ? "consolidado" : "individual"}`, `Fiscal year ${atual.ano} · ${v.escopo === "con" ? "consolidated" : "individual"}`)}</dt><dd>{tx(
          `Lucro/prejuízo: R$ ${n(atual.valores.lucro_liquido)} milhões. Caixa operacional: R$ ${n(atual.valores.caixa_operacional)} milhões.`,
          `Net income/loss: R$ ${n(atual.valores.lucro_liquido)} million. Operating cash flow: R$ ${n(atual.valores.caixa_operacional)} million.`,
        )}</dd></div><div><dt>{tx("Operações + atividades de investimento", "Operations + investing activities")}</dt><dd>{l.caixaAposInvestimento === null ? tx("Sem as duas parcelas para calcular.", "Without both components to calculate.") : tx(`R$ ${n(l.caixaAposInvestimento)} milhões, antes das atividades de financiamento.`, `R$ ${n(l.caixaAposInvestimento)} million, before financing activities.`)} {tx("Essa soma não é fluxo de caixa livre padronizado.", "This sum is not a standardized free cash flow.")}</dd></div></dl> : <p className={s.bridge}>{tx(
          "Sem demonstração no perímetro selecionado. Experimente outro perímetro; valores individuais não substituem automaticamente os consolidados.",
          "No statement in the selected perimeter. Try another perimeter; individual values do not automatically replace consolidated ones.",
        )}</p>}
      </article>
    </div>
    {atual && <>
      <dl className={s.metrics}>
        <div><dt>{tx(`Receita · ${atual.ano}`, `Net revenue · ${atual.ano}`)}</dt><dd>R$ {n(atual.valores.receita)}</dd><small>{tx(
          `Milhões · ${l.variacaoReceita === null ? "Sem base positiva no ano imediatamente anterior para variação percentual." : `${n(l.variacaoReceita)}% em relação a ${atual.ano - 1}.`}`,
          `Million · ${l.variacaoReceita === null ? "No positive base in the immediately preceding year for a percentage change." : `${n(l.variacaoReceita)}% relative to ${atual.ano - 1}.`}`,
        )}</small></div>
        <div><dt>{tx(`Lucro / receita · ${atual.ano}`, `Net income / revenue · ${atual.ano}`)}</dt><dd>{l.margemLiquida === null ? tx("Não calculável", "Not calculable") : `${n(l.margemLiquida)}%`}</dd><small>{tx(
          "Margem líquida contábil. Receita de construção e participações afetam a comparação.",
          "Accounting net margin. Construction revenue and equity interests affect the comparison.",
        )}</small></div>
        <div><dt>{tx(`Variação do lucro · ${atual.ano} versus ${atual.ano - 1}`, `Change in net income · ${atual.ano} versus ${atual.ano - 1}`)}</dt><dd>{l.deltaLucro === null ? tx("Não calculável", "Not calculable") : `R$ ${n(l.deltaLucro)}`}</dd><small>{tx(
          "Milhões · diferença absoluta, inclusive quando há mudança entre lucro e prejuízo.",
          "Million · absolute difference, including when it switches between profit and loss.",
        )}</small></div>
      </dl>
      <div className={s.tableWrap} tabIndex={0} role="region" aria-label={tx("Série contábil com rolagem horizontal", "Accounting series with horizontal scrolling")}><table className={s.table}><caption>{tx(
        "Até seis exercícios disponíveis, mesmo CNPJ e mesmo perímetro · R$ milhões. Ausência permanece “Sem dado”. Setas ou cores não atribuem qualidade à gestão.",
        "Up to six available fiscal years, same CNPJ and same perimeter · R$ million. Missing values stay as “No data”. Arrows or colors do not attribute quality to management.",
      )}</caption><thead><tr><th scope="col">{tx("Conta", "Account")}</th>{serie.map(a => <th key={a.ano} scope="col">{a.ano}</th>)}</tr></thead><tbody>{CONTAS.map(c => <tr key={c.id}><th scope="row">{c.nome}<br /><small>{c.tipo}</small></th>{serie.map(a => <td key={a.ano}>{n(a.valores[c.id])}</td>)}</tr>)}</tbody></table></div>
      <p className={s.note}>{tx(
        "Lucro consolidado inclui a participação de não controladores. A receita pode incluir construção de infraestrutura de concessões. Caixa de investimento inclui aquisições, aplicações e resgates; não é uma medida isolada de obras ou CAPEX. Dívida e caixa são saldos de encerramento; as demais contas são fluxos do exercício.",
        "Consolidated net income includes non-controlling interests. Revenue may include construction of concession infrastructure. Investing cash flow includes acquisitions, financial investments and redemptions; it is not an isolated measure of works or CAPEX. Debt and cash are closing balances; the other accounts are flows for the fiscal year.",
      )}</p>
    </>}
    {(e.alerta.length > 0 || e.escala.length > 0) && <div className={s.bridge}>{tx(
      <><strong>Atenção à qualidade desta série.</strong> A base registra {e.alerta.length} aviso(s) sobre o último exercício e {e.escala.length} documento(s) com conversão de escala. Antes de comparar, <Link className={s.link} href={fin}>veja os avisos e as evidências da companhia →</Link></>,
      <><strong>Mind the quality of this series.</strong> The database records {e.alerta.length} {e.alerta.length === 1 ? "warning" : "warnings"} about the latest fiscal year and {e.escala.length} {e.escala.length === 1 ? "document" : "documents"} with a scale conversion. Before comparing, <Link className={s.link} href={fin}>see the company&apos;s warnings and evidence →</Link></>,
    )}</div>}
    <article className={s.topic}><p className={s.eyebrow}>{tx("03 · Ativos, investimentos e estratégia", "03 · Assets, investments and strategy")}</p><h3>{tx("Onde a empresa está alocando recursos?", "Where is the company allocating resources?")}</h3><p>{tx(
      "As demonstrações mostram os totais contábeis. Para identificar o negócio que gerou o resultado, use notas por segmento e releases; para localizar ativos, use o cadastro de usinas e concessões; para avaliar planos, separe investimento realizado, orçamento e anúncio.",
      "The statements show the accounting totals. To identify the business that generated the result, use segment notes and earnings releases; to locate assets, use the registry of plants and concessions; to assess plans, separate investment made, budget and announcement.",
    )}</p><div className={s.links}><Link className={s.link} href={fin}>{tx("Conferir séries e comparar empresas →", "Check series and compare companies →")}</Link><Link className={s.link} href="/setor-eletrico/empresas/ativos">{tx("Explorar ativos e grupos no mapa →", "Explore assets and groups on the map →")}</Link>{e.distribuidora && <Link className={s.link} href={`/setor-eletrico/empresas/${e.distribuidora}`}>{tx("Confrontar tarifas, perdas e qualidade →", "Compare tariffs, losses and quality →")}</Link>}</div><p className={s.note}>{tx(
      "Esta síntese não atribui variações financeiras a clima, decisões de gestão ou segmentos sem documentação. As duas leituras empresariais abaixo são exemplos com fontes próprias, não análises de todas as companhias selecionáveis.",
      "This summary does not attribute financial changes to weather, management decisions or segments without documentation. The two company readings below are examples with their own sources, not analyses of all selectable companies.",
    )}</p></article>
  </section>;
}
