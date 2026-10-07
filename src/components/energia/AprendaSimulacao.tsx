"use client";

import { useId, useState, type ReactNode } from "react";
import { num, pct, reais } from "@/lib/energia/formato";
import { AVISO_SINTETICO, ROTULO_SINTETICO } from "@/lib/energia/sintetico";

/**
 * Exemplos sintéticos das trilhas do Aprenda (seção 9.16): pequenas contas que ensinam a
 * relação entre conceitos com valores hipotéticos escolhidos pelo leitor. O rótulo de
 * exemplo sintético fica no topo do quadro e ao lado de cada resultado o tempo todo; os
 * valores não vêm da gold, não usam selo de natureza, não vão para a URL nem para a
 * telemetria e não alimentam nenhum indicador do observatório.
 */

function Quadro({ titulo, simplificacao, children }: { titulo: string; simplificacao: string; children: ReactNode }) {
  return (
    <section data-sintetico="true" aria-label={`${ROTULO_SINTETICO}: ${titulo}`} className="border-2 border-dashed border-mineral bg-papel">
      <p
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-dashed border-mineral px-4 py-2 text-sm"
        style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 6px, rgba(0,0,0,0.035) 6px 12px)" }}
      >
        <span className="rotulo text-carvao">{ROTULO_SINTETICO}</span>
        <span className="text-carvao-muted">{AVISO_SINTETICO}</span>
      </p>
      <div className="space-y-4 p-4 sm:p-5">
        <h3 className="font-serif text-xl text-carvao">{titulo}</h3>
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
}: {
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo: number;
  formato: (v: number) => string;
  definir: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm">
      <label htmlFor={id} className="flex items-baseline justify-between gap-3">
        <span className="rotulo text-mineral">{rotulo}</span>
        <span className="tabular-nums text-carvao">{formato(valor)}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        aria-valuetext={formato(valor)}
        onChange={(e) => definir(Number(e.target.value))}
        className="min-h-[44px] w-full accent-energia"
      />
    </div>
  );
}

function Resultado({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="border border-linha bg-superficie p-3" data-resultado-sintetico="true" aria-live="polite" aria-atomic="true">
      <p className="rotulo text-mineral">
        {rotulo} <span className="text-carvao-muted">· sintético</span>
      </p>
      <p className="mt-1 font-serif text-2xl tabular-nums text-carvao">
        {valor}
      </p>
      {detalhe && <p className="mt-1 text-xs leading-relaxed text-carvao-muted">{detalhe}</p>}
    </div>
  );
}

const MWH = (v: number) => `${num(v, 0)} MWh`;
const RMWH = (v: number) => `${reais(v, 0)}/MWh`;

/** Piso e teto horário hipotéticos, em números redondos, para não parecerem os vigentes. */
const PISO = 60;
const TETO = 1600;

export function SimulacaoLiquidacao() {
  const [cmo, setCmo] = useState(250);
  const [contratado, setContratado] = useState(100);
  const [verificado, setVerificado] = useState(110);
  const preco = Math.min(Math.max(cmo, PISO), TETO);
  const limitado = preco !== cmo;
  const dif = verificado - contratado;
  const valor = Math.abs(dif) * preco;
  return (
    <Quadro
      titulo="Do CMO ao PLD e à liquidação da diferença"
      simplificacao={`Simplificação pedagógica. O piso (${RMWH(PISO)}) e o teto horário (${RMWH(TETO)}) são hipotéticos; o teto estrutural, que limita a média do dia, fica de fora. O balanço real de cada perfil de agente segue as Regras de Comercialização da CCEE, não conferidas nesta fase: aqui aparece só a ideia de liquidar a diferença entre o contratado e o verificado ao preço da hora.`}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Controle rotulo="CMO hipotético da hora" valor={cmo} min={0} max={2400} passo={10} formato={RMWH} definir={setCmo} />
        <Controle rotulo="Energia contratada na hora" valor={contratado} min={0} max={200} passo={5} formato={MWH} definir={setContratado} />
        <Controle rotulo="Energia consumida na hora" valor={verificado} min={0} max={200} passo={5} formato={MWH} definir={setVerificado} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Resultado
          rotulo="Preço da hora"
          valor={RMWH(preco)}
          detalhe={
            limitado
              ? `O CMO hipotético (${RMWH(cmo)}) ficou ${cmo > TETO ? "acima do teto" : "abaixo do piso"}: vale o limite, e o preço difere do CMO.`
              : "Dentro do piso e do teto, o preço acompanha o CMO hipotético."
          }
        />
        <Resultado
          rotulo={dif > 0 ? "Diferença comprada ao preço da hora" : dif < 0 ? "Sobra vendida ao preço da hora" : "Sem diferença a liquidar"}
          valor={dif === 0 ? reais(0) : `${dif > 0 ? "paga" : "recebe"} ${reais(valor)}`}
          detalhe={`${MWH(Math.abs(dif))} × ${RMWH(preco)}. ${dif > 0 ? "Consumiu mais do que contratou." : dif < 0 ? "Consumiu menos do que contratou." : "Consumo igual ao contratado."}`}
        />
      </div>
    </Quadro>
  );
}

