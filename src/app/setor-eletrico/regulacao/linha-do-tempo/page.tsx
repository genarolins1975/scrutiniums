import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { RegulacaoLinhaTempo } from "@/components/energia/RegulacaoLinhaTempo";
import { RegulacaoDatas, RegulacaoIndisponivel, RegulacaoNavegacao, RegulacaoRecorte } from "@/components/energia/RegulacaoPagina";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  FILTRO_LINHA_TEMPO_PADRAO,
  ROTULO_NIVEL_EVENTO,
  contagemPaineisAfetados,
  contagemPorOrigem,
  defasagemDias,
  downloadsDoPainel,
  filtrarLinhaTempo,
  origemEvento,
  perguntaPainel,
  proximoPainel,
  respostaLinhaTempo,
  rotaPainel,
  rotuloCurtoEvento,
  rotuloDownload,
  vereditoLinhaTempo,
} from "@/lib/energia/regulacao";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { GoldRegulacao } from "@/lib/energia/tipos-regulacao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Regulação: linha do tempo das mudanças de regra no setor elétrico",
  description:
    "Atos, leis e mudanças das bandeiras tarifárias com a data de publicação separada do início de vigência, o dispositivo de origem, o efeito declarado pelo próprio ato e os painéis ligados, sem estimar impacto nem sugerir causa.",
  alternates: { canonical: rotaPainel("p045") },
};

const COLUNAS_PUBLICACAO: ColunaTabela[] = [
  { id: "ato", rotulo: "Ato", tipo: "texto" },
  { id: "data_publicacao", rotulo: "Publicação na gold", tipo: "data" },
  { id: "resultado", rotulo: "Conferência", tipo: "texto", categorica: true },
  { id: "detalhe", rotulo: "Como foi conferida", tipo: "texto" },
  { id: "fonte", rotulo: "Fonte da conferência", tipo: "texto" },
];

