"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { BarraNatureza, BarrasPorFonte, type ItemBarraFonte } from "@/components/energia/GeracaoBarrasFontes";
import { GeracaoAviso, GeracaoEscolha, GeracaoRecorte } from "@/components/energia/GeracaoControles";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import {
  CATEGORIAS,
  COR_CATEGORIA,
  COR_COMPARACAO,
  JANELAS,
  PERIMETROS,
  REGIOES,
  coberturaMensal,
  colunasMatriz,
  colunasMensalMatriz,
  comparacaoEntreJanelas,
  composicaoDaJanela,
  curtoCategoria,
  doRegiao,
  fechamentoDaComposicao,
  janelaAdjetivo,
  janelaEscolhida,
  janelaReferencia,
  janelasDisponiveis,
  linhasCategoriasMensal,
  linhasMatriz,
  linhasMensalMatriz,
  listaTexto,
  maioresFontes,
  minusculaPalavras,
  mwmed,
  noRegiao,
  nomeRegiao,
  notaTipoIII,
  paraTabela,
  partesDaNatureza,
  perimetroEmFrase,
  periodoMix,
  primeiroMesComMmgd,
  respostaMatriz,
  ressalvasDaJanela,
  rotuloJanela,
  rotuloPerimetro,
  textoNatureza,
  totalDaJanela,
  vereditoMatriz,
  type LinhaFonte,
} from "@/lib/energia/geracao";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { CategoriaGeracao, Matriz, MensalSin } from "@/lib/energia/tipos-geracao";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * P021, matriz efetiva. O recorte fica na URL: região (?rg=), janela (?jan=), perímetro com
 * ou sem a MMGD estimada (?per=), categoria selecionada (?cat=), categorias comparadas no
 * histórico (?cmp=, até quatro) e o intervalo do histórico (?de=, ?ate=); busca, ordem e
 * filtros de cada tabela também (prefixos mx, mm, mc). Escolher uma categoria na barra ou
 * na tabela leva a mesma categoria ao histórico mensal.
 *
 * Ordem da abertura: o veredito e os filtros, as cinco maiores fontes (recorte, dito como tal) e o recorte como legenda; as notas do painel
 * (`notas`) e os capítulos do módulo (`aposPrincipal`) logo depois da figura principal; em seguida seções visíveis, cada uma com a
 * sua pergunta: a composição completa (todas as categorias, com o fechamento), a natureza do dado, a comparação entre janelas (só das
 * fontes cuja cobertura na base não mudou), a comparação de 365 dias (`comparacaoAnual`) e a série mensal. A comparação de categorias
 * fica em Analisar.
 *
 * A resposta escrita, os gráficos de participação e a tabela equivalente saem da mesma
 * janela (composicaoDaJanela e linhasMatriz sobre a mesma gold): mudar o recorte muda os três juntos. Nenhuma participação é
 * calculada aqui; a referência de comparação é a janela de 365 dias da mesma região (ou a
 * de 30 dias, quando a escolhida já é a de 365).
 */
const ESQUEMA = {
  rg: campo(tiposUrl.opcao(REGIOES), "SIN"),
  jan: campo(tiposUrl.opcao(JANELAS), "30d"),
  per: campo(tiposUrl.opcao(PERIMETROS), "com"), // i18n: dado
  cat: campo(tiposUrl.texto({ max: 30 }), ""),
  cmp: campo(tiposUrl.lista(tiposUrl.opcao(CATEGORIAS), { max: LIMITE_COMPARACAO }), [] as CategoriaGeracao[]),
  de: campo(tiposUrl.mes(), ""),
  ate: campo(tiposUrl.mes(), ""),
  tp: campo(tiposUrl.opcao(["agrupadas", "separadas"] as const), "agrupadas"),
};

/** Térmicas pequenas, somadas por padrão no gráfico mensal empilhado: camadas finas e de cor parecida não se distinguem só pela cor. A tabela mantém uma coluna por categoria. */
const GRUPO_TERMICAS: readonly CategoriaGeracao[] = ["carvao", "oleo", "biomassa", "outros", "termica_sem_combustivel"];
const ID_DEMAIS_TERMICAS = "demais_termicas";
const MAIORES = 5;

