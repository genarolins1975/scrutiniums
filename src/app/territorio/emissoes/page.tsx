import type { Metadata } from "next";
import Link from "next/link";
import { GASES_PRINCIPAIS, NOME_GAS, NOME_SETOR, SETORES, balancaPorAno, lerEmissoes, mt, serieGas, type GoldEmissoes } from "@/lib/territorio/emissoes";
import { dataBr, n } from "@/components/territorio/Queimadas";
import { COR_SETOR, CincoSetores, ModeloBalanca, sinalPct } from "@/components/territorio/Emissoes";
import { FiguraAnalitica, GraficoBarras, GraficoLinhas, LeituraGuiada, PaginaPainel, TabelaDados, type NumeroProps } from "@/components/painel";
import { provenienciaMontada } from "@/lib/painel/proveniencia-montada";
import type { Natureza } from "@/lib/painel/tipos";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: tituloNaColecao("Emissões de gases de efeito estufa", "/territorio/emissoes"),
  description: "Emissões de gases de efeito estufa do Brasil pelo inventário oficial do MCTI, de 1990 ao último ano publicado, por setor, categoria e gás, com 2005 como referência da meta climática.",
};

const FONTE_CURTA = "MCTI, SIRENE";

/** Cor de cada gás no gráfico (tokens de comparação, sem juízo); os rótulos e a tabela repetem a informação. */
const COR_GAS = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-referencia)"];

function origem(g: GoldEmissoes, indicador: string, natureza: Natureza, unidade: string, extra: { transformacoes?: string[]; formula?: string } = {}) {
  return provenienciaMontada({
    indicador,
    natureza,
    orgao: "MCTI",
    dataset: `SIRENE, Inventário Nacional de Emissões e Remoções (${g.edicao})`,
    url: g.fonte.pagina,
    urlPrimaria: g.fonte.relatorio,
    licenca: g.fonte.licenca,
    unidade,
    frequencia: "anual (edição do inventário, que recalcula a série inteira)",
    inicio: String(g.anoInicial),
    fim: String(g.anoFinal),
    capturadoEm: g.capturadoEm,
    publicadoEm: null,
    limitacoes: g.ressalvas,
    transformacoes: extra.transformacoes,
    formula: extra.formula ?? null,
    notas: g.fonte.natureza,
    download: "/territorio/gold/emissoes.json",
  });
}

/**
 * Painel de emissões do Observatório do Território e Clima, pelo inventário oficial do MCTI (SIRENE).
 *
 * No molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), como os irmãos de desastres e queimadas: os quatro números da
 * abertura viram a faixa do kit, com natureza e prova; a série por setor (com o nível de 2005, referência da meta, marcado) vira figura do
 * kit com eixo, tabela equivalente e proveniência, seguida dos cinco setores; a balança do carbono (modelo didático) mostra o total como
 * saldo entre categorias com saldo positivo e negativo; a figura dos gases mostra CO2, metano e óxido nitroso; as categorias do último
 * ano ficam em tabelas do kit; o aviso da defasagem e do SEEG acompanha os números, e o método recolhido vai para o fim.
 */
