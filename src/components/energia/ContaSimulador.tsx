"use client";

import { useMemo, useState } from "react";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, mesAno, num, reais } from "@/lib/energia/formato";
import {
  CAMPO_DIST,
  CASO_EVIDENCIA_SIMULADOR as CASO_EVIDENCIA,
  curvaSimulacao,
  destacar,
  nomeLigacao,
  notaArredondamentoSimulacao,
  respostaSimulacao,
  minuscula,
  rotuloDistribuidora,
  separaBloqueioDeNorma,
  simular,
  vereditoSimulacao,
} from "@/lib/energia/conta";
import type { Evidencia } from "@/lib/energia/evidencia";
import type { ClasseSimuladorId, EstadoRegra, Ligacao, Simulador } from "@/lib/energia/tipos-conta";

/**
 * P049, "Como minha conta varia com consumo e perfil?": reaplica a fórmula
 * publicada em `simulador.formula` às tarifas vigentes da distribuidora escolhida,
 * com as regras de custo de disponibilidade, Tarifa Social, Desconto Social e
 * bandeira publicadas na gold (cada uma com o seu estado de conferência). O
 * resultado é sempre rotulado como estimativa sem tributos e sem iluminação
 * pública, com a memória de cálculo linha a linha.
 *
 * Tudo fica na URL (consumo, classe, ligação, bandeira e a distribuidora em
 * ?dist=), para o link reabrir a mesma simulação. A mesma simulação aparece para
 * as outras distribuidoras escolhidas (até quatro), na mesma régua.
 */

const LIGACOES: Ligacao[] = ["monofasico", "bifasico", "trifasico"];
const CLASSES: ClasseSimuladorId[] = ["residencial", "tarifa_social", "desconto_social", "rural", "demais"];

const ESQUEMA = {
  dist: CAMPO_DIST,
  kwh: campo(tiposUrl.inteiro({ min: 0, max: 10000 }), 150, {
    param: "skwh",
    historico: "replace",
  }),
  classe: campo(tiposUrl.opcao(CLASSES), "residencial", { param: "sclasse" }),
  ligacao: campo(tiposUrl.opcao(LIGACOES), "monofasico", { param: "slig" }),
  bandeira: campo(tiposUrl.opcao(["Verde", "Amarela", "Vermelha P1", "Vermelha P2", "vigente"] as const), "vigente", { param: "sband" }),
};

/** Regras que valem para cada classe (ids de `simulador.regras_texto`). */
const REGRAS_DA_CLASSE: Record<ClasseSimuladorId, string[]> = {
  residencial: ["custo_disponibilidade", "bandeira", "exclusoes"],
  rural: ["custo_disponibilidade", "bandeira", "exclusoes"],
  demais: ["custo_disponibilidade", "bandeira", "exclusoes"],
  tarifa_social: ["tarifa_social", "custo_disponibilidade", "bandeira", "exclusoes"],
  desconto_social: ["desconto_social", "custo_disponibilidade", "bandeira", "exclusoes"],
};

/** Select ocupa a largura da coluna: sem isso, a opção mais longa define a largura e a página rola de lado no celular. */
const CLASSE_SELECT = "min-h-[44px] w-full min-w-0 max-w-full border border-linha bg-superficie px-2 text-sm text-carvao";

const ROTULO_ESTADO: Record<EstadoRegra, string> = {
  CONFERIDA: "conferida no texto oficial",
  PARCIAL: "parcialmente conferida (há leitura declarada)",
  NAO_CONFERIDA: "não conferida",
};

export type ContaSimuladorProps = {
  simulador: Pick<Simulador, "classes" | "regras" | "regras_texto" | "estado_regras" | "bandeiras" | "bandeira_vigente" | "distribuidoras" | "rotulo" | "formula"> & {
    referencia: { cnpj: string; sigla: string | null };
  };
  evidencia: Evidencia | null;
  dataReferencia: string;
};

