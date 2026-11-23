import type { Metadata } from "next";
import Link from "next/link";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { Controles, FiguraAnalitica, GraficoBarras, GraficoLinhas, LeituraGuiada, PaginaPainel } from "@/components/painel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { CabecalhoVarejo, FechoDoMetodo, FONTE_PAC, FONTE_PMC, LINK, LinhaFonte, numeroDeVariacao } from "@/components/varejo/comum";
import { ExportarRecorte } from "@/components/varejo/ExportarRecorte";
import { SelectUrl } from "@/components/varejo/SelectUrl";
import { SeletorUrl } from "@/components/varejo/SeletorUrl";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { hrefComRecorte, parametro, parametroEntre, type ParametrosPagina } from "@/lib/painel/recorte";
import {
  atividadesDoUniverso,
  DEF_MEDIDA,
  difusao,
  goldSetor,
  gruposDoVarejo,
  INDICADORES,
  indiceDoMes,
  leituraBrasil,
  MEDIDAS,
  mesAnterior,
  mesesSelecionaveis,
  NOME_INDICADOR,
  NOME_PERIODO,
  NOME_UNIVERSO,
  ordenarPor,
  pacVarejo,
  PERIODOS,
  porteDoVarejo,
  serieBrasil,
  serieMacro,
  tituloDoAchado,
  ultimoComValor,
  UNIVERSOS,
  type Medida,
  type Periodo,
} from "@/lib/varejo/dados";
import { direcao, mesCurto, mesExtenso, num, pct, plural, pontos, trilhoes, variacao } from "@/lib/varejo/formato";
import { hrefDownload, NOME_CURTO_ATIVIDADE, paginaVarejo, ROTA_BRASIL, ROTA_SEGMENTOS } from "@/lib/varejo/paginas";
import { provVarejo } from "@/lib/varejo/proveniencia";
import type { Indicador, Universo } from "@/lib/varejo/tipos";

/**
 * "O que mudou nas vendas?" (coleção Varejo, com conta). O título é o achado do último mês publicado, calculado da gold pelo
 * mesmo seletor do gráfico principal (tituloDoAchado). O recorte vive na URL: universo (restrito ou ampliado), medida de
 * variação, período, mês da contagem e indicador da contagem; o servidor lê os parâmetros e a página inteira sai no recorte,
 * com os textos acompanhando a seleção. Sem parâmetro vale o padrão; parâmetro inválido também.
 */
export const dynamic = "force-dynamic";

const pagina = paginaVarejo("brasil");
// período padrão de cinco anos: desde 2019, o tombo e a volta de 2020 achatam a variação mensal dos demais meses; a série inteira fica a um toque
const PADRAO = { universo: "restrito", medida: "mm", periodo: "5a", indicador: "volume" } as const;

type Busca = { searchParams: ParametrosPagina };

export function generateMetadata(): Metadata {
  const g = goldSetor();
  return {
    title: tituloNaColecao(pagina.pergunta, ROTA_BRASIL),
    description: `${tituloDoAchado(g)}. Volume e receita nominal do varejo restrito e do ampliado mês a mês, a diferença entre os dois, quantas atividades subiram, o tamanho do mercado em ${g.pac.ano} e três variáveis de contexto.`,
    alternates: { canonical: ROTA_BRASIL },
  };
}

