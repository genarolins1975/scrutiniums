"use client";

import Link from "@/components/energia/LinkSemPrefetch";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { BLOCOS_COMERCIAIS, liquidacaoDidatica } from "@/lib/energia/leitura-integrada";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";
import { useEstadoUrl } from "./useEstadoUrl";
import s from "./LeiturasIntegradas.module.css";

const local = (idioma: Idioma) => (idioma === "en" ? "en-US" : "pt-BR");
const reaisEm = (idioma: Idioma) => (n: number) => n.toLocaleString(local(idioma), { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const numEm = (idioma: Idioma) => (n: number) => n.toLocaleString(local(idioma), { maximumFractionDigits: 1 });
const esquema = {
  perfil: campo(tiposUrl.opcao(["uniforme", "casado"] as const), "uniforme"),
  preco: campo(tiposUrl.numero({ min: 0, max: 1000 }), 180, { historico: "replace" }),
  ponta: campo(tiposUrl.numero({ min: 0, max: 1000 }), 400, { historico: "replace" }),
};

export function DuasCamadasEnergia({ compacto = false }: { compacto?: boolean }) {
  const tx = useTx();
  return <section id="fisico-e-comercial" className={s.section} aria-labelledby="duas-camadas-titulo">
    <p className={s.eyebrow}>{tx("O caminho da energia e o caminho dos contratos", "The path of energy and the path of contracts")}</p>
    <h2 id="duas-camadas-titulo" className={s.title}>{tx("A rede transporta. O contrato distribui obrigações e riscos.", "The grid carries the energy. The contract allocates obligations and risks.")}</h2>
    <p className={s.intro}>{tx("Uma comercializadora compra e vende energia, estrutura contratos e administra exposições. Ela pode atuar sem possuir usinas ou redes. O fornecedor escolhido no contrato não define o trajeto físico da eletricidade.", "An energy trader buys and sells energy, structures contracts and manages exposures. It can operate without owning plants or grids. The supplier chosen in the contract does not determine the physical path of the electricity.")}</p>
    <div className={s.lane}>
      <div className={s.laneLabel}>{tx("Camada física", "Physical layer")}<br /><small>{tx("Potência e energia", "Capacity and energy")}</small></div>
      <div className={s.nodes}><span className={s.node}>{tx("Geração", "Generation")}</span><span aria-hidden="true">→</span><span className={s.node}>{tx("Transmissão e distribuição", "Transmission and distribution")}</span><span aria-hidden="true">→</span><span className={s.node}>{tx("Consumo medido", "Metered consumption")}</span></div>
    </div>
    <div className={`${s.lane} ${s.commercial}`}>
      <div className={s.laneLabel}>{tx("Camada comercial", "Commercial layer")}<br /><small>{tx("Volumes e pagamentos", "Volumes and payments")}</small></div>
      <div className={s.nodes}><span className={s.node}>{tx("Geradores e comercializadores", "Generators and traders")}</span><span aria-hidden="true">↔</span><span className={s.node}>{tx("Contratos de compra e venda", "Purchase and sale contracts")}</span><span aria-hidden="true">↔</span><span className={s.node}>{tx("Distribuidoras e consumidores livres", "Distribution utilities and free consumers")}</span></div>
    </div>
    <div className={s.bridge}>{tx(<><strong>A ponte é a contabilização.</strong> Medições ajustadas pelas regras e posições contratuais entram no balanço da CCEE. As diferenças são valoradas ao PLD de cada hora e submercado. O pagamento do contrato segue o preço e as condições negociadas.</>, <><strong>The bridge is accounting.</strong> Metering adjusted by the rules and contract positions enter the CCEE balance. Differences are valued at the spot price (PLD) of each hour and submarket. Contract payment follows the negotiated price and conditions.</>)}</div>
    <p className={s.note}>{tx("Esquema simplificado do sistema interligado. As setas sólidas indicam o percurso físico; os contornos tracejados identificam a camada comercial. Operação, medição, registro, contabilização e liquidação são etapas distintas. Contratos não são ordens de despacho.", "Simplified diagram of the interconnected system. Solid arrows show the physical path; dashed outlines identify the commercial layer. Operation, metering, registration, accounting and settlement are separate steps. Contracts are not dispatch orders.")}</p>
    <div className={s.links}>
      {compacto ? <Link className={s.link} href="/setor-eletrico/mercado/comercializacao">{tx("Experimente a liquidação por horário →", "Try settlement by time of day →")}</Link> : <a className={s.link} href="#laboratorio-contratos">{tx("Abrir o laboratório de contratos ↓", "Open the contracts lab ↓")}</a>}
      <Link className={s.link} href="/setor-eletrico/mercado/agentes">{tx("Quem participa da comercialização →", "Who takes part in energy trading →")}</Link>
      <Link className={s.link} href="/setor-eletrico/mercado">{tx("Mercado livre e regulado nos dados →", "Free and regulated market in the data →")}</Link>
    </div>
  </section>;
}

export function LaboratorioContratos() {
  const [v, definir] = useEstadoUrl(esquema);
  const idioma = useIdioma();
  const tx = useTx();
  const reais = reaisEm(idioma);
  const num = numEm(idioma);
  const blocos = BLOCOS_COMERCIAIS.map((b, i) => ({ ...b, contrato: v.perfil === "casado" ? b.consumo : b.contrato, pld: i === 3 ? v.ponta : b.pld }));
  const r = liquidacaoDidatica(blocos, v.preco)!;
  return <section id="laboratorio-contratos" className={s.section} aria-labelledby="laboratorio-contratos-titulo">
    <p className={s.eyebrow}>{tx("Laboratório · números hipotéticos · perspectiva do comprador", "Lab · hypothetical numbers · buyer's perspective")}</p>
    <h2 id="laboratorio-contratos-titulo" className={s.title}>{tx("Contratar 100 MWh e consumir 100 MWh elimina a exposição?", "Does contracting 100 MWh and consuming 100 MWh eliminate the exposure?")}</h2>
    <p className={s.intro}>{tx("Depende dos horários. Neste dia ilustrativo, o consumo soma 100 MWh. Compare uma compra distribuída igualmente entre quatro blocos com uma compra que acompanha o consumo de cada bloco.", "It depends on the hours. On this illustrative day, consumption adds up to 100 MWh. Compare a purchase spread evenly across four blocks with a purchase that follows the consumption of each block.")}</p>
    <div className={s.tabs} role="group" aria-label={tx("Perfil do volume contratado", "Profile of the contracted volume")}>
      <button type="button" className={s.button} aria-pressed={v.perfil === "uniforme"} onClick={() => definir({ perfil: "uniforme" })}>{tx("25 MWh em cada bloco", "25 MWh in each block")}</button>
      <button type="button" className={s.button} aria-pressed={v.perfil === "casado"} onClick={() => definir({ perfil: "casado" })}>{tx("Contrato acompanha o consumo", "Contract follows consumption")}</button>
    </div>
    <div className={s.controls}>
      <label>{tx("Preço do contrato:", "Contract price:")} {reais(v.preco)}/MWh<input aria-label={tx("Preço hipotético do contrato", "Hypothetical contract price")} type="range" min={0} max={1000} step={10} value={v.preco} onChange={e => definir({ preco: Number(e.target.value) })} /></label>
      <label>{tx("PLD das 18–24h:", "PLD for 18–24h:")} {reais(v.ponta)}/MWh<input aria-label={tx("PLD hipotético das 18 às 24 horas", "Hypothetical PLD from 18 to 24 hours")} type="range" min={0} max={1000} step={10} value={v.ponta} onChange={e => definir({ ponta: Number(e.target.value) })} /></label>
      <button className={s.button} type="button" onClick={() => definir({ perfil: "uniforme", preco: 180, ponta: 400 })}>{tx("Restaurar exemplo", "Reset example")}</button>
    </div>
    <dl className={s.metrics}>
      <div><dt>{tx("Saldo de energia do dia", "Energy balance for the day")}</dt><dd>{num(r.saldo)} MWh</dd><small>{tx(`${num(r.contrato)} contratados − ${num(r.consumo)} consumidos.`, `${num(r.contrato)} contracted − ${num(r.consumo)} consumed.`)}</small></div>
      <div><dt>{r.resultado < 0 ? tx("Débito ilustrativo no curto prazo", "Illustrative short-term debit") : r.resultado > 0 ? tx("Crédito ilustrativo no curto prazo", "Illustrative short-term credit") : tx("Resultado ilustrativo no curto prazo", "Illustrative short-term result")}</dt><dd>{reais(Math.abs(r.resultado))}</dd><small>{tx("Soma das diferenças de cada bloco × seu PLD.", "Sum of the differences in each block × its PLD.")}</small></div>
      <div><dt>{tx("Contrato + ajuste de energia", "Contract + energy adjustment")}</dt><dd>{reais(r.custoEnergia)}</dd><small>{tx(`${reais(r.pagamentoContrato)} pelo contrato; ${r.resultado < 0 ? "acrescenta" : "deduz"} ${reais(Math.abs(r.resultado))} no ajuste.`, `${reais(r.pagamentoContrato)} for the contract; the adjustment ${r.resultado < 0 ? "adds" : "deducts"} ${reais(Math.abs(r.resultado))}.`)}</small></div>
    </dl>
    <div className={s.tableWrap} tabIndex={0} role="region" aria-label={tx("Cálculo por bloco, tabela com rolagem horizontal", "Calculation by block, horizontally scrolling table")}>
      <table className={s.table}><caption>{tx("Cada linha reúne seis horas com PLD constante dentro do bloco. MWh são volumes do bloco, não MW. Sinal positivo no resultado = crédito do comprador.", "Each row groups six hours with a constant PLD within the block. MWh are block volumes, not MW. A positive sign in the result = credit to the buyer.")}</caption>
        <thead><tr><th scope="col">{tx("Horário", "Time")}</th><th scope="col">{tx("Consumo · MWh", "Consumption · MWh")}</th><th scope="col">{tx("Contrato · MWh", "Contract · MWh")}</th><th scope="col">{tx("Saldo · MWh", "Balance · MWh")}</th><th scope="col">PLD · R$/MWh</th><th scope="col">{tx("Resultado · R$", "Result · R$")}</th></tr></thead>
        <tbody>{r.linhas.map(b => <tr key={b.nome}><th scope="row">{b.nome}</th><td>{num(b.consumo)}</td><td>{num(b.contrato)}</td><td>{num(b.diferenca)}</td><td>{num(b.pld)}</td><td>{reais(b.resultado)}</td></tr>)}</tbody>
      </table>
    </div>
    <div className={s.bridge}>{r.resultado === 0 ? tx(<><strong>Neste cenário, o ajuste é zero.</strong> A coincidência dos perfis ou a combinação de preços explica o resultado. Isso não elimina os demais custos e riscos contratuais.</>, <><strong>In this scenario, the adjustment is zero.</strong> The matching profiles or the combination of prices explain the result. This does not eliminate the other contractual costs and risks.</>) : tx(<><strong>O saldo diário é zero, mas o resultado financeiro é {r.resultado < 0 ? "devedor" : "credor"}.</strong> As sobras e os déficits ocorrem a preços diferentes. Compensar apenas os MWh do dia apagaria essa exposição.</>, <><strong>The daily balance is zero, but the financial result is a {r.resultado < 0 ? "debit" : "credit"}.</strong> Surpluses and shortfalls occur at different prices. Netting only the MWh of the day would hide this exposure.</>)}</div>
    <p className={s.note}>{tx("Fórmula do exercício: resultado = Σ [(contrato − consumo) × PLD]; custo de energia = pagamento contratual − resultado. Mesmo submercado e mesmos pontos de referência; sem perdas, encargos, tributos, inadimplência, garantias ou outros ajustes da CCEE. Os preços são hipóteses, não cotações nem limites regulatórios. O exemplo não estima uma fatura ou reproduz uma contabilização completa.", "Formula of the exercise: result = Σ [(contract − consumption) × PLD]; energy cost = contract payment − result. Same submarket and same reference points; no losses, sector charges, taxes, default, collateral or other CCEE adjustments. Prices are assumptions, not quotes or regulatory limits. The example does not estimate a bill or reproduce a complete accounting.")}</p>
  </section>;
}
