import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { NavegacaoLocal } from "@/components/energia/NavegacaoLocal";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { PAINEIS_TRANSICAO, PERGUNTA_TRANSICAO, ROTA_TRANSICAO, rotaPainel, type PainelTransicao } from "@/lib/energia/transicao";
import type { Natureza } from "@/lib/energia/tipos";
import type { DocumentoFonte } from "@/lib/energia/tipos-transicao";

/**
 * Peças de servidor das páginas Transição e ambiente (a abertura em
 * /setor-eletrico/transicao e os painéis em /mmgd, /energia-estimada e /emissoes):
 * navegação local, capítulos da abertura, recorte (período, universo e unidade), datas de
 * cada parte, rodapé com downloads, link compartilhável e próxima pergunta, seções dos
 * modos Analisar e Auditar, tabela simples de servidor e citação de documento da fonte.
 *
 * Por que várias páginas: o mapa, as séries, as tabelas e as fichas de prova do
 * P063 (cadastro e estimativa do ONS) e do P064, juntos, passariam da meta de cerca
 * de 600 KB de HTML por página (contrato, seção 5.1).
 */

/** A abertura e as três páginas de painel como itens da navegação local; a descrição de cada uma é a pergunta que ela responde. */
const ITENS_TRANSICAO = [
  { id: "sintese", href: ROTA_TRANSICAO, rotulo: "Síntese", descricao: PERGUNTA_TRANSICAO },
  ...PAINEIS_TRANSICAO.map((p) => ({ id: p.id, href: rotaPainel(p.id), rotulo: p.rotulo, descricao: p.pergunta })),
];

/**
 * Faixa de páginas irmãs nas páginas filhas, com a atual marcada. A abertura não leva a faixa: mostra os mesmos destinos como
 * capítulos depois da figura principal (TransicaoCapitulos), e o mesmo rótulo não aparece duas vezes.
 */
export function TransicaoNavegacao({ atual }: { atual: PainelTransicao | "sintese" }) {
  if (atual === "sintese") return null;
  return <NavegacaoLocal rotulo="Páginas da transição e ambiente" itens={ITENS_TRANSICAO} atual={atual} />;
}

export type CapituloTransicao = {
  id: PainelTransicao;
  /** Resposta curta da página (RespostaCurta), com o veredito à vista e os números por trás em Analisar. */
  resposta: ReactNode;
  /** A grandeza da página, com a unidade e a definição: junto da resposta, não antes dela. */
  grandeza: { nome: string; unidade: string; texto: string };
  /** Datas e recortes da resposta. */
  contexto: ReactNode;
  /** O que a resposta não permite concluir. */
  limite: ReactNode;
  /** Destino com a âncora do painel. */
  href: string;
};

/**
 * Capítulos da abertura: as três páginas do módulo, cada uma com o nome, a pergunta que responde, a resposta curta, a grandeza e a
 * unidade que ela usa, o limite da leitura e o caminho para a página. Segue o desenho dos capítulos do sistema (nome, pergunta,
 * link; a página atual não entra), com a resposta no meio.
 */
