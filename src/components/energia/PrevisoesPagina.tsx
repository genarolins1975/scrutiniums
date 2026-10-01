import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { PrevisoesLinkPainel } from "@/components/energia/PrevisoesLinkPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { PAINEIS_PREVISOES, ROTA_MODELOS, ROTA_PREVISOES, enderecoPainel, type IdPainelPrevisoes } from "@/lib/energia/previsoes";

/**
 * Peças de servidor das páginas de Previsões e modelos do PLD: navegação entre os
 * quatro painéis (P013 e P015 em /previsoes, P014 e P016 em /modelos), resposta
 * curta, recorte (período, universo e unidade), avisos de ausência legítima e de
 * fonte defasada, "Como ler" e "O que não permite concluir", rodapé com downloads,
 * link compartilhável e próxima pergunta, e os blocos dos modos Analisar e Auditar.
 *
 * Por que dois painéis por página: a previsão atual e o arquivo de emissões leem a
 * mesma rodada (o que se prevê e o que ficou registrado antes do resultado); o
 * registro de modelos e o desempenho comparam os mesmos modelos. Juntos, os quatro
 * levariam fichas, coeficientes, o arquivo e as provas de cada número a uma página
 * só, acima da meta de cerca de 600 KB de HTML (contrato, seção 5.1).
 */

/** Navegação entre os quatro painéis; os da página atual levam aria-current. */
export function PrevisoesNavegacao({ pagina }: { pagina: "previsoes" | "modelos" }) {
  const rota = pagina === "previsoes" ? ROTA_PREVISOES : ROTA_MODELOS;
  return (
    <nav aria-label="Painéis de previsões e modelos" className="pb-4">
      <ol className="flex flex-wrap gap-2 text-sm">
        {PAINEIS_PREVISOES.map((p) => {
          const aqui = p.rota === rota;
          return (
            <li key={p.id}>
              <Link
                href={aqui ? `#${p.id}` : enderecoPainel(p.id)}
                aria-current={aqui ? "location" : undefined}
                className={`inline-flex min-h-[44px] items-center gap-2 border px-3 ${
                  aqui ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia hover:text-carvao"
                }`}
              >
                <span className="tabular-nums text-xs">{p.codigo}</span>
                {p.rotulo}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Gold ausente ou reprovada: a página diz o que falta, nunca mostra número de reserva. */
export function PrevisoesIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="pld-modelos" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-4 py-14 sm:px-6">
        <Indisponivel
          titulo="Previsões e modelos indisponíveis nesta publicação"
          motivo={
            motivo ??
            "A gold das previsões (public/energia/gold/previsoes_desempenho.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
          }
        />
        <p className="mt-6 text-sm">
          <Link href="/setor-eletrico/pld" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            Voltar ao PLD
          </Link>
        </p>
      </main>
    </>
  );
}

/** Resposta curta derivada dos dados (anatomia da seção 7.2, item 2). */
export function PrevisoesResposta({ id, children }: { id: IdPainelPrevisoes; children: ReactNode }) {
  return (
    <p data-resposta={id} className="max-w-prose2 text-base leading-relaxed text-carvao md:text-lg">
      {children}
    </p>
  );
}

/** Período, universo e unidade do painel, logo abaixo da resposta (seção 7.2, item 3). */
export function PrevisoesRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-xs text-carvao-muted sm:grid-cols-3">
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

/** Aviso que muda a leitura (fonte defasada, ausência legítima, número retido). */
export function PrevisoesAviso({ children, tipo = "nota" }: { children: ReactNode; tipo?: "nota" | "alerta" }) {
  return (
    <div
      role={tipo === "alerta" ? "status" : undefined}
      className={`border-l-2 pl-3 text-sm leading-relaxed [overflow-wrap:anywhere] ${tipo === "alerta" ? "border-aviso text-carvao" : "border-mineral text-carvao-muted"}`}
    >
      {children}
    </div>
  );
}

/** "Como ler" e "O que não permite concluir" junto do gráfico (seção 7.2, item 7). */
export function PrevisoesLeitura({ comoLer, naoPermite }: { comoLer: ReactNode; naoPermite: ReactNode }) {
  return (
    <div className="grid gap-4 text-sm leading-relaxed md:grid-cols-2">
      <div>
        <p className="rotulo text-mineral">Como ler</p>
        <div className="mt-1 text-carvao-muted">{comoLer}</div>
      </div>
      <div>
        <p className="rotulo text-mineral">O que não permite concluir</p>
        <div className="mt-1 text-carvao-muted">{naoPermite}</div>
      </div>
    </div>
  );
}

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta (seção 7.2, itens 9 e 10). */
export function PrevisoesSeguir({
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
                <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere] hover:text-carvao">
                  {d.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <PrevisoesLinkPainel ancora={ancora} />
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

/** Bloco que aparece a partir do modo Analisar. */
export function PrevisoesAnalise({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="analisar" className="min-w-0 scroll-mt-28 space-y-4 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

/** Bloco que aparece só no modo Auditar. */
export function PrevisoesAuditoria({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="auditar" className="min-w-0 scroll-mt-28 space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

/** Lista de definição compacta (rótulo e valor) para fichas e metadados da rodada. */
export function PrevisoesFichaLinha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="border-t border-linha py-3 md:grid md:grid-cols-[13rem_1fr] md:gap-6">
      <dt className="rotulo text-mineral">{rotulo}</dt>
      <dd className="mt-1 min-w-0 text-sm leading-relaxed text-carvao [overflow-wrap:anywhere] md:mt-0">{children}</dd>
    </div>
  );
}

/** Link externo para documento oficial; abre em nova aba com aviso para leitor de tela. */
export function PrevisoesLinkExterno({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere] hover:text-carvao">
      {children}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}