export default function PaginaBrasil({ searchParams }: Busca) {
  const g = goldSetor();
  const universo = parametroEntre<Universo>(searchParams, "universo", UNIVERSOS, PADRAO.universo);
  const medida = parametroEntre<Medida>(searchParams, "medida", MEDIDAS, PADRAO.medida);
  const periodo = parametroEntre<Periodo>(searchParams, "periodo", PERIODOS, PADRAO.periodo);
  const indicador = parametroEntre<Indicador>(searchParams, "indicador", INDICADORES, PADRAO.indicador);
  const ultimoMes = g.referencia.pmc;
  const iMes = indiceDoMes(g, parametro(searchParams, "mes"));
  const mes = g.pmc.meses[iMes];
  const recorte = { universo, medida, periodo, indicador, mes: mes === ultimoMes ? null : mes };
  const padraoMes = { ...PADRAO };
  const h = (mudanca: Partial<Record<keyof typeof recorte, string | null>>) => hrefComRecorte(ROTA_BRASIL, { ...recorte, ...mudanca }, padraoMes);
  const foraDoPadrao = h({}) !== ROTA_BRASIL;

  const def = DEF_MEDIDA[medida];
  const nomeU = NOME_UNIVERSO[universo];
  const nomeUmin = nomeU.toLowerCase();
  const restrito = leituraBrasil(g, "restrito");
  const l = leituraBrasil(g, universo);
  const anterior = mesAnterior(g);
  const serie = serieBrasil(g, universo, medida, periodo);
  const ult = serie[serie.length - 1];
  const inicio = serie[0].mes;
  const fonteU = universo === "restrito" ? "pmc_restrito" : "pmc_ampliado";
  const nAtiv = atividadesDoUniverso(g, universo).length;

  // ---------------------------------------------------------------- difusão
  const d = difusao(g, universo, medida, indicador, iMes);
  const barras = ordenarPor(d.linhas.map((x) => ({ ...x, nome: x.nomeCurto })), (x) => x[indicador]);

  // ---------------------------------------------------------------- mercado (PAC)
  const v = pacVarejo(g);
  const grupos = [...gruposDoVarejo(g)].sort((a, b) => (b.receita_operacional_liquida ?? -1) - (a.receita_operacional_liquida ?? -1));
  const porte = porteDoVarejo(g);
  const ano = String(g.pac.ano);
  const maior = grupos[0];

  // ---------------------------------------------------------------- contexto
  const massa = serieMacro(g, g.macro.massa_renda_real.valores, periodo);
  const alimentos = serieMacro(g, g.macro.ipca_alimentacao_domicilio_12m.valores, periodo);
  const juros = serieMacro(g, g.macro.juros_credito_livre_pf.valores, periodo);
  const uMassa = ultimoComValor(massa);
  const uAlim = ultimoComValor(alimentos);
  const uJuros = ultimoComValor(juros);
  const primeiroAlim = Object.entries(g.macro.ipca_alimentacao_domicilio_12m.valores).find(([, x]) => typeof x === "number")?.[0] ?? null;
  const massaAa = uMassa ? g.macro.massa_renda_real.variacao_interanual_pct?.[uMassa.mes] ?? null : null;
  const CONTEXTO = [
    {
      id: "massa", titulo: "Massa de renda real do trabalho", unidade: "R$ bilhões", casas: 0, pontos: massa.map((p) => ({ mes: p.mes, valor: p.valor === null ? null : p.valor / 1000 })),
      mecanismo: "A soma dos rendimentos de quem trabalha, descontada a inflação, é o dinheiro disponível para o consumo. Quando ela cresce, há mais renda para gastar no comércio.",
      ultimo: uMassa ? `R$ ${num(uMassa.valor! / 1000, 0)} bilhões no trimestre encerrado em ${mesExtenso(uMassa.mes)}${massaAa !== null ? `, ${variacao(massaAa)} ante o mesmo trimestre do ano anterior` : ""}` : "sem dado no período",
    },
    {
      id: "alimentos", titulo: "Inflação de alimentos no domicílio", unidade: "% em 12 meses", casas: 1, pontos: alimentos,
      mecanismo: "Comida comprada para casa pesa no orçamento. Quando ela encarece, a receita dos supermercados sobe mesmo sem vender mais, e sobra menos para outras compras.",
      ultimo: uAlim ? `${pct(uAlim.valor, 2)} em 12 meses até ${mesExtenso(uAlim.mes)}` : "sem dado no período",
    },
    {
      id: "juros", titulo: "Juros do crédito livre às famílias", unidade: "% ao ano", casas: 1, pontos: juros,
      mecanismo: "Móveis, eletrodomésticos e veículos costumam ser comprados a prazo. Juros mais altos encarecem a parcela e tendem a adiar essas compras.",
      ultimo: uJuros ? `${pct(uJuros.valor, 1)} ao ano em ${mesExtenso(uJuros.mes)}` : "sem dado no período",
    },
  ] as const;

  const periodoTexto = `${mesCurto(inicio)} a ${mesCurto(ult.mes)}`;
  const resumoRecorte = `${nomeU}, variação ${def.base}, ${NOME_PERIODO[periodo].toLowerCase()} (${periodoTexto}).`;

  return (
    <>
      <MarcaVisita secao={pagina.secao} />
      <CabecalhoVarejo rota={ROTA_BRASIL} />
      <PaginaPainel
        rota={ROTA_BRASIL}
        abertura={{
          grupo: pagina.pergunta,
          acento: "gas",
          titulo: tituloDoAchado(g),
          lead: (
            <>
              Em {mesExtenso(ultimoMes)}, o volume vendido pelo varejo restrito variou {variacao(restrito.volume.mm)} ante {anterior ? mesExtenso(anterior).split(" de ")[0] : "o mês anterior"}, com ajuste sazonal, e a receita
              em reais, {variacao(restrito.receita.mm)}. Em 12 meses: {variacao(restrito.volume.m12)} e {variacao(restrito.receita.m12)}.
            </>
          ),
          recorte: { periodo: `até ${mesExtenso(ultimoMes)}`, universo: "Brasil, varejo restrito e ampliado", unidade: "variação em %", fonte: `${FONTE_PMC} e Pesquisa Anual de Comércio` },
          limite: "a causa da variação. Uma pesquisa mensal mostra quanto as vendas mudaram, não por quê; e receita em alta não significa mais mercadoria vendida.",
        }}
        rotuloNumeros={`${nomeU} em ${mesExtenso(ultimoMes)} e o tamanho do mercado em ${ano}`}
        numeros={[
          numeroDeVariacao({ rotulo: "Volume de vendas no mês", unidade: "ante o mês anterior, com ajuste sazonal", periodo: mesExtenso(l.mes), recorte: nomeU, fonte: FONTE_PMC, tamanho: "g" }, l.volume.mm),
          numeroDeVariacao({ rotulo: "Receita nominal no mês", unidade: "ante o mês anterior, com ajuste sazonal", periodo: mesExtenso(l.mes), recorte: nomeU, fonte: FONTE_PMC, tamanho: "g" }, l.receita.mm),
          numeroDeVariacao({ rotulo: "Volume de vendas em 12 meses", unidade: "ante os 12 meses anteriores", periodo: `até ${mesExtenso(l.mes)}`, recorte: nomeU, fonte: FONTE_PMC, tamanho: "g" }, l.volume.m12),
          v?.receita_operacional_liquida != null
            ? { rotulo: "Receita operacional líquida do comércio varejista", formato: "texto", valorTexto: `R$ ${trilhoes(v.receita_operacional_liquida)}`, unidade: "trilhões", periodo: ano, recorte: "Brasil", fonte: FONTE_PAC, natureza: "OBSERVADO", tamanho: "g" }
            : { rotulo: "Receita operacional líquida do comércio varejista", valor: null, motivoAusencia: "A pesquisa anual não pôde ser lida nesta publicação.", unidade: "trilhões", periodo: ano, fonte: FONTE_PAC, natureza: "OBSERVADO" },
        ]}
        notaNumeros="O tamanho do mercado é de 2024 porque a pesquisa anual sai mais de um ano depois; a conjuntura, da pesquisa mensal, é mais recente. Os dois não se somam."
        figuras={
          <>
            <Controles
              rotulo="Recorte das vendas"
              idioma="pt"
              resumo={<>Mostrando: {resumoRecorte} O universo e a medida valem também para a diferença e para a contagem das atividades.</>}
              limpar={foraDoPadrao ? { href: ROTA_BRASIL } : undefined}
            >
              <SeletorUrl id="sel-universo" rotulo="Universo" atual={universo} opcoes={UNIVERSOS.map((u) => ({ valor: u, rotulo: NOME_UNIVERSO[u], href: h({ universo: u }) }))} />
              <SeletorUrl id="sel-medida" rotulo="Variação" atual={medida} opcoes={MEDIDAS.map((m) => ({ valor: m, rotulo: DEF_MEDIDA[m].rotulo, href: h({ medida: m }) }))} />
              <SeletorUrl id="sel-periodo" rotulo="Período" atual={periodo} opcoes={PERIODOS.map((p) => ({ valor: p, rotulo: NOME_PERIODO[p], href: h({ periodo: p }) }))} />
            </Controles>

            <FiguraAnalitica
              id="vendas"
              pergunta="Vendeu-se mais mercadoria ou só entrou mais dinheiro?"
              subtitulo={`${nomeU} · volume e receita nominal · variação em %, ${def.base} · Brasil · ${periodoTexto}`}
              natureza="OBSERVADO"
              proveniencia={provVarejo(g, fonteU, {
                indicador: `Volume de vendas e receita nominal do ${nomeUmin}`, natureza: "OBSERVADO", unidade: `variação em %, ${def.base}`, frequencia: "mensal", inicio, fim: ult.mes,
                limitacoes: [g.notas.pmc_base, "Os meses mais recentes podem ser revisados pelo IBGE nas divulgações seguintes."], download: hrefDownload("serie-brasil.csv"),
              })}
              leitura={
                <LeituraGuiada>
                  Em {mesExtenso(ult.mes)}, o volume do {nomeUmin} variou {variacao(ult.volume)} e a receita nominal, {variacao(ult.receita)}, {def.base}.
                </LeituraGuiada>
              }
              comoInterpretar={
                <>
                  Volume é a venda descontada a variação dos preços; receita nominal é a venda em reais correntes. As duas linhas partem dos índices do IBGE com média de 2022 igual a 100.
                  {medida === "mm" && " A variação no mês usa a série com ajuste sazonal, que desconta efeitos de calendário como o Natal."}
                </>
              }
              naoConcluir="que a receita maior significa mais mercadoria vendida: quando os preços sobem, a receita cresce mesmo com o volume parado. O gráfico também não diz por que as vendas mudaram."
              complemento={
                <>
                  <ExportarRecorte
                    nome={`varejo-brasil-${universo}-${medida}-${periodo}`}
                    colunas={["mes", "volume_pct", "receita_nominal_pct", "receita_menos_volume_pp"]}
                    linhas={serie.map((p) => [p.mes, p.volume, p.receita, p.diferenca])}
                    recorte={resumoRecorte}
                    fonte={`${g.fontes[fonteU].orgao}, ${g.fontes[fonteU].tabela}`}
                  />
                  <Composicao universo={universo} g={g} />
                </>
              }
              tabela={{
                titulo: `${nomeU}: volume e receita nominal, variação ${def.curto}`,
                colunas: ["Mês", "Volume, %", "Receita nominal, %", "Receita menos volume, p.p."],
                linhas: serie.map((p) => [mesCurto(p.mes), p.volume, p.receita, p.diferenca]),
                casas: [null, 1, 1, 1],
                limite: 24,
                csv: hrefDownload("serie-brasil.csv"),
              }}
            >
              <GraficoLinhas
                semTabela
                titulo={`${nomeU}: volume de vendas e receita nominal`}
                dados={serie.map((p) => ({ mes: p.mes, volume: p.volume, receita: p.receita }))}
                chaveX="mes"
                formatoX="mes"
                series={[
                  { id: "volume", rotulo: "Volume de vendas", cor: "var(--cor-gas)", espessura: 2.2 },
                  { id: "receita", rotulo: "Receita nominal", cor: "var(--serie-referencia)" },
                ]}
                unidade="%"
                casas={1}
                zeroNoEixo
                altura={360}
                marcos={universo === "ampliado" && inicio <= "2023-01" ? [{ x: "2023-01", rotulo: "Atacado de alimentos entra no ampliado" }] : []}
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="diferenca"
              pergunta="A alta nominal veio com mais volume?"
              subtitulo={`${nomeU} · receita nominal menos volume · pontos percentuais, variação ${def.curto} · Brasil · ${periodoTexto}`}
              natureza="CALCULADO"
              proveniencia={provVarejo(g, fonteU, {
                indicador: `Diferença entre a variação da receita nominal e a do volume, ${nomeUmin}`, natureza: "CALCULADO", unidade: "pontos percentuais", frequencia: "mensal", inicio, fim: ult.mes,
                formula: "variação da receita nominal (%) − variação do volume de vendas (%), na mesma medida e no mesmo mês",
                transformacoes: ["Subtração das duas variações publicadas pelo IBGE, arredondada a uma casa"],
                limitacoes: ["É uma aproximação do efeito dos preços: a diferença exata exigiria dividir os índices, e muda também quando muda a composição do que se vende."],
              })}
              leitura={
                <LeituraGuiada>
                  Em {mesExtenso(ult.mes)}, a receita nominal variou {variacao(ult.receita)} e o volume, {variacao(ult.volume)}, {def.base}: diferença de {pontos(ult.diferenca)}.
                  {ult.diferenca !== null && ult.volume !== null && ult.receita !== null && (
                    <> {direcao(ult.volume) === "alta" ? "O volume também cresceu" : direcao(ult.volume) === "queda" ? "O volume caiu" : "O volume ficou parado"}; a diferença aproxima a parte da receita que veio de preços.</>
                  )}
                </LeituraGuiada>
              }
              comoInterpretar="Acima de zero, a receita cresceu mais que o volume: parte do aumento em reais veio de preços mais altos. Perto de zero, receita e volume andaram juntos."
              naoConcluir="que a diferença é a inflação do varejo: ela é uma aproximação em pontos percentuais, não um índice de preços, e também se move quando as pessoas trocam produtos caros por baratos."
              tabela={{
                titulo: `${nomeU}: receita nominal menos volume, em pontos percentuais`,
                colunas: ["Mês", "Receita nominal, %", "Volume, %", "Diferença, p.p."],
                linhas: serie.map((p) => [mesCurto(p.mes), p.receita, p.volume, p.diferenca]),
                casas: [null, 1, 1, 1],
                limite: 24,
              }}
            >
              <GraficoLinhas
                semTabela
                titulo={`${nomeU}: receita nominal menos volume`}
                dados={serie.map((p) => ({ mes: p.mes, diferenca: p.diferenca }))}
                chaveX="mes"
                formatoX="mes"
                series={[{ id: "diferenca", rotulo: "Receita menos volume", cor: "var(--cor-gas)", espessura: 2 }]}
                unidade="p.p."
                casas={1}
                zeroNoEixo
                altura={280}
              />
            </FiguraAnalitica>

            <Controles rotulo="Mês e indicador da contagem" idioma="pt" resumo={<>Mostrando: {NOME_INDICADOR[indicador].toLowerCase()} em {mesExtenso(d.mes)}, {nomeUmin}, variação {def.curto}.</>}>
              <SelectUrl
                id="sel-mes"
                rotulo="Mês"
                nome="mes"
                base={ROTA_BRASIL}
                outros={Object.fromEntries(Object.entries({ universo, medida, periodo, indicador }).filter(([k, x]) => x !== PADRAO[k as keyof typeof PADRAO]))}
                atual={mes}
                opcoes={[...mesesSelecionaveis(g)].reverse().map((m) => ({ valor: m, rotulo: mesExtenso(m), href: h({ mes: m === ultimoMes ? null : m }) }))}
              />
              <SeletorUrl id="sel-indicador" rotulo="Indicador" atual={indicador} opcoes={INDICADORES.map((i) => ({ valor: i, rotulo: NOME_INDICADOR[i], href: h({ indicador: i }) }))} />
            </Controles>

            <FiguraAnalitica
              id="difusao"
              pergunta="A variação foi espalhada ou concentrada?"
              subtitulo={`${nomeU} · ${num(d.total)} atividades · ${NOME_INDICADOR[indicador].toLowerCase()}, variação em %, ${def.base} · ${mesExtenso(d.mes)}`}
              natureza="OBSERVADO"
              proveniencia={provVarejo(g, "pmc_atividades", {
                indicador: `${NOME_INDICADOR[indicador]} por atividade do ${nomeUmin}`, natureza: "OBSERVADO", unidade: `variação em %, ${def.base}`, frequencia: "mensal", inicio: d.mes, fim: d.mes,
                transformacoes: ["Contagem das atividades com variação positiva, negativa e nula, sobre o valor arredondado a uma casa"],
                limitacoes: [g.notas.pmc_pesos], download: hrefDownload("atividades.csv"),
              })}
              leitura={
                <LeituraGuiada>
                  Em {mesExtenso(d.mes)}, das {num(d.total)} atividades do {nomeUmin}, {num(d.alta)} {plural(d.alta, "teve", "tiveram")} alta {indicador === "volume" ? "no volume" : "na receita"}, {num(d.queda)}{" "}
                  {plural(d.queda, "teve", "tiveram")} queda
                  {d.estavel > 0 && <> e {num(d.estavel)} {plural(d.estavel, "ficou estável", "ficaram estáveis")}</>}
                  {d.semDado > 0 && <>; {num(d.semDado)} sem valor publicado</>}, {def.base}.
                </LeituraGuiada>
              }
              ressalva="Esta é uma contagem, não uma contribuição. O IBGE não publica no SIDRA o peso de cada atividade no índice geral, então a página não calcula quanto cada uma puxou o resultado: uma atividade grande em queda pode pesar mais que várias pequenas em alta."
              naoConcluir="quanto cada atividade contribuiu para o resultado do varejo, nem que a maioria em alta garante alta do total: sem os pesos, a contagem só diz se o movimento foi espalhado."
              tabela={{
                titulo: `Atividades do ${nomeUmin} em ${mesExtenso(d.mes)}, variação ${def.curto}`,
                colunas: ["Atividade", "Volume, %", "Receita nominal, %", "Receita menos volume, p.p.", "Peso no índice"],
                linhas: barras.map((x) => [x.nomeCurto, x.volume, x.receita, x.diferenca, "não publicado no SIDRA"]),
                casas: [null, 1, 1, 1, null],
                limite: barras.length,
                csv: hrefDownload("atividades.csv"),
              }}
              complemento={
                <ExportarRecorte
                  nome={`varejo-atividades-${universo}-${medida}-${d.mes}`}
                  colunas={["atividade", "nome", "volume_pct", "receita_nominal_pct", "receita_menos_volume_pp", "peso_no_indice"]}
                  linhas={barras.map((x) => [x.slug, x.nomeCurto, x.volume, x.receita, x.diferenca, "não publicado no SIDRA"])}
                  recorte={`${nomeU}, variação ${def.base}, ${mesExtenso(d.mes)}`}
                  fonte={`${g.fontes.pmc_atividades.orgao}, ${g.fontes.pmc_atividades.tabela}`}
                />
              }
              depois={
                <p className="t-meta text-carvao-muted">
                  <Link href={ROTA_SEGMENTOS} prefetch={false} className={LINK}>
                    Ver cada atividade, com a trajetória recente e os estados
                  </Link>
                </p>
              }
            >
              <GraficoBarras
                semTabela
                titulo={`${NOME_INDICADOR[indicador]} por atividade em ${mesExtenso(d.mes)}, da maior alta à maior queda`}
                dados={barras.map((x) => ({ slug: x.slug, nome: NOME_CURTO_ATIVIDADE[x.slug] ?? x.nome, valor: x[indicador] }))}
                chaveCategoria="slug"
                chaveRotulo="nome"
                series={[{ id: "valor", rotulo: NOME_INDICADOR[indicador], cor: "var(--cor-gas)" }]}
                unidade="%"
                casas={1}
                orientacao="horizontal"
                alturaCategoria={40}
                rotulosValor
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="mercado"
              pergunta={`Qual era o tamanho do mercado em ${ano}?`}
              subtitulo={`Comércio varejista por tipo de comércio · receita operacional líquida, R$ bilhões correntes de ${ano} · Brasil · ${ano}`}
              natureza="OBSERVADO"
              proveniencia={provVarejo(g, "pac_geral", {
                indicador: "Receita operacional líquida, empresas e pessoal ocupado do comércio varejista", natureza: "OBSERVADO", unidade: `R$ bilhões correntes de ${ano}`, frequencia: "anual", inicio: ano, fim: ano,
                limitacoes: [g.notas.pac, "Pessoal ocupado em 31 de dezembro do ano de referência."],
              })}
              complementares={[
                { rotulo: "Sobre o recorte de porte", p: provVarejo(g, "pac_porte", { indicador: "Empresas com 20 ou mais pessoas ocupadas e o pessoal ocupado nelas", natureza: "OBSERVADO", unidade: "empresas e pessoas", frequencia: "anual", inicio: ano, fim: ano }) },
              ]}
              leitura={
                <LeituraGuiada>
                  Em {ano}, o comércio varejista teve receita operacional líquida de R$ {trilhoes(v?.receita_operacional_liquida)} trilhões, em {num(v?.empresas)} empresas com {num(v?.pessoal_ocupado)} pessoas ocupadas.
                  {maior && v?.receita_operacional_liquida ? ` O maior grupo, ${maior.curto.toLowerCase()}, respondeu por ${pct((100 * (maior.receita_operacional_liquida ?? 0)) / v.receita_operacional_liquida)} dessa receita.` : ""}
                </LeituraGuiada>
              }
              ressalva={`Os valores são de ${ano}, em reais daquele ano, e não acompanham a conjuntura dos gráficos acima, que vai até ${mesExtenso(ultimoMes)}. A divisão 47 da classificação de atividades não inclui o comércio de veículos nem o atacado.`}
              complemento={
                <div className="border-t border-linha pt-4" data-porte="">
                <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
                  <div>
                    <dt className="t-meta text-carvao-muted">Empresas com 20 ou mais pessoas ocupadas</dt>
                    <dd className="mt-1 text-carvao">
                      <span className="numero-p">{num(porte.empresas20)}</span> <span className="t-meta text-carvao-muted">de {num(porte.empresas)} ({pct(porte.parteEmpresas)})</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="t-meta text-carvao-muted">Pessoas ocupadas nessas empresas</dt>
                    <dd className="mt-1 text-carvao">
                      <span className="numero-p">{num(porte.pessoal20)}</span> <span className="t-meta text-carvao-muted">de {num(porte.pessoal)} ({pct(porte.partePessoal)})</span>
                    </dd>
                  </div>
                </dl>
                  <p className="t-meta mt-4 max-w-prose2 text-carvao-muted">
                    É o recorte de porte que a pesquisa divulga para o varejo: 20 ou mais pessoas ocupadas contra o total. Não há abertura por faixas menores nem por faturamento. Fonte: {FONTE_PAC} {ano}; partes em %: cálculo da Scrutiniums.
                  </p>
                </div>
              }
              naoConcluir={`que o mercado tem hoje esse tamanho: o valor é de ${ano} e está em reais daquele ano. Também não compara com a série anual encerrada em 2023, que usava outra metodologia.`}
              tabela={{
                titulo: `Comércio varejista por tipo de comércio, ${ano}`,
                colunas: ["Tipo de comércio", "Receita operacional líquida, R$ bilhões", "Parte da receita, %", "Empresas", "Pessoas ocupadas", "Taxa de margem de comercialização, %"],
                linhas: [
                  ...grupos.map((x) => [x.rotulo, x.receita_operacional_liquida === null ? null : x.receita_operacional_liquida / 1e6, x.receita_operacional_liquida !== null && v?.receita_operacional_liquida ? (100 * x.receita_operacional_liquida) / v.receita_operacional_liquida : null, x.empresas, x.pessoal_ocupado, x.taxa_margem]),
                  ["Comércio varejista, total", v?.receita_operacional_liquida == null ? null : v.receita_operacional_liquida / 1e6, v?.receita_operacional_liquida != null ? 100 : null, v?.empresas ?? null, v?.pessoal_ocupado ?? null, v?.taxa_margem ?? null],
                ],
                casas: [null, 1, 1, 0, 0, 1],
                limite: grupos.length + 1,
              }}
            >
              <GraficoBarras
                semTabela
                titulo={`Receita operacional líquida do comércio varejista por tipo de comércio, ${ano}`}
                dados={grupos.map((x) => ({ codigo: x.codigo, nome: x.curto, receita: x.receita_operacional_liquida === null ? null : x.receita_operacional_liquida / 1e6 }))}
                chaveCategoria="codigo"
                chaveRotulo="nome"
                series={[{ id: "receita", rotulo: "Receita operacional líquida", cor: "var(--cor-gas)" }]}
                unidade="R$ bilhões"
                casas={0}
                orientacao="horizontal"
                alturaCategoria={40}
                rotulosValor
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="contexto"
              pergunta="O que acontecia com renda, preços e juros?"
              subtitulo={`Três variáveis de contexto, cada uma na sua unidade e no seu gráfico · Brasil · ${periodoTexto}`}
              natureza="OBSERVADO"
              proveniencia={provVarejo(g, "pnadc_massa", { indicador: "Massa de rendimento real habitual de todos os trabalhos", natureza: "OBSERVADO", unidade: g.macro.massa_renda_real.unidade, frequencia: "trimestre móvel encerrado em cada mês", inicio, fim: uMassa?.mes ?? ult.mes })}
              complementares={[
                { rotulo: "Sobre a inflação de alimentos", p: provVarejo(g, "ipca", { indicador: "IPCA, alimentação no domicílio, acumulado em 12 meses", natureza: "OBSERVADO", unidade: "% em 12 meses", frequencia: "mensal", inicio: alimentos.find((p) => p.valor !== null)?.mes ?? inicio, fim: uAlim?.mes ?? ult.mes }) },
                { rotulo: "Sobre os juros", p: provVarejo(g, "bcb_juros", { indicador: "Taxa média de juros do crédito com recursos livres a pessoas físicas", natureza: "OBSERVADO", unidade: "% ao ano", frequencia: "mensal", inicio, fim: uJuros?.mes ?? ult.mes }) },
              ]}
              ressalva={primeiroAlim && primeiroAlim > inicio ? `Nesta base, a inflação de alimentos em 12 meses só tem valor a partir de ${mesExtenso(primeiroAlim)}; os meses anteriores aparecem como lacuna, não como zero.` : undefined}
              naoConcluir="que renda, preços ou juros causaram a variação das vendas. Duas séries que se movem juntas no mesmo período descrevem uma coincidência no tempo; provar causa exige outro tipo de estudo."
              tabela={{
                titulo: "Renda, inflação de alimentos e juros",
                colunas: ["Mês", "Massa de renda real, R$ bilhões", "Alimentos no domicílio, % em 12 meses", "Juros do crédito livre às famílias, % ao ano"],
                linhas: massa.map((p, i) => [mesCurto(p.mes), p.valor === null ? null : p.valor / 1000, alimentos[i]?.valor ?? null, juros[i]?.valor ?? null]),
                casas: [null, 1, 2, 2],
                limite: 24,
              }}
            >
              <div className="grid gap-x-10 gap-y-10 lg:grid-cols-3">
                {CONTEXTO.map((c) => (
                  <div key={c.id} className="min-w-0" data-contexto={c.id}>
                    <h3 className="t-h3 text-carvao">{c.titulo}</h3>
                    <p className="t-meta mt-2 min-h-[4.5rem] text-carvao-muted">{c.mecanismo}</p>
                    <p className="t-meta mt-2 text-carvao lg:min-h-[4rem]">
                      <span className="font-medium">Indicador observável:</span> {c.ultimo}.
                    </p>
                    <div className="mt-3">
                      <GraficoLinhas
                        semTabela
                        semTitulo
                        titulo={c.titulo}
                        dados={c.pontos.map((p) => ({ mes: p.mes, valor: p.valor }))}
                        chaveX="mes"
                        formatoX="mes"
                        series={[{ id: "valor", rotulo: c.titulo, cor: "var(--serie-4)" }]}
                        unidade={c.unidade}
                        casas={c.casas}
                        altura={210}
                        rotulosDiretos={false}
                        sincronizarCursor={false}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </FiguraAnalitica>
          </>
        }
        notas={{
          id: "para-ler",
          itens: [
            { termo: "Volume de vendas", definicao: "Quanto se vendeu descontada a variação dos preços. É a medida de crescimento real: sobe quando sai mais mercadoria das lojas." },
            { termo: "Receita nominal", definicao: "Quanto se vendeu em reais correntes. Sobe com mais mercadoria vendida e também com preços mais altos." },
            { termo: "Varejo restrito", definicao: "O comércio do dia a dia medido pelo IBGE: combustíveis, supermercados, vestuário, móveis e eletrodomésticos, farmácia, livros, informática e outros artigos de uso pessoal." },
            { termo: "Varejo ampliado", definicao: "O restrito mais veículos e peças, material de construção e, desde janeiro de 2023, o atacado de alimentos, bebidas e fumo." },
            { termo: "Ajuste sazonal", definicao: "Correção que desconta o que se repete todo ano, como o Natal e o número de dias úteis, para comparar um mês com o anterior." },
            { termo: "Ponto percentual (p.p.)", definicao: "A diferença entre duas porcentagens.", exemplo: `Receita de ${variacao(ult.receita)} menos volume de ${variacao(ult.volume)} dá ${pontos(ult.diferenca)}.` },
          ],
        }}
        metodo={
          <>
            <LinhaFonte f={g.fontes.pmc_restrito} periodo={`${mesCurto(g.pmc.meses[0])} a ${mesCurto(ultimoMes)}`} />
            <LinhaFonte f={g.fontes.pmc_ampliado} periodo={`${mesCurto(g.pmc.meses[0])} a ${mesCurto(ultimoMes)}`} />
            <LinhaFonte f={g.fontes.pmc_atividades} periodo={`${mesCurto(g.pmc.meses[0])} a ${mesCurto(ultimoMes)}`} />
            <LinhaFonte f={g.fontes.pac_geral} periodo={ano} />
            <LinhaFonte f={g.fontes.pac_porte} periodo={ano} />
            <LinhaFonte f={g.fontes.pnadc_massa} periodo={`${mesCurto(g.pmc.meses[0])} a ${uMassa ? mesCurto(uMassa.mes) : mesCurto(ultimoMes)}`} />
            <LinhaFonte f={g.fontes.ipca} periodo={`até ${uAlim ? mesCurto(uAlim.mes) : mesCurto(ultimoMes)}`} />
            <LinhaFonte f={g.fontes.bcb_juros} periodo={`${mesCurto(g.pmc.meses[0])} a ${uJuros ? mesCurto(uJuros.mes) : mesCurto(ultimoMes)}`} />
            <p>
              As variações de volume e de receita são as publicadas pelo IBGE; a página não recalcula nenhuma. A diferença entre receita e volume e as partes em porcentagem da pesquisa anual são cálculo da Scrutiniums, com a
              fórmula em cada figura. Com {num(nAtiv)} atividades no {nomeUmin}, a contagem de altas e quedas considera a variação arredondada a uma casa.
            </p>
            <FechoDoMetodo g={g} />
          </>
        }
        frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/varejo"]} variante="metodo" />}
      />
    </>
  );
}

/** A composição do universo escolhido e a mudança de cobertura do ampliado, lidas do catálogo de atividades da gold. */
function Composicao({ universo, g }: Readonly<{ universo: Universo; g: ReturnType<typeof goldSetor> }>) {
  const nomes = (u: Universo | "so-ampliado") =>
    Object.entries(g.pmc.atividades)
      .filter(([, a]) => (u === "so-ampliado" ? a.universo === "ampliado" : a.universo === "restrito"))
      .map(([slug]) => (NOME_CURTO_ATIVIDADE[slug] ?? slug).toLowerCase());
  const lista = (itens: string[]) => (itens.length > 1 ? `${itens.slice(0, -1).join("; ")}; e ${itens[itens.length - 1]}` : itens[0] ?? "");
  return (
    <div className="max-w-prose2 border-t border-linha pt-4" data-composicao={universo}>
      <p className="t-meta text-carvao">
        <span className="font-medium">O que entra no varejo restrito:</span> {lista(nomes("restrito"))}.
      </p>
      <p className={`t-meta mt-2 ${universo === "ampliado" ? "text-carvao" : "text-carvao-muted"}`}>
        <span className="font-medium">O que o ampliado acrescenta:</span> {lista(nomes("so-ampliado"))}. O atacado de alimentos, bebidas e fumo faz parte do ampliado desde janeiro de 2023, segundo a nota da pesquisa; antes
        disso o ampliado não o incluía. Todos os índices têm a média de 2022 igual a 100.
      </p>
    </div>
  );
}
