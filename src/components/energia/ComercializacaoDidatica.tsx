"use client";

import Link from "@/components/energia/LinkSemPrefetch";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { BLOCOS_COMERCIAIS, liquidacaoDidatica } from "@/lib/energia/leitura-integrada";
import { useEstadoUrl } from "./useEstadoUrl";
import s from "./LeiturasIntegradas.module.css";

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const esquema = {
  perfil: campo(tiposUrl.opcao(["uniforme", "casado"] as const), "uniforme"),
  preco: campo(tiposUrl.numero({ min: 0, max: 1000 }), 180, { historico: "replace" }),
  ponta: campo(tiposUrl.numero({ min: 0, max: 1000 }), 400, { historico: "replace" }),
};

export function DuasCamadasEnergia({ compacto = false }: { compacto?: boolean }) {
  return <section id="fisico-e-comercial" className={s.section} aria-labelledby="duas-camadas-titulo">
    <p className={s.eyebrow}>O caminho da energia e o caminho dos contratos</p>
    <h2 id="duas-camadas-titulo" className={s.title}>A rede transporta. O contrato distribui obrigações e riscos.</h2>
    <p className={s.intro}>Uma comercializadora compra e vende energia, estrutura contratos e administra exposições. Ela pode atuar sem possuir usinas ou redes. O fornecedor escolhido no contrato não define o trajeto físico da eletricidade.</p>
    <div className={s.lane}>
      <div className={s.laneLabel}>Camada física<br /><small>Potência e energia</small></div>
      <div className={s.nodes}><span className={s.node}>Geração</span><span aria-hidden="true">→</span><span className={s.node}>Transmissão e distribuição</span><span aria-hidden="true">→</span><span className={s.node}>Consumo medido</span></div>
    </div>
    <div className={`${s.lane} ${s.commercial}`}>
      <div className={s.laneLabel}>Camada comercial<br /><small>Volumes e pagamentos</small></div>
      <div className={s.nodes}><span className={s.node}>Geradores e comercializadores</span><span aria-hidden="true">↔</span><span className={s.node}>Contratos de compra e venda</span><span aria-hidden="true">↔</span><span className={s.node}>Distribuidoras e consumidores livres</span></div>
    </div>
    <div className={s.bridge}><strong>A ponte é a contabilização.</strong> Medições ajustadas pelas regras e posições contratuais entram no balanço da CCEE. As diferenças são valoradas ao PLD de cada hora e submercado. O pagamento do contrato segue o preço e as condições negociadas.</div>
    <p className={s.note}>Esquema simplificado do sistema interligado. As setas sólidas indicam o percurso físico; as relações tracejadas representam contratos. Operação, medição, registro, contabilização e liquidação são etapas distintas. Contratos não são ordens de despacho.</p>
    <div className={s.links}>
      {compacto ? <Link className={s.link} href="/setor-eletrico/mercado/comercializacao">Experimente a liquidação por horário →</Link> : <a className={s.link} href="#laboratorio-contratos">Abrir o laboratório de contratos ↓</a>}
      <Link className={s.link} href="/setor-eletrico/mercado/agentes">Quem participa da comercialização →</Link>
      <Link className={s.link} href="/setor-eletrico/mercado">Mercado livre e regulado nos dados →</Link>
    </div>
  </section>;
}