export default function PaginaEmissoes() {
  const g = lerEmissoes();
  const ultimo = g.anos[g.anos.length - 1];
  const ref = g.anos.find((a) => a.ano === g.derivados.anoReferenciaNdc)!;
  const d = g.derivados;
  const maior = [...SETORES].sort((a, b) => ultimo.setores[b] - ultimo.setores[a])[0];
  const pico = g.anos.reduce((a, b) => (b.totalLiquido > a.totalLiquido ? b : a));
  const periodo = `${g.anoInicial} a ${g.anoFinal}`;
  const u = String(g.anoFinal);

  // balança: categorias com saldo positivo e negativo por ano (somam o total líquido publicado)
  const balanca = balancaPorAno(g);
  const balUltimo = balanca[balanca.length - 1];
  const maiorNegativo = balanca.reduce((a, b) => (b.negativo < a.negativo ? b : a));

  // gases: CO2, CH4 e N2O pelo nome; os demais (HFCs, PFCs, SF6) somados em CO2e como "gases fluorados"
  const principais = GASES_PRINCIPAIS.map((gas) => ({ gas, s: serieGas(g, gas) })).filter((x) => x.s !== undefined) as { gas: (typeof GASES_PRINCIPAIS)[number]; s: NonNullable<ReturnType<typeof serieGas>> }[];
  const fluorados = g.gases.series.filter((s) => !(GASES_PRINCIPAIS as readonly string[]).includes(s.gas));
  const co2eFluorados = (ano: string) => fluorados.reduce((soma, s) => soma + (s.totalCo2eAr5Derivado[ano] ?? 0), 0);
  const somaGases = (ano: string) => g.gases.series.reduce((soma, s) => soma + (s.totalCo2eAr5Derivado[ano] ?? 0), 0);
  const desvioGases = Math.max(...g.anos.map((a) => Math.abs(somaGases(String(a.ano)) / a.totalLiquido - 1)));
  const gasUltimo = (gas: string) => serieGas(g, gas)?.totalCo2eAr5Derivado[u] ?? null;
  const pctGas = (gas: string) => {
    const v = gasUltimo(gas);
    return v === null ? null : (100 * v) / ultimo.totalLiquido;
  };
  const gwp = (gas: string) => serieGas(g, gas)?.gwpAr5;

  // categorias do último ano: ausência fica fora, nunca vira zero
  const linhasCat = g.subsetores.filter((s) => s.valores[u] !== null && s.valores[u] !== undefined).map((s) => ({ ...s, v: s.valores[u] as number }));
  const emissoras = linhasCat.filter((l) => l.v > 0).sort((a, b) => b.v - a.v).slice(0, 10);
  const negativas = linhasCat.filter((l) => l.v < 0).sort((a, b) => a.v - b.v);
  const nPositivas = linhasCat.filter((l) => l.v > 0).length;

  const numeros: NumeroProps[] = [
    {
      rotulo: `Emissões líquidas do Brasil em ${ultimo.ano}`,
      valor: mt(ultimo.totalLiquido),
      formato: "inteiro",
      unidade: "Mt CO2e",
      periodo: String(ultimo.ano),
      fonte: FONTE_CURTA,
      natureza: "OBSERVADO",
      variacao: { valor: d.variacaoDesde2005Pct.totalLiquido, base: `sobre ${ref.ano}`, unidade: "%", casas: 1 },
      nota: "Milhões de toneladas de CO2 equivalente (GWP AR5), já descontadas as categorias com saldo negativo, como as florestas.",
    },
    {
      rotulo: `Sem uso da terra e florestas, em ${ultimo.ano}`,
      valor: mt(ultimo.totalSemLulucf),
      formato: "inteiro",
      unidade: "Mt CO2e",
      periodo: String(ultimo.ano),
      fonte: FONTE_CURTA,
      natureza: "CALCULADO",
      variacao: { valor: d.variacaoDesde2005Pct.totalSemLulucf, base: `sobre ${ref.ano}`, unidade: "%", casas: 1 },
      nota: "Energia, processos industriais, agropecuária e resíduos somados: a parte que não depende do desmatamento.",
    },
    {
      rotulo: `Setor com a maior parte do total em ${ultimo.ano}`,
      valorTexto: NOME_SETOR[maior],
      formato: "texto",
      unidade: "",
      periodo: String(ultimo.ano),
      fonte: FONTE_CURTA,
      natureza: "CALCULADO",
      tamanho: "m",
      nota: `${n(d.participacaoUltimoAnoPct[maior], 1)}% das emissões líquidas. É um saldo entre desmatamento e conversão de vegetação, de um lado, e o que a vegetação retira, de outro.`,
    },
    {
      rotulo: "Ano de maior emissão líquida na série",
      valorTexto: String(pico.ano),
      formato: "texto",
      unidade: "",
      periodo: periodo,
      fonte: FONTE_CURTA,
      natureza: "CALCULADO",
      tamanho: "m",
      nota: `${n(mt(pico.totalLiquido), 0)} Mt CO2e, puxado pelo uso da terra e florestas (${n(mt(pico.setores.lulucf), 0)} Mt naquele ano), que caiu nos anos seguintes.`,
    },
  ];

  return (
    <main className="bg-papel">
      {/* o layout do Território abre o destino do "Pular para o conteúdo" (#conteudo); o molde fica dentro deste <main> */}
      <PaginaPainel
        rota="/territorio/emissoes"
        principal={false}
        abertura={{
          acento: "obee",
          titulo: "Quanto o Brasil emite de gases de efeito estufa?",
          lead: (
            <>
              As emissões do país de {g.anoInicial} a {g.anoFinal} pelo inventário oficial do governo, por setor, categoria e gás, com {ref.ano}, ano de
              referência da meta climática, como comparação.
            </>
          ),
          recorte: {
            periodo,
            universo: "Brasil, território nacional",
            unidade: `Mt CO2e (${g.metrica})`,
            fonte: `${FONTE_CURTA}, ${g.edicao}`,
          },
          limite: `o que o país emitiu depois de ${g.anoFinal}, porque o inventário oficial chega até ${g.anoFinal}, nem se o país cumpre a meta climática, que esta página não traz.`,
        }}
        rotuloNumeros={`Emissões do Brasil em ${ultimo.ano}`}
        numeros={numeros}
        notaNumeros={
          <p className="text-carvao">
            O inventário oficial vai até {g.anoFinal} ({g.edicao}). Anos mais recentes só existem em estimativas da sociedade civil, como o SEEG, que
            aparece no{" "}
            <Link href="/agronegocio/ambiente" className="underline decoration-linha underline-offset-4">
              painel de desmatamento e emissões
            </Link>{" "}
            e não se mistura com esta série.
          </p>
        }
        figuras={
          <>
            <FiguraAnalitica
              id="serie-setores"
              pergunta={`As emissões de cada ano, de ${periodo}`}
              subtitulo={`Emissões líquidas · milhões de toneladas de CO2 equivalente (${g.metrica}) · Brasil · por setor`}
              natureza="OBSERVADO"
              proveniencia={origem(g, "Emissões líquidas de gases de efeito estufa por setor", "OBSERVADO", "Mt CO2e (GWP AR5, 100 anos)", {
                transformacoes: ["kt CO2e da fonte divididos por mil (Mt CO2e)."],
              })}
              extraFonte={<>Capturado em {dataBr(g.capturadoEm)}. Cada edição recalcula a série inteira desde {g.anoInicial}.</>}
              leitura={
                <LeituraGuiada>
                  Em {ultimo.ano}, as emissões líquidas foram {n(mt(ultimo.totalLiquido), 0)} Mt CO2e, {sinalPct(d.variacaoDesde2005Pct.totalLiquido)} sobre{" "}
                  {ref.ano}. Sem uso da terra e florestas, a variação no mesmo período foi de {sinalPct(d.variacaoDesde2005Pct.totalSemLulucf)}. A linha marca o
                  total líquido de {ref.ano}.
                </LeituraGuiada>
              }
              ressalva="Uso da terra e florestas entra como saldo do setor: o que se emite ao desmatar menos o que a vegetação retira. Os outros quatro setores não têm parte negativa."
              naoConcluir={`que o país está dentro ou fora da meta climática: a meta tem regras próprias de contabilidade que esta página não traz, e os números de uma edição do inventário não se comparam com os de outra, porque cada uma recalcula a série desde ${g.anoInicial}.`}
              tabela={{
                titulo: `Emissões líquidas por ano e setor, ${periodo}, em Mt CO2e (${g.metrica})`,
                colunas: ["Ano", "Total líquido", "Sem uso da terra", ...SETORES.map((s) => NOME_SETOR[s])],
                linhas: g.anos.map((a) => [String(a.ano), mt(a.totalLiquido), mt(a.totalSemLulucf), ...SETORES.map((s) => mt(a.setores[s]))]),
                casas: [null, 1, 1, ...SETORES.map(() => 1)],
                limite: g.anos.length,
              }}
              depois={<CincoSetores g={g} />}
            >
              <GraficoBarras
                semTabela
                titulo={`Emissões líquidas por ano e setor, ${periodo}, em milhões de toneladas de CO2 equivalente`}
                dados={g.anos.map((a) => ({ ano: String(a.ano), ...Object.fromEntries(SETORES.map((s) => [s, mt(a.setores[s])])) }))}
                chaveCategoria="ano"
                series={SETORES.map((s) => ({ id: s, rotulo: NOME_SETOR[s], cor: COR_SETOR[s] }))}
                unidade="Mt CO2e"
                casas={0}
                empilhado
                referencias={[{ valor: mt(ref.totalLiquido), rotulo: `Total líquido de ${ref.ano}, referência da meta` }]}
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="balanca"
              pergunta="O que fica acima e abaixo de zero na conta do país"
              subtitulo={`Soma das categorias do inventário com saldo positivo e com saldo negativo · Mt CO2e (${g.metrica}) · Brasil · ${periodo}`}
              natureza="CALCULADO"
              proveniencia={origem(g, "Categorias do inventário com saldo positivo e com saldo negativo, somadas por ano", "CALCULADO", "Mt CO2e (GWP AR5, 100 anos)", {
                transformacoes: [
                  "Das 34 categorias de primeiro nível do IPCC publicadas pelo inventário, soma em cada ano as que ficaram acima de zero e, à parte, as que ficaram abaixo de zero; categoria sem valor no ano fica fora dos dois lados.",
                  "As duas somas juntas reproduzem o total líquido publicado.",
                ],
                formula: "saldo positivo = Σ categorias > 0; saldo negativo = Σ categorias < 0; líquido = positivo + negativo",
              })}
              leitura={
                <LeituraGuiada>
                  Em {balUltimo.ano}, as categorias com saldo positivo somaram {n(mt(balUltimo.positivo), 1)} Mt CO2e e as com saldo negativo,{" "}
                  {n(mt(balUltimo.negativo), 1).replace(/^-/, "−")} Mt; o saldo líquido, {n(mt(balUltimo.liquido), 1)} Mt, é o total publicado. O lado negativo foi
                  maior em {maiorNegativo.ano} ({n(mt(maiorNegativo.negativo), 1).replace(/^-/, "−")} Mt).
                </LeituraGuiada>
              }
              ressalva="O lado negativo é a soma das categorias com saldo abaixo de zero (florestas e produtos florestais madeireiros), não a remoção bruta: a fonte não publica emissão e remoção separadas no uso da terra."
              naoConcluir="quanto as florestas brasileiras retiram da atmosfera ao todo: parte das remoções está dentro de categorias com saldo positivo, como pastagens, e a remoção em áreas protegidas entra pela regra de terras manejadas do IPCC."
              tabela={{
                titulo: `Categorias com saldo positivo e negativo por ano, ${periodo}, em Mt CO2e (${g.metrica})`,
                colunas: ["Ano", "Categorias com saldo positivo", "Categorias com saldo negativo", "Líquido"],
                linhas: balanca.map((a) => [String(a.ano), mt(a.positivo), mt(a.negativo), mt(a.liquido)]),
                casas: [null, 1, 1, 1],
                limite: balanca.length,
              }}
              depois={<ModeloBalanca g={g} />}
            >
              <GraficoBarras
                semTabela
                titulo={`Categorias com saldo positivo e com saldo negativo por ano, ${periodo}, em milhões de toneladas de CO2 equivalente`}
                dados={balanca.map((a) => ({ ano: String(a.ano), positivo: mt(a.positivo), negativo: mt(a.negativo) }))}
                chaveCategoria="ano"
                series={[
                  { id: "positivo", rotulo: "Categorias com saldo positivo", cor: "var(--serie-4)" },
                  { id: "negativo", rotulo: "Categorias com saldo negativo", cor: "var(--serie-comp-3)" },
                ]}
                unidade="Mt CO2e"
                casas={0}
                empilhado
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="gases"
              pergunta="Qual gás pesa mais nas emissões?"
              subtitulo={`Emissões líquidas por gás · milhões de toneladas de CO2 equivalente, convertidas pela plataforma com o ${g.metrica} · Brasil · ${periodo}`}
              natureza="CALCULADO"
              proveniencia={origem(g, "Emissões por gás em CO2 equivalente", "CALCULADO", "Mt CO2e (GWP AR5, 100 anos)", {
                transformacoes: [
                  "A fonte publica cada gás em massa do próprio gás (kt); a plataforma multiplica a massa pelo potencial de aquecimento global de 100 anos do AR5 do IPCC para pôr os gases na mesma unidade.",
                  `HFCs, PFCs e SF6 (${fluorados.length} gases) somados como gases fluorados.`,
                  `Conferência: a soma dos gases convertidos difere do total líquido publicado em no máximo ${n(100 * desvioGases, 2)}% em qualquer ano.`,
                ],
                formula: `CO2e do gás = massa do gás × GWP AR5 (CO2 = 1, CH4 = ${gwp("CH4") ?? "sem dado"}, N2O = ${gwp("N2O") ?? "sem dado"})`,
              })}
              complementares={[
                {
                  rotulo: "Sobre a massa de cada gás",
                  p: origem(g, "Emissões líquidas por gás, em massa do próprio gás", "OBSERVADO", "kt do gás"),
                },
              ]}
              leitura={
                <LeituraGuiada>
                  Em {ultimo.ano}, convertidos pelo {g.metrica}, o gás carbônico respondeu por {pctGas("CO2") === null ? "sem dado" : `${n(pctGas("CO2") as number, 0)}%`} das emissões
                  líquidas, o metano por {pctGas("CH4") === null ? "sem dado" : `${n(pctGas("CH4") as number, 0)}%`} e o óxido nitroso por{" "}
                  {pctGas("N2O") === null ? "sem dado" : `${n(pctGas("N2O") as number, 0)}%`}. O gás carbônico inclui o saldo do uso da terra e oscila com o
                  desmatamento.
                </LeituraGuiada>
              }
              ressalva={`A fonte não publica CO2 equivalente por gás: a conversão é da plataforma. Em massa, uma tonelada de metano não é comparável a uma de gás carbônico; a tabela traz as duas unidades. Com outra métrica (GTP), o peso do metano seria bem menor.`}
              naoConcluir="qual gás é mais importante para o clima em qualquer horizonte: o peso de cada gás depende da métrica e do horizonte escolhidos (o metano fica pouco tempo na atmosfera e esquenta muito nesse tempo), e o gás carbônico aqui já vem descontado das categorias com saldo negativo."
              tabela={{
                titulo: `Emissões líquidas por gás, ${periodo}: massa de cada gás (mil toneladas do gás) e CO2 equivalente (Mt CO2e, ${g.metrica})`,
                colunas: [
                  "Ano",
                  ...principais.map((x) => `${x.gas}, mil t de ${x.gas}`),
                  ...principais.map((x) => `${x.gas}, Mt CO2e`),
                  "Gases fluorados, Mt CO2e",
                ],
                linhas: g.anos.map((a) => {
                  const ano = String(a.ano);
                  return [
                    ano,
                    ...principais.map((x) => x.s.total[ano] ?? null),
                    ...principais.map((x) => (x.s.totalCo2eAr5Derivado[ano] === undefined ? null : mt(x.s.totalCo2eAr5Derivado[ano]))),
                    mt(co2eFluorados(ano)),
                  ];
                }),
                casas: [null, ...principais.map(() => 1), ...principais.map(() => 1), 1],
                limite: g.anos.length,
              }}
            >
              <GraficoLinhas
                semTabela
                titulo={`Emissões líquidas por gás, ${periodo}, em milhões de toneladas de CO2 equivalente (${g.metrica}, conversão da plataforma)`}
                dados={g.anos.map((a) => {
                  const ano = String(a.ano);
                  return {
                    ano,
                    ...Object.fromEntries(principais.map((x) => [x.gas, x.s.totalCo2eAr5Derivado[ano] === undefined ? null : mt(x.s.totalCo2eAr5Derivado[ano])])),
                    fluorados: mt(co2eFluorados(ano)),
                  };
                })}
                chaveX="ano"
                formatoX="texto"
                series={[
                  ...principais.map((x, i) => ({ id: x.gas, rotulo: NOME_GAS[x.gas], sigla: x.gas, cor: COR_GAS[i] })),
                  { id: "fluorados", rotulo: "Gases fluorados (HFCs, PFCs e SF6)", sigla: "Fluorados", cor: COR_GAS[3] },
                ]}
                unidade="Mt CO2e"
                casas={0}
                zeroNoEixo
                rotulosDiretos
                marcos={[{ x: String(ref.ano), rotulo: `${ref.ano}, referência da meta` }]}
              />
            </FiguraAnalitica>
          </>
        }
        tabelas={
          <>
            <TabelaDados
              id="categorias-fontes"
              recolhida={false}
              tituloVisivel={`As dez maiores categorias em ${g.anoFinal}`}
              lead={
                <>
                  Categorias de primeiro nível do IPCC com saldo positivo, dez das {nPositivas} que ficaram acima de zero. Campo e pastagem e agricultura aparecem no uso da
                  terra; o metano da digestão do gado (fermentação entérica), na agropecuária; a queima de combustíveis, na energia.
                </>
              }
              titulo={`As dez maiores categorias com saldo positivo em ${g.anoFinal}, em Mt CO2e (${g.metrica})`}
              colunas={["Categoria do inventário", "Setor", "Mt CO2e"]}
              linhas={emissoras.map((l) => [`${l.codigo} ${l.nome}`, NOME_SETOR[l.setor], mt(l.v)])}
              casas={[null, null, 1]}
              limite={emissoras.length}
              nota={<>{g.fonte.nome}. As demais categorias estão no arquivo de dados do painel.</>}
            />
            <TabelaDados
              id="categorias-negativas"
              recolhida={false}
              tituloVisivel={`As categorias com saldo negativo em ${g.anoFinal}`}
              lead={<>Categorias em que o inventário registrou mais retirada da atmosfera do que emissão. São saldos, não a remoção bruta.</>}
              titulo={`Categorias com saldo negativo em ${g.anoFinal}, em Mt CO2e (${g.metrica})`}
              colunas={["Categoria do inventário", "Setor", "Mt CO2e"]}
              linhas={negativas.map((l) => [`${l.codigo} ${l.nome}`, NOME_SETOR[l.setor], mt(l.v)])}
              casas={[null, null, 1]}
              limite={negativas.length}
              nota={<>{g.fonte.nome}.</>}
            />
          </>
        }
        metodo={
          <>
            <p>
              Fonte: {g.fonte.nome} (<a href={g.fonte.pagina} className="underline decoration-linha underline-offset-4">página do SIRENE</a>). {g.fonte.natureza} {g.fonte.licenca}
            </p>
            <p>
              Unidade: {g.unidade}, métrica {g.metrica}; a página mostra milhões de toneladas (Mt). O total líquido pelas métricas alternativas publicadas pela fonte em{" "}
              {g.anoFinal}: {Object.values(g.metricasAlternativas).map((m) => `${m.nome}, ${n(mt(m.totalLiquido[String(g.anoFinal)]), 0)} Mt`).join("; ")}.
            </p>
            <p>
              Gases: a fonte publica cada gás em massa do próprio gás ({g.gases.unidade}). O CO2 equivalente por gás da figura é a massa multiplicada pelo GWP AR5 de
              100 anos; a soma dos gases convertidos difere do total publicado em no máximo {n(100 * desvioGases, 2)}% em qualquer ano.
            </p>
            <p>
              Balança: as {g.subsetores.length} categorias de primeiro nível do IPCC somam o total líquido; o lado negativo é a soma das que ficaram abaixo de zero no ano.
            </p>
            <ul className="list-disc space-y-2 pl-5">{g.ressalvas.map((r) => <li key={r}>{r}</li>)}</ul>
            <p>
              Diferença para o SEEG: as duas fontes usam a mesma métrica, mas dados de atividade e regras diferentes para o uso da terra. Na consulta de 18/10/2026, o
              total líquido do SEEG ficava 1,8% acima do inventário em 2022 e 5,1% abaixo em 2005. As séries não se somam nem se emendam.
            </p>
            <p>
              Captura em {dataBr(g.capturadoEm)}; {g.originais.length} planilhas oficiais, cada uma com sha256 e tamanho registrados. Os setores somam o total e cada
              planilha setorial confere com o total Brasil antes da publicação.
            </p>
            <p>
              <a href="/territorio/gold/emissoes.json" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">
                Baixar os dados deste painel (JSON)
              </a>
            </p>
          </>
        }
      />
    </main>
  );
}
