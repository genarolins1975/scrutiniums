import type { ReactNode } from "react";
import { ContaLinkFiltros } from "@/components/energia/ContaLinkPainel";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import type { Natureza } from "@/lib/energia/tipos";

/**
 * Peças de servidor comuns às duas páginas da Conta de luz (tarifas, composição e
 * simulador em /setor-eletrico/conta-de-luz; reajustes, bandeiras e subsídios em
 * /setor-eletrico/conta-de-luz/reajustes-e-subsidios): a faixa de páginas irmãs, o
 * recorte de cada painel (período, universo e unidade), as datas de cada parte, o
 * rodapé de cada painel (downloads, link com o recorte e próxima pergunta, no
 * SeguirPainel do sistema) e as seções de Analisar e de Auditar (SecaoDoPainel).
 * Não é rota: o App Router só publica page.tsx.
 */

export const ROTA_CONTA = "/setor-eletrico/conta-de-luz";
export const ROTA_REAJUSTES = "/setor-eletrico/conta-de-luz/reajustes-e-subsidios";

export const FONTE_TARIFAS = "ANEEL, Tarifas de aplicação das distribuidoras de energia elétrica";

/** Páginas do módulo, na ordem em que o leitor as percorre: o preço do mesmo consumo, e depois o que mudou e quem financia. */
const PAGINAS = [
  { id: "tarifas", href: ROTA_CONTA, rotulo: "Tarifas, composição e simulador" },
  { id: "reajustes", href: ROTA_REAJUSTES, rotulo: "Reajustes, bandeiras e subsídios" },
] as const;

/**
 * Faixa de páginas irmãs do módulo (a página atual marcada com aria-current), no alto das duas páginas: quem chega pela página principal
 * vê logo a aba da outra, sem rolar até o resumo. Tem a mesma marcação da NavegacaoLocal do sistema, mas os links levam junto a escolha
 * de distribuidoras (?dist=) feita na outra página, como a Conta de luz sempre fez; a mudança pedida à NavegacaoLocal está em
 * docs/energia/redesign/pedidos/conta-de-luz.md. O resumo "O que mudou e quem financia os benefícios?" segue na página principal, com
 * a resposta de cada painel da página filha.
 */
export function Navegacao({ atual }: { atual: (typeof PAGINAS)[number]["id"] }) {
  return (
    <nav aria-label="Páginas de Conta de luz" data-navegacao-local="faixa" className="border-b border-linha">
      <ol className="nav-faixa flex flex-wrap gap-x-6 text-sm">
        {PAGINAS.map((p) => {
          const ativo = p.id === atual;
          return (
            <li key={p.id}>
              <ContaLinkFiltros
                href={p.href}
                atual={ativo}
                className={`-mb-px inline-flex min-h-[44px] items-center border-b-2 px-0.5 ${
                  ativo ? "border-energia text-carvao" : "border-transparent text-carvao-muted hover:border-linha hover:text-carvao"
                }`}
              >
                {p.rotulo}
              </ContaLinkFiltros>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Período, universo e unidade do painel, logo abaixo das figuras (anatomia da seção 7.2, item 3). */
export function Recorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
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

/** Datas de referência de cada parte da página: cada número diz o seu dia, sem sugerir simultaneidade. */
export function Datas({ itens }: { itens: { rotulo: string; texto: string; natureza: Natureza }[] }) {
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

/** Arquivos do painel entre os downloads da gold: os que a página escolhe pelo endereço (nome do CSV). */
export function downloadsDoPainel(downloads: readonly { rotulo: string; url: string }[], arquivos: readonly string[]): { rotulo: string; url: string }[] {
  return downloads.filter((d) => arquivos.some((a) => d.url.endsWith(a)));
}

/** Rodapé de cada painel numa linha: baixar os dados, copiar o link com o recorte e a próxima pergunta (SeguirPainel). */
export function Seguir({
  ancora,
  proximo,
  downloads = [],
}: {
  ancora: string;
  proximo: { href: string; pergunta: string };
  downloads?: { rotulo: string; url: string }[];
}) {
  return <SeguirPainel ancora={ancora} proximo={proximo} downloads={downloads} />;
}

/** Seção de Analisar dentro de um painel (tabelas completas, comparações e exploração). */
export function Analise({ titulo, id, children, lead }: { titulo: string; id?: string; children: ReactNode; lead?: ReactNode }) {
  return (
    <SecaoDoPainel id={id} nivel="analisar" titulo={titulo} lead={lead}>
      {children}
    </SecaoDoPainel>
  );
}

/** Seção de Auditar dentro de um painel (regras, conferências, arquivos e exceções). */
export function Auditoria({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <SecaoDoPainel id={id} nivel="auditar" titulo={titulo}>
      {children}
    </SecaoDoPainel>
  );
}