export function LaboratorioContratos() {
  const [v, definir] = useEstadoUrl(esquema);
  const blocos = BLOCOS_COMERCIAIS.map((b, i) => ({ ...b, contrato: v.perfil === "casado" ? b.consumo : b.contrato, pld: i === 3 ? v.ponta : b.pld }));
  const r = liquidacaoDidatica(blocos, v.preco)!;
  return <section id="laboratorio-contratos" className={s.section} aria-labelledby="laboratorio-contratos-titulo">
    <p className={s.eyebrow}>Laboratório · números hipotéticos · perspectiva do comprador</p>
    <h2 id="laboratorio-contratos-titulo" className={s.title}>Contratar 100 MWh e consumir 100 MWh elimina a exposição?</h2>
    <p className={s.intro}>Depende dos horários. Neste dia ilustrativo, o consumo soma 100 MWh. Compare uma compra distribuída igualmente entre quatro blocos com uma compra que acompanha o consumo de cada bloco.</p>
    <div className={s.tabs} role="group" aria-label="Perfil do volume contratado">
      <button type="button" className={s.button} aria-pressed={v.perfil === "uniforme"} onClick={() => definir({ perfil: "uniforme" })}>25 MWh em cada bloco</button>
      <button type="button" className={s.button} aria-pressed={v.perfil === "casado"} onClick={() => definir({ perfil: "casado" })}>Contrato acompanha o consumo</button>
    </div>
    <div className={s.controls}>
      <label>Preço do contrato: {reais(v.preco)}/MWh<input aria-label="Preço hipotético do contrato" type="range" min={0} max={1000} step={10} value={v.preco} onChange={e => definir({ preco: Number(e.target.value) })} /></label>
      <label>PLD das 18–24h: {reais(v.ponta)}/MWh<input aria-label="PLD hipotético das 18 às 24 horas" type="range" min={0} max={1000} step={10} value={v.ponta} onChange={e => definir({ ponta: Number(e.target.value) })} /></label>
      <button className={s.button} type="button" onClick={() => definir({ perfil: "uniforme", preco: 180, ponta: 400 })}>Restaurar exemplo</button>
    </div>
    <dl className={s.metrics}>
      <div><dt>Saldo de energia do dia</dt><dd>{num(r.saldo)} MWh</dd><small>{num(r.contrato)} contratados − {num(r.consumo)} consumidos.</small></div>
      <div><dt>{r.resultado < 0 ? "Débito" : r.resultado > 0 ? "Crédito" : "Resultado"} ilustrativo no curto prazo</dt><dd>{reais(Math.abs(r.resultado))}</dd><small>Soma das diferenças de cada bloco × seu PLD.</small></div>
      <div><dt>Contrato + ajuste de energia</dt><dd>{reais(r.custoEnergia)}</dd><small>{reais(r.pagamentoContrato)} pelo contrato; {r.resultado < 0 ? "acrescenta" : "deduz"} {reais(Math.abs(r.resultado))} no ajuste.</small></div>
    </dl>
    <div className={s.tableWrap} tabIndex={0} role="region" aria-label="Cálculo por bloco, tabela com rolagem horizontal">
      <table className={s.table}><caption>Cada linha reúne seis horas com PLD constante dentro do bloco. MWh são volumes do bloco, não MW. Sinal positivo no resultado = crédito do comprador.</caption>
        <thead><tr><th scope="col">Horário</th><th scope="col">Consumo · MWh</th><th scope="col">Contrato · MWh</th><th scope="col">Saldo · MWh</th><th scope="col">PLD · R$/MWh</th><th scope="col">Resultado · R$</th></tr></thead>
        <tbody>{r.linhas.map(b => <tr key={b.nome}><th scope="row">{b.nome}</th><td>{num(b.consumo)}</td><td>{num(b.contrato)}</td><td>{num(b.diferenca)}</td><td>{num(b.pld)}</td><td>{reais(b.resultado)}</td></tr>)}</tbody>
      </table>
    </div>
    <div className={s.bridge}>{r.resultado === 0 ? <><strong>Neste cenário, o ajuste é zero.</strong> A coincidência dos perfis ou a combinação de preços explica o resultado. Isso não elimina os demais custos e riscos contratuais.</> : <><strong>O saldo diário é zero, mas o resultado financeiro é {r.resultado < 0 ? "devedor" : "credor"}.</strong> As sobras e os déficits ocorrem a preços diferentes. Compensar apenas os MWh do dia apagaria essa exposição.</>}</div>
    <p className={s.note}>Fórmula do exercício: resultado = Σ [(contrato − consumo) × PLD]; custo de energia = pagamento contratual − resultado. Mesmo submercado e mesmos pontos de referência; sem perdas, encargos, tributos, inadimplência, garantias ou outros ajustes da CCEE. Os preços são hipóteses, não cotações nem limites regulatórios. O exemplo não estima uma fatura ou reproduz uma contabilização completa.</p>
  </section>;
}
