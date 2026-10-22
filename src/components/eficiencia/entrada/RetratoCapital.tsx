'use client';
import {daCapital,inteiro,escala,naCapital,numero,type CapitalRetrato,type Medida} from '@/lib/eficiencia/entrada-nucleo';
import styles from './Entrada.module.css';
import {SeloComConta} from '@/components/acesso/SeloComConta';

/** Desenho do contorno no quadro pequeno do retrato (unidades do viewBox). */
const QUADRO = 132;
/** Trilho da régua: largura do desenho e margem para o ponto não sair pela borda. */
const LARGURA = 320, MARGEM = 8;
const xDaPosicao = (posicao: number) => MARGEM + Math.max(0, Math.min(100, posicao)) / 100 * (LARGURA - 2 * MARGEM);

/**
 * Régua de uma condição: as 26 capitais em pontos sobre a posição de 0 a 100 (à direita, condição mais favorável), a capital escolhida
 * em destaque, o comparador em losango e a metade marcada. Lê-se sem legenda; o valor original vem escrito ao lado.
 */
function Regua({m, a, b, capitais}: {m: Medida; a: CapitalRetrato; b: CapitalRetrato; capitais: CapitalRetrato[]}) {
  const pos = m.posicoes!;
  const pa = pos[a.id], pb = pos[b.id];
  const demais = capitais.filter(c => c.id !== a.id && c.id !== b.id && pos[c.id] !== undefined);
  // empate ou quase: os dois marcadores se tocariam; a capital sobe e o comparador desce, para os dois continuarem visíveis
  const juntos = Math.abs(xDaPosicao(pa) - xDaPosicao(pb)) < 13;
  const yFoco = juntos ? 8 : 14, yPar = juntos ? 21 : 14;
  return <svg viewBox={`0 0 ${LARGURA} 28`} className={styles.reguaTrilho} role="img"
    aria-label={`${m.curto}: ${a.nome} na posição ${Math.round(pa)} de 100; ${b.nome} na posição ${Math.round(pb)}`}>
    <line x1={MARGEM} x2={LARGURA - MARGEM} y1={14} y2={14} className={styles.reguaLinha}/>
    <line x1={xDaPosicao(50)} x2={xDaPosicao(50)} y1={5} y2={23} className={styles.reguaMetade}/>
    {demais.map(c => <circle key={c.id} cx={xDaPosicao(pos[c.id])} cy={14} r={3} className={styles.reguaPonto}/>)}
    <path d={`M${xDaPosicao(pb)} ${yPar - 6}l6 6l-6 6l-6 -6Z`} className={styles.reguaPar}/>
    <circle cx={xDaPosicao(pa)} cy={yFoco} r={6.5} className={styles.reguaFoco}/>
  </svg>;
}

/**
 * Retrato da capital: título com a capital, seletores, população, área e densidade, e ao lado a posição da capital entre as 26 em sete
 * resultados de 2022, uma régua por resultado, com o contorno oficial do IBGE. Só posições: a nota experimental fica no painel do índice
 * (decisão do dono de 19/10/2026). Fundo marfim como o resto da plataforma e régua no lugar das pétalas (decisão do dono de 21/10/2026,
 * diagnóstico de layout de 20/10/2026, item 8): as pétalas pediam legenda, a régua se lê sozinha.
 */
