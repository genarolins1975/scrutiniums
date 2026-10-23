import {Proveniencia} from './artefatos/Proveniencia';
import {LinhaAnual} from './artefatos/LinhaAnual';
import {numero, pontosPercentuais} from '@/lib/contas-publicas/formato';
import {DIVIDA, mesmoMesAnterior, nomeMes, serieAnualDivida, ultimoMesDivida} from '@/lib/contas-publicas/riscos';

/** Dívida bruta do governo geral (Banco Central). Sem estado: renderizado no servidor. */
const tri = (milhoes: number) => `R$ ${numero(milhoes / 1e6, 2)} trilhões`;

export function PainelDivida() {
  const u = ultimoMesDivida();
  const antes = mesmoMesAnterior(u);
  const anual = serieAnualDivida();
  const primeiro = anual[0];
  const descricao = `Dívida bruta do governo geral: ${numero(primeiro.pctPIB)}% do PIB em dezembro de ${primeiro.periodo.slice(0, 4)} e ${numero(u.pctPIB)}% em ${nomeMes(u.periodo)}.`;
  return (
    <section className="cp-section cp-data-section" aria-labelledby="divida-titulo">
      <div className="cp-section-head">
        <div>
          <p className="rotulo cp-eyebrow">02 · Dívida bruta · Banco Central</p>
          <h2 id="divida-titulo">Quanto os governos devem?</h2>
          <p>Dívida bruta do governo geral: União, INSS, estados e municípios, sem o Banco Central e as empresas estatais. Saldo no fim do mês, em reais correntes e em relação ao PIB dos últimos 12 meses.</p>
        </div>
      </div>
      <p role="status" className="cp-note">Mês mais recente: {nomeMes(u.periodo)}. O Banco Central revisa os meses recentes; a série é recolhida toda semana.</p>
      <div className="cp-kpis">
        <div><span>Saldo da dívida bruta</span><strong>{tri(u.milhoes)}</strong><small>Fim de {nomeMes(u.periodo)} · reais correntes</small></div>
        <div><span>Em relação ao PIB</span><strong>{numero(u.pctPIB)}%</strong><small>PIB dos últimos 12 meses, a preços correntes, estimado pelo Banco Central</small></div>
        <div><span>Em 12 meses</span><strong>{antes ? pontosPercentuais(u.pctPIB - antes.pctPIB) : 'Não informado'}</strong><small>{antes ? `Frente a ${numero(antes.pctPIB)}% em ${nomeMes(antes.periodo)}. Diferença em pontos percentuais do PIB.` : 'Sem o mesmo mês do ano anterior.'}</small></div>
      </div>
      <figure>
        <figcaption><h3>Dívida bruta em relação ao PIB</h3><p className="cp-note">Dezembro de cada ano, de {primeiro.periodo.slice(0, 4)} a {anual.filter((p) => p.fimDeAno).at(-1)!.periodo.slice(0, 4)}{anual.at(-1)!.fimDeAno ? '' : `, e ${nomeMes(u.periodo)} (ponto vazado)`} · % do PIB · eixo a partir de zero</p></figcaption>
        <LinhaAnual pontos={anual.map((p) => ({ano: p.fimDeAno ? Number(p.periodo.slice(0, 4)) : Number(p.periodo.slice(0, 4)) + Number(p.periodo.slice(5)) / 12, valor: p.pctPIB, parcial: !p.fimDeAno, rotulo: p.fimDeAno ? undefined : p.periodo.slice(5) + '/' + p.periodo.slice(0, 4)}))} unidade="% do PIB" descricao={descricao} />
        <p className="cp-note">Em 2020, a dívida subiu com as despesas da pandemia e a queda do PIB. A razão ao PIB muda tanto com o saldo da dívida quanto com o tamanho da economia.</p>
      </figure>
      <p className="cp-status">Dívida bruta não desconta os ativos do governo (reservas, créditos a receber); a dívida líquida é outra medida. O perímetro é o governo geral, não o orçamento da União mostrado nos outros painéis, nem a Dívida Pública Federal do Tesouro. Os valores não se somam.</p>
      <details className="cp-data-details">
        <summary>Valores exatos de dezembro de cada ano</summary>
        <div className="cp-table-scroll" tabIndex={0} role="region" aria-label="Dívida bruta do governo geral por ano">
          <table className="cp-table">
            <caption>Saldo no fim do período · R$ milhões correntes e % do PIB</caption>
            <thead><tr><th scope="col">Período</th><th scope="col">R$ milhões</th><th scope="col">% do PIB</th></tr></thead>
            <tbody>{anual.map((p) => <tr key={p.periodo}><th scope="row">{p.fimDeAno ? `Dezembro de ${p.periodo.slice(0, 4)}` : nomeMes(p.periodo)}</th><td>{p.milhoes.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td>{numero(p.pctPIB, 2)}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="cp-note">{DIVIDA.metodologia}. Série mensal completa, com todos os meses, no download.</p>
      </details>
      <Proveniencia fonte={DIVIDA.fonte.nome} url={DIVIDA.fonte.pagina} referencia={`Dezembro de 2006 a ${nomeMes(u.periodo)}`} publicacao={null} captura={DIVIDA.captura} perimetro={DIVIDA.perimetro} unidade={`${DIVIDA.unidade.reais}; ${DIVIDA.unidade.pib}`} natureza="Estoque de dívida no fim do mês; estatística fiscal do Banco Central" download="/contas-publicas/divida.json" />
    </section>
  );
}
