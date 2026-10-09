import type { Metadata } from "next";
import { AvaliacaoPaginas } from "@/components/energia/AvaliacaoPaginas";
import { AvaliacaoEvolucao, AvaliacaoJornadas, AvaliacaoMatriz, AvaliacaoMetodo, AvaliacaoRevisao, AvaliacaoRubrica } from "@/components/energia/AvaliacaoPartes";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import {
  DadosAnalise,
  DadosAuditoria,
  DadosAviso,
  DadosIndisponivel,
  DadosLimitacoes,
  DadosNavegacao,
  DadosRecorte,
  DadosResposta,
  DadosSeguir,
  ReferenciaDados,
} from "@/components/energia/DadosPainel";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { COLUNAS_DEFEITOS, URL_AVALIACAO, compararRodadas, dadosPorDimensao, linhasDefeitos, linhasPaginas, respostaAvaliacao } from "@/lib/energia/avaliacao";
import { avaliacaoPublicada, provenienciaAvaliacao } from "@/lib/energia/avaliacao-servidor";
import { dataBR, num, plural } from "@/lib/energia/formato";

export const dynamic = "force-static";

const ENDERECO = "https://scrutiniums.com/setor-eletrico/metodologia/avaliacao#avaliacao";

export const metadata: Metadata = {
  title: "Avaliação dos painéis: como demonstrar que a qualidade evoluiu",
  description:
    "Nota de cada página do observatório em dez dimensões, com a evidência de cada nota, as jornadas de usuário executadas, os defeitos abertos e a evolução entre rodadas. Nota só existe com medição, teste ou revisão registrada.",
  alternates: { canonical: "/setor-eletrico/metodologia/avaliacao" },
};

