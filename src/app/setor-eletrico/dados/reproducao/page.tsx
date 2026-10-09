import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { DadosConferirArquivo, DadosManifesto } from "@/components/energia/DadosReproducao";
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
import { Numero } from "@/components/energia/Numero";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { commitDoBuild } from "@/lib/energia/datasets";
import { CSV_DADOS, URL_GOLD, linhasManifesto, respostaReproducao, type ParquetEquivalente } from "@/lib/energia/dados";
import { quadroDeDatas, textoMudancaReproducao, vereditoReproducao } from "@/lib/energia/dados-leitor";
import { conferirManifestoNoDisco, manifestoDados, provenienciaDados, publicacaoDados } from "@/lib/energia/dados-servidor";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { lerGold } from "@/lib/energia/gold";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Download e reprodução: refazer os números do observatório do setor elétrico",
  description:
    "Manifesto com sha256 de cada arquivo publicado, Parquet equivalente conferido célula a célula, dicionário de cada arquivo, versão exata no GitHub e conferência de um arquivo baixado no próprio navegador.",
  alternates: { canonical: "/setor-eletrico/dados/reproducao" },
};

type ArquivosGold = { arquivos: Record<string, { colunas: string; modulo: string; gold: string }> };

export default function DadosReproducaoPage() {
  const m = manifestoDados();
  const pub = publicacaoDados();
  if (!m || !pub) return <DadosIndisponivel atual="dados" />;

  const prov = provenienciaDados(pub.proveniencia.reproducao ?? pub.proveniencia.catalogo);
  const rep = pub.reproducao;
  const commit = commitDoBuild();
  const dic = lerGold<ArquivosGold>("arquivos.json")?.arquivos ?? {};
  const linhas = linhasManifesto(m, dic);
  const conf = conferirManifestoNoDisco(m);
  const parquets: Record<string, ParquetEquivalente> = {};
  for (const p of pub.arquivos.parquet) {
    if (!p.csv) continue;
    parquets[p.csv] = { parquet: p.parquet, bytes_csv: p.bytes_csv ?? null, bytes_parquet: p.bytes_parquet ?? null, linhas: p.linhas ?? null, equivalente: p.equivalente === true };
  }
  const evParquet = pub.evidencias.parquet_equivalentes;
  const pq = pub.resumo.parquet;
  const versao = m.gerado_em;
  const minis = m.arquivos.map((a) => ({ caminho: a.caminho, sha256: a.sha256, bytes: a.bytes }));
  const limiarMb = pub.arquivos.limiar_parquet_bytes / 1024 / 1024;

  const datas = quadroDeDatas({ referencia: pub.referencia.hoje, processadoEm: pub.gerado_em, manifestoEm: m.gerado_em });
  // quando cada base (gold) foi processada, lido da própria lista de arquivos; cada módulo processa a sua em horário próprio
  const basesPorHorario = m.arquivos
    .filter((a) => a.tipo === "gold" && a.gerado_em)
    .map((a) => ({ arquivo: a.caminho.split("/").pop() ?? a.caminho, em: a.gerado_em as string }))
    .sort((a, b) => a.em.localeCompare(b.em));

  return (
    <>
      <CabecalhoEnergia atual="dados" />
      <MarcaVisita secao="energia:dados:reproducao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          rotulo="Dados e metodologia"
          titulo="Consigo reproduzir este gráfico?"
          referencia={<ReferenciaDados processadoEm={pub.gerado_em} referencia={dataBR(pub.referencia.hoje)} manifestoEm={m.gerado_em} extra={<>Id da publicação {m.id_publicacao.slice(0, 12)}.</>} />}
        >
          Todo número do observatório vem de um arquivo publicado, e cada arquivo tem uma impressão digital registrada numa lista, o manifesto. Aqui estão a lista completa, o dicionário de cada arquivo, o link para a versão exata no GitHub, uma versão compacta (Parquet) dos arquivos
          maiores e a conferência de um arquivo baixado. Nada depende de link temporário.
        </CabecalhoModulo>
        <DadosNavegacao atual="reproducao" />

        <ModoProfundidade>
          <Bloco id="reproducao">
            <PainelEvidencia
              id="painel-reproducao"
              pergunta="Consigo reproduzir este gráfico?"
              subtitulo={`${num(m.totais.arquivos, 0)} arquivos publicados · impressão digital de cada um · versão compacta para as séries maiores`}
              proveniencia={prov}
              porQueImporta={
                <>
                  Um número que ninguém consegue refazer vale pouco. Com o arquivo, o dicionário, a fórmula e a versão, quem baixa chega ao mesmo agregado que a página mostra, e quem cita sabe exatamente qual versão citou.
                </>
              }
              oQueMudou={<>{textoMudancaReproducao(m, pub.gerado_em)}</>}
              comoInterpretar={
                <>
                  Confere quer dizer que o arquivo é igual, byte a byte, ao publicado: a impressão digital<span data-nivel="analisar"> (sha256)</span> do arquivo baixado coincide com a da lista. A versão compacta (Parquet) traz os mesmos valores do CSV, conferidos célula a célula na publicação<span data-nivel="analisar">, com número lido como decimal</span>, sem perda de precisão. A planilha
                  exportada pela tabela de um painel traz as linhas filtradas, com fonte, versão e dicionário; o arquivo completo de origem é o que está aqui.
                </>
              }
              naoConcluir={
                <>
                  Que um arquivo com impressão digital diferente seja errado: pode ser de outra publicação. Que o histórico completo das capturas esteja aqui: ele não é publicado no repositório, só o resultado de cada atualização. Que reproduzir o arquivo reproduza a coleta: a coleta
                  depende da fonte estar no ar.
                </>
              }
            >
              <DadosResposta
                painel="P069"
                veredito={vereditoReproducao(m, conf)}
                prova={evParquet ? <ComproveNumero evidencia={evParquet} rotulo="Comprove as versões compactas iguais ao CSV" endereco="https://scrutiniums.com/setor-eletrico/dados/reproducao#reproducao" /> : undefined}
              >
                {respostaReproducao(m, pub, conf)}
              </DadosResposta>

              <ol className="mb-6 grid gap-px border border-linha bg-linha md:grid-cols-4" aria-label="Do gráfico ao pacote em quatro passos" data-passos="reproducao">
                {[
                  ["1. Filtre e baixe", "Em qualquer tabela de painel, filtre e use Baixar CSV ou XLSX: a planilha leva fonte, versão, filtros e dicionário."],
                  ["2. Comprove o número", "Em Comprove este número, veja a fórmula, o numerador e o denominador, o arquivo e a impressão digital de origem e como refazer a conta."],
                  ["3. Pegue o arquivo completo", "Aqui, baixe o arquivo de origem (CSV, ou a versão compacta Parquet nas séries maiores) e confira a impressão digital com a ferramenta abaixo."],
                  ["4. Cite a versão", "Use o id da publicação e o link permanente do GitHub: o conteúdo de uma versão registrada não muda."],
                ].map(([t, d]) => (
                  <li key={t} className="bg-superficie p-4">
                    <p className="rotulo text-mineral">{t}</p>
                    <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{d}</p>
                  </li>
                ))}
              </ol>

              <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Numero rotulo="Arquivos publicados" natureza="CALCULADO" valor={m.totais.arquivos} casas={0} unidade="arquivos" tamanho="medio" periodo={`lista de ${dataBR(m.gerado_em.slice(0, 10))}`} nota={<>{m.totais.golds} bases publicadas, {m.totais.series} séries, {m.totais.parquets} versões compactas e {m.totais.geometrias} malhas geográficas</>} endereco="https://scrutiniums.com/setor-eletrico/dados/reproducao#reproducao" />
                <Numero
                  rotulo="Versões compactas iguais ao CSV"
                  natureza="CALCULADO"
                  evidencia={evParquet ?? null}
                  valor={pq.equivalentes}
                  casas={0}
                  unidade="arquivos"
                  tamanho="medio"
                  nota={<>de {num(pq.arquivos, 0)} versões compactas (Parquet), conferidas célula a célula</>}
                  motivoAusencia="Sem versão compacta nesta publicação."
                  endereco="https://scrutiniums.com/setor-eletrico/dados/reproducao#reproducao"
                />
                <Numero
                  rotulo="Arquivos que conferem com a lista"
                  natureza="CALCULADO"
                  valor={conf.conferidos}
                  casas={0}
                  unidade="arquivos"
                  tamanho="medio"
                  periodo="na construção desta página"
                  nota={<>de {num(conf.total, 0)} listados{conf.divergentes.length + conf.ausentes.length ? `; ${num(conf.divergentes.length + conf.ausentes.length, 0)} não conferem (modo Auditar)` : ""}</>}
                  endereco="https://scrutiniums.com/setor-eletrico/dados/reproducao#reproducao"
                />
                <Numero rotulo="Tamanho da publicação" natureza="CALCULADO" valor={m.totais.bytes / 1024 / 1024} casas={0} unidade="MB" tamanho="medio" periodo={`lista de ${dataBR(m.gerado_em.slice(0, 10))}`} nota={<>soma dos arquivos da lista</>} endereco="https://scrutiniums.com/setor-eletrico/dados/reproducao#reproducao" />
              </div>
              <DadosRecorte
                periodo={<>publicação de {dataBR(m.gerado_em.slice(0, 10))} (id {m.id_publicacao.slice(0, 12)}); pacote por consulta, na data do download</>}
                universo={`${num(m.totais.arquivos, 0)} arquivos publicados (bases, séries, versões compactas e malhas geográficas)`}
                unidade="bytes e KB; linhas e colunas de cada CSV"
              />
              <DadosAviso id="datas-da-publicacao">
                <p className="rotulo text-mineral">Que data é esta? Cada data mede uma coisa diferente</p>
                <ul className="mt-1 space-y-1" data-lista="datas">
                  {datas.map((x) => (
                    <li key={x.rotulo}>
                      <strong className="font-medium text-carvao">{x.rotulo}: {x.valor}.</strong> {x.mede.charAt(0).toUpperCase() + x.mede.slice(1)}.
                    </li>
                  ))}
                </ul>
                <p className="mt-1">Cada módulo do observatório processa a sua base em horário próprio; a lista está em Analisar.</p>
              </DadosAviso>

              <DadosConferirArquivo itens={minis} idPublicacao={m.id_publicacao} commit={commit} />

              <div id="tabela" className="mt-8 scroll-mt-28">
                <DadosManifesto linhas={linhas} versao={versao} commit={commit} dicionarioOperacao={pub.dicionario_operacao} parquets={parquets} />
              </div>

              <DadosLimitacoes
                itens={[
                  <>Os arquivos CSV maiores que {num(limiarMb, 0)} MB têm também uma versão compacta (Parquet); os menores só têm CSV.</>,
                  <>O histórico completo de capturas, com as versões anteriores de cada dado, não é publicado no repositório (ocupa centenas de MB); uma cópia durável fica numa versão publicada do repositório, sobrescrita a cada execução.</>,
                  <>
                    {commit
                      ? "O link da versão exata aponta o código do build desta página."
                      : "O link da versão exata depende de o site saber de qual versão do código foi construído; esta construção não sabe, e o link aponta o histórico do arquivo. A impressão digital da lista identifica a versão."}
                  </>,
                ]}
                tecnicas={[rep.silver, commit ? `Commit deste build: ${commit}.` : "Este build não conhece o commit: o link da versão aponta o histórico do arquivo, e o sha256 do manifesto identifica a versão.", ...prov.limitacoes]}
              />
              <DadosSeguir
                ancora="painel-reproducao"
                proximo={{ href: "/setor-eletrico/metodologia", pergunta: "Quais interpretações são permitidas?" }}
                downloads={[
                  { rotulo: "Lista de arquivos da publicação (manifesto, JSON)", url: URL_GOLD.manifesto },
                  { rotulo: "Dicionário dos arquivos (JSON)", url: URL_GOLD.arquivos },
                  CSV_DADOS.validacoes,
                ]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="parquet">
            <DadosAnalise titulo="Formato colunar: os Parquet e o CSV de que vieram" id="parquet-analise">
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                Parquet guarda a mesma tabela em colunas, com compressão: abre mais rápido em Python, R e DuckDB e ocupa menos. A publicação confere, célula a célula, que o Parquet tem os mesmos valores do CSV (número lido como decimal, com zeros à esquerda e células vazias preservados).
              </p>
              <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Parquet publicados e equivalência com o CSV (tabela rolável)">
                <table className="w-full min-w-[40rem] border-collapse text-xs">
                  <caption className="sr-only">Arquivos Parquet publicados, com o CSV de origem, linhas, tamanhos e a conferência de equivalência</caption>
                  <thead>
                    <tr className="text-left text-mineral">
                      {["CSV de origem", "Linhas", "CSV (KB)", "Parquet (KB)", "Equivalente"].map((h) => (
                        <th key={h} scope="col" className="border-b border-linha px-2 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pub.arquivos.parquet.map((p) => (
                      <tr key={p.parquet} className="border-b border-linha">
                        <td className="px-2 py-1.5 text-carvao [overflow-wrap:anywhere]">{(p.csv ?? p.parquet).replace("/energia/", "")}</td>
                        <td className="px-2 py-1.5 tabular-nums text-carvao-muted">{p.linhas != null ? num(p.linhas, 0) : "sem dado"}</td>
                        <td className="px-2 py-1.5 tabular-nums text-carvao-muted">{p.bytes_csv != null ? num(p.bytes_csv / 1024, 0) : "sem dado"}</td>
                        <td className="px-2 py-1.5 tabular-nums text-carvao-muted">{p.bytes_parquet != null ? num(p.bytes_parquet / 1024, 0) : "sem dado"}</td>
                        <td className="px-2 py-1.5 text-carvao-muted">{p.equivalente ? "sim" : "não"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DadosAnalise>
            <DadosAnalise titulo="Reproduzir a partir do repositório" id="passos-repositorio">
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{rep.commit}</p>
              <ol className="space-y-2" data-lista="passos-repositorio">
                {rep.passos.map((p) => (
                  <li key={p}>
                    <pre tabIndex={0} aria-label="Comando (rolável)" className="overflow-x-auto border border-linha bg-superficie p-3 font-mono text-xs leading-relaxed text-carvao">
                      {p}
                    </pre>
                  </li>
                ))}
              </ol>
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{rep.pacote_por_consulta}</p>
            </DadosAnalise>
          </Bloco>

          <Bloco id="processamento-das-bases">
            <DadosAnalise titulo="Quando cada base foi processada" id="bases-por-horario">
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                Cada módulo do observatório gera a sua base em horário próprio; o horário vem da lista de arquivos. A lista de arquivos é refeita depois da última base, por isso a data dela é a mais recente.
              </p>
              <ul className="grid gap-x-6 text-sm sm:grid-cols-2 lg:grid-cols-3" data-lista="bases-por-horario">
                {basesPorHorario.map((b) => (
                  <li key={b.arquivo} className="py-0.5">
                    <span className="font-medium text-carvao">{b.arquivo}</span> <span className="text-carvao-muted">{carimbo(b.em)}</span>
                  </li>
                ))}
              </ul>
            </DadosAnalise>
          </Bloco>

          <Bloco id="auditoria-reproducao">
            <DadosAuditoria titulo="Conferência do manifesto na construção desta página" id="manifesto-auditoria">
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                Na construção da página, cada arquivo listado no manifesto foi lido do pacote publicado e teve tamanho e sha256 comparados com os do manifesto. {conf.conferidos === conf.total ? `Os ${num(conf.total, 0)} conferiram.` : `${num(conf.conferidos, 0)} de ${num(conf.total, 0)} conferiram.`}
              </p>
              {conf.divergentes.length + conf.ausentes.length > 0 && (
                <DadosAviso>
                  <p className="rotulo text-mineral">Não conferem com o manifesto</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5" data-lista="divergentes">
                    {conf.divergentes.map((c) => (
                      <li key={c}>{c}: sha256 ou tamanho diferente do manifesto (arquivo reescrito depois dele).</li>
                    ))}
                    {conf.ausentes.map((c) => (
                      <li key={c}>{c}: arquivo ausente do pacote publicado.</li>
                    ))}
                  </ul>
                </DadosAviso>
              )}
              <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
                <div className="min-w-0">
                  <dt className="rotulo text-mineral">Id da publicação</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs text-carvao-muted">{m.id_publicacao}</dd>
                </div>
                <div>
                  <dt className="rotulo text-mineral">Manifesto completo</dt>
                  <dd className="mt-0.5 text-carvao-muted">
                    {m.completo ? "sim: lista todos os arquivos publicados" : `não: ${num(m.fora_do_manifesto.length, 0)} arquivos reescritos depois do módulo Dados ficam fora`}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="rotulo text-mineral">Regra do id</dt>
                  <dd className="mt-0.5 leading-relaxed text-carvao-muted">{m.regra_id}</dd>
                </div>
                {m.fora_do_manifesto.length > 0 && (
                  <div className="md:col-span-2">
                    <dt className="rotulo text-mineral">Fora do manifesto</dt>
                    <dd className="mt-0.5 leading-relaxed text-carvao-muted">
                      <ul className="list-disc pl-5">
                        {m.fora_do_manifesto.map((f) => (
                          <li key={f.caminho}>
                            {f.caminho}: {f.motivo}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
              </dl>
              <div>
                <p className="rotulo text-mineral">Dicionário das bases de operação</p>
                <dl className="mt-2 space-y-2 text-sm" data-lista="dicionario-operacao">
                  {Object.entries(pub.dicionario_operacao).map(([k, v]) => (
                    <div key={k}>
                      <dt className="font-medium text-carvao [overflow-wrap:anywhere]">{k}</dt>
                      <dd className="mt-0.5 leading-relaxed text-carvao-muted">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-xs text-carvao-muted">Os arquivos dos demais módulos têm o dicionário no arquivo de dicionários e na ficha de cada arquivo, acima.</p>
              </div>
            </DadosAuditoria>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
