"use client";

import { useMemo } from "react";
import { formatadorNumero } from "@/lib/format";
import type { Idioma } from "@/lib/idioma";
import Link from "@/components/energia/LinkSemPrefetch";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { leituraEmpresa, type EmpresaLeitura, type ContaLeitura } from "@/lib/energia/empresas-leitura";
import { useEstadoUrl } from "./useEstadoUrl";
import s from "./LeiturasIntegradas.module.css";

const CONTAS: { id: ContaLeitura; nome: string; tipo: string }[] = [
  { id: "receita", nome: "Receita líquida", tipo: "DRE · exercício" },
  { id: "ebit", nome: "Resultado antes do financeiro e tributos", tipo: "DRE · exercício; não é EBITDA" },
  { id: "lucro_liquido", nome: "Lucro ou prejuízo", tipo: "DRE · exercício" },
  { id: "caixa_operacional", nome: "Caixa das operações", tipo: "DFC · exercício" },
  { id: "caixa_investimento", nome: "Caixa das atividades de investimento", tipo: "DFC · exercício; não é CAPEX" },
  { id: "divida_bruta", nome: "Empréstimos, financiamentos e debêntures", tipo: "Balanço · fim do exercício" },
  { id: "caixa", nome: "Caixa e equivalentes", tipo: "Balanço · fim do exercício" },
];

