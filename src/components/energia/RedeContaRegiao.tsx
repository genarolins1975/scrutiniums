import { AlternarExemplos } from "@/components/energia/AlternarExemplos";
import { ModeloDidatico } from "@/components/energia/Didatica";
import { dataBR, mesAno, num } from "@/lib/energia/formato";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { nomeSm } from "@/lib/energia/rede";
import type { BalancoRede, SubsistemaOuSin } from "@/lib/energia/tipos-rede";

/**
 * Artefato "a conta de uma região" da página Balanço e exterior: as duas contas que o painel confere hora a hora, mostradas com as somas de
 * um mês completo do mesmo arquivo (balanco.mensal). Geração menos carga dá o saldo da região no balanço; esse saldo tem de ser igual ao que
 * passou pelas fronteiras e pelo exterior. O que sobra em cada conta é o resíduo. Nenhum número é calculado além de subtração e comparação.
 */

const REGIOES: readonly SubsistemaOuSin[] = ["SIN", "SE", "S", "NE", "N"];

function Barra({ valor, max, cor, rotulo }: { valor: number; max: number; cor: string; rotulo: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
      <span className="text-xs text-carvao-muted">{rotulo}</span>
      <div className="h-6 bg-papel" aria-hidden="true">
        <div className="h-6" style={{ width: `${Math.max(0.5, (100 * Math.abs(valor)) / (max || 1))}%`, background: cor }} />
      </div>
    </div>
  );
}

function Conta({ b, sm, k }: { b: BalancoRede; sm: SubsistemaOuSin; k: number }) {
  const m = b.mensal.por_sm[sm];
  const ger = m.geracao_mwh[k];
  const car = m.carga_mwh[k];
  const int = m.intercambio_mwh[k];
  const resB = m.residuo_balanco_mwh[k];
  const intP = m.intercambio_perimetro_mwh[k];
  const fro = m.fronteiras_exterior_mwh[k];
  const resP = m.residuo_perimetro_mwh[k];
  const horas = m.horas[k];
  const horasResB = m.horas_residuo_balanco[k];
  const horasResP = m.horas_residuo_perimetro[k];
  if ([ger, car, int, fro].some((x) => x === null || x === undefined)) {
    return <p className="text-sm text-carvao-muted">{tx("Mês sem as quatro parcelas publicadas para esta região.", "Month without the four parts published for this region.")}</p>;
  }
  const g = ger as number;
  const c = car as number;
  const i = int as number;
  const f = fro as number;
  const max = Math.max(g, c);
  const papel =
    sm === "SIN"
      ? i >= 0
        ? tx("o país exportou para os vizinhos", "the country exported to its neighbors")
        : tx("o país importou dos vizinhos", "the country imported from its neighbors")
      : i >= 0
        ? tx("a região mandou energia para as outras", "the region sent energy to the others")
        : tx("a região recebeu energia das outras", "the region received energy from the others");
  // maior resíduo mensal da região no balanço interno, em módulo (só meses com resíduo)
  const residuos = m.residuo_balanco_mwh.map((v, j) => ({ v, j })).filter((x): x is { v: number; j: number } => x.v !== null && x.v !== 0);
  const pior = residuos.length ? residuos.reduce((a, x) => (Math.abs(x.v) > Math.abs(a.v) ? x : a)) : null;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Barra valor={g} max={max} cor="#0E6170" rotulo={tx(`Geração: ${num(g, 0)} MWh`, `Generation: ${num(g, 0)} MWh`)} />
        <Barra valor={c} max={max} cor="#966B48" rotulo={tx(`Carga: ${num(c, 0)} MWh`, `Load: ${num(c, 0)} MWh`)} />
      </div>
      <ol className="space-y-3 text-sm leading-relaxed text-carvao">
        <li>
          <span className="rotulo mr-2 text-mineral">{tx("Conta 1, balanço interno", "Account 1, internal balance")}</span>
          {tx(
            `Geração menos carga: ${num(g, 0)} − ${num(c, 0)} = ${num(g - c, 0)} MWh. O intercâmbio publicado no mesmo balanço é ${num(i, 0)} MWh: ${papel}. Resíduo: ${num(resB, 0)} MWh${horasResB ? `, em ${num(horasResB, 0)} de ${num(horas, 0)} horas` : ""}.`,
            `Generation minus load: ${num(g, 0)} − ${num(c, 0)} = ${num(g - c, 0)} MWh. The interchange published in the same balance is ${num(i, 0)} MWh: ${papel}. Residual: ${num(resB, 0)} MWh${horasResB ? `, in ${num(horasResB, 0)} of ${num(horas, 0)} hours` : ""}.`,
          )}
        </li>
        <li>
          <span className="rotulo mr-2 text-mineral">{tx("Conta 2, perímetro", "Account 2, perimeter")}</span>
          {tx(
            `O intercâmbio do balanço (${num(intP, 0)} MWh) contra o que passou pelas fronteiras${sm === "S" || sm === "SIN" ? " e pelo exterior" : ""} (${num(f, 0)} MWh). Resíduo: ${num(resP, 0)} MWh${horasResP ? `, em ${num(horasResP, 0)} horas` : ""}.`,
            `The balance interchange (${num(intP, 0)} MWh) against what passed over the boundaries${sm === "S" || sm === "SIN" ? " and the exterior" : ""} (${num(f, 0)} MWh). Residual: ${num(resP, 0)} MWh${horasResP ? `, in ${num(horasResP, 0)} hours` : ""}.`,
          )}
        </li>
      </ol>
      {pior && (
        <p className="text-xs leading-relaxed text-carvao-muted">
          {tx(
            `Mês com o maior resíduo mensal desta região no balanço interno: ${mesAno(b.mensal.meses[pior.j])}, ${num(pior.v, 0)} MWh. A fonte não informa a causa.`,
            `Month with this region's largest monthly residual in the internal balance: ${mesAno(b.mensal.meses[pior.j])}, ${num(pior.v, 0)} MWh. The source does not state the cause.`,
          )}
        </p>
      )}
    </div>
  );
}

