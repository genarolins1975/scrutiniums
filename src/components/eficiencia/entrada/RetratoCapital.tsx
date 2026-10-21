'use client';
import {daCapital,inteiro,escala,naCapital,numero,type CapitalRetrato,type Medida} from '@/lib/eficiencia/entrada-nucleo';
import styles from './Entrada.module.css';
import {SeloComConta} from '@/components/acesso/SeloComConta';

const C = 300, R0 = 124, RMAX = 266;
const angulo = (i: number, n: number) => (-90 + i * 360 / n) * Math.PI / 180;
const ponto = (r: number, a: number) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
const raio = (posicao: number) => R0 + 6 + Math.max(0, Math.min(100, posicao)) / 100 * (RMAX - R0 - 6);

/** Pétala em folha: base sobre o disco, ponta no raio da posição. Só forma; o valor está no rótulo. */
function petala(i: number, n: number, posicao: number) {
  const a = angulo(i, n), meia = Math.PI / n * 0.46, r = raio(posicao), base = R0 + 3, h = r - base;
  const f = (x: number) => x.toFixed(1);
  const [bx1, by1] = ponto(base, a - meia), [bx2, by2] = ponto(base, a + meia), [tx, ty] = ponto(r, a);
  const [c1x, c1y] = ponto(base + h * 0.42, a - meia * 1.32), [c2x, c2y] = ponto(base + h * 0.9, a - meia * 0.3);
  const [c3x, c3y] = ponto(base + h * 0.9, a + meia * 0.3), [c4x, c4y] = ponto(base + h * 0.42, a + meia * 1.32);
  return `M${f(bx1)} ${f(by1)}C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(tx)} ${f(ty)}C${f(c3x)} ${f(c3y)} ${f(c4x)} ${f(c4y)} ${f(bx2)} ${f(by2)}A${base} ${base} 0 0 0 ${f(bx1)} ${f(by1)}Z`;
}

/**
 * Retrato da capital: contorno oficial do IBGE no centro e as sete condições de 2022 em volta.
 * Só posições: a nota experimental fica no painel do índice (decisão do dono de 19/10/2026).
 */
