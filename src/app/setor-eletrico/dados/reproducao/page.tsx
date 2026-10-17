import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { DadosArquivos, itensDeArquivos } from "@/components/energia/DadosArquivos";
import { DadosConferirArquivo, DadosManifesto } from "@/components/energia/DadosReproducao";
import { DadosAnalise, DadosAuditoria, DadosAviso, DadosIndisponivel, DadosLimitacoes, DadosNavegacao, DadosResposta, DadosSeguir, ReferenciaDados } from "@/components/energia/DadosPainel";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { COLUNAS_ARQUIVO, commitDoBuild } from "@/lib/energia/datasets";
import { CSV_DADOS, URL_GOLD, linhasManifesto, respostaReproducao, type ParquetEquivalente, type VereditoDoArquivo } from "@/lib/energia/dados";
import { quadroDeDatas, textoEstadoDoArquivo, textoMudancaReproducao, textoVersaoDoCodigo, vereditoReproducao } from "@/lib/energia/dados-leitor";
import { conferirManifestoNoDisco, estadoDoArquivo, manifestoDados, provenienciaDados, publicacaoDados, versoesDoCodigoDasBases } from "@/lib/energia/dados-servidor";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { semDado } from "@/lib/energia/evidencia";
import { lerGold } from "@/lib/energia/gold";
import { tx } from "@/lib/energia/idioma";

export const dynamic = "force-static";

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/dados/reproducao", {
    title: tx("Download e reprodução: refazer os números do observatório do setor elétrico", "Download and reproduction: redo the numbers of the power sector observatory"),
    description: tx(
      "Manifesto com sha256 de cada arquivo publicado, Parquet equivalente conferido célula a célula, dicionário de cada arquivo, versão do código de cada base, versão exata no GitHub e conferência de um arquivo baixado no próprio navegador.",
      "Manifest with the sha256 of each published file, equivalent Parquet checked cell by cell, dictionary of each file, code version of each base, exact version on GitHub and check of a downloaded file in the browser itself.",
    ),
    alternates: { canonical: "/setor-eletrico/dados/reproducao" },
  }, anterior);
}

type ArquivosGold = { arquivos: Record<string, { colunas: string; modulo: string; gold: string }> };

/** Os quatro passos no idioma da página (função, não constante: o texto depende do idioma de quem lê). */
function passos(): readonly (readonly [string, string])[] {
  return [
    [
      tx("1. Filtre e baixe", "1. Filter and download"),
      tx(
        "Em qualquer tabela de painel, filtre e use Baixar CSV ou XLSX: a planilha leva fonte, versão, filtros e dicionário.",
        "In any panel table, filter and use Download CSV or XLSX: the spreadsheet carries source, version, filters and dictionary.",
      ),
    ],
    [
      tx("2. Comprove o número", "2. Verify the number"),
      tx(
        "Em Comprove este número, veja a fórmula, o numerador e o denominador, o arquivo e a impressão digital de origem e como refazer a conta.",
        "In Verify this number, see the formula, the numerator and the denominator, the source file and fingerprint and how to redo the calculation.",
      ),
    ],
    [
      tx("3. Pegue o arquivo completo", "3. Get the complete file"),
      tx(
        "Aqui, baixe o arquivo de origem (CSV, ou a versão compacta Parquet nas séries maiores) e confira a impressão digital com a ferramenta abaixo.",
        "Here, download the source file (CSV, or the compact Parquet version for the larger series) and check the fingerprint with the tool below.",
      ),
    ],
    [
      tx("4. Cite a versão", "4. Cite the version"),
      tx(
        "Use o id da publicação e o link permanente do GitHub: o conteúdo de uma versão registrada não muda.",
        "Use the publication id and the permanent GitHub link: the content of a recorded version does not change.",
      ),
    ],
  ];
}

