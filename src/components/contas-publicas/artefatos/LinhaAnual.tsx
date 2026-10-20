import {numero} from '@/lib/contas-publicas/formato';

/**
 * Linha de uma medida anual (percentual), desenhada sem estado: serve a componentes do servidor e do cliente.
 * Eixo a partir de zero; ano sem dado parte a linha (ausência não vira continuidade nem zero); o ponto marcado como
 * parcial (ano em curso, mês mais recente) é vazado e ligado por tracejado. A descrição acessível vem de quem chama,
 * com a unidade certa da medida.
 */
export type PontoLinha = {ano: number; valor: number | null; parcial?: boolean; rotulo?: string};
const L = 720, A = 250, M = {e: 56, d: 24, t: 34, b: 34};
function topo(max: number) {
  if (!(max > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}
export function LinhaAnual({pontos, unidade, descricao, casas = 1}: {pontos: PontoLinha[]; unidade: string; descricao: string; casas?: number}) {
  const anos = pontos.map((p) => p.ano);
  const min = Math.min(...anos), max = Math.max(...anos);
  const x = (ano: number) => M.e + ((ano - min) / Math.max(1, max - min)) * (L - M.e - M.d);
  const validos = pontos.filter((p): p is PontoLinha & {valor: number} => p.valor !== null);
  const teto = topo(Math.max(...validos.map((p) => p.valor)));
  const y = (v: number) => M.t + (1 - v / teto) * (A - M.t - M.b);
  let novo = true;
  const caminho = pontos.filter((p) => !p.parcial).map((p) => {
    if (p.valor === null) { novo = true; return ''; }
    const c = `${novo ? 'M' : 'L'}${x(p.ano).toFixed(1)},${y(p.valor).toFixed(1)}`;
    novo = false;
    return c;
  }).filter(Boolean).join(' ');
  const fechados = validos.filter((p) => !p.parcial), parciais = validos.filter((p) => p.parcial);
  const primeiro = fechados[0], ultimo = fechados.at(-1);
  const rotulos = pontos.filter((p, i) => i === 0 || i === pontos.length - 1 || (p.ano % 5 === 0 && p.ano - min >= 3 && max - p.ano >= 3));
  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="cp-area-svg" role="img" aria-label={descricao}>
      {[0, teto / 2, teto].map((t) => (
        <g key={t}>
          <line x1={M.e} x2={L - M.d} y1={y(t)} y2={y(t)} className="cp-area-grade" />
          <text x={M.e - 8} y={y(t) + 4} textAnchor="end" className="cp-area-eixo">{numero(t, 0)}</text>
        </g>
      ))}
      <text x={M.e} y={18} className="cp-area-eixo">{unidade}</text>
      {rotulos.map((p) => <text key={p.ano} x={x(p.ano)} y={A - 8} textAnchor="middle" className="cp-area-eixo">{p.rotulo ?? p.ano}</text>)}
      <path d={caminho} className="cp-area-linha" />
      {parciais.map((p) => {
        // liga ao ponto imediatamente anterior, se ele tem dado e não é parcial
        const a = pontos[pontos.indexOf(p) - 1];
        return a && a.valor !== null && !a.parcial ?<line key={`l${p.ano}`} x1={x(a.ano)} y1={y(a.valor)} x2={x(p.ano)} y2={y(p.valor)} className="cp-area-linha cp-area-tracejada" /> : null;
      })}
      {fechados.map((p) => <circle key={p.ano} cx={x(p.ano)} cy={y(p.valor)} r={3} className="cp-area-ponto" />)}
      {parciais.map((p) => <circle key={p.ano} cx={x(p.ano)} cy={y(p.valor)} r={4.5} className="cp-area-ponto cp-area-vazado" />)}
      {primeiro && <text x={x(primeiro.ano)} y={y(primeiro.valor) - 12} textAnchor="start" className="cp-area-valor">{numero(primeiro.valor, casas)}</text>}
      {ultimo && ultimo !== primeiro && <text x={x(ultimo.ano)} y={y(ultimo.valor) - 12} textAnchor={parciais.length ? 'end' : 'middle'} className="cp-area-valor">{numero(ultimo.valor, casas)}</text>}
      {parciais.map((p) => <text key={`t${p.ano}`} x={x(p.ano)} y={y(p.valor) + 24} textAnchor="end" className="cp-area-valor">{numero(p.valor, casas)}</text>)}
    </svg>
  );
}
