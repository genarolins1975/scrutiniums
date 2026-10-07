"use client";

import { useEffect, useId, useState } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { carregaJson, lerCaminho } from "@/lib/energia/carregaJson";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { num } from "@/lib/energia/formato";
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
  const [e, setE] = useState<Estado>({ fase: "vazio" });
  async function escolher(f: File | undefined) {
    if (!f) return;
    if (typeof crypto === "undefined" || !crypto.subtle) {
      setE({ fase: "erro", motivo: "Este navegador só calcula o sha256 em página segura (https). Use o comando sha256sum e compare com a coluna sha256 da tabela." });
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
        <span className="rotulo text-mineral">Conferir um arquivo que você baixou</span>
        <span className="mt-1 block text-sm leading-relaxed text-carvao-muted">
          Escolha um CSV, Parquet ou JSON baixado do observatório. O navegador calcula o sha256 e compara com o manifesto da publicação ({idPublicacao.slice(0, 12)}); o arquivo não sai do seu computador.
        </span>
      </label>
      <input id={id} type="file" onChange={(ev) => escolher(ev.target.files?.[0])} className="block min-h-[44px] w-full text-sm text-carvao file:mr-3 file:min-h-[44px] file:border file:border-linha file:bg-superficie file:px-3 file:text-carvao hover:file:border-energia" />
      <div role="status" aria-live="polite" className="text-sm leading-relaxed">
        {e.fase === "lendo" && <p className="text-carvao-muted">Calculando o sha256 de {e.nome}…</p>}
        {e.fase === "erro" && <p className="text-erro">Não foi possível conferir: {e.motivo}</p>}
        {e.fase === "pronto" && (
          <div data-resultado={e.conf.resultado} className="space-y-1">
            <p className={e.conf.resultado === "igual" ? "text-sucesso" : "text-aviso"}>
              {e.conf.resultado === "igual" && (
                <>
                  Confere: o sha256 de {e.nome} é o de <strong className="font-medium">{e.conf.item.caminho}</strong> no manifesto desta publicação.
                </>
              )}
              {e.conf.resultado === "outra_versao" && (
                <>
                  Não confere: o manifesto tem um arquivo de mesmo nome (<strong className="font-medium">{e.conf.item.caminho}</strong>) com outro sha256. É outra versão da publicação ou o arquivo foi alterado depois do download.
                </>
              )}
              {e.conf.resultado === "desconhecido" && <>Não confere: nenhum arquivo do manifesto tem este sha256 nem este nome. O arquivo é de outra publicação ou não é um arquivo publicado aqui.</>}
            </p>
            <p className="text-xs text-carvao-muted">
              {num(e.bytes, 0)} bytes · sha256 <span className="break-all font-mono">{e.sha256}</span>
            </p>
            {e.conf.resultado === "outra_versao" && (
              <p className="text-xs text-carvao-muted">
                No manifesto: {num(e.conf.item.bytes, 0)} bytes · sha256 <span className="break-all font-mono">{e.conf.item.sha256}</span>.{" "}
                <a href={urlVersao(e.conf.item.caminho, commit).url} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                  Histórico do arquivo no GitHub ↗
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

function FichaArquivo({ caminho, commit, dicionarioOperacao, parquets }: { caminho: string; commit: string | null; dicionarioOperacao: Record<string, string>; parquets: Record<string, ParquetEquivalente> }) {
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
            Baixar o arquivo
          </a>
        </li>
        <li>
          <a href={v.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            {v.exata ? "Versão exata deste build no GitHub ↗" : "Histórico do arquivo no GitHub ↗"}
          </a>
        </li>
        {pq && (
          <li>
            <a href={pq.parquet} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
              Baixar o Parquet equivalente
            </a>
          </li>
        )}
      </ul>
      {pq && (
        <p className="text-xs leading-relaxed text-carvao-muted">
          Parquet: {pq.linhas !== null ? `${num(pq.linhas, 0)} linhas, ` : ""}
          {pq.bytes_parquet !== null && pq.bytes_csv !== null ? `${num(pq.bytes_parquet / 1024, 0)} KB contra ${num(pq.bytes_csv / 1024, 0)} KB do CSV, ` : ""}
          {pq.equivalente ? "conferido célula a célula contra o CSV" : "não conferido: não use como equivalente"}.
        </p>
      )}
      {f.estado === "carregando" && (
        <p role="status" className="text-carvao-muted">
          Lendo o dicionário e as colunas…
        </p>
      )}
      {f.estado === "erro" && (
        <p role="alert" className="text-erro">
          Não foi possível ler o dicionário: {f.motivo}
        </p>
      )}
      {f.estado === "ok" && (
        <>
          <div>
            <p className="rotulo text-mineral">Dicionário</p>
            <p className="mt-0.5 max-w-prose2 leading-relaxed text-carvao-muted">{f.dicionario ?? "Sem dicionário publicado para este arquivo."}</p>
          </div>
          {f.colunas && (
            <div>
              <p className="rotulo text-mineral">Colunas ({f.colunas.length}), na ordem do arquivo</p>
              <p className="mt-0.5 break-words font-mono text-xs leading-relaxed text-carvao-muted">{f.colunas.join(" · ")}</p>
            </div>
          )}
          {item && (
            <p className="text-xs text-mineral">
              Manifesto: {num(item.bytes, 0)} bytes{item.linhas !== undefined ? ` · ${num(item.linhas, 0)} linhas` : ""} · sha256 <span className="break-all font-mono">{item.sha256}</span>
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
}: {
  linhas: LinhaTabela[];
  versao: string;
  commit: string | null;
  dicionarioOperacao: Record<string, string>;
  parquets: Record<string, ParquetEquivalente>;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const escolhida = v.a ? linhas.find((l) => l.id === v.a) : undefined;
  return (
    <div className="space-y-5">
      <TabelaInterativa
        titulo="Arquivos publicados, com tamanho, linhas, dicionário e sha256"
        colunas={COLUNAS_MANIFESTO}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="caminho"
        fonte="Scrutiniums, manifesto.json (sha256 e tamanho de cada arquivo publicado em /energia/)"
        versao={versao}
        nomeArquivo="dados-manifesto"
        chaveUrl="man"
        ordemInicial={{ coluna: "kb", direcao: "desc" }}
        tamanhoPagina={25}
        dicaBusca="Nome do arquivo ou módulo"
        selecionado={escolhida ? String(escolhida.id) : null}
        onSelecionar={(id) => definir({ a: id ?? "" })}
        nota="O sha256 é o do arquivo inteiro, como publicado: sha256sum no arquivo baixado dá o mesmo valor. Linhas e colunas só existem para CSV; em JSON, Parquet e geometrias, sem dado quer dizer que a medida não se aplica. Dicionário publicado é o texto que explica cada coluna. A tabela de cada painel exporta as linhas filtradas; o arquivo completo de origem é o que aparece aqui."
      />
      <section aria-labelledby="ficha-arq-h" aria-live="polite" className="border border-linha bg-papel p-4 md:p-5">
        <h3 id="ficha-arq-h" className="rotulo text-mineral">
          Ficha do arquivo
        </h3>
        {escolhida ? (
          <div className="mt-3">
            <FichaArquivo caminho={String(escolhida.id)} commit={commit} dicionarioOperacao={dicionarioOperacao} parquets={parquets} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-carvao-muted">Escolha um arquivo da tabela para baixá-lo, abrir a versão permanente no GitHub e ver o dicionário e as colunas.</p>
        )}
      </section>
    </div>
  );
}
