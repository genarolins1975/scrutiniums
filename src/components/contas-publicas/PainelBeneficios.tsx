import {Proveniencia} from './artefatos/Proveniencia';
import {BarrasValor} from './areas/GraficosArea';
import {moeda, numero, participacao} from '@/lib/contas-publicas/formato';
import {dataFonte} from '@/lib/contas-publicas/dados';
import {ANO_BASE_BENEFICIOS, ANTERIOR_BENEFICIOS, BASE_BENEFICIOS, BENEFICIOS, ORIGEM_BENEFICIOS, SERIE_BENEFICIOS, atualizacaoPaginaBeneficios, principaisModalidades} from '@/lib/contas-publicas/beneficios';

/** Gastos tributários da União (Receita Federal). Sem estado: renderizado no servidor. */
const bi = (v: number) => moeda(v, 'reais', {curta: true});

function Barras({itens, total, rotulo}: {itens: {nome: string; valor: number}[]; total: number; rotulo: string}) {
  const max = Math.max(...itens.map((i) => i.valor));
  return (
    <div className="cp-bars" role="list" aria-label={rotulo}>
      {itens.map((i) => (
        <div className="cp-bar-row" key={i.nome} role="listitem">
          <div><span>{i.nome}</span><strong>{bi(i.valor)}</strong></div>
          <div className="cp-bar-track" aria-hidden="true"><span style={{width: `${max > 0 ? (i.valor / max) * 100 : 0}%`}} /></div>
          <p className="cp-note">{participacao(i.valor, total)} do total estimado</p>
        </div>
      ))}
    </div>
  );
}