export default function DadosReproducaoPage() {
  const m = manifestoDados();
  const pub = publicacaoDados();
  if (!m || !pub) return <DadosIndisponivel atual="dados" />;

  const prov = provenienciaDados(pub.proveniencia.reproducao ?? pub.proveniencia.catalogo);
  const rep = pub.reproducao;
  const commit = commitDoBuild();
  const dic = lerGold<ArquivosGold>("arquivos.json")?.arquivos ?? {};
  const conf = conferirManifestoNoDisco(m);
  // estado de cada CSV publicado: o veredito da validação automática e, quando ela reprova, o que a releitura do arquivo publicado mostra
  const estados = new Map(m.arquivos.map((a) => [a.caminho, estadoDoArquivo(a.caminho, pub, m)]));
  const linhas = linhasManifesto(m, dic, new Map(Array.from(estados, ([k, e]): [string, VereditoDoArquivo] => [k, e.veredito])));
  const frasesDeEstado: Record<string, string> = {};
  Array.from(estados).forEach(([k, e]) => {
    const frase = textoEstadoDoArquivo(e).frase;
    if (frase) frasesDeEstado[k] = frase;
  });
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
  const versoes = versoesDoCodigoDasBases(m);
  const codigo = textoVersaoDoCodigo(versoes);
  const ENDERECO = "https://scrutiniums.com/setor-eletrico/dados/reproducao#reproducao";

  const datas = quadroDeDatas({ referencia: pub.referencia.hoje, processadoEm: pub.gerado_em, manifestoEm: m.gerado_em });
  // quando cada base (gold) foi processada, lido da própria lista de arquivos; cada módulo processa a sua em horário próprio
  const basesPorHorario = m.arquivos
    .filter((a) => a.tipo === "gold" && a.gerado_em)
    .map((a) => ({ arquivo: a.caminho.split("/").pop() ?? a.caminho, em: a.gerado_em as string }))
    .sort((a, b) => a.em.localeCompare(b.em));
  const versaoDaBase = new Map(versoes.map((x) => [x.arquivo, x.versao]));

  const oQueMudou = <>{textoMudancaReproducao(m, pub.gerado_em)}</>;
  const comoInterpretar = tx(
    <>
      Confere quer dizer que o arquivo é igual, byte a byte, ao publicado: a impressão digital<span data-nivel="analisar"> (sha256)</span> do arquivo baixado coincide com a da lista. A versão compacta (Parquet) traz os mesmos valores do CSV, conferidos célula a célula na publicação
      <span data-nivel="analisar">, com número lido como decimal</span>, sem perda de precisão. A planilha exportada pela tabela de um painel traz as linhas filtradas, com fonte, versão e dicionário; o arquivo completo de origem é o que está aqui.
    </>,
    <>
      It matches means that the file is identical, byte for byte, to the published one: the fingerprint<span data-nivel="analisar"> (sha256)</span> of the downloaded file coincides with the one in the list. The compact version (Parquet) carries the same values as the
      CSV, checked cell by cell at publication<span data-nivel="analisar">, with numbers read as decimals</span>, with no loss of precision. The spreadsheet exported by the table of a panel carries the filtered rows, with source, version and dictionary; the complete
      source file is the one here.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que um arquivo com impressão digital diferente seja errado: pode ser de outra publicação. Que o histórico completo das capturas esteja aqui: ele não é publicado no repositório, só o resultado de cada atualização. Que reproduzir o arquivo reproduza a coleta: a coleta depende da
      fonte estar no ar. Que refazer uma base a partir da versão do código indicada dê o mesmo arquivo: {codigo.alterado === 1 ? "uma base foi gerada" : `${codigo.alterado} bases foram geradas`} com código que tinha mudanças ainda não registradas.
    </>,
    <>
      That a file with a different fingerprint is wrong: it may be from another publication. That the full history of captures is here: it is not published in the repository, only the result of each update. That reproducing the file reproduces the collection: the
      collection depends on the source being online. That rebuilding a base from the indicated code version gives the same file: {codigo.alterado === 1 ? "one base was generated" : `${codigo.alterado} bases were generated`} with code that had changes not yet recorded.
    </>,
  );
  const arquivos = itensDeArquivos(
    [
      { rotulo: tx("Lista de arquivos da publicação (manifesto, JSON)", "List of files of the publication (manifest, JSON)"), url: URL_GOLD.manifesto },
      { rotulo: tx("Dicionário dos arquivos (JSON)", "Dictionary of the files (JSON)"), url: URL_GOLD.arquivos },
      CSV_DADOS.validacoes,
    ],
    { pub, manifesto: m, dicionario: COLUNAS_ARQUIVO },
  );
  const listaDe = tx(`lista de ${dataBR(m.gerado_em.slice(0, 10))}`, `list of ${dataBR(m.gerado_em.slice(0, 10))}`);

  return (
    <>
      <CabecalhoEnergia atual="dados" />
      <MarcaVisita secao="energia:dados:reproducao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <DadosNavegacao atual="reproducao" />
        <CabecalhoModulo
          titulo={tx("Consigo reproduzir este gráfico?", "Can I reproduce this chart?")}
          lead={tx(
            "Todo número do observatório vem de um arquivo publicado, e cada arquivo tem uma impressão digital registrada numa lista, o manifesto. Aqui estão a lista, a versão do código de cada base, o caminho para refazer um número e a conferência de um arquivo que você baixou.",
            "Every number in the observatory comes from a published file, and each file has a fingerprint recorded in a list, the manifest. Here are the list, the code version of each base, the path to redo a number and the check of a file you downloaded.",
          )}
          recorte={tx(
            `${num(m.totais.arquivos, 0)} arquivos · lista de ${dataBR(m.gerado_em.slice(0, 10))} · id da publicação ${m.id_publicacao.slice(0, 12)}`,
            `${num(m.totais.arquivos, 0)} files · list of ${dataBR(m.gerado_em.slice(0, 10))} · publication id ${m.id_publicacao.slice(0, 12)}`,
          )}
          fonte={tx("lista de arquivos publicados (manifesto) e conferência dos arquivos Parquet", "list of published files (manifest) and check of the Parquet files")}
          referencia={
            <ReferenciaDados
              processadoEm={pub.gerado_em}
              referencia={dataBR(pub.referencia.hoje)}
              manifestoEm={m.gerado_em}
              extra={tx(<>Id da publicação {m.id_publicacao.slice(0, 12)}.</>, <>Publication id {m.id_publicacao.slice(0, 12)}.</>)}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Indicadores da reprodução", "Reproduction indicators")}
              nota={tx("Medidas da lista de arquivos inteira: não mudam com a tabela abaixo.", "Measures of the whole file list: they do not change with the table below.")}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Arquivos publicados", "Published files")}
                natureza="CALCULADO"
                valor={m.totais.arquivos}
                casas={0}
                unidade={tx("arquivos", "files")}
                periodo={listaDe}
                nota={tx(
                  <>
                    {m.totais.golds} bases publicadas, {m.totais.series} séries, {m.totais.parquets} versões compactas e {m.totais.geometrias} malhas geográficas; {num(m.totais.bytes / 1024 / 1024, 0)} MB no total
                  </>,
                  <>
                    {m.totais.golds} published bases, {m.totais.series} series, {m.totais.parquets} compact versions and {m.totais.geometrias} geographic meshes; {num(m.totais.bytes / 1024 / 1024, 0)} MB in total
                  </>,
                )}
                endereco={ENDERECO}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Versões compactas iguais ao CSV", "Compact versions identical to the CSV")}
                natureza="CALCULADO"
                evidencia={evParquet ?? null}
                valor={pq.equivalentes}
                casas={0}
                unidade={tx("arquivos", "files")}
                nota={tx(<>de {num(pq.arquivos, 0)} versões compactas (Parquet), conferidas célula a célula</>, <>of {num(pq.arquivos, 0)} compact versions (Parquet), checked cell by cell</>)}
                motivoAusencia={tx("Sem versão compacta nesta publicação.", "No compact version in this publication.")}
                endereco={ENDERECO}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Arquivos que conferem com a lista", "Files that match the list")}
                natureza="CALCULADO"
                valor={conf.conferidos}
                casas={0}
                unidade={tx("arquivos", "files")}
                periodo={tx("na construção desta página", "when this page was built")}
                nota={tx(
                  <>
                    de {num(conf.total, 0)} listados{conf.divergentes.length + conf.ausentes.length ? `; ${num(conf.divergentes.length + conf.ausentes.length, 0)} não conferem (modo Auditar)` : ""}
                  </>,
                  <>
                    of {num(conf.total, 0)} listed{conf.divergentes.length + conf.ausentes.length ? `; ${num(conf.divergentes.length + conf.ausentes.length, 0)} do not match (Audit mode)` : ""}
                  </>,
                )}
                endereco={ENDERECO}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Bases com o sufixo +alterado na versão do código", "Bases with the +alterado suffix in the code version")}
                natureza="CALCULADO"
                valor={codigo.alterado}
                casas={0}
                unidade={tx(`de ${num(versoes.length, 0)} bases`, `of ${num(versoes.length, 0)} bases`)}
                periodo={listaDe}
                nota={tx(
                  "O código tinha mudanças ainda não registradas quando a base foi gerada: refazer a base a partir da versão indicada pode dar outro resultado.",
                  "The code had changes not yet recorded when the base was generated: rebuilding the base from the indicated version may give a different result.",
                )}
                endereco={ENDERECO}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            "A lista completa, o dicionário de cada arquivo, o link para a versão exata no GitHub, uma versão compacta (Parquet) dos arquivos maiores e a conferência de um arquivo baixado estão nesta página. Nada depende de link temporário.",
            "The complete list, the dictionary of each file, the link to the exact version on GitHub, a compact version (Parquet) of the larger files and the check of a downloaded file are on this page. Nothing depends on a temporary link.",
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="reproducao">
            <PainelEvidencia
              id="painel-reproducao"
              pergunta={tx("Quais são os passos para refazer um número?", "What are the steps to redo a number?")}
              subtitulo={tx(
                `${num(m.totais.arquivos, 0)} arquivos publicados · impressão digital de cada um · versão compacta para as séries maiores`,
                `${num(m.totais.arquivos, 0)} published files · fingerprint of each one · compact version for the larger series`,
              )}
              proveniencia={prov}
              porQueImporta={tx(
                <>
                  Um número que ninguém consegue refazer vale pouco. Com o arquivo, o dicionário, a fórmula e a versão, quem baixa chega ao mesmo agregado que a página mostra, e quem cita sabe exatamente qual versão citou.
                </>,
                <>
                  A number that nobody can redo is worth little. With the file, the dictionary, the formula and the version, whoever downloads arrives at the same aggregate the page shows, and whoever cites knows exactly which version they cited.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <ol className="grid gap-x-8 gap-y-4 md:grid-cols-4" aria-label={tx("Do gráfico ao pacote em quatro passos", "From the chart to the package in four steps")} data-passos="reproducao">
                  {passos().map(([t, d]) => (
                    <li key={t} className="border-t border-linha pt-3">
                      <p className="rotulo text-mineral">{t}</p>
                      <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{d}</p>
                    </li>
                  ))}
                </ol>

                <DadosConferirArquivo itens={minis} idPublicacao={m.id_publicacao} commit={commit} />

                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <DadosResposta depois painel="P069" veredito={vereditoReproducao(m, conf)}>
                  {respostaReproducao(m, pub, conf)}
                </DadosResposta>

                <SecaoDoPainel id="versao-do-codigo" titulo={tx("Com qual versão do código cada base foi gerada?", "With which code version was each base generated?")}>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-versao-do-codigo="">
                    {codigo.resumo} {codigo.sufixo}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="datas-da-publicacao" titulo={tx("Que data é esta? Cada data mede uma coisa diferente", "Which date is this? Each date measures something different")}>
                  <DadosAviso>
                    <ul className="space-y-1" data-lista="datas">
                      {datas.map((x) => (
                        <li key={x.rotulo}>
                          <strong className="font-medium text-carvao">
                            {x.rotulo}: {x.valor}.
                          </strong>{" "}
                          {x.mede.charAt(0).toUpperCase() + x.mede.slice(1)}.
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1">
                      {tx(
                        "Cada módulo do observatório processa a sua base em horário próprio; a lista está em Analisar.",
                        "Each module of the observatory processes its base at its own time; the list is in Analyze.",
                      )}
                    </p>
                  </DadosAviso>
                </SecaoDoPainel>

                <SecaoDoPainel id="tabela" titulo={tx("Quais arquivos foram publicados?", "Which files were published?")}>
                  <DadosManifesto linhas={linhas} versao={versao} commit={commit} dicionarioOperacao={pub.dicionario_operacao} parquets={parquets} estados={frasesDeEstado} />
                </SecaoDoPainel>

                <DadosAnalise titulo={tx("Formato colunar: os Parquet e o CSV de que vieram", "Columnar format: the Parquet files and the CSV they came from")} id="parquet-analise">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      "Parquet guarda a mesma tabela em colunas, com compressão: abre mais rápido em Python, R e DuckDB e ocupa menos. A publicação confere, célula a célula, que o Parquet tem os mesmos valores do CSV (número lido como decimal, com zeros à esquerda e células vazias preservados).",
                      "Parquet stores the same table in columns, with compression: it opens faster in Python, R and DuckDB and takes up less space. The publication checks, cell by cell, that the Parquet has the same values as the CSV (numbers read as decimals, with leading zeros and empty cells preserved).",
                    )}
                  </p>
                  <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx("Parquet publicados e equivalência com o CSV (tabela rolável)", "Published Parquet files and equivalence with the CSV (scrollable table)")}>
                    <table className="w-full min-w-[40rem] border-collapse text-xs">
                      <caption className="sr-only">
                        {tx(
                          "Arquivos Parquet publicados, com o CSV de origem, linhas, tamanhos e a conferência de equivalência",
                          "Published Parquet files, with the source CSV, rows, sizes and the equivalence check",
                        )}
                      </caption>
                      <thead>
                        <tr className="text-left text-mineral">
                          {tx(["CSV de origem", "Linhas", "CSV (KB)", "Parquet (KB)", "Equivalente"], ["Source CSV", "Rows", "CSV (KB)", "Parquet (KB)", "Equivalent"]).map((h) => (
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
                            <td className="px-2 py-1.5 tabular-nums text-carvao-muted">{p.linhas != null ? num(p.linhas, 0) : semDado()}</td>
                            <td className="px-2 py-1.5 tabular-nums text-carvao-muted">{p.bytes_csv != null ? num(p.bytes_csv / 1024, 0) : semDado()}</td>
                            <td className="px-2 py-1.5 tabular-nums text-carvao-muted">{p.bytes_parquet != null ? num(p.bytes_parquet / 1024, 0) : semDado()}</td>
                            <td className="px-2 py-1.5 text-carvao-muted">{p.equivalente ? tx("sim", "yes") : tx("não", "no")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DadosAnalise>

                <DadosAnalise titulo={tx("Reproduzir a partir do repositório", "Reproduce from the repository")} id="passos-repositorio">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    <TrechoPortugues regiao="reproducao-commit">{rep.commit}</TrechoPortugues>
                  </p>
                  <ol className="space-y-2" data-lista="passos-repositorio">
                    {rep.passos.map((p) => (
                      <li key={p}>
                        <pre tabIndex={0} aria-label={tx("Comando (rolável)", "Command (scrollable)")} className="overflow-x-auto border border-linha bg-superficie p-3 font-mono text-xs leading-relaxed text-carvao">
                          <TrechoPortugues regiao="reproducao-comando">{p}</TrechoPortugues>
                        </pre>
                      </li>
                    ))}
                  </ol>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    <TrechoPortugues regiao="reproducao-pacote">{rep.pacote_por_consulta}</TrechoPortugues>
                  </p>
                </DadosAnalise>

                <DadosAnalise titulo={tx("Quando e com qual versão do código cada base foi processada", "When and with which code version each base was processed")} id="bases-por-horario">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      "Cada módulo do observatório gera a sua base em horário próprio; o horário vem da lista de arquivos. A lista de arquivos é refeita depois da última base, por isso a data dela é a mais recente. A versão do código vem do próprio arquivo da base; o sufixo +alterado está explicado acima.",
                      "Each module of the observatory generates its base at its own time; the time comes from the file list. The file list is rebuilt after the last base, so its date is the most recent. The code version comes from the base file itself; the +alterado suffix is explained above.",
                    )}
                  </p>
                  <ul className="grid gap-x-6 text-sm sm:grid-cols-2 lg:grid-cols-3" data-lista="bases-por-horario">
                    {basesPorHorario.map((b) => (
                      <li key={b.arquivo} className="py-0.5">
                        <span className="font-medium text-carvao">{b.arquivo}</span> <span className="text-carvao-muted">{carimbo(b.em)}</span>
                        <span className="block text-xs text-mineral">
                          {tx(`código ${versaoDaBase.get(b.arquivo) ?? "sem versão registrada"}`, `code ${versaoDaBase.get(b.arquivo) ?? "no version recorded"}`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </DadosAnalise>

                <DadosAuditoria titulo={tx("Conferência do manifesto na construção desta página", "Check of the manifest when this page was built")} id="manifesto-auditoria">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      `Na construção da página, cada arquivo listado no manifesto foi lido do pacote publicado e teve tamanho e sha256 comparados com os do manifesto. ${conf.conferidos === conf.total ? `Os ${num(conf.total, 0)} conferiram.` : `${num(conf.conferidos, 0)} de ${num(conf.total, 0)} conferiram.`}`,
                      `When the page was built, each file listed in the manifest was read from the published package and had its size and sha256 compared with those of the manifest. ${conf.conferidos === conf.total ? `All ${num(conf.total, 0)} matched.` : `${num(conf.conferidos, 0)} of ${num(conf.total, 0)} matched.`}`,
                    )}
                  </p>
                  {conf.divergentes.length + conf.ausentes.length > 0 && (
                    <DadosAviso>
                      <p className="rotulo text-mineral">{tx("Não conferem com o manifesto", "Do not match the manifest")}</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5" data-lista="divergentes">
                        {conf.divergentes.map((c) => (
                          <li key={c}>
                            {tx(`${c}: sha256 ou tamanho diferente do manifesto (arquivo reescrito depois dele).`, `${c}: sha256 or size different from the manifest (file rewritten after it).`)}
                          </li>
                        ))}
                        {conf.ausentes.map((c) => (
                          <li key={c}>{tx(`${c}: arquivo ausente do pacote publicado.`, `${c}: file missing from the published package.`)}</li>
                        ))}
                      </ul>
                    </DadosAviso>
                  )}
                  <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="rotulo text-mineral">{tx("Id da publicação", "Publication id")}</dt>
                      <dd className="mt-0.5 break-all font-mono text-xs text-carvao-muted">{m.id_publicacao}</dd>
                    </div>
                    <div>
                      <dt className="rotulo text-mineral">{tx("Manifesto completo", "Complete manifest")}</dt>
                      <dd className="mt-0.5 text-carvao-muted">
                        {m.completo
                          ? tx("sim: lista todos os arquivos publicados", "yes: it lists all the published files")
                          : tx(
                              `não: ${num(m.fora_do_manifesto.length, 0)} arquivos reescritos depois do módulo Dados ficam fora`,
                              `no: ${num(m.fora_do_manifesto.length, 0)} files rewritten after the Data module are left out`,
                            )}
                      </dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className="rotulo text-mineral">{tx("Regra do id", "Id rule")}</dt>
                      <dd className="mt-0.5 leading-relaxed text-carvao-muted">
                        <TrechoPortugues regiao="reproducao-regra-id">{m.regra_id}</TrechoPortugues>
                      </dd>
                    </div>
                    {m.fora_do_manifesto.length > 0 && (
                      <div className="md:col-span-2">
                        <dt className="rotulo text-mineral">{tx("Fora do manifesto", "Outside the manifest")}</dt>
                        <dd className="mt-0.5 leading-relaxed text-carvao-muted">
                          <ul className="list-disc pl-5">
                            {m.fora_do_manifesto.map((f) => (
                              <li key={f.caminho}>
                                {f.caminho}: <TrechoPortugues regiao="reproducao-fora">{f.motivo}</TrechoPortugues>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                  </dl>
                  <div>
                    <p className="rotulo text-mineral">{tx("Dicionário das bases de operação", "Dictionary of the operation bases")}</p>
                    <dl className="mt-2 space-y-2 text-sm" data-lista="dicionario-operacao">
                      {Object.entries(pub.dicionario_operacao).map(([k, v]) => (
                        <div key={k}>
                          <dt className="font-medium text-carvao [overflow-wrap:anywhere]">{k}</dt>
                          <dd className="mt-0.5 leading-relaxed text-carvao-muted">
                            <TrechoPortugues regiao="reproducao-dicionario">{v}</TrechoPortugues>
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-2 text-xs text-carvao-muted">
                      {tx(
                        "Os arquivos dos demais módulos têm o dicionário no arquivo de dicionários e na ficha de cada arquivo, acima.",
                        "The files of the other modules have their dictionary in the dictionary file and in the record of each file, above.",
                      )}
                    </p>
                  </div>
                </DadosAuditoria>

                <DadosLimitacoes
                  itens={[
                    tx(
                      <>Os arquivos CSV maiores que {num(limiarMb, 0)} MB têm também uma versão compacta (Parquet); os menores só têm CSV.</>,
                      <>CSV files larger than {num(limiarMb, 0)} MB also have a compact version (Parquet); the smaller ones only have CSV.</>,
                    ),
                    tx(
                      <>O histórico completo de capturas, com as versões anteriores de cada dado, não é publicado no repositório (ocupa centenas de MB); uma cópia durável fica numa versão publicada do repositório, sobrescrita a cada execução.</>,
                      <>The full history of captures, with the previous versions of each data point, is not published in the repository (it takes up hundreds of MB); a durable copy is kept in a published release of the repository, overwritten at each run.</>,
                    ),
                    <>
                      {commit
                        ? tx("O link da versão exata aponta o código do build desta página.", "The exact version link points to the code of the build of this page.")
                        : tx(
                            "O link da versão exata depende de o site saber de qual versão do código foi construído; esta construção não sabe, e o link aponta o histórico do arquivo. A impressão digital da lista identifica a versão.",
                            "The exact version link depends on the site knowing which code version it was built from; this build does not know, and the link points to the file history. The fingerprint in the list identifies the version.",
                          )}
                    </>,
                  ]}
                  tecnicas={[
                    <TrechoPortugues key="silver" regiao="reproducao-silver">
                      {rep.silver}
                    </TrechoPortugues>,
                    commit
                      ? tx(`Commit deste build: ${commit}.`, `Commit of this build: ${commit}.`)
                      : tx(
                          "Este build não conhece o commit: o link da versão aponta o histórico do arquivo, e o sha256 do manifesto identifica a versão.",
                          "This build does not know the commit: the version link points to the file history, and the sha256 of the manifest identifies the version.",
                        ),
                    ...prov.limitacoes.map((l) => (
                      <TrechoPortugues key={l} regiao="reproducao-limitacoes">
                        {l}
                      </TrechoPortugues>
                    )),
                  ]}
                />

                <SecaoDoPainel id="arquivos" titulo={tx("Quais arquivos posso baixar?", "Which files can I download?")}>
                  <DadosArquivos itens={arquivos} />
                </SecaoDoPainel>
                <DadosSeguir ancora="painel-reproducao" proximo={{ href: "/setor-eletrico/metodologia", pergunta: tx("Do arquivo ao número que você vê", "From the file to the number you see") }} downloads={[]} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
