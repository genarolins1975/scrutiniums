"use client";

import { useMemo, useState } from "react";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { ContaSelecionadas } from "@/components/energia/ContaSelecionadas";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, mesAno, num, reais } from "@/lib/energia/formato";
import {
  CAMPO_DIST,
  CASO_EVIDENCIA_SIMULADOR as CASO_EVIDENCIA,
  REGRAS_DA_CLASSE,
  curvaSimulacao,
  descricaoDaTarifa,
  destacar,
  expandirDistribuidorasSim,
  expandirInfo,
  igualdadeComResidencial,
  leiturasNaoConferidas,
  nomeLigacao,
  notaArredondamentoSimulacao,
  remover,
  respostaSimulacao,
  minuscula,
  rotuloDistribuidora,
  separaBloqueioDeNorma,
  simular,
  tarifaDaChave,
  vereditoSimulacao,
  type DistribuidoraSimCompacta,
  type InfoCompacta,
} from "@/lib/energia/conta";
import type { Evidencia } from "@/lib/energia/evidencia";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { ChaveTarifa, ClasseSimuladorId, EstadoRegra, Ligacao, Simulador } from "@/lib/energia/tipos-conta";

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

/** Select ocupa a largura da coluna: sem isso, a opção mais longa define a largura e a página rola de lado no celular. */
const CLASSE_SELECT = "min-h-[44px] w-full min-w-0 max-w-full border border-linha bg-superficie px-2 text-sm text-carvao";

const ROTULO_ESTADO: Record<EstadoRegra, string> = {
  CONFERIDA: "conferida no texto oficial",
  PARCIAL: "parcialmente conferida (há leitura declarada)",
  NAO_CONFERIDA: "não conferida",
};

export type ContaSimuladorProps = {
  simulador: Pick<Simulador, "classes" | "regras" | "regras_texto" | "estado_regras" | "bandeiras" | "bandeira_vigente" | "rotulo" | "formula" | "chaves_tarifa"> & {
    /** As distribuidoras com tarifa vigente em tuplas (`compactarDistribuidorasSim`); a tela as expande uma vez. */
    distribuidoras: DistribuidoraSimCompacta[];
    referencia: { cnpj: string; sigla: string | null };
  };
  evidencia: Evidencia | null;
  dataReferencia: string;
  /** UF de cada distribuidora, para a lista de distribuidoras: quem não sabe a sigla reconhece o estado (`compactarInfo`). */
  info?: InfoCompacta;
};