export function TransicaoCapitulos({ itens }: { itens: CapituloTransicao[] }) {
  return (
    <nav aria-label="Capítulos da transição e ambiente" data-navegacao-local="capitulos" id="grandezas" className="scroll-mt-28 border-t border-linha pt-6">
      <h3 className="ed-h3 font-serif text-carvao">Uma página para cada pergunta, cada uma na sua unidade</h3>
      <ol className="mt-4 grid gap-x-10 gap-y-9 md:grid-cols-3">
        {itens.map((c) => {
          const p = PAINEIS_TRANSICAO.find((x) => x.id === c.id)!;
          return (
            <li key={c.id} id={`sintese-${c.id}`} className="flex min-w-0 scroll-mt-28 flex-col gap-2.5">
              <h4 className="ed-h3 font-serif text-carvao">{p.rotulo}</h4>
              <p className="text-sm font-medium leading-snug text-carvao">{p.pergunta}</p>
              {c.resposta}
              <p className="text-sm leading-relaxed text-carvao-muted">
                <span className="rotulo mr-2 text-mineral">
                  {c.grandeza.nome} · {c.grandeza.unidade}
                </span>
                {c.grandeza.texto}
              </p>
              <p className="text-xs leading-relaxed text-carvao-muted">{c.contexto}</p>
              <p className="text-sm leading-relaxed text-carvao-muted">
                <span className="rotulo mr-2 text-mineral">Não permite concluir</span>
                {c.limite}
              </p>
              <Link
                href={c.href}
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
export function TransicaoIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="transicao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo="Transição e ambiente indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold do módulo Transição e ambiente (public/energia/gold/transicao.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
          }
        />
      </main>
    </>
  );
}

/** Período, universo e unidade do painel, logo abaixo da figura principal: o recorte que o leitor precisa para ler a medida. */
export function TransicaoRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
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
export function TransicaoDatas({ itens }: { itens: { rotulo: string; texto: string; natureza: Natureza }[] }) {
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
export function TransicaoSeguir({ ancora, href, pergunta, downloads }: { ancora: string; href: string; pergunta: string; downloads: { rotulo: string; url: string }[] }) {
  return <SeguirPainel ancora={ancora} proximo={{ href, pergunta }} downloads={downloads} />;
}

/** Seção de Analisar: tabelas completas, séries detalhadas e comparações; continua no HTML do servidor. */
export function TransicaoAnalise({ titulo, children, id }: { titulo: ReactNode; children: ReactNode; id?: string }) {
  return (
    <SecaoDoPainel id={id} titulo={titulo} nivel="analisar">
      {children}
    </SecaoDoPainel>
  );
}

/** Seção de Auditar: regras por extenso, conferências, versões e limitações. */
export function TransicaoAuditoria({ titulo, children, id }: { titulo: ReactNode; children: ReactNode; id?: string }) {
  return (
    <SecaoDoPainel id={id} titulo={titulo} nivel="auditar">
      {children}
    </SecaoDoPainel>
  );
}

/** Aviso que muda a leitura (grandeza, estimativa, fonte defasada): borda tracejada, rótulo em texto, nunca só cor. */
export function TransicaoAviso({ rotulo, children, alerta = false }: { rotulo: string; children: ReactNode; alerta?: boolean }) {
  return (
    <div role={alerta ? "status" : undefined} className="flex flex-wrap items-start gap-x-3 gap-y-1 border border-dashed border-mineral bg-papel px-4 py-3 text-sm leading-relaxed text-carvao">
      <span className="rotulo shrink-0 text-carvao">{rotulo}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

/** Trecho literal de documento da fonte, com órgão, título, data de consulta e endereço. */
export function TransicaoDocumento({ doc }: { doc: DocumentoFonte }) {
  const [a, m, d] = doc.consultado_em.slice(0, 10).split("-");
  return (
    <figure className="border-l-2 border-linha pl-4 text-sm">
      <blockquote className="leading-relaxed text-carvao">&ldquo;{doc.trecho}&rdquo;</blockquote>
      <figcaption className="mt-1 text-xs text-carvao-muted">
        {doc.orgao}, {doc.titulo}. Consultado em {d}/{m}/{a}.{" "}
        <a href={doc.url} className="break-all text-energia-dark underline underline-offset-4 hover:text-carvao">
          {doc.url}
        </a>
      </figcaption>
    </figure>
  );
}

/**
 * Tabela simples renderizada no servidor (controles, listas curtas): caption,
 * cabeçalhos com escopo, rolagem horizontal dentro do componente e números
 * alinhados à direita. Ausência chega como texto ("sem dado"), nunca como zero.
 */
export function TransicaoTabela({ titulo, colunas, linhas, numericas = [] }: { titulo: string; colunas: string[]; linhas: ReactNode[][]; numericas?: number[] }) {
  return (
    <div className="tabela-scroll" tabIndex={0} role="region" aria-label={`${titulo} (tabela rolável)`}>
      <table className="w-full min-w-[28rem] border-collapse text-xs tabular-nums">
        <caption className="pb-2 text-left text-sm font-medium text-carvao">{titulo}</caption>
        <thead>
          <tr>
            {colunas.map((c, i) => (
              <th key={c} scope="col" className={`border-b border-linha px-2 py-1.5 font-medium text-mineral ${numericas.includes(i) ? "text-right" : "text-left"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, k) => (
            <tr key={k} className="border-b border-linha last:border-b-0">
              {l.map((c, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="px-2 py-1.5 text-left font-normal text-carvao">
                    {c}
                  </th>
                ) : (
                  <td key={i} className={`px-2 py-1.5 text-carvao ${numericas.includes(i) ? "text-right" : "text-left"}`}>
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