export function GeracaoMatriz({
  janelas,
  mensal,
  nomes,
  marcos,
  fonte,
  versao,
  fontesTipo3 = [],
  notas,
  aposPrincipal,
  fichas,
  naturezaIntro,
  naturezaMensal,
  comparacaoAnual,
}: {
  janelas: Matriz["janelas"];
  mensal: MensalSin;
  /** Nome completo de cada categoria, como a gold publica (no idioma da página). */
  nomes: Record<CategoriaGeracao, string>;
  /** Mudanças de universo declaradas pela fonte, em AAAA-MM. */
  marcos: { x: string; rotulo: string }[];
  fonte: string;
  versao: string;
  /** Fontes das pequenas usinas Tipo III (hidráulicas, eólicas, solares e térmicas), para a nota que concilia o Tipo III do texto com o do gráfico. */
  fontesTipo3?: readonly string[];
  /** Notas do painel (NotasDoPainel: o que mudou, como interpretar, o que não é possível concluir), logo depois da figura principal. */
  notas?: ReactNode;
  /** Conteúdo depois da figura principal e das notas (os capítulos do módulo), antes das seções complementares. */
  aposPrincipal?: ReactNode;
  /** Fichas "Comprove este número" dos valores de 30 dias do SIN, montadas no servidor (cada uma diz o próprio recorte). */
  fichas?: ReactNode;
  /** Frase da seção de natureza: de quando existem a previsão Tipo III e a estimativa da MMGD, lida do dado. */
  naturezaIntro?: ReactNode;
  /** Série mensal da natureza do dado (gráfico e tabela sob demanda), montada no servidor: não depende do recorte. */
  naturezaMensal?: ReactNode;
  /** Comparação de 365 dias contra os 365 anteriores (seção com pergunta própria), montada no servidor: não depende do recorte. */
  comparacaoAnual?: ReactNode;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const idioma = useIdioma();
  const tx = useTx();
  const { dataBR, mesAno, num, pct, plural } = formatos(idioma);
  const CURTO_CATEGORIA = curtoCategoria(idioma);
  const NOME_REGIAO = nomeRegiao(idioma);
  const DO_REGIAO = doRegiao(idioma);
  const NO_REGIAO = noRegiao(idioma);
  const ROTULO_JANELA = rotuloJanela(idioma);
  const PERIMETRO_EM_FRASE = perimetroEmFrase(idioma);
  const UNIDADE = mwmed(idioma);
  const OPCOES_TERMICAS = [
    { id: "agrupadas" as const, rotulo: tx("Somadas em demais térmicas", "Added up as other small thermal") },
    { id: "separadas" as const, rotulo: tx("Separadas", "Separate") },
  ];
  const OPCOES_REGIAO = REGIOES.map((r) => ({ id: r, rotulo: r === "SE" ? tx("SE/CO", "SE/CW") : r === "SIN" ? "SIN" : NOME_REGIAO[r], detalhe: NOME_REGIAO[r] }));
  const OPCOES_PERIMETRO = PERIMETROS.map((p) => ({ id: p, rotulo: rotuloPerimetro(idioma)[p] }));
  /** "31/08/2026 a 29/09/2026" ou "29/09/2026" (janela de um dia), sem repetir a contagem de dias que o rótulo da janela já traz. */
  const periodoCurto = (x: { inicio: string; fim: string }) => (x.inicio === x.fim ? dataBR(x.inicio) : tx(`${dataBR(x.inicio)} a ${dataBR(x.fim)}`, `${dataBR(x.inicio)} to ${dataBR(x.fim)}`));

  const m = useMemo(() => ({ janelas }), [janelas]);
  const rg = v.rg;
  const per = v.per;
  const { janela, mix, ajustada } = janelaEscolhida(m, rg, v.jan);
  const ref = janelaReferencia(janela);
  const mixRef = janelas[rg]?.[ref] ?? null;
  const linhas = useMemo(() => linhasMatriz(m, rg, janela, per, nomes, idioma), [m, rg, janela, per, nomes, idioma]);
  const fontes = useMemo(() => composicaoDaJanela(m, rg, janela, per, idioma), [m, rg, janela, per, idioma]);
  const maiores = maioresFontes(fontes, MAIORES);
  const fecho = fechamentoDaComposicao(fontes);
  const comparacao = useMemo(() => comparacaoEntreJanelas(m, rg, janela, per, idioma), [m, rg, janela, per, idioma]);
  const natureza = partesDaNatureza(mix, idioma);
  const resposta = respostaMatriz(m, rg, janela, per, idioma);
  const ressalvas = ressalvasDaJanela(mix, nomes, idioma).filter((r) => !(per === "sem" && r.id === "solar_mmgd"));
  const presencas = linhas.filter((l) => l.presenca);
  const sel = linhas.some((l) => l.id === v.cat) ? (v.cat as CategoriaGeracao) : null;
  const selecionar = (id: string | null) => definir({ cat: id ?? "" });
  const disponiveis = janelasDisponiveis(m, rg);
  const opcoesJanela = JANELAS.map((j) => ({
    id: j,
    rotulo: ROTULO_JANELA[j],
    desativada: !disponiveis.includes(j),
    detalhe: disponiveis.includes(j)
      ? undefined
      : tx(`indisponível ${NO_REGIAO[rg]}: só o SIN tem a janela de ${ROTULO_JANELA[j].toLowerCase()}`, `unavailable ${NO_REGIAO[rg]}: only the SIN has the ${janelaAdjetivo(j, idioma)} window`),
  }));
  const janelasFaltam = disponiveis.length < JANELAS.length;
  const total = totalDaJanela(mix, per);

  const mensalEscolhido = useMemo(() => linhasMensalMatriz(mensal, per, idioma), [mensal, per, idioma]);
  const mensalLinhas = mensalEscolhido.linhas;
  // gráfico mensal: as térmicas pequenas somadas (padrão) ou separadas; a soma só existe quando todas as partes existem no mês (ausência não vira zero)
  const grupoNaSerie = GRUPO_TERMICAS.filter((c) => mensalEscolhido.series.includes(c));
  const chaveGrupo = grupoNaSerie.join(",");
  const somar = v.tp === "agrupadas" && grupoNaSerie.length >= 2;
  const rotuloDemais = tx("Demais térmicas", "Other small thermal");
  const barrasMensais = useMemo(() => {
    if (!somar) return { dados: paraTabela(mensalLinhas, idioma), series: mensalEscolhido.series.map((c) => ({ id: c as string, rotulo: CURTO_CATEGORIA[c], cor: COR_CATEGORIA[c] })) };
    const dados = paraTabela(
      mensalLinhas.map((l) => {
        const partes = grupoNaSerie.map((c) => l[c]);
        return { ...l, [ID_DEMAIS_TERMICAS]: partes.some((x) => x === null || x === undefined) ? null : partes.reduce<number>((t, x) => t + (x as number), 0) };
      }),
      idioma,
    );
    const series = [
      ...mensalEscolhido.series.filter((c) => !grupoNaSerie.includes(c)).map((c) => ({ id: c as string, rotulo: CURTO_CATEGORIA[c], cor: COR_CATEGORIA[c] })),
      { id: ID_DEMAIS_TERMICAS, rotulo: rotuloDemais, cor: "var(--serie-2)" },
    ];
    return { dados, series };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o grupo é recriado a cada render; a chave textual estabiliza
  }, [somar, mensalLinhas, mensalEscolhido.series, chaveGrupo, idioma]);
  const inicioMmgd = primeiroMesComMmgd(mensal);
  const ultimo = mensalLinhas[mensalLinhas.length - 1];
  const coberturaDaSerie = coberturaMensal(mensal, idioma).filter((c) => !(per === "sem" && c.id === "solar_mmgd"));
  const coberturaTexto = coberturaDaSerie
    .map((c) =>
      tx(
        `${CURTO_CATEGORIA[c.id].toLowerCase()} em ${plural(c.meses, "mês", "meses")} da série (o último, ${mesAno(c.ultimo)})`,
        `${CURTO_CATEGORIA[c.id].toLowerCase()} in ${plural(c.meses, "month", "months")} of the series (the latest, ${mesAno(c.ultimo)})`,
      ),
    )
    .join("; ");

  // histórico: as categorias comparadas; sem escolha, a selecionada; sem seleção, a maior da janela
  const comSerie = CATEGORIAS.filter((c) => mensal[c].some((x) => x !== null));
  const maior = fontes[0]?.id ?? "hidraulica";
  const comparadas = (v.cmp as CategoriaGeracao[]).filter((c) => comSerie.includes(c));
  const noHistorico: CategoriaGeracao[] = comparadas.length ? comparadas : [sel ?? maior];
  const chaveHistorico = noHistorico.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a lista é recriada a cada render; a chave textual estabiliza
  const historico = useMemo(() => linhasCategoriasMensal(mensal, noHistorico), [mensal, chaveHistorico]);
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;

  const item = (l: LinhaFonte): ItemBarraFonte => ({
    id: l.id,
    rotulo: l.rotulo,
    valor: l.participacao,
    texto: pct(l.participacao, 1),
    auxiliar: l.mwmed === null ? undefined : `${num(l.mwmed, 0)} ${UNIDADE}`,
    natureza: l.natureza,
    cobertura: l.cobertura !== null,
  });
  const tituloJanela = `${DO_REGIAO[rg]}: ${ROTULO_JANELA[janela]} (${PERIMETRO_EM_FRASE[per]})`;
  const periodoRecorte = mix ? periodoMix(mix, idioma) : tx("sem janela publicada", "no window published");
  const nomesNoHistorico = noHistorico.map((c) => CURTO_CATEGORIA[c]).join(", ");
  const dataQuebra = dataBR("2023-04-29");

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <RespostaCurta id="p021" vivo veredito={vereditoMatriz(m, rg, v.jan, per, idioma) || resposta}>
            {resposta}
          </RespostaCurta>
          <div className="flex flex-col gap-3">
            <GeracaoEscolha legenda={tx("Região", "Region")} opcoes={OPCOES_REGIAO} valor={rg} onEscolher={(x) => definir({ rg: x })} />
            <GeracaoEscolha legenda={tx("Janela", "Window")} opcoes={opcoesJanela} valor={janela} onEscolher={(x) => definir({ jan: x })} />
            {janelasFaltam && (
              <p className="-mt-1 text-xs leading-relaxed text-carvao-muted" data-janelas-indisponiveis="">
                {tx(
                  <>Para {NOME_REGIAO[rg]}, a base publicada tem só as janelas de 30 e 365 dias; as de um dia e de 7 dias existem só para o SIN.</>,
                  <>For the {NOME_REGIAO[rg]}, the published dataset only has the 30-day and 365-day windows; the one-day and 7-day windows exist only for the SIN.</>,
                )}
              </p>
            )}
            <GeracaoEscolha legenda={tx("Perímetro", "Scope")} opcoes={OPCOES_PERIMETRO} valor={per} onEscolher={(x) => definir({ per: x })} />
          </div>
          {ajustada && (
            <GeracaoAviso>
              {tx(
                <>A janela pedida não é publicada para {NOME_REGIAO[rg]}: os subsistemas têm só 30 e 365 dias. Mostrando {ROTULO_JANELA[janela]}.</>,
                <>The requested window is not published for the {NOME_REGIAO[rg]}: the subsystems only have 30 and 365 days. Showing {ROTULO_JANELA[janela]}.</>,
              )}
            </GeracaoAviso>
          )}
        </div>
        <BarrasPorFonte
          titulo={tx(`Cinco maiores participações na geração ${tituloJanela}`, `Five largest shares of generation ${tituloJanela}`)}
          subtitulo={tx(
            <>
              Recorte das {maiores.length === MAIORES ? "cinco" : maiores.length} maiores fontes, não a composição completa.
              {fontes.length > maiores.length && <> As outras {plural(fontes.length - maiores.length, "categoria", "categorias")} aparecem na composição completa, logo abaixo.</>}
            </>,
            <>
              Selection of the {maiores.length === MAIORES ? "five" : maiores.length} largest sources, not the full composition.
              {fontes.length > maiores.length && <> The other {plural(fontes.length - maiores.length, "category", "categories")} appear in the full composition, just below.</>}
            </>,
          )}
          itens={maiores.map(item)}
          selecionado={sel}
          onSelecionar={selecionar}
        />
      </div>

      <GeracaoRecorte
        periodo={mix ? tx(`${periodoRecorte}; dias completos (24 horas em todos os subsistemas)`, `${periodoRecorte}; complete days (24 hours in every subsystem)`) : periodoRecorte}
        universo={tx(
          <>
            Usinas, conjuntos e grupos de pequenas usinas da Geração por Usina do ONS, {NO_REGIAO[rg]}
            {mix ? `. Natureza da energia, no perímetro com a MMGD estimada: ${textoNatureza(mix.natureza_pct, idioma)}` : ""}
          </>,
          <>
            Plants, plant clusters and groups of small plants in the ONS generation by plant dataset, {NO_REGIAO[rg]}
            {mix ? `. Nature of the energy, in the scope with the estimated MMGD: ${textoNatureza(mix.natureza_pct, idioma)}` : ""}
          </>,
        )}
        unidade={
          per === "com"
            ? tx("MWmed (energia média do período) e % da geração com a MMGD estimada", "MWavg (average energy in the period) and % of generation with the estimated MMGD")
            : tx("MWmed (energia média do período) e % da geração sem a MMGD", "MWavg (average energy in the period) and % of generation without the MMGD")
        }
      />

      {notas}

      {aposPrincipal}

      <SecaoDoPainel
        id="composicao"
        titulo={tx("Como se divide toda a geração?", "How is all generation split?")}
        lead={tx(
          "Todas as categorias da janela escolhida, da maior para a menor participação, cada uma com a energia média em MWmed.",
          "All categories in the chosen window, from the largest to the smallest share, each with its average energy in MWavg.",
        )}
      >
        <BarrasPorFonte
          titulo={tx(
            `Composição completa da geração ${tituloJanela}, ${plural(fontes.length, "categoria", "categorias")}`,
            `Full composition of generation ${tituloJanela}, ${plural(fontes.length, "category", "categories")}`,
          )}
          itens={fontes.map(item)}
          selecionado={sel}
          onSelecionar={selecionar}
          rodape={
            <p
              className={`mt-3 border-t border-linha pt-2 text-sm leading-relaxed ${fecho.fecha ? "text-carvao-muted" : "border-l-2 border-aviso pl-3 text-carvao"}`}
              data-composicao-fecha={fecho.fecha ? "sim" : "nao"}
              role={fecho.fecha ? undefined : "alert"}
            >
              {total !== null && tx(<>Total da janela: {num(total, 0)} MWmed. </>, <>Window total: {num(total, 0)} MWavg. </>)}
              {fecho.fecha
                ? tx(
                    <>
                      Soma das {fecho.categorias} participações exibidas: {num(fecho.soma, 2)}%. Cada participação tem duas casas decimais, e o controle publicado aceita até {num(fecho.tolerancia, 2)} ponto
                      percentual de diferença em relação a 100%.
                    </>,
                    <>
                      Sum of the {fecho.categorias} shares shown: {num(fecho.soma, 2)}%. Each share has two decimal places, and the published check accepts a difference of up to {num(fecho.tolerancia, 2)} percentage
                      point from 100%.
                    </>,
                  )
                : tx(
                    <>
                      Soma das {fecho.categorias} participações exibidas: {num(fecho.soma, 2)}%, fora da tolerância de {num(fecho.tolerancia, 2)} ponto percentual do controle publicado: a composição não fecha nesta
                      janela.
                    </>,
                    <>
                      Sum of the {fecho.categorias} shares shown: {num(fecho.soma, 2)}%, outside the published check tolerance of {num(fecho.tolerancia, 2)} percentage point: the composition does not add up in this
                      window.
                    </>,
                  )}
            </p>
          }
        />
        {fichas}
        {notaTipoIII(mix, per, fontesTipo3, idioma) && <GeracaoAviso>{notaTipoIII(mix, per, fontesTipo3, idioma)}</GeracaoAviso>}
        {ressalvas.length > 0 && (
          <div className="space-y-1 border-l-2 border-aviso pl-3 text-sm text-carvao" data-ressalvas="p021">
            <p className="rotulo text-mineral">{tx("Ressalvas de universo nesta janela", "Coverage caveats in this window")}</p>
            <ul className="space-y-1">
              {ressalvas.map((r) => (
                <li key={r.id} className="[overflow-wrap:anywhere]">
                  <span className="text-carvao">{CURTO_CATEGORIA[r.id]}</span>: {r.texto.replace(idioma === "en" ? /^Coverage caveat: / : /^Ressalva de universo: /, "")}
                </li>
              ))}
            </ul>
            <p className="text-carvao-muted">
              {tx(
                "A participação continua publicada, mas reflete só as usinas que a fonte publicou com dado; não se compara com a de períodos anteriores.",
                "The share is still published, but it reflects only the plants the source published with data; it is not comparable with earlier periods.",
              )}
            </p>
          </div>
        )}
        {presencas.length > 0 && (
          <GeracaoAviso>
            {tx(
              <>Presença parcial no período: {presencas.map((l) => `${CURTO_CATEGORIA[l.id]} (${l.presenca})`).join("; ")}. A categoria entra com a energia dos dias em que existe.</>,
              <>Partial presence in the period: {presencas.map((l) => `${CURTO_CATEGORIA[l.id]} (${l.presenca})`).join("; ")}. The category enters with the energy of the days on which it exists.</>,
            )}
          </GeracaoAviso>
        )}
        <TabelaInterativa
          titulo={tx(`Tabela equivalente: geração e participação por categoria, ${NOME_REGIAO[rg]}`, `Equivalent table: generation and share by category, ${NOME_REGIAO[rg]}`)}
          colunas={colunasMatriz(janela, per, idioma)}
          linhas={paraTabela(
            linhas.map((l) => ({ ...l, ressalva: l.ressalva ?? tx("sem ressalva", "no caveat"), presenca: l.presenca ?? tx("não", "no") })),
            idioma,
          )}
          chaveLinha="id"
          colunaRotulo="categoria"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`geracao-matriz-${rg}-${janela}-${per}`}
          chaveUrl="mx"
          selecionado={sel}
          onSelecionar={selecionar}
          nota={tx(
            "Categoria sem linha no período fica vazia (ausência), distinta de zero. As participações vêm da base publicada, sem novo arredondamento; somam 100% dentro de 0,05 ponto em cada janela (controle publicado).",
            `A category with no row in the period is left empty (missing), distinct from zero. The shares come from the published dataset, without new rounding; they add up to 100% within ${num(0.05, 2)} point in each window (published check).`,
          )}
        />
      </SecaoDoPainel>

      <SecaoDoPainel id="natureza" titulo={tx("Quanto da energia é medição, previsão ou estimativa?", "How much of the energy is measurement, forecast or estimate?")} lead={naturezaIntro}>
        <BarraNatureza
          titulo={tx(
            `Natureza da energia ${DO_REGIAO[rg]}: ${ROTULO_JANELA[janela]}, no perímetro com a MMGD estimada`,
            `Nature of the energy ${DO_REGIAO[rg]}: ${ROTULO_JANELA[janela]}, in the scope with the estimated MMGD`,
          )}
          partes={natureza.map((p) => ({ ...p, texto: pct(p.pct, 1) }))}
        />
        {naturezaMensal}
      </SecaoDoPainel>

      <SecaoDoPainel
        id="janelas"
        titulo={tx(`Como a janela de ${ROTULO_JANELA[janela]} se compara com a de ${ROTULO_JANELA[ref]}?`, `How does the ${janelaAdjetivo(janela, idioma)} window compare with the ${janelaAdjetivo(ref, idioma)} window?`)}
        lead={tx(
          "A participação de cada fonte na janela escolhida e na janela de referência. Só entram as fontes cuja cobertura na base não mudou entre as duas.",
          "The share of each source in the chosen window and in the reference window. Only sources whose coverage in the dataset did not change between the two are included.",
        )}
      >
        <GraficoBarras
          titulo={tx(
            `Participação na geração ${DO_REGIAO[rg]}: ${ROTULO_JANELA[janela]} contra ${ROTULO_JANELA[ref]} (${PERIMETRO_EM_FRASE[per]})`,
            `Share of generation ${DO_REGIAO[rg]}: ${ROTULO_JANELA[janela]} against ${ROTULO_JANELA[ref]} (${PERIMETRO_EM_FRASE[per]})`,
          )}
          dados={paraTabela(
            comparacao.comparaveis.map((l) => ({ id: l.id, curto: l.rotulo, participacao: l.participacao, participacao_ref: l.participacao_ref })),
            idioma,
          )}
          chaveCategoria="id"
          chaveRotulo="curto"
          series={[
            { id: "participacao", rotulo: mix ? `${ROTULO_JANELA[janela]}: ${periodoCurto(mix)}` : ROTULO_JANELA[janela], cor: "var(--cor-energia)" }, // i18n: dado
            { id: "participacao_ref", rotulo: mixRef ? `${ROTULO_JANELA[ref]}: ${periodoCurto(mixRef)}` : ROTULO_JANELA[ref], cor: "var(--serie-referencia)" },
          ]}
          unidade="%"
          casas={1}
          orientacao="horizontal"
          rotulosValor
          selecionado={sel}
          onSelecionar={selecionar}
        />
        <p className="text-sm leading-relaxed text-carvao-muted" data-sazonalidade="p021">
          {tx(
            <>
              A janela de 365 dias cobre o ciclo inteiro do ano; a mais curta, só parte de uma estação. A diferença entre as duas barras de cada fonte inclui a sazonalidade (vento, sol e chuva variam ao
              longo do ano) e, sozinha, não indica mudança de longo prazo.
            </>,
            <>
              The 365-day window covers the whole yearly cycle; the shorter one, only part of a season. The difference between the two bars of each source includes seasonality (wind, sun and rain vary over
              the year) and, on its own, does not indicate a long-term change.
            </>,
          )}
        </p>
        {comparacao.fora.length > 0 && (
          <div className="space-y-1 border-l-2 border-aviso pl-3 text-sm text-carvao" data-fora-da-comparacao="p021">
            <p className="rotulo text-mineral">{tx("Fora da comparação: cobertura da fonte alterada", "Left out of the comparison: source coverage changed")}</p>
            <ul className="space-y-1">
              {comparacao.fora.map((f) => (
                <li key={f.id} className="[overflow-wrap:anywhere]">
                  <span className="text-carvao">{f.rotulo}</span>: {f.motivo}.
                </li>
              ))}
            </ul>
            <p className="text-carvao-muted">
              {tx(
                "A participação de cada janela está na composição completa e na tabela. A diferença entre as duas não mede mudança na geração: a fonte passou a publicar outro número de usinas com dado.",
                "The share in each window is in the full composition and in the table. The difference between the two does not measure a change in generation: the source started publishing a different number of plants with data.",
              )}
            </p>
          </div>
        )}
      </SecaoDoPainel>

      {comparacaoAnual}

      <SecaoDoPainel
        id="historico-mensal"
        titulo={tx("Como a energia de cada fonte evoluiu, mês a mês?", "How has the energy from each source evolved, month by month?")}
        lead={tx(
          `Geração média mensal do SIN por categoria, ${PERIMETRO_EM_FRASE[per]}: as barras empilhadas somam o total do mês.`,
          `Average monthly SIN generation by category, ${PERIMETRO_EM_FRASE[per]}: the stacked bars add up to the month's total.`,
        )}
      >
        {grupoNaSerie.length >= 2 && (
          <GeracaoEscolha
            legenda={tx("Térmicas pequenas no gráfico", "Small thermal plants in the chart")}
            opcoes={OPCOES_TERMICAS}
            valor={somar ? "agrupadas" : "separadas"}
            onEscolher={(x) => definir({ tp: x })}
          />
        )}
        {somar && (
          <p className="text-xs leading-relaxed text-carvao-muted" data-termicas-somadas="">
            {tx(
              <>
                Demais térmicas soma {listaTexto(grupoNaSerie.map((c) => minusculaPalavras(CURTO_CATEGORIA[c])), idioma)}. Uma categoria sem valor num mês deixa a soma do mês sem valor (hachura), nunca zero. A tabela abaixo traz uma coluna por categoria.
              </>,
              <>
                Other small thermal adds up {listaTexto(grupoNaSerie.map((c) => minusculaPalavras(CURTO_CATEGORIA[c])), idioma)}. A category with no value in a month leaves the month&apos;s sum without a value (hatched), never zero. The table below has one column per category.
              </>,
            )}
          </p>
        )}
        <GraficoBarras
          titulo={tx(`Geração média mensal do SIN por categoria, ${PERIMETRO_EM_FRASE[per]}`, `Average monthly SIN generation by category, ${PERIMETRO_EM_FRASE[per]}`)}
          dados={barrasMensais.dados}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={barrasMensais.series}
          unidade={UNIDADE}
          casas={0}
          empilhado
          altura={340}
        />
        <GeracaoAviso>
          {per === "com"
            ? tx(
                `Com a MMGD, a série começa em ${inicioMmgd ? mesAno(inicioMmgd) : "sem mês"}, o primeiro mês em que a estimativa do ONS existe em todos os dias (ela começa em 29/04/2023). Para comparar com antes dessa data, escolha o perímetro sem MMGD.`,
                `With the MMGD, the series starts in ${inicioMmgd ? mesAno(inicioMmgd) : "no month"}, the first month in which the ONS estimate exists on every day (it starts on ${dataQuebra}). To compare with the period before that date, choose the scope without MMGD.`,
              )
            : tx(
                "Sem a MMGD, a série cobre todo o período publicado e pode ser comparada através de 29/04/2023. Em jan/2021 e fev/2021 os grupos térmicos Tipo III ainda não existiam na fonte: a pilha fica incompleta (hachura), não zero.",
                `Without the MMGD, the series covers the whole published period and can be compared across ${dataQuebra}. In ${mesAno("2021-01")} and ${mesAno("2021-02")} the Type III thermal groups did not yet exist in the source: the stack is incomplete (hatched), not zero.`,
              )}
          {ultimo && ultimo.parcial !== tx("não", "no") ? tx(` O último mês (${ultimo.mes}) é ${ultimo.parcial}.`, ` The latest month (${ultimo.mes}) is ${ultimo.parcial}.`) : ""}
        </GeracaoAviso>
        {coberturaDaSerie.length > 0 && (
          <GeracaoAviso>
            {tx(
              <>
                Mudança de cobertura na fonte: {coberturaTexto}. Nesses meses a
                fonte publicou outro número de usinas com dado, e a variação dessas categorias pode refletir a cobertura, não só a geração.
              </>,
              <>
                Change of coverage in the source: {coberturaTexto}. In those months the
                source published a different number of plants with data, and the variation of these categories may reflect coverage, not only generation.
              </>,
            )}
          </GeracaoAviso>
        )}
        <TabelaInterativa
          titulo={tx(`Tabela equivalente: geração média mensal por categoria (${PERIMETRO_EM_FRASE[per]})`, `Equivalent table: average monthly generation by category (${PERIMETRO_EM_FRASE[per]})`)}
          colunas={colunasMensalMatriz(mensalEscolhido.series, idioma)}
          linhas={paraTabela(mensalLinhas, idioma)}
          chaveLinha="id"
          colunaRotulo="mes"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`geracao-matriz-mensal-${per}`}
          chaveUrl="mm"
          nota={tx(
            "Mês com ressalva de universo numa categoria: a participação dela naquele mês reflete só as usinas publicadas com dado.",
            "Month with a coverage caveat in a category: its share in that month reflects only the plants published with data.",
          )}
        />
      </SecaoDoPainel>

      <SecaoDoPainel nivel="analisar" id="comparar-categorias" titulo={tx(`Comparar até ${LIMITE_COMPARACAO} categorias na mesma escala`, `Compare up to ${LIMITE_COMPARACAO} categories on the same scale`)}>
        <Comparador
          rotulo={tx(
            `Categorias no histórico (até ${LIMITE_COMPARACAO}); sem escolha, a selecionada no gráfico ou a maior da janela`,
            `Categories in the history (up to ${LIMITE_COMPARACAO}); with no choice, the one selected in the chart or the largest in the window`,
          )}
          entidades={comSerie.map((c) => ({ id: c, rotulo: CURTO_CATEGORIA[c], detalhe: nomes[c] }))}
          selecionadas={comparadas}
          onMudar={(ids) => definir({ cmp: ids as CategoriaGeracao[] })}
          dicaBusca={tx("Eólica, gás, biomassa", "Wind, gas, biomass")}
          vazio={tx(`Mostrando ${CURTO_CATEGORIA[noHistorico[0]]}. Escolha até quatro categorias para comparar.`, `Showing ${CURTO_CATEGORIA[noHistorico[0]]}. Choose up to four categories to compare.`)}
        >
          {() => null}
        </Comparador>
        <GraficoLinhas
          titulo={tx(`Geração média mensal do SIN: ${nomesNoHistorico}`, `Average monthly SIN generation: ${nomesNoHistorico}`)}
          dados={historico}
          chaveX="m"
          formatoX="mes"
          series={noHistorico.map((c, i) => ({ id: c, rotulo: CURTO_CATEGORIA[c], cor: noHistorico.length > 1 ? COR_COMPARACAO[i % COR_COMPARACAO.length] : COR_CATEGORIA[c] }))}
          unidade={UNIDADE}
          casas={0}
          zeroNoEixo
          zoom
          intervalo={intervalo}
          onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
          marcos={marcos}
        />
        <TabelaInterativa
          titulo={tx(`Tabela equivalente: geração média mensal (${nomesNoHistorico})`, `Equivalent table: average monthly generation (${nomesNoHistorico})`)}
          colunas={[{ id: "m", rotulo: tx("Mês", "Month"), tipo: "texto" }, ...noHistorico.map((c) => ({ id: c, rotulo: CURTO_CATEGORIA[c], tipo: "numero" as const, unidade: UNIDADE, casas: 1 }))]}
          linhas={paraTabela(historico, idioma)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`geracao-categorias-mensal-${noHistorico.join("-")}`}
          chaveUrl="mc"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
          nota={tx(
            `Mês em que a categoria não tem linha na fonte fica vazio (ausência): a MMGD antes de 29/04/2023 e os grupos térmicos Tipo III antes de mar/2021, por exemplo. Valores de ${num(mensal.meses.length, 0)} meses.`,
            `A month in which the category has no row in the source is left empty (missing): the MMGD before ${dataQuebra} and the Type III thermal groups before ${mesAno("2021-03")}, for example. Values for ${num(mensal.meses.length, 0)} months.`,
          )}
        />
      </SecaoDoPainel>
    </div>
  );
}