export function ContaSimulador({ simulador: compacto, evidencia, dataReferencia, info: infoCompacta }: ContaSimuladorProps) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const info = useMemo(() => (infoCompacta ? expandirInfo(infoCompacta) : {}), [infoCompacta]);
  const s = useMemo(() => ({ ...compacto, distribuidoras: expandirDistribuidorasSim(compacto.distribuidoras) }), [compacto]);
  const [texto, setTexto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
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
  const rotuloDist = (id: string) => {
    const d = porCnpj.get(id);
    return d ? rotuloDistribuidora(d.sigla, d.cnpj) : `CNPJ ${id}`;
  };
  // a tarifa que entrou no cálculo (subgrupo e subclasse da fonte) e, em Rural e Demais classes, quantas distribuidoras têm a mesma tarifa da Residencial
  const tarifasUsadas = dist
    ? classe.tarifas.map((chave: ChaveTarifa) => {
        const par = dist.tarifas[chave];
        return { chave, descricao: descricaoDaTarifa(s.chaves_tarifa[chave]), te: par?.[0] ?? null, tusd: par?.[1] ?? null, valida: tarifaDaChave(dist.tarifas, chave) !== null };
      })
    : [];
  const igualResidencial = v.classe === "rural" || v.classe === "demais" ? igualdadeComResidencial(s.distribuidoras, v.classe) : null;
  const tarifaDaClasse = dist && igualResidencial ? tarifaDaChave(dist.tarifas, v.classe as ChaveTarifa) : null;
  const igualAqui = !!dist && tarifaDaClasse !== null && tarifaDaClasse === tarifaDaChave(dist.tarifas, "residencial");
  const leituras = leiturasNaoConferidas(v.classe, s.regras_texto);
  const escolher = (id: string) => {
    const descartada = !v.dist.includes(id) && v.dist.length >= LIMITE_COMPARACAO ? v.dist[LIMITE_COMPARACAO - 1] : null;
    setAviso(descartada ? `O limite é de ${LIMITE_COMPARACAO} distribuidoras: ${rotuloDist(descartada)} saiu da seleção para entrar ${rotuloDist(id)}.` : null);
    definir({ dist: destacar(v.dist, id) });
  };

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
  // a curva leva o consumo escolhido como um ponto a mais (se não cair na grade), para o marco do gráfico ter onde parar
  const curva = useMemo(() => {
    if (!dist) return [];
    const base = curvaSimulacao(dist.tarifas, v.classe, v.ligacao, adicional, s.regras, ate, ate / 50);
    if (v.kwh > ate || base.some((p) => Number(p.kwh) === v.kwh)) return base;
    const r1 = simular(dist.tarifas, v.classe, v.kwh, v.ligacao, adicional, s.regras);
    const ponto = { kwh: String(v.kwh), total: r1.disponivel ? r1.total : null, energia: r1.disponivel ? r1.energia : null };
    const i = base.findIndex((p) => Number(p.kwh) > v.kwh);
    return i < 0 ? [...base, ponto] : [...base.slice(0, i), ponto, ...base.slice(i)];
  }, [dist, v.classe, v.ligacao, v.kwh, adicional, s.regras, ate]);
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

  const kwhValido = (bruto: string) => {
    const n = Number(bruto);
    return bruto.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 10000;
  };
  const mudarKwh = (bruto: string) => {
    setTexto(bruto);
    if (kwhValido(bruto)) definir({ kwh: Number(bruto) });
  };
  const kwhInvalido = texto !== null && !kwhValido(texto);

  return (
    <div className="space-y-5">
      <RespostaCurta id="p049" vivo veredito={vereditoSimulacao(r, sigla, v.kwh)}>
        {respostaSimulacao(r, sigla, classe.rotulo, v.kwh, semBandeira ? null : nomeBandeira, s.rotulo)}
      </RespostaCurta>

      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(e) => e.preventDefault()} aria-label="Parâmetros da simulação">
        <label className="flex min-w-0 flex-col gap-1 text-sm text-carvao">
          <span className="rotulo text-mineral">Distribuidora</span>
          <select value={cnpj} onChange={(e) => escolher(e.target.value)} className={CLASSE_SELECT}>
            {s.distribuidoras.map((d) => (
              <option key={d.cnpj} value={d.cnpj}>
                {rotuloDistribuidora(d.sigla, d.cnpj)}
                {info[d.cnpj]?.uf ? ` (${info[d.cnpj].uf})` : ""}
                {d.cnpj === s.referencia.cnpj ? " · referência: tarifa mais próxima da mediana" : ""}
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
              aria-invalid={kwhInvalido || undefined}
              aria-describedby={kwhInvalido ? "conta-skwh-erro" : undefined}
              className={`min-h-[44px] w-28 border bg-superficie px-2 tabular-nums text-carvao ${kwhInvalido ? "border-erro" : "border-linha"}`}
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

      {kwhInvalido && (
        <p id="conta-skwh-erro" role="alert" className="text-sm text-erro" data-erro="consumo">
          Digite um número inteiro de 0 a 10.000 kWh. A estimativa abaixo continua a do último consumo válido ({num(v.kwh, 0)} kWh).
        </p>
      )}

      <ContaSelecionadas
        ids={v.dist}
        rotulo={rotuloDist}
        aoTirar={(id) => {
          setAviso(null);
          definir({ dist: remover(v.dist, id) });
        }}
        aoLimpar={() => {
          setAviso(null);
          definir({ dist: [] });
        }}
        aviso={aviso}
        limite={LIMITE_COMPARACAO}
      />

      {v.bandeira === "vigente" && (
        <p className="text-xs leading-relaxed text-carvao-muted" data-nota="bandeira-publicada">
          {vig?.bandeira ? `Bandeira do mês publicado: ${minuscula(vig.bandeira)} de ${mesAno(`${vig.mes}-01`)}, a última que consta nos dados de ${dataBR(dataReferencia)}. ` : "Nenhuma bandeira consta nos dados. "}
          A ANEEL pode ter publicado a de um mês seguinte depois dessa data; escolha outra bandeira na lista para simular.
        </p>
      )}

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
          {tarifasUsadas.length > 0 && (
            <p className="mt-2 text-xs leading-relaxed text-carvao" data-tarifa-usada="">
              Tarifa usada: {tarifasUsadas.map((t) => t.descricao).join("; ")}.
            </p>
          )}
          {igualResidencial && igualResidencial.total > 0 && (
            <p className="mt-2 text-xs leading-relaxed text-carvao" data-nota="classe-igual-residencial">
              Na fonte, a tarifa de {classe.rotulo.split(" (")[0]} é igual à de Residencial em {num(igualResidencial.iguais, 0)} de {num(igualResidencial.total, 0)} distribuidoras do conjunto
              {igualAqui ? `, inclusive na ${sigla}` : ""}, e o valor {igualResidencial.iguais === igualResidencial.total ? "é o mesmo" : "pode ser o mesmo"} da classe Residencial. {v.classe === "rural" ? "O desconto rural não está incluído neste cálculo." : "Nenhum desconto de classe está incluído neste cálculo."}
            </p>
          )}
          {leituras.length > 0 && (
            <p className="mt-2 border border-dashed border-mineral px-3 py-2 text-xs leading-relaxed text-carvao" data-selo="regra-parcial">
              <span className="font-medium">Regra parcialmente conferida.</span> Este valor depende de leitura do observatório, ainda não conferida no texto oficial: {leituras.join("; ")}.{" "}
              <a href="#regras-da-classe" className="text-energia-dark underline underline-offset-4">
                Ver as regras desta classe
              </a>
              .
            </p>
          )}
          {ehCasoEvidencia && evidencia && (
            <div className="mt-2">
              <ComproveNumero evidencia={evidencia} />
            </div>
          )}
        </div>

        <div>
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Memória de cálculo da simulação">
            <table className="w-full min-w-[520px] border-collapse text-sm tabular-nums">
              <caption className="mb-2 text-left font-serif text-lg text-carvao">
                Memória de cálculo
                {tarifasUsadas.length > 0 && (
                  <span className="mt-1 block font-sans text-xs font-normal leading-relaxed text-carvao-muted" data-memoria-tarifa="">
                    Tarifa usada: {tarifasUsadas.map((t) => `${t.descricao}${t.valida ? ` (TE ${num((t.te ?? 0) / 1000, 5)} + TUSD ${num((t.tusd ?? 0) / 1000, 5)} R$/kWh)` : " (sem tarifa publicada na vigência)"}`).join("; ")}.
                  </span>
                )}
              </caption>
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

      {!r.disponivel ? (
        <p role="status" className="border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao-muted" data-grafico-indisponivel="">
          Sem gráfico: a simulação está indisponível para {sigla} nesta classe ({r.motivo}). Nenhuma tarifa de outra classe é usada no lugar.
        </p>
      ) : (
      <GraficoLinhas
        titulo={`Estimativa mensal por consumo, ${sigla}, ${minuscula(classe.rotulo)}, ligação ${nomeLigacao(v.ligacao)}`}
        dados={curva}
        chaveX="kwh"
        formatoX="texto"
        marcos={v.kwh <= ate ? [{ x: String(v.kwh), rotulo: `${num(v.kwh, 0)} kWh` }] : []}
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
      )}
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

      <div id="regras-da-classe" className="scroll-mt-28">
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