export function RedeContaRegiao({ b }: { b: BalancoRede }) {
  const idioma = idiomaEnergia();
  // último mês com todas as horas no SIN (o mês corrente, parcial, fica de fora)
  let k = b.mensal.meses.length - 1;
  const sin = b.mensal.por_sm.SIN;
  const horasDoMes = (m: string) => {
    const [a, mm] = m.split("-").map(Number);
    return new Date(Date.UTC(a, mm, 0)).getUTCDate() * 24;
  };
  while (k >= 0 && (sin.horas_completas[k] === null || sin.horas_completas[k] !== horasDoMes(b.mensal.meses[k]))) k--;
  if (k < 0) return null;
  const mes = b.mensal.meses[k];
  return (
    <ModeloDidatico
      id="conta-de-uma-regiao"
      nivelTitulo={3}
      titulo={tx(`A conta de uma região em ${mesAno(mes)}`, `The account of a region in ${mesAno(mes)}`)}
      intro={tx(
        <>
          A energia que uma região gera e não consome sai pelas linhas para as outras; a que falta entra por elas. Por isso, num mês inteiro, geração menos carga deve dar o
          intercâmbio da região (conta 1), e esse intercâmbio deve ser igual ao que passou pelas fronteiras e, no Sul, pelo exterior (conta 2). O painel faz as duas contas hora a
          hora; aqui, a soma do mês.
        </>,
        <>
          The energy a region generates and does not consume leaves over the lines to the others; what it lacks comes in over them. So, over a whole month, generation minus load
          should give the region&apos;s interchange (account 1), and that interchange should equal what passed over the boundaries and, in the South, the exterior (account 2).
          The panel does both accounts hour by hour; here, the month&apos;s sum.
        </>,
      )}
      deixaDeFora={[
        tx(
          "Nenhuma das contas tem termo de perdas: o balanço publicado não traz as perdas como parcela própria.",
          "Neither account has a losses term: the published balance does not carry losses as a part of its own.",
        ),
        tx(
          "Somar o mês esconde horas: um mês com resíduo zero pode ter horas que não fecham e se compensam; a contagem de horas está no painel.",
          "Adding up the month hides hours: a month with zero residual may have hours that do not close and offset each other; the hour count is in the panel.",
        ),
        ...(b.quebras[0]
          ? [
              tx(
                `Desde ${dataBR(b.quebras[0].dia)} a geração solar e a carga incluem a micro e minigeração estimada pelo ONS, dos dois lados da conta.`,
                `Since ${dataBR(b.quebras[0].dia)} solar generation and load include the micro and mini generation estimated by ONS, on both sides of the account.`,
              ),
            ]
          : []),
      ]}
      fonte={tx(
        `ONS, Balanço de Energia nos Subsistemas, Intercâmbios Entre Subsistemas e Intercâmbio do SIN com Outros Países, somas de ${mesAno(mes)}; o mesmo arquivo do gráfico de resíduo mensal.`,
        `ONS, Energy Balance in the Subsystems, Interchanges Between Subsystems and SIN Interchange with Other Countries, sums for ${mesAno(mes)}; the same file as the monthly residual chart.`,
      )}
    >
      <AlternarExemplos rotulo={tx("Região", "Region")} nome="conta-regiao" opcoes={REGIOES.map((sm) => ({ id: sm, rotulo: nomeSm(sm, idioma) }))}>
        {REGIOES.map((sm) => (
          <Conta key={sm} b={b} sm={sm} k={k} />
        ))}
      </AlternarExemplos>
    </ModeloDidatico>
  );
}
