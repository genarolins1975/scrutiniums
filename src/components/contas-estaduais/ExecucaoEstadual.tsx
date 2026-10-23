import ComposicaoDespesa from "./ComposicaoDespesa";
import FinanciamentoEstadual from "./FinanciamentoEstadual";
import SaldosExecucao from "./SaldosExecucao";
import { catalogo, execucaoPrimaria, INDICADORES_EXECUCAO, primarios } from "@/lib/contas-estaduais/dados";

const numero = (v: number, casas = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const rotulos = {receita_prevista:"Receita prevista",receita_arrecadada:"Receita arrecadada",dotacao_inicial:"Dotação inicial",dotacao_atualizada:"Dotação atualizada",empenhada:"Despesa empenhada",liquidada:"Despesa liquidada",paga:"Despesa paga"};
const conceitos = {
 "CE-01": "Distância entre arrecadação e previsão inicial. O sinal indica se a receita ficou acima ou abaixo do previsto.",
 "CE-04": "Parcela da autorização atualizada registrada como despesa liquidada.",
 "CE-05": "Parcela dos empenhos registrada como liquidada no demonstrativo.",
 "CE-06": "Parcela da despesa liquidada paga dentro do exercício.",
};

export default function ExecucaoEstadual({ uf, ano }: { uf: string; ano: number }) {
 const dado = execucaoPrimaria(uf, ano);
 if (!dado) return <aside id="execucao-estadual" tabIndex={-1} className="ce-budget-empty"><h3>Execução orçamentária de {uf} · {ano}</h3><p>Este recorte ainda não foi conferido. A base conferida cobre o encerramento de 2025 nas 27 UFs. Ausência no painel não significa ausência na fonte.</p></aside>;
 const v = dado.valores;
 const etapas = [{ nome: "Autorizada", campo: "dotacao_atualizada", valor: v.dotacao_atualizada, explicacao: "Dotação atualizada" }, { nome: "Empenhada", campo: "empenhada", valor: v.empenhada, explicacao: "Compromissos registrados" }, { nome: "Liquidada", campo: "liquidada", valor: v.liquidada, explicacao: "Direito do credor verificado" }, { nome: "Paga", campo: "paga", valor: v.paga, explicacao: "Pagamento do exercício" }];
 return <section id="execucao-estadual" tabIndex={-1} className="ce-budget" aria-labelledby="execucao-titulo">
  <div className="ce-section-heading"><div><p className="rotulo ce-kicker">Execução orçamentária / {uf} / janeiro a dezembro de {ano}</p><h3 id="execucao-titulo">Da autorização ao pagamento</h3></div><span className="ce-status">Conferido na resposta original</span></div>
  <p className="ce-note">Siconfi · RREO Anexo 01 · esfera estadual · exceto intra-orçamentárias e refinanciamento destacado · captura de 12/10/2026. Valores declarados no acumulado do 6º bimestre.</p>
  <div className="ce-budget-grid"><figure className="ce-stages"><figcaption>Quatro etapas, uma mesma escala <span>R$ bilhões nominais · base zero</span></figcaption>{etapas.map(e => <div className="ce-stage-row" key={e.campo}><div><strong>{e.nome}</strong><span>R$ {numero(e.valor / 1e9)} bi</span></div><div className="ce-bar-track" aria-hidden="true"><span style={{width: (e.valor / v.dotacao_atualizada * 100) + "%"}}/></div><small>{e.explicacao}</small></div>)}</figure>
  <div className="ce-budget-readings">{INDICADORES_EXECUCAO.map(id => { const contrato = catalogo.indicadores.find(i => i.id === id)!; return <article key={id}><span className="ce-id">{id}</span><h4>{contrato.nome}</h4><strong className="ce-rate">{id === "CE-01" && dado.indicadores[id] > 0 ? "+" : ""}{numero(dado.indicadores[id])}%</strong><p>{conceitos[id]}</p>{id === "CE-01" && <small>Erro absoluto: {numero(Math.abs(dado.indicadores[id]))}%</small>}</article>; })}</div></div>
  <p className="ce-budget-caution">Essas medidas descrevem o registro financeiro. Liquidação e pagamento não comprovam, por si sós, qualidade do serviço, cumprimento de metas físicas ou eficiência. A comparação deve considerar o escopo de cada ente; o DF acumula competências estaduais e municipais.</p>
  <SaldosExecucao uf={uf} ano={ano}/>
  <ComposicaoDespesa uf={uf} ano={ano}/>
  <FinanciamentoEstadual uf={uf} ano={ano}/>
  <details><summary>Conferir valores, fórmulas e arquivo original</summary><p className="ce-note">{primarios.perimetro_rreo} A previsão inicial é a declarada no RREO; ainda não foi confrontada com a lei orçamentária. Os valores podem refletir retificações posteriores ao encerramento.</p><div className="ce-table-scroll" role="region" tabIndex={0} aria-label="Valores originais da execução orçamentária"><table><caption>RREO Anexo 01 · {uf} · 2025 · valores em reais</caption><thead><tr><th scope="col">Campo</th><th scope="col">Valor nominal (R$)</th><th scope="col">Coluna original</th></tr></thead><tbody>{Object.entries(v).map(([campo, valor]) => <tr key={campo}><th scope="row">{rotulos[campo as keyof typeof rotulos]}</th><td className="ce-num">{numero(valor)}</td><td>{primarios.campos_rreo[campo as keyof typeof primarios.campos_rreo].coluna}</td></tr>)}</tbody></table></div><ul>{INDICADORES_EXECUCAO.map(id => <li key={id}><strong>{id}:</strong> {catalogo.indicadores.find(i => i.id === id)!.formula}</li>)}</ul>{dado.fontes.map(f => <p key={f.sha256} className="ce-source-links"><a href={f.arquivo} download>Resposta original preservada · JSON ↓</a><a href={f.url}>Repetir consulta no Tesouro ↗</a><small className="ce-hash">SHA-256: {f.sha256}</small></p>)}<p className="ce-note">A nova consulta pode trazer uma retificação. O arquivo preservado é a referência exata desta versão.</p></details>
 </section>;
}
