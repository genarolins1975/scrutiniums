import type {PontoSerie} from '@/lib/contas-publicas/areas';
import {numero} from '@/lib/contas-publicas/formato';

/**
 * Dois gráficos da série de uma parcela, desenhados no servidor: a parte de cada R$ 100 (linha) e o valor em
 * R$ bilhões correntes (barras a partir de zero). Unidades diferentes, gráficos separados: sem eixo duplo.
 * O ano em curso aparece vazado e rotulado como parcial; ano sem dado fica sem marca, nunca em zero.
 */
const L = 720, A = 250, M = {e: 64, d: 16, t: 34, b: 34};

function escalaX(pontos: PontoSerie[]) {
  const anos = pontos.map((p) => p.ano);
  const min = Math.min(...anos), max = Math.max(...anos);
  return (ano: number) => M.e + ((ano - min) / Math.max(1, max - min)) * (L - M.e - M.d);
}
function topo(max: number) {
  if (!(max > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}
/** Primeiro e último ano sempre; os múltiplos de 5 só quando não encostam neles (2025 ao lado de 2026, por exemplo). */
const anosRotulo = (pontos: PontoSerie[]) => {
  const primeiro = pontos[0]?.ano ?? 0, ultimo = pontos.at(-1)?.ano ?? 0;
  return pontos.filter((p, i) => i === 0 || i === pontos.length - 1 || (p.ano % 5 === 0 && p.ano - primeiro >= 3 && ultimo - p.ano >= 3));
};

export function LinhaParcela({pontos, nome, unidade}: {pontos: PontoSerie[]; nome: string; unidade: string}) {
  const x = escalaX(pontos);
  const validos = pontos.filter((p) => p.parcela !== null);
  const max = topo(Math.max(...validos.map((p) => p.parcela as number)));
  const y = (v: number) => M.t + (1 - v / max) * (A - M.t - M.b);
  const fechados = validos.filter((p) => !p.parcial);
  const parcial = validos.filter((p) => p.parcial);
  const caminho = fechados.map((p, i) => `${i ? 'L' : 'M'}${x(p.ano).toFixed(1)},${y(p.parcela as number).toFixed(1)}`).join(' ');
  const primeiro = fechados[0], ultimo = fechados[fechados.length - 1];
  const descricao = primeiro && ultimo
    ? `${nome}: R$ ${numero(primeiro.parcela)} de cada R$ 100 em ${primeiro.ano} e R$ ${numero(ultimo.parcela)} em ${ultimo.ano}${parcial[0] ? `; ${parcial[0].ano}, parcial, R$ ${numero(parcial[0].parcela)}` : ''}.`
    : `${nome}: sem dados na série.`;
  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="cp-area-svg" role="img" aria-label={descricao}>
      {[0, max / 2, max].map((t) => (
        <g key={t}>
          <line x1={M.e} x2={L - M.d} y1={y(t)} y2={y(t)} className="cp-area-grade" />
          <text x={M.e - 8} y={y(t) + 4} textAnchor="end" className="cp-area-eixo">{numero(t, max < 10 ? 1 : 0)}</text>
        </g>
      ))}
      <text x={M.e} y={18} className="cp-area-eixo">{unidade}</text>
      {anosRotulo(pontos).map((p) => (
        <text key={p.ano} x={x(p.ano)} y={A - 8} textAnchor="middle" className="cp-area-eixo">{p.ano}</text>
      ))}
      <path d={caminho} className="cp-area-linha" />
      {ultimo && parcial.map((p) => (
        <line key={`l${p.ano}`} x1={x(ultimo.ano)} y1={y(ultimo.parcela as number)} x2={x(p.ano)} y2={y(p.parcela as number)} className="cp-area-linha cp-area-tracejada" />
      ))}
      {fechados.map((p) => <circle key={p.ano} cx={x(p.ano)} cy={y(p.parcela as number)} r={3} className="cp-area-ponto" />)}
      {/* o ano parcial é o ponto vazado, explicado na legenda da figura */}
      {parcial.map((p) => <circle key={p.ano} cx={x(p.ano)} cy={y(p.parcela as number)} r={4.5} className="cp-area-ponto cp-area-vazado" />)}
      {ultimo && <text x={x(ultimo.ano)} y={y(ultimo.parcela as number) - 12} textAnchor="middle" className="cp-area-valor">{numero(ultimo.parcela)}</text>}
      {primeiro && <text x={x(primeiro.ano)} y={y(primeiro.parcela as number) - 12} textAnchor="start" className="cp-area-valor">{numero(primeiro.parcela)}</text>}
    </svg>
  );
}

export function BarrasValor({pontos, nome}: {pontos: PontoSerie[]; nome: string}) {
  const x = escalaX(pontos);
  const validos = pontos.filter((p) => p.valor !== null);
  const max = topo(Math.max(...validos.map((p) => (p.valor as number) / 1e9)));
  const y = (v: number) => M.t + (1 - v / max) * (A - M.t - M.b);
  const largura = ((L - M.e - M.d) / Math.max(1, pontos.length)) * 0.7;
  const ultimo = validos.filter((p) => !p.parcial).at(-1);
  const descricao = ultimo ? `${nome}: R$ ${numero((ultimo.valor as number) / 1e9)} bilhões correntes em ${ultimo.ano}. Barras desde ${pontos[0].ano}, sem correção pela inflação.` : `${nome}: sem dados.`;
  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="cp-area-svg" role="img" aria-label={descricao}>
      {[0, max / 2, max].map((t) => (
        <g key={t}>
          <line x1={M.e} x2={L - M.d} y1={y(t)} y2={y(t)} className="cp-area-grade" />
          <text x={M.e - 8} y={y(t) + 4} textAnchor="end" className="cp-area-eixo">{numero(t, max < 10 ? 1 : 0)}</text>
        </g>
      ))}
      <text x={M.e} y={18} className="cp-area-eixo">R$ bilhões correntes</text>
      {anosRotulo(pontos).map((p) => (
        <text key={p.ano} x={x(p.ano)} y={A - 8} textAnchor="middle" className="cp-area-eixo">{p.ano}</text>
      ))}
      {validos.map((p) => {
        const v = (p.valor as number) / 1e9;
        return <rect key={p.ano} x={x(p.ano) - largura / 2} width={largura} y={y(Math.max(0, v))} height={Math.max(0, y(0) - y(Math.max(0, v)))} className={p.parcial ? 'cp-area-barra cp-area-barra-parcial' : 'cp-area-barra'} />;
      })}
      {ultimo && <text x={x(ultimo.ano)} y={y((ultimo.valor as number) / 1e9) - 6} textAnchor="end" className="cp-area-valor">{numero((ultimo.valor as number) / 1e9, 1)}</text>}
    </svg>
  );
}
