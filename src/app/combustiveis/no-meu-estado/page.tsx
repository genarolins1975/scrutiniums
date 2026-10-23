import type { Metadata } from "next";
import { AvisoConsultaAberta } from "@/components/acesso/AvisoConsultaAberta";
import { ConviteAperitivo } from "@/components/acesso/ConviteAperitivo";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { FaixaTanque, SeletorTanque } from "@/components/combustiveis/ConsultaTanque";
import { FiguraAnalitica, GraficoBarras, LeituraGuiada, PaginaPainel } from "@/components/painel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, mesAno, mesExtenso } from "@/lib/gas/formato";
import { fontesPorId } from "@/lib/gas/gold";
import { dadosDoEstado, dataNota, goldCombustiveis } from "@/lib/combustiveis/dados";
import { ROTA_COMBUSTIVEIS, paginaCombustiveis } from "@/lib/combustiveis/paginas";
import { provenienciaMontada } from "@/lib/painel/proveniencia-montada";
import { leva2Aprovada } from "@/lib/rotasPublicas";

export const dynamic = "force-static";

const pagina = paginaCombustiveis("no-meu-estado");

export const metadata: Metadata = {
  title: "Quanto custa encher o tanque no meu estado?",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

const FONTE = "ANP, Levantamento de Preços de Combustíveis";

/**
 * Consulta "Quanto custa encher o tanque no meu estado?" (leva 2 da estratégia "aberto e com conta", item
 * quanto-custa-encher-o-tanque de src/lib/rotasPublicas.ts). Modo de consulta: o preço médio do litro de cada combustível
 * na UF escolhida, no último mês, com fonte, data e a distância para a média do Brasil. Os dados do último mês vão no HTML
 * (nenhum arquivo é buscado no navegador). A série desde 2013, a comparação entre as UFs, o etanol em % da gasolina e os
 * downloads ficam no painel /combustiveis. Enquanto o dono não aprova, a rota é fechada como os painéis e a faixa de
 * consulta aberta não aparece.
 *
 * No molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o seletor de estado e os litros são a primeira ação da
 * abertura, o resultado é a faixa de números (uma ilha de cliente que lê o mesmo `?uf=`), e a figura mostra a referência de
 * todo estado, a média do Brasil com o menor e o maior preço da pesquisa. A comparação entre as UFs continua só no painel.
 */
export default function ConsultaTanquePagina() {
  const aberta = leva2Aprovada("quanto-custa-encher-o-tanque");
  const g = goldCombustiveis();
  const lacuna = g.pesquisa.eventos.find((e) => e.tipo === "sem_pesquisa");
  const dados = dadosDoEstado(g);
  const mes = mesExtenso(g.ultimo_mes);
  const [fonteBrasil] = fontesPorId(["anp_precos_brasil"]);
  const linhasBrasil = dados.produtos.map((p) => ({ x: p.id, rotulo: p.nome, minimo: dados.brasil[p.id].minimo, medio: dados.brasil[p.id].medio, maximo: dados.brasil[p.id].maximo }));
  const ressalva = (
    <>
      São médias de uma amostra de postos pesquisados pela ANP no mês, não o preço de um posto. A média do Brasil é calculada pela própria ANP.
      {lacuna && <> A pesquisa teve lacuna de {dataNota(lacuna.inicio)} a {dataNota(lacuna.fim)}, registrada no painel.</>}
    </>
  );
  return (
    <>
      <MarcaVisita secao={pagina.secao} />
      <header>
        {/* a gold é do pipeline do Gás: as fontes do "Citar" e do "Avisar" são as dele */}
        <CabecalhoPlataforma observatorio="energia-e-infraestrutura" destinoConta="/combustiveis" fontes={["gas"]} />
        <NavegacaoColecao colecao="combustiveis" />
      </header>
      {aberta && (
        <AvisoConsultaAberta
          className="ed-pagina"
          comConta="A série mensal desde 2013, a comparação entre os estados, o etanol em porcentagem da gasolina e os arquivos para baixar"
        />
      )}
      <PaginaPainel
        rota={pagina.href}
        abertura={{
          acento: "gas",
          titulo: pagina.pergunta,
          lead: <>Escolha o estado para ver o preço médio do litro de gasolina, etanol e diesel em {mes}, comparado com a média do Brasil.</>,
          acao: <SeletorTanque dados={dados} />,
          recorte: {
            periodo: mes,
            universo: `${dados.ufs.length} unidades da federação e o Brasil`,
            unidade: "R$ por litro",
            fonte: `${FONTE}, série mensal por estado e Brasil`,
          },
          limite: "o preço que você vai pagar num posto, porque é a média da amostra de postos que a ANP pesquisou no mês; a conta do tanque é essa média vezes os litros escolhidos.",
        }}
        rotuloNumeros={`Preço médio do litro de cada combustível, ${mes}`}
        faixaNumeros={<FaixaTanque dados={dados} />}
        figuras={
          <FiguraAnalitica
            id="brasil"
            pergunta={`A referência de todo estado: o litro no Brasil em ${mes}`}
            subtitulo="Menor preço, preço médio e maior preço da pesquisa, por combustível · R$ por litro · Brasil, postos pesquisados no mês"
            natureza="OBSERVADO"
            proveniencia={provenienciaMontada({
              indicador: "Preço de revenda dos combustíveis no Brasil: médio, menor e maior da pesquisa",
              natureza: "OBSERVADO",
              orgao: "ANP",
              dataset: fonteBrasil?.conjunto ?? "Levantamento de Preços de Combustíveis",
              url: fonteBrasil?.pagina ?? "https://www.gov.br/anp",
              urlPrimaria: fonteBrasil?.url ?? undefined,
              licenca: fonteBrasil?.licenca,
              unidade: "R$ por litro",
              frequencia: "mensal",
              inicio: g.ultimo_mes,
              fim: g.ultimo_mes,
              coberturaInicio: g.primeiro_mes,
              coberturaFim: g.ultimo_mes,
              capturadoEm: g.dados_capturados_em,
              sha256: fonteBrasil?.sha256_original ?? null,
              versaoPipeline: g.versao_pipeline,
              versaoCodigo: g.versao_codigo,
              limitacoes: ["Médias de uma amostra de postos pesquisados pela ANP no mês, não o preço de um posto.", ...(lacuna ? [`A pesquisa teve lacuna de ${dataNota(lacuna.inicio)} a ${dataNota(lacuna.fim)}.`] : [])],
              notas: fonteBrasil?.nota ?? null,
            })}
            leitura={<LeituraGuiada>A média do Brasil, ao lado de cada estado na faixa acima, é a referência da distância &quot;acima&quot; ou &quot;abaixo&quot;; o menor e o maior são os extremos dos postos pesquisados no mês.</LeituraGuiada>}
            ressalva={ressalva}
            naoConcluir="o preço típico de um posto nem a posição do seu estado: o menor e o maior são extremos da amostra de postos, não uma faixa comum, e a comparação entre os estados fica no painel com conta."
            tabela={{
              titulo: `Preço do litro no Brasil, ${mes}: menor, médio e maior da pesquisa (R$ por litro)`,
              colunas: ["Combustível", "Menor preço (R$/l)", "Preço médio (R$/l)", "Maior preço (R$/l)", "Postos pesquisados"],
              linhas: dados.produtos.map((p) => [p.nome, dados.brasil[p.id].minimo, dados.brasil[p.id].medio, dados.brasil[p.id].maximo, dados.brasil[p.id].postos]),
              casas: [null, 2, 2, 2, 0],
            }}
            depois={
              // princípio do aperitivo: a página aberta sempre mostra o que o painel com conta tem a mais
              <ConviteAperitivo
                rota={ROTA_COMBUSTIVEIS}
                comConta={[
                  `O preço do litro mês a mês desde ${mesExtenso(g.primeiro_mes)}, em valores da época e corrigidos pela inflação`,
                  `As ${dados.ufs.length} unidades da federação lado a lado, para comparar com a sua`,
                  "Quanto o litro de etanol custa em relação ao de gasolina, em cada estado",
                  "Como a ANP mede o preço, quantos postos entram na pesquisa a cada mês e onde ela tem lacunas",
                  "O método, as notas da planilha e os arquivos para baixar",
                ]}
              />
            }
          >
            <GraficoBarras
              semTabela
              titulo={`Preço do litro no Brasil, ${mes}: menor, médio e maior da pesquisa`}
              dados={linhasBrasil}
              chaveCategoria="x"
              chaveRotulo="rotulo"
              series={[
                { id: "minimo", rotulo: "Menor preço", cor: "var(--serie-2)" },
                { id: "medio", rotulo: "Preço médio", cor: "var(--cor-gas)" },
                { id: "maximo", rotulo: "Maior preço", cor: "var(--serie-3)" },
              ]}
              unidade="R$/l"
              casas={2}
            />
          </FiguraAnalitica>
        }
        metodo={
          <>
            <p>
              Fonte: {FONTE}, série mensal por estado e Brasil, mês de referência {mes} ({mesAno(g.ultimo_mes)}). Dados capturados em {carimbo(g.dados_capturados_em)}.
            </p>
            <p>{ressalva}</p>
            <p>
              Os números desta consulta são lidos da gold do pipeline do Gás, sem cálculo na página: o preço médio, os postos e a distância para a média do Brasil vêm da ANP; a
              conta do tanque é o preço médio vezes os litros escolhidos. A série completa, a comparação entre os estados e os arquivos para baixar estão no painel com conta.
            </p>
          </>
        }
      />
    </>
  );
}
