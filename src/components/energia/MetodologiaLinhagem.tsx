import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A linhagem de um número, da fonte à tela, em cinco passos que o leitor reconhece sem vocabulário de engenharia de dados. Cada passo diz o que
 * acontece e leva ao lugar onde o leitor confere aquela etapa: o catálogo, o arquivo guardado com a impressão digital, as revisões, as bases
 * e versões e a regra do indicador. Os nomes técnicos das camadas (arquivo original, histórico por coleta, bases publicadas) ficam em Analisar,
 * no diagrama de texto da seção; nada foi retirado da página.
 */

type Passo = { titulo: string; texto: ReactNode; href: string; rotulo: string; interno: boolean };

const PASSOS: readonly Passo[] = [
  {
    titulo: "A fonte publica",
    texto: "ONS, ANEEL, CCEE, IBGE e outros órgãos publicam o arquivo, com período, atualização e licença próprios.",
    href: "/setor-eletrico/dados",
    rotulo: "Encontrar a fonte",
    interno: true,
  },
  {
    titulo: "O arquivo é guardado",
    texto: "Cada coleta guarda uma cópia do arquivo, sem alterar nada, com a impressão digital dele: um código que muda se qualquer parte do arquivo mudar.",
    href: "/setor-eletrico/dados/reproducao",
    rotulo: "Conferir um arquivo",
    interno: true,
  },
  {
    titulo: "O histórico cresce",
    texto: "Cada valor guarda de qual coleta veio. Se a fonte revisa um valor, a versão nova entra e a anterior continua guardada.",
    href: "/setor-eletrico/dados/saude",
    rotulo: "Ver as revisões",
    interno: true,
  },
  {
    titulo: "A base é publicada",
    texto: "Regras publicadas transformam o histórico nas bases que as páginas leem. Cada arquivo publicado tem a impressão digital numa lista.",
    href: "/setor-eletrico/dados/reproducao#versao-do-codigo",
    rotulo: "Ver as versões",
    interno: true,
  },
  {
    titulo: "O indicador aparece",
    texto: "A regra do indicador define o número, a unidade, o recorte e o que ele não permite concluir.",
    href: "#regras",
    rotulo: "Ler uma regra",
    interno: false,
  },
];

export function MetodologiaLinhagem() {
  return (
    <ol className="grid border-y border-linha lg:grid-cols-5" aria-label="Do arquivo da fonte ao indicador na tela" data-linhagem-visual="">
      {PASSOS.map((p, i) => (
        <li key={p.titulo} className="relative min-w-0 border-b border-linha py-4 last:border-b-0 lg:border-b-0 lg:border-r lg:px-4 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0">
          <p className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-flex h-7 w-7 shrink-0 items-center justify-center border border-energia bg-energia-fundo text-sm tabular-nums text-carvao">
              {i + 1}
            </span>
            <span className="sr-only">Passo {i + 1}: </span>
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
