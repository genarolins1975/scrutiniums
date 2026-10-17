"use client";

import Link from "@/components/energia/LinkSemPrefetch";
import type { FormEvent, MouseEvent } from "react";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { hrefNoIdioma } from "@/lib/i18n-href";

/**
 * Porta de entrada da Metodologia, por tarefa: encontrar um indicador, ver a fórmula de um número e reproduzir um valor. As duas primeiras
 * mexem na lista de regras da mesma página (a busca e o filtro de fórmula vão para a URL, como se o leitor os tivesse escolhido na lista, e
 * o link copiado reabre o mesmo recorte); a terceira leva ao exemplo reproduzível. Sem JavaScript, a busca é um formulário de método GET
 * e o filtro é um link com o parâmetro: a lista lê os dois ao abrir.
 */

// os mesmos parâmetros da lista de regras (prefixo "reg" e item aberto "m"): as duas instâncias leem e gravam a mesma URL
const ESQUEMA = {
  busca: campo(tiposUrl.texto({ max: 120 }), "", { param: "reg.q", historico: "replace" }),
  pagina: campo(tiposUrl.inteiro({ min: 1 }), 1, { param: "reg.pg", historico: "replace" }),
  formula: campo(tiposUrl.lista(tiposUrl.texto({ max: 120 })), [] as string[], { param: "reg.f.formula" }),
  aberto: campo(tiposUrl.texto({ max: 300 }), "", { param: "m" }),
};

const rolarParaALista = () =>
  window.requestAnimationFrame(() => document.querySelector('[data-componente="lista-consultavel"][data-prefixo="reg"]')?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior }));

const acao = "inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao";

export function MetodologiaTarefas({ total, comFormula }: { total: number; comFormula: number }) {
  const [estado, definir] = useEstadoUrl(ESQUEMA);
  const tx = useTx();
  const idioma = useIdioma();
  const { num } = formatos(idioma);
  const soFormula = estado.formula.length === 1 && estado.formula[0] === "sim";

  const buscar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const digitado = new FormData(e.currentTarget).get("reg.q");
    definir({ busca: typeof digitado === "string" ? digitado.trim() : "", pagina: 1, aberto: "" }, { historico: "push" });
    rolarParaALista();
  };
  const comFormulaPublicada = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    definir({ formula: ["sim"], busca: "", pagina: 1, aberto: "" }, { historico: "push" });
    rolarParaALista();
  };

  return (
    <section aria-labelledby="tarefas-titulo" id="tarefas" className="scroll-mt-28 py-5" data-tarefas="">
      <h2 id="tarefas-titulo" className="ed-h2 font-serif text-carvao">
        {tx("O que você quer fazer?", "What do you want to do?")}
      </h2>
      <ol className="mt-4 grid gap-x-8 gap-y-6 md:grid-cols-3" aria-label={tx("Três tarefas", "Three tasks")}>
        <li className="min-w-0 border-t-2 border-energia pt-3">
          <h3 className="font-serif text-lg leading-snug text-carvao">{tx("Encontrar um indicador", "Find an indicator")}</h3>
          <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
            {tx("Pelo nome, pela unidade ou pela pergunta a que o número responde.", "By name, by unit or by the question the number answers.")}
          </p>
          <form role="search" method="get" action={hrefNoIdioma("/setor-eletrico/metodologia#regras", idioma)} onSubmit={buscar} className="mt-3 flex flex-wrap items-stretch gap-2">
            <label htmlFor="tarefa-busca" className="sr-only">
              {tx("Nome, unidade ou pergunta do indicador", "Name, unit or question of the indicator")}
            </label>
            <input
              id="tarefa-busca"
              name="reg.q"
              type="search"
              key={estado.busca}
              defaultValue={estado.busca}
              placeholder={tx("Ex.: perdas, preço", "E.g.: losses, price")}
              autoComplete="off"
              spellCheck={false}
              className="min-h-[44px] min-w-0 flex-1 basis-40 border border-linha bg-superficie px-3 text-sm text-carvao placeholder:text-mineral hover:border-energia"
            />
            <button type="submit" className="inline-flex min-h-[44px] items-center border border-energia bg-energia-fundo px-4 text-sm text-carvao hover:border-energia-dark">
              {tx("Buscar na lista", "Search the list")}
            </button>
          </form>
        </li>
        <li className="min-w-0 border-t-2 border-energia pt-3">
          <h3 className="font-serif text-lg leading-snug text-carvao">{tx("Ver a fórmula de um número", "See the formula of a number")}</h3>
          <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
            {tx(
              `${num(comFormula, 0)} dos ${num(total, 0)} indicadores têm fórmula publicada. Nos outros, a definição e a regra de agregação dizem como o número é obtido.`,
              `${num(comFormula, 0)} of the ${num(total, 0)} indicators have a published formula. For the others, the definition and the aggregation rule say how the number is obtained.`,
            )}
          </p>
          <p className="mt-2">
            <a href={hrefNoIdioma("/setor-eletrico/metodologia?reg.f.formula=sim#regras", idioma)} onClick={comFormulaPublicada} className={acao}>
              {soFormula
                ? tx("Lista já limitada aos indicadores com fórmula", "List already limited to the indicators with a formula")
                : tx(`Listar os ${num(comFormula, 0)} com fórmula`, `List the ${num(comFormula, 0)} with a formula`)}
            </a>
          </p>
        </li>
        <li className="min-w-0 border-t-2 border-energia pt-3">
          <h3 className="font-serif text-lg leading-snug text-carvao">{tx("Reproduzir um valor", "Reproduce a value")}</h3>
          <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
            {tx(
              "Baixe o arquivo que originou o número e refaça a conta. O exemplo usa um número do catálogo de dados.",
              "Download the file the number came from and redo the calculation. The example uses a number from the data catalog.",
            )}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-5">
            <a href="#exemplo-reproduzivel" className={acao}>
              {tx("Ver o exemplo passo a passo", "See the step-by-step example")}
            </a>
            <Link href="/setor-eletrico/dados/reproducao" className={acao}>
              {tx("Arquivos e versões", "Files and versions")}
            </Link>
          </p>
        </li>
      </ol>
    </section>
  );
}