export function ContaSimulador({ simulador: s, evidencia, dataReferencia }: ContaSimuladorProps) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const [texto, setTexto] = useState<string | null>(null);
  const porCnpj = useMemo(() => new Map(s.distribuidoras.map((d) => [d.cnpj, d])), [s.distribuidoras]);
  const escolhida = v.dist.find((id) => porCnpj.has(id)) ?? null;
  const cnpj = escolhida ?? s.referencia.cnpj;
  const dist = porCnpj.get(cnpj) ?? null;
  const pedidaFora = v.dist.length > 0 && !escolhida;

  // "Do mês publicado" usa o acionamento do mês (nome e valor publicados), o mesmo
  // da evidência do pipeline, e não o patamar da tabela de adicionais: nos meses em
  // que os dois recursos divergem, vale o acionado. Sem acionamento publicado, a
  // bandeira fica fora da estimativa e isso é dito (nunca vira verde).
  const vig = s.bandeira_vigente;
  const nomeBandeira: string | null = v.bandeira === "vigente" ? (vig?.bandeira ?? null) : v.bandeira;
  const adicional: number | null =
    v.bandeira === "vigente" ? (vig?.bandeira ? (vig.rs_mwh ?? null) : null) : (s.bandeiras.find((b) => b.bandeira === v.bandeira)?.rs_mwh ?? null);
  const semBandeira = nomeBandeira === null || adicional === null;
  const rotuloBandeira = nomeBandeira === null ? "não publicada" : minuscula(nomeBandeira);
  const classe = s.classes.find((c) => c.id === v.classe) ?? s.classes[0];
  const sigla = dist ? rotuloDistribuidora(dist.sigla, dist.cnpj) : cnpj;

  const r = useMemo(
    () =>
      dist
        ? simular(dist.tarifas, v.classe, v.kwh, v.ligacao, adicional, s.regras)
        : ({
            disponivel: false,
            motivo: "distribuidora sem tarifa vigente",
          } as const),
    [dist, v.classe, v.kwh, v.ligacao, adicional, s.regras],
  );
  const ate = Math.min(2000, Math.max(500, Math.ceil(v.kwh / 100) * 100));
  const curva = useMemo(
    () => (dist ? curvaSimulacao(dist.tarifas, v.classe, v.ligacao, adicional, s.regras, ate, ate / 50) : []),
    [dist, v.classe, v.ligacao, adicional, s.regras, ate],
  );
  const comparadas = v.dist
    .filter((id) => porCnpj.has(id))
    .map((id) => {
      const d = porCnpj.get(id)!;
      return {
        id,
        sigla: rotuloDistribuidora(d.sigla, d.cnpj),
        r: simular(d.tarifas, v.classe, v.kwh, v.ligacao, adicional, s.regras),
      };
    });

  const ehCasoEvidencia =
    !!evidencia &&
    cnpj === s.referencia.cnpj &&
    v.classe === CASO_EVIDENCIA.classe &&
    v.kwh === CASO_EVIDENCIA.kwh &&
    v.ligacao === CASO_EVIDENCIA.ligacao &&
    !!vig?.bandeira &&
    nomeBandeira === vig.bandeira &&
    adicional === vig.rs_mwh;

  // a memória mostra cada parcela arredondada; o total é o da soma antes de arredondar, e a diferença de R$ 0,01 é dita
  const notaArredondamento = r.disponivel ? notaArredondamentoSimulacao([...r.linhas.map((l) => l.valor), semBandeira ? 0 : r.bandeira], r.total) : null;

  const regrasAplicadas = REGRAS_DA_CLASSE[v.classe].map((id) => s.regras_texto.find((x) => x.id === id)).filter((x): x is Simulador["regras_texto"][number] => !!x);

  const mudarKwh = (bruto: string) => {
    setTexto(bruto);
    const n = Number(bruto);
    if (bruto.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 10000) definir({ kwh: n });
  };

  return (
    <div className="space-y-5">
      <RespostaCurta id="p049" vivo veredito={vereditoSimulacao(r, sigla, v.kwh)}>
        {respostaSimulacao(r, sigla, classe.rotulo, v.kwh, semBandeira ? null : nomeBandeira, s.rotulo)}
      </RespostaCurta>

      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(e) => e.preventDefault()} aria-label="Parâmetros da simulação">
        <label className="flex min-w-0 flex-col gap-1 text-sm text-carvao">
          <span className="rotulo text-mineral">Distribuidora</span>
          <select
            value={cnpj}
            onChange={(e) => definir({ dist: destacar(v.dist, e.target.value) })}
            className={CLASSE_SELECT}
          >
            {s.distribuidoras.map((d) => (
              <option key={d.cnpj} value={d.cnpj}>
                {rotuloDistribuidora(d.sigla, d.cnpj)}
                {d.cnpj === s.referencia.cnpj ? " (referência: tarifa mais próxima da mediana)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm text-carvao">
          <span className="rotulo text-mineral">Classe</span>
          <select
            value={v.classe}
            onChange={(e) => definir({ classe: e.target.value as ClasseSimuladorId })}
            className={CLASSE_SELECT}
          >
            {s.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </label>
        <div className="flex min-w-0 flex-col gap-1 text-sm text-carvao">
          <label htmlFor="conta-skwh" className="rotulo text-mineral">
            Consumo no mês (kWh)
          </label>
          <div className="flex items-center gap-3">
            <input
              id="conta-skwh"
              type="number"
              inputMode="numeric"
              min={0}
              max={10000}
              step={1}
              value={texto ?? String(v.kwh)}
              onChange={(e) => mudarKwh(e.target.value)}
              onBlur={() => setTexto(null)}
              className="min-h-[44px] w-28 border border-linha bg-superficie px-2 tabular-nums text-carvao"
            />
            <input
              type="range"
              aria-label="Consumo no mês (kWh), controle deslizante"
              min={0}
              max={1000}
              step={5}
              value={Math.min(v.kwh, 1000)}
              onChange={(e) => {
                setTexto(null);
                definir({ kwh: Number(e.target.value) });
              }}
              className="min-h-[44px] w-full accent-energia"
            />
          </div>
        </div>
        <label className="flex min-w-0 flex-col gap-1 text-sm text-carvao">
          <span className="rotulo text-mineral">Ligação</span>
          <select
            value={v.ligacao}
            onChange={(e) => definir({ ligacao: e.target.value as Ligacao })}
            className={CLASSE_SELECT}
          >
            {LIGACOES.map((l) => (
              <option key={l} value={l}>
                {nomeLigacao(l)} (mínimo de {s.regras.custo_disponibilidade_kwh[l]} kWh)
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm text-carvao">
          <span className="rotulo text-mineral">Bandeira</span>
          <select
            value={v.bandeira}
            onChange={(e) => definir({ bandeira: e.target.value as typeof v.bandeira })}
            className={CLASSE_SELECT}
          >
            <option value="vigente">
              Do mês publicado
              {vig?.bandeira
                ? ` (${vig.bandeira}, ${mesAno(`${vig.mes}-01`)}${vig.rs_mwh === null ? ", sem valor publicado" : vig.rs_mwh === 0 ? ", sem acréscimo" : `, ${reais(vig.rs_mwh / 1000, 5)}/kWh`})`
                : " (não publicada)"}
            </option>
            {s.bandeiras.map((b) => (
              <option key={b.bandeira} value={b.bandeira}>
                {b.bandeira} ({b.rs_kwh === null ? "sem valor publicado" : b.rs_kwh === 0 ? "sem acréscimo" : `${reais(b.rs_kwh, 5)}/kWh`})
              </option>
            ))}
          </select>
        </label>
      </form>

      {v.bandeira === "vigente" && vig?.aviso && (
        <p role="status" className="text-sm text-carvao-muted">
          {vig.aviso}
        </p>
      )}

      {pedidaFora && (
        <p role="status" className="text-sm text-carvao-muted">
          A distribuidora escolhida no ranking não tem tarifa vigente em {dataBR(dataReferencia)}; a simulação usa a de referência (
          {rotuloDistribuidora(s.referencia.sigla, s.referencia.cnpj)}).
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div role="group" aria-label="Resultado da simulação" className="border border-linha bg-papel p-5">
          <p className="rotulo text-mineral">Estimativa mensal, {sigla}</p>
          {r.disponivel ? (
            <p className="mt-2 font-serif text-[2rem] leading-none tabular-nums text-carvao">{reais(r.total)}</p>
          ) : (
            <p className="mt-2 font-serif text-xl text-carvao-muted">Simulação indisponível</p>
          )}
          <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
            {r.disponivel ? s.rotulo.replace(/\.\s*$/, "") : r.motivo}. Tarifas da vigência iniciada em {dist ? dataBR(dist.inicio) : "sem data"} ({dist?.ato ?? "sem ato"}).
          </p>
          {ehCasoEvidencia && evidencia && (
            <div className="mt-2">
              <ComproveNumero evidencia={evidencia} />
            </div>
          )}
        </div>

        <div>
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Memória de cálculo da simulação">
            <table className="w-full min-w-[520px] border-collapse text-sm tabular-nums">
              <caption className="mb-2 text-left font-serif text-lg text-carvao">Memória de cálculo</caption>
              <thead>
                <tr className="border-b border-linha text-left text-xs text-mineral">
                  <th scope="col" className="py-2 pr-3 font-normal">
                    Item
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-normal">
                    kWh
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-normal">
                    R$/kWh
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.disponivel ? (
                  <>
                    {r.linhas.map((l, i) => (
                      <tr key={i} className="border-b border-linha">
                        <th scope="row" className="py-2 pr-3 text-left font-normal text-carvao">
                          {l.rotulo}
                        </th>
                        <td className="py-2 pr-3 text-right">{num(l.kwh, 0)}</td>
                        <td className="py-2 pr-3 text-right">{num(l.rs_kwh, 5)}</td>
                        <td className="py-2 text-right">{reais(l.valor)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-linha">
                      <th scope="row" className="py-2 pr-3 text-left font-normal text-carvao">
                        {semBandeira ? "Bandeira: adicional não publicado, fora da estimativa" : `Bandeira ${rotuloBandeira} sobre o consumo sujeito`}
                      </th>
                      <td className="py-2 pr-3 text-right">{num(r.kwh_bandeira, 0)}</td>
                      <td className="py-2 pr-3 text-right">{adicional === null ? "sem valor" : num(adicional / 1000, 5)}</td>
                      <td className="py-2 text-right">{semBandeira ? "sem valor" : reais(r.bandeira)}</td>
                    </tr>
                    <tr className="font-medium">
                      <th scope="row" className="py-2 pr-3 text-left text-carvao">
                        Estimativa sem tributos e sem iluminação pública
                      </th>
                      <td className="py-2 pr-3 text-right">{num(r.kwh_faturado, 0)} faturados</td>
                      <td className="py-2 pr-3" />
                      <td className="py-2 text-right">{reais(r.total)}</td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={4} className="py-3 text-carvao-muted">
                      {r.motivo}: nenhuma tarifa de outra classe é usada no lugar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {notaArredondamento && (
            <p className="mt-2 text-xs leading-relaxed text-carvao-muted" data-nota="arredondamento">
              {notaArredondamento}
            </p>
          )}
          {r.disponivel && r.observacoes.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-carvao-muted">
              {r.observacoes.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-mineral">Fórmula publicada: {s.formula}.</p>
        </div>
      </div>

      <GraficoLinhas
        titulo={`Estimativa mensal por consumo, ${sigla}, ${minuscula(classe.rotulo)}, ligação ${nomeLigacao(v.ligacao)}`}
        dados={curva}
        chaveX="kwh"
        formatoX="texto"
        series={[
          {
            id: "total",
            rotulo: semBandeira ? "Bandeira não publicada (igual à linha sem bandeira)" : `Com bandeira ${rotuloBandeira}`,
            cor: "var(--cor-energia)",
          },
          {
            id: "energia",
            rotulo: "Sem bandeira",
            cor: "var(--serie-referencia)",
            tracejada: true,
          },
        ]}
        unidade="R$/mês"
        casas={2}
        zeroNoEixo
        altura={260}
      />
      <p className="text-xs text-mineral">
        Eixo horizontal: consumo no mês, de 0 a {num(ate, 0)} kWh. A linha muda de inclinação onde muda a regra (mínimo da ligação, faixas da Tarifa Social e do Desconto Social).
      </p>

      {comparadas.length > 0 && (
        <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Mesma simulação nas distribuidoras escolhidas">
          <table className="w-full min-w-[520px] border-collapse text-sm tabular-nums">
            <caption className="mb-2 text-left font-serif text-lg text-carvao">
              Mesma simulação nas distribuidoras escolhidas ({num(v.kwh, 0)} kWh, {minuscula(classe.rotulo)})
            </caption>
            <thead>
              <tr className="border-b border-linha text-left text-xs text-mineral">
                <th scope="col" className="py-2 pr-3 font-normal">
                  Distribuidora
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">
                  Energia (TE + TUSD)
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">
                  Bandeira
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Estimativa
                </th>
              </tr>
            </thead>
            <tbody>
              {comparadas.map((c) => (
                <tr key={c.id} className={`border-b border-linha ${c.id === cnpj ? "bg-energia-fundo" : ""}`}>
                  <th scope="row" className="py-2 pr-3 text-left font-normal text-carvao">
                    {c.sigla}
                  </th>
                  {c.r.disponivel ? (
                    <>
                      <td className="py-2 pr-3 text-right">{reais(c.r.energia)}</td>
                      <td className="py-2 pr-3 text-right">{semBandeira ? "sem valor" : reais(c.r.bandeira)}</td>
                      <td className="py-2 text-right">{reais(c.r.total)}</td>
                    </>
                  ) : (
                    <td colSpan={3} className="py-2 text-right text-carvao-muted">
                      indisponível: {c.r.motivo}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h3 className="font-serif text-lg text-carvao">Regras aplicadas a esta classe</h3>
        <ul className="mt-2 space-y-3 text-sm leading-relaxed">
          {regrasAplicadas.map((rg) => (
            <li key={rg.id} className="border-l-2 border-linha pl-3">
              <p className="text-carvao">{separaBloqueioDeNorma(rg.aplicacao_no_simulador).leitor}</p>
              {(s.estado_regras[rg.id] ?? rg.estado) !== "CONFERIDA" && <p className="mt-1 text-xs text-carvao-muted">Parte desta regra é leitura do observatório, ainda não conferida no texto oficial.</p>}
              <p className="mt-1 text-xs text-carvao-muted" data-nivel="analisar">
                {separaBloqueioDeNorma(rg.aplicacao_no_simulador).tecnico ? `${separaBloqueioDeNorma(rg.aplicacao_no_simulador).tecnico} ` : ""}Estado: {ROTULO_ESTADO[s.estado_regras[rg.id] ?? rg.estado]}.{" "}
                {rg.partes
                  .filter((p) => p.estado !== "CONFERIDA")
                  .map((p) => `Leitura declarada, não conferida: “${p.texto}”${p.motivo ? ` (${p.motivo})` : ""}.`)
                  .join(" ")}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
