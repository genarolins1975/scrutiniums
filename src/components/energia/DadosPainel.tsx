import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { VisaoLinkPainel } from "@/components/energia/VisaoLinkPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { carimbo } from "@/lib/energia/formato";
import { PAGINAS_DADOS, type IdPaginaDados } from "@/lib/energia/dados";

/**
 * Peças de servidor das páginas de Dados e Metodologia (P067 a P070): navegação entre os
 * quatro painéis, linha de referência, resposta curta, recorte, avisos, blocos dos modos
 * Analisar e Auditar e o rodapé do painel (downloads, link compartilhável, próxima pergunta).
 *
 * Quatro páginas e não uma: o catálogo (415 conjuntos), a saúde (151), o manifesto (269
 * arquivos) e as regras (276 indicadores) são tabelas grandes; juntas passariam da meta de cerca
 * de 600 KB de HTML (seção 5.1 do contrato dos módulos).
 */

const LINK = "inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";

export function DadosNavegacao({ atual }: { atual: IdPaginaDados }) {
  return (
    <nav aria-label="Painéis de Dados e Metodologia" className="border-y border-linha bg-superficie">
      <ul className="nav-faixa-barra flex flex-wrap gap-x-1 gap-y-0 px-2">
        {PAGINAS_DADOS.map((p) => {
          const ativo = p.id === atual;
          return (
            <li key={p.id}>
              <Link
                href={p.href}
                aria-current={ativo ? "page" : undefined}
                className={`flex min-h-[44px] items-center gap-1.5 px-3 text-sm ${ativo ? "bg-energia-fundo text-carvao shadow-[inset_0_-3px_0_var(--cor-energia)]" : "text-carvao-muted hover:text-carvao"}`}
              >
                {p.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Linha de referência do cabeçalho: as datas que o leitor precisa para não ler o painel como o dia em que abre a página, cada
 * uma com o que mede. A data de referência é o dia a que valem a situação e as contagens; o processamento é a hora em que o
 * catálogo e a saúde foram calculados; a lista de arquivos (manifesto) é refeita no fim de cada execução que reescreve
 * arquivos publicados, por isso pode ser mais recente.
 */
export function ReferenciaDados({ processadoEm, geradoEm, referencia, manifestoEm, extra }: { processadoEm?: string; geradoEm?: string; referencia?: string; manifestoEm?: string; extra?: ReactNode }) {
  // `geradoEm` é a forma antiga (uma só data de processamento), mantida para a página de avaliação dos painéis
  if (processadoEm === undefined) {
    return (
      <>
        {referencia ? <>Data de referência da publicação: {referencia}. </> : null}Publicação processada em {carimbo(geradoEm)}. {extra}
      </>
    );
  }
  return (
    <>
      {referencia ? <>Data de referência dos dados: {referencia}. </> : null}Catálogo e saúde processados em {carimbo(processadoEm)}. {manifestoEm ? <>Lista de arquivos gerada em {carimbo(manifestoEm)}. </> : null}
      {extra}
    </>
  );
}

/**
 * Resposta do painel. Com `veredito`, em duas camadas: o veredito à vista e a resposta completa em Analisar e Auditar; as provas
 * (Comprove este número) ficam fora das duas camadas. Sem `veredito`, a resposta completa à vista (página de avaliação).
 */
export function DadosResposta({ painel, veredito, children, prova }: { painel: string; veredito?: string; children: ReactNode; prova?: ReactNode }) {
  if (veredito === undefined) {
    return (
      <div className="mb-5 border-l-2 border-energia pl-4" data-resposta={painel}>
        <p className="text-base leading-relaxed text-carvao md:text-lg">{children}</p>
        {prova && <div className="mt-1 flex flex-wrap items-center gap-x-5">{prova}</div>}
      </div>
    );
  }
  return (
    <div className="mb-5 border-l-2 border-energia pl-4">
      <RespostaCurta id={painel} veredito={veredito}>
        {children}
      </RespostaCurta>
      {prova && <div className="mt-1 flex flex-wrap items-center gap-x-5">{prova}</div>}
    </div>
  );
}

export function DadosRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="mb-4 grid gap-x-6 gap-y-2 text-xs text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">Período</dt>
        <dd className="mt-0.5 leading-relaxed">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Universo</dt>
        <dd className="mt-0.5 leading-relaxed">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Unidade</dt>
        <dd className="mt-0.5 leading-relaxed">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Aviso que muda a leitura (data de referência, lacuna, divergência publicada). */
export function DadosAviso({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div id={id} className="my-3 border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao-muted">
      {children}
    </div>
  );
}

export function DadosAnalise({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="analisar" className="mt-6 scroll-mt-28 space-y-4 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function DadosAuditoria({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="auditar" className="mt-6 scroll-mt-28 space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

/** Limitações do painel: as de leitor sempre; as `tecnicas` (nome de banco, commit, arquivo) só em Analisar e Auditar. */
export function DadosLimitacoes({ itens, tecnicas = [] }: { itens: readonly ReactNode[]; tecnicas?: readonly ReactNode[] }) {
  if (!itens.length && !tecnicas.length) return null;
  return (
    <div className="mt-4">
      <p className="rotulo text-mineral">Limitações declaradas</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
        {itens.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
        {tecnicas.map((l, i) => (
          <li key={`t${i}`} data-nivel="analisar">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rodapé do painel: downloads, link compartilhável e próxima pergunta (seção 7.2, itens 8 a 10). */
export function DadosSeguir({ ancora, proximo, downloads }: { ancora: string; proximo: { href: string; pergunta: string }; downloads: readonly { rotulo: string; url: string }[] }) {
  const unicos = downloads.filter((d, i) => downloads.findIndex((x) => x.url === d.url) === i);
  return (
    <div className="mt-6 space-y-3 border-t border-linha pt-3">
      {unicos.length > 0 && (
        <div>
          <p className="rotulo text-mineral">Baixar os dados deste painel</p>
          <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {unicos.map((d) => (
              <li key={d.url}>
                <a href={d.url} download className={LINK}>
                  {d.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <VisaoLinkPainel ancora={ancora} />
        <p className="text-sm">
          <span className="rotulo mr-2 text-mineral">Próxima pergunta</span>
          <Link href={proximo.href} className={LINK}>
            {proximo.pergunta}
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Gold ausente: a página diz o que falta, nunca mostra número de reserva. */
export function DadosIndisponivel({ atual, motivo }: { atual: "dados" | "metodologia"; motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual={atual} />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
        <Indisponivel
          titulo="Dados indisponíveis nesta publicação"
          motivo={motivo ?? "As golds do módulo Dados (catalogo.json, publicacao.json, manifesto.json) não foram geradas ou não passaram na validação; a última publicação válida é mantida quando existe."}
        />
        <p className="mt-6 text-sm">
          <Link href="/setor-eletrico" className="text-energia-dark underline underline-offset-4">
            Voltar ao mapa do observatório
          </Link>
        </p>
      </main>
    </>
  );
}
