import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { DadosAviso, DadosCapitulos, DadosLimitacoes, DadosResposta, DadosSeguir, ReferenciaDados } from "@/components/energia/DadosPainel";
import { DetalheDoNivel } from "@/components/energia/DetalheDoNivel";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { MetodologiaLinhagem } from "@/components/energia/MetodologiaLinhagem";
import { MetodologiaRegras } from "@/components/energia/MetodologiaRegras";
import { MetodologiaTarefas } from "@/components/energia/MetodologiaTarefas";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { NATUREZAS, SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { LISTA_UNIDADES } from "@/components/evidencia/Unidade";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold } from "@/lib/energia/gold";
import { CONCEITOS } from "@/lib/energia/conteudo/conceitos";
import { DATASETS_INTEGRADOS, catalogoDados } from "@/lib/energia/datasets";
import { CSV_DADOS, URL_GOLD, afirmacoesConferidas, compactarLinhas, linhasMetricas, respostaRegras, resumoMetricas, ROTULO_ESTADO_DADOS } from "@/lib/energia/dados";
import { contextoDoCatalogo, fichasDasFontes } from "@/lib/energia/dados-ficha";
import { maiuscula, quadroDeDatas, resumirAcessoCcee, separaIdentificadores, textoChecagensReprovadas, textoDatasDaColetaCcee, textoMudancaRegras, textoVersaoDoCodigo, vereditoRegras } from "@/lib/energia/dados-leitor";
import { acessoCceeDados, contagemNoCsvDoCatalogo, estadoDoArquivo, manifestoDados, metricasGeradoEm, metricasPublicadas, provenienciaDados, publicacaoDados, validacoesDosCsv, versoesDoCodigoDasBases } from "@/lib/energia/dados-servidor";
import { carimbo, dataBR, num, rotuloRegra } from "@/lib/energia/formato";
import type { Natureza } from "@/lib/energia/tipos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Do arquivo ao número: metodologia do Observatório do Setor Elétrico",
  description:
    "O caminho de cada número, da fonte à tela, e a regra de cada indicador publicado: definição, unidade, recortes, fórmula, fontes com ficha e limitações. Natureza do dado, regra editorial, regras de classificação, governança de previsão e limitações do Observatório Brasileiro do Setor Elétrico.",
  alternates: { canonical: "/setor-eletrico/metodologia" },
};

/** Seção de página (fora do painel): título de nível 2 e texto em coluna de leitura; `larga` deixa a figura ocupar a largura da página e prende só os parágrafos à coluna. */
function Secao({ id, titulo, children, larga = false }: { id: string; titulo: string; children: ReactNode; larga?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-28 border-t border-linha py-8">
      <h2 id={`${id}-titulo`} className="ed-h2 font-serif text-carvao">
        {titulo}
      </h2>
      <div className={`mt-4 space-y-4 leading-relaxed text-carvao ${larga ? "[&>p]:max-w-4xl [&>div]:max-w-4xl" : "max-w-4xl"}`}>{children}</div>
    </section>
  );
}

const ROTULO_FRASE: Record<string, string> = {
  reservatorios: "Reservatórios",
  afluencias: "Afluências",
  carga: "Carga",
  termica: "Participação térmica",
  pld: "PLD",
  preco: "PLD",
  rede: "Rede",
  descolamento: "Diferença entre submercados",
};

/** Rótulos de regra que a gold escreve sem acento e que o rótulo geral não corrige. */
const ROTULO_REGRA_LOCAL: Record<string, string> = { validacao_fisica: "Validação física" };
const rotuloDaRegra = (k: string) => ROTULO_REGRA_LOCAL[k] ?? rotuloRegra(k);

