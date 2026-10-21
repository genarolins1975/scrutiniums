import { AlternarExemplos } from "@/components/energia/AlternarExemplos";
import { ModeloDidatico } from "@/components/energia/Didatica";
import { DO_REGIAO, REGIOES, decomposicaoEscolhida, doRegiao, nomeRegiao, partesDaDiferenca } from "@/lib/energia/carga";
import { dataBR, sinal } from "@/lib/energia/formato";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import type { A07, DecomposicaoA07 } from "@/lib/energia/tipos-carga";

/**
 * Artefato "peça por peça" da página Clima e calendário: a diferença de carga entre a janela recente e a de um ano antes, montada em cascata
 * a partir das partes que o modelo publica (calendário, temperatura, estação do ano, nível e tendência) e do resíduo. A soma das colunas
 * é a diferença real. Lê a mesma decomposição da faixa de métricas e do gráfico de barras (variante principal, mesmos dias da semana).
 */

type Peca = { id: string; curto: string; minimo: string; valor: number; tipo: "modelo" | "residuo" };

function pecas(d: DecomposicaoA07): Peca[] {
  const c = d.contribuicoes_log100;
  return [
    { id: "calendario", curto: tx("Calendário", "Calendar"), minimo: tx("Calend.", "Cal."), valor: c.calendario, tipo: "modelo" },
    { id: "temperatura", curto: tx("Temperatura", "Temperature"), minimo: tx("Temp.", "Temp."), valor: c.temperatura, tipo: "modelo" },
    { id: "sazonalidade", curto: tx("Estação", "Season"), minimo: tx("Estação", "Season"), valor: c.sazonalidade, tipo: "modelo" },
    { id: "nivel", curto: tx("Nível", "Level"), minimo: tx("Nível", "Level"), valor: c.nivel_tendencia, tipo: "modelo" },
    { id: "residuo", curto: tx("Resíduo", "Residual"), minimo: tx("Resíduo", "Resid."), valor: d.residuo_log100, tipo: "residuo" },
  ];
}

function Cascata({ d }: { d: DecomposicaoA07 }) {
  const ps = pecas(d);
  const total = d.real_log100;
  // posições acumuladas: cada peça começa onde a anterior terminou
  let acc = 0;
  const barras = ps.map((p) => {
    const ini = acc;
    acc += p.valor;
    return { ...p, ini, fim: acc };
  });
  const valores = [0, total, ...barras.flatMap((b) => [b.ini, b.fim])];
  const max = Math.max(...valores) * 1.15 || 1;
  const min = Math.min(0, ...valores) * 1.15;
  const cor = (p: { tipo: string }) => (p.tipo === "residuo" ? "var(--cor-bronze)" : "var(--cor-energia)");
  const p = partesDaDiferenca(d);
  const resumo = tx(
    `Cascata da diferença ${DO_REGIAO[d.sm]}: ${barras.map((b) => `${b.curto} ${sinal(b.valor, 2)}`).join("; ")}; diferença real ${sinal(total, 2)} pontos.`,
    `Waterfall of the difference ${doRegiao(d.sm, "en")}: ${barras.map((b) => `${b.curto} ${sinal(b.valor, 2)}`).join("; ")}; actual difference ${sinal(total, 2)} points.`,
  );
  // dois desenhos do mesmo dado: no celular, caixa estreita com rótulos curtos; a partir de 640 px, a caixa larga
  const desenho = (W: number, fs: number, estreito: boolean) => {
    const H = 250;
    const M = { e: 8, d: 8, t: 24, b: 30 };
    const n = barras.length + 1;
    const larg = (W - M.e - M.d) / n;
    const folga = estreito ? 4 : 8;
    const y = (v: number) => M.t + ((max - v) / (max - min || 1)) * (H - M.t - M.b);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-3xl" role="img" aria-label={resumo}>
        <line x1={M.e} x2={W - M.d} y1={y(0)} y2={y(0)} stroke="var(--cor-carvao-soft)" strokeWidth={1} />
        {barras.map((b, i) => {
          const x = M.e + i * larg;
          const topo = y(Math.max(b.ini, b.fim));
          const alt = Math.max(1.5, Math.abs(y(b.ini) - y(b.fim)));
          return (
            <g key={b.id}>
              <rect x={x + folga} width={larg - 2 * folga} y={topo} height={alt} fill={cor(b)} opacity={0.85} />
              {i < barras.length - 1 && <line x1={x + larg - folga} x2={x + larg + folga} y1={y(b.fim)} y2={y(b.fim)} stroke="var(--cor-mineral)" strokeDasharray="3 3" />}
              <text x={x + larg / 2} y={topo - 6} textAnchor="middle" fontSize={fs} fill="var(--cor-carvao)">
                {sinal(b.valor, 2)}
              </text>
              <text x={x + larg / 2} y={H - 10} textAnchor="middle" fontSize={fs - 1} fill="var(--cor-carvao-muted)">
                {estreito ? b.minimo : b.curto}
              </text>
            </g>
          );
        })}
        <g>
          <line x1={M.e + (n - 1) * larg - folga} x2={M.e + (n - 1) * larg + folga} y1={y(total)} y2={y(total)} stroke="var(--cor-mineral)" strokeDasharray="3 3" />
          <rect x={M.e + (n - 1) * larg + folga} width={larg - 2 * folga} y={y(Math.max(0, total))} height={Math.max(1.5, Math.abs(y(0) - y(total)))} fill="var(--cor-carvao)" />
          <text x={M.e + (n - 1) * larg + larg / 2} y={y(Math.max(0, total)) - 6} textAnchor="middle" fontSize={fs} fontWeight={600} fill="var(--cor-carvao)">
            {sinal(total, 2)}
          </text>
          <text x={M.e + (n - 1) * larg + larg / 2} y={H - 10} textAnchor="middle" fontSize={fs - 1} fontWeight={600} fill="var(--cor-carvao)">
            {estreito ? tx("Total", "Total") : tx("Diferença", "Difference")}
          </text>
        </g>
      </svg>
    );
  };
  return (
    <div className="space-y-3">
      <div className="sm:hidden">{desenho(360, 12, true)}</div>
      <div className="hidden sm:block">{desenho(640, 13, false)}</div>
      <p className="text-xs text-carvao-muted">
        {tx(
          "Pontos (log × 100). Verde-azulado: partes do modelo; marrom: resíduo; preto: diferença real.",
          "Points (log × 100). Teal: model parts; brown: residual; black: actual difference.",
        )}
      </p>
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
        {tx(
          `De ${dataBR(d.inicio)} a ${dataBR(d.fim)}, contra ${dataBR(d.inicio_ant)} a ${dataBR(d.fim_ant)}: a carga ficou ${sinal(total, 2)} pontos, uma variação de ${sinal(d.variacao_real_pct, 2)}%. Calendário, temperatura e estação somam ${sinal(p.clima, 2)}; nível e tendência, ${sinal(p.nivelTendencia, 2)}; o resíduo, o que o modelo não reproduz, ${sinal(p.residuo, 2)}.`,
          `From ${dataBR(d.inicio)} to ${dataBR(d.fim)}, against ${dataBR(d.inicio_ant)} to ${dataBR(d.fim_ant)}: the load was ${sinal(total, 2)} points, a change of ${sinal(d.variacao_real_pct, 2)}%. Calendar, temperature and season add up to ${sinal(p.clima, 2)}; level and trend, ${sinal(p.nivelTendencia, 2)}; the residual, what the model does not reproduce, ${sinal(p.residuo, 2)}.`,
        )}
      </p>
    </div>
  );
}

