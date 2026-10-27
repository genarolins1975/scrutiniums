"use client";

import { TabelaDados } from "@/components/painel/TabelaDados";
import { useMemo, useState } from "react";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { ContaSelecionadas } from "@/components/energia/ContaSelecionadas";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { useMesCorrente } from "@/components/energia/useMesCorrente";
import { bandeiraUsada, fonteBandeira, fraseBandeira, situacaoBandeira } from "@/lib/energia/bandeira-do-mes";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import { bandeiraNoIdioma, dadoNo, dadoTexto, txEm } from "@/lib/energia/i18n/conta-inclusao";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";
import {
  CAMPO_DIST,
  CAMPO_MUNICIPIO_CONTA,
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
  lugar: CAMPO_MUNICIPIO_CONTA,
  kwh: campo(tiposUrl.inteiro({ min: 0, max: 10000 }), 150, {
    param: "skwh",
    historico: "replace",
  }),
  classe: campo(tiposUrl.opcao(CLASSES), "residencial", { param: "sclasse" }),
  ligacao: campo(tiposUrl.opcao(LIGACOES), "monofasico", { param: "slig" }),
  bandeira: campo(tiposUrl.opcao(["Verde", "Amarela", "Vermelha P1", "Vermelha P2", "vigente"] as const), "vigente", { param: "sband" }), // i18n: dado
};

/** Select ocupa a largura da coluna: sem isso, a opção mais longa define a largura e a página rola de lado no celular. */
const CLASSE_SELECT = "min-h-[44px] w-full min-w-0 max-w-full border border-linha bg-superficie px-2 text-sm text-carvao";

function rotuloEstado(e: EstadoRegra, idioma: Idioma): string {
  const tx = txEm(idioma);
  const rotulos: Record<EstadoRegra, string> = {
    CONFERIDA: tx("conferida no texto oficial", "checked against the official text"),
    PARCIAL: tx("parcialmente conferida (há leitura declarada)", "partially checked (there is a declared reading)"),
    NAO_CONFERIDA: tx("não conferida", "not checked"),
  };
  return rotulos[e];
}

export type ContaSimuladorProps = {
  simulador: Pick<Simulador, "classes" | "regras" | "regras_texto" | "estado_regras" | "bandeiras" | "bandeira_vigente" | "rotulo" | "formula" | "chaves_tarifa"> & {
    /** As distribuidoras com tarifa vigente em tuplas (`compactarDistribuidorasSim`); a tela as expande uma vez. */
    distribuidoras: DistribuidoraSimCompacta[];
    referencia: { cnpj: string; sigla: string | null };
  };
  evidencia: Evidencia | null;
  dataReferencia: string;
  /**
   * Mês em que a página foi gerada ('AAAA-MM', Brasília). O HTML estático sai com ele e o navegador refaz a escolha da bandeira com o
   * mês de quem lê. Sem ele, vale o mês de referência da gold.
   */
  mesDaPagina?: string;
  /** UF de cada distribuidora, para a lista de distribuidoras: quem não sabe a sigla reconhece o estado (`compactarInfo`). */
  info?: InfoCompacta;
};