function Regras({ titulo, regras }: { titulo: string; regras?: Record<string, string> }) {
  if (!regras) return null;
  return (
    <div className="border-t border-linha pt-3">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      <dl className="mt-3 space-y-3">
        {Object.entries(regras).map(([k, v]) => (
          <div key={k}>
            <dt className="rotulo text-mineral">{rotuloDaRegra(k)}</dt>
            <dd className="mt-0.5 text-sm text-carvao-muted">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Campos de cada linha da lista de regras, na ordem em que viajam para o navegador (as chaves vão uma vez, não uma por linha). */
const CHAVES_DAS_REGRAS = ["id", "n", "titulo", "pergunta", "modulo", "natureza_fonte", "natureza_calculo", "unidade", "grao_geografico", "grao_temporal", "formula", "paginas"];

const LINK_DO_PASSO = "inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";

const SITUACOES = ["reconciliacao_aprovada", "controles_aprovados", "ressalva", "divergencia", "pendencia"] as const;

export default function MetodologiaEnergia() {
  const meta = gold.meta();
  const sintese = gold.sintese();
  const cat = catalogoDados();
  const pub = publicacaoDados();
  const man = manifestoDados();
  const pendentes = CONCEITOS.filter((c) => c.estado === "PENDENTE");
  const metricas = metricasPublicadas();
  const rm = resumoMetricas(metricas);
  const afirm = pub ? afirmacoesConferidas(pub) : [];
  const conferidas = afirm.filter((x) => x.conferida).length;
  const prov = pub ? provenienciaDados(pub.proveniencia.validacao) : null;
  const evAfirm = pub?.evidencias.afirmacoes_conferidas;
  const evReprovadas = pub?.evidencias.checagens_reprovadas;
  const evPublicados = pub?.evidencias.conjuntos_publicados;
  const eixos = pub?.eixos;
  const ccee = pub ? resumirAcessoCcee(acessoCceeDados(), pub.referencia.executado_em) : null;
  const decisaoCcee = ccee?.decididaEm ? dataBR(ccee.decididaEm) : "06/10/2026";
  // as regras por indicador vêm de metricas.json, gerado em outro momento que o catálogo e a saúde (publicacao.json)
  const geradoRegras = metricasGeradoEm() ?? pub?.gerado_em ?? "";
  const dataRegras = geradoRegras ? dataBR(geradoRegras.slice(0, 10)) : "data não registrada";
  const datas = pub ? quadroDeDatas({ referencia: pub.referencia.hoje, processadoEm: pub.gerado_em, metaEm: meta?.gerado_em, indicadoresEm: geradoRegras }) : [];
  const afirmLimitacoes = (pub?.afirmacoes ?? []).filter((a) => ["limites_intercambio", "cvu_usina", "geracao_usina", "despacho_termico"].includes(a.id));
  const completo = !!(pub && prov && metricas.length > 0);

  // a ficha de cada fonte que as regras citam, lida do catálogo: o nome do conjunto e o endereço da ficha
  const fontesCitadas = Array.from(new Set(metricas.reduce<string[]>((s, m) => s.concat(m.fontes), [])));
  const porIdNoCatalogo = new Set((cat?.entradas ?? []).map((e) => e.id));
  const fichas = new Set(DATASETS_INTEGRADOS.filter((d) => porIdNoCatalogo.has(d.catalogoId)).map((d) => d.slug));
  const fichasPorFonte = cat ? fichasDasFontes(fontesCitadas, cat, pub, fichas) : {};
  const matriz = compactarLinhas(linhasMetricas(metricas), CHAVES_DAS_REGRAS);

  // as checagens reprovadas do relatório, com o que a releitura do arquivo publicado mostra
  const reprovados = pub ? Array.from(validacoesDosCsv()).filter((par) => par[1].veredito === "reprovado").map((par) => estadoDoArquivo(`/energia/series/${par[0]}`, pub, man)) : [];
  const reprovadas = pub?.resumo.validacao.reprovado ?? 0;
  const notaReprovadas = textoChecagensReprovadas(reprovados, reprovadas);

  // o exemplo reproduzível: a mesma conta que a página pede, feita no arquivo que o leitor baixa
  const exemplo = contagemNoCsvDoCatalogo("PUBLICADO");
  const arquivoDoCatalogo = man?.arquivos.find((a) => a.caminho === CSV_DADOS.catalogo.url);
  const versoes = man ? textoVersaoDoCodigo(versoesDoCodigoDasBases(man)) : null;

  const ENDERECO = "https://scrutiniums.com/setor-eletrico/metodologia#regras";

  const oQueMudou = <>{textoMudancaRegras(afirm.map((x) => x.afirmacao), conferidas)}</>;
  const comoInterpretar = (
    <>
      A natureza do dado de origem e a do resultado são diferentes: um valor observado pode virar um calculado, e um calculado de dado estimado continua dependendo da estimativa. Mista é a combinação de naturezas. A regra de cobertura diz o mínimo para publicar; a política de ausência diz o que aparece quando falta (nunca zero).
    </>
  );
  const naoConcluir = (
    <>
      Que a regra publicada garanta a ausência de erro: ela diz o que o observatório faz, e as validações e a evidência de cada número dizem se deu certo. Que um indicador de um módulo possa ser comparado com um de outro sem olhar o recorte e a unidade. Que a lista esteja completa para o que a fonte publica: só entram os números que o observatório exibe.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="metodologia" />
      <MarcaVisita secao="energia:metodologia" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina pb-16">
        <CabecalhoModulo
          siglas={["ONS", "ANEEL", "CCEE", "IBGE", "ENA", "REE", "MLT", "CVU", "PLD", "CMO"]}
          titulo="Do arquivo ao número que você vê"
          lead="Siga o caminho de um número, da fonte à tela, e consulte a regra de cada indicador: o que ele mede, como é calculado, de onde vem e o que não permite concluir."
          recorte={completo ? `${num(rm.total, 0)} indicadores em ${rm.modulos} módulos · regras de ${dataRegras}` : "Regras por indicador indisponíveis nesta publicação"}
          fonte="Scrutiniums, catálogo de indicadores dos módulos"
          referencia={
            pub ? (
              <ReferenciaDados
                processadoEm={pub.gerado_em}
                referencia={dataBR(pub.referencia.hoje)}
                extra={
                  <>
                    Catálogo de indicadores gerado em {carimbo(geradoRegras)}.{meta ? <> Último processamento completo: {carimbo(meta.gerado_em)}.</> : null}
                  </>
                }
              />
            ) : undefined
          }
          metricas={
            completo ? (
              <FaixaMetricas colunas={3} rotulo="Indicadores da metodologia" nota="Medidas do catálogo inteiro de indicadores: não mudam com a busca nem com os filtros da lista.">
                <Numero variante="faixa" rotulo="Indicadores com regra publicada" natureza="CALCULADO" valor={rm.total} casas={0} unidade="indicadores" periodo={dataRegras} endereco={ENDERECO} />
                <Numero
                  variante="faixa"
                  rotulo="Com fórmula publicada"
                  natureza="CALCULADO"
                  valor={rm.comFormula}
                  casas={0}
                  unidade="indicadores"
                  periodo={dataRegras}
                  nota={<>Nos demais, definição e regra de agregação.</>}
                  endereco={ENDERECO}
                />
                <Numero
                  variante="faixa"
                  rotulo="Com dado de origem observado"
                  natureza="CALCULADO"
                  valor={rm.observadas}
                  casas={0}
                  unidade="indicadores"
                  periodo={dataRegras}
                  nota={<>Os outros {num(rm.total - rm.observadas, 0)} partem de dado estimado, calculado, previsto, de cenário ou misto.</>}
                  endereco={ENDERECO}
                />
              </FaixaMetricas>
            ) : undefined
          }
        />

        <ModoProfundidade>
          {completo && pub && prov ? (
            <>
              <MetodologiaTarefas total={rm.total} comFormula={rm.comFormula} />

              <Secao id="linhagem" titulo="Do arquivo da fonte ao número na tela" larga>
                <MetodologiaLinhagem />
                <p>
                  Cada valor guarda de qual coleta veio. Quando a fonte revisa um valor (o ONS declara que seus dados passam por consistência recorrente), o observatório guarda a versão nova sem apagar a anterior. A consulta &quot;como estava em&quot; devolve o valor conhecido em qualquer instante (com fuso explícito, sem ambiguidade de data) e é a que as variáveis de entrada de modelos em produção e os testes retrospectivos por versão devem usar. O teste retrospectivo da pesquisa atual foi feito sobre uma única cópia congelada dos dados, simulando o tempo real; a limitação está declarada em cada cartão de modelo.
                  <span data-nivel="analisar"> No vocabulário de engenharia: backtest sobre um snapshot único, em pseudo tempo real, com a vintage de cada observação.</span>
                </p>
                <p className="text-sm text-carvao-muted">Datas distinguidas: período de referência; publicação pela fonte (quando informada); captura pela Scrutiniums; corte da previsão; emissão.</p>
                <p className="text-sm text-carvao-muted">
                  A documentação técnica completa, com a arquitetura, o catálogo de fontes, a auditabilidade e a governança de previsão, está no{" "}
                  <a href="https://github.com/genarolins1975/scrutiniums/tree/main/docs/observatorios" target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                    repositório público do projeto ↗
                  </a>
                  , junto com o código que produz cada número.
                </p>
                <div data-nivel="analisar" className="space-y-3 border-l-2 border-linha pl-3">
                  <p className="text-sm text-carvao-muted">
                    Os nomes usuais em engenharia de dados são bronze (o arquivo original de cada captura), silver (o histórico de observações por captura, a vintage) e gold (os dados processados que as páginas publicam).
                  </p>
                  <pre tabIndex={0} aria-label="Linhagem dos dados, do arquivo da fonte à visualização (rolável)" className="overflow-x-auto border border-linha bg-superficie p-4 font-mono text-xs leading-relaxed text-carvao">{`FONTE (CCEE, ONS, ANEEL)
  ↓ captura: arquivo original, sha256, url, capturado_em, publicado_em (metadado da fonte)
BRONZE: cópia imutável por captura
  ↓ normalização determinística
SILVER (histórico): observações por vintage; só acrescenta, nunca apaga
  ↓ regras publicadas
GOLD (dados processados): indicadores com proveniência, publicados em /energia/gold
  ↓
INDICADOR → VISUALIZAÇÃO | MODELO

Previsões: VINTAGE DA FONTE → VARIÁVEIS DE ENTRADA → VERSÃO DO MODELO → PUBLICAÇÃO → REALIZADO → APURAÇÃO`}</pre>
                </div>
              </Secao>

              <Bloco id="regras">
                <PainelEvidencia
                  id="painel-regras"
                  pergunta="Quais interpretações são permitidas?"
                  subtitulo={`${num(rm.total, 0)} indicadores em ${rm.modulos} módulos · regra, unidade, recortes, cobertura e limitações de cada um`}
                  proveniencia={prov}
                  porQueImporta={
                    <>
                      Um número sem regra convida a leitura que a regra não sustenta. Aqui, cada indicador diz o que mede, em que unidade, para qual recorte, como se agrega, o que acontece quando falta dado e o que ele não permite concluir.
                    </>
                  }
                  oQueMudou={oQueMudou}
                  comoInterpretar={comoInterpretar}
                  naoConcluir={naoConcluir}
                  naoConcluirNoCorpo
                >
                  <div className="space-y-6">
                    <MetodologiaRegras
                      matriz={matriz}
                      versao={geradoRegras}
                      fichasPorFonte={fichasPorFonte}
                      arquivoCompleto={{ rotulo: "Catálogo de indicadores (JSON)", url: URL_GOLD.metricas }}
                      tituloTabela="Tabela completa das regras, com todas as colunas"
                      apoioTabela="A mesma busca e os mesmos filtros da lista, com as colunas de natureza, unidade e recortes para ordenar e comparar. O recorte escolhido na lista aparece aqui, e a tabela baixa o recorte em CSV ou XLSX."
                    >
                      <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} nome="Quais interpretações são permitidas?" />

                      <DadosResposta depois painel="P070" veredito={vereditoRegras(rm)}>
                        {respostaRegras(rm)}
                      </DadosResposta>

                      <DadosCapitulos atual="regras" />

                      <SecaoDoPainel
                        id="exemplo-reproduzivel"
                        titulo="Como refazer um número, passo a passo?"
                        lead="O exemplo refaz, com o arquivo que você baixa, o número de conjuntos publicados no catálogo. O caminho é o mesmo para qualquer número que tenha a ficha Comprove este número."
                      >
                        <ol className="max-w-prose2 space-y-1 text-sm leading-relaxed text-carvao" data-passos="exemplo">
                          <li>
                            <strong className="font-medium">1. Baixe o arquivo.</strong> O catálogo completo, com uma linha por conjunto.
                            <span className="block">
                              <a href={CSV_DADOS.catalogo.url} download className={LINK_DO_PASSO}>
                                Baixar o catálogo (CSV)
                              </a>
                            </span>
                          </li>
                          <li className="pb-2">
                            <strong className="font-medium">2. Conte.</strong> Cada linha diz até onde o conjunto chegou, de catalogado a publicado. Conte as linhas cujo estado é PUBLICADO.
                          </li>
                          <li>
                            <strong className="font-medium">3. Compare.</strong>{" "}
                            {exemplo ? (
                              <>
                                Resultado: {num(exemplo.doEstado, 0)} de {num(exemplo.linhas, 0)} linhas.{" "}
                                {evPublicados && exemplo.doEstado === evPublicados.valor_calculo
                                  ? "É o mesmo número de Publicados no observatório, na primeira faixa da página Dados."
                                  : "Compare com Publicados no observatório, na primeira faixa da página Dados."}
                              </>
                            ) : (
                              <>O resultado deve coincidir com Publicados no observatório, na primeira faixa da página Dados.</>
                            )}
                            <span className="block">
                              <Link href="/setor-eletrico/dados#catalogo" className={LINK_DO_PASSO}>
                                Abrir a página Dados
                              </Link>
                            </span>
                          </li>
                          <li>
                            <strong className="font-medium">4. Confira a origem.</strong> A ficha mostra a fórmula, a fonte, a versão e a impressão digital dos arquivos de origem.
                            {evPublicados && (
                              <span className="block">
                                <ComproveNumero evidencia={evPublicados} rotulo="Comprove os conjuntos publicados" endereco={ENDERECO} />
                              </span>
                            )}
                          </li>
                        </ol>
                        <div data-nivel="analisar" className="max-w-prose2 space-y-1 border-l-2 border-linha pl-3 text-sm leading-relaxed text-carvao-muted">
                          <p>
                            Arquivo: dados_catalogo.csv, coluna estado (ponto e vírgula como separador, campos de texto entre aspas). {evPublicados?.consulta ? `Consulta que gera o número: ${evPublicados.consulta}.` : ""}{" "}
                            {evPublicados?.reproducao ? `Para refazer a publicação inteira: ${evPublicados.reproducao}.` : ""}
                          </p>
                        </div>
                        {arquivoDoCatalogo && (
                          <p data-nivel="auditar" className="max-w-prose2 break-all border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">
                            Impressão digital (sha256) do arquivo na lista de arquivos: {arquivoDoCatalogo.sha256}. Confira a do arquivo baixado na página Download e reprodução.
                          </p>
                        )}
                      </SecaoDoPainel>

                      <SecaoDoPainel id="checagens" titulo="Como o observatório confere as próprias afirmações e arquivos?">
                        <FaixaMetricas colunas={2} rotulo="Conferências automáticas" nota="Medidas da publicação inteira: não mudam com a busca nem com os filtros da lista.">
                          <Numero
                            variante="faixa"
                            rotulo="Afirmações de fonte integrada conferidas"
                            natureza="CALCULADO"
                            evidencia={evAfirm ?? null}
                            valor={conferidas}
                            casas={0}
                            unidade="afirmações"
                            nota={<>De {num(afirm.length, 0)}, contra o estado real do catálogo.</>}
                            motivoAusencia="Sem afirmações conferidas nesta publicação."
                            endereco={ENDERECO}
                          />
                          <Numero
                            variante="faixa"
                            rotulo="Checagens automáticas reprovadas"
                            natureza="CALCULADO"
                            evidencia={evReprovadas ?? null}
                            valor={reprovadas}
                            casas={0}
                            unidade="checagens"
                            nota={
                              <>
                                De {num(pub.resumo.validacao.checagens, 0)}; {num(pub.resumo.validacao.ressalva, 0)} com ressalva. {notaReprovadas.curta}
                              </>
                            }
                            endereco={ENDERECO}
                          />
                        </FaixaMetricas>
                        {reprovadas > 0 && notaReprovadas.frase && (
                          <DadosAviso>
                            <p>{notaReprovadas.frase}</p>
                          </DadosAviso>
                        )}
                        {notaReprovadas.tecnico && (
                          <p data-nivel="analisar" className="max-w-prose2 break-words border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">
                            {notaReprovadas.tecnico}
                          </p>
                        )}
                        <p className="text-sm text-carvao-muted">
                          O estado de cada arquivo publicado está em{" "}
                          <Link href="/setor-eletrico/dados/reproducao#tabela" className="text-energia-dark underline underline-offset-4">
                            Download e reprodução
                          </Link>
                          .
                        </p>
                      </SecaoDoPainel>
                    </MetodologiaRegras>

                    <SecaoDoPainel id="afirmacoes" nivel="analisar" titulo="Afirmações sobre fontes integradas, conferidas com o catálogo">
                      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                        Cada frase abaixo é escrita pelo pipeline a partir do estado real do catálogo: o conjunto só é descrito como integrado, validado ou publicado se a escada chegou lá. Uma afirmação cujo conjunto está fora do catálogo, ou só catalogado, reprova.
                      </p>
                      <ul className="space-y-3" data-lista="afirmacoes">
                        {afirm.map(({ afirmacao: a, conferida, motivo }) => (
                          <li key={a.id} className="border border-linha bg-superficie p-4" data-afirmacao={a.id}>
                            <p className="flex flex-wrap items-baseline gap-x-3">
                              <strong className="font-medium text-carvao">{a.tema}</strong>
                              <span className={`rotulo ${conferida ? "text-sucesso" : "text-erro"}`}>{conferida ? "● conferida com o catálogo" : `✕ não confere: ${motivo}`}</span>
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-carvao-muted [overflow-wrap:anywhere]">{a.texto}</p>
                            <p className="mt-2 text-xs leading-relaxed text-mineral">
                              Conjuntos citados: {a.conjuntos.map((c) => `${c.id} (${ROTULO_ESTADO_DADOS[c.estado].toLowerCase()})`).join("; ")}.
                            </p>
                            {a.afirmacao_anterior && (
                              <p className="mt-2 border-l-2 border-aviso pl-3 text-sm leading-relaxed text-carvao">
                                <span className="rotulo mr-2 text-aviso">Correção</span>
                                {a.afirmacao_anterior} {a.correcao_metodologia ?? ""}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </SecaoDoPainel>

                    {eixos && (
                      <SecaoDoPainel id="eixos" nivel="analisar" titulo="Natureza do dado e situação da validação, ficha a ficha">
                        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                          Cada ficha de evidência ({num(eixos.fichas, 0)}) tem uma natureza e uma situação de validação. {num(eixos.fichas_sem_natureza_vinculada, 0)} fichas não têm natureza vinculada com segurança e aparecem como sem vínculo: a situação da validação é publicada, e a natureza fica em aberto em vez de ser chutada.
                        </p>
                        <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Fichas por natureza e situação da validação (tabela rolável)">
                          <table className="w-full min-w-[40rem] border-collapse text-xs">
                            <caption className="sr-only">Número de fichas de evidência por natureza do dado e situação da validação</caption>
                            <thead>
                              <tr className="text-left text-mineral">
                                <th scope="col" className="border-b border-linha px-2 py-2 font-medium">
                                  Natureza
                                </th>
                                {SITUACOES.map((x) => (
                                  <th key={x} scope="col" className="border-b border-linha px-2 py-2 font-medium">
                                    {x.replace(/_/g, " ")}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(eixos.matriz).map(([n, linha]) => (
                                <tr key={n} className="border-b border-linha">
                                  <th scope="row" className="px-2 py-1.5 text-left font-normal text-carvao">
                                    {n === "SEM_VINCULO" ? "Sem natureza vinculada" : NATUREZAS[n as Natureza]?.rotulo ?? n}
                                  </th>
                                  {SITUACOES.map((x) => (
                                    <td key={x} className="px-2 py-1.5 tabular-nums text-carvao-muted">
                                      {num(linha[x] ?? 0, 0)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
                          {SITUACOES.map((x) => (
                            <div key={x}>
                              <dt className="font-medium text-carvao">{x.replace(/_/g, " ")}</dt>
                              <dd className="mt-0.5 leading-relaxed text-carvao-muted">{eixos.situacoes[x]}</dd>
                            </div>
                          ))}
                        </dl>
                      </SecaoDoPainel>
                    )}

                    <SecaoDoPainel id="regras-pipeline" nivel="auditar" titulo="Regras do pipeline: estados, uso, validação, horizonte e tempo">
                      <dl className="space-y-4 text-sm">
                        <div>
                          <dt className="rotulo text-mineral">Uso e estado</dt>
                          <dd className="mt-1 max-w-prose2 leading-relaxed text-carvao-muted">{pub.regras.uso}</dd>
                        </div>
                        <div>
                          <dt className="rotulo text-mineral">Validação</dt>
                          <dd className="mt-1 max-w-prose2 leading-relaxed text-carvao-muted">{pub.regras.validacao}</dd>
                        </div>
                        <div>
                          <dt className="rotulo text-mineral">Revisão</dt>
                          <dd className="mt-1 max-w-prose2 leading-relaxed text-carvao-muted">{pub.regras.revisao}</dd>
                        </div>
                        <div>
                          <dt className="rotulo text-mineral">Datas distinguidas</dt>
                          <dd className="mt-1">
                            <dl className="space-y-1.5">
                              {Object.entries(pub.regras.tempo).map(([k, v]) => (
                                <div key={k}>
                                  <dt className="inline font-medium text-carvao">{rotuloRegra(k)}: </dt>
                                  <dd className="inline leading-relaxed text-carvao-muted">{v}</dd>
                                </div>
                              ))}
                            </dl>
                          </dd>
                        </div>
                        <div>
                          <dt className="rotulo text-mineral">Referências legitimamente posteriores à captura (horizonte)</dt>
                          <dd className="mt-1">
                            <ul className="list-disc space-y-0.5 pl-5 leading-relaxed text-carvao-muted">
                              {Object.entries(pub.regras.horizonte).map(([k, v]) => (
                                <li key={k}>
                                  <span className="font-medium text-carvao">{k}</span>: {v}
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      </dl>
                    </SecaoDoPainel>

                    <DadosLimitacoes
                      itens={[
                        <>A lista é a do observatório em {dataRegras}; indicador novo só aparece na próxima atualização.</>,
                        <>O rótulo Estimado não separa o valor estimado pela fonte do estimado pelo observatório: a plataforma tem uma só categoria para os dois, e nenhuma ficha diz qual dos dois é. A separação está pedida e ainda não foi feita.</>,
                      ]}
                      tecnicas={eixos?.limitacao_natureza ? [eixos.limitacao_natureza] : []}
                    />
                    <DadosSeguir
                      ancora="painel-regras"
                      proximo={{ href: "/setor-eletrico/dados", pergunta: "Quais dados estão de fato validados?" }}
                      downloads={[
                        { rotulo: "Catálogo de métricas (JSON)", url: URL_GOLD.metricas },
                        { rotulo: "Natureza e validação por ficha (CSV)", url: CSV_DADOS.eixos.url },
                      ]}
                    />
                  </div>
                </PainelEvidencia>
              </Bloco>
            </>
          ) : (
            <Bloco id="regras">
              <p className="border border-dashed border-mineral bg-papel p-5 text-sm leading-relaxed text-carvao-muted" role="status">
                As regras por indicador não estão disponíveis nesta publicação: o catálogo de métricas ou a gold de publicação não foi gerado. As seções abaixo, escritas à mão, continuam valendo.
              </p>
            </Bloco>
          )}

          <Secao id="natureza" titulo="Taxonomia de natureza do dado">
            <p>Todo número exibido carrega um selo. As categorias nunca se confundem, e a forma do selo muda com a categoria, não só a cor.</p>
            <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
              {(Object.keys(NATUREZAS) as Natureza[]).map((n) => (
                <li key={n} className="flex items-start gap-3 border-t border-linha pt-3">
                  <SeloNatureza natureza={n} />
                  <span className="text-sm text-carvao-muted">{NATUREZAS[n].definicao}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-carvao-muted">
              O CMO semanal é publicado pelo ONS como saída do modelo DECOMP: para a plataforma é OBSERVADO (valor oficial), com a nota de que é resultado de modelo da fonte. Médias diárias do PLD e participações por fonte são CALCULADAS pela Scrutiniums a partir de valores observados.
            </p>
          </Secao>

          <Secao id="unidades" titulo="Unidades">
            <p>Convenções de medida usadas neste observatório, com a unidade em que cada fonte publica:</p>
            <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2 lg:grid-cols-3">
              {LISTA_UNIDADES.map((x) => (
                <div key={x.u} className="border-t border-linha pt-3">
                  <dt className="font-medium text-carvao">
                    {x.u} · {x.nome}
                  </dt>
                  <dd className="mt-1 text-sm text-carvao-muted">{x.dica}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-carvao-muted">
              Preços em reais por megawatt-hora (R$/MWh), sempre nominais: sem correção pela inflação. A descrição do conjunto de PLD na CCEE registra a unidade apenas como R$; a do CMO semanal, no dicionário do ONS, como R$/MW.
            </p>
          </Secao>

          <Secao id="editorial" titulo="Regra editorial">
            <p>Toda visualização relevante responde, nesta ordem: o que estou vendo, por que importa, o que mudou, como interpretar, o que não é possível concluir e qual é a fonte. A regra é obrigatória no componente de painel: um painel sem esses campos não é construído.</p>
          </Secao>

          <Secao id="classificacao" titulo="Regras de classificação publicadas">
            <p>Nenhuma classificação (&quot;baixo&quot;, &quot;alto&quot;, &quot;fora da faixa usual&quot;) existe sem regra estatística declarada. As regras em vigor, lidas dos próprios dados publicados:</p>
            <DetalheDoNivel resumo="Ver as regras de cada módulo" abreEm="analisar" className="max-w-none">
              <div className="grid gap-x-8 gap-y-6 pt-3 md:grid-cols-2">
                <Regras titulo="PLD" regras={gold.pld()?.regras} />
                <Regras titulo="Hidrologia" regras={gold.hidrologia()?.regras} />
                <Regras titulo="Carga" regras={gold.carga()?.regras} />
                <Regras titulo="Geração" regras={gold.geracao()?.regras} />
                <Regras titulo="Rede" regras={gold.rede()?.regras} />
              </div>
            </DetalheDoNivel>
          </Secao>

          <Secao id="sintese" titulo="Frases e alertas da Visão geral">
            <p>
              A síntese &quot;o sistema em 60 segundos&quot; e a lista &quot;o que observar&quot; são montadas por regras fixas a partir dos dados processados; nenhum texto é redigido livremente. Cada frase tem sua regra; cada alerta, sua condição. As regras de cada frase repetem as fórmulas acima e estão em Analisar.
            </p>
            {sintese && (
              <ul data-nivel="analisar" className="space-y-2 text-sm">
                {sintese.frases.map((f) => (
                  <li key={f.id} className="border border-linha bg-superficie p-3">
                    <strong className="font-medium">{ROTULO_FRASE[f.id] ?? maiuscula(f.id)}:</strong> {f.regra}
                  </li>
                ))}
                {sintese.observar.map((o) => (
                  <li key={o.id} className="border border-linha bg-superficie p-3">
                    <strong className="font-medium">{maiuscula(o.titulo)}:</strong> {o.condicao}
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          <Secao id="previsao" titulo="Governança de previsão">
            <p>
              Modelos têm estado explícito: PESQUISA, VALIDAÇÃO, PRODUÇÃO ou APOSENTADO. Só modelo em PRODUÇÃO alimenta a previsão principal. Cada previsão registrada ganha um identificador e uma impressão digital do conteúdo<span data-nivel="analisar"> (sha256)</span>; correção cria novo registro que aponta para o original, com motivo. Faixas de incerteza só são chamadas de &quot;80%&quot; quando a cobertura medida fora do ajuste sustenta isso.
            </p>
            <p>
              Veja o{" "}
              <Link href="/setor-eletrico/pld/modelos" className="text-energia-dark underline underline-offset-4">
                registro de modelos
              </Link>{" "}
              e o{" "}
              <Link href="/setor-eletrico/pld/previsoes" className="text-energia-dark underline underline-offset-4">
                histórico de previsões
              </Link>
              .
            </p>
          </Secao>

          <Secao id="limitacoes" titulo="Limitações gerais desta fase">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                O portal de dados abertos da CCEE recusa consultas automáticas comuns. O observatório usa um cliente próprio, com coleta autorizada pelo responsável em {decisaoCcee} para o PLD horário, os conjuntos abertos do Mercado e o InfoMercado, e tenta a coleta em cada atualização agendada. O histórico do PLD de 2021 a 2025 vem das capturas primárias de 27/09/2026.
                <span data-nivel="analisar">
                  {" "}
                  Detalhe técnico: a recusa é um HTTP 403 com página de acesso bloqueado para o curl; o cliente do pipeline segue com o User-Agent do projeto e sem disfarce de navegador, e as capturas são versionadas com sha256.
                </span>{" "}
                {meta?.fontes?.ccee_pld_horario?.ultima_tentativa
                  ? `Última tentativa do PLD horário: ${carimbo(meta.fontes.ccee_pld_horario.ultima_tentativa.tentado_em)}, ${meta.fontes.ccee_pld_horario.ultima_tentativa.ok ? "bem-sucedida" : "sem sucesso"}.`
                  : "Nenhuma tentativa registrada nesta publicação."}
                {pub && ccee && textoDatasDaColetaCcee(ccee, pub.referencia.hoje, pub.gerado_em) ? <span data-datas-coleta-ccee="true"> {textoDatasDaColetaCcee(ccee, pub.referencia.hoje, pub.gerado_em)}</span> : null}
              </li>
              <li>
                Os limites regulatórios do PLD (piso, teto horário e teto estrutural) vêm dos atos da ANEEL, com o ato e a vigência de cada valor, no{" "}
                <Link href="/setor-eletrico/regulacao#p044" className="text-energia-dark underline underline-offset-4">
                  painel de limites da Regulação
                </Link>
                ; o &quot;menor valor observado no ano&quot; é descritivo e nunca é chamado de piso.
              </li>
              {/* afirmações de integração geradas pelo pipeline a partir do estado real do catálogo */}
              {afirmLimitacoes.map((a) => {
                const { texto, tecnico } = separaIdentificadores(a.texto);
                return (
                  <li key={a.id}>
                    {texto}
                    {tecnico && <span data-nivel="analisar"> {tecnico}</span>}
                  </li>
                );
              })}
              <li>
                {pendentes.length === 0
                  ? "Todos os verbetes do Aprenda têm a definição conferida em fonte primária."
                  : `${pendentes.length === 1 ? "Um verbete do Aprenda aparece" : `${pendentes.length} verbetes do Aprenda aparecem`} em preparação, sem definição, porque a fonte primária que o define não foi encontrada nos documentos consultados (${pendentes.map((c) => c.sigla ?? c.nome).join(", ")}); cada um diz o que já foi consultado e o que falta.`}
              </li>
              <li>Valores monetários em R$ nominais.</li>
              <li>
                O histórico de versões anteriores dos dados persiste no cache da automação (GitHub Actions) e tem uma cópia durável numa versão publicada do repositório. Os arquivos originais de cada coleta não têm cópia, mas a impressão digital de cada um fica registrada no histórico. Se o cache e a cópia se perderem, a automação abre um alerta, os dados publicados continuam corretos e só o registro de revisões anteriores se perde.
                <span data-nivel="analisar">
                  {" "}
                  No vocabulário de engenharia: o histórico de vintages persiste no cache da automação; o silver (banco com vintages e observações) tem cópia durável numa release; os arquivos brutos do bronze não têm, mas o sha256 de cada um fica registrado no silver.
                </span>
              </li>
              <li>Quando a fonte remove uma referência de um arquivo, a remoção não é registrada: a série continua com o último valor publicado para ela. Revisões de valor são registradas.</li>
            </ul>
          </Secao>

          <Secao id="versao" titulo="Versão desta publicação">
            {meta ? (
              <p className="text-sm">
                Último processamento completo dos dados: {carimbo(meta.gerado_em)} · coleta executada nesse processamento: {meta.coleta_executada ? "sim" : "não (reconstrução a partir do estado salvo)"}.
                <span data-nivel="auditar">
                  {" "}
                  Versão do processamento {meta.versao_pipeline}
                  {meta.versao_codigo ? ` · código ${meta.versao_codigo}` : ""} · falhas de construção: {meta.builders_falhos.length} · regressões retidas: {meta.regressoes.length}.
                </span>
              </p>
            ) : (
              <p className="text-sm text-mineral">Metadados da publicação indisponíveis.</p>
            )}
            {datas.length > 0 && (
              <ul className="space-y-1 text-sm text-carvao-muted" data-lista="datas">
                {datas.map((x) => (
                  <li key={x.rotulo}>
                    <strong className="font-medium text-carvao">
                      {x.rotulo}: {x.valor}.
                    </strong>{" "}
                    {maiuscula(x.mede)}.
                  </li>
                ))}
              </ul>
            )}
            {versoes && (
              <p className="text-sm text-carvao-muted" data-versao-do-codigo="">
                {versoes.resumo}{" "}
                <Link href="/setor-eletrico/dados/reproducao#versao-do-codigo" className="text-energia-dark underline underline-offset-4">
                  Ver a versão de cada base
                </Link>
                .<span data-nivel="analisar"> {versoes.sufixo}</span>
              </p>
            )}
          </Secao>
        </ModoProfundidade>
      </main>
    </>
  );
}
