import type { Metadata } from "next";
import { lerQueimadas, lerQueimadasMunicipios, municipiosDeFocos, municipiosParaMetade, recorte, NOME_UF, PISO_FOCOS_DENSIDADE, type FocosMunicipio, type GoldQueimadas } from "@/lib/territorio/queimadas";
import { FocosNoMunicipio } from "@/components/territorio/FocosNoMunicipio";
import { DoSateliteAoFoco, dataBr, mesAno, n } from "@/components/territorio/Queimadas";
import { FiguraAnalitica, GraficoBarras, LeituraGuiada, PaginaPainel, TabelaDados, type NumeroProps } from "@/components/painel";
import { provenienciaMontada } from "@/lib/painel/proveniencia-montada";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: tituloNaColecao("Queimadas e focos de calor", "/territorio/queimadas"),
  description: "Focos de calor do satélite de referência do INPE desde 2003, o ano em curso contra o mesmo período do ano anterior, estados e biomas, e a área queimada mapeada.",
};

const FONTE = "INPE, Programa Queimadas, satélite de referência AQUA_M-T";
const FONTE_CURTA = "INPE, Programa Queimadas";
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function origem(g: GoldQueimadas, indicador: string, inicio: string, fim: string, extra: { frequencia?: string; unidade?: string; url?: string; limitacoes?: string[] } = {}) {
  return provenienciaMontada({
    indicador,
    natureza: "OBSERVADO",
    orgao: "INPE",
    dataset: "Programa Queimadas, focos de calor do satélite de referência",
    url: g.fonte.portal,
    urlPrimaria: extra.url ?? g.fonte.url,
    licenca: g.fonte.licenca,
    unidade: extra.unidade ?? "focos de calor",
    frequencia: extra.frequencia ?? "anual",
    inicio,
    fim,
    capturadoEm: g.capturadoEm,
    limitacoes: extra.limitacoes ?? g.ressalvas,
  });
}

/** Datas AAAA-MM-DD escritas no texto da gold, na forma da página (dd/mm/aaaa): nenhuma data ISO à vista. */
const semDataIso = (t: string) => t.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, "$3/$2/$1");

/** Diferença entre o período atual e o mesmo período do ano anterior, como na tabela de antes. */
function diferenca(atual: number, anterior: number | null): string {
  if (anterior) return `${atual >= anterior ? "+" : "−"}${n(Math.abs(atual - anterior))}`;
  return anterior === 0 ? "sem focos antes" : "";
}

/**
 * Painel de queimadas do Observatório do Território e Clima: pergunta, números de
 * escala com fonte e período, série anual comparável (satélite de referência), ano em
 * curso contra o mesmo período, estados e biomas, área queimada provisória, modelo
 * didático do que um foco é e método recolhido. Tudo lido de public/territorio/gold.
 *
 * No molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a faixa de números do kit, cada gráfico numa figura com
 * tabela equivalente, proveniência e o que não permite concluir (o modelo didático acompanha a série anual, a busca por município
 * acompanha o ranking dos municípios), as tabelas de todos os estados e da área queimada na fatia de tabelas e o método no fim.
 */
