"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { formatos } from "@/lib/energia/formato";
import { AVISO_SINTETICO, ROTULO_SINTETICO } from "@/lib/energia/sintetico";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * Exemplos sintéticos das trilhas do Aprenda (seção 9.16): pequenas contas que ensinam a
 * relação entre conceitos com valores hipotéticos escolhidos pelo leitor. O rótulo de
 * exemplo sintético fica no topo do quadro e ao lado de cada resultado o tempo todo; os
 * valores não vêm da gold, não usam selo de natureza, não vão para a URL nem para a
 * telemetria e não alimentam nenhum indicador do observatório.
 */

/** Falso até a hidratação: sem JavaScript os controles ficam desligados em vez de parecerem funcionar. */
function usePronto(): boolean {
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return pronto;
}

/** Rótulo e aviso do exemplo sintético no idioma da página (o português é o de sintetico.ts). */
function useSintetico(): { rotulo: string; aviso: string } {
  const tx = useTx();
  return {
    rotulo: tx(ROTULO_SINTETICO, "Synthetic example"),
    aviso: tx(AVISO_SINTETICO, "Hypothetical values, chosen for teaching. They are not observatory data and do not enter any indicator."),
  };
}

function Quadro({ titulo, simplificacao, children }: { titulo: string; simplificacao: string; children: ReactNode }) {
  const tx = useTx();
  const sintetico = useSintetico();
  return (
    <section data-sintetico="true" aria-label={`${sintetico.rotulo}: ${titulo}`} className="border-2 border-dashed border-mineral bg-papel">
      <p
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-dashed border-mineral px-4 py-2 text-sm"
        style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 6px, rgba(0,0,0,0.035) 6px 12px)" }}
      >
        <span className="rotulo text-carvao">{sintetico.rotulo}</span>
        <span className="text-carvao-muted">{sintetico.aviso}</span>
      </p>
      <div className="space-y-4 p-4 sm:p-5">
        <h3 className="font-serif text-xl text-carvao">{titulo}</h3>
        <noscript>
          <p className="border border-dashed border-mineral p-3 text-sm text-carvao">
            {tx(
              "Este exemplo precisa de JavaScript para recalcular os resultados; sem ele, os controles ficam desligados e os valores abaixo são os iniciais.",
              "This example needs JavaScript to recalculate the results; without it, the controls are disabled and the values below are the initial ones.",
            )}
          </p>
        </noscript>
        {children}
        <p className="text-xs leading-relaxed text-carvao-muted">{simplificacao}</p>
      </div>
    </section>
  );
}

function Controle({
  rotulo,
  valor,
  min,
  max,
  passo,
  formato,
  definir,
  pronto,
}: {
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo: number;
  formato: (v: number) => string;
  definir: (v: number) => void;
  pronto: boolean;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col justify-end gap-1 text-sm">
      <label htmlFor={id} className="flex items-baseline justify-between gap-3">
        <span className="rotulo text-mineral">{rotulo}</span>
        <span className="whitespace-nowrap tabular-nums text-carvao">{formato(valor)}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        disabled={!pronto}
        aria-valuetext={formato(valor)}
        onChange={(e) => definir(Number(e.target.value))}
        className="min-h-[44px] w-full accent-energia"
      />
    </div>
  );
}

