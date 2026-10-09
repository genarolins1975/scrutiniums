import type { ReactNode } from "react";
import { TextoEnergia } from "@/components/energia/TextoEnergia";
import { num } from "@/lib/energia/formato";
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
  linhas?: number | null;
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
              {a.rotulo} ({formatoDoArquivo(a.url)})
            </a>
            {a.linhas != null && <span className="ml-2 text-xs text-mineral">{num(a.linhas, 0)} linhas</span>}
            {a.aviso}
            <span className="block text-xs text-mineral" data-nivel="analisar">
              Arquivo {nomeDoArquivo(a.url)}
            </span>
            {t.frase && (
              <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-estado-arquivo={a.estado.veredito}>
                {t.frase}
              </p>
            )}
            {t.tecnico && (
              <p className="max-w-prose2 text-xs leading-relaxed text-mineral [overflow-wrap:anywhere]" data-nivel="analisar">
                {t.tecnico}
              </p>
            )}
            {a.colunas && (
              <div className="max-w-prose2 pb-1 text-xs leading-relaxed text-carvao-muted [overflow-wrap:anywhere]" data-nivel="analisar" data-legenda-arquivo="">
                <span className="rotulo mr-2 text-mineral">Colunas e códigos</span>
                <TextoEnergia texto={a.colunas} origem={a.origemDosLiterais} literais={["marcador-ausencia-siga"]} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