export default function PaginaQueimadas() {
  const g = lerQueimadas();
  const c = g.comparacao;
  const fechados = g.anual.filter((a) => !a.parcial && a.focos !== null);
  const ultimo = fechados[fechados.length - 1];
  const parcial = g.anual.find((a) => a.parcial);
  const atual = recorte(g, "acumuladoAnoCorrente");
  const anterior = recorte(g, "mesmoPeriodoAnoAnterior");
  const anoCompleto = recorte(g, "ultimoAnoCompleto");
  const biomaLider = atual?.porBioma?.[0];
  const aq = g.areaQueimada;
  const aqFechado = aq?.anual.filter((a) => !a.parcial).at(-1);
  // o ano parcial da tabela é o mais recente (a série também começa parcial, em set/2002)
  const aqParcial = aq?.anual.filter((a) => a.parcial && aqFechado && a.ano > aqFechado.ano).at(-1);
  const aqUltimoMes = aqParcial ? aq?.mensal.filter((m) => m.mes.startsWith(String(aqParcial.ano))).at(-1)?.mes : undefined;
  const periodoAtual = c ? `${mesAno(c.periodoAtual.inicio)} a ${mesAno(c.periodoAtual.fim)}` : null;
  const periodoAnterior = c ? `${mesAno(c.periodoAnterior.inicio)} a ${mesAno(c.periodoAnterior.fim)}` : null;
  const rotuloAtual = periodoAtual ?? "Ano em curso";
  const rotuloAnterior = periodoAnterior ?? "Ano anterior";
  const anoCompletoRotulo = `${Number(g.dataReferencia.slice(0, 4)) - 1} completo`;

  const ufs = (atual?.porUF ?? []).filter((u) => NOME_UF[u.id]).map((u) => ({
    id: u.id,
    atual: u.focos,
    anterior: anterior?.porUF?.find((x) => x.id === u.id)?.focos ?? null,
    anoCompleto: anoCompleto?.porUF?.find((x) => x.id === u.id)?.focos ?? null,
  }));
  const biomas = (atual?.porBioma ?? []).map((b) => ({ id: b.id, atual: b.focos, anterior: anterior?.porBioma?.find((x) => x.id === b.id)?.focos ?? null }));
  const semUF = (atual?.porUF ?? []).filter((u) => !NOME_UF[u.id]);
  const colunasUf = ["Unidade da Federação", rotuloAtual, rotuloAnterior, "Diferença", anoCompletoRotulo];
  const linhaUf = (l: (typeof ufs)[number]) => [NOME_UF[l.id] ?? l.id, l.atual, l.anterior, diferenca(l.atual, l.anterior), l.anoCompleto];

  // Municípios: último ano completo, satélite de referência, área do Censo 2022.
  const gm = lerQueimadasMunicipios();
  const anoMun = gm?.periodos.ultimoAnoCompleto ? Number(gm.periodos.ultimoAnoCompleto.periodo.inicio.slice(0, 4)) : null;
  const munis = gm && anoMun ? municipiosDeFocos(gm).filter((m) => (m.focos.ultimoAnoCompleto ?? 0) > 0) : [];
  const totalMun = gm?.periodos.ultimoAnoCompleto?.focos ?? 0;
  const topFocos = munis.slice(0, 15);
  const topArea = munis.filter((m) => (m.focos.ultimoAnoCompleto ?? 0) >= PISO_FOCOS_DENSIDADE && m.porMilKm2 != null).sort((a, b) => (b.porMilKm2 as number) - (a.porMilKm2 as number)).slice(0, 15);
  const metade = municipiosParaMetade(munis, totalMun);
  const semMun = gm?.semMunicipio.ultimoAnoCompleto?.focos ?? 0;
  const tabelaMun = (itens: FocosMunicipio[], ano: number) => ({
    colunas: ["Município", "Posição", `Focos em ${ano}`, "Por 1.000 km²"],
    linhas: itens.map((m, i) => [`${m.nome} (${m.uf})`, String(i + 1), m.focos.ultimoAnoCompleto ?? 0, m.porMilKm2 ?? null]),
    casas: [null, null, 0, 1],
    limite: itens.length,
  });
  const notaMunicipios = gm && anoMun && (
    <>
      {FONTE}, arquivo anual de {anoMun}. Área territorial: {gm.fonteArea.fonte}. O arquivo anual traz o nome do município, não o código: o nome foi casado com a lista oficial
      do IBGE, com {Object.keys(gm.equivalenciasUsadas).length} grafias antigas ou divergentes resolvidas uma a uma (por exemplo, Açu para Assú).{" "}
      {semMun > 0 ? `${n(semMun)} focos ficaram sem município identificado e entram só no total do país.` : "Todos os focos do ano foram atribuídos a um município."}
    </>
  );
  const anosAq = aq && aqFechado ? aq.anual.filter((a) => a.ano >= aqFechado.ano - 2) : [];

  const mensalAnos = Object.keys(g.mensal).sort();
  const [anoAnterior, anoAtual] = mensalAnos;
  const mesParcial = (g.mensal[anoAtual] ?? []).find((m) => m.parcial);
  const serieAtualRotulo = mesParcial ? `${anoAtual} (${mesAno(mesParcial.mes)} parcial)` : anoAtual;

  const numeros: NumeroProps[] = [
    {
      rotulo: `Focos de calor em ${ultimo.ano}`,
      valor: ultimo.focos as number,
      formato: "inteiro",
      unidade: "focos",
      periodo: ultimo.preliminar ? `${ultimo.ano}, preliminar: o consolidado anual do INPE ainda não saiu` : `${ultimo.ano}, ano fechado`,
      fonte: FONTE_CURTA,
      natureza: "OBSERVADO",
      nota: "Satélite de referência; é o número comparável entre anos.",
    },
    ...(c
      ? [
          {
            rotulo: `Focos de ${periodoAtual}`,
            valor: c.focosAtual,
            formato: "inteiro" as const,
            unidade: "focos",
            periodo: periodoAtual as string,
            fonte: FONTE_CURTA,
            natureza: "OBSERVADO" as const,
            variacao: { valor: c.variacaoPct, base: `sobre ${periodoAnterior}`, unidade: "%" as const, casas: 1 },
            nota: "Ano em curso, preliminar: o INPE pode regerar os arquivos mensais.",
          },
        ]
      : []),
    ...(biomaLider && atual
      ? [
          {
            rotulo: `Bioma com mais focos em ${periodoAtual ?? "o ano em curso"}`,
            valorTexto: biomaLider.id,
            formato: "texto" as const,
            unidade: `${n(biomaLider.focos)} focos`,
            periodo: periodoAtual ?? "ano em curso",
            fonte: FONTE_CURTA,
            natureza: "CALCULADO" as const,
            nota: `${n((100 * biomaLider.focos) / (atual.focos as number), 1)}% do total do período. Bioma atribuído pelo INPE a cada foco.`,
            tamanho: "m" as const,
          },
        ]
      : []),
    ...(aqFechado
      ? [
          {
            rotulo: `Área queimada mapeada em ${aqFechado.ano}`,
            valor: aqFechado.totalKm2,
            formato: "inteiro" as const,
            unidade: "km²",
            periodo: `${aqFechado.ano}, produto provisório`,
            fonte: "INPE, AQ1km Coleção 2",
            natureza: "OBSERVADO" as const,
            nota: "Outra medida, de outro produto do INPE (AQ1km): não se compara com a contagem de focos.",
          },
        ]
      : []),
  ];

  return (
    <main className="bg-papel">
      {/* o layout do Território abre o destino do "Pular para o conteúdo" (#conteudo); o molde fica dentro deste <main> */}
      <PaginaPainel
        rota="/territorio/queimadas"
        principal={false}
        abertura={{
          acento: "obee",
          titulo: "Onde e quanto o fogo aparece no Brasil?",
          lead: "Focos de calor detectados pelo satélite de referência do INPE desde 2003, o ano em curso comparado ao mesmo período do ano anterior, os estados e os biomas, e a área queimada mapeada.",
          recorte: {
            periodo: `2003 a ${parcial ? `${parcial.ano}, parcial` : ultimo.ano}`,
            universo: "Brasil, satélite de referência",
            unidade: "focos de calor",
            fonte: FONTE_CURTA,
          },
          limite: "o tamanho da área queimada nem o número de incêndios, porque um foco é um pixel de cerca de 1 km com fogo ativo na passagem do satélite, e fogo pequeno, sob a copa ou sob nuvem não aparece.",
        }}
        rotuloNumeros="Focos de calor e área queimada"
        numeros={numeros}
        notaNumeros={
          <p className="text-carvao">
            Foco de calor não é incêndio nem área queimada: é um pixel de cerca de 1 km com fogo ativo na passagem do satélite. Serve
            para comparar tendência entre anos e lugares, sempre com o mesmo satélite.
          </p>
        }
        figuras={
          <>
            <FiguraAnalitica
              id="anual"
              pergunta="Os focos de cada ano desde 2003"
              subtitulo="Focos de calor por ano · Brasil · satélite de referência"
              natureza="OBSERVADO"
              proveniencia={origem(g, "Focos de calor por ano, satélite de referência", String(g.anual[0].ano), parcial?.ultimoDia ?? String(ultimo.ano))}
              extraFonte={<>Arquivos anuais consolidados; ano em curso pelos arquivos mensais filtrados para o mesmo satélite. Capturado em {dataBr(g.capturadoEm)}.</>}
              ressalva={parcial ? `${parcial.ano} é parcial, até ${parcial.ultimoDia ? dataBr(parcial.ultimoDia) : "a captura"}, e não se compara com anos fechados.` : undefined}
              naoConcluir="que um ano teve mais área queimada ou mais incêndios que outro: a série conta focos de um só satélite, e o ano em curso, parcial, não se compara com anos fechados."
              tabela={{
                titulo: "Focos de calor por ano, satélite de referência",
                colunas: ["Ano", "Focos", "Situação"],
                linhas: g.anual.map((a) => [
                  String(a.ano),
                  a.focos,
                  a.parcial ? `Parcial, até ${a.ultimoDia ? dataBr(a.ultimoDia) : "a captura"}` : a.preliminar ? "Ano encerrado, preliminar (arquivos mensais; consolidado do INPE ainda não publicado)" : "Ano fechado",
                ]),
                casas: [null, 0, null],
                limite: g.anual.length,
              }}
              depois={<DoSateliteAoFoco />}
            >
              <GraficoBarras
                semTabela
                titulo="Focos de calor por ano, satélite de referência"
                dados={g.anual.filter((a) => a.focos !== null).map((a) => ({ ano: a.parcial ? `${a.ano}*` : String(a.ano), fechado: a.parcial ? null : a.focos, parcial: a.parcial ? a.focos : null }))}
                chaveCategoria="ano"
                series={[
                  { id: "fechado", rotulo: "Anos fechados", cor: "var(--cor-obee)", opcional: true },
                  { id: "parcial", rotulo: parcial ? `${parcial.ano}*, parcial, não se compara` : "Ano em curso, parcial", cor: "var(--serie-referencia)", opcional: true },
                ]}
                unidade="focos"
                casas={0}
                empilhado
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="mensal"
              pergunta="Mês a mês, este ano e o anterior"
              subtitulo="Focos de calor por mês · Brasil · satélite de referência"
              natureza="OBSERVADO"
              proveniencia={origem(g, "Focos de calor por mês, satélite de referência", `${anoAnterior}-01`, (g.mensal[anoAtual] ?? []).at(-1)?.mes ?? `${anoAtual}-01`, { frequencia: "mensal" })}
              leitura={<LeituraGuiada>Os meses de agosto a outubro concentram o fogo na maior parte do país.</LeituraGuiada>}
              ressalva="O mês em curso é parcial; arquivos mensais recentes podem ser regerados pelo INPE."
              naoConcluir="que o ano em curso terminará acima ou abaixo do anterior: o mês corrente está incompleto, e os meses ainda por vir não entram na comparação."
              tabela={{
                titulo: `Focos de calor por mês, ${anoAnterior} e ${anoAtual}`,
                colunas: ["Mês", ...mensalAnos],
                linhas: MESES.map((m, i) => [
                  m,
                  ...mensalAnos.map((a) => {
                    const x = g.mensal[a]?.[i];
                    return !x ? "" : x.focos === null ? "Indisponível" : `${n(x.focos)}${x.parcial ? " (parcial)" : ""}`;
                  }),
                ]),
                limite: 12,
              }}
            >
              <GraficoBarras
                semTabela
                titulo={`Focos de calor por mês, ${anoAnterior} e ${anoAtual}, satélite de referência`}
                dados={MESES.map((m, i) => ({ mes: m, anterior: g.mensal[anoAnterior]?.[i]?.focos ?? null, atual: g.mensal[anoAtual]?.[i]?.focos ?? null }))}
                chaveCategoria="mes"
                series={[
                  { id: "anterior", rotulo: anoAnterior, cor: "var(--serie-referencia)" },
                  // os meses que ainda não chegaram não são lacuna: "não se aplica"
                  { id: "atual", rotulo: serieAtualRotulo, cor: "var(--cor-obee)", opcional: true },
                ]}
                unidade="focos"
                casas={0}
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="biomas"
              pergunta="Onde o fogo aparece: por bioma"
              subtitulo={`Focos de calor · ${rotuloAtual}, contra os mesmos meses do ano anterior · bioma atribuído pela fonte`}
              natureza="OBSERVADO"
              proveniencia={origem(g, "Focos de calor por bioma, ano em curso e mesmo período do ano anterior", c?.periodoAnterior.inicio ?? g.dataReferencia, c?.periodoAtual.fim ?? g.dataReferencia, { frequencia: "mensal" })}
              leitura={
                <LeituraGuiada>
                  {periodoAtual ? `De ${periodoAtual}, comparado aos mesmos meses de ${periodoAnterior?.slice(-4)}.` : "Ano em curso."} Estado e bioma vêm da própria fonte.
                </LeituraGuiada>
              }
              naoConcluir="que o fogo cresceu num bioma por uma causa: a comparação é de contagens de focos em meses iguais de dois anos, sem divisão pela área do bioma."
              tabela={{
                titulo: `Focos de calor por bioma, ${rotuloAtual} e ${rotuloAnterior}`,
                colunas: ["Bioma", rotuloAtual, rotuloAnterior],
                linhas: biomas.map((b) => [b.id, b.atual, b.anterior]),
                casas: [null, 0, 0],
                limite: biomas.length,
              }}
            >
              <GraficoBarras
                semTabela
                titulo={`Focos de calor por bioma, ${rotuloAtual} e ${rotuloAnterior}`}
                dados={biomas.map((b) => ({ id: b.id, atual: b.atual, anterior: b.anterior }))}
                chaveCategoria="id"
                series={[
                  { id: "atual", rotulo: rotuloAtual, cor: "var(--cor-obee)" },
                  { id: "anterior", rotulo: rotuloAnterior, cor: "var(--serie-referencia)" },
                ]}
                unidade="focos"
                casas={0}
                orientacao="horizontal"
                rotulosSaoNomes
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="ufs-top"
              pergunta="Os dez estados com mais focos"
              subtitulo={`Focos de calor · ${rotuloAtual}, contra os mesmos meses do ano anterior · todos os estados na tabela abaixo`}
              natureza="OBSERVADO"
              proveniencia={origem(g, "Focos de calor por estado, ano em curso e mesmo período do ano anterior", c?.periodoAnterior.inicio ?? g.dataReferencia, c?.periodoAtual.fim ?? g.dataReferencia, { frequencia: "mensal" })}
              leitura={<LeituraGuiada>Estados maiores tendem a ter mais focos: a contagem não está dividida pela área.</LeituraGuiada>}
              naoConcluir="que um estado queima mais que outro em proporção ao território: a contagem não está dividida pela área, e estados maiores tendem a somar mais focos."
              tabela={{ titulo: `Os dez estados com mais focos de calor, ${rotuloAtual}`, colunas: colunasUf, linhas: ufs.slice(0, 10).map(linhaUf), casas: [null, 0, 0, null, 0], limite: 10 }}
            >
              <GraficoBarras
                semTabela
                titulo={`Os dez estados com mais focos de calor, ${rotuloAtual} e ${rotuloAnterior}`}
                dados={ufs.slice(0, 10).map((l) => ({ id: l.id, nome: NOME_UF[l.id] ?? l.id, atual: l.atual, anterior: l.anterior }))}
                chaveCategoria="id"
                chaveRotulo="nome"
                series={[
                  { id: "atual", rotulo: rotuloAtual, cor: "var(--cor-obee)" },
                  { id: "anterior", rotulo: rotuloAnterior, cor: "var(--serie-referencia)" },
                ]}
                unidade="focos"
                casas={0}
                orientacao="horizontal"
                rotulosSaoNomes
              />
            </FiguraAnalitica>

            {gm && anoMun && munis.length > 0 && (
              <>
                <FiguraAnalitica
                  id="municipios"
                  pergunta={`Município a município: mais focos em ${anoMun}`}
                  subtitulo={`Os 15 municípios com mais focos de calor no ano · satélite de referência · ${anoMun}`}
                  natureza="OBSERVADO"
                  proveniencia={origem(g, "Focos de calor por município, último ano completo", String(anoMun), String(anoMun), { limitacoes: gm.ressalvas })}
                  leitura={
                    <LeituraGuiada>
                      Em {anoMun}, {n(munis.length)} dos {n(gm.municipiosIbge)} municípios do país tiveram ao menos um foco de calor detectado pelo satélite de referência
                      {metade ? <>, e metade de todos os focos do ano ocorreu em {n(metade)} deles</> : null}. Municípios grandes acumulam mais focos; por isso, a segunda lista
                      divide a contagem pela área.
                    </LeituraGuiada>
                  }
                  complemento={<FocosNoMunicipio ano={anoMun} />}
                  ressalva={notaMunicipios}
                  naoConcluir="que um município queimou mais área ou foi mais negligente: a lista conta focos de calor, e municípios grandes acumulam mais focos pela própria extensão."
                  tabela={{ titulo: `Os 15 municípios com mais focos de calor em ${anoMun}`, ...tabelaMun(topFocos, anoMun) }}
                >
                  <GraficoBarras
                    semTabela
                    titulo={`Os 15 municípios com mais focos de calor em ${anoMun}`}
                    dados={topFocos.map((m) => ({ id: m.id, nome: `${m.nome} (${m.uf})`, focos: m.focos.ultimoAnoCompleto ?? 0 }))}
                    chaveCategoria="id"
                    chaveRotulo="nome"
                    series={[{ id: "focos", rotulo: `Focos em ${anoMun}`, cor: "var(--cor-obee)" }]}
                    unidade="focos"
                    casas={0}
                    orientacao="horizontal"
                    rotulosValor
                    rotulosSaoNomes
                  />
                </FiguraAnalitica>

                <FiguraAnalitica
                  id="municipios-area"
                  pergunta={`Mais focos por área em ${anoMun}`}
                  subtitulo={`Focos por 1.000 km², entre municípios com pelo menos ${PISO_FOCOS_DENSIDADE} focos no ano · área do Censo 2022 · ${anoMun}`}
                  natureza="CALCULADO"
                  proveniencia={origem(g, "Focos de calor por 1.000 km² de área municipal, último ano completo", String(anoMun), String(anoMun), { unidade: "focos por 1.000 km²", limitacoes: gm.ressalvas })}
                  leitura={<LeituraGuiada>O piso de {PISO_FOCOS_DENSIDADE} focos no ano evita que poucos focos num município pequeno dominem a lista.</LeituraGuiada>}
                  naoConcluir="que o fogo cobriu essa fração do município: a densidade divide a contagem de focos pela área, não mede área queimada."
                  tabela={{ titulo: `Os 15 municípios com mais focos de calor por 1.000 km² em ${anoMun}`, ...tabelaMun(topArea, anoMun) }}
                >
                  <GraficoBarras
                    semTabela
                    titulo={`Os 15 municípios com mais focos de calor por 1.000 km² em ${anoMun}`}
                    dados={topArea.map((m) => ({ id: m.id, nome: `${m.nome} (${m.uf})`, densidade: m.porMilKm2 }))}
                    chaveCategoria="id"
                    chaveRotulo="nome"
                    series={[{ id: "densidade", rotulo: "Focos por 1.000 km²", cor: "var(--cor-obee)" }]}
                    unidade="focos por 1.000 km²"
                    casas={1}
                    orientacao="horizontal"
                    rotulosValor
                    rotulosSaoNomes
                  />
                </FiguraAnalitica>
              </>
            )}
          </>
        }
        tabelas={
          <>
            <TabelaDados
              id="todos-os-estados"
              recolhida={false}
              tituloVisivel="Todos os estados"
              lead="Focos de calor do satélite de referência, ordenados pelo período mais recente."
              titulo={`Focos de calor por estado, ${rotuloAtual}`}
              colunas={colunasUf}
              linhas={ufs.map(linhaUf)}
              casas={[null, 0, 0, null, 0]}
              limite={ufs.length}
              ausencia={{ [rotuloAnterior]: "sem dado", [anoCompletoRotulo]: "sem dado" }}
              nota={semUF.length > 0 ? `Focos sem estado informado na fonte: ${n(semUF.reduce((s, u) => s + u.focos, 0))}, contados no total do Brasil.` : undefined}
            />
            {aq && aqFechado && (
              <TabelaDados
                id="area-queimada"
                recolhida={false}
                tituloVisivel="Quanta área queimou"
                lead={
                  <>
                    Produto provisório do INPE. Área queimada mapeada pelo INPE em pixels de 1 km (AQ1km, Coleção 2), por bioma. É outra medida, de outro produto: não se
                    soma nem se compara com a contagem de focos, e difere de outras estimativas, como a do MapBiomas. O INPE classifica a série como provisória.
                  </>
                }
                titulo="Área queimada mapeada por bioma, km²"
                colunas={["Bioma", ...anosAq.map((a) => `${a.ano}${a.parcial ? ` (${a.meses} meses)` : ""}`)]}
                linhas={[
                  ...Object.keys(aqFechado.km2)
                    .sort((x, y) => aqFechado.km2[y] - aqFechado.km2[x])
                    .map((b) => [b, ...anosAq.map((a) => a.km2[b] ?? null)]),
                  ["Total", ...anosAq.map((a) => a.totalKm2)],
                ]}
                casas={[null, ...anosAq.map(() => 0)]}
                limite={Object.keys(aqFechado.km2).length + 1}
                destaqueUltimaLinha
                nota={`km² de área queimada mapeada. INPE, AQ1km Coleção 2, produto provisório${aqParcial && aqUltimoMes ? `; ${aqParcial.ano} até ${mesAno(aqUltimoMes)}` : ""}. Sem recorte por estado na fonte.`}
              />
            )}
          </>
        }
        metodo={
          <>
            <p>
              Fonte: {g.fonte.nome} (<a href={g.fonte.portal} className="underline decoration-linha underline-offset-4">portal de dados abertos</a>). {g.fonte.licenca}
            </p>
            <p>
              Satélite de referência: {g.sateliteReferencia.id} ({g.sateliteReferencia.sensor}), desde {dataBr(g.sateliteReferencia.desde)}. Antes: {semDataIso(g.sateliteReferencia.antes)}.
              Unidade: {g.unidade}.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              {g.ressalvas.map((r) => <li key={r}>{r}</li>)}
              {aq?.ressalvas.map((r) => <li key={r}>Área queimada: {r}</li>)}
              {gm?.ressalvas.map((r) => <li key={r}>Municípios: {r}</li>)}
            </ul>
            <p>
              Captura em {dataBr(g.capturadoEm)}, com data de referência {dataBr(g.dataReferencia)}. Cada arquivo original tem sha256 e tamanho
              registrados ({Object.keys(g.originais).length} arquivos de focos{aq ? " e o arquivo de área queimada" : ""}). Os números são lidos da gold
              publicada pelo pipeline do observatório; quando um mês não tem arquivo na fonte, ele aparece como indisponível, nunca como zero.
            </p>
            <p>
              <a href="/territorio/gold/queimadas.json" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Baixar os dados deste painel (JSON)</a>
              {gm && (
                <>
                  {" · "}
                  <a href="/territorio/gold/queimadas_municipios.json" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Baixar os focos por município (JSON)</a>
                </>
              )}
            </p>
            <p>
              Área queimada por estado e por município não está neste painel: o INPE publica a tabela do AQ1km só por bioma, e o recorte por
              estado exigiria processar os mapas mensais do produto.
            </p>
          </>
        }
      />
    </main>
  );
}
