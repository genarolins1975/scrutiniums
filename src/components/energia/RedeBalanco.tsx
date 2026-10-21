"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { RedeEscolha } from "@/components/energia/RedeControles";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import {
  COR_SM,
  NOME_PAIS,
  NOME_SM,
  PAISES,
  REGIOES_BALANCO,
  colunasBalancoMensal,
  colunasExterior12m,
  colunasExteriorMensal,
  colunasIdentidades,
  colunasItaipu,
  curtoSm,
  identidadesDa,
  linhasBalancoMensal,
  linhasExterior12m,
  linhasExteriorMensal,
  linhasIdentidades,
  linhasItaipu,
  linhasResiduoMensal,
  listaTexto,
  marcosQuebras,
  nomePais,
  nomeSm,
  paraTabela,
  respostaBalanco,
  vereditoBalanco,
  vereditoExterior,
  respostaExterior,
} from "@/lib/energia/rede";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { BalancoRede, ExteriorRede, PaisRede, SubsistemaOuSin } from "@/lib/energia/tipos-rede";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";

/**
 * P029, balanço e exterior. O recorte fica na URL: região (?sm=), regiões comparadas
 * (?sms=, até quatro), país (?pais=) e intervalo dos gráficos mensais (?de=, ?ate=);
 * busca, ordem, filtros e página de cada tabela também (prefixos id.t, bm, res, ex,
 * e12, ita). Escolher uma identidade na barra ou na tabela não muda a região; a região
 * escolhida muda a resposta, as barras, a série mensal e a tabela juntas.
 *
 * Os resíduos são publicados como a gold os traz (contagens por identidade e somas
 * mensais sobre as horas de cada identidade): nada é forçado a zero, e nenhum resíduo
 * é atribuído a perdas ou ao exterior por hipótese (achado A05).
 */
const ESQUEMA = {
  sm: campo(tiposUrl.opcao(REGIOES_BALANCO), "SIN"),
  sms: campo(tiposUrl.lista(tiposUrl.opcao(REGIOES_BALANCO), { max: LIMITE_COMPARACAO }), ["SE", "S", "NE", "N"] as SubsistemaOuSin[]),
  pais: campo(tiposUrl.opcao(PAISES), "ARGENTINA"),
  de: campo(tiposUrl.mes(), ""),
  ate: campo(tiposUrl.mes(), ""),
};

const opcoesRegiao = (idioma: Idioma) => REGIOES_BALANCO.map((sm) => ({ id: sm, rotulo: sm === "SE" ? curtoSm("SE", idioma) : nomeSm(sm, idioma), detalhe: nomeSm(sm, idioma) }));
const opcoesPais = (idioma: Idioma) => PAISES.map((p) => ({ id: p, rotulo: nomePais(p, idioma) }));