export default function LinhaDoTempoPage() {
  const g = lerGold<GoldRegulacao>("regulacao.json");
  if (!integra(g)) return <RegulacaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const T = g.linha_do_tempo;
  // a mesma ordem do recorte padrão do componente (vigência mais recente primeiro), para que
  // "o evento mais recente" da resposta e do "O que mudou" não dependa da ordem do arquivo
  const eventos = filtrarLinhaTempo(T.eventos, FILTRO_LINHA_TEMPO_PADRAO).eventos;
  const vigencias = eventos.map((e) => e.vigencia_inicio).sort();
  const { atos, registros } = contagemPorOrigem(eventos);
  const quem = contagemPaineisAfetados(eventos);
  const comDefasagem = eventos
    .filter((e) => origemEvento(e) === "ato")
    .map((e) => ({ id: e.id, rotulo: rotuloCurtoEvento(e), dias: defasagemDias(e) }))
    .filter((x) => x.dias !== null);
  const semPublicacao = eventos.filter((e) => origemEvento(e) === "ato" && !e.data_publicacao);
  const proximo = proximoPainel("p045");
  const versao = T.conferido_em;
  const fonte = "ANEEL, Congresso Nacional, Presidência da República e MME (atos lidos no texto) e ANEEL, Bandeiras Tarifárias";

  const oQueMudou = (
    <>
      O evento mais recente é &ldquo;{eventos[0]?.titulo}&rdquo;, com vigência a partir de {dataBR(eventos[0]?.vigencia_inicio ?? null)}. A lista foi conferida em {dataBR(T.conferido_em)} e não
      inclui o que foi publicado depois disso. É uma seleção editorial de marcos que mudam a leitura dos painéis, não um repositório de todos os atos.
    </>
  );
  const comoInterpretar = (
    <>
      O círculo vazado é a publicação no Diário Oficial; o cheio, o início de vigência; o traço entre eles é a espera até a regra valer. O resumo é texto do observatório, conferido no
      documento; o efeito declarado, que está em Analisar, é o que o ato diz de si mesmo, citado literalmente; o impacto estimado fica vazio. Os painéis ligados são aqueles em que a regra
      muda a leitura do número; a ligação vem da curadoria do ato, não de estimativa de efeito. Filtre por painel ligado ou por origem para separar atos lidos de registros do conjunto de
      dados; em Analisar, o período vale para a data que você escolher (publicação ou vigência), e eventos sem essa data ficam fora do recorte, com a contagem dita.
    </>
  );
  const naoConcluir = (
    <>
      Uma data desta lista perto de um movimento num gráfico não é evidência de causa. O observatório não estima o efeito das normas aqui, nem quanto uma norma mudou a conta de alguém, e
      os resumos não são parecer jurídico. A ausência de um ato aqui não quer dizer que nada mudou: a lista não é completa. Eventos de bandeira vêm do conjunto de dados da ANEEL, sem
      leitura do ato nem data de publicação.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="regulacao" />
      <MarcaVisita secao="energia:regulacao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <RegulacaoNavegacao atual="p045" />
        <CabecalhoModulo
          rotulo="Regulação"
          siglas={["PLD", "REN", "REH", "DOU", "CDE", "PRODIST", "ANEEL", "MME"]}
          titulo={perguntaPainel("p045")}
          lead="Os atos e as leis que mudam a leitura dos painéis do observatório, cada um com a data de publicação separada da data em que passou a valer."
          recorte={`${eventos.length} eventos · vigências de ${vigencias.length ? dataBR(vigencias[0]) : "sem eventos"} a ${vigencias.length ? dataBR(vigencias[vigencias.length - 1]) : "sem eventos"} · seleção conferida em ${dataBR(T.conferido_em)}`}
          fonte="ANEEL, Congresso Nacional, Presidência da República e MME, Ministério de Minas e Energia (atos lidos no texto)"
          referencia={
            <>
              Atos lidos no texto e conferidos em {dataBR(T.conferido_em)}; bandeiras do conjunto de dados da ANEEL; processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <RegulacaoDatas
              itens={[
                { rotulo: "Atos e leis", texto: `lidos no texto e conferidos em ${dataBR(T.conferido_em)}`, natureza: "OBSERVADO" },
                { rotulo: "Registros de bandeiras", texto: `conjunto de dados da ANEEL gerado em ${dataBR(g.bandeiras.gerado_pela_fonte_em)}`, natureza: "OBSERVADO" },
              ]}
            />
          }
        >
          O que mudou nas regras que os painéis do observatório usam, desde quando vale e em quais painéis a leitura muda. Cada ato traz a data em que passou a valer, o resumo do observatório e
          os painéis ligados; a data de publicação no Diário Oficial, o dispositivo, o efeito que o próprio ato declara e as conferências estão em Analisar.
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="linha-do-tempo">
            <PainelEvidencia
              id="p045"
              pergunta="Publicação e início da vigência de cada evento"
              subtitulo="Atos, leis e registros de bandeiras com data de publicação e de vigência, resumo e painéis ligados · data"
              natureza="OBSERVADO"
              porQueImporta={
                <>
                  Uma série muda de leitura quando a regra muda: a Tarifa Social, o cálculo das perdas, o PLD horário e as bandeiras alteram o que um número significa. Saber a data
                  exata em que a regra passou a valer evita atribuir à norma o que aconteceu antes dela, ou o contrário.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.linha_do_tempo}
              complementares={[{ rotulo: "Adicionais das bandeiras tarifárias", p: g.proveniencia.bandeiras }]}
            >
              <div className="space-y-6">
                <RespostaCurta id="p045" veredito={vereditoLinhaTempo(eventos, eventos.length, "vigencia", T.conferido_em)}>
                  {respostaLinhaTempo(eventos, eventos.length)}
                </RespostaCurta>

                <RegulacaoLinhaTempo
                  eventos={eventos}
                  paineis={T.paineis}
                  fonte={fonte}
                  versao={versao}
                  recorte={
                    <RegulacaoRecorte
                      periodo={vigencias.length ? `vigências de ${dataBR(vigencias[0])} a ${dataBR(vigencias[vigencias.length - 1])}` : "sem eventos"}
                      universo={`${eventos.length} eventos: ${atos} atos e leis lidos no texto e ${registros} registros do conjunto de dados de bandeiras`}
                      unidade="evento datado (publicação e início de vigência)"
                    />
                  }
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                />

                <SecaoDoPainel
                  id="defasagem"
                  titulo="Quanto tempo passa entre a publicação e a vigência?"
                  lead={
                    <>
                      Dias entre a publicação no Diário Oficial e o início de vigência de cada ato lido. Zero é vigência na data da publicação.
                      {semPublicacao.length
                        ? ` ${semPublicacao.length === 1 ? "Fica de fora 1 ato" : `Ficam de fora ${semPublicacao.length} atos`} sem data de publicação conferida (${semPublicacao.map((e) => e.ato ?? e.titulo).join("; ")}).`
                        : ""}
                    </>
                  }
                >
                  <GraficoBarras
                    titulo="Dias entre publicação e vigência, por ato"
                    dados={comDefasagem}
                    chaveCategoria="id"
                    chaveRotulo="rotulo"
                    series={[{ id: "dias", rotulo: "Dias até a vigência", cor: "var(--cor-energia-dark)" }]}
                    unidade="dias"
                    casas={0}
                    orientacao="horizontal"
                    rotulosValor
                  />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="quem-e-afetado"
                  titulo="Em que painéis a leitura muda?"
                  lead="Um evento pode estar ligado a mais de um painel, por isso a soma das barras passa do número de eventos. Os painéis vêm da curadoria de cada ato, não de inferência sobre efeito."
                >
                  <GraficoBarras
                    titulo="Eventos da linha do tempo por painel ligado"
                    dados={quem.map((q) => ({ id: q.href, rotulo: q.rotulo, n: q.n }))}
                    chaveCategoria="id"
                    chaveRotulo="rotulo"
                    series={[{ id: "n", rotulo: "Eventos", cor: "var(--cor-energia)" }]}
                    unidade="eventos"
                    casas={0}
                    orientacao="horizontal"
                    rotulosValor
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="conferencia-publicacao" nivel="auditar" titulo="Data de publicação conferida por caminho independente">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    Leis e medida provisória: data da publicação original nos metadados abertos do Senado. Atos da ANEEL: data escrita no próprio PDF guardado. Divergência reprova a
                    publicação da gold.
                  </p>
                  <TabelaInterativa
                    titulo="Conferência da data de publicação dos atos lidos"
                    colunas={COLUNAS_PUBLICACAO}
                    linhas={eventos
                      .filter((e) => origemEvento(e) === "ato")
                      .map((e) => ({
                        id: e.id,
                        ato: e.ato ?? e.titulo,
                        data_publicacao: e.data_publicacao,
                        resultado: e.conferencia_publicacao ? (e.conferencia_publicacao.resultado === "aprovado" ? "aprovada" : e.conferencia_publicacao.resultado) : "sem conferência",
                        detalhe: e.conferencia_publicacao?.detalhe ?? (e.data_publicacao ? null : "sem data de publicação: nada a conferir"),
                        fonte: e.conferencia_publicacao?.fonte ?? null,
                      }))}
                    chaveLinha="id"
                    colunaRotulo="ato"
                    fonte="Senado Federal (metadados abertos) e ANEEL (texto dos atos)"
                    versao={versao}
                    nomeArquivo="regulacao-conferencia-publicacao"
                    chaveUrl="pub"
                  />
                  <ul className="space-y-1 text-sm text-carvao-muted">
                    {Object.entries(
                      eventos.reduce<Record<string, number>>((acc, e) => {
                        const k = ROTULO_NIVEL_EVENTO[e.nivel_conferencia] ?? e.nivel_conferencia;
                        acc[k] = (acc[k] ?? 0) + 1;
                        return acc;
                      }, {}),
                    ).map(([k, n]) => (
                      <li key={k}>
                        {k.charAt(0).toUpperCase() + k.slice(1)}: {n} {n === 1 ? "evento" : "eventos"}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm leading-relaxed text-carvao-muted">{T.nota}</p>
                </SecaoDoPainel>

                <SeguirPainel
                  ancora="p045"
                  proximo={{ href: `${proximo.rota}#${proximo.id}`, pergunta: proximo.pergunta }}
                  downloads={downloadsDoPainel(g, "p045").map((d) => ({ ...d, rotulo: rotuloDownload(d.rotulo) }))}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