export function RetratoCapital({a, b, condicoes, capitais, onSelect, fonteContornos, fontePopulacao, rotulo}: {
  /** Rótulo de contexto acima do H1 (RotuloContexto), montado pela página no servidor. */
  rotulo?: React.ReactNode;
  a: CapitalRetrato; b: CapitalRetrato; condicoes: Medida[]; capitais: CapitalRetrato[];
  onSelect: (campo: 'territorio' | 'comparador', id: string) => void;
  fonteContornos: {fonte: string; url: string; capturadoEm: string; tratamento: string}; fontePopulacao: string;
}) {
  const contorno = a.contorno;
  const lado = QUADRO - 34;
  const k = contorno ? lado / Math.max(contorno.largura, contorno.altura) : 1;
  const ox = contorno ? QUADRO / 2 - contorno.largura * k / 2 : 0, oy = contorno ? QUADRO / 2 - contorno.altura * k / 2 - 12 : 0;
  const barra = contorno ? escala(contorno.kmPorUnidade / k, lado) : null;
  const densidade = a.populacao !== null && a.areaKm2 ? a.populacao / a.areaKm2 : null;
  const temPosicoes = condicoes.every(m => m.posicoes && m.posicoes[a.id] !== undefined && m.posicoes[b.id] !== undefined);
  return <section className={styles.hero} aria-labelledby="titulo-eficiencia">
    <div className={styles.heroInner}>
      <div className={styles.heroText}>
        {rotulo}
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
      <figure className={styles.retrato} aria-labelledby="retrato-titulo">
        <div className={styles.retratoTopo}>
          {contorno && <svg viewBox={`0 0 ${QUADRO} ${QUADRO}`} className={styles.contorno} role="img" aria-label={`Contorno oficial ${daCapital(a.nome)}`}>
            <defs>
              {/* O padrão vive no espaço do contorno, que é reduzido por k: medidas divididas por k mantêm 4 px na tela. */}
              <pattern id="retrato-hachura" width={4 / k} height={4 / k} patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><line x1="0" y1="0" x2="0" y2={4 / k} className={styles.hatch} strokeWidth={1 / k}/></pattern>
            </defs>
            <g transform={`translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${k.toFixed(5)})`}><path d={contorno.d} fill="url(#retrato-hachura)" fillRule="evenodd" className={styles.outline} vectorEffect="non-scaling-stroke"/></g>
            {barra && <g className={styles.scaleBar}><line x1={QUADRO / 2 - barra.comprimento / 2} x2={QUADRO / 2 + barra.comprimento / 2} y1={QUADRO - 8} y2={QUADRO - 8}/><text x={QUADRO / 2} y={QUADRO - 13} textAnchor="middle">{barra.km.toLocaleString('pt-BR')} km</text></g>}
          </svg>}
          <div>
            <h2 id="retrato-titulo" className={styles.retratoTitulo}>Onde {a.nome} fica entre as 26 capitais</h2>
            <p className={styles.retratoSub}>Posição em sete resultados de 2022, de 0 a 100. Quanto mais à direita, mais favorável a condição.</p>
            <p className={styles.retratoChave}>
              <span><i className={styles.chaveFoco} aria-hidden="true"/>{a.nome}</span>
              <span><i className={styles.chavePar} aria-hidden="true"/>{b.nome}</span>
              <span><i className={styles.chavePonto} aria-hidden="true"/>Demais capitais</span>
            </p>
          </div>
        </div>
        <ol className={styles.reguaLista}>
          {condicoes.map(m => <li key={m.id} className={styles.reguaItem}>
            {/* os dois valores lado a lado: quem compara precisa do número das duas capitais, não só da posição (pedido do dono de 21/10/2026) */}
            <div className={styles.reguaRotulo}>
              <span>{m.curto}</span>
              <dl className={styles.reguaValores}>
                <div><dt className="sr-only">{a.nome}</dt><dd className={styles.valorFoco}>{numero(m.valores[a.id]?.valor ?? null, m.unidade)}</dd></div>
                <div><dt className="sr-only">{b.nome}</dt><dd className={styles.valorPar}><i className={styles.chavePar} aria-hidden="true"/>{numero(m.valores[b.id]?.valor ?? null, m.unidade)}</dd></div>
              </dl>
            </div>
            {temPosicoes ? <Regua m={m} a={a} b={b} capitais={capitais}/> : null}
          </li>)}
        </ol>
        {temPosicoes && <p className={styles.reguaEixo} aria-hidden="true"><span>menos favorável</span><span>metade</span><span>mais favorável</span></p>}
        <figcaption id="retrato-legenda" className={styles.retratoLegenda}>
          <p>Posição relativa, não nota nem meta: a posição conta metade dos empates e não diz quanto uma capital está acima da outra. Os valores ao lado de cada régua são os originais, na unidade da fonte: em cima a capital escolhida, embaixo, com o losango, a de comparação. Precisão municipal não quantificada nas medidas amostrais.{temPosicoes ? '' : ' Posições indisponíveis nesta publicação: só os valores.'}</p>
          <p>Contorno: {fonteContornos.fonte}{contorno && contorno.partesDistantes > 0 ? `; ${contorno.partesDistantes} ${contorno.partesDistantes === 1 ? 'parte remota fica' : 'partes remotas ficam'} fora do enquadramento` : ''}. População: {fontePopulacao}.</p>
        </figcaption>
      </figure>
    </div>
  </section>;
}
