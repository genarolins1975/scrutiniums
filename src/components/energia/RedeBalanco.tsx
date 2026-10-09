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
import { dataBR, horaLocal, mesAno, num } from "@/lib/energia/formato";
import {
  COLUNAS_BALANCO_MENSAL,
  COLUNAS_EXTERIOR_12M,
  COLUNAS_EXTERIOR_MENSAL,
  COLUNAS_ITAIPU,
  COR_SM,
  CURTO_SM,
  NOME_PAIS,
  NOME_SM,
  PAISES,
  REGIOES_BALANCO,
  colunasIdentidades,
  identidadesDa,
  linhasBalancoMensal,
  linhasExterior12m,
  linhasExteriorMensal,
  linhasIdentidades,
  linhasItaipu,
  linhasResiduoMensal,
  listaTexto,
  marcosQuebras,
  paraTabela,
  respostaBalanco,
  vereditoBalanco,
  vereditoExterior,
  respostaExterior,
} from "@/lib/energia/rede";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { BalancoRede, ExteriorRede, PaisRede, SubsistemaOuSin } from "@/lib/energia/tipos-rede";

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

const OPCOES_REGIAO = REGIOES_BALANCO.map((sm) => ({ id: sm, rotulo: sm === "SE" ? "SE/CO" : NOME_SM[sm], detalhe: NOME_SM[sm] }));
const OPCOES_PAIS = PAISES.map((p) => ({ id: p, rotulo: NOME_PAIS[p] }));

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
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const sm = v.sm as SubsistemaOuSin;
  const pais = v.pais as PaisRede;
  const escolhidas = v.sms as SubsistemaOuSin[];
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const aoIntervalo = (i: { inicio: string; fim: string } | null) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" });

  const ids = useMemo(() => linhasIdentidades(identidadesDa(balanco, sm)), [balanco, sm]);
  const mensal = useMemo(() => linhasBalancoMensal(balanco, sm), [balanco, sm]);
  const residuos = useMemo(() => linhasResiduoMensal(balanco, escolhidas), [balanco, escolhidas]);
  const marcos = marcosQuebras(balanco);
  const ext = useMemo(() => linhasExteriorMensal(exterior, pais), [exterior, pais]);
  const ext12 = useMemo(() => linhasExterior12m(exterior), [exterior]);
  const itaipu = useMemo(() => linhasItaipu(exterior), [exterior]);
  const semHoraNoPais = ext.every((l) => l.horas === null);
  // última hora publicada de cada país: onde ela fica antes da dos outros, o fim da linha do gráfico é ausência, e a página diz isso junto dele
  const ultimaHoraPais = exterior.por_pais[pais]?.ultima_hora ?? null;
  const ultimaHoraExterior = PAISES.map((x) => exterior.por_pais[x]?.ultima_hora ?? "").sort().at(-1) ?? "";

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p029" vivo veredito={vereditoBalanco(balanco, sm, periodo)}>
          {respostaBalanco(balanco, sm, periodo)}
        </RespostaCurta>
        <RedeEscolha legenda="Região" opcoes={OPCOES_REGIAO} valor={sm} onEscolher={(x) => definir({ sm: x })} />
      </div>

      <GraficoBarras
        titulo={`Horas em que cada conta fecha e horas com resíduo, ${sm === "SIN" ? "SIN" : NOME_SM[sm]}`}
        dados={paraTabela(ids)}
        chaveCategoria="id"
        chaveRotulo="identidade_curta"
        series={[
          { id: "horas_fecham", rotulo: "Fecha (até a tolerância)", cor: "var(--cor-energia)" },
          { id: "horas_residuo", rotulo: "Com resíduo", cor: "var(--cor-erro)" },
        ]}
        unidade="horas"
        casas={0}
        orientacao="horizontal"
        empilhado
      />
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        Há duas contas por região: o balanço interno (geração menos carga menos intercâmbio) e o perímetro (intercâmbio menos as fronteiras e o exterior). Cada barra é uma
        conta; só o SIN tem ainda a soma dos subsistemas. Resíduo é a diferença maior que {num(balanco.tolerancia_mwmed, 1)} MWmed numa hora, sem causa atribuída.
      </p>
      <TabelaInterativa
        titulo={`Tabela equivalente: contas conferidas ${sm === "SIN" ? "do SIN" : `do ${NOME_SM[sm]}`}`}
        colunas={colunasIdentidades(balanco)}
        linhas={paraTabela(ids)}
        chaveLinha="id"
        colunaRotulo="identidade"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`rede-identidades-${sm}`}
        chaveUrl="id.t"
        nota="Hora sem alguma parcela fica fora da conta (horas com todas as parcelas). A soma dos subsistemas só existe para o SIN."
      />

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-0.5">
            {dataBR(periodo.inicio)} a {dataBR(periodo.fim)}, hora a hora; somas mensais de {mesAno(balanco.mensal.meses[0] ?? periodo.inicio.slice(0, 7))} a{" "}
            {mesAno(balanco.mensal.meses.at(-1) ?? periodo.fim.slice(0, 7))}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5">
            {sm === "SIN" ? "SIN: balanço publicado pelo ONS, intercâmbio internacional e soma dos quatro subsistemas" : `Subsistema ${NOME_SM[sm]}: balanço do ONS e fronteiras`}
            {sm === "S" ? ", com Argentina e Uruguai" : ""}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">Unidade</dt>
          <dd className="mt-0.5">Horas (contagem por conta conferida, tolerância de {balanco.tolerancia_mwmed.toLocaleString("pt-BR")} MWmed por hora); MWh nas somas mensais</dd>
        </div>
      </dl>

      {notas}

      {aposPrincipal}

      <SecaoDoPainel
        id="residuo-mensal"
        titulo="Em que meses o balanço deixa resíduo?"
        lead="A soma mensal do resíduo das duas contas, em MWh, com o zero do eixo como referência: num mês em que a conta fecha em todas as horas, a soma só se afasta do zero pela tolerância de cada hora."
      >
        <GraficoLinhas
          titulo={`Resíduo mensal do balanço interno e do perímetro, ${sm === "SIN" ? "SIN" : NOME_SM[sm]}`}
          dados={mensal}
          chaveX="m"
          formatoX="mes"
          series={[
            { id: "residuo_balanco_mwh", rotulo: "Balanço interno (geração − carga − intercâmbio)", sigla: "balanço", cor: COR_SM[sm] },
            { id: "residuo_perimetro_mwh", rotulo: "Perímetro (intercâmbio − fronteiras e exterior)", sigla: "perímetro", cor: "var(--serie-referencia)", tracejada: true },
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
          Cada soma mensal usa só as horas da sua conta: o balanço interno nas horas com geração, carga e intercâmbio; o perímetro nas horas com o intercâmbio e todas as
          fronteiras e o exterior.{" "}
          {marcos.length
            ? `A marca de ${listaTexto(balanco.quebras.map((q) => dataBR(q.dia)))} no gráfico separa meses de geração e carga que não se comparam diretamente: desde essa data, a MMGD estimada pelo ONS entra na geração solar e na carga; o resíduo e o intercâmbio não mudam com ela.`
            : ""}
        </p>
        <TabelaInterativa
          titulo={`Tabela equivalente: balanço mensal ${sm === "SIN" ? "do SIN" : `do ${NOME_SM[sm]}`}`}
          colunas={COLUNAS_BALANCO_MENSAL}
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
        titulo="Em que regiões e meses há horas com resíduo?"
        lead="A contagem de horas em que o balanço interno não fecha, por mês, para até quatro regiões na mesma escala."
      >
        <Comparador
          rotulo={`Regiões no gráfico (até ${LIMITE_COMPARACAO})`}
          entidades={REGIOES_BALANCO.map((r) => ({ id: r, rotulo: NOME_SM[r], sinonimos: [CURTO_SM[r]] }))}
          selecionadas={escolhidas}
          onMudar={(x) => definir({ sms: x as SubsistemaOuSin[] })}
          dicaBusca="Buscar, por exemplo SIN, Sul, Nordeste"
          vazio="Nenhuma região escolhida. Escolha até quatro para ver as horas com resíduo na mesma escala."
        >
          {() => null}
        </Comparador>
        {escolhidas.length > 0 && (
          <>
            <GraficoLinhas
              titulo="Horas com resíduo no balanço interno, por mês"
              dados={residuos}
              chaveX="m"
              formatoX="mes"
              series={escolhidas.map((r) => ({ id: r, rotulo: NOME_SM[r], sigla: CURTO_SM[r], cor: COR_SM[r] }))}
              unidade="horas"
              casas={0}
              zeroNoEixo
              marcos={marcos}
              zoom
              intervalo={intervalo}
              onIntervalo={aoIntervalo}
            />
            <TabelaInterativa
              titulo="Tabela equivalente: horas com resíduo por mês"
              colunas={[
                { id: "m", rotulo: "Mês", tipo: "data" },
                ...escolhidas.map((r) => ({ id: r, rotulo: NOME_SM[r], tipo: "numero" as const, unidade: "horas", casas: 0 })),
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

      <SecaoDoPainel id="exterior" titulo="Quanta energia o Brasil trocou com Argentina, Uruguai e Paraguai?">
        <RespostaCurta id="p029-exterior" tamanho="sm" depois veredito={vereditoExterior(exterior)}>
          {respostaExterior(exterior)}
        </RespostaCurta>
        <TabelaInterativa
          titulo="Exterior nos 12 meses completos mais recentes, por país"
          colunas={COLUNAS_EXTERIOR_12M}
          linhas={paraTabela(ext12)}
          chaveLinha="id"
          colunaRotulo="pais"
          fonte="ONS, Intercâmbio do SIN com Outros Países"
          versao={versao}
          nomeArquivo="rede-exterior-12-meses"
          chaveUrl="e12"
          selecionado={pais}
          onSelecionar={(id) => id && definir({ pais: id as PaisRede })}
          nota="Sem hora publicada no período, exportação, importação e horas com fluxo ficam vazias (ausência), nunca zero. Zero publicado continua zero."
        />
        <RedeEscolha legenda="País" opcoes={OPCOES_PAIS} valor={pais} onEscolher={(x) => definir({ pais: x })} />
        {semHoraNoPais ? (
          <p className="border-l-2 border-mineral pl-3 text-sm text-carvao-muted">
            {NOME_PAIS[pais]}: nenhuma hora publicada
            {exterior.meses.length ? ` de ${mesAno(exterior.meses[0])} a ${mesAno(exterior.meses.at(-1)!)}` : " nesta publicação"} (ausência, não zero).
          </p>
        ) : (
          <GraficoLinhas
            titulo={`Exportação e importação mensais com ${pais === "ARGENTINA" ? "a" : "o"} ${NOME_PAIS[pais]}`}
            dados={ext}
            chaveX="m"
            formatoX="mes"
            series={[
              { id: "exportacao_mwh", rotulo: "Exportação do Brasil", cor: "var(--cor-energia)" },
              { id: "importacao_mwh", rotulo: "Importação do Brasil", cor: "var(--serie-referencia)", tracejada: true },
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
            {NOME_PAIS[pais]}: a última hora publicada é {horaLocal(ultimaHoraPais)}; depois dela há ausência de dado, não zero.
          </p>
        )}
        <TabelaInterativa
          titulo={`Tabela equivalente: ${NOME_PAIS[pais]} por mês`}
          colunas={COLUNAS_EXTERIOR_MENSAL}
          linhas={paraTabela(ext)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte="ONS, Intercâmbio do SIN com Outros Países"
          versao={versao}
          nomeArquivo={`rede-exterior-${pais.toLowerCase()}`}
          chaveUrl="ex"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
          nota="Mês sem nenhuma hora publicada fica vazio. O saldo programado só existe nos meses em que o ONS publica o programado; antes, a coluna fica vazia."
        />
      </SecaoDoPainel>

      <SecaoDoPainel id="itaipu" nivel="analisar" titulo="Itaipu: geração, não intercâmbio">
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          No conjunto do ONS, Itaipu é publicada como geração de uma usina, não como intercâmbio com o Paraguai. A parcela não destinada ao Brasil é a diferença entre duas medidas
          publicadas (total e destinada ao Brasil), não consumo do Paraguai medido.
        </p>
        <GraficoLinhas
          titulo="Geração de Itaipu por mês"
          dados={itaipu}
          chaveX="m"
          formatoX="mes"
          series={[
            { id: "total_mwh", rotulo: "Total", cor: "var(--cor-carvao)" },
            { id: "brasil_mwh", rotulo: "Destinada ao Brasil", cor: "var(--serie-hidraulica)" },
            { id: "nao_brasil_mwh", rotulo: "Não destinada ao Brasil (diferença)", cor: "var(--serie-referencia)", tracejada: true },
          ]}
          unidade="MWh"
          casas={0}
          zeroNoEixo
          zoom
          intervalo={intervalo}
          onIntervalo={aoIntervalo}
        />
        <TabelaInterativa
          titulo="Tabela equivalente: Itaipu por mês"
          colunas={COLUNAS_ITAIPU}
          linhas={paraTabela(itaipu)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte="ONS, Geração de Itaipu Binacional"
          versao={versao}
          nomeArquivo="rede-itaipu-mensal"
          chaveUrl="ita"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
        />
      </SecaoDoPainel>
    </div>
  );
}
