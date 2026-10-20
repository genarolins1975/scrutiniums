"use client";

import { useId, useState } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { useSelecaoGas } from "@/components/gas/useSelecaoGas";
import type { PacoteEstados, PacotePoliciaSaude } from "@/lib/eficiencia/seguranca/dados";
import { contagemComUnidade, inteiro, numero, porDenominador, ROTULO_BASE, ROTULO_SITUACAO, sinal, taxaComUnidade, taxaCurta } from "@/lib/eficiencia/seguranca/formato";
import { BRASIL, type Indicador, type SerieBrasil, type SerieUF } from "@/lib/eficiencia/seguranca/tipos";

const COR = "var(--cor-obee)";
const COR_BR = "var(--serie-referencia)";
const COR_SAUDE = "var(--cor-obee-neutro)";

export const ROTULO_GRUPO: Record<string, string> = {
  letalidade: "Violência letal",
  mulheres: "Mulheres e violência sexual",
  patrimonio: "Crimes patrimoniais",
  resposta: "Busca e atividade policial",
  recursos: "Recursos públicos",
};

function anosComDado(p: PacoteEstados, id: string): number[] {
  const br = p.series[id][BRASIL] as SerieBrasil;
  return p.anos.filter((_, k) => br.n[k] !== null);
}

/** Último ano com as 27 UFs (ou, sem nenhum, o último com dado): o padrão do seletor de ano. */
function anoPadrao(p: PacoteEstados, id: string): number {
  const br = p.series[id][BRASIL] as SerieBrasil;
  for (let k = p.anos.length - 1; k >= 0; k--) if (br.situacao[k] === "ok") return p.anos[k];
  return anosComDado(p, id).at(-1) ?? p.anos[p.anos.length - 1];
}

function dadoPreliminar(p: PacoteEstados, i: Indicador, ano: number): boolean {
  return i.fonte === "sim" && p.simSituacao[String(ano)] === "preliminar";
}

/**
 * Comparação entre as 27 UFs num indicador e num ano: taxa por 100 mil (ou contagem, quando a população não é a base de
 * risco), a referência nacional da gold, a posição e a distância de cada UF. Ausência fica como ausência: a UF sai da
 * ordem com a marca "sem dado" e o motivo na tabela. A ordem é da maior para a menor medida e não é nota.
 */
