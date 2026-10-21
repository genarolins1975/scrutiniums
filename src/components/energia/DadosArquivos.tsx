import type { ReactNode } from "react";
import { TextoEnergia } from "@/components/energia/TextoEnergia";
import { num } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { marcado } from "@/lib/energia/i18n/regulacao-dados-metodo";
import { colunasSaoDaGold } from "@/lib/energia/datasets";
import { formatoDoArquivo, nomeDoArquivo } from "@/lib/energia/dados-ficha";
import { textoEstadoDoArquivo } from "@/lib/energia/dados-leitor";
import { estadoDoArquivo, type EstadoDoArquivo } from "@/lib/energia/dados-servidor";
import type { ManifestoGold, PublicacaoGold } from "@/lib/energia/tipos-dados";

/**
 * Arquivos para baixar com o estado de cada um junto do link: o veredito da validação automática (e, quando um CSV é reprovado, o que a
 * releitura do arquivo publicado mostra), o tamanho em linhas e as colunas e códigos do arquivo. A legenda das colunas aparece a partir do
 * nível Analisar, junto do link: ela cita nomes de campo, que o nível Entender não traz (o texto de Entender não leva nome de campo). Servidor,
 * sem estado.
 */

export type ItemArquivo = {
  url: string;
  rotulo: string;
  estado: EstadoDoArquivo;
  /** Dicionário publicado do arquivo (arquivos.json): as colunas e o que cada código quer dizer. */
  colunas?: string | null;
  /** O dicionário é o da gold (texto do pipeline, em português): na página inglesa sai marcado como trecho em português. */
  colunasDaGold?: boolean;
  linhas?: number | null;
  /**
   * Descrição portuguesa do arquivo (a do dicionário), só na página inglesa: lá o rótulo é o nome técnico do arquivo, e a descrição
   * que a página portuguesa usa como rótulo vem ao lado, marcada como trecho em português.
   */
  descricaoPt?: string | null;
  /** Aviso próprio do arquivo (reúne dados de outros conjuntos). */
  aviso?: ReactNode;
  /** Endereço do conjunto de onde vêm os literais da legenda (o marcador de ausência do SIGA, por exemplo): sem ele a data da legenda sai formatada. */
  origemDosLiterais?: string;
};

/** Os itens da lista a partir de endereços publicados: o estado de cada arquivo, as linhas do manifesto e o dicionário de colunas. */
export function itensDeArquivos(
  arquivos: readonly { rotulo: string; url: string }[],
  contexto: { pub: PublicacaoGold | null; manifesto: ManifestoGold | null; dicionario: Record<string, string> },
): ItemArquivo[] {
  const { pub, manifesto, dicionario } = contexto;
  return arquivos
    .filter((a, i, todos) => todos.findIndex((x) => x.url === a.url) === i)
    .map((a) => ({
      url: a.url,
      rotulo: a.rotulo.replace(/\s*\((?:CSV|JSON|Parquet)\)$/i, ""),
      estado: estadoDoArquivo(a.url, pub, manifesto),
      colunas: dicionario[a.url] ?? null,
      colunasDaGold: colunasSaoDaGold(a.url),
      linhas: manifesto?.arquivos.find((x) => x.caminho === a.url)?.linhas ?? null,
    }));
}

const LINK = "inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";

export function DadosArquivos({ itens }: { itens: readonly ItemArquivo[] }) {
  return (
    <ul className="space-y-2" data-lista="arquivos">
      {itens.map((a) => {
        const t = textoEstadoDoArquivo(a.estado);
        return (
          <li key={a.url} data-arquivo={a.url}>
            <a href={a.url} download className={LINK}>
              {marcado(a.rotulo)} ({formatoDoArquivo(a.url)})
            </a>
            {a.descricaoPt && (
              <span className="ml-2 text-sm text-carvao-muted">
                <TrechoPortugues regiao="dados-arquivo-descricao">{a.descricaoPt}</TrechoPortugues>
              </span>
            )}
            {a.linhas != null && <span className="ml-2 text-xs text-mineral">{tx(`${num(a.linhas, 0)} linhas`, `${num(a.linhas, 0)} rows`)}</span>}
            {a.aviso}
            <span className="block text-xs text-mineral" data-nivel="analisar">
              {tx("Arquivo", "File")} {nomeDoArquivo(a.url)}
            </span>
            {t.frase && (
              <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-estado-arquivo={a.estado.veredito}>
                {marcado(t.frase)}
              </p>
            )}
            {t.tecnico && (
              <p className="max-w-prose2 text-xs leading-relaxed text-mineral [overflow-wrap:anywhere]" data-nivel="analisar">
                {marcado(t.tecnico)}
              </p>
            )}
            {a.colunas && (
              <div className="max-w-prose2 pb-1 text-xs leading-relaxed text-carvao-muted [overflow-wrap:anywhere]" data-nivel="analisar" data-legenda-arquivo="">
                <span className="rotulo mr-2 text-mineral">{tx("Colunas e códigos", "Columns and codes")}</span>
                {/* o dicionário da gold é texto do pipeline, em português; o dos arquivos fixos já vem no idioma da página */}
                {a.colunasDaGold === false ? (
                  // dicionário fixo: em inglês, os nomes de coluna (data_hora_local, SIN_calculado) saem como identificadores
                  tx<ReactNode>(<TextoEnergia texto={a.colunas} origem={a.origemDosLiterais} literais={["marcador-ausencia-siga"]} />, marcado(a.colunas))
                ) : (
                  <TrechoPortugues regiao="dados-arquivo-colunas">
                    <TextoEnergia texto={a.colunas} origem={a.origemDosLiterais} literais={["marcador-ausencia-siga"]} />
                  </TrechoPortugues>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