export function CargaCascata({ a07 }: { a07: Pick<A07, "decomposicao"> }) {
  const idioma = idiomaEnergia();
  const itens = REGIOES.map((sm) => ({ sm, d: decomposicaoEscolhida(a07, sm, "principal", "equivalente") })).filter((x): x is { sm: (typeof REGIOES)[number]; d: DecomposicaoA07 } => x.d !== null);
  if (!itens.length) return null;
  return (
    <ModeloDidatico
      id="peca-por-peca"
      nivelTitulo={3}
      titulo={tx("Peça por peça: da carga de um ano antes à carga de agora", "Piece by piece: from the load a year earlier to the load now")}
      intro={tx(
        <>
          A cascata começa no zero, que é a carga dos mesmos dias da semana um ano antes. Cada coluna soma ou tira os pontos que o modelo associa a uma peça: o calendário
          (feriados e dias úteis), a temperatura, a estação do ano e o nível e tendência da carga. O que sobra é o resíduo. A última coluna é a diferença real, e as peças somadas
          chegam a ela.
        </>,
        <>
          The waterfall starts at zero, which is the load on the same days of the week a year earlier. Each column adds or removes the points the model associates with a piece:
          the calendar (holidays and working days), the temperature, the season and the level and trend of the load. What is left is the residual. The last column is the actual
          difference, and the pieces added together reach it.
        </>,
      )}
      deixaDeFora={[
        tx(
          "Cada peça é associação estatística, não causa: o modelo diz quanto a previsão muda com a peça, não por que a carga mudou.",
          "Each piece is a statistical association, not a cause: the model says how much the prediction changes with the piece, not why the load changed.",
        ),
        tx(
          "O resíduo junta tudo o que o modelo não vê: atividade, micro e minigeração, revisões da carga e erro da temperatura de reanálise.",
          "The residual gathers everything the model does not see: activity, micro and mini generation, load revisions and error in the reanalysis temperature.",
        ),
        tx(
          "Mostra só a variante principal e a comparação com os mesmos dias da semana; as outras variantes estão no seletor do painel, em Analisar.",
          "It shows only the main variant and the comparison with the same days of the week; the other variants are in the panel selector, under Analyze.",
        ),
      ]}
      fonte={tx(
        "Decomposição estatística do observatório (variante principal, mesmos dias da semana) sobre a carga diária do ONS e a temperatura da NASA POWER; os mesmos números da faixa de métricas e do gráfico de partes.",
        "The observatory's statistical breakdown (main variant, same days of the week) on ONS daily load and NASA POWER temperature; the same figures as the metrics strip and the parts chart.",
      )}
    >
      <AlternarExemplos rotulo={tx("Região", "Region")} nome="cascata-regiao" opcoes={itens.map((x) => ({ id: x.sm, rotulo: nomeRegiao(x.sm, idioma) }))}>
        {itens.map((x) => (
          <Cascata key={x.sm} d={x.d} />
        ))}
      </AlternarExemplos>
    </ModeloDidatico>
  );
}