export function EmpresasLeitura({ empresas, periodoControle, idioma = "pt" }: { empresas: EmpresaLeitura[]; periodoControle: string; idioma?: Idioma }) {
  const n = (v: number | null, casas = 1) => v === null ? "Sem dado" : formatadorNumero(idioma, { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v);
  const esquema = useMemo(() => ({
    empresa: campo(tiposUrl.opcao(empresas.map(e => e.cnpj)), empresas.find(e => e.cnpj === "01083200000118")?.cnpj ?? empresas[0]?.cnpj ?? ""),
    escopo: campo(tiposUrl.opcao(["con", "ind"] as const), "con"),
  }), [empresas]);
  const [v, definir] = useEstadoUrl(esquema);
  const e = empresas.find(x => x.cnpj === v.empresa);
  if (!e) return <p className={s.bridge}>Nenhuma companhia ativa disponível nesta publicação.</p>;
  const serie = e.series[v.escopo];
  const atual = serie.at(-1), anterior = serie.at(-2);
  const l = leituraEmpresa(atual, anterior);
  const fin = `/setor-eletrico/empresas/financas?fin.sel=${e.cnpj}&fin.esc=${v.escopo}`;
  return <section id="leitura-empresa" className={s.section} aria-labelledby="leitura-empresa-titulo">
    <h2 id="leitura-empresa-titulo" className={s.title}>Leia a empresa em três dimensões.</h2>
    <div className={s.controls}>
      <label>Companhia aberta · {empresas.length} ativas na base<select value={v.empresa} onChange={ev => definir({ empresa: ev.target.value })}>{empresas.map(x => <option key={x.cnpj} value={x.cnpj}>{x.nome}</option>)}</select></label>
      <label>Perímetro contábil<select value={v.escopo} onChange={ev => definir({ escopo: ev.target.value as "con" | "ind" })}><option value="con">Consolidado: companhia e controladas</option><option value="ind">Individual: somente a companhia</option></select></label>
    </div>
    <p className={s.note}>CNPJ {e.cnpj} · Setor declarado à CVM: {e.setor ?? "não informado"}. Valores nominais em R$ milhões. O filtro fica no endereço para compartilhar a mesma leitura. Empresas fechadas e outros agentes não estão integralmente cobertos.</p>
    <div className={s.grid}>
      <article className={s.topic}><p className={s.eyebrow}>01 · Propriedade e perímetro</p><h3>Quem está acima e abaixo?</h3><dl>
        <div><dt>Controlador direto na cadeia declarada à ANEEL</dt><dd>{e.controladorDireto ? `${e.controladorDireto.nome ?? "Nome não informado"} · CNPJ ${e.controladorDireto.cnpj}` : "Sem controlador direto identificável nesta cadeia. Isso não prova capital disperso ou ausência de controle."}</dd></div>
        <div><dt>Primeira controladora aberta acima na cadeia</dt><dd>{e.controladoraAberta?.nome ?? "Não identificada na base."}</dd></div>
        <div><dt>Outras companhias abertas controladas</dt><dd>{e.controladasAbertas} na base. Somar suas demonstrações às da controladora pode contar o mesmo resultado duas vezes.</dd></div>
      </dl><p className={s.note}>Referência societária: {periodoControle}. O vínculo societário e as finanças têm datas próprias. O grafo não identifica automaticamente beneficiários finais ou relações políticas.</p><Link className={s.link} href={`/setor-eletrico/empresas/controle?ctl.e=${e.cnpj}`}>Examinar a cadeia e seus limites →</Link></article>
      <article className={s.topic}><p className={s.eyebrow}>02 · Resultado e caixa</p><h3>Lucro virou disponibilidade financeira?</h3><p>Compare o lucro com o caixa das operações e com as entradas ou saídas das atividades de investimento. Capital de giro, itens sem caixa e eventos não recorrentes podem separar as três medidas.</p>
        {atual ? <dl><div><dt>Exercício {atual.ano} · {v.escopo === "con" ? "consolidado" : "individual"}</dt><dd>Lucro/prejuízo: R$ {n(atual.valores.lucro_liquido)} milhões. Caixa operacional: R$ {n(atual.valores.caixa_operacional)} milhões.</dd></div><div><dt>Operações + atividades de investimento</dt><dd>{l.caixaAposInvestimento === null ? "Sem as duas parcelas para calcular." : `R$ ${n(l.caixaAposInvestimento)} milhões, antes das atividades de financiamento.`} Essa soma não é fluxo de caixa livre padronizado.</dd></div></dl> : <p className={s.bridge}>Sem demonstração no perímetro selecionado. Experimente outro perímetro; valores individuais não substituem automaticamente os consolidados.</p>}
      </article>
    </div>
    {atual && <>
      <dl className={s.metrics}>
        <div><dt>Receita · {atual.ano}</dt><dd>R$ {n(atual.valores.receita)}</dd><small>Milhões · {l.variacaoReceita === null ? "Sem base positiva no ano imediatamente anterior para variação percentual." : `${n(l.variacaoReceita)}% em relação a ${atual.ano - 1}.`}</small></div>
        <div><dt>Lucro / receita · {atual.ano}</dt><dd>{l.margemLiquida === null ? "Não calculável" : `${n(l.margemLiquida)}%`}</dd><small>Margem líquida contábil. Receita de construção e participações afetam a comparação.</small></div>
        <div><dt>Variação do lucro · {atual.ano} versus {atual.ano - 1}</dt><dd>{l.deltaLucro === null ? "Não calculável" : `R$ ${n(l.deltaLucro)}`}</dd><small>Milhões · diferença absoluta, inclusive quando há mudança entre lucro e prejuízo.</small></div>
      </dl>
      <div className={s.tableWrap} tabIndex={0} role="region" aria-label="Série contábil com rolagem horizontal"><table className={s.table}><caption>Até seis exercícios disponíveis, mesmo CNPJ e mesmo perímetro · R$ milhões. Ausência permanece “Sem dado”. Setas ou cores não atribuem qualidade à gestão.</caption><thead><tr><th scope="col">Conta</th>{serie.map(a => <th key={a.ano} scope="col">{a.ano}</th>)}</tr></thead><tbody>{CONTAS.map(c => <tr key={c.id}><th scope="row">{c.nome}<br /><small>{c.tipo}</small></th>{serie.map(a => <td key={a.ano}>{n(a.valores[c.id])}</td>)}</tr>)}</tbody></table></div>
      <p className={s.note}>Lucro consolidado inclui a participação de não controladores. A receita pode incluir construção de infraestrutura de concessões. Caixa de investimento inclui aquisições, aplicações e resgates; não é uma medida isolada de obras ou CAPEX. Dívida e caixa são saldos de encerramento; as demais contas são fluxos do exercício.</p>
    </>}
    {(e.alerta.length > 0 || e.escala.length > 0) && <div className={s.bridge}><strong>Atenção à qualidade desta série.</strong> A base registra {e.alerta.length} aviso(s) sobre o último exercício e {e.escala.length} documento(s) com conversão de escala. Antes de comparar, <Link className={s.link} href={fin}>veja os avisos e as evidências da companhia →</Link></div>}
    <article className={s.topic}><p className={s.eyebrow}>03 · Ativos, investimentos e estratégia</p><h3>Onde a empresa está alocando recursos?</h3><p>As demonstrações mostram os totais contábeis. Para identificar o negócio que gerou o resultado, use notas por segmento e releases; para localizar ativos, use o cadastro de usinas e concessões; para avaliar planos, separe investimento realizado, orçamento e anúncio.</p><div className={s.links}><Link className={s.link} href={fin}>Conferir séries e comparar empresas →</Link><Link className={s.link} href="/setor-eletrico/empresas/ativos">Explorar ativos e grupos no mapa →</Link>{e.distribuidora && <Link className={s.link} href={`/setor-eletrico/empresas/${e.distribuidora}`}>Confrontar tarifas, perdas e qualidade →</Link>}</div><p className={s.note}>Esta síntese não atribui variações financeiras a clima, decisões de gestão ou segmentos sem documentação. As duas leituras empresariais abaixo são exemplos com fontes próprias, não análises de todas as companhias selecionáveis.</p></article>
  </section>;
}