function Resultado({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  const tx = useTx();
  return (
    <div className="border border-linha bg-superficie p-3" data-resultado-sintetico="true" aria-live="polite" aria-atomic="true">
      <p className="rotulo text-mineral">
        {rotulo} <span className="text-carvao-muted">{tx("· sintético", "· synthetic")}</span>
      </p>
      <p className="mt-1 font-serif text-2xl tabular-nums text-carvao">
        {valor}
      </p>
      {detalhe && <p className="mt-1 text-xs leading-relaxed text-carvao-muted">{detalhe}</p>}
    </div>
  );
}

/** Piso e teto horário hipotéticos, em números redondos, para não parecerem os vigentes. */
const PISO = 60;
const TETO = 1600;

export function SimulacaoLiquidacao() {
  const tx = useTx();
  const f = formatos(useIdioma());
  const MWH = (v: number) => `${f.num(v, 0)} MWh`;
  const RMWH = (v: number) => `${f.reais(v, 0)}/MWh`;
  const [cmo, setCmo] = useState(250);
  const [contratado, setContratado] = useState(100);
  const [verificado, setVerificado] = useState(110);
  const pronto = usePronto();
  const preco = Math.min(Math.max(cmo, PISO), TETO);
  const limitado = preco !== cmo;
  const dif = verificado - contratado;
  const valor = Math.abs(dif) * preco;
  return (
    <Quadro
      titulo={tx("Do CMO ao PLD e à liquidação da diferença", "From the CMO to the PLD and the settlement of the difference")}
      simplificacao={tx(
        `Simplificação pedagógica. O piso (${RMWH(PISO)}) e o teto horário (${RMWH(TETO)}) são hipotéticos e não são os vigentes, que estão no verbete Limites do PLD; o teto estrutural, que limita a média do dia, fica de fora. O balanço real de cada perfil de agente segue as Regras de Comercialização da CCEE, não conferidas nesta fase: aqui aparece só a ideia de liquidar a diferença entre o contratado e o verificado ao preço da hora.`,
        `Teaching simplification. The floor (${RMWH(PISO)}) and the hourly ceiling (${RMWH(TETO)}) are hypothetical and are not the ones in force, which are in the PLD limits entry; the structural ceiling, which limits the daily average, is excluded. The actual balance of each agent profile follows the CCEE Trading Rules, not checked in this phase: here only the idea of settling the difference between contracted and verified energy at the hourly price appears.`,
      )}
    >
      <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-enunciado="true">
        {tx(
          `Um agente contratou ${MWH(contratado)} para uma hora e consumiu ${MWH(verificado)}. A diferença, ${MWH(Math.abs(dif))}, é liquidada ao preço da hora, que parte do CMO e respeita o piso e o teto. Mova o CMO acima de ${RMWH(TETO)} ou abaixo de ${RMWH(PISO)} para ver o preço deixar de acompanhá-lo.`,
          `An agent contracted ${MWH(contratado)} for one hour and consumed ${MWH(verificado)}. The difference, ${MWH(Math.abs(dif))}, is settled at the hourly price, which starts from the CMO and respects the floor and the ceiling. Move the CMO above ${RMWH(TETO)} or below ${RMWH(PISO)} to see the price stop following it.`,
        )}
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <Controle pronto={pronto} rotulo={tx("CMO hipotético da hora", "Hypothetical CMO of the hour")} valor={cmo} min={0} max={2400} passo={10} formato={RMWH} definir={setCmo} />
        <Controle pronto={pronto} rotulo={tx("Energia contratada na hora", "Energy contracted in the hour")} valor={contratado} min={0} max={200} passo={5} formato={MWH} definir={setContratado} />
        <Controle pronto={pronto} rotulo={tx("Energia consumida na hora", "Energy consumed in the hour")} valor={verificado} min={0} max={200} passo={5} formato={MWH} definir={setVerificado} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Resultado
          rotulo={tx("Preço da hora", "Hourly price")}
          valor={RMWH(preco)}
          detalhe={
            limitado
              ? tx(
                  `O CMO hipotético (${RMWH(cmo)}) ficou ${cmo > TETO ? "acima do teto" : "abaixo do piso"}: vale o limite, e o preço difere do CMO.`,
                  `The hypothetical CMO (${RMWH(cmo)}) was ${cmo > TETO ? "above the ceiling" : "below the floor"}: the limit applies, and the price differs from the CMO.`,
                )
              : tx("Dentro do piso e do teto, o preço acompanha o CMO hipotético.", "Within the floor and the ceiling, the price follows the hypothetical CMO.")
          }
        />
        <Resultado
          rotulo={
            dif > 0
              ? tx("Diferença comprada ao preço da hora", "Difference bought at the hourly price")
              : dif < 0
                ? tx("Sobra vendida ao preço da hora", "Surplus sold at the hourly price")
                : tx("Sem diferença a liquidar", "No difference to settle")
          }
          valor={dif === 0 ? f.reais(0) : tx(`${dif > 0 ? "paga" : "recebe"} ${f.reais(valor)}`, `${dif > 0 ? "pays" : "receives"} ${f.reais(valor)}`)}
          detalhe={tx(
            `${MWH(Math.abs(dif))} × ${RMWH(preco)}. ${dif > 0 ? "Consumiu mais do que contratou." : dif < 0 ? "Consumiu menos do que contratou." : "Consumo igual ao contratado."}`,
            `${MWH(Math.abs(dif))} × ${RMWH(preco)}. ${dif > 0 ? "It consumed more than it contracted." : dif < 0 ? "It consumed less than it contracted." : "Consumption equal to the contracted amount."}`,
          )}
        />
      </div>
    </Quadro>
  );
}

const BANDEIRAS = [
  { id: "verde", acrescimo: 0 },
  { id: "a", acrescimo: 0.02 },
  { id: "b", acrescimo: 0.05 },
] as const;

export function SimulacaoConta() {
  const tx = useTx();
  const f = formatos(useIdioma());
  const KWH = (v: number) => `${f.num(v, 0)} kWh`;
  const RKWH = (v: number) => `${f.reais(v, 2)}/kWh`;
  // rótulos das bandeiras hipotéticas (os valores são os de BANDEIRAS)
  const rotuloBandeira: Record<(typeof BANDEIRAS)[number]["id"], string> = {
    verde: tx("Verde (sem acréscimo)", "Green (no surcharge)"),
    a: tx("Amarela hipotética: +R$ 0,02/kWh", "Hypothetical yellow: +R$ 0.02/kWh"),
    b: tx("Vermelha hipotética: +R$ 0,05/kWh", "Hypothetical red: +R$ 0.05/kWh"),
  };
  const [kwh, setKwh] = useState(150);
  const [tarifa, setTarifa] = useState(0.8);
  const [band, setBand] = useState<(typeof BANDEIRAS)[number]["id"]>("verde");
  const [renda, setRenda] = useState(1500);
  const pronto = usePronto();
  const nome = useId();
  const acrescimo = BANDEIRAS.find((b) => b.id === band)!.acrescimo;
  const parteTarifa = kwh * tarifa;
  const parteBandeira = kwh * acrescimo;
  const total = parteTarifa + parteBandeira;
  const peso = renda > 0 ? (100 * total) / renda : null;
  const fracBandeira = total > 0 ? parteBandeira / total : 0;
  return (
    <Quadro
      titulo={tx("Da tarifa à conta e ao peso no orçamento", "From the tariff to the bill and the weight in the budget")}
      simplificacao={tx(
        "Simplificação pedagógica. A tarifa e os acréscimos de bandeira são hipotéticos. A conta fica sem tributos (PIS/Cofins, ICMS e contribuição de iluminação pública entram além da tarifa), sem custo de disponibilidade e sem desconto da Tarifa Social. O peso no orçamento divide a conta sintética pela renda escolhida; no observatório, o peso medido vem da POF, não desta conta.",
        "Teaching simplification. The tariff and the tariff flag surcharges are hypothetical. The bill has no taxes (PIS/Cofins, ICMS and the public lighting contribution are charged on top of the tariff), no availability cost and no Tarifa Social discount. The weight in the budget divides the synthetic bill by the income chosen; in the observatory, the measured weight comes from the POF, not from this calculation.",
      )}
    >
      <div className="grid items-start gap-4 md:grid-cols-3">
        <Controle pronto={pronto} rotulo={tx("Consumo no mês", "Consumption in the month")} valor={kwh} min={0} max={500} passo={10} formato={KWH} definir={setKwh} />
        <Controle pronto={pronto} rotulo={tx("Tarifa (TE + TUSD)", "Tariff (TE + TUSD)")} valor={tarifa} min={0.5} max={1.2} passo={0.01} formato={RKWH} definir={setTarifa} />
        <Controle pronto={pronto} rotulo={tx("Renda mensal", "Monthly income")} valor={renda} min={500} max={10000} passo={100} formato={(v) => f.reais(v, 0)} definir={setRenda} />
      </div>
      <fieldset className="text-sm">
        <legend className="rotulo text-mineral">{tx("Bandeira do mês", "Tariff flag of the month")}</legend>
        <div className="mt-1 flex flex-wrap gap-x-5">
          {BANDEIRAS.map((b) => (
            <label key={b.id} className="inline-flex min-h-[44px] items-center gap-2 text-carvao">
              <input type="radio" name={nome} value={b.id} checked={band === b.id} disabled={!pronto} onChange={() => setBand(b.id)} className="accent-energia" />
              {rotuloBandeira[b.id]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Resultado
          rotulo={tx("Conta sem tributos", "Bill without taxes")}
          valor={f.reais(total)}
          detalhe={tx(
            `${KWH(kwh)} × ${RKWH(tarifa)}${acrescimo ? ` + ${KWH(kwh)} × ${RKWH(acrescimo)} da bandeira` : ""}.`,
            `${KWH(kwh)} × ${RKWH(tarifa)}${acrescimo ? ` + ${KWH(kwh)} × ${RKWH(acrescimo)} from the tariff flag` : ""}.`,
          )}
        />
        <Resultado
          rotulo={tx("Peso no orçamento", "Weight in the budget")}
          valor={peso === null ? tx("sem renda", "no income") : f.pct(peso, 1)}
          detalhe={tx(
            `${f.reais(total)} ÷ ${f.reais(renda, 0)}. Não compare com o peso medido pela POF: aqui a renda, a tarifa e a bandeira são hipotéticas.`,
            `${f.reais(total)} ÷ ${f.reais(renda, 0)}. Do not compare with the weight measured by the POF: here the income, the tariff and the tariff flag are hypothetical.`,
          )}
        />
      </div>
      <div aria-hidden="true" className="flex h-3 w-full overflow-hidden border border-linha">
        <span className="h-full bg-energia" style={{ width: `${100 * (1 - fracBandeira)}%` }} />
        <span className="h-full" style={{ width: `${100 * fracBandeira}%`, backgroundImage: "repeating-linear-gradient(135deg, var(--cor-energia) 0 2px, transparent 2px 5px)" }} />
      </div>
      <p className="text-xs text-carvao-muted">
        {tx(
          `Barra: parte da tarifa (cheia) e parte da bandeira (hachurada) na conta sintética${acrescimo ? `, ${f.pct(100 * fracBandeira, 1)} da bandeira` : ", sem bandeira"}.`,
          `Bar: tariff portion (solid) and tariff flag portion (hatched) in the synthetic bill${acrescimo ? `, ${f.pct(100 * fracBandeira, 1)} from the tariff flag` : ", no tariff flag"}.`,
        )}
      </p>
    </Quadro>
  );
}