export function PainelBeneficios() {
  const b = BASE_BENEFICIOS;
  const {top, demais, comValor, semValor} = principaisModalidades(10);
  const funcoes = BENEFICIOS.funcoes.filter((f) => f.valor > 0);
  const funcoesTop = funcoes.slice(0, 8);
  const funcoesResto = funcoes.slice(8);
  const efetivos = SERIE_BENEFICIOS.filter((s) => s.natureza === 'efetivo');
  return (
    <section className="cp-section cp-data-section" aria-labelledby="beneficios-titulo">
      <div className="cp-section-head">
        <div>
          <p className="rotulo cp-eyebrow">01 · Gastos tributários · Receita Federal</p>
          <h2 id="beneficios-titulo">Quanto a União deixa de arrecadar com benefícios tributários?</h2>
          <p>Isenções, deduções, alíquotas reduzidas e regimes especiais que fazem a União arrecadar menos do que a regra geral do tributo cobraria. Estimativa oficial da Receita Federal, em reais correntes.</p>
        </div>
      </div>
      <p role="status" className="cp-note">Edição {BENEFICIOS.edicao}, publicada em {dataFonte(BENEFICIOS.fonte.publicacao)} (página atualizada em {atualizacaoPaginaBeneficios()}). {ANO_BASE_BENEFICIOS} é o ano mais recente calculado com dados efetivos.</p>
      <div className="cp-kpis">
        <div><span>Gasto tributário estimado · {ANO_BASE_BENEFICIOS}</span><strong>{moeda(b.valor, 'reais')}</strong><small>{ANTERIOR_BENEFICIOS ? `${moeda(ANTERIOR_BENEFICIOS.valor, 'reais')} em ${ANTERIOR_BENEFICIOS.ano}, na mesma edição. ` : ''}Valores nominais.</small></div>
        <div><span>Em relação ao PIB · {ANO_BASE_BENEFICIOS}</span><strong>{numero(b.pctPIB, 2)}%</strong><small>PIB de {moeda(b.pib, 'reais')} usado pela própria Receita nesta edição.</small></div>
        <div><span>Em relação à arrecadação · {ANO_BASE_BENEFICIOS}</span><strong>{numero(b.pctArrecadacao)}%</strong><small>Da receita administrada pela Receita Federal ({moeda(b.arrecadacao, 'reais')}), sem a contribuição previdenciária do servidor.</small></div>
      </div>
      <p className="cp-reading">De cada R$ 100 que a Receita Federal arrecadou em {ANO_BASE_BENEFICIOS}, cerca de R$ {numero(b.pctArrecadacao, 0)} deixaram de ser cobrados por benefícios tributários. É uma estimativa do valor que não entrou no caixa, não uma despesa paga: não se soma ao orçamento executado, e acabar com um benefício não traria de volta o mesmo valor, porque pessoas e empresas mudariam de comportamento.</p>
      <div className="cp-data-grid">
        <figure>
          <figcaption><h3>Estimado e projetado, ano a ano</h3><p className="cp-note">{SERIE_BENEFICIOS[0].ano} a {SERIE_BENEFICIOS.at(-1)!.ano} · R$ bilhões correntes · barras cheias: dados efetivos ({efetivos[0].ano} a {efetivos.at(-1)!.ano}); barras vazadas: projeção da mesma edição</p></figcaption>
          <BarrasValor pontos={SERIE_BENEFICIOS.map((s) => ({ano: s.ano, valor: s.valor, total: null, parcela: null, parcial: s.natureza === 'projecao'}))} nome="Gasto tributário estimado" />
          <p className="cp-note">Projeção não é observação: depende de hipóteses de crescimento e de mudanças de lei conhecidas na data da edição. Edições anteriores usaram outras bases e não são emendadas a esta série.</p>
        </figure>
        <figure>
          <figcaption><h3>Por tributo · {ANO_BASE_BENEFICIOS}</h3><p className="cp-note">R$ correntes · os seis maiores; a lista completa está na tabela abaixo</p></figcaption>
          <Barras itens={BENEFICIOS.tributos.slice(0, 6).map((t) => ({nome: t.tributo.replace(/ - [A-Za-zÀ-ú-]+$/, ''), valor: t.valor}))} total={b.valor} rotulo={`Gasto tributário por tributo em ${ANO_BASE_BENEFICIOS}`} />
        </figure>
      </div>
      <div className="cp-data-grid">
        <figure>
          <figcaption><h3>Os dez maiores benefícios · {ANO_BASE_BENEFICIOS}</h3><p className="cp-note">Modalidade de gasto tributário, como a Receita agrupa · R$ correntes</p></figcaption>
          <Barras itens={top.map((m) => ({nome: m.gasto, valor: m.valor}))} total={b.valor} rotulo={`Dez maiores gastos tributários em ${ANO_BASE_BENEFICIOS}`} />
          <p className="cp-note">Os dez somam {participacao(top.reduce((s, m) => s + m.valor, 0), b.valor)} do total. As outras {demais.quantidade} modalidades com valor somam {bi(demais.valor)}; {semValor} modalidades da lista não tiveram valor estimado em {ANO_BASE_BENEFICIOS} (zero na fonte).</p>
        </figure>
        <figure>
          <figcaption><h3>Por área do orçamento · {ANO_BASE_BENEFICIOS}</h3><p className="cp-note">Função orçamentária atribuída pela Receita a cada benefício · R$ correntes</p></figcaption>
          <Barras itens={funcoesTop.map((f) => ({nome: f.funcao, valor: f.valor}))} total={b.valor} rotulo={`Gasto tributário por função em ${ANO_BASE_BENEFICIOS}`} />
          <p className="cp-note">As outras {funcoesResto.length} áreas somam {bi(funcoesResto.reduce((s, f) => s + f.valor, 0))}. A área indica o objetivo declarado do benefício, não quem o recebe nem o resultado que produz.</p>
        </figure>
      </div>
      <p className="cp-status">O valor de cada benefício não diz se ele cumpre o objetivo. A avaliação de cada benefício (objetivo, prazo, beneficiários e efeito) ainda não está integrada a este painel.</p>
      <details className="cp-data-details">
        <summary>Valores exatos: série, tributos, áreas e todas as {comValor + semValor} modalidades</summary>
        <div className="cp-table-scroll" tabIndex={0} role="region" aria-label="Série do gasto tributário">
          <table className="cp-table">
            <caption>Série da edição · R$ correntes e razões publicadas</caption>
            <thead><tr><th scope="col">Ano</th><th scope="col">Natureza</th><th scope="col">R$</th><th scope="col">% do PIB</th><th scope="col">% da arrecadação</th></tr></thead>
            <tbody>{SERIE_BENEFICIOS.map((s) => <tr key={s.ano}><th scope="row">{s.ano}</th><td>{s.natureza === 'efetivo' ? 'Dados efetivos' : 'Projeção'}</td><td>{s.valor.toLocaleString('pt-BR', {maximumFractionDigits: 0})}</td><td>{numero(s.pctPIB, 2)}</td><td>{numero(s.pctArrecadacao)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="cp-table-scroll" tabIndex={0} role="region" aria-label="Gasto tributário por tributo">
          <table className="cp-table">
            <caption>Por tributo · {ANO_BASE_BENEFICIOS} · R$ correntes</caption>
            <thead><tr><th scope="col">Tributo</th><th scope="col">R$</th><th scope="col">% do PIB</th><th scope="col">% da arrecadação</th></tr></thead>
            <tbody>{BENEFICIOS.tributos.map((t) => <tr key={t.tributo}><th scope="row">{t.tributo}</th><td>{t.valor.toLocaleString('pt-BR', {maximumFractionDigits: 0})}</td><td>{numero(t.pctPIB, 3)}</td><td>{numero(t.pctArrecadacao, 2)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="cp-table-scroll" tabIndex={0} role="region" aria-label="Gasto tributário por modalidade">
          <table className="cp-table">
            <caption>Por modalidade · {ANO_BASE_BENEFICIOS} · R$ correntes</caption>
            <thead><tr><th scope="col">Modalidade</th><th scope="col">R$</th><th scope="col">Parte do total</th></tr></thead>
            <tbody>{BENEFICIOS.modalidades.map((m) => <tr key={m.gasto}><th scope="row">{m.gasto}</th><td>{m.valor.toLocaleString('pt-BR', {maximumFractionDigits: 0})}</td><td>{participacao(m.valor, b.valor)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="cp-table-scroll" tabIndex={0} role="region" aria-label="Gasto tributário por função">
          <table className="cp-table">
            <caption>Por função · {ANO_BASE_BENEFICIOS} · R$ correntes</caption>
            <thead><tr><th scope="col">Função</th><th scope="col">R$</th><th scope="col">Parte do total</th></tr></thead>
            <tbody>{BENEFICIOS.funcoes.map((f) => <tr key={f.funcao}><th scope="row">{f.funcao}</th><td>{f.valor.toLocaleString('pt-BR', {maximumFractionDigits: 0})}</td><td>{participacao(f.valor, b.valor)}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="cp-note">{BENEFICIOS.conferencia}</p>
      </details>
      <Proveniencia {...ORIGEM_BENEFICIOS} />
    </section>
  );
}
