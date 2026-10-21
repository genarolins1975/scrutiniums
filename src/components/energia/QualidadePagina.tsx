import type { ReactNode } from "react";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { NavegacaoLocal } from "@/components/energia/NavegacaoLocal";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { tx } from "@/lib/energia/idioma";
import { hrefPainelQualidade, paineisQualidade, paginasQualidade, type PaginaQualidade } from "@/lib/energia/qualidade";
import type { Natureza } from "@/lib/energia/tipos";

/**
 * Peças de servidor das páginas de Qualidade do serviço (a entrada, com P051, P053 e P054, e Comparar distribuidoras, com o P052):
 * estado de ausência, capítulos, navegação entre as duas páginas, recorte (período, universo e unidade) sob a figura principal de cada
 * painel, aviso de defasagem, datas de cada parte e o par de figuras lado a lado.
 *
 * Por que duas páginas (diagnóstico de layout de 20/10/2026, item 6): a entrada era a página mais longa do módulo (27 mil px no
 * celular) para um leitor que chega querendo saber da própria cidade. A busca do município abre a entrada; a comparação entre
 * distribuidoras, o maior capítulo, foi para página própria. A escolha (?dist=) segue no endereço de uma página à outra.
 */

/**
 * Capítulos da página: os outros três painéis, cada um com a pergunta que responde (âncoras do mesmo documento). O rótulo do bloco é
 * texto, não título: os títulos de seção que vêm depois são do painel, e um título aqui os faria parecer filhos deste bloco.
 */
export function QualidadeCapitulos({ atual = "duracao", pagina = "entrada" }: { atual?: string; pagina?: PaginaQualidade }) {
  const itens = paineisQualidade().map((p) => ({ id: p.ancora, href: hrefPainelQualidade(p.id, pagina), rotulo: p.rotulo, descricao: p.descricao }));
  return (
    <div data-capitulos-pagina="">
      <p className="rotulo mb-2 text-mineral">{tx("As outras perguntas sobre a qualidade do serviço", "The other questions about quality of supply")}</p>
      <NavegacaoLocal rotulo={tx("Perguntas desta página", "Questions on this page")} itens={itens} atual={atual} variante="capitulos" />
    </div>
  );
}

/** Faixa das duas páginas no alto de Comparar distribuidoras (a entrada mostra os mesmos destinos como capítulos). */
export function QualidadeNavegacao({ atual }: { atual: PaginaQualidade }) {
  return <NavegacaoLocal rotulo={tx("Páginas da qualidade do serviço", "Quality of supply pages")} itens={paginasQualidade().map((p) => ({ id: p.id, href: p.href, rotulo: p.rotulo }))} atual={atual} />;
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function QualidadeIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="qualidade" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo={tx("Qualidade do serviço indisponível nesta publicação", "Quality of supply unavailable in this release")}
          motivo={
            motivo ??
            tx(
              "A gold do módulo Qualidade (public/energia/gold/qualidade.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe.",
              "The gold file of the Quality module (public/energia/gold/qualidade.json) was not generated or did not pass validation; the latest valid release is kept when it exists.",
            )
          }
        />
      </main>
    </>
  );
}

/** Aviso que muda a leitura da página inteira (fonte defasada). */
export function QualidadeAviso({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="mt-3 border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao">
      {children}
    </p>
  );
}

/**
 * Período, universo e unidade do painel, logo abaixo da figura principal: o que o número cobre, antes de qualquer conclusão. Três linhas
 * de texto corrido (rótulo e frase na mesma linha), não três colunas: com os blocos de três colunas das notas do painel, a página repetia a
 * mesma forma quatro vezes. O texto tem 14 px: é a leitura que diz o que o número cobre.
 */
export function QualidadeRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl data-recorte-painel="" className="max-w-4xl space-y-1 border-t border-linha pt-3 text-sm leading-relaxed text-carvao-muted">
      <div>
        <dt className="rotulo mr-2 inline text-mineral">{tx("Período", "Period")}</dt>
        <dd className="inline">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo mr-2 inline text-mineral">{tx("Universo", "Universe")}</dt>
        <dd className="inline">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo mr-2 inline text-mineral">{tx("Unidade", "Unit")}</dt>
        <dd className="inline">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Datas de referência de cada parte da página: cada número diz o seu período, sem sugerir que as partes são do mesmo dia. */
export function QualidadeDatas({ itens }: { itens: { rotulo: string; texto: ReactNode; natureza: Natureza }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-carvao-muted" aria-label={tx("Datas de referência de cada parte", "Reference dates of each part")}>
      {itens.map((x) => (
        <li key={x.rotulo} className="inline-flex flex-wrap items-center gap-1.5">
          <span>
            {x.rotulo}: {x.texto}
          </span>
          <SeloNatureza natureza={x.natureza} compacto />
        </li>
      ))}
    </ul>
  );
}

/**
 * Duas figuras lado a lado a partir de 1.024 px (uma sobre a outra abaixo disso). Serve a medidas que se leem juntas e nunca no mesmo
 * eixo: DEC e FEC, cada um com a sua escala; as duas colunas têm largura mínima zero para o gráfico caber sem empurrar a página.
 */
export function QualidadePar({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2 [&>*]:min-w-0">{children}</div>;
}