export function RetratoCapital({a, b, condicoes, capitais, onSelect, fonteContornos, fontePopulacao}: {
  a: CapitalRetrato; b: CapitalRetrato; condicoes: Medida[]; capitais: CapitalRetrato[];
  onSelect: (campo: 'territorio' | 'comparador', id: string) => void;
  fonteContornos: {fonte: string; url: string; capturadoEm: string; tratamento: string}; fontePopulacao: string;
}) {
  const n = condicoes.length;
  const contorno = a.contorno;
  const lado = 2 * (R0 - 22);
  const k = contorno ? lado / Math.max(contorno.largura, contorno.altura) : 1;
  const ox = contorno ? C - contorno.largura * k / 2 : 0, oy = contorno ? C - contorno.altura * k / 2 - 8 : 0;
  const barra = contorno ? escala(contorno.kmPorUnidade / k, lado) : null;
  const densidade = a.populacao !== null && a.areaKm2 ? a.populacao / a.areaKm2 : null;
  const temPosicoes = condicoes.every(m => m.posicoes && m.posicoes[a.id] !== undefined);
  const poligonoB = temPosicoes ? condicoes.map((m, i) => ponto(raio(m.posicoes![b.id]), angulo(i, n)).map(v => v.toFixed(1)).join(',')).join(' ') : '';
  return <section className={styles.hero} aria-labelledby="titulo-eficiencia">
    <div className={styles.heroInner}>
      <div className={styles.heroText}>
        <p className={styles.kicker}>Eficiência Estatal · Retrato das capitais</p>
        <h1 id="titulo-eficiencia" className={styles.heroTitle}>Como se vive {naCapital(a.nome).split(' ')[0]} <em>{a.nome}</em>?</h1>
        <p className={styles.heroLead}>Sete resultados na vida dos moradores, o que a prefeitura aplica em educação e saúde, e o que ainda não se sabe. Cada número com fonte, período e limites.</p>
        <div className={styles.selectors}>
          <label>Capital<select value={a.id} onChange={e => onSelect('territorio', e.target.value)}>{capitais.map(c => <option key={c.id} value={c.id}>{c.nome} · {c.uf}</option>)}</select></label>
          <label>Comparar com<select value={b.id} onChange={e => onSelect('comparador', e.target.value)}>{capitais.filter(c => c.id !== a.id).map(c => <option key={c.id} value={c.id}>{c.nome} · {c.uf}</option>)}</select></label>
        </div>
        <dl className={styles.facts}>
          <div><dt>População</dt><dd>{inteiro(a.populacao)}<small>Censo 2022</small></dd></div>
          <div><dt>Área</dt><dd>{a.areaKm2 === null ? 'Não disponível' : <>{a.areaKm2.toLocaleString('pt-BR', {maximumFractionDigits: 1})}<span className={styles.unit}> km²</span></>}<small>IBGE, área territorial</small></dd></div>
          <div><dt>Densidade</dt><dd>{densidade === null ? 'Não disponível' : <>{inteiro(densidade)}<span className={styles.unit}> hab./km²</span></>}<small>população ÷ área</small></dd></div>
        </dl>
        <nav className={styles.heroNav} aria-label="Nesta página">
          <a href="#perguntas">Sete perguntas <span aria-hidden="true">↓</span></a>
          <a href="#recursos">O que a prefeitura aplica <span aria-hidden="true">↓</span></a>
          <a href="#cobertura">O que ainda não se sabe <span aria-hidden="true">↓</span></a>
          <a href={`/eficiencia-estatal/indice-de-resultados?territorio=${a.id}&comparador=${b.id}`} aria-label="Índice experimental, no painel do índice, com conta">Índice experimental <span aria-hidden="true">↗</span><SeloComConta href="/eficiencia-estatal/indice-de-resultados"/></a>
        </nav>
      </div>
      <figure className={styles.rosette} aria-labelledby="retrato-legenda">
        <div className={styles.rosetteStage}>
          <svg viewBox="0 0 600 600" role="img" aria-labelledby="retrato-titulo retrato-desc">
            <title id="retrato-titulo">{`Retrato ${daCapital(a.nome)}: contorno oficial do município e posição em sete resultados de 2022`}</title>
            <desc id="retrato-desc">{condicoes.map(m => `${m.curto}: ${numero(m.valores[a.id]?.valor ?? null, m.unidade)}${m.posicoes ? `, posição ${Math.round(m.posicoes[a.id])} de 100` : ''}`).join('; ')}.</desc>
            <defs>
              {/* O padrão vive no espaço do contorno, que é reduzido por k: medidas divididas por k mantêm 4,5 px na tela. */}
              <pattern id="retrato-hachura" width={4.5 / k} height={4.5 / k} patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><line x1="0" y1="0" x2="0" y2={4.5 / k} className={styles.hatch} strokeWidth={1.1 / k}/></pattern>
              <radialGradient id="retrato-disco" cx="50%" cy="45%" r="60%"><stop offset="0%" className={styles.discoCentro}/><stop offset="100%" className={styles.discoBorda}/></radialGradient>
            </defs>
            <circle cx={C} cy={C} r={RMAX} className={styles.ringOuter}/>
            <circle cx={C} cy={C} r={raio(50)} className={styles.ringHalf}/>
            {condicoes.map((_, i) => { const [x, y] = ponto(RMAX, angulo(i, n)); const [x0, y0] = ponto(R0, angulo(i, n)); return <line key={i} x1={x0} y1={y0} x2={x} y2={y} className={styles.spoke}/>; })}
            {temPosicoes && condicoes.map((m, i) => <path key={m.id} d={petala(i, n, m.posicoes![a.id])} className={styles.petal}/>)}
            {temPosicoes && <polygon points={poligonoB} className={styles.peerShape}/>}
            {temPosicoes && condicoes.map((m, i) => { const [x, y] = ponto(raio(m.posicoes![b.id]), angulo(i, n)); return <path key={m.id} d={`M${x} ${y - 7}l7 7l-7 7l-7 -7Z`} className={styles.peerMark}/>; })}
            <circle cx={C} cy={C} r={R0} fill="url(#retrato-disco)" className={styles.disc}/>
            {contorno && <g transform={`translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${k.toFixed(5)})`}><path d={contorno.d} fill="url(#retrato-hachura)" fillRule="evenodd" className={styles.outline} vectorEffect="non-scaling-stroke"/></g>}
            {barra && <g className={styles.scaleBar}><line x1={C - barra.comprimento / 2} x2={C + barra.comprimento / 2} y1={C + R0 - 18} y2={C + R0 - 18}/><text x={C} y={C + R0 - 24} textAnchor="middle">{barra.km.toLocaleString('pt-BR')} km</text></g>}
            {condicoes.map((m, i) => { const [x, y] = ponto(RMAX + 18, angulo(i, n)); return <text key={m.id} x={x} y={y + 5} textAnchor="middle" className={styles.petalNumber}>{i + 1}</text>; })}
          </svg>
          {condicoes.map((m, i) => { const ang = angulo(i, n), [x, y] = ponto(RMAX + 30, ang), cos = Math.cos(ang);
            const lado = Math.abs(cos) < 0.2 ? styles.labelCenter : cos > 0 ? styles.labelRight : styles.labelLeft;
            return <p key={m.id} className={`${styles.petalLabel} ${lado}`} style={{left: `${x / 6}%`, top: `${y / 6}%`}}><span>{m.curto}</span><strong>{numero(m.valores[a.id]?.valor ?? null, m.unidade)}</strong></p>; })}
        </div>
        <ol className={styles.petalList}>{condicoes.map((m, i) => <li key={m.id}><span><b aria-hidden="true">{i + 1}</b>{m.curto}</span><strong>{numero(m.valores[a.id]?.valor ?? null, m.unidade)}</strong></li>)}</ol>
        <figcaption id="retrato-legenda" className={styles.rosetteCaption}>
          <p><span className={styles.keyPetal} aria-hidden="true"/> Cada pétala é um resultado de 2022: quanto mais longa, mais favorável a posição {daCapital(a.nome)} entre as 26 capitais estaduais (0 a 100, contando metade dos empates). <span className={styles.keyHalf} aria-hidden="true"/> O círculo tracejado marca a metade. <span className={styles.keyPeer} aria-hidden="true"/> {b.nome}.</p>
          <p>Posição relativa, não nota nem meta. Precisão municipal não quantificada nas medidas amostrais. Contorno: {fonteContornos.fonte}{contorno && contorno.partesDistantes > 0 ? `; ${contorno.partesDistantes} ${contorno.partesDistantes === 1 ? 'parte remota fica' : 'partes remotas ficam'} fora do enquadramento` : ''}. População: {fontePopulacao}.</p>
        </figcaption>
      </figure>
    </div>
  </section>;
}
