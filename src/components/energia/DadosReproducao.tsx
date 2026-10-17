"use client";

import { useEffect, useId, useState } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { carregaJson, lerCaminho } from "@/lib/energia/carregaJson";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { formatos } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { COLUNAS_MANIFESTO, URL_GOLD, conferirArquivo, urlVersao, type ConferenciaArquivo, type ParquetEquivalente } from "@/lib/energia/dados";
import type { ItemManifesto } from "@/lib/energia/tipos-dados";
import type { LinhaTabela } from "@/lib/energia/tabela";

/**
 * P069, download e reprodução: a tabela de todos os arquivos publicados com o sha256 do
 * manifesto, a ficha de cada um (download, versão permanente no GitHub, dicionário, colunas e
 * Parquet equivalente, lidos sob demanda) e a conferência de um arquivo baixado: o navegador
 * calcula o sha256 do arquivo escolhido e compara com o manifesto. O arquivo não sai do
 * computador do leitor. Nada depende de link temporário: o caminho é o publicado e a versão
 * exata é o commit.
 */

const ESQUEMA = { a: campo(tiposUrl.texto({ max: 300 }), "") };

type Mini = Pick<ItemManifesto, "caminho" | "sha256" | "bytes">;

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");

type Estado = { fase: "vazio" } | { fase: "lendo"; nome: string } | { fase: "erro"; motivo: string } | { fase: "pronto"; nome: string; bytes: number; sha256: string; conf: ConferenciaArquivo };

