'use client';
import {useRecorte} from './RecorteCompartilhavel';
import {Proveniencia} from './artefatos/Proveniencia';
import {LinhaAnual} from './artefatos/LinhaAnual';
import {numero, moeda} from '@/lib/contas-publicas/formato';
import {razao} from '@/lib/contas-publicas/metricas';
import type {AnoRigidez, EstagioRigidez} from '@/lib/contas-publicas/riscos';

/**
 * Rigidez do orçamento (capítulo Sustentabilidade e riscos). Recebe do servidor só as somas por exercício.
 * A vista (lei original ou liquidado) fica na URL.
 */
const NOME: Record<EstagioRigidez, string> = {inicial: 'Na lei original (dotação inicial)', liquidado: 'No liquidado do ano'};
const pct = (p: AnoRigidez['inicial'], k: 'obrigatoria' | 'emendas') => razao(p?.[k] ?? null, p?.primaria ?? null).valor;

export function PainelRigidez({anos, fonte}: {anos: AnoRigidez[]; fonte: {fonte: string; url: string; perimetro: string}}) {
  const valida = (s: string) => s === 'inicial' || s === 'liquidado';
  const [estagio, setEstagio] = useRecorte<EstagioRigidez>('vista', 'inicial', valida);
  const linhas = anos.filter((a) => a[estagio] !== null);
  const fechadas = linhas.filter((a) => a.encerrado);
  const atual = linhas.at(-1)!;
  const primeiro = linhas[0];
  const ultimoFechado = fechadas.at(-1)!;
  const r = pct(atual[estagio], 'obrigatoria');
  const emendas = pct(atual[estagio], 'emendas');
  const descricao = `Despesa obrigatória: ${numero(pct(primeiro[estagio], 'obrigatoria'))}% da despesa primária em ${primeiro.ano} e ${numero(pct(ultimoFechado[estagio], 'obrigatoria'))}% em ${ultimoFechado.ano}${atual.ano !== ultimoFechado.ano ? `; ${atual.ano}, lei já aprovada, ${numero(r)}%` : ''}.`;
  return (
    <section className="cp-section cp-data-section" aria-labelledby="rigidez-titulo">
      <div className="cp-section-head">
        <div>
          <p className="rotulo cp-eyebrow">01 · Rigidez do orçamento · SIOP</p>
          <h2 id="rigidez-titulo">Quanto da despesa já nasce obrigatória?</h2>
          <p>Parte da despesa primária da União que a lei obriga a pagar: benefícios da previdência e assistência, salários, pisos de saúde e educação, transferências constitucionais. O restante é discricionário. Sem a dívida e sem a reserva de contingência.</p>
        </div>
        <label className="cp-select">Medir<select value={estagio} onChange={(e) => setEstagio(e.target.value as EstagioRigidez)}>{(['inicial', 'liquidado'] as const).map((k) => <option key={k} value={k}>{NOME[k]}</option>)}</select></label>
      </div>
      <p role="status" className="cp-note">{NOME[estagio]} · {primeiro.ano} a {atual.ano}{estagio === 'inicial' && !atual.encerrado ? ` (${atual.ano}: lei aprovada, ano em curso)` : ''} · % da despesa primária.</p>
      <div className="cp-kpis">
        <div><span>Obrigatória · {atual.ano}</span><strong>{numero(r)}%</strong><small>{moeda(atual[estagio]?.obrigatoria ?? null, 'reais')} de {moeda(atual[estagio]?.primaria ?? null, 'reais')} de despesa primária {estagio === 'inicial' ? 'na lei original' : 'liquidada'}.</small></div>
        <div><span>Discricionária · {atual.ano}</span><strong>{r === null ? 'Não calculável' : `${numero(100 - r)}%`}</strong><small>Inclui investimentos, custeio da máquina e as emendas parlamentares.</small></div>
        <div><span>Emendas parlamentares · {atual.ano}</span><strong>{numero(emendas)}%</strong><small>Individuais, de bancada, de comissão e de relator. A fonte as marca como discricionárias, embora as individuais e as de bancada sejam de execução obrigatória pela Constituição.</small></div>
      </div>
      <figure>
        <figcaption><h3>Parte obrigatória da despesa primária</h3><p className="cp-note">{NOME[estagio]} · {primeiro.ano} a {atual.ano} · % · eixo a partir de zero</p></figcaption>
        <LinhaAnual pontos={linhas.map((a) => ({ano: a.ano, valor: pct(a[estagio], 'obrigatoria'), parcial: !a.encerrado}))} unidade="% da despesa primária" descricao={descricao} />
        <p className="cp-note">{estagio === 'inicial' ? 'A lei original mostra o orçamento como foi aprovado; o ponto vazado é o ano em curso, cuja lei já está completa. ' : `O liquidado começa em ${primeiro.ano}: até ${primeiro.ano - 1}, o SIOP registra o liquidado igual ao empenhado. Só exercícios encerrados. `}Em 2020, despesas da pandemia como o auxílio emergencial foram marcadas como discricionárias, o que reduziu a parcela obrigatória no liquidado.</p>
      </figure>
      <p className="cp-status">Rigidez descreve quanto do orçamento está comprometido por lei antes de qualquer escolha do ano. Não mede qualidade do gasto: uma despesa obrigatória pode ser essencial, e a discricionária pode ser a mais difícil de cortar.</p>
      <details className="cp-data-details">
        <summary>Valores exatos por exercício</summary>
        <div className="cp-table-scroll" tabIndex={0} role="region" aria-label="Despesa obrigatória, discricionária e emendas por exercício">
          <table className="cp-table">
            <caption>{NOME[estagio]} · R$ correntes · sem a reserva de contingência</caption>
            <thead><tr><th scope="col">Exercício</th><th scope="col">Despesa primária</th><th scope="col">Obrigatória</th><th scope="col">Parte obrigatória</th><th scope="col">Emendas</th></tr></thead>
            <tbody>{linhas.map((a) => { const p = a[estagio]!; return (
              <tr key={a.ano}><th scope="row">{a.ano}{a.encerrado ? '' : ' (em curso)'}</th><td>{p.primaria.toLocaleString('pt-BR')}</td><td>{p.obrigatoria.toLocaleString('pt-BR')}</td><td>{numero(pct(p, 'obrigatoria'))}%</td><td>{p.emendas === null ? 'Sem marca própria' : p.emendas.toLocaleString('pt-BR')}</td></tr>
            ); })}</tbody>
          </table>
        </div>
        <p className="cp-note">Obrigatória é a despesa com identificador de resultado primário 1; emendas, os identificadores 6 a 9 (6 desde 2014, 7 desde 2017, 8 e 9 desde 2020; o 9 deixou de existir depois de 2022). Antes de 2014, as emendas ficavam entre as discricionárias comuns, sem marca própria: a coluna diz isso, em vez de mostrar zero.</p>
      </details>
      <Proveniencia fonte={fonte.fonte} url={fonte.url} referencia={`${primeiro.ano} a ${atual.ano} · base de ${atual.ano} atualizada em ${atual.atualizacao}`} publicacao={null} captura={null} perimetro={fonte.perimetro} unidade="R$ correntes e % da despesa primária" natureza={estagio === 'inicial' ? 'Dotação inicial por identificador de resultado primário' : 'Liquidado no exercício por identificador de resultado primário'} download="/contas-publicas/funcoes.json" />
    </section>
  );
}
