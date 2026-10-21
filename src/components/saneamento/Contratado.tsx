"use client";

import { useId, useState } from "react";
import { GraficoLinhas, type SerieLinha } from "@/components/energia/GraficoLinhas";
import { inteiro, numero } from "@/lib/saneamento/formato";
import { ANO_CENSO_2010, ANO_CENSO_2022, ANO_PRAZO } from "@/lib/saneamento/laboratorios";
import { ROTULO_INDICADOR, serieAnual, type Contrato, type Indicador } from "@/lib/saneamento/contratos-base";

/**
 * Peças interativas do capítulo 15 (contratado desde o novo marco). As curvas de metas leem só a gold. O laboratório é
 * modelo didático: as áreas com meta transcrita chegam exatamente à meta contratual de 2033 e o restante do país anda no
 * ritmo que o leitor escolhe; o resultado é uma conta aritmética sobre o Censo, não previsão nem aferição.
 */

const CORES: Record<Indicador, string> = { ICA: "var(--cor-obee)", ICE: "var(--serie-comp-1)", IEC: "var(--serie-comp-3)", IPL: "var(--cor-carvao)" };

export function CurvaMetas({ contrato, anoLegal }: { contrato: Contrato; anoLegal: number }) {
  const indicadores = Array.from(new Set(contrato.metas.map((m) => m.indicador))) as Indicador[];
  const ate = Math.max(anoLegal, contrato.ultimo_ano_meta ?? anoLegal);
  const series: SerieLinha[] = indicadores.map((i) => ({ id: i, rotulo: ROTULO_INDICADOR[i], sigla: i, cor: CORES[i] }));
  const anos = new Set<number>();
  const porInd = Object.fromEntries(indicadores.map((i) => [i, new Map(serieAnual(contrato, i, ate).map((p) => [p.ano, p.valor]))])) as Record<Indicador, Map<number, number | null>>;
  for (const i of indicadores) for (const a of porInd[i].keys()) anos.add(a);
  const dados = Array.from(anos)
    .sort((a, b) => a - b)
    .map((ano) => ({ x: String(ano), ...Object.fromEntries(indicadores.map((i) => [i, porInd[i].get(ano) ?? null])) }));
  return (
    <GraficoLinhas
      titulo={`${contrato.nome}: metas contratuais por ano (anos sem linha no contrato repetem a última meta, como o próprio contrato prevê)`}
      nomesNoTitulo={[contrato.nome]}
      dados={dados}
      chaveX="x"
      formatoX="texto"
      series={series}
      unidade="%"
      casas={0}
      zeroNoEixo
      marcos={[{ x: String(anoLegal), rotulo: `Meta legal: ${anoLegal}` }]}
    />
  );
}

export type Servico = "agua" | "esgoto";
export type TrajetoriaBr = { pop22: number; agua: { v2010: number; v2022: number }; esgoto: { v2010: number; v2022: number } };
export type AreaLab = { id: string; nome: string; pop22: number; agua: { v2022: number; meta2033: number | null } | null; esgoto: { v2022: number; meta2033: number | null } | null };

const ROTULO_SERVICO: Record<Servico, string> = { agua: "Água: moradores com rede geral", esgoto: "Esgoto: moradores com rede geral ou pluvial" };

/** Conta do laboratório. Exportada para o teste: tudo é aritmética sobre populações e percentuais do Censo. */
export function cenario2033(br: TrajetoriaBr, areas: AreaLab[], servico: Servico, ritmo: number) {
  const dt = ANO_PRAZO - ANO_CENSO_2022;
  const t = br[servico];
  const validas = areas.filter((a) => a[servico] && a[servico]!.meta2033 != null && a.pop22 > 0);
  const popAreas = validas.reduce((s, a) => s + a.pop22, 0);
  const popResto = Math.max(0, br.pop22 - popAreas);
  const vResto2022 = popResto > 0 ? (t.v2022 * br.pop22 - validas.reduce((s, a) => s + a[servico]!.v2022 * a.pop22, 0)) / popResto : t.v2022;
  const resto2033 = Math.min(100, Math.max(0, vResto2022 + ritmo * dt));
  const semContratos = Math.min(100, Math.max(0, t.v2022 + ritmo * dt));
  const areas2033 = validas.reduce((s, a) => s + Math.max(a[servico]!.meta2033!, Math.min(100, a[servico]!.v2022)) * a.pop22, 0);
  const comContratos = br.pop22 > 0 ? (areas2033 + resto2033 * popResto) / br.pop22 : semContratos;
  const observado = (t.v2022 - t.v2010) / (ANO_CENSO_2022 - ANO_CENSO_2010);
  return { validas, popAreas, popResto, vResto2022, resto2033, semContratos, comContratos, observado, dt };
}