export function DadosConferirArquivo({ itens, idPublicacao, commit }: { itens: Mini[]; idPublicacao: string; commit: string | null }) {
  const id = useId();
  const tx = useTx();
  const { num } = formatos(useIdioma());
  const [e, setE] = useState<Estado>({ fase: "vazio" });
  async function escolher(f: File | undefined) {
    if (!f) return;
    if (typeof crypto === "undefined" || !crypto.subtle) {
      setE({
        fase: "erro",
        motivo: tx(
          "Este navegador só calcula a impressão digital do arquivo em página segura (https). Calcule-a com outro programa (por exemplo, o comando sha256sum) e compare com a última coluna da tabela.",
          "This browser only computes the file fingerprint on a secure page (https). Compute it with another program (for example, the sha256sum command) and compare it with the last column of the table.",
        ),
      });
      return;
    }
    setE({ fase: "lendo", nome: f.name });
    try {
      const sha256 = hex(await crypto.subtle.digest("SHA-256", await f.arrayBuffer()));
      setE({ fase: "pronto", nome: f.name, bytes: f.size, sha256, conf: conferirArquivo(sha256, f.name, itens as ItemManifesto[]) });
    } catch (x) {
      setE({ fase: "erro", motivo: x instanceof Error ? x.message : String(x) });
    }
  }
  return (
    <div className="space-y-3 border border-linha bg-papel p-4 md:p-5" data-conferencia="arquivo">
      <label htmlFor={id} className="block">
        <span className="rotulo text-mineral">{tx("Conferir um arquivo que você baixou", "Check a file you downloaded")}</span>
        {tx(
          <span className="mt-1 block text-sm leading-relaxed text-carvao-muted">
            Escolha um arquivo CSV, Parquet ou JSON baixado do observatório. O navegador calcula a impressão digital do arquivo<span data-nivel="analisar"> (sha256)</span> e compara com a lista da publicação (id {idPublicacao.slice(0, 12)}); o arquivo não sai do seu computador.
          </span>,
          <span className="mt-1 block text-sm leading-relaxed text-carvao-muted">
            Choose a CSV, Parquet or JSON file downloaded from the observatory. The browser computes the file fingerprint<span data-nivel="analisar"> (sha256)</span> and compares it with the publication list (id {idPublicacao.slice(0, 12)}); the file does not leave your computer.
          </span>,
        )}
      </label>
      <input id={id} type="file" onChange={(ev) => escolher(ev.target.files?.[0])} className="block min-h-[44px] w-full text-sm text-carvao file:mr-3 file:min-h-[44px] file:border file:border-linha file:bg-superficie file:px-3 file:text-carvao hover:file:border-energia" />
      <div role="status" aria-live="polite" className="text-sm leading-relaxed">
        {e.fase === "lendo" && <p className="text-carvao-muted">{tx(`Calculando a impressão digital de ${e.nome}…`, `Computing the fingerprint of ${e.nome}…`)}</p>}
        {e.fase === "erro" && (
          <p className="text-erro">
            {tx("Não foi possível conferir:", "The check could not be done:")} {e.motivo}
          </p>
        )}
        {e.fase === "pronto" && (
          <div data-resultado={e.conf.resultado} className="space-y-1">
            <p className={e.conf.resultado === "igual" ? "text-sucesso" : "text-aviso"}>
              {e.conf.resultado === "igual" &&
                tx(
                  <>
                    Confere: a impressão digital de {e.nome} é a de <strong className="font-medium">{e.conf.item.caminho}</strong> na lista desta publicação.
                  </>,
                  <>
                    It matches: the fingerprint of {e.nome} is that of <strong className="font-medium">{e.conf.item.caminho}</strong> in the list of this publication.
                  </>,
                )}
              {e.conf.resultado === "outra_versao" &&
                tx(
                  <>
                    Não confere: a lista tem um arquivo de mesmo nome (<strong className="font-medium">{e.conf.item.caminho}</strong>) com outra impressão digital. É outra versão da publicação ou o arquivo foi alterado depois do download.
                  </>,
                  <>
                    It does not match: the list has a file with the same name (<strong className="font-medium">{e.conf.item.caminho}</strong>) with another fingerprint. It is another version of the publication or the file was changed after the download.
                  </>,
                )}
              {e.conf.resultado === "desconhecido" &&
                tx(
                  <>Não confere: nenhum arquivo da lista tem esta impressão digital nem este nome. O arquivo é de outra publicação ou não é um arquivo publicado aqui.</>,
                  <>It does not match: no file in the list has this fingerprint or this name. The file is from another publication or is not a file published here.</>,
                )}
            </p>
            <p className="text-xs text-carvao-muted">
              {num(e.bytes, 0)} bytes · {tx("impressão digital", "fingerprint")} <span className="break-all font-mono">{e.sha256}</span>
            </p>
            {e.conf.resultado === "outra_versao" && (
              <p className="text-xs text-carvao-muted">
                {tx("Na lista:", "In the list:")} {num(e.conf.item.bytes, 0)} bytes · {tx("impressão digital", "fingerprint")} <span className="break-all font-mono">{e.conf.item.sha256}</span>.{" "}
                <a href={urlVersao(e.conf.item.caminho, commit).url} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                  {tx("Histórico do arquivo no GitHub ↗", "File history on GitHub ↗")}
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type Ficha = { estado: "carregando" } | { estado: "erro"; motivo: string } | { estado: "ok"; colunas: string[] | null; dicionario: string | null };

function FichaArquivo({
  caminho,
  commit,
  dicionarioOperacao,
  parquets,
  estados,
}: {
  caminho: string;
  commit: string | null;
  dicionarioOperacao: Record<string, string>;
  parquets: Record<string, ParquetEquivalente>;
  estados: Record<string, string>;
}) {
  const tx = useTx();
  const { num } = formatos(useIdioma());
  const [f, setF] = useState<Ficha>({ estado: "carregando" });
  const [item, setItem] = useState<ItemManifesto | null>(null);
  useEffect(() => {
    let vivo = true;
    setF({ estado: "carregando" });
    Promise.all([carregaJson<unknown>(URL_GOLD.manifesto), carregaJson<unknown>(URL_GOLD.arquivos)])
      .then(([m, a]) => {
        if (!vivo) return;
        const itens = (lerCaminho(m, "arquivos") as ItemManifesto[] | undefined) ?? [];
        const it = itens.find((x) => x.caminho === caminho) ?? null;
        const dic = (lerCaminho(a, "arquivos") as Record<string, { colunas?: string }> | undefined)?.[caminho]?.colunas ?? dicionarioOperacao[caminho] ?? null;
        setItem(it);
        setF({ estado: "ok", colunas: it?.colunas ?? null, dicionario: dic });
      })
      .catch((x: Error) => vivo && setF({ estado: "erro", motivo: x.message }));
    return () => {
      vivo = false;
    };
  }, [caminho, dicionarioOperacao]);
  const v = urlVersao(caminho, commit);
  const pq = parquets[caminho];
  return (
    <div className="space-y-3 text-sm" data-ficha-arquivo={caminho}>
      <p className="font-medium text-carvao [overflow-wrap:anywhere]">{caminho}</p>
      <ul className="flex flex-wrap gap-x-6 gap-y-1">
        <li>
          <a href={caminho} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            {tx("Baixar o arquivo", "Download the file")}
          </a>
        </li>
        <li>
          <a href={v.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            {v.exata ? tx("Versão exata deste build no GitHub ↗", "Exact version of this build on GitHub ↗") : tx("Histórico do arquivo no GitHub ↗", "File history on GitHub ↗")}
          </a>
        </li>
        {pq && (
          <li>
            <a href={pq.parquet} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
              {tx("Baixar o Parquet equivalente", "Download the equivalent Parquet")}
            </a>
          </li>
        )}
      </ul>
      {estados[caminho] && (
        <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-estado-arquivo="">
          {estados[caminho]}
        </p>
      )}
      {pq && (
        <p className="text-xs leading-relaxed text-carvao-muted">
          Parquet: {pq.linhas !== null ? tx(`${num(pq.linhas, 0)} linhas, `, `${num(pq.linhas, 0)} rows, `) : ""}
          {pq.bytes_parquet !== null && pq.bytes_csv !== null
            ? tx(`${num(pq.bytes_parquet / 1024, 0)} KB contra ${num(pq.bytes_csv / 1024, 0)} KB do CSV, `, `${num(pq.bytes_parquet / 1024, 0)} KB against ${num(pq.bytes_csv / 1024, 0)} KB for the CSV, `)
            : ""}
          {pq.equivalente ? tx("conferido célula a célula contra o CSV", "checked cell by cell against the CSV") : tx("não conferido: não use como equivalente", "not checked: do not use as an equivalent")}.
        </p>
      )}
      {f.estado === "carregando" && (
        <p role="status" className="text-carvao-muted">
          {tx("Lendo o dicionário e as colunas…", "Reading the dictionary and the columns…")}
        </p>
      )}
      {f.estado === "erro" && (
        <p role="alert" className="text-erro">
          {tx("Não foi possível ler o dicionário:", "The dictionary could not be read:")} {f.motivo}
        </p>
      )}
      {f.estado === "ok" && (
        <>
          <div>
            <p className="rotulo text-mineral">{tx("Dicionário", "Dictionary")}</p>
            <p className="mt-0.5 max-w-prose2 leading-relaxed text-carvao-muted">
              {f.dicionario !== null ? <TrechoPortugues regiao="dados-dicionario">{f.dicionario}</TrechoPortugues> : tx("Sem dicionário publicado para este arquivo.", "No dictionary published for this file.")}
            </p>
          </div>
          {f.colunas && (
            <div>
              <p className="rotulo text-mineral">{tx(`Colunas (${f.colunas.length}), na ordem do arquivo`, `Columns (${f.colunas.length}), in the order of the file`)}</p>
              <p className="mt-0.5 break-words font-mono text-xs leading-relaxed text-carvao-muted">{f.colunas.join(" · ")}</p>
            </div>
          )}
          {item && (
            <p className="text-xs text-mineral">
              {tx(`Na lista de arquivos: ${num(item.bytes, 0)} bytes`, `In the file list: ${num(item.bytes, 0)} bytes`)}
              {item.linhas !== undefined ? tx(` · ${num(item.linhas, 0)} linhas`, ` · ${num(item.linhas, 0)} rows`) : ""} · {tx("impressão digital", "fingerprint")}{" "}
              <span className="break-all font-mono">{item.sha256}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function DadosManifesto({
  linhas,
  versao,
  commit,
  dicionarioOperacao,
  parquets,
  estados,
}: {
  linhas: LinhaTabela[];
  versao: string;
  commit: string | null;
  dicionarioOperacao: Record<string, string>;
  parquets: Record<string, ParquetEquivalente>;
  /** Estado da validação automática de cada CSV, em uma frase (o que a validação disse e o que a releitura do arquivo publicado mostra). */
  estados: Record<string, string>;
}) {
  const tx = useTx();
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const escolhida = v.a ? linhas.find((l) => l.id === v.a) : undefined;
  return (
    <div className="space-y-5">
      <TabelaInterativa
        titulo={tx("Arquivos publicados, com tamanho, linhas, dicionário e impressão digital", "Published files, with size, rows, dictionary and fingerprint")}
        colunas={COLUNAS_MANIFESTO}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="caminho"
        fonte={tx(
          "Scrutiniums, lista de arquivos publicados em /energia/ (manifesto: impressão digital e tamanho de cada arquivo)",
          "Scrutiniums, list of files published in /energia/ (manifest: fingerprint and size of each file)",
        )}
        versao={versao}
        nomeArquivo="dados-manifesto"
        chaveUrl="man"
        ordemInicial={{ coluna: "kb", direcao: "desc" }}
        tamanhoPagina={25}
        dicaBusca={tx("Nome do arquivo ou módulo", "File or module name")}
        selecionado={escolhida ? String(escolhida.id) : null}
        onSelecionar={(id) => definir({ a: id ?? "" })}
        nota={tx(
          "A impressão digital de cada arquivo (última coluna) é a do arquivo inteiro, como publicado: calcular a impressão digital do arquivo baixado dá o mesmo valor. Linhas e colunas só existem para CSV; em JSON, Parquet e malhas geográficas, sem dado quer dizer que a medida não se aplica. Dicionário publicado é o texto que explica cada coluna. Validação automática é o veredito do relatório da publicação, só para CSV: escolha uma linha para ver o que ele diz de cada arquivo. A tabela de cada painel exporta as linhas filtradas; o arquivo completo de origem é o que aparece aqui.",
          "The fingerprint of each file (last column) is that of the whole file, as published: computing the fingerprint of the downloaded file gives the same value. Rows and columns only exist for CSV; in JSON, Parquet and geographic meshes, no data means the measure does not apply. Published dictionary is the text that explains each column. Automatic validation is the verdict of the publication report, only for CSV: choose a row to see what it says about each file. The table of each panel exports the filtered rows; the complete source file is the one that appears here.",
        )}
      />
      <section aria-labelledby="ficha-arq-h" aria-live="polite" className="border border-linha bg-papel p-4 md:p-5">
        <h3 id="ficha-arq-h" className="rotulo text-mineral">
          {tx("Ficha do arquivo", "File record")}
        </h3>
        {escolhida ? (
          <div className="mt-3">
            <FichaArquivo caminho={String(escolhida.id)} commit={commit} dicionarioOperacao={dicionarioOperacao} parquets={parquets} estados={estados} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-carvao-muted">
            {tx(
              "Escolha um arquivo da tabela para baixá-lo, abrir a versão permanente no GitHub e ver o dicionário, as colunas e a validação do arquivo.",
              "Choose a file from the table to download it, open the permanent version on GitHub and see the dictionary, the columns and the validation of the file.",
            )}
          </p>
        )}
      </section>
    </div>
  );
}