export default function AvaliacaoPage() {
  const a = avaliacaoPublicada();
  if (!a)
    return (
      <DadosIndisponivel
        atual="metodologia"
        motivo="A avaliação dos painéis (P071) ainda não foi publicada nesta versão: sem o arquivo avaliacao.json não há nota, e a página não mostra nenhuma."
      />
    );

  const r = a.resumo;
  const prov = provenienciaAvaliacao(a.proveniencia.avaliacao);
  const dims = dadosPorDimensao(a);
  const linhas = linhasPaginas(a);
  const defeitos = linhasDefeitos(a.defeitos);
  const cmp = compararRodadas(a);
  const versao = a.gerado_em;
  const semNota = Object.values(r.por_dimensao).reduce((s, d) => s + d.nao_avaliadas, 0);

  return (
    <>
      <CabecalhoEnergia atual="metodologia" />
      <MarcaVisita secao="energia:dados:avaliacao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          rotulo="Dados e metodologia"
          titulo="Como demonstrar que a qualidade evoluiu?"
          referencia={
            <ReferenciaDados
              geradoEm={a.gerado_em}
              referencia={dataBR(a.rodada.data_inspecao)}
              extra={<>Rodada {a.rodada.id}; dados de referência das golds em {dataBR(a.rodada.referencia_dos_dados)}.</>}
            />
          }
        >
          Cada página do observatório recebe uma nota de 0 a 10 em dez dimensões, e cada nota traz a medição, o teste ou a revisão que a sustenta. O que não foi testado aparece como não avaliado, nunca como nota. A escala é uma ferramenta de revisão do próprio observatório, não uma certificação externa, e a data
          de referência é a da inspeção, não a do dia em que você lê.
        </CabecalhoModulo>
        <DadosNavegacao atual="avaliacao" />

        <ModoProfundidade>
          <Bloco id="avaliacao">
            <PainelEvidencia
              id="painel-avaliacao"
              pergunta="Como demonstrar que a qualidade evoluiu?"
              subtitulo={`${num(r.paginas, 0)} páginas · rodada ${a.rodada.id} · nota de 0 a 10 por dimensão · inspeção de ${dataBR(a.rodada.data_inspecao)}`}
              proveniencia={prov}
              porQueImporta={
                <>
                  Sem uma régua publicada, qualidade vira adjetivo. Aqui cada nota nasce de uma medição em navegador, de um teste do repositório, de uma validação já publicada nas golds ou de uma revisão registrada, e a rubrica que a calcula está aberta. Quem compara duas rodadas vê o que mudou e o que
                  ficou sem teste.
                </>
              }
              oQueMudou={
                cmp ? (
                  <>
                    Rodada anterior ({cmp.anterior.id}): {plural(cmp.anterior.atendem_meta, "página dentro", "páginas dentro")} da meta e {plural(Object.values(cmp.anterior.defeitos_por_severidade).reduce((s, v) => s + v, 0), "defeito aberto", "defeitos abertos")}. Nas {cmp.comuns.length} dimensões avaliadas nas duas rodadas a média foi de {num(cmp.mediaAnterior, 1)} para {num(cmp.mediaAtual, 1)}; {plural(r.defeitos.corrigidos_desde_a_rodada_anterior, "defeito foi corrigido", "defeitos foram corrigidos")} desde então.
                  </>
                ) : (
                  <>Primeira rodada registrada: ainda não há rodada anterior, e a evolução começa a ser medida a partir desta.</>
                )
              }
              comoInterpretar={
                <>
                  Cada célula da matriz é a média das notas das páginas da entrega naquela dimensão. A meta de produto é 9,0 em todas as dimensões, 9,5 em didatismo e qualidade visual, e nenhum defeito crítico; uma página só atende se nenhuma dimensão aplicável ficar sem avaliação. Célula sem número é
                  dimensão não avaliada ou que não se aplica, e não é zero. Cada nota tem tetos escritos: o teto de acessibilidade, por exemplo, existe porque nenhum leitor de tela real foi usado.
                </>
              }
              naoConcluir={
                <>
                  Que uma nota alta prove que uma pessoa entende ou confia na página: a revisão visual e didática é de revisores em contexto limpo (agentes), e as jornadas são roteiros por script, sem participante humano. Que a nota de uma página amostrada valha para as outras da família. Que acessibilidade
                  esteja certificada, ou que o desempenho de laboratório seja o de campo. Que a correção dos números tenha sido reconciliada de novo com a fonte primária nesta rodada: ela vem das validações já publicadas.
                </>
              }
              extraFonte={<>Rubrica {a.versao_rubrica}.</>}
            >
              <DadosResposta
                painel="P071"
                prova={
                  <>
                    <ComproveNumero evidencia={a.evidencias.nota_media} rotulo="Comprove a nota média" endereco={ENDERECO} />
                    <ComproveNumero evidencia={a.evidencias.atendem_meta} rotulo="Comprove as páginas na meta" endereco={ENDERECO} />
                    <ComproveNumero evidencia={a.evidencias.defeitos} rotulo="Comprove os defeitos" endereco={ENDERECO} />
                  </>
                }
              >
                {respostaAvaliacao(a)}
              </DadosResposta>

              <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Numero rotulo="Nota ponderada média" natureza="CALCULADO" evidencia={a.evidencias.nota_media} valor={r.nota_ponderada_media} casas={1} unidade="de 10" tamanho="medio" periodo={dataBR(a.rodada.data_inspecao)} nota={<>média das {num(r.paginas, 0)} páginas</>} motivoAusencia="Nenhuma página com nota." endereco={ENDERECO} />
                <Numero rotulo="Páginas na meta de produto" natureza="CALCULADO" evidencia={a.evidencias.atendem_meta} valor={r.atendem_meta} casas={0} unidade={`de ${num(r.paginas, 0)}`} tamanho="medio" periodo={dataBR(a.rodada.data_inspecao)} nota={<>{num(r.completas, 0)} com todas as dimensões aplicáveis avaliadas</>} endereco={ENDERECO} />
                <Numero rotulo="Defeitos abertos" natureza="CALCULADO" evidencia={a.evidencias.defeitos} valor={r.defeitos.abertos} casas={0} unidade="defeitos" tamanho="medio" periodo={dataBR(a.rodada.data_inspecao)} nota={<>{r.defeitos.por_severidade.critico} críticos, {r.defeitos.por_severidade.alto} altos</>} endereco={ENDERECO} />
                <Numero rotulo="Jornadas cumpridas" natureza="OBSERVADO" valor={r.jornadas.cumpridas} casas={0} unidade={`de ${num(r.jornadas.total, 0)}`} tamanho="medio" periodo={dataBR(a.rodada.data_inspecao)} nota={<>roteiro por script, sem pessoas</>} endereco={ENDERECO} />
              </div>
              <DadosRecorte
                periodo={<>inspeção de {dataBR(a.rodada.data_inspecao)}; golds com referência em {dataBR(a.rodada.referencia_dos_dados)}</>}
                universo={`${num(r.paginas, 0)} de ${a.rodada.rotas_construidas === null ? "número não registrado de" : num(a.rodada.rotas_construidas, 0)} rotas construídas: todas as páginas de módulo e uma amostra de seis em cada família dinâmica (verbetes, fichas de conjuntos e de empresas)`}
                unidade="nota de 0 a 10, truncada em uma casa decimal; contagem de páginas e de defeitos"
              />
              <AvaliacaoMatriz a={a} />
              <DadosAviso>
                {semNota > 0
                  ? `${plural(semNota, "ocorrência de dimensão não avaliada", "ocorrências de dimensão não avaliada")} entre as páginas: aparece como n.av. e não satisfaz o aceite. `
                  : "Nenhuma dimensão aplicável ficou sem avaliação nesta rodada. "}
                A revisão de didatismo e de qualidade visual foi feita por revisores em contexto limpo sobre capturas abertas e o texto da página; não é teste com pessoas.
              </DadosAviso>
              {a.rodada.corrigido_depois_da_medicao.length > 0 && (
                <DadosAviso>
                  Corrigido depois da medição e ainda não medido: {a.rodada.corrigido_depois_da_medicao.join(" ")}
                </DadosAviso>
              )}
              <DadosLimitacoes itens={a.limites} />
              <DadosSeguir
                ancora="painel-avaliacao"
                proximo={{ href: "/setor-eletrico/dados", pergunta: "Quais dados estão de fato validados?" }}
                downloads={[{ rotulo: "Avaliação completa, com a evidência de cada nota (JSON)", url: URL_AVALIACAO }]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="dimensoes">
            <DadosAnalise titulo="Média e pior página em cada dimensão" id="dimensoes-analise">
              <GraficoBarras
                titulo={`Nota média e menor nota de cada dimensão, rodada ${a.rodada.id}`}
                dados={dims.map((d) => ({ id: d.id, rotulo: d.rotulo, media: d.media, minimo: d.minimo }))}
                chaveCategoria="id"
                chaveRotulo="rotulo"
                series={[
                  { id: "media", rotulo: "Média das páginas", cor: "var(--escala-seq-4)" },
                  { id: "minimo", rotulo: "Menor nota", cor: "var(--escala-seq-2)" },
                ]}
                unidade="nota de 0 a 10"
                casas={1}
                orientacao="horizontal"
                rotulosValor
                alturaCategoria={56}
                referencias={[{ valor: a.rubrica.metas.geral, rotulo: `Meta de produto (${num(a.rubrica.metas.geral, 1)}; didatismo e visual ${num(a.rubrica.metas.didatismo, 1)})` }]}
              />
              <DadosAviso>Barra ausente é dimensão sem nenhuma página avaliada, nunca nota zero. A meta de didatismo e de qualidade visual é 9,5; a linha mostra 9,0, a meta das demais dimensões.</DadosAviso>
            </DadosAnalise>
          </Bloco>

          <Bloco id="paginas">
            <DadosAnalise titulo="Nota de cada página, com a evidência" id="paginas-analise">
              <AvaliacaoPaginas linhas={linhas} versao={versao} />
            </DadosAnalise>
          </Bloco>

          <Bloco id="defeitos">
            <DadosAnalise titulo="Defeitos abertos" id="defeitos-analise">
              <TabelaInterativa
                titulo="Defeitos abertos nesta rodada, agrupados por causa"
                colunas={COLUNAS_DEFEITOS}
                linhas={defeitos}
                chaveLinha="id"
                colunaRotulo="id"
                fonte="Scrutiniums, avaliacao.json (defeitos agrupados por dimensão, código e descrição)"
                versao={versao}
                nomeArquivo="avaliacao-defeitos"
                chaveUrl="def"
                ordemInicial={{ coluna: "n_paginas", direcao: "desc" }}
                tamanhoPagina={25}
                dicaBusca="Descrição do defeito"
                semLinhas="Nenhum defeito aberto nesta rodada."
                nota="Severidade: crítico é dado errado, navegação quebrada, foco preso ou falha de operação; alto é violação séria de acessibilidade, erro de console, controle que não aciona ou rolagem horizontal; médio e baixo são os demais. Um defeito lista todas as páginas em que apareceu."
              />
            </DadosAnalise>
          </Bloco>

          <Bloco id="jornadas">
            <DadosAnalise titulo="Jornadas de usuário executadas" id="jornadas-analise">
              <AvaliacaoJornadas a={a} />
            </DadosAnalise>
          </Bloco>

          <Bloco id="revisao">
            <DadosAnalise titulo="Problemas que os revisores viram em várias páginas" id="revisao-analise">
              <AvaliacaoRevisao a={a} />
            </DadosAnalise>
          </Bloco>

          <Bloco id="evolucao">
            <DadosAnalise titulo="Evolução entre rodadas" id="evolucao-analise">
              <AvaliacaoEvolucao a={a} />
            </DadosAnalise>
          </Bloco>

          <Bloco id="rubrica">
            <DadosAuditoria titulo="Rubrica, método e entradas" id="rubrica-auditoria">
              <AvaliacaoRubrica a={a} />
              <AvaliacaoMetodo a={a} />
            </DadosAuditoria>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
