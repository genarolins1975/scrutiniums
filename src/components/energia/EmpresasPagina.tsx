import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { EmpresasLinkPainel } from "@/components/energia/EmpresasLinkPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { PAINEIS_EMPRESAS, ROTA_EMPRESAS, rotaPainel, type PainelEmpresas } from "@/lib/energia/empresas";

/**
 * Peças de servidor das páginas do módulo Empresas (a síntese em /setor-eletrico/empresas, um
 * painel por página em /ativos, /distribuidoras, /financas e /controle, e a ficha de cada
 * distribuidora em /[entidade]): navegação entre as páginas, recorte (período, universo e
 * unidade), rodapé com downloads, link compartilhável e próxima pergunta, avisos de bloqueio e
 * os blocos dos modos Analisar e Auditar.
 *
 * Por que um painel por página: cada painel tem tabelas de dezenas de linhas, gráficos com a
 * tabela equivalente e fichas de prova; juntos, os quatro passavam de 650 KB de HTML, acima da
 * meta de cerca de 600 KB por página (contrato, seção 5.1). O mapa das usinas, a árvore
 * societária e as séries financeiras de outras companhias vêm de arquivos lidos no navegador só
 * quando a pessoa pede.
 */

/** Navegação entre a síntese e as quatro páginas de painel; a atual leva aria-current (na ficha, nenhuma). */
export function EmpresasNavegacao({ atual }: { atual: PainelEmpresas | "sintese" | "ficha" }) {
  const itens = [{ href: ROTA_EMPRESAS, rotulo: "Síntese", id: "sintese" as const }, ...PAINEIS_EMPRESAS.map((p) => ({ href: rotaPainel(p.id), rotulo: p.rotulo, id: p.id }))];
  return (
    <nav aria-label="Páginas do módulo Empresas" className="pb-4">
      <ol className="flex flex-wrap gap-2 text-sm">
        {itens.map((i) => (
          <li key={i.id}>
            <Link
              href={i.href}
              aria-current={i.id === atual ? "page" : undefined}
              className={`inline-flex min-h-[44px] items-center border px-3 ${
                i.id === atual ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia hover:text-carvao"
              }`}
            >
              {i.rotulo}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function EmpresasIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
        <Indisponivel
          titulo="Empresas indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold do módulo Empresas (public/energia/gold/empresas.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
          }
        />
      </main>
    </>
  );
}

/** Período, universo e unidade do painel, logo abaixo da resposta (anatomia da seção 7.2, item 3). */
export function EmpresasRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
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

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta (seção 7.2, itens 9 e 10). */
export function EmpresasSeguir({
  ancora,
  proximo,
  downloads,
}: {
  ancora: string;
  proximo: { href: string; pergunta: string };
  downloads: { rotulo: string; url: string }[];
}) {
  return (
    <div className="space-y-3 border-t border-linha pt-3">
      {downloads.length > 0 && (
        <div>
          <p className="rotulo text-mineral">Baixar os dados deste painel</p>
          <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {downloads.map((d) => (
              <li key={d.url}>
                <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                  {d.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <EmpresasLinkPainel ancora={ancora} />
        <p className="text-sm">
          <span className="rotulo mr-2 text-mineral">Próxima pergunta</span>
          <Link href={proximo.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            {proximo.pergunta}
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Aviso de limitação que muda a leitura (bloqueio de fonte, fonte defasada, medida não publicada). */
export function EmpresasAviso({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao-muted">
      <p className="rotulo text-mineral">{rotulo}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function EmpresasAuditoria({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div data-nivel="auditar" className="space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function EmpresasAnalise({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div data-nivel="analisar" className="space-y-3 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function EmpresasSubtitulo({ children }: { children: ReactNode }) {
  return <h3 className="font-serif text-lg text-carvao">{children}</h3>;
}

/** Resposta curta derivada dos dados, marcada para o teste (data-resposta). */
export function EmpresasResposta({ id, children }: { id: PainelEmpresas | "ficha"; children: ReactNode }) {
  return (
    <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta={id}>
      {children}
    </p>
  );
}
