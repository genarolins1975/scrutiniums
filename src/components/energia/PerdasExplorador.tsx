"use client";

import { useEffect, useMemo, useState } from "react";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { PerdasMapa, type EntidadeMapa } from "@/components/energia/PerdasMapa";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Comparador, type EntidadeComparavel } from "@/components/energia/Comparador";
import { GraficoLinhas, type SerieLinha } from "@/components/energia/GraficoLinhas";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { mesAno, num } from "@/lib/energia/formato";
import type { Evidencia } from "@/lib/energia/evidencia";
import {
  MEDIDAS,
  ORDEM_MEDIDAS,
  ROTULO_GRUPO,
  ajustaConsulta,
  carregarJson,
  classificacaoMedida,
  colunasDoPeriodo,
  historicoDistribuidora,
  linhasDistribuidoras,
  medidasDoPeriodo,
  recortesDoPeriodo,
  respostaDistribuidora,
  respostaMapa,
  avisoTerritorio,
  rotuloDistribuidora,
  serieComparacao,
  valoresDoPeriodo,
  type DistribuidoraLeve,
  type IdMedida,
  type PeriodoPerdas,
} from "@/lib/energia/perdas";
import type { AcumuladoAno, EvidenciasDistribuidoras, LinhaNacional, SerieAnualPerdas } from "@/lib/energia/tipos-perdas";

/**
 * Explorador do painel "Onde estão as perdas e como evoluíram?" (P055): período, medida e
 * distribuidora na URL (voltar e avançar refazem a consulta), mapa das áreas, resposta
 * curta da consulta, painel da distribuidora escolhida com histórico e "Comprove este
 * número", comparador de até quatro distribuidoras e a tabela de todas, com exportação.
 *
 * Uma só fonte para tudo: mapa, tabela, exportação e texto saem dos mesmos recortes e
 * das mesmas regras (src/lib/energia/perdas.ts). Ano de referência e acumulado vêm da
 * gold, já na página; outro ano, o histórico e o comparador leem a série anual
 * (perdas_anual.json) só quando pedidos, e a evidência por distribuidora
 * (perdas_evidencias.json) só quando uma distribuidora é escolhida.
 */

export type PerdasExploradorProps = {
  distribuidoras: DistribuidoraLeve[];
  periodos: PeriodoPerdas[];
  anoRef: number;
  nacional: LinhaNacional[];
  acumulado: AcumuladoAno | null;
  urls: { anual: string; municipios: string; evidencias: string };
  versao: string;
  /** Ano da relação conjunto × município que desenha as áreas (gold.mapa.ano_relacao). */
  anoRelacao: number | null;
};

const SELECT =
  "h-11 w-full border border-linha bg-superficie px-2 text-sm text-carvao focus:outline-none focus-visible:ring-2 focus-visible:ring-energia";

type Carga<T> = { estado: "ocioso" | "carregando" } | { estado: "pronto"; dado: T } | { estado: "erro"; erro: string };