export function LabContratado({ brasil, areas, metas }: { brasil: TrajetoriaBr; areas: AreaLab[]; metas: { agua: number; esgoto: number } }) {
  const idSel = useId();
  const idRitmo = useId();
  const [servico, setServico] = useState<Servico>("esgoto");
  const observado = (brasil[servico].v2022 - brasil[servico].v2010) / (ANO_CENSO_2022 - ANO_CENSO_2010);
  const [ritmo, setRitmo] = useState(Math.max(0, Math.round(observado * 100) / 100));
  const [chave, setChave] = useState(servico);
  if (chave !== servico) {
    setChave(servico);
    setRitmo(Math.max(0, Math.round(observado * 100) / 100));
  }
  const r = cenario2033(brasil, areas, servico, ritmo);
  const meta = metas[servico];
  const pct = (v: number) => `${numero(v, 1)}%`;
  const max = Math.max(3, Math.ceil(((meta - brasil[servico].v2022) / r.dt) * 1.5 * 100) / 100);
  return (
    <div className="border border-linha bg-superficie p-5 md:p-6">
      <p className="rotulo text-mineral">Modelo didático</p>
      <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        Se todas as áreas com meta contratual transcrita chegarem exatamente à meta de {ANO_PRAZO - 1} e o restante do país andar no ritmo escolhido, onde
        o Brasil estará em 31/12/{ANO_PRAZO - 1}? A conta usa a cobertura por rede do Censo (2010 e 2022) ponderada pela população de 2022; ICA e ICE
        contratuais não são o mesmo conceito, e a meta legal é {numero(meta, 0)}%.
      </p>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={idSel} className="block text-sm text-carvao">
            Serviço
          </label>
          <select id={idSel} value={servico} onChange={(e) => setServico(e.target.value as Servico)} className="block min-h-[44px] w-full border border-linha bg-superficie px-3 text-sm">
            <option value="esgoto">{ROTULO_SERVICO.esgoto}</option>
            <option value="agua">{ROTULO_SERVICO.agua}</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={idRitmo} className="flex items-baseline justify-between gap-3 text-sm text-carvao">
            <span>Ritmo do restante do país, em pontos percentuais por ano</span>
            <span className="shrink-0 font-medium tabular-nums">{numero(ritmo, 2)} p.p./ano</span>
          </label>
          <input
            id={idRitmo}
            type="range"
            min={0}
            max={max}
            step={0.01}
            value={ritmo}
            aria-valuetext={`${numero(ritmo, 2)} pontos percentuais por ano`}
            onChange={(e) => setRitmo(Number(e.target.value))}
            className="block min-h-[44px] w-full accent-obee"
          />
          <p className="text-xs leading-relaxed text-carvao-muted">
            Ritmo observado entre os Censos de 2010 e 2022: {numero(observado, 2)} p.p. por ano. Ritmo exigido para a meta legal sem contratos:{" "}
            {numero(Math.max(0, (meta - brasil[servico].v2022) / r.dt), 2)} p.p. por ano.
          </p>
        </div>
      </div>
      <dl className="mt-6 grid gap-x-8 border-t border-carvao sm:grid-cols-3" data-lab-contratado="">
        <div className="border-b border-linha py-4">
          <dt className="text-sm text-carvao-muted">Brasil em {ANO_PRAZO - 1}, só no ritmo escolhido</dt>
          <dd className="mt-1 font-serif text-[1.8rem] leading-none tabular-nums text-carvao" data-sem-contratos="">
            {pct(r.semContratos)}
          </dd>
        </div>
        <div className="border-b border-linha py-4">
          <dt className="text-sm text-carvao-muted">Brasil em {ANO_PRAZO - 1}, com as metas contratadas cumpridas</dt>
          <dd className={`mt-1 ${r.validas.length ? "font-serif text-[1.8rem] leading-none tabular-nums text-carvao" : "text-sm leading-snug text-carvao-muted"}`} data-com-contratos="">
            {r.validas.length ? pct(r.comContratos) : "sem contrato com metas transcritas e abrangência nesta publicação"}
          </dd>
        </div>
        <div className="border-b border-linha py-4">
          <dt className="text-sm text-carvao-muted">Pessoas nas áreas com meta transcrita e abrangência</dt>
          <dd className="mt-1 font-serif text-[1.8rem] leading-none tabular-nums text-carvao">
            {r.validas.length ? `${numero(r.popAreas / 1e6, 1)} mi` : "0"}
          </dd>
          <dd className="mt-1 text-xs text-carvao-muted">
            {r.validas.length ? `${numero((100 * r.popAreas) / brasil.pop22, 1)}% dos moradores de 2022, em ${inteiro(r.validas.length)} ${r.validas.length === 1 ? "bloco" : "blocos"}` : "nenhum bloco com meta e composição municipal pública nesta publicação"}
          </dd>
        </div>
      </dl>
      <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao">
        {r.validas.length
          ? `No ritmo de ${numero(ritmo, 2)} p.p. por ano, o restante do país sairia de ${pct(r.vResto2022)} em 2022 para ${pct(r.resto2033)}; com as áreas contratadas na meta, o Brasil ficaria em ${pct(r.comContratos)}, contra ${pct(r.semContratos)} sem os contratos. A meta legal é ${numero(meta, 0)}%.`
          : `Sem bloco com meta transcrita e composição municipal pública, o modelo só mostra o ritmo: ${pct(r.semContratos)} em ${ANO_PRAZO - 1}. A meta legal é ${numero(meta, 0)}%.`}
      </p>
      <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        O que fica de fora: contratos sem meta transcrita ou sem composição pública dos municípios; a diferença entre cobertura por rede (Censo), ICA e
        ICE (contrato) e atendimento (SINISA); repactuações e aditivos; o cumprimento real, que só a aferição do regulador pode dizer.
      </p>
    </div>
  );
}