const KWH = (v: number) => `${num(v, 0)} kWh`;
const RKWH = (v: number) => `${reais(v, 2)}/kWh`;
const BANDEIRAS = [
  { id: "verde", rotulo: "Verde, sem acréscimo", acrescimo: 0 },
  { id: "a", rotulo: "Acréscimo hipotético de R$ 0,02/kWh", acrescimo: 0.02 },
  { id: "b", rotulo: "Acréscimo hipotético de R$ 0,05/kWh", acrescimo: 0.05 },
] as const;

export function SimulacaoConta() {
  const [kwh, setKwh] = useState(150);
  const [tarifa, setTarifa] = useState(0.8);
  const [band, setBand] = useState<(typeof BANDEIRAS)[number]["id"]>("verde");
  const [renda, setRenda] = useState(1500);
  const nome = useId();
  const acrescimo = BANDEIRAS.find((b) => b.id === band)!.acrescimo;
  const parteTarifa = kwh * tarifa;
  const parteBandeira = kwh * acrescimo;
  const total = parteTarifa + parteBandeira;
  const peso = renda > 0 ? (100 * total) / renda : null;
  const fracBandeira = total > 0 ? parteBandeira / total : 0;
  return (
    <Quadro
      titulo="Da tarifa à conta e ao peso no orçamento"
      simplificacao="Simplificação pedagógica. A tarifa e os acréscimos de bandeira são hipotéticos. A conta fica sem tributos (PIS/Cofins, ICMS e contribuição de iluminação pública entram além da tarifa), sem custo de disponibilidade e sem desconto da Tarifa Social. O peso no orçamento divide a conta sintética pela renda escolhida; no observatório, o peso medido vem da POF, não desta conta."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Controle rotulo="Consumo no mês" valor={kwh} min={0} max={500} passo={10} formato={KWH} definir={setKwh} />
        <Controle rotulo="Tarifa hipotética (TE + TUSD)" valor={tarifa} min={0.5} max={1.2} passo={0.01} formato={RKWH} definir={setTarifa} />
        <Controle rotulo="Renda mensal hipotética" valor={renda} min={500} max={10000} passo={100} formato={(v) => reais(v, 0)} definir={setRenda} />
      </div>
      <fieldset className="text-sm">
        <legend className="rotulo text-mineral">Bandeira do mês</legend>
        <div className="mt-1 flex flex-wrap gap-x-5">
          {BANDEIRAS.map((b) => (
            <label key={b.id} className="inline-flex min-h-[44px] items-center gap-2 text-carvao">
              <input type="radio" name={nome} value={b.id} checked={band === b.id} onChange={() => setBand(b.id)} className="accent-energia" />
              {b.rotulo}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Resultado
          rotulo="Conta sem tributos"
          valor={reais(total)}
          detalhe={`${KWH(kwh)} × ${RKWH(tarifa)}${acrescimo ? ` + ${KWH(kwh)} × ${RKWH(acrescimo)} da bandeira` : ""}.`}
        />
        <Resultado rotulo="Peso no orçamento" valor={peso === null ? "sem renda" : pct(peso, 1)} detalhe={`${reais(total)} ÷ ${reais(renda, 0)}.`} />
      </div>
      <div aria-hidden="true" className="flex h-3 w-full overflow-hidden border border-linha">
        <span className="h-full bg-energia" style={{ width: `${100 * (1 - fracBandeira)}%` }} />
        <span className="h-full" style={{ width: `${100 * fracBandeira}%`, backgroundImage: "repeating-linear-gradient(135deg, var(--cor-energia) 0 2px, transparent 2px 5px)" }} />
      </div>
      <p className="text-xs text-carvao-muted">
        Barra: parte da tarifa (cheia) e parte da bandeira (hachurada) na conta sintética
        {acrescimo ? `, ${pct(100 * fracBandeira, 1)} da bandeira` : ", sem bandeira"}.
      </p>
    </Quadro>
  );
}