function useJsonSobDemanda<T>(url: string, pedir: boolean): [Carga<T>, () => void] {
  const [carga, setCarga] = useState<Carga<T>>({ estado: "ocioso" });
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (!pedir) return;
    let vivo = true;
    setCarga((c) => (c.estado === "pronto" ? c : { estado: "carregando" }));
    carregarJson<T>(url).then(
      (dado) => vivo && setCarga({ estado: "pronto", dado }),
      (e: unknown) => vivo && setCarga({ estado: "erro", erro: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
  }, [url, pedir, tentativa]);
  return [carga, () => setTentativa((t) => t + 1)];
}

export function PerdasExplorador({ distribuidoras, periodos, anoRef, nacional, acumulado, urls, versao, anoRelacao }: PerdasExploradorProps) {
  const ids = useMemo(() => distribuidoras.map((d) => d.cnpj), [distribuidoras]);
  const chaveIds = ids.join(",");
  const chavePeriodos = periodos.map((p) => p.id).join(",");
  const esquema = useMemo(
    () => ({
      periodo: campo(tiposUrl.opcao(periodos.map((p) => p.id)), String(anoRef), { param: "periodo" }),
      medida: campo(tiposUrl.opcao(ORDEM_MEDIDAS), "taxa" as IdMedida, { param: "medida" }),
      d: campo(tiposUrl.opcao(ids), "", { param: "d" }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as chaves resumem as listas
    [chaveIds, chavePeriodos, anoRef],
  );
  const [v, definir] = useEstadoUrl(esquema);
  const { periodo, medida } = ajustaConsulta(periodos, v.periodo, v.medida);
  const sel = v.d ? distribuidoras.find((d) => d.cnpj === v.d) ?? null : null;

  /* comparador: a seleção vem do próprio componente (URL ?cmp=) */
  const [comparadas, setComparadas] = useState<string[]>([]);

  /* série anual sob demanda: outro ano, histórico da escolhida ou comparação */
  const precisaAnual = (periodo.tipo === "ano" && !periodo.referencia) || !!sel || comparadas.length > 0;
  const [cargaAnual, tentarAnual] = useJsonSobDemanda<SerieAnualPerdas>(urls.anual, precisaAnual);
  const anual = cargaAnual.estado === "pronto" ? cargaAnual.dado : null;
  const [cargaEvid, tentarEvid] = useJsonSobDemanda<EvidenciasDistribuidoras>(urls.evidencias, !!sel);
  const evidSel = sel && cargaEvid.estado === "pronto" ? (cargaEvid.dado.evidencias[sel.cnpj] as Evidencia | undefined) ?? null : null;

  /* recortes, valores, classes e linhas: a mesma origem para mapa, tabela, texto e arquivo */
  const recortes = useMemo(() => recortesDoPeriodo(distribuidoras, periodo, anual), [distribuidoras, periodo, anual]);
  const valores = useMemo(() => (recortes ? valoresDoPeriodo(distribuidoras, recortes, medida.id, periodo) : null), [distribuidoras, recortes, medida.id, periodo]);
  const classes = useMemo(() => (valores ? classificacaoMedida(medida, valores) : null), [medida, valores]);
  const linhas = useMemo(
    () => (recortes && valores && classes ? linhasDistribuidoras(distribuidoras, recortes, periodo, { valores, classes }) : null),
    [distribuidoras, recortes, periodo, valores, classes],
  );
  const colunas = useMemo(() => colunasDoPeriodo(periodo, medida), [periodo, medida]);
  const rotulos = useMemo(() => Object.fromEntries(distribuidoras.map((d) => [d.cnpj, rotuloDistribuidora(d)])), [distribuidoras]);
  const linhaNac = nacional.find((l) => l.ano === periodo.ano && l.universo === "concessionarias") ?? null;
  const resposta = valores ? respostaMapa({ periodo, medida, valores, rotulos, nacional: linhaNac, acumulado }) : null;
  const entidadesMapa = useMemo<EntidadeMapa[]>(
    () => distribuidoras.map((d) => ({ id: d.cnpj, rotulo: rotuloDistribuidora(d), nome: d.nome, ufs: d.territorio?.ufs.join("/") ?? "" })),
    [distribuidoras],
  );
  const entidadesComp = useMemo<EntidadeComparavel[]>(
    () =>
      distribuidoras.map((d) => ({
        id: d.cnpj,
        rotulo: rotuloDistribuidora(d),
        detalhe: `${d.nome}${d.territorio?.ufs.length ? `, ${d.territorio.ufs.join("/")}` : ""}${d.ativa ? "" : " (série encerrada)"}`,
        sinonimos: [d.nome, d.cnpj, d.cnpj_formatado, ...(d.territorio?.ufs ?? [])],
      })),
    [distribuidoras],
  );
  const nComparaveis = valores ? Object.values(valores).filter((x) => x.estado === "valor").length : null;
  // quantas têm algum valor publicado no período (comparável ou fora): o universo do período, não o da série inteira
  const nComDado = valores ? Object.values(valores).filter((x) => x.estado !== "sem-dado").length : null;
  const disponiveis = medidasDoPeriodo(periodo);
  const consultaPadrao = periodo.id === String(anoRef) && medida.id === "taxa" && !sel;

  const selecionar = (id: string | null) => definir({ d: id ?? "" });

  /* histórico da distribuidora escolhida, com a taxa das concessionárias como referência */
  const historico = useMemo(() => {
    if (!sel || !anual) return null;
    const h = historicoDistribuidora(anual.distribuidoras[sel.cnpj] ?? []);
    const nac = new Map(nacional.filter((l) => !l.parcial && l.universo === "concessionarias").map((l) => [String(l.ano), l.taxa_total_pct]));
    return { ...h, dados: h.pontos.map((p) => ({ ano: p.ano, taxa: p.taxa, brasil: nac.get(p.ano) ?? null })) };
  }, [sel, anual, nacional]);

  return (
    <div className="space-y-6">
      {/* consulta: período, medida e o que está aplicado */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="perdas-periodo" className="rotulo mb-1 block text-mineral">
            Período
          </label>
          <select id="perdas-periodo" className={SELECT} value={periodo.id} onChange={(e) => definir({ periodo: e.target.value })}>
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="perdas-medida" className="rotulo mb-1 block text-mineral">
            Medida
          </label>
          <select id="perdas-medida" className={SELECT} value={medida.id} onChange={(e) => definir({ medida: e.target.value as IdMedida })}>
            {ORDEM_MEDIDAS.map((m) => (
              <option key={m} value={m} disabled={!disponiveis.includes(m)}>
                {MEDIDAS[m].rotulo} ({MEDIDAS[m].unidade}){disponiveis.includes(m) ? "" : MEDIDAS[m].soReferencia ? ", só no ano de referência" : ", não existe no acumulado"}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{medida.explicacao}</p>
      <div role="group" className="flex flex-wrap items-center gap-2 text-xs text-carvao-muted" aria-label="Consulta aplicada">
        <span className="rotulo text-mineral">Consulta</span>
        <span className="border border-linha bg-superficie px-2 py-1">Período: {periodo.rotulo}</span>
        <span className="border border-linha bg-superficie px-2 py-1">Medida: {medida.rotulo}</span>
        {sel && <span className="border border-linha bg-superficie px-2 py-1">Distribuidora: {rotuloDistribuidora(sel)}</span>}
        {!consultaPadrao && (
          <button
            type="button"
            onClick={() => definir({ periodo: String(anoRef), medida: "taxa", d: "" })}
            className="rotulo inline-flex min-h-[44px] items-center px-2 text-energia-dark underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
          >
            Restaurar a consulta padrão
          </button>
        )}
      </div>

      {/* resposta da consulta atual, com período, universo e unidade */}
      <div className="border-l-2 border-energia pl-4" aria-live="polite">
        {resposta ? (
          <p className="text-base leading-relaxed text-carvao" data-resposta="mapa">
            {resposta}
          </p>
        ) : cargaAnual.estado === "erro" ? (
          <p className="text-sm text-carvao">
            Não foi possível carregar a série anual ({cargaAnual.erro}).{" "}
            <button type="button" className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-energia" onClick={tentarAnual}>
              Tentar de novo
            </button>
          </p>
        ) : (
          <p role="status" className="text-sm text-carvao-muted">
            Carregando a série anual de {periodo.ano} (perdas_anual.json).
          </p>
        )}
        <p className="mt-1 text-xs text-mineral">
          Período: {periodo.rotulo}. Universo: {distribuidoras.length} distribuidoras com balanço no SAMP em algum ano
          {nComDado !== null && nComparaveis !== null ? `; ${nComDado} com valor publicado neste período, ${nComparaveis} delas comparáveis nesta medida` : ""}. Unidade: {medida.unidade}.
        </p>
      </div>

      {valores ? (
        <PerdasMapa
          titulo="Perdas de energia por área de distribuidora"
          entidades={entidadesMapa}
          valores={valores}
          medida={medida}
          periodo={periodo.rotulo}
          selecionado={sel?.cnpj ?? null}
          onSelecionar={selecionar}
          urlMunicipios={urls.municipios}
          avisoTerritorio={avisoTerritorio(distribuidoras, periodo, anoRelacao)}
        />
      ) : (
        <div className="flex h-[380px] items-center justify-center border border-linha bg-superficie px-6 text-center text-sm text-carvao-muted sm:h-[540px]">
          O mapa de {periodo.ano} aparece quando a série anual terminar de carregar.
        </div>
      )}

      {/* distribuidora escolhida: nome, resposta, prova e histórico */}
      <section aria-labelledby="perdas-selecao-titulo" className="border border-linha bg-papel px-4 py-4 md:px-6" data-selecao={sel?.cnpj ?? ""}>
        <h3 id="perdas-selecao-titulo" className="rotulo text-mineral">
          Distribuidora escolhida
        </h3>
        {!sel ? (
          <p className="mt-2 text-sm text-carvao-muted">Nenhuma. Escolha uma área no mapa, uma linha da tabela ou busque pelo nome; a escolha vai para o endereço da página e segue para os outros painéis de perdas.</p>
        ) : (
          <div className="mt-2 space-y-3">
            <p className="font-serif text-lg text-carvao">
              {sel.sigla ? `${sel.sigla} · ` : ""}
              {sel.nome}
            </p>
            <p className="text-xs text-mineral">
              CNPJ {sel.cnpj_formatado} · {ROTULO_GRUPO[sel.grupo]} · série no SAMP de {mesAno(sel.primeira_competencia)} a {mesAno(sel.ultima_competencia)}
              {sel.ativa ? "" : " (encerrada)"}
              {sel.territorio ? ` · área: ${num(sel.territorio.municipios, 0)} municípios (${num(sel.territorio.exclusivos, 0)} só dela, ${num(sel.territorio.compartilhados, 0)} compartilhados, ${num(sel.territorio.nao_confirmados, 0)} sem confirmação)` : " · sem área na relação de municípios"}
            </p>
            <p className="text-sm leading-relaxed text-carvao" data-resposta="distribuidora">
              {respostaDistribuidora(sel, anoRef)}
            </p>
            <div className="flex flex-wrap items-center gap-x-6">
              {evidSel ? (
                <ComproveNumero evidencia={evidSel} rotulo={`Comprove a taxa de ${anoRef}`} endereco={`https://scrutiniums.com/setor-eletrico/perdas?d=${sel.cnpj}#mapa`} />
              ) : cargaEvid.estado === "carregando" ? (
                <span role="status" className="text-xs text-carvao-muted">
                  Carregando a evidência da taxa de {anoRef}.
                </span>
              ) : cargaEvid.estado === "erro" ? (
                <button type="button" className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4" onClick={tentarEvid}>
                  Evidência não carregou ({cargaEvid.erro}); tentar de novo
                </button>
              ) : cargaEvid.estado === "pronto" ? (
                <span className="text-xs text-carvao-muted">Sem evidência da taxa de {anoRef}: a distribuidora não tem taxa anual nesse ano.</span>
              ) : null}
              <a href={`/setor-eletrico/perdas/composicao?d=${sel.cnpj}#composicao`} className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                Técnicas e não técnicas
              </a>
              <a href={`/setor-eletrico/perdas/regulatorio?d=${sel.cnpj}#regulatorio`} className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                Percentual técnico regulatório
              </a>
              <a href={`/setor-eletrico/perdas/custo-e-contexto?d=${sel.cnpj}#custo`} className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                Custo na tarifa e contexto
              </a>
            </div>
            {historico ? (
              <div>
                <GraficoLinhas
                  titulo={`Taxa de perdas totais de ${rotuloDistribuidora(sel)} por ano`}
                  dados={historico.dados}
                  chaveX="ano"
                  formatoX="texto"
                  series={[
                    { id: "taxa", rotulo: rotuloDistribuidora(sel), cor: "var(--cor-energia)", espessura: 2.5 },
                    { id: "brasil", rotulo: "Concessionárias (agregado)", sigla: "Agregado", cor: "var(--serie-referencia)", tracejada: true },
                  ]}
                  unidade="%"
                  casas={2}
                  zeroNoEixo
                  marcos={historico.mudancas.map((a) => ({ x: String(a), rotulo: `${a}: quebra de escala ou absorção` }))}
                  altura={260}
                />
                <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
                  Só anos completos e sem alerta entram na linha (lacuna é ano fora, nunca zero).
                  {historico.fora.length
                    ? ` Fora: ${historico.fora.map((f) => `${f.ano} (${f.motivo})`).join("; ")}.`
                    : " Nenhum ano da série ficou fora."}
                  {historico.mudancas.length ? " As marcas verticais indicam anos com quebra de escala ou absorção provável: a taxa antes e depois descreve áreas diferentes." : ""}
                </p>
              </div>
            ) : cargaAnual.estado === "erro" ? (
              <p className="text-sm text-carvao">
                O histórico não carregou ({cargaAnual.erro}).{" "}
                <button type="button" className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-energia" onClick={tentarAnual}>
                  Tentar de novo
                </button>
              </p>
            ) : (
              <p role="status" className="text-xs text-carvao-muted">
                Carregando o histórico anual.
              </p>
            )}
            <button
              type="button"
              onClick={() => selecionar(null)}
              className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
            >
              Limpar a escolha
            </button>
          </div>
        )}
      </section>

      {/* comparação de até quatro distribuidoras na mesma escala */}
      <section aria-labelledby="perdas-comparar-titulo" data-nivel="analisar" className="space-y-3">
        <h3 id="perdas-comparar-titulo" className="font-serif text-lg text-carvao">
          Como cada distribuidora evoluiu? Compare até quatro
        </h3>
        <Comparador
          rotulo="Distribuidoras para comparar"
          entidades={entidadesComp}
          chaveUrl="cmp"
          onMudar={setComparadas}
          dicaBusca="Sigla, nome, CNPJ ou UF"
          vazio={<p className="text-sm text-carvao-muted">Escolha até quatro distribuidoras para ver a taxa de perdas totais de cada ano na mesma escala, com o agregado das concessionárias como referência.</p>}
        >
          {(ctx) =>
            ctx.selecionadas.length === 0 ? null : anual ? (
              <div>
                <GraficoLinhas
                  titulo={`Taxa de perdas totais: ${ctx.selecionadas.map((e) => e.rotulo).join(", ")}`}
                  dados={serieComparacao(
                    ctx.selecionadas.map((e) => e.id),
                    anual,
                    nacional.filter((l) => l.universo === "concessionarias"),
                  )}
                  chaveX="ano"
                  formatoX="texto"
                  series={[
                    ...ctx.selecionadas.map<SerieLinha>((e, i) => ({ id: e.id, rotulo: e.rotulo, cor: `var(--serie-comp-${i + 1})` })),
                    { id: "brasil", rotulo: "Concessionárias (agregado)", sigla: "Agregado", cor: "var(--serie-referencia)", tracejada: true },
                  ]}
                  unidade="%"
                  casas={2}
                  zeroNoEixo
                  legendaInterativa
                  escalaAoOcultar="manter"
                  altura={300}
                />
                <p className="mt-2 text-xs text-carvao-muted">
                  Mesma escala para todas. Cada linha só tem os anos completos e sem alerta da distribuidora; anos com quebra de escala ou absorção aparecem no histórico de cada uma, ao escolhê-la.
                </p>
              </div>
            ) : (
              <p role="status" className="text-sm text-carvao-muted">
                {cargaAnual.estado === "erro" ? `A série anual não carregou (${cargaAnual.erro}).` : "Carregando a série anual."}
              </p>
            )
          }
        </Comparador>
      </section>

      {/* tabela de todas as distribuidoras: as mesmas linhas e classes do mapa */}
      {linhas ? (
        <TabelaInterativa
          key={`${periodo.id}-${medida.id}`}
          titulo={`Distribuidoras, ${periodo.rotulo}`}
          colunas={colunas}
          linhas={linhas}
          chaveLinha="id"
          colunaRotulo="distribuidora"
          fonte="ANEEL, SAMP Balanço (perdas totais, técnicas e não técnicas, energia injetada e mercado de baixa tensão)"
          versao={versao}
          nomeArquivo={`perdas-distribuidoras-${periodo.id}-${medida.id}`}
          chaveUrl="tab"
          selecionado={sel?.cnpj ?? null}
          onSelecionar={selecionar}
          ordemInicial={{ coluna: "valor_mapa", direcao: "desc" }}
          dicaBusca="Sigla, nome, CNPJ ou UF"
          nota={
            <>
              As colunas &quot;Classe no mapa&quot; e &quot;Valor no mapa&quot; são a tabela equivalente do mapa ({medida.rotulo.toLowerCase()}, {medida.unidade}). Valor fora da comparação
              aparece com o número da fonte e o motivo; célula vazia é ausência, nunca zero.
            </>
          }
        />
      ) : (
        <p role="status" className="text-sm text-carvao-muted">
          A tabela de {periodo.ano} aparece com a série anual.
        </p>
      )}
    </div>
  );
}
