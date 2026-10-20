'use client';
import {useRecorte} from './RecorteCompartilhavel';
import {Proveniencia} from './artefatos/Proveniencia';
import {Termo} from './artefatos/Termo';
import {moeda, numero} from '@/lib/contas-publicas/formato';
import {desvioPercentual} from '@/lib/contas-publicas/metricas';
import {BASES_PLANO, NOME_BASE_PLANO, FONTE_PLANO, type AnoPlano, type BasePlano} from '@/lib/contas-publicas/planejamento-modelo';

/**
 * Plano e execução (capítulo Qualidade do planejamento). Recebe do servidor só os totais por exercício: a base por
 * função e subfunção não vai para o navegador. O recorte (base e exercício) fica na URL.
 */
const sinal = (v: number | null) => (v === null ? 'Não calculável' : `${v > 0 ? '+' : ''}${numero(v)}%`);
const medir = (a: number | null, b: number | null) => desvioPercentual(a, b).valor;

export function PainelPlanejamento({anos}: {anos: AnoPlano[]}) {
  const fechados = anos.filter((a) => a.encerrado);
  const emCurso = anos.find((a) => !a.encerrado) ?? null;
  const ultimo = fechados.at(-1)!;
  const anoValido = (s: string) => fechados.some((a) => String(a.ano) === s);
  const baseValida = (s: string) => (BASES_PLANO as readonly string[]).includes(s);
  const [anoTexto, setAno] = useRecorte<string>('ano', String(ultimo.ano), anoValido);
  const [base, setBase] = useRecorte<BasePlano>('base', 'primaria', baseValida);
  const a = fechados.find((x) => String(x.ano) === anoTexto) ?? ultimo;
  const v = a[base];
  const desvio = medir(v.liquidado, v.inicial), creditos = medir(v.atualizada, v.inicial);
  const reserva = base === 'primaria' ? a.reservaPrimaria : a.reservaTotal;
  const escala = Math.max(...anos.flatMap((x) => [medir(x[base].liquidado, x[base].inicial), medir(x[base].atualizada, x[base].inicial)]).map((d) => Math.abs(d ?? 0)));
  const teto = Math.max(5, Math.ceil(escala / 5) * 5);
  const barra = (d: number) => ({width: `${(Math.abs(d) / teto) * 50}%`, left: d < 0 ? `${50 - (Math.abs(d) / teto) * 50}%` : '50%'});
  const maior = Math.max(v.inicial ?? 0, v.atualizada ?? 0, v.liquidado ?? 0);
  const primeiro = anos[0].ano;
  return (
    <section className="cp-section cp-data-section" aria-labelledby="plano-observado">
      <div className="cp-section-head">
        <div>
          <p className="cp-eyebrow">01 · Plano e execução · SIOP</p>
          <h2 id="plano-observado">Quanto a execução se afastou da lei original?</h2>
          <p>Orçamentos Fiscal e da Seguridade Social da União. Compara o que a lei orçamentária aprovou com o que foi autorizado ao longo do ano e com o que foi liquidado. Valores nominais.</p>
        </div>
        <div className="cp-controls cp-controls-inline">
          <label className="cp-select">Exercício<select value={a.ano} onChange={(e) => setAno(e.target.value)}>{[...fechados].reverse().map((x) => <option key={x.ano} value={x.ano}>{x.ano} · encerrado</option>)}</select></label>
          <label className="cp-select">Base<select value={base} onChange={(e) => setBase(e.target.value as BasePlano)}>{BASES_PLANO.map((b) => <option key={b} value={b}>{NOME_BASE_PLANO[b]}</option>)}</select></label>
        </div>
      </div>
      <p role="status" className="cp-note">{a.ano}, exercício encerrado · {NOME_BASE_PLANO[base].toLowerCase()} · base do SIOP atualizada em {a.atualizacao}.</p>
      <div className="cp-kpis">
        <div><span>Lei original · <Termo id="dotacao-inicial" /></span><strong>{moeda(v.inicial, 'reais')}</strong><small>O que a lei orçamentária de {a.ano} aprovou.{reserva ? ` Inclui ${moeda(reserva, 'reais')} de reserva de contingência, que não é executada diretamente.` : ''}</small></div>
        <div><span>Autorizado no fim do ano · <Termo id="dotacao-atualizada" /></span><strong>{sinal(creditos)}</strong><small>{moeda(v.atualizada, 'reais')} depois dos créditos e cancelamentos do ano, frente à lei original.</small></div>
        <div><span>Liquidado frente à lei original</span><strong>{sinal(desvio)}</strong><small>{moeda(v.liquidado, 'reais')} liquidados em {a.ano}. Diferença de {moeda(v.liquidado !== null && v.inicial !== null ? v.liquidado - v.inicial : null, 'reais', {variacao: true})}.</small></div>
      </div>
      <p className="cp-reading">
        Em {a.ano}, {base === 'primaria' ? 'a despesa primária liquidada' : 'a despesa liquidada do orçamento inteiro'} ficou {desvio === null ? 'sem comparação calculável' : `${numero(Math.abs(desvio))}% ${desvio < 0 ? 'abaixo' : 'acima'} do que a lei original previa`}.
        {' '}A diferença reúne decisões legítimas (créditos extraordinários, bloqueios para cumprir a meta fiscal, reserva não usada) e dificuldades de execução; o número sozinho não separa umas das outras.
      </p>
      <div className="cp-data-grid">
        <figure>
          <figcaption><h3>Lei original, autorizado e liquidado em {a.ano}</h3><p className="cp-note">R$ correntes · barras na mesma escala, a partir de zero</p></figcaption>
          <div className="cp-bars">
            {([['inicial', 'Lei original'], ['atualizada', 'Autorizado no fim do ano'], ['liquidado', 'Liquidado']] as const).map(([k, nome]) => (
              <div className="cp-bar-row" key={k}>
                <div><span>{nome}</span><strong>{moeda(v[k], 'reais', {curta: true})}</strong></div>
                <div className={`cp-bar-track ${k === 'inicial' ? 'cp-reference' : ''}`} aria-hidden="true"><span style={{width: `${maior > 0 && v[k] !== null ? ((v[k] as number) / maior) * 100 : 0}%`}} /></div>
              </div>
            ))}
          </div>
          <p className="cp-note">Liquidar é reconhecer que o bem ou serviço foi entregue ao governo; não atesta resultado para a sociedade.</p>
        </figure>
        <figure>
          <figcaption><h3>Liquidado frente à lei original, ano a ano</h3><p className="cp-note">{primeiro} a {ultimo.ano} · % · zero no centro · {NOME_BASE_PLANO[base].toLowerCase()}</p></figcaption>
          <div className="cp-signed-axis" aria-hidden="true"><span>−{teto}%</span><span>0</span><span>+{teto}%</span></div>
          {anos.map((x) => {
            const d = x.encerrado ? medir(x[base].liquidado, x[base].inicial) : null;
            return (
              <div className="cp-signed-row" key={x.ano}>
                <span>{x.ano}{x.ano === 2020 && <small className="cp-pandemic">Pandemia</small>}{!x.encerrado && <small className="cp-pandemic">Em curso</small>}</span>
                <div className="cp-signed-track" aria-hidden="true">{d !== null && <span className={d < 0 ? 'cp-negative' : 'cp-positive'} style={barra(d)} />}</div>
                <strong>{x.encerrado ? sinal(d) : 'Sem desvio'}</strong>
              </div>
            );
          })}
          <p className="cp-note">{emCurso ? `${emCurso.ano} está em curso: o liquidado ainda é parcial e o desvio não é calculado. ` : ''}A série começa em {primeiro}: até {primeiro - 1}, o SIOP registra o liquidado igual ao empenhado, e a comparação mudaria de conceito no meio do caminho.</p>
        </figure>
      </div>
      <figure className="cp-section-tight">
        <figcaption><h3>Autorizado no fim do ano frente à lei original</h3><p className="cp-note">{primeiro} a {anos.at(-1)!.ano} · % · créditos adicionais menos cancelamentos{emCurso ? ` · ${emCurso.ano} até a base de ${emCurso.atualizacao}` : ''}</p></figcaption>
        <div className="cp-signed-axis" aria-hidden="true"><span>−{teto}%</span><span>0</span><span>+{teto}%</span></div>
        {anos.map((x) => {
          const d = medir(x[base].atualizada, x[base].inicial);
          return (
            <div className="cp-signed-row" key={x.ano}>
              <span>{x.ano}{!x.encerrado && <small className="cp-pandemic">Em curso</small>}</span>
              <div className="cp-signed-track" aria-hidden="true">{d !== null && <span className={d < 0 ? 'cp-negative' : 'cp-positive'} style={barra(d)} />}</div>
              <strong>{sinal(d)}</strong>
            </div>
          );
        })}
        <p className="cp-note">Crédito adicional é autorização aprovada depois da lei, por exemplo para a pandemia em 2020. Ampliar o orçamento ao longo do ano não é, por si, falha de planejamento.</p>
      </figure>
      <details className="cp-data-details">
        <summary>Despesa primária por área em {a.ano}, sem a reserva de contingência</summary>
        <div className="cp-table-scroll" tabIndex={0} role="region" aria-label={`Despesa primária por função em ${a.ano}`}>
          <table className="cp-table">
            <caption>{a.ano} · R$ bilhões correntes · ordem pelo valor da lei original · <Termo id="funcao" /></caption>
            <thead><tr><th scope="col">Área (função)</th><th scope="col">Lei original</th><th scope="col">Autorizado</th><th scope="col">Liquidado</th><th scope="col">Liquidado frente à lei</th></tr></thead>
            <tbody>{a.funcoes.map((f) => (
              <tr key={f.codigo}><th scope="row">{f.nome}</th><td>{f.inicial === null ? 'Não informado' : numero(f.inicial / 1e9, 1)}</td><td>{f.atualizada === null ? 'Não informado' : numero(f.atualizada / 1e9, 1)}</td><td>{f.liquidado === null ? 'Não informado' : numero(f.liquidado / 1e9, 1)}</td><td>{f.inicial && f.inicial > 0 ? sinal(medir(f.liquidado, f.inicial)) : 'Sem dotação na lei'}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <p className="cp-note">Área sem dotação na lei original não tem desvio percentual: a razão seria indefinida. Encargos Especiais, na parte primária, reúne sobretudo transferências a estados e municípios.</p>
      </details>
      <details className="cp-data-details">
        <summary>Valores exatos de todos os exercícios</summary>
        <div className="cp-table-scroll" tabIndex={0} role="region" aria-label="Lei original, autorizado e liquidado por exercício">
          <table className="cp-table">
            <caption>{NOME_BASE_PLANO[base]} · R$ correntes, sem arredondamento de exibição</caption>
            <thead><tr><th scope="col">Exercício</th><th scope="col">Lei original</th><th scope="col">Autorizado</th><th scope="col">Liquidado</th><th scope="col">Reserva de contingência na lei</th></tr></thead>
            <tbody>{anos.map((x) => (
              <tr key={x.ano}><th scope="row">{x.ano}{x.encerrado ? '' : ' (em curso)'}</th>{(['inicial', 'atualizada', 'liquidado'] as const).map((k) => <td key={k}>{x[base][k] === null ? 'Não informado' : (x[base][k] as number).toLocaleString('pt-BR')}</td>)}<td>{(base === 'primaria' ? x.reservaPrimaria : x.reservaTotal)?.toLocaleString('pt-BR') ?? 'Não informado'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </details>
      <Proveniencia fonte={FONTE_PLANO.fonte} url={FONTE_PLANO.url} referencia={`${primeiro} a ${anos.at(-1)!.ano} · ${a.ano} com base atualizada em ${a.atualizacao}`} publicacao={null} captura={null} perimetro={FONTE_PLANO.perimetro} unidade={FONTE_PLANO.unidade} natureza="Dotação inicial, dotação atualizada e liquidado no exercício; valores nominais" download="/contas-publicas/funcoes.json" />
    </section>
  );
}