export function PorEstado({ pacote: p, inicial }: { pacote: PacoteEstados; inicial: string }) {
  const ids = p.indicadores.map((i) => i.id);
  const ind = useSelecaoGas("indicador", ids, inicial);
  const i = p.indicadores.find((x) => x.id === ind.valor) ?? p.indicadores[0];
  const anos = anosComDado(p, i.id);
  const anoSel = useSelecaoGas("ano", anos.map(String), String(anoPadrao(p, i.id)));
  const ano = Number(anoSel.valor);
  const ufSel = useSelecaoGas("uf", [BRASIL, ...p.ufs.map((u) => u.sigla)], BRASIL);
  const temTaxa = i.denominador !== null;
  const [modo, setModo] = useState<"taxa" | "n">("taxa");
  const medida: "taxa" | "n" = temTaxa ? modo : "n";
  const k = p.anos.indexOf(ano);
  const br = p.series[i.id][BRASIL] as SerieBrasil;
  const idInd = useId(), idAno = useId(), idUf = useId(), nomeModo = `${useId()}-modo`;
  const pop = (uf: string) => p.populacao[uf][i.denominador === "mulheres" ? "mulheres" : "total"][k];

  const linhas = p.ufs.map((u) => {
    const s = p.series[i.id][u.sigla] as SerieUF;
    return {
      ...u,
      n: s.n[k],
      taxa: s.taxa ? s.taxa[k] : null,
      situacao: s.situacao[k],
      motivo: s.motivo[k],
      posicao: s.posicao ? s.posicao[k] : null,
      diferenca: s.diferenca ? s.diferenca[k] : null,
      razao: s.razao ? s.razao[k] : null,
    };
  });
  const valor = (l: (typeof linhas)[number]) => (medida === "taxa" ? l.taxa : l.n);
  const ordenadas = [...linhas].sort((a, b) => {
    const va = valor(a), vb = valor(b);
    if (va === null && vb === null) return a.nome.localeCompare(b.nome, "pt-BR");
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va || a.nome.localeCompare(b.nome, "pt-BR");
  });
  const ausentes = linhas.filter((l) => l.situacao !== "ok");
  const unidadeGrafico = medida === "taxa" ? (i.escala === 1 ? "R$ por habitante" : porDenominador(i.denominador, i.escala)) : i.fonte === "siconfi" ? "R$" : i.unidade;
  const preliminar = dadoPreliminar(p, i, ano);
  const uf = ufSel.valor;
  const nomeUf = p.ufs.find((u) => u.sigla === uf)?.nome;
  const serieUf = uf === BRASIL ? null : (p.series[i.id][uf] as SerieUF);

  function baixar() {
    const cel = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const cab = ["uf", "nome", "ano", "indicador", "contagem", "unidade", "denominador", "taxa", "taxa_brasil", "diferenca_para_brasil", "posicao", "situacao", "motivo", "fonte"];
    const corpo = ordenadas.map((l) => [l.sigla, l.nome, ano, i.titulo, l.n, i.fonte === "siconfi" ? "reais correntes" : i.unidade, temTaxa ? pop(l.sigla) : "", l.taxa === null ? "" : String(l.taxa).replace(".", ","), br.taxa?.[k] === null || !br.taxa ? "" : String(br.taxa[k]).replace(".", ","), l.diferenca === null ? "" : String(l.diferenca).replace(".", ","), l.posicao ?? "", ROTULO_SITUACAO[l.situacao], l.motivo ?? "", p.rotuloFonte[i.fonte]]);
    const texto = "﻿" + [cab, ...corpo].map((r) => r.map(cel).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `seguranca-${i.id}-${ano}-por-uf.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const grupos = Object.keys(ROTULO_GRUPO).filter((gid) => p.indicadores.some((x) => x.grupo === gid));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-y border-linha bg-superficie p-4">
        <div className="min-w-0">
          <label htmlFor={idInd} className="block text-sm">O que comparar</label>
          <select id={idInd} value={i.id} onChange={(e) => ind.selecionar(e.target.value)} className="mt-1 min-h-[44px] w-full max-w-full border border-obee-dark bg-superficie px-3 text-sm sm:w-auto">
            {grupos.map((gid) => (
              <optgroup key={gid} label={ROTULO_GRUPO[gid]}>
                {p.indicadores.filter((x) => x.grupo === gid).map((x) => <option key={x.id} value={x.id}>{x.titulo}{x.fonte === "sim" ? " (SIM)" : ""}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={idAno} className="block text-sm">Ano</label>
          <select id={idAno} value={String(ano)} onChange={(e) => anoSel.selecionar(e.target.value)} className="mt-1 min-h-[44px] border border-obee-dark bg-superficie px-3 text-sm">
            {[...anos].reverse().map((a) => <option key={a} value={a}>{a}{dadoPreliminar(p, i, a) ? " (preliminar)" : ""}</option>)}
          </select>
        </div>
        {temTaxa && (
          <fieldset className="flex flex-wrap items-center gap-x-5">
            <legend className="mb-1 text-sm">Medida</legend>
            {(["taxa", "n"] as const).map((m) => (
              <label key={m} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name={nomeModo} checked={modo === m} onChange={() => setModo(m)} className="h-4 w-4 accent-[var(--cor-obee)]" />
                {m === "taxa" ? (i.escala === 1 ? "Por habitante" : "Taxa por 100 mil") : i.fonte === "siconfi" ? "Valor total" : "Contagem"}
              </label>
            ))}
          </fieldset>
        )}
        <div className="min-w-0">
          <label htmlFor={idUf} className="block text-sm">Destacar uma UF</label>
          <select id={idUf} value={uf} onChange={(e) => ufSel.selecionar(e.target.value)} className="mt-1 min-h-[44px] max-w-full border border-obee-dark bg-superficie px-3 text-sm">
            <option value={BRASIL}>Nenhuma (só o Brasil)</option>
            {[...p.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((u) => <option key={u.sigla} value={u.sigla}>{u.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="max-w-prose2 space-y-2 text-sm leading-relaxed">
        <p className="text-base">
          <strong className="font-semibold">Brasil em {ano}:</strong>{" "}
          {br.n[k] === null ? "sem soma nacional publicada." : <>
            {temTaxa && br.taxa?.[k] != null ? `${taxaComUnidade(i, br.taxa[k] as number)} (${contagemComUnidade(i, br.n[k] as number)})` : contagemComUnidade(i, br.n[k] as number)}
            {br.situacao[k] === "parcial" ? `, soma das ${br.cobertura[k]} UFs com dado publicado; ficam de fora ${br.fora[k].join(", ")}.` : "."}
          </>}
          {preliminar && " Dado preliminar do SIM, sujeito a revisão."}
        </p>
        <p className="text-carvao-muted">
          {i.definicao ?? `Registros de “${i.nome_na_fonte}” enviados pelas polícias estaduais ao Sinesp, somados nos 12 meses.`} Território: {ROTULO_BASE[i.base]}.
          {!temTaxa && " Sem taxa por habitante: a população não é a base de risco desta medida, e comparar volumes de UFs de tamanhos diferentes não diz qual registra mais."}
        </p>
      </div>

      <GraficoBarras
        titulo={`${i.titulo}: ${medida === "taxa" ? (i.escala === 1 ? "valor por habitante" : "taxa por 100 mil") : "total"} por UF, ${ano}`}
        dados={ordenadas.map((l) => ({ id: l.sigla, nome: l.nome, v: valor(l) }))}
        chaveCategoria="id"
        chaveRotulo="nome"
        orientacao="horizontal"
        series={[{ id: "v", rotulo: medida === "taxa" ? unidadeGrafico : i.unidade, cor: COR }]}
        unidade={unidadeGrafico}
        casas={medida === "taxa" ? (i.escala === 1 ? 2 : 1) : 0}
        rotulosValor
        referencias={medida === "taxa" && br.taxa?.[k] != null ? [{ valor: br.taxa[k] as number, rotulo: br.situacao[k] === "parcial" ? `Brasil (${br.cobertura[k]} UFs)` : "Brasil" }] : []}
        selecionado={uf === BRASIL ? null : uf}
        onSelecionar={(v) => ufSel.selecionar(v ?? BRASIL)}
        rotulosSaoNomes
        alturaMaxima={1300}
      />
      <p className="max-w-prose2 text-sm text-carvao-muted">
        Ordem da maior para a menor medida em {ano}. A posição descreve onde a UF está entre as que têm dado, não se a situação é boa ou ruim; diferenças pequenas podem vir de classificação e de registro.
        {ausentes.length > 0 && ` Sem dado publicado neste ano: ${ausentes.map((l) => l.sigla).join(", ")} (motivo na tabela).`}
      </p>

      {serieUf && (
        <section aria-labelledby={`${idUf}-serie`} className="border-t border-linha pt-6">
          <h3 id={`${idUf}-serie`} className="font-serif text-2xl">{nomeUf} e o Brasil, ano a ano</h3>
          <div className="mt-4">
            <GraficoLinhas
              titulo={`${i.titulo}: ${nomeUf} e Brasil, ${medida === "taxa" ? unidadeGrafico : "total"}`}
              dados={p.anos.map((a, j) => ({ ano: String(a), uf: medida === "taxa" ? serieUf.taxa?.[j] ?? null : serieUf.n[j], brasil: medida === "taxa" ? (br.situacao[j] === "ok" ? br.taxa?.[j] ?? null : null) : null }))}
              chaveX="ano"
              formatoX="texto"
              unidade={unidadeGrafico}
              casas={medida === "taxa" ? (i.escala === 1 ? 2 : 1) : 0}
              zeroNoEixo
              series={[
                { id: "uf", rotulo: nomeUf ?? uf, sigla: uf, cor: COR, espessura: 2.5 },
                ...(medida === "taxa" ? [{ id: "brasil", rotulo: "Brasil", sigla: "BR", cor: COR_BR, tracejada: true, espessura: 2 }] : []),
              ]}
            />
          </div>
          <p className="mt-2 max-w-prose2 text-sm text-carvao-muted">
            Ano sem dado publicado é lacuna na linha, não zero. A linha do Brasil só aparece nos anos em que as 27 UFs têm dado.
            {serieUf.situacao.some((s) => s !== "ok" && s !== "fora") && ` Anos sem dado para ${nomeUf}: ${p.anos.filter((_, j) => serieUf.situacao[j] !== "ok" && serieUf.situacao[j] !== "fora").join(", ")}.`}
          </p>
        </section>
      )}

      <section aria-labelledby={`${idInd}-tabela`}>
        <h3 id={`${idInd}-tabela`} className="font-serif text-2xl">Valores, denominador e posição em {ano}</h3>
        <p id={`${idInd}-ajuda`} className="mt-2 text-sm text-carvao-muted">Em telas estreitas, role a tabela para o lado. A diferença para o Brasil está em pontos da mesma medida.</p>
        <div role="region" aria-labelledby={`${idInd}-tabela`} aria-describedby={`${idInd}-ajuda`} tabIndex={0} className="mt-3 overflow-x-auto border-y border-linha">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">{i.titulo}, {ano}, por UF. Fonte: {p.rotuloFonte[i.fonte]}.</caption>
            <thead className="bg-obee-suave">
              <tr>
                <th scope="col" className="p-3 text-left">UF</th>
                <th scope="col" className="p-3 text-right">{i.fonte === "siconfi" ? "Despesa liquidada" : `Contagem (${i.unidade})`}</th>
                {temTaxa && <th scope="col" className="p-3 text-right">{i.denominador === "mulheres" ? "Mulheres residentes" : "Residentes"}</th>}
                {temTaxa && <th scope="col" className="p-3 text-right">{i.escala === 1 ? "Por habitante" : "Taxa por 100 mil"}</th>}
                {temTaxa && <th scope="col" className="p-3 text-right">Diferença para o Brasil</th>}
                {temTaxa && <th scope="col" className="p-3 text-right">Posição</th>}
                <th scope="col" className="p-3 text-left">Situação</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((l) => (
                <tr key={l.sigla} className={`border-t border-linha ${l.sigla === uf ? "bg-obee-suave" : ""}`}>
                  <th scope="row" className="p-3 text-left font-medium">{l.nome}</th>
                  <td className="p-3 text-right tabular-nums">{l.n === null ? "sem dado" : i.fonte === "siconfi" ? contagemComUnidade(i, l.n) : inteiro(l.n)}</td>
                  {temTaxa && <td className="p-3 text-right tabular-nums">{inteiro(pop(l.sigla))}</td>}
                  {temTaxa && <td className="p-3 text-right tabular-nums">{l.taxa === null ? "sem dado" : taxaCurta(i, l.taxa)}</td>}
                  {temTaxa && <td className="p-3 text-right tabular-nums">{l.diferenca === null ? "" : i.escala === 1 ? `${sinal(l.diferenca, 2)}` : sinal(l.diferenca, 1)}</td>}
                  {temTaxa && <td className="p-3 text-right tabular-nums">{l.posicao === null ? "" : `${l.posicao}ª de ${br.comparadas?.[k] ?? ""}`}</td>}
                  <td className="max-w-sm p-3">{l.situacao === "ok" ? "Publicado" : <><span className="font-semibold">{ROTULO_SITUACAO[l.situacao]}.</span> {l.motivo}</>}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-carvao">
                <th scope="row" className="p-3 text-left font-semibold">Brasil{br.situacao[k] === "parcial" ? ` (${br.cobertura[k]} UFs)` : ""}</th>
                <td className="p-3 text-right tabular-nums">{br.n[k] === null ? "sem dado" : i.fonte === "siconfi" ? contagemComUnidade(i, br.n[k] as number) : inteiro(br.n[k] as number)}</td>
                {temTaxa && <td className="p-3 text-right tabular-nums">{inteiro(p.ufs.filter((u) => !br.fora[k].includes(u.sigla)).reduce((s, u) => s + pop(u.sigla), 0))}</td>}
                {temTaxa && <td className="p-3 text-right tabular-nums">{br.taxa?.[k] == null ? "sem dado" : taxaCurta(i, br.taxa[k] as number)}</td>}
                {temTaxa && <td className="p-3" />}
                {temTaxa && <td className="p-3" />}
                <td className="p-3">{br.situacao[k] === "parcial" ? `Soma das UFs com dado; fora: ${br.fora[k].join(", ")}` : "Soma das 27 UFs"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <button type="button" onClick={baixar} className="min-h-[44px] border border-obee-dark px-4">Baixar esta tabela · CSV</button>
          <span className="text-carvao-muted">Fonte: {p.rotuloFonte[i.fonte]}; população: {p.rotuloFonte.ibge}.</span>
        </div>
      </section>
    </div>
  );
}

/**
 * Polícia e saúde lado a lado: vítimas de homicídio doloso registradas pela polícia (UF do fato) e óbitos por agressão
 * no SIM (UF de residência), na mesma escala de taxa por 100 mil, e a razão entre as duas contagens calculada pela gold.
 */
export function PoliciaSaude({ pacote: p }: { pacote: PacotePoliciaSaude }) {
  const h = p.policia, s = p.saude;
  const comuns = p.anos.filter((_, k) => h[BRASIL].n[k] !== null && s[BRASIL].n[k] !== null);
  // padrão: o último ano com o SIM final (o preliminar continua na lista, marcado)
  const padrao = comuns.filter((a) => p.simSituacao[String(a)] === "final").at(-1) ?? comuns.at(-1);
  const anoSel = useSelecaoGas("ano_comparacao", comuns.map(String), String(padrao));
  const ano = Number(anoSel.valor);
  const k = p.anos.indexOf(ano);
  const id = useId();
  const linhas = p.ufs
    .map((u) => ({ id: u.sigla, nome: u.nome, policia: h[u.sigla].taxa[k] ?? null, saude: s[u.sigla].taxa[k] ?? null, razao: p.policiaSaude[u.sigla][k] }))
    .sort((a, b) => (b.saude ?? -1) - (a.saude ?? -1) || a.nome.localeCompare(b.nome, "pt-BR"));
  const brR = p.policiaSaude[BRASIL][k];
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={id} className="block text-sm">Ano</label>
        <select id={id} value={String(ano)} onChange={(e) => anoSel.selecionar(e.target.value)} className="mt-1 min-h-[44px] border border-obee-dark bg-superficie px-3 text-sm">
          {[...comuns].reverse().map((a) => <option key={a} value={a}>{a}{p.simSituacao[String(a)] === "preliminar" ? " (SIM preliminar)" : ""}</option>)}
        </select>
      </div>
      {brR !== null && <p className="max-w-prose2 text-sm leading-relaxed">No Brasil, em {ano}, a polícia registrou {numero(brR * 100, 0)} vítimas de homicídio doloso para cada 100 óbitos por agressão do SIM. A razão varia por UF; a diferença não é erro de um dos registros, porque cada um conta uma coisa.</p>}
      <GraficoBarras
        titulo={`Homicídio doloso (polícia) e óbito por agressão (saúde), por 100 mil habitantes, ${ano}`}
        dados={linhas}
        chaveCategoria="id"
        chaveRotulo="nome"
        orientacao="horizontal"
        series={[
          { id: "saude", rotulo: "Óbito por agressão, SIM", cor: COR_SAUDE },
          { id: "policia", rotulo: "Homicídio doloso, Sinesp", cor: COR },
        ]}
        unidade="por 100 mil habitantes"
        casas={1}
        rotulosSaoNomes
        alturaCategoria={56}
        alturaMaxima={1600}
      />
      <details className="border-y border-linha py-3">
        <summary className="min-h-[44px] cursor-pointer py-2 text-sm text-obee-dark underline">Razão entre os dois registros, por UF</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <caption className="sr-only">Vítimas de homicídio doloso no Sinesp para cada 100 óbitos por agressão no SIM, {ano}.</caption>
            <thead className="bg-obee-suave"><tr><th scope="col" className="p-3 text-left">UF</th><th scope="col" className="p-3 text-right">Homicídio doloso por 100 mil</th><th scope="col" className="p-3 text-right">Óbito por agressão por 100 mil</th><th scope="col" className="p-3 text-right">Homicídios para cada 100 óbitos</th></tr></thead>
            <tbody>{linhas.map((l) => <tr key={l.id} className="border-t border-linha"><th scope="row" className="p-3 text-left font-medium">{l.nome}</th><td className="p-3 text-right tabular-nums">{l.policia === null ? "sem dado" : numero(l.policia, 1)}</td><td className="p-3 text-right tabular-nums">{l.saude === null ? "sem dado" : numero(l.saude, 1)}</td><td className="p-3 text-right tabular-nums">{l.razao === null ? "sem dado" : numero(l.razao * 100, 0)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