export function ContaSimulador({ simulador: compacto, evidencia, dataReferencia, mesDaPagina, info: infoCompacta }: ContaSimuladorProps) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const idioma = useIdioma();
  const tx = useTx();
  const { dataBR, mesAno, num, reais } = formatos(idioma);
  const info = useMemo(() => (infoCompacta ? expandirInfo(infoCompacta) : {}), [infoCompacta]);
  const s = useMemo(() => ({ ...compacto, distribuidoras: expandirDistribuidorasSim(compacto.distribuidoras) }), [compacto]);
  const [texto, setTexto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const porCnpj = useMemo(() => new Map(s.distribuidoras.map((d) => [d.cnpj, d])), [s.distribuidoras]);
  const escolhida = v.dist.find((id) => porCnpj.has(id)) ?? null;
  // Recorte municipal sem tarifa identificada não pode virar o exemplo de outra distribuidora.
  const cnpj = escolhida ?? (v.lugar ? "" : s.referencia.cnpj);
  const dist = porCnpj.get(cnpj) ?? null;
  const pedidaFora = v.dist.length > 0 && !escolhida;

  // "Bandeira do mês" usa o acionamento do mês (nome e valor publicados), o mesmo
  // da evidência do pipeline, e não o patamar da tabela de adicionais: nos meses em
  // que os dois recursos divergem, vale o acionado. O mês é o corrente de quem lê;
  // sem ele no arquivo, vale a última registrada e a nota diz que o corrente falta.
  // Sem acionamento publicado, a bandeira fica fora da estimativa e isso é dito (nunca vira verde).
  const vig = s.bandeira_vigente;
  const mesCorrente = useMesCorrente(mesDaPagina ?? vig?.mes_referencia ?? dataReferencia.slice(0, 7));
  const situacao = situacaoBandeira(vig, mesCorrente);
  const usada = bandeiraUsada(situacao);
  const nomeBandeira: string | null = v.bandeira === "vigente" ? (usada?.bandeira ?? null) : v.bandeira;
  const adicional: number | null =
    v.bandeira === "vigente" ? (usada?.bandeira ? (usada.rs_mwh ?? null) : null) : (s.bandeiras.find((b) => b.bandeira === v.bandeira)?.rs_mwh ?? null);
  const semBandeira = nomeBandeira === null || adicional === null;
  const rotuloBandeira = nomeBandeira === null ? tx("não publicada", "not published") : minuscula(bandeiraNoIdioma(nomeBandeira, idioma));
  const classe = s.classes.find((c) => c.id === v.classe) ?? s.classes[0];
  // o rótulo da classe vem da gold em português: a tabela exata dá a forma inglesa
  const rotuloClasse = dadoTexto(classe.rotulo, idioma);
  const sigla = dist ? rotuloDistribuidora(dist.sigla, dist.cnpj) : cnpj;
  const rotuloDist = (id: string) => {
    const d = porCnpj.get(id);
    return d ? rotuloDistribuidora(d.sigla, d.cnpj) : `CNPJ ${id}`;
  };
  // a tarifa que entrou no cálculo (subgrupo e subclasse da fonte) e, em Rural e Demais classes, quantas distribuidoras têm a mesma tarifa da Residencial
  const tarifasUsadas = dist
    ? classe.tarifas.map((chave: ChaveTarifa) => {
        const par = dist.tarifas[chave];
        return { chave, descricao: descricaoDaTarifa(s.chaves_tarifa[chave], idioma), te: par?.[0] ?? null, tusd: par?.[1] ?? null, valida: tarifaDaChave(dist.tarifas, chave) !== null };
      })
    : [];
  const igualResidencial = v.classe === "rural" || v.classe === "demais" ? igualdadeComResidencial(s.distribuidoras, v.classe) : null;
  const tarifaDaClasse = dist && igualResidencial ? tarifaDaChave(dist.tarifas, v.classe as ChaveTarifa) : null;
  const igualAqui = !!dist && tarifaDaClasse !== null && tarifaDaClasse === tarifaDaChave(dist.tarifas, "residencial");
  const leituras = leiturasNaoConferidas(v.classe, s.regras_texto).map((l) => dadoTexto(l, idioma));
  const escolher = (id: string) => {
    const descartada = !v.dist.includes(id) && v.dist.length >= LIMITE_COMPARACAO ? v.dist[LIMITE_COMPARACAO - 1] : null;
    setAviso(
      descartada
        ? tx(
            `O limite é de ${LIMITE_COMPARACAO} distribuidoras: ${rotuloDist(descartada)} saiu da seleção para entrar ${rotuloDist(id)}.`,
            `The limit is ${LIMITE_COMPARACAO} distribution utilities: ${rotuloDist(descartada)} left the selection so that ${rotuloDist(id)} could enter.`,
          )
        : null,
    );
    definir({ dist: destacar(v.dist, id), lugar: "" });
  };

  const r = useMemo(
    () =>
      dist
        ? simular(dist.tarifas, v.classe, v.kwh, v.ligacao, adicional, s.regras, idioma)
        : ({
            disponivel: false,
            motivo: tx("distribuidora sem tarifa vigente", "distribution utility without a tariff in force"),
          } as const),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dist, v.classe, v.kwh, v.ligacao, adicional, s.regras, idioma],
  );
  const ate = Math.min(2000, Math.max(500, Math.ceil(v.kwh / 100) * 100));
  // a curva leva o consumo escolhido como um ponto a mais (se não cair na grade), para o marco do gráfico ter onde parar
  const curva = useMemo(() => {
    if (!dist) return [];
    const base = curvaSimulacao(dist.tarifas, v.classe, v.ligacao, adicional, s.regras, ate, ate / 50, idioma);
    if (v.kwh > ate || base.some((p) => Number(p.kwh) === v.kwh)) return base;
    const r1 = simular(dist.tarifas, v.classe, v.kwh, v.ligacao, adicional, s.regras, idioma);
    const ponto = { kwh: String(v.kwh), total: r1.disponivel ? r1.total : null, energia: r1.disponivel ? r1.energia : null };
    const i = base.findIndex((p) => Number(p.kwh) > v.kwh);
    return i < 0 ? [...base, ponto] : [...base.slice(0, i), ponto, ...base.slice(i)];
  }, [dist, v.classe, v.ligacao, v.kwh, adicional, s.regras, ate, idioma]);
  const comparadas = v.dist
    .filter((id) => porCnpj.has(id))
    .map((id) => {
      const d = porCnpj.get(id)!;
      return {
        id,
        sigla: rotuloDistribuidora(d.sigla, d.cnpj),
        r: simular(d.tarifas, v.classe, v.kwh, v.ligacao, adicional, s.regras, idioma),
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
  const notaArredondamento = r.disponivel ? notaArredondamentoSimulacao([...r.linhas.map((l) => l.valor), semBandeira ? 0 : r.bandeira], r.total, idioma) : null;

  const semTarifaNaVigencia = tx(" (sem tarifa publicada na vigência)", " (no tariff published in the validity period)");
  const memoriaTarifa = tarifasUsadas
    .map((t) => `${t.descricao}${t.valida ? ` (TE ${num((t.te ?? 0) / 1000, 5)} + TUSD ${num((t.tusd ?? 0) / 1000, 5)} R$/kWh)` : semTarifaNaVigencia}`)
    .join("; ");

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
      <RespostaCurta id="p049" vivo veredito={vereditoSimulacao(r, sigla, v.kwh, idioma)}>
        {respostaSimulacao(r, sigla, rotuloClasse, v.kwh, semBandeira ? null : nomeBandeira, dadoTexto(s.rotulo, idioma), idioma)}
      </RespostaCurta>

      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(e) => e.preventDefault()} aria-label={tx("Parâmetros da simulação", "Simulation parameters")}>
        <label className="flex min-w-0 flex-col gap-1 text-sm text-carvao">
          <span className="rotulo text-mineral">{tx("Distribuidora", "Distribution utility")}</span>
          <select value={cnpj} onChange={(e) => escolher(e.target.value)} className={CLASSE_SELECT}>
            {!dist && <option value="" disabled>{tx("Escolha uma distribuidora", "Choose a distribution utility")}</option>}
            {s.distribuidoras.map((d) => (
              // <option> não aceita o <span> de <Nome>: na página inglesa, a própria opção leva a marca de nome próprio
              <option key={d.cnpj} value={d.cnpj} {...(idioma === "en" ? { lang: "pt-BR", translate: "no" as const, "data-i18n-nome": "" } : {})}>
                {rotuloDistribuidora(d.sigla, d.cnpj)}
                {info[d.cnpj]?.uf ? ` (${info[d.cnpj].uf})` : ""}
                {d.cnpj === s.referencia.cnpj ? tx(" · referência", " · reference") : ""}
              </option>
            ))}
          </select>
          {cnpj === s.referencia.cnpj && (
            <span className="text-sm text-carvao-muted">{tx("Referência: a distribuidora de tarifa mais próxima da mediana.", "Reference: the distribution utility with the tariff closest to the median.")}</span>
          )}
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm text-carvao">
          <span className="rotulo text-mineral">{tx("Classe", "Class")}</span>
          <select
            value={v.classe}
            onChange={(e) => definir({ classe: e.target.value as ClasseSimuladorId })}
            className={CLASSE_SELECT}
          >
            {s.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {dadoTexto(c.rotulo, idioma)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex min-w-0 flex-col gap-1 text-sm text-carvao">
          <label htmlFor="conta-skwh" className="rotulo text-mineral">
            {tx("Consumo no mês (kWh)", "Consumption in the month (kWh)")}
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
              aria-label={tx("Consumo no mês (kWh), controle deslizante", "Consumption in the month (kWh), slider")}
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
          <span className="rotulo text-mineral">{tx("Ligação", "Connection")}</span>
          <select
            value={v.ligacao}
            onChange={(e) => definir({ ligacao: e.target.value as Ligacao })}
            className={CLASSE_SELECT}
          >
            {LIGACOES.map((l) => (
              <option key={l} value={l}>
                {tx(
                  `${nomeLigacao(l, idioma)} (mínimo de ${s.regras.custo_disponibilidade_kwh[l]} kWh)`,
                  `${nomeLigacao(l, idioma)} (minimum of ${s.regras.custo_disponibilidade_kwh[l]} kWh)`,
                )}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm text-carvao">
          <span className="rotulo text-mineral">{tx("Bandeira", "Tariff flag")}</span>
          <select
            value={v.bandeira}
            onChange={(e) => definir({ bandeira: e.target.value as typeof v.bandeira })}
            className={CLASSE_SELECT}
          >
            <option value="vigente">
              {situacao.estado === "corrente" ? tx("Do mês corrente", "Current month's flag") : tx("Última registrada", "Latest recorded")}
              {usada?.bandeira
                ? ` (${bandeiraNoIdioma(usada.bandeira, idioma)}, ${mesAno(`${usada.mes}-01`)}${
                    usada.rs_mwh === null
                      ? tx(", sem valor publicado", ", no published value")
                      : usada.rs_mwh === 0
                        ? tx(", sem acréscimo", ", no surcharge")
                        : `, ${reais(usada.rs_mwh / 1000, 5)}/kWh`
                  })`
                : tx(" (não publicada)", " (not published)")}
            </option>
            {s.bandeiras.map((b) => (
              <option key={b.bandeira} value={b.bandeira}>
                {bandeiraNoIdioma(b.bandeira, idioma)} (
                {b.rs_kwh === null ? tx("sem valor publicado", "no published value") : b.rs_kwh === 0 ? tx("sem acréscimo", "no surcharge") : `${reais(b.rs_kwh, 5)}/kWh`})
              </option>
            ))}
          </select>
        </label>
      </form>

      {kwhInvalido && (
        <p id="conta-skwh-erro" role="alert" className="text-sm text-erro" data-erro="consumo">
          {tx(
            <>Digite um número inteiro de 0 a 10.000 kWh. A estimativa abaixo continua a do último consumo válido ({num(v.kwh, 0)} kWh).</>,
            <>Enter a whole number from 0 to 10,000 kWh. The estimate below remains that of the last valid consumption ({num(v.kwh, 0)} kWh).</>,
          )}
        </p>
      )}

      <ContaSelecionadas
        ids={v.dist}
        rotulo={rotuloDist}
        aoTirar={(id) => {
          setAviso(null);
          definir({ dist: remover(v.dist, id), lugar: "" });
        }}
        aoLimpar={() => {
          setAviso(null);
          definir({ dist: [], lugar: "" });
        }}
        aviso={aviso}
        limite={LIMITE_COMPARACAO}
      />

      {v.bandeira === "vigente" && situacao.estado === "corrente" && (
        <p className="text-xs leading-relaxed text-carvao-muted" data-nota="bandeira-publicada" data-bandeira-estado={situacao.estado} data-bandeira-mes={mesCorrente}>
          {fraseBandeira(situacao, idioma)} {fonteBandeira(vig, idioma)}{" "}
          {tx("Para simular outra bandeira, escolha na lista.", "To simulate another tariff flag, choose it in the list.")}
        </p>
      )}

      {v.bandeira === "vigente" && situacao.estado !== "corrente" && (
        <p role="status" className="text-sm text-carvao-muted" data-nota="bandeira-publicada" data-bandeira-estado={situacao.estado} data-bandeira-mes={mesCorrente}>
          {fraseBandeira(situacao, idioma)} {fonteBandeira(vig, idioma)}{" "}
          {situacao.estado === "mes_ausente"
            ? tx(
                "A estimativa usa a última registrada, que não é a do mês corrente; para simular outra bandeira, escolha na lista.",
                "The estimate uses the latest recorded one, which is not the current month's; to simulate another tariff flag, choose it in the list.",
              )
            : tx("A estimativa fica sem bandeira; para simular uma, escolha na lista.", "The estimate has no tariff flag; to simulate one, choose it in the list.")}
        </p>
      )}

      {pedidaFora && (
        <p role="status" className="text-sm text-carvao-muted">
          {v.lugar ? tx(
            `A distribuidora deste recorte não tem tarifa vigente em ${dataBR(dataReferencia)}. Escolha uma distribuidora para calcular a estimativa.`,
            `The distribution utility in this view has no tariff in force on ${dataBR(dataReferencia)}. Choose a distribution utility to calculate the estimate.`,
          ) : tx(
            <>
              A distribuidora escolhida no ranking não tem tarifa vigente em {dataBR(dataReferencia)}; a simulação usa a de referência (
              {rotuloDistribuidora(s.referencia.sigla, s.referencia.cnpj)}).
            </>,
            <>
              The distribution utility chosen in the ranking has no tariff in force on {dataBR(dataReferencia)}; the simulation uses the reference one (
              {rotuloDistribuidora(s.referencia.sigla, s.referencia.cnpj)}).
            </>,
          )}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div role="group" aria-label={tx("Resultado da simulação", "Simulation result")} className="border border-linha bg-papel p-5">
          <p className="rotulo text-mineral">{tx(`Estimativa mensal, ${sigla}`, `Monthly estimate, ${sigla}`)}</p>
          {r.disponivel ? (
            <p className="mt-2 font-serif text-[2rem] leading-none tabular-nums text-carvao">{reais(r.total)}</p>
          ) : (
            <p className="mt-2 font-serif text-xl text-carvao-muted">{tx("Simulação indisponível", "Simulation unavailable")}</p>
          )}
          <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
            {r.disponivel ? dadoTexto(s.rotulo, idioma).replace(/\.\s*$/, "") : r.motivo}.{" "}
            {tx(
              `Tarifas da vigência iniciada em ${dist ? dataBR(dist.inicio) : "sem data"} (${dist?.ato ?? "sem ato"}).`,
              `Tariffs of the validity period started on ${dist ? dataBR(dist.inicio) : "no date"} (${dist?.ato ?? "no act"}).`,
            )}
          </p>
          {tarifasUsadas.length > 0 && (
            <p className="mt-2 text-xs leading-relaxed text-carvao" data-tarifa-usada="">
              {tx("Tarifa usada:", "Tariff used:")} {tarifasUsadas.map((t) => t.descricao).join("; ")}.
            </p>
          )}
          {igualResidencial && igualResidencial.total > 0 && (
            <p className="mt-2 text-xs leading-relaxed text-carvao" data-nota="classe-igual-residencial">
              {tx(
                <>
                  Na fonte, a tarifa de {classe.rotulo.split(" (")[0]} é igual à de Residencial em {num(igualResidencial.iguais, 0)} de {num(igualResidencial.total, 0)} distribuidoras do conjunto
                  {igualAqui ? `, inclusive na ${sigla}` : ""}, e o valor {igualResidencial.iguais === igualResidencial.total ? "é o mesmo" : "pode ser o mesmo"} da classe Residencial.{" "}
                  {v.classe === "rural" ? "O desconto rural não está incluído neste cálculo." : "Nenhum desconto de classe está incluído neste cálculo."}
                </>,
                <>
                  In the source, the {rotuloClasse.split(" (")[0]} tariff equals the Residential tariff at {num(igualResidencial.iguais, 0)} of {num(igualResidencial.total, 0)} distribution
                  utilities in the dataset{igualAqui ? `, including ${sigla}` : ""}, and the value {igualResidencial.iguais === igualResidencial.total ? "is the same as" : "may be the same as"} that of the
                  Residential class. {v.classe === "rural" ? "The rural discount is not included in this calculation." : "No class discount is included in this calculation."}
                </>,
              )}
            </p>
          )}
          {leituras.length > 0 && (
            <p className="mt-2 border border-dashed border-mineral px-3 py-2 text-xs leading-relaxed text-carvao" data-selo="regra-parcial">
              <span className="font-medium">{tx("Regra parcialmente conferida.", "Partially checked rule.")}</span>{" "}
              {tx(
                `Este valor depende de leitura do observatório, ainda não conferida no texto oficial: ${leituras.join("; ")}.`,
                `This value depends on the observatory's reading, not yet checked against the official text: ${leituras.join("; ")}.`,
              )}{" "}
              <a href="#regras-da-classe" className="text-energia-dark underline underline-offset-4">
                {tx("Ver as regras desta classe", "See the rules for this class")}
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
          {/* tabela do kit (TabelaDados): a memória de cálculo com a estimativa na última linha */}
          <p className="font-serif text-lg text-carvao">{tx("Memória de cálculo", "Calculation breakdown")}</p>
          {tarifasUsadas.length > 0 && (
            <p className="mt-1 text-xs leading-relaxed text-carvao-muted" data-memoria-tarifa="">
              {tx("Tarifa usada:", "Tariff used:")} {memoriaTarifa}.
            </p>
          )}
          {r.disponivel ? (
            <TabelaDados
              recolhida={false}
              idioma={idioma}
              titulo={tx("Memória de cálculo da simulação", "Simulation calculation breakdown")}
              colunas={[tx("Item", "Item"), "kWh", "R$/kWh", tx("Valor", "Amount")]}
              linhas={[
                ...r.linhas.map((l) => [l.rotulo, l.kwh, l.rs_kwh, reais(l.valor)]),
                [
                  semBandeira
                    ? tx("Bandeira: adicional não publicado, fora da estimativa", "Tariff flag: surcharge not published, left out of the estimate")
                    : tx(`Bandeira ${rotuloBandeira} sobre o consumo sujeito`, `${rotuloBandeira} tariff flag on the consumption subject to it`),
                  r.kwh_bandeira,
                  adicional === null ? null : adicional / 1000,
                  semBandeira ? null : reais(r.bandeira),
                ],
                [tx("Estimativa sem tributos e sem iluminação pública", "Estimate without taxes and without public lighting"), tx(`${num(r.kwh_faturado, 0)} faturados`, `${num(r.kwh_faturado, 0)} billed`), null, reais(r.total)],
              ]}
              casas={[null, 0, 5, null]}
              ausencia={{ "R$/kWh": tx("sem valor", "no value"), [tx("Valor", "Amount")]: tx("sem valor", "no value") }}
              destaqueUltimaLinha
              limite={r.linhas.length + 2}
            />
          ) : (
            <p className="mt-2 text-sm text-carvao-muted" role="status">
              {tx(`${r.motivo}: nenhuma tarifa de outra classe é usada no lugar.`, `${r.motivo}: no tariff from another class is used instead.`)}
            </p>
          )}
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
          <p className="mt-2 text-xs text-mineral">{tx(`Fórmula publicada: ${s.formula}.`, `Published formula: ${dadoTexto(s.formula, idioma)}.`)}</p>
        </div>
      </div>

      {!r.disponivel ? (
        <p role="status" className="border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao-muted" data-grafico-indisponivel="">
          {tx(
            `Sem gráfico: a simulação está indisponível para ${sigla} nesta classe (${r.motivo}). Nenhuma tarifa de outra classe é usada no lugar.`,
            `No chart: the simulation is unavailable for ${sigla} in this class (${r.motivo}). No tariff from another class is used instead.`,
          )}
        </p>
      ) : (
      <GraficoLinhas
        titulo={tx(
          `Estimativa mensal por consumo, ${sigla}, ${minuscula(classe.rotulo)}, ligação ${nomeLigacao(v.ligacao)}`,
          `Monthly estimate by consumption, ${sigla}, ${minuscula(rotuloClasse)}, ${nomeLigacao(v.ligacao, idioma)} connection`,
        )}
        dados={curva}
        chaveX="kwh"
        formatoX="texto"
        marcos={v.kwh <= ate ? [{ x: String(v.kwh), rotulo: `${num(v.kwh, 0)} kWh` }] : []}
        series={[
          {
            id: "total", // i18n: dado
            rotulo: semBandeira
              ? tx("Bandeira não publicada (igual à linha sem bandeira)", "Tariff flag not published (same as the line without the tariff flag)")
              : tx(`Com bandeira ${rotuloBandeira}`, `With the ${rotuloBandeira} tariff flag`),
            cor: "var(--cor-energia)", // i18n: dado
          },
          {
            id: "energia", // i18n: dado
            rotulo: tx("Sem bandeira", "Without the tariff flag"),
            cor: "var(--serie-referencia)",
            tracejada: true,
          },
        ]}
        unidade={tx("R$/mês", "R$/month")}
        casas={2}
        zeroNoEixo
        altura={260}
      />
      )}
      <p className="text-xs text-mineral">
        {tx(
          <>
            Eixo horizontal: consumo no mês, de 0 a {num(ate, 0)} kWh. A linha muda de inclinação onde muda a regra (mínimo da ligação, faixas da Tarifa Social e do Desconto Social).
          </>,
          <>
            Horizontal axis: consumption in the month, from 0 to {num(ate, 0)} kWh. The line changes slope where the rule changes (connection minimum, Tarifa Social and Desconto Social bands).
          </>,
        )}
      </p>

      {comparadas.length > 0 && (
        <div>
          <p className="font-serif text-lg text-carvao">
            {tx(
              `Mesma simulação nas distribuidoras escolhidas (${num(v.kwh, 0)} kWh, ${minuscula(classe.rotulo)})`,
              `Same simulation at the chosen distribution utilities (${num(v.kwh, 0)} kWh, ${minuscula(rotuloClasse)})`,
            )}
          </p>
          <TabelaDados
            recolhida={false}
            idioma={idioma}
            titulo={tx("Mesma simulação nas distribuidoras escolhidas", "Same simulation at the chosen distribution utilities")}
            colunas={[tx("Distribuidora", "Distribution utility"), tx("Energia (TE + TUSD)", "Energy (TE + TUSD)"), tx("Bandeira", "Tariff flag"), tx("Estimativa", "Estimate")]}
            linhas={comparadas.map((c) =>
              c.r.disponivel
                ? [c.sigla, reais(c.r.energia), semBandeira ? null : reais(c.r.bandeira), reais(c.r.total)]
                : [c.sigla, tx(`indisponível: ${c.r.motivo}`, `unavailable: ${c.r.motivo}`), null, null],
            )}
            ausencia={{ [tx("Bandeira", "Tariff flag")]: tx("sem valor", "no value"), [tx("Estimativa", "Estimate")]: tx("indisponível", "unavailable") }}
            linhasDestacadas={comparadas.flatMap((c, i) => (c.id === cnpj ? [i] : []))}
            limite={comparadas.length}
          />
        </div>
      )}

      <div id="regras-da-classe" className="scroll-mt-28">
        <h3 className="font-serif text-lg text-carvao">{tx("Regras aplicadas a esta classe", "Rules applied to this class")}</h3>
        <ul className="mt-2 space-y-3 text-sm leading-relaxed">
          {regrasAplicadas.map((rg) => {
            // a separação entre o que o leitor lê e o detalhe técnico é feita no texto português da gold; cada parte tem a sua forma inglesa
            const partes = separaBloqueioDeNorma(rg.aplicacao_no_simulador);
            const tecnico = partes.tecnico ? dadoNo(partes.tecnico, "conta-regra-tecnico", idioma) : null;
            const naoConferidas = rg.partes.filter((p) => p.estado !== "CONFERIDA");
            return (
              <li key={rg.id} className="border-l-2 border-linha pl-3">
                <p className="text-carvao">{dadoNo(partes.leitor, "conta-regra", idioma)}</p>
                {(s.estado_regras[rg.id] ?? rg.estado) !== "CONFERIDA" && (
                  <p className="mt-1 text-xs text-carvao-muted">
                    {tx("Parte desta regra é leitura do observatório, ainda não conferida no texto oficial.", "Part of this rule is the observatory's reading, not yet checked against the official text.")}
                  </p>
                )}
                <p className="mt-1 text-xs text-carvao-muted" data-nivel="analisar">
                  {tecnico}
                  {tecnico ? " " : ""}
                  {tx("Estado:", "Status:")} {rotuloEstado(s.estado_regras[rg.id] ?? rg.estado, idioma)}.{" "}
                  {naoConferidas.map((p, i) => (
                    <span key={p.texto}>
                      {i > 0 ? " " : ""}
                      {tx("Leitura declarada, não conferida:", "Declared reading, not checked:")} “{dadoNo(p.texto, "conta-regra-parte", idioma)}”
                      {p.motivo ? <> ({dadoNo(p.motivo, "conta-regra-motivo", idioma)})</> : null}.
                    </span>
                  ))}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
