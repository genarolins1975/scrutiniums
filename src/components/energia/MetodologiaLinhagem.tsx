import Link from "@/components/energia/LinkSemPrefetch";
import type { ReactNode } from "react";
import { tx } from "@/lib/energia/idioma";

/**
 * A linhagem de um número, da fonte à tela, em cinco passos que o leitor reconhece sem vocabulário de engenharia de dados. Cada passo diz o que
 * acontece e leva ao lugar onde o leitor confere aquela etapa: o catálogo, o arquivo guardado com a impressão digital, as revisões, as bases
 * e versões e a regra do indicador. Os nomes técnicos das camadas (arquivo original, histórico por coleta, bases publicadas) ficam em Analisar,
 * no diagrama de texto da seção; nada foi retirado da página.
 */

type Passo = { titulo: string; texto: ReactNode; href: string; rotulo: string; interno: boolean };

/** Os passos no idioma da página (função, não constante: o texto depende do idioma de quem lê). */
function passos(): readonly Passo[] {
  return [
    {
      titulo: tx("A fonte publica", "The source publishes"),
      texto: tx(
        "ONS, ANEEL, CCEE, IBGE e outros órgãos publicam o arquivo, com período, atualização e licença próprios.",
        "ONS, ANEEL, CCEE, IBGE and other bodies publish the file, with their own period, update schedule and license.",
      ),
      href: "/setor-eletrico/dados",
      rotulo: tx("Encontrar a fonte", "Find the source"),
      interno: true,
    },
    {
      titulo: tx("O arquivo é guardado", "The file is stored"),
      texto: tx(
        "Cada coleta guarda uma cópia do arquivo, sem alterar nada, com a impressão digital dele: um código que muda se qualquer parte do arquivo mudar.",
        "Each collection stores a copy of the file, without changing anything, with its fingerprint: a code that changes if any part of the file changes.",
      ),
      href: "/setor-eletrico/dados/reproducao",
      rotulo: tx("Conferir um arquivo", "Check a file"),
      interno: true,
    },
    {
      titulo: tx("O histórico cresce", "The history grows"),
      texto: tx(
        "Cada valor guarda de qual coleta veio. Se a fonte revisa um valor, a versão nova entra e a anterior continua guardada.",
        "Each value records which collection it came from. If the source revises a value, the new version comes in and the previous one stays stored.",
      ),
      href: "/setor-eletrico/dados/saude",
      rotulo: tx("Ver as revisões", "See the revisions"),
      interno: true,
    },
    {
      titulo: tx("A base é publicada", "The base is published"),
      texto: tx(
        "Regras publicadas transformam o histórico nas bases que as páginas leem. Cada arquivo publicado tem a impressão digital numa lista.",
        "Published rules turn the history into the bases that the pages read. Each published file has its fingerprint in a list.",
      ),
      href: "/setor-eletrico/dados/reproducao#versao-do-codigo",
      rotulo: tx("Ver as versões", "See the versions"),
      interno: true,
    },
    {
      titulo: tx("O indicador aparece", "The indicator appears"),
      texto: tx(
        "A regra do indicador define o número, a unidade, o recorte e o que ele não permite concluir.",
        "The indicator rule defines the number, the unit, the scope and what it does not allow one to conclude.",
      ),
      href: "#regras",
      rotulo: tx("Ler uma regra", "Read a rule"),
      interno: false,
    },
  ];
}

export function MetodologiaLinhagem() {
  const PASSOS = passos();
  return (
    <ol className="grid border-y border-linha lg:grid-cols-5" aria-label={tx("Do arquivo da fonte ao indicador na tela", "From the source file to the indicator on screen")} data-linhagem-visual="">
      {PASSOS.map((p, i) => (
        <li key={p.href} className="relative min-w-0 border-b border-linha py-4 last:border-b-0 lg:border-b-0 lg:border-r lg:px-4 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0">
          <p className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-flex h-7 w-7 shrink-0 items-center justify-center border border-energia bg-energia-fundo text-sm tabular-nums text-carvao">
              {i + 1}
            </span>
            <span className="sr-only">{tx(`Passo ${i + 1}: `, `Step ${i + 1}: `)}</span>
            <span className="font-serif text-lg leading-snug text-carvao">{p.titulo}</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{p.texto}</p>
          <p className="mt-1">
            {p.interno ? (
              <Link href={p.href} className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao">
                {p.rotulo}
              </Link>
            ) : (
              <a href={p.href} className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao">
                {p.rotulo}
              </a>
            )}
          </p>
          {i < PASSOS.length - 1 && (
            <span aria-hidden="true" className="absolute -right-2 top-5 z-10 hidden bg-papel px-0.5 text-mineral lg:block">
              ›
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
