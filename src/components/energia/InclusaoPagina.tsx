import type { ReactNode } from "react";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { NavegacaoLocal, type ItemLocal } from "@/components/energia/NavegacaoLocal";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { ROTA_INCLUSAO, paineisInclusao, rotaPainel, type DataMedida, type PainelInclusao } from "@/lib/energia/inclusao";
import { tx } from "@/lib/energia/idioma";

/**
 * Peças de servidor das páginas da Inclusão energética (a síntese em
 * /setor-eletrico/inclusao-energetica e um painel por página em
 * /tarifa-social, /cobertura, /orcamento e /acesso): navegação local entre as
 * páginas, recorte (período, universo e unidade), avisos, datas de cada
 * medida e rodapé com downloads, link compartilhável e próxima pergunta.
 *
 * Por que um painel por página: cada painel tem mapa, séries, tabelas e fichas de
 * prova; juntos, os quatro passavam de 900 KB de HTML, acima da meta de cerca de
 * 600 KB por página (contrato, seção 5.1).
 */

/**
 * O que cada página oferece, em uma frase de fato (sem juízo): é o texto dos capítulos da síntese. A descrição da cobertura diz
 * "proxy" e o denominador, e não a pergunta da matriz, para o título da página não sugerir que a razão conta quem ficou de fora.
 */
function descricao(id: PainelInclusao): string {
  const textos: Record<PainelInclusao, string> = {
    p059: tx(
      "Unidades consumidoras e faturas, cada uma em sua série, com mapa por UF e o custeio na CDE.",
      "Consumer units and bills, each in its own series, with a map by state and the funding in the CDE.",
    ),
    p060: tx(
      "Faturas por 100 famílias do Cadastro Único: uma proxy, com o denominador declarado, por UF e município.",
      "Bills per 100 Cadastro Único families: a proxy, with the denominator stated, by state and municipality.",
    ),
    p061: tx(
      "Despesa com energia por faixa de renda, região e UF, com a precisão de cada estimativa.",
      "Electricity expense by income bracket, region and state, with the precision of each estimate.",
    ),
    p062: tx(
      "Domicílios sem energia, sistemas isolados e Luz para Todos, cada um na sua unidade.",
      "Households without energy, isolated systems and Luz para Todos, each in its own unit.",
    ),
  };
  return textos[id];
}

/** A síntese e os quatro painéis como itens da navegação local, no idioma da página; a descrição de cada item é o texto do capítulo. */
function itensInclusao(): ItemLocal[] {
  return [
    { id: "sintese", href: ROTA_INCLUSAO, rotulo: tx("Síntese", "Overview") },
    ...paineisInclusao().map((p) => ({ id: p.id, href: rotaPainel(p.id), rotulo: p.rotulo, descricao: descricao(p.id) })),
  ];
}

/**
 * Navegação entre a síntese e os quatro painéis: faixa de páginas irmãs nas páginas filhas; a síntese não leva a faixa, porque
 * mostra os mesmos destinos como capítulos (InclusaoCapitulos), e o mesmo rótulo não aparece duas vezes.
 */
export function InclusaoNavegacao({ atual }: { atual: PainelInclusao | "sintese" }) {
  if (atual === "sintese") return null;
  return <NavegacaoLocal rotulo={tx("Páginas da inclusão energética", "Energy inclusion pages")} itens={itensInclusao()} atual={atual} />;
}

/**
 * Capítulos da síntese: as páginas que aprofundam cada pergunta, com a descrição de cada uma. O painel de orçamento fica de fora
 * porque a figura principal da síntese já é o resumo dele e traz o link para o painel completo.
 */
export function InclusaoCapitulos() {
  const itens = itensInclusao().filter((i) => i.id !== "sintese" && i.id !== "p061"); // i18n: dado
  return (
    <NavegacaoLocal
      rotulo={tx("Capítulos da inclusão energética", "Energy inclusion chapters")}
      itens={itens}
      atual="sintese" // i18n: dado
      variante="capitulos" // i18n: dado
      titulo={tx("Onde aprofundar", "Where to go deeper")}
    />
  );
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function InclusaoIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="inclusao-energetica" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo={tx("Inclusão energética indisponível nesta publicação", "Energy inclusion unavailable in this publication")}
          motivo={
            motivo ??
            tx(
              "A gold do módulo Inclusão energética (public/energia/gold/inclusao.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe.",
              "The Energy inclusion module's gold file (public/energia/gold/inclusao.json) was not generated or did not pass validation; the latest valid publication is kept when there is one.",
            )
          }
        />
      </main>
    </>
  );
}

/** Período, universo e unidade do painel, logo abaixo da figura principal (anatomia da seção 7.2, item 3). */
export function InclusaoRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">{tx("Universo", "Universe")}</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
        <dd className="mt-0.5">{unidade}</dd>
      </div>
    </dl>
  );
}

/**
 * Datas de referência de cada medida, uma por fonte: o SCS, a CDE, o Cadastro Único, a POF, a PNAD, o PASI e o Luz para Todos têm
 * calendários próprios, e nenhuma medida herda a data de outra (dentro do bloco "Fontes, datas e siglas" da abertura).
 */
export function InclusaoDatas({ itens }: { itens: readonly DataMedida[] }) {
  return (
    <ul className="flex flex-col gap-x-5 gap-y-1.5 text-xs text-carvao-muted sm:flex-row sm:flex-wrap" aria-label={tx("Datas de referência de cada medida", "Reference dates of each measure")}>
      {itens.map((x) => (
        <li key={x.id} className="inline-flex flex-wrap items-center gap-1.5">
          <span>
            {x.rotulo}: {x.periodo}; {x.unidade}
          </span>
          <SeloNatureza natureza={x.natureza} compacto />
        </li>
      ))}
    </ul>
  );
}

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta, numa linha (SeguirPainel). */
export function InclusaoSeguir({
  ancora,
  proximo,
  downloads,
  extra,
}: {
  ancora: string;
  proximo?: { href: string; pergunta: string };
  downloads: { rotulo: string; url: string }[];
  extra?: ReactNode;
}) {
  return <SeguirPainel ancora={ancora} proximo={proximo} downloads={downloads} extra={extra} />;
}
