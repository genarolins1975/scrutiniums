import { statSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { NavegacaoLocal } from "@/components/energia/NavegacaoLocal";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { PAINEIS_EXPANSAO, PERGUNTA_EXPANSAO, ROTA_EXPANSAO, painel, proximoPainel, rotaPainel, type PainelExpansao } from "@/lib/energia/expansao";
import { datasLegiveis, num } from "@/lib/energia/formato";
import type { Download, Natureza } from "@/lib/energia/tipos";

/**
 * Peças de servidor das páginas da Expansão da oferta e da rede (a abertura em
 * /setor-eletrico/expansao e um painel por página em /carteira, /cronograma,
 * /geracao-e-transmissao e /cenarios): navegação local, capítulos da abertura, recorte
 * (período, universo e unidade), datas de cada parte, rodapé com downloads, link
 * compartilhável e próxima pergunta, seções dos modos Analisar e Auditar e o aviso de
 * ausência legítima da fonte.
 *
 * Por que um painel por página: a gold tem cerca de 390 KB, e os mapas, as séries, as
 * tabelas e as fichas de prova dos quatro painéis juntos passariam da meta de cerca de
 * 600 KB de HTML por página (contrato, seção 5.1). Cada página leva só o recorte que
 * mostra; os arquivos grandes (pontos das usinas, linhas da EPE) carregam sob demanda.
 */

/**
 * Tamanho do arquivo publicado (lido do disco no build), para o botão de carga sob demanda
 * dizer quanto vai baixar. Arquivo ausente devolve null: o botão não promete tamanho.
 */
export function tamanhoPublicado(url: string): string | null {
  try {
    const b = statSync(join(process.cwd(), "public", url)).size;
    return b >= 1e6 ? `${num(b / 1e6, 1)} MB` : `${num(b / 1e3, 0)} KB`;
  } catch {
    return null;
  }
}

/** A abertura e as quatro páginas de painel como itens da navegação local; a descrição de cada uma é a pergunta que ela responde. */
const ITENS_EXPANSAO = [
  { id: "sintese", href: ROTA_EXPANSAO, rotulo: "Síntese", descricao: PERGUNTA_EXPANSAO },
  ...PAINEIS_EXPANSAO.map((p) => ({ id: p.id, href: rotaPainel(p.id), rotulo: p.rotulo, descricao: p.pergunta })),
];

/**
 * Faixa de páginas irmãs nas páginas filhas, com a atual marcada. A abertura não leva a faixa: mostra os mesmos destinos como
 * capítulos depois da figura principal (ExpansaoCapitulos), e o mesmo rótulo não aparece duas vezes.
 */
export function ExpansaoNavegacao({ atual }: { atual: PainelExpansao | "sintese" }) {
  if (atual === "sintese") return null;
  return <NavegacaoLocal rotulo="Páginas da expansão" itens={ITENS_EXPANSAO} atual={atual} />;
}

export type CapituloExpansao = {
  id: PainelExpansao;
  /** Resposta curta da página (RespostaCurta), com o veredito à vista e os números por trás em Analisar. */
  resposta: ReactNode;
  /** Número de abertura da página com a ficha de prova, quando ela tem um que a faixa não traz. */
  numero?: ReactNode;
  /** Datas e recortes da resposta. */
  contexto: ReactNode;
  /** O que a resposta não permite concluir. */
  limite: ReactNode;
};

/**
 * Capítulos da abertura: as quatro páginas do módulo, cada uma com o nome, a pergunta que responde, a resposta curta, o limite da
 * leitura e o caminho para a página. Segue o desenho dos capítulos do sistema (nome, pergunta, link; a página atual não entra),
 * com a resposta no meio, porque a abertura da Expansão responde às quatro perguntas antes de mandar o leitor adiante.
 */
export function ExpansaoCapitulos({ itens }: { itens: CapituloExpansao[] }) {
  return (
    <nav aria-label="Capítulos da expansão" data-navegacao-local="capitulos" className="border-t border-linha pt-6">
      <h3 className="ed-h3 font-serif text-carvao">Uma página para cada pergunta</h3>
      <ol className="mt-4 grid gap-x-10 gap-y-9 md:grid-cols-2">
        {itens.map((c) => {
          const p = painel(c.id);
          return (
            <li key={c.id} id={`sintese-${c.id}`} className="flex min-w-0 scroll-mt-28 flex-col gap-2.5">
              <h4 className="ed-h3 font-serif text-carvao">{p.rotulo}</h4>
              <p className="text-sm font-medium leading-snug text-carvao">{p.pergunta}</p>
              {c.resposta}
              {c.numero}
              <p className="text-xs leading-relaxed text-carvao-muted">{c.contexto}</p>
              <p className="text-sm leading-relaxed text-carvao-muted">
                <span className="rotulo mr-2 text-mineral">Não permite concluir</span>
                {c.limite}
              </p>
              <Link
                href={rotaPainel(c.id)}
                className="inline-flex min-h-[44px] items-center self-start text-sm text-energia-dark underline underline-offset-4 hover:text-carvao"
              >
                Abrir {p.rotulo}
                <span aria-hidden="true" className="ml-1.5">
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function ExpansaoIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="expansao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo="Expansão indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold do módulo Expansão (public/energia/gold/expansao.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
          }
        />
      </main>
    </>
  );
}

/** Período, universo e unidade do painel, logo abaixo da figura principal: o recorte que o leitor precisa para ler a medida. */
export function ExpansaoRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl data-recorte-painel="" className="grid gap-x-6 gap-y-2 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
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

/** Datas de referência de cada parte da gold: cada número diz o seu dia, sem sugerir simultaneidade (bloco "Fontes, datas e siglas"). */
export function ExpansaoDatas({ itens }: { itens: { rotulo: string; texto: string; natureza: Natureza }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-carvao-muted" aria-label="Datas de referência de cada parte">
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

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta, numa linha (SeguirPainel). */
export function ExpansaoSeguir({ id, downloads }: { id: PainelExpansao; downloads: Download[] }) {
  const prox = painel(proximoPainel(id));
  return <SeguirPainel ancora={id} proximo={{ href: rotaPainel(prox.id), pergunta: prox.pergunta }} downloads={downloads} />;
}

/** Seção de Analisar: tabelas completas, séries detalhadas e comparações; continua no HTML do servidor. */
export function ExpansaoAnalise({ titulo, children, id }: { titulo: ReactNode; children: ReactNode; id?: string }) {
  return (
    <SecaoDoPainel id={id} titulo={titulo} nivel="analisar">
      {children}
    </SecaoDoPainel>
  );
}

/** Seção de Auditar: regras por extenso, conferências, versões e limitações. */
export function ExpansaoAuditoria({ titulo, children, id }: { titulo: ReactNode; children: ReactNode; id?: string }) {
  return (
    <SecaoDoPainel id={id} titulo={titulo} nivel="auditar">
      {children}
    </SecaoDoPainel>
  );
}

/** Nota curta de leitura sob um gráfico (sem caixa: a visualização domina). */
export function ExpansaoNota({ children }: { children: ReactNode }) {
  return <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{children}</p>;
}

/**
 * Ausência legítima da fonte (seção 2.3): o que falta, a evidência do bloqueio, a
 * alternativa usada e a dependência. Nunca "em breve": é o estado real da fonte.
 */
export function ExpansaoAusencia({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div role="note" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm leading-relaxed text-carvao">
      <p className="rotulo flex items-center gap-2 text-carvao">
        <span aria-hidden="true" className="inline-block h-2.5 w-2.5 border border-carvao" />
        {titulo}
      </p>
      <div className="mt-1.5 space-y-1.5">{children}</div>
    </div>
  );
}

/** Lista das limitações publicadas pela proveniência (texto da gold, sem reescrita). */
export function ExpansaoLimitacoes({ itens }: { itens: readonly string[] }) {
  if (!itens.length) return null;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
      {itens.map((x) => (
        <li key={x}>{datasLegiveis(x)}</li>
      ))}
    </ul>
  );
}

/** Tabela simples de servidor (poucas linhas, sem interação), com cabeçalhos e unidade. */
export function ExpansaoTabelaSimples({ titulo, cabecalho, linhas }: { titulo: string; cabecalho: string[]; linhas: ReactNode[][] }) {
  return (
    <div className="tabela-scroll" tabIndex={0} role="region" aria-label={`${titulo} (tabela rolável)`}>
      <table className="w-full border-collapse text-sm tabular-nums">
        <caption className="pb-2 text-left text-sm font-medium text-carvao">{titulo}</caption>
        <thead>
          <tr className="border-b border-linha text-left text-xs text-mineral">
            {cabecalho.map((c) => (
              <th key={c} scope="col" className="px-2 py-1.5 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-b border-linha align-top text-carvao">
              {l.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="px-2 py-1.5 text-left font-normal">
                    {c}
                  </th>
                ) : (
                  <td key={j} className="px-2 py-1.5">
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
