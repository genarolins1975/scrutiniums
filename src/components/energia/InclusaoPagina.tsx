import type { ReactNode } from "react";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { NavegacaoLocal, type ItemLocal } from "@/components/energia/NavegacaoLocal";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { PAINEIS_INCLUSAO, ROTA_INCLUSAO, rotaPainel, type DataMedida, type PainelInclusao } from "@/lib/energia/inclusao";

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
const DESCRICAO: Record<PainelInclusao, string> = {
  p059: "Unidades consumidoras e faturas, cada uma em sua série, com mapa por UF e o custeio na CDE.",
  p060: "Faturas por 100 famílias do Cadastro Único: uma proxy, com o denominador declarado, por UF e município.",
  p061: "Despesa com energia por faixa de renda, região e UF, com a precisão de cada estimativa.",
  p062: "Domicílios sem energia, sistemas isolados e Luz para Todos, cada um na sua unidade.",
};

/** A síntese e os quatro painéis como itens da navegação local; a descrição de cada item é o texto do capítulo. */
const ITENS_INCLUSAO: ItemLocal[] = [
  { id: "sintese", href: ROTA_INCLUSAO, rotulo: "Síntese" },
  ...PAINEIS_INCLUSAO.map((p) => ({ id: p.id, href: rotaPainel(p.id), rotulo: p.rotulo, descricao: DESCRICAO[p.id] })),
];

/**
 * Navegação entre a síntese e os quatro painéis: faixa de páginas irmãs nas páginas filhas; a síntese não leva a faixa, porque
 * mostra os mesmos destinos como capítulos (InclusaoCapitulos), e o mesmo rótulo não aparece duas vezes.
 */
export function InclusaoNavegacao({ atual }: { atual: PainelInclusao | "sintese" }) {
  if (atual === "sintese") return null;
  return <NavegacaoLocal rotulo="Páginas da inclusão energética" itens={ITENS_INCLUSAO} atual={atual} />;
}

/**
 * Capítulos da síntese: as páginas que aprofundam cada pergunta, com a descrição de cada uma. O painel de orçamento fica de fora
 * porque a figura principal da síntese já é o resumo dele e traz o link para o painel completo.
 */
export function InclusaoCapitulos() {
  const itens = ITENS_INCLUSAO.filter((i) => i.id !== "sintese" && i.id !== "p061");
  return <NavegacaoLocal rotulo="Capítulos da inclusão energética" itens={itens} atual="sintese" variante="capitulos" titulo="Onde aprofundar" />;
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function InclusaoIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="inclusao-energetica" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo="Inclusão energética indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold do módulo Inclusão energética (public/energia/gold/inclusao.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
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
        <dt className="rotulo text-mineral">Período</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Universo</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Unidade</dt>
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
    <ul className="flex flex-col gap-x-5 gap-y-1.5 text-xs text-carvao-muted sm:flex-row sm:flex-wrap" aria-label="Datas de referência de cada medida">
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