export function RedeBalanco({
  balanco,
  exterior,
  periodo,
  fonte,
  versao,
  notas,
  aposPrincipal,
}: {
  balanco: Pick<BalancoRede, "identidades" | "mensal" | "quebras" | "tolerancia_mwmed" | "faixas_mwmed">;
  exterior: Pick<ExteriorRede, "meses" | "por_pais" | "resumo_12m" | "itaipu">;
  periodo: { inicio: string; fim: string };
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel: o que mudou e a ressalva essencial), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Conteúdo depois das notas (os capítulos do módulo), antes das seções complementares. */
  aposPrincipal?: ReactNode;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const { dataBR, horaLocal, mesAno, num } = formatos(idioma);
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const sm = v.sm as SubsistemaOuSin;
  const pais = v.pais as PaisRede;
  const escolhidas = v.sms as SubsistemaOuSin[];
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const aoIntervalo = (i: { inicio: string; fim: string } | null) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" });

  const ids = useMemo(() => linhasIdentidades(identidadesDa(balanco, sm), idioma), [balanco, sm, idioma]);
  const mensal = useMemo(() => linhasBalancoMensal(balanco, sm, idioma), [balanco, sm, idioma]);
  const residuos = useMemo(() => linhasResiduoMensal(balanco, escolhidas), [balanco, escolhidas]);
  const marcos = marcosQuebras(balanco, idioma);
  const ext = useMemo(() => linhasExteriorMensal(exterior, pais), [exterior, pais]);
  const ext12 = useMemo(() => linhasExterior12m(exterior, idioma), [exterior, idioma]);
  const itaipu = useMemo(() => linhasItaipu(exterior), [exterior]);
  const semHoraNoPais = ext.every((l) => l.horas === null);
  // última hora publicada de cada país: onde ela fica antes da dos outros, o fim da linha do gráfico é ausência, e a página diz isso junto dele
  const ultimaHoraPais = exterior.por_pais[pais]?.ultima_hora ?? null;
  const ultimaHoraExterior = PAISES.map((x) => exterior.por_pais[x]?.ultima_hora ?? "").sort().at(-1) ?? "";
  const nomeRegiao = sm === "SIN" ? "SIN" : nomeSm(sm, idioma);
  const doRegiao = tx(sm === "SIN" ? "do SIN" : `do ${NOME_SM[sm]}`, sm === "SIN" ? "of the SIN" : `of the ${nomeSm(sm, "en")}`);
  const fonteExterior = tx("ONS, Intercâmbio do SIN com Outros Países", "ONS, SIN Interchange with Other Countries");
  const horas = tx("horas", "hours");

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p029" vivo veredito={vereditoBalanco(balanco, sm, periodo, idioma)}>
          {respostaBalanco(balanco, sm, periodo, idioma)}
        </RespostaCurta>
        <RedeEscolha legenda={tx("Região", "Region")} opcoes={opcoesRegiao(idioma)} valor={sm} onEscolher={(x) => definir({ sm: x })} />
      </div>

      <GraficoBarras
        titulo={tx(`Horas em que cada conta fecha e horas com resíduo, ${nomeRegiao}`, `Hours in which each account closes and hours with a residual, ${nomeRegiao}`)}
        dados={paraTabela(ids)}
        chaveCategoria="id"
        chaveRotulo="identidade_curta"
        series={[
          { id: "horas_fecham", rotulo: tx("Fecha (até a tolerância)", "Closes (within the tolerance)"), cor: "var(--cor-energia)" }, // i18n: dado
          { id: "horas_residuo", rotulo: tx("Com resíduo", "With a residual"), cor: "var(--cor-erro)" },
        ]}
        unidade={horas}
        casas={0}
        orientacao="horizontal"
        empilhado
      />
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {tx(
          <>
            Há duas contas por região: o balanço interno (geração menos carga menos intercâmbio) e o perímetro (intercâmbio menos as fronteiras e o exterior). Cada barra é uma
            conta; só o SIN tem ainda a soma dos subsistemas. Resíduo é a diferença maior que {num(balanco.tolerancia_mwmed, 1)} MWmed numa hora, sem causa atribuída.
          </>,
          <>
            There are two accounts per region: the internal balance (generation minus load minus interchange) and the perimeter (interchange minus the boundaries and the
            exterior). Each bar is an account; only the SIN also has the sum of the subsystems. A residual is a difference greater than {num(balanco.tolerancia_mwmed, 1)} MWavg in
            an hour, with no cause attributed.
          </>,
        )}
      </p>
      <TabelaInterativa
        titulo={tx(`Tabela equivalente: contas conferidas ${doRegiao}`, `Equivalent table: accounts checked ${doRegiao}`)}
        colunas={colunasIdentidades(balanco, idioma)}
        linhas={paraTabela(ids)}
        chaveLinha="id"
        colunaRotulo="identidade"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`rede-identidades-${sm}`}
        chaveUrl="id.t"
        nota={tx(
          "Hora sem alguma parcela fica fora da conta (horas com todas as parcelas). A soma dos subsistemas só existe para o SIN.",
          "An hour missing any component is left out of the account (hours with every component). The sum of the subsystems only exists for the SIN.",
        )}
      />

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
          <dd className="mt-0.5">
            {tx(
              <>
                {dataBR(periodo.inicio)} a {dataBR(periodo.fim)}, hora a hora; somas mensais de {mesAno(balanco.mensal.meses[0] ?? periodo.inicio.slice(0, 7))} a{" "}
                {mesAno(balanco.mensal.meses.at(-1) ?? periodo.fim.slice(0, 7))}
              </>,
              <>
                {dataBR(periodo.inicio)} to {dataBR(periodo.fim)}, hour by hour; monthly sums from {mesAno(balanco.mensal.meses[0] ?? periodo.inicio.slice(0, 7))} to{" "}
                {mesAno(balanco.mensal.meses.at(-1) ?? periodo.fim.slice(0, 7))}
              </>,
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">{tx("Universo", "Scope")}</dt>
          <dd className="mt-0.5">
            {sm === "SIN"
              ? tx(
                  "SIN: balanço publicado pelo ONS, intercâmbio internacional e soma dos quatro subsistemas",
                  "SIN: balance published by ONS, international interchange and sum of the four subsystems",
                )
              : tx(`Subsistema ${NOME_SM[sm]}: balanço do ONS e fronteiras`, `${nomeSm(sm, "en")} subsystem: ONS balance and boundaries`)}
            {sm === "S" ? tx(", com Argentina e Uruguai", ", with Argentina and Uruguay") : ""}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
          <dd className="mt-0.5">
            {tx(
              <>Horas (contagem por conta conferida, tolerância de {balanco.tolerancia_mwmed.toLocaleString("pt-BR")} MWmed por hora); MWh nas somas mensais</>,
              <>Hours (count by account checked, tolerance of {num(balanco.tolerancia_mwmed, 1)} MWavg per hour); MWh in the monthly sums</>,
            )}
          </dd>
        </div>
      </dl>

      {notas}

      {aposPrincipal}

      <SecaoDoPainel
        id="residuo-mensal"
        titulo={tx("Em que meses o balanço deixa resíduo?", "In which months does the balance leave a residual?")}
        lead={tx(
          "A soma mensal do resíduo das duas contas, em MWh, com o zero do eixo como referência: num mês em que a conta fecha em todas as horas, a soma só se afasta do zero pela tolerância de cada hora.",
          "The monthly sum of the residual of the two accounts, in MWh, with the zero of the axis as reference: in a month in which the account closes in every hour, the sum only moves away from zero by the tolerance of each hour.",
        )}
      >
        <GraficoLinhas
          titulo={tx(`Resíduo mensal do balanço interno e do perímetro, ${nomeRegiao}`, `Monthly residual of the internal balance and of the perimeter, ${nomeRegiao}`)}
          dados={mensal}
          chaveX="m"
          formatoX="mes"
          series={[
            {
              id: "residuo_balanco_mwh",
              rotulo: tx("Balanço interno (geração − carga − intercâmbio)", "Internal balance (generation − load − interchange)"),
              sigla: tx("balanço", "balance"),
              cor: COR_SM[sm],
            },
            {
              id: "residuo_perimetro_mwh",
              rotulo: tx("Perímetro (intercâmbio − fronteiras e exterior)", "Perimeter (interchange − boundaries and exterior)"),
              sigla: tx("perímetro", "perimeter"),
              cor: "var(--serie-referencia)",
              tracejada: true,
            },
          ]}
          unidade="MWh"
          casas={0}
          zeroNoEixo
          marcos={marcos}
          zoom
          intervalo={intervalo}
          onIntervalo={aoIntervalo}
          legendaInterativa
        />
        <p className="text-sm text-carvao-muted">
          {tx(
            <>
              Cada soma mensal usa só as horas da sua conta: o balanço interno nas horas com geração, carga e intercâmbio; o perímetro nas horas com o intercâmbio e todas as
              fronteiras e o exterior.{" "}
            </>,
            <>
              Each monthly sum uses only the hours of its own account: the internal balance in the hours with generation, load and interchange; the perimeter in the hours with
              the interchange and every boundary and the exterior.{" "}
            </>,
          )}
          {marcos.length
            ? tx(
                `A marca de ${listaTexto(balanco.quebras.map((q) => dataBR(q.dia)), "pt")} no gráfico separa meses de geração e carga que não se comparam diretamente: desde essa data, a MMGD estimada pelo ONS entra na geração solar e na carga; o resíduo e o intercâmbio não mudam com ela.`,
                `The mark at ${listaTexto(balanco.quebras.map((q) => dataBR(q.dia)), "en")} on the chart separates months of generation and load that are not directly comparable: since that date, the MMGD estimated by ONS enters solar generation and load; the residual and the interchange do not change with it.`,
              )
            : ""}
        </p>
        <TabelaInterativa
          titulo={tx(`Tabela equivalente: balanço mensal ${doRegiao}`, `Equivalent table: monthly balance ${doRegiao}`)}
          colunas={colunasBalancoMensal(idioma)}
          linhas={paraTabela(mensal)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`rede-balanco-mensal-${sm}`}
          chaveUrl="bm"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
        />
      </SecaoDoPainel>

      <SecaoDoPainel
        id="residuo-horas"
        titulo={tx("Em que regiões e meses há horas com resíduo?", "In which regions and months are there hours with a residual?")}
        lead={tx(
          "A contagem de horas em que o balanço interno não fecha, por mês, para até quatro regiões na mesma escala.",
          "The count of hours in which the internal balance does not close, by month, for up to four regions on the same scale.",
        )}
      >
        <Comparador
          rotulo={tx(`Regiões no gráfico (até ${LIMITE_COMPARACAO})`, `Regions in the chart (up to ${LIMITE_COMPARACAO})`)}
          entidades={REGIOES_BALANCO.map((r) => ({ id: r, rotulo: nomeSm(r, idioma), sinonimos: [curtoSm(r, idioma)] }))}
          selecionadas={escolhidas}
          onMudar={(x) => definir({ sms: x as SubsistemaOuSin[] })}
          dicaBusca={tx("Buscar, por exemplo SIN, Sul, Nordeste", "Search, for example SIN, South, Northeast")}
          vazio={tx(
            "Nenhuma região escolhida. Escolha até quatro para ver as horas com resíduo na mesma escala.",
            "No region chosen. Choose up to four to see the hours with a residual on the same scale.",
          )}
        >
          {() => null}
        </Comparador>
        {escolhidas.length > 0 && (
          <>
            <GraficoLinhas
              titulo={tx("Horas com resíduo no balanço interno, por mês", "Hours with a residual in the internal balance, by month")}
              dados={residuos}
              chaveX="m"
              formatoX="mes"
              series={escolhidas.map((r) => ({ id: r, rotulo: nomeSm(r, idioma), sigla: curtoSm(r, idioma), cor: COR_SM[r] }))}
              unidade={horas}
              casas={0}
              zeroNoEixo
              marcos={marcos}
              zoom
              intervalo={intervalo}
              onIntervalo={aoIntervalo}
            />
            <TabelaInterativa
              titulo={tx("Tabela equivalente: horas com resíduo por mês", "Equivalent table: hours with a residual by month")}
              colunas={[
                { id: "m", rotulo: tx("Mês", "Month"), tipo: "data" },
                ...escolhidas.map((r) => ({ id: r, rotulo: nomeSm(r, idioma), tipo: "numero" as const, unidade: horas, casas: 0 })),
              ]}
              linhas={paraTabela(residuos)}
              chaveLinha="id"
              colunaRotulo="m"
              fonte={fonte}
              versao={versao}
              nomeArquivo={`rede-residuos-${escolhidas.join("-")}`}
              chaveUrl="res"
              ordemInicial={{ coluna: "m", direcao: "desc" }}
            />
          </>
        )}
      </SecaoDoPainel>

      <SecaoDoPainel id="exterior" titulo={tx("Quanta energia o Brasil trocou com Argentina, Uruguai e Paraguai?", "How much energy did Brazil exchange with Argentina, Uruguay and Paraguay?")}>
        <RespostaCurta id="p029-exterior" tamanho="sm" depois veredito={vereditoExterior(exterior, idioma)}>
          {respostaExterior(exterior, idioma)}
        </RespostaCurta>
        <TabelaInterativa
          titulo={tx("Exterior nos 12 meses completos mais recentes, por país", "Exterior in the most recent 12 complete months, by country")}
          colunas={colunasExterior12m(idioma)}
          linhas={paraTabela(ext12)}
          chaveLinha="id"
          colunaRotulo="pais"
          fonte={fonteExterior}
          versao={versao}
          nomeArquivo="rede-exterior-12-meses"
          chaveUrl="e12"
          selecionado={pais}
          onSelecionar={(id) => id && definir({ pais: id as PaisRede })}
          nota={tx(
            "Sem hora publicada no período, exportação, importação e horas com fluxo ficam vazias (ausência), nunca zero. Zero publicado continua zero.",
            "With no hour published in the period, exports, imports and hours with flow stay empty (missing), never zero. A published zero stays zero.",
          )}
        />
        <RedeEscolha legenda={tx("País", "Country")} opcoes={opcoesPais(idioma)} valor={pais} onEscolher={(x) => definir({ pais: x })} />
        {semHoraNoPais ? (
          <p className="border-l-2 border-mineral pl-3 text-sm text-carvao-muted">
            {tx(
              <>
                {NOME_PAIS[pais]}: nenhuma hora publicada
                {exterior.meses.length ? ` de ${mesAno(exterior.meses[0])} a ${mesAno(exterior.meses.at(-1)!)}` : " nesta publicação"} (ausência, não zero).
              </>,
              <>
                {nomePais(pais, "en")}: no hour published
                {exterior.meses.length ? ` from ${mesAno(exterior.meses[0])} to ${mesAno(exterior.meses.at(-1)!)}` : " in this release"} (missing, not zero).
              </>,
            )}
          </p>
        ) : (
          <GraficoLinhas
            titulo={tx(
              `Exportação e importação mensais com ${pais === "ARGENTINA" ? "a" : "o"} ${NOME_PAIS[pais]}`,
              `Monthly exports and imports with ${nomePais(pais, "en")}`,
            )}
            dados={ext}
            chaveX="m"
            formatoX="mes"
            series={[
              { id: "exportacao_mwh", rotulo: tx("Exportação do Brasil", "Exports from Brazil"), cor: "var(--cor-energia)" }, // i18n: dado
              { id: "importacao_mwh", rotulo: tx("Importação do Brasil", "Imports into Brazil"), cor: "var(--serie-referencia)", tracejada: true },
            ]}
            unidade="MWh"
            casas={0}
            zeroNoEixo
            zoom
            intervalo={intervalo}
            onIntervalo={aoIntervalo}
          />
        )}
        {!semHoraNoPais && ultimaHoraPais && ultimaHoraPais < ultimaHoraExterior && (
          <p className="border-l-2 border-mineral pl-3 text-sm text-carvao-muted">
            {tx(
              <>
                {NOME_PAIS[pais]}: a última hora publicada é {horaLocal(ultimaHoraPais)}; depois dela há ausência de dado, não zero.
              </>,
              <>
                {nomePais(pais, "en")}: the last hour published is {horaLocal(ultimaHoraPais)}; after it the data is missing, not zero.
              </>,
            )}
          </p>
        )}
        <TabelaInterativa
          titulo={tx(`Tabela equivalente: ${NOME_PAIS[pais]} por mês`, `Equivalent table: ${nomePais(pais, "en")} by month`)}
          colunas={colunasExteriorMensal(idioma)}
          linhas={paraTabela(ext)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonteExterior}
          versao={versao}
          nomeArquivo={`rede-exterior-${pais.toLowerCase()}`}
          chaveUrl="ex"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
          nota={tx(
            "Mês sem nenhuma hora publicada fica vazio. O saldo programado só existe nos meses em que o ONS publica o programado; antes, a coluna fica vazia.",
            "A month with no hour published stays empty. The scheduled net flow only exists in the months in which ONS publishes the schedule; before that, the column stays empty.",
          )}
        />
      </SecaoDoPainel>

      <SecaoDoPainel id="itaipu" nivel="analisar" titulo={tx("Itaipu: geração, não intercâmbio", "Itaipu: generation, not interchange")}>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          {tx(
            <>
              No conjunto do ONS, Itaipu é publicada como geração de uma usina, não como intercâmbio com o Paraguai. A parcela não destinada ao Brasil é a diferença entre duas medidas
              publicadas (total e destinada ao Brasil), não consumo do Paraguai medido.
            </>,
            <>
              In the ONS dataset, Itaipu is published as the generation of a plant, not as interchange with Paraguay. The share not allocated to Brazil is the difference between two
              published measurements (total and allocated to Brazil), not measured consumption by Paraguay.
            </>,
          )}
        </p>
        <GraficoLinhas
          titulo={tx("Geração de Itaipu por mês", "Itaipu generation by month")}
          dados={itaipu}
          chaveX="m"
          formatoX="mes"
          series={[
            { id: "total_mwh", rotulo: tx("Total", "Total"), cor: "var(--cor-carvao)" },
            { id: "brasil_mwh", rotulo: tx("Destinada ao Brasil", "Allocated to Brazil"), cor: "var(--serie-hidraulica)" },
            { id: "nao_brasil_mwh", rotulo: tx("Não destinada ao Brasil (diferença)", "Not allocated to Brazil (difference)"), cor: "var(--serie-referencia)", tracejada: true },
          ]}
          unidade="MWh"
          casas={0}
          zeroNoEixo
          zoom
          intervalo={intervalo}
          onIntervalo={aoIntervalo}
        />
        <TabelaInterativa
          titulo={tx("Tabela equivalente: Itaipu por mês", "Equivalent table: Itaipu by month")}
          colunas={colunasItaipu(idioma)}
          linhas={paraTabela(itaipu)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={tx("ONS, Geração de Itaipu Binacional", "ONS, Itaipu Binacional Generation")}
          versao={versao}
          nomeArquivo="rede-itaipu-mensal"
          chaveUrl="ita"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
        />
      </SecaoDoPainel>
    </div>
  );
}
