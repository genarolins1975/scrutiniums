import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { RegulacaoLinkPainel } from "@/components/energia/RegulacaoLinkPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { PAINEIS_REGULACAO, ROTA_REGULACAO, rotaPainel, type IdPainelRegulacao } from "@/lib/energia/regulacao";

/**
 * Peças de servidor das páginas da Regulação (um painel por página:
 * /setor-eletrico/regulacao para o P044, /linha-do-tempo para o P045 e
 * /consultas-e-agenda para o P046): navegação entre os painéis, recorte (período,
 * universo e unidade), resposta curta, avisos de ausência e de fonte defasada,
 * rodapé com downloads, link compartilhável e próxima pergunta, e os blocos dos
 * modos Analisar e Auditar.
 *
 * Por que um painel por página: os três juntos trazem atos com trechos literais,
 * 82 procedimentos, 26 eventos e 44 consultas com fases e resultados, além das
 * tabelas equivalentes e das fichas de prova; numa página só passariam da meta de
 * cerca de 600 KB de HTML (contrato, seção 5.1).
 */

/** Navegação entre os três painéis; o atual leva aria-current. */
export function RegulacaoNavegacao({ atual }: { atual: IdPainelRegulacao }) {
  return (
    <nav aria-label="Painéis da regulação" className="pb-4">
      <ol className="flex flex-wrap gap-2 text-sm">
        {PAINEIS_REGULACAO.map((p) => (
          <li key={p.id}>
            <Link
              href={rotaPainel(p.id)}
              aria-current={p.id === atual ? "page" : undefined}
              className={`inline-flex min-h-[44px] items-center border px-3 ${
                p.id === atual ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia hover:text-carvao"
              }`}
            >
              {p.rotulo}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Gold ausente ou reprovada na validação: a página diz o que falta, nunca mostra número de reserva. */
export function RegulacaoIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="regulacao" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
        <Indisponivel
          titulo="Regulação indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold da regulação (public/energia/gold/regulacao.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
          }
        />
        <p className="mt-6 text-sm">
          <Link href={ROTA_REGULACAO} className="text-energia-dark underline underline-offset-4">
            Voltar à regulação
          </Link>
        </p>
      </main>
    </>
  );
}

/** Resposta curta derivada dos dados (anatomia da seção 7.2, item 2). */
export function RegulacaoResposta({ id, children }: { id: IdPainelRegulacao; children: ReactNode }) {
  return (
    <p data-resposta={id} className="max-w-prose2 text-base leading-relaxed text-carvao md:text-lg">
      {children}
    </p>
  );
}

/** Período, universo e unidade do painel, logo abaixo da resposta (seção 7.2, item 3). */
export function RegulacaoRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
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

/** Aviso que muda a leitura (fonte defasada, ausência legítima, comparação incompatível). */
export function RegulacaoAviso({ children, tipo = "nota" }: { children: ReactNode; tipo?: "nota" | "alerta" }) {
  return (
    <p
      role={tipo === "alerta" ? "alert" : undefined}
      className={`border-l-2 pl-3 text-sm leading-relaxed [overflow-wrap:anywhere] ${tipo === "alerta" ? "border-aviso text-carvao" : "border-mineral text-carvao-muted"}`}
    >
      {children}
    </p>
  );
}

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta (seção 7.2, itens 9 e 10). */
export function RegulacaoSeguir({ ancora, proximo, downloads }: { ancora: string; proximo: { href: string; pergunta: string }; downloads: { rotulo: string; url: string }[] }) {
  return (
    <div className="space-y-3 border-t border-linha pt-3">
      {downloads.length > 0 && (
        <div>
          <p className="rotulo text-mineral">Baixar os dados deste painel</p>
          <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {downloads.map((d) => (
              <li key={d.url}>
                <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                  {d.rotulo} (CSV)
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <RegulacaoLinkPainel ancora={ancora} />
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

export function RegulacaoAnalise({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="analisar" className="scroll-mt-28 space-y-4 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function RegulacaoAuditoria({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="auditar" className="scroll-mt-28 space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

/** Bloco "Como ler" e "O que não permite concluir" junto do gráfico (seção 7.2, item 7), além dos blocos do PainelEvidencia. */
export function RegulacaoLeitura({ comoLer, naoPermite }: { comoLer: ReactNode; naoPermite: ReactNode }) {
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

/** Link externo para documento oficial ou cópia pública; abre em nova aba com aviso para leitor de tela. */
export function RegulacaoLinkExterno({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere] hover:text-carvao">
      {children}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}
