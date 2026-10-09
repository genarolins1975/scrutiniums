import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { GeracaoLinkPainel } from "@/components/energia/GeracaoLinkPainel";
export { GeracaoAviso, GeracaoRecorte } from "@/components/energia/GeracaoControles";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { carimbo } from "@/lib/energia/formato";
import { PAINEIS_GERACAO, ROTA_GERACAO, rotaPainel, type PainelGeracao } from "@/lib/energia/geracao";
import type { EvidenciaDocumental } from "@/lib/energia/tipos-geracao";

/**
 * Peças de servidor das páginas da Geração (um painel por página: /setor-eletrico/geracao
 * para o P021, /termica para o P022, /restricoes para o P023 e /capacidade para o P024):
 * navegação entre os painéis, recorte (período, universo e unidade), avisos de ausência e
 * defasagem, rodapé com downloads, link compartilhável e próxima pergunta, os blocos dos
 * modos Analisar e Auditar e a lista de documentos oficiais citados.
 *
 * Por que um painel por página: cada painel tem séries, várias tabelas equivalentes e
 * fichas de prova; juntos passariam da meta de cerca de 600 KB de HTML por página
 * (contrato, seção 5.1).
 */

/** Navegação entre os quatro painéis; o atual leva aria-current. */
export function GeracaoNavegacao({ atual }: { atual: PainelGeracao }) {
  return (
    <nav aria-label="Painéis da geração" className="pb-4">
      <ol className="nav-faixa flex flex-wrap gap-2 text-sm">
        {PAINEIS_GERACAO.map((p) =>
          !p.publicado ? (
            <li key={p.id}>
              <span className="inline-flex min-h-[44px] items-center border border-dashed border-linha px-3 text-carvao-muted">
                {p.rotulo}
                <span className="ml-1.5 text-xs text-mineral">(em preparação)</span>
              </span>
            </li>
          ) : (
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
          ),
        )}
      </ol>
    </nav>
  );
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function GeracaoIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="geracao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina px-4 py-14 sm:px-6">
        <Indisponivel
          titulo="Geração indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold de detalhe da geração (public/energia/gold/geracao_detalhe.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
          }
        />
        <p className="mt-6 text-sm">
          <Link href={ROTA_GERACAO} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            Voltar à geração
          </Link>
        </p>
      </main>
    </>
  );
}

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta (seção 7.2, itens 9 e 10). */
export function GeracaoSeguir({ ancora, proximo, downloads }: { ancora: string; proximo: { href: string; pergunta: string } | null; downloads: { rotulo: string; url: string }[] }) {
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
        <GeracaoLinkPainel ancora={ancora} />
        {proximo && (
          <p className="text-sm">
            <span className="rotulo mr-2 text-mineral">Próxima pergunta</span>
            <Link href={proximo.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
              {proximo.pergunta}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export function GeracaoAnalise({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="analisar" className="scroll-mt-28 space-y-4 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function GeracaoAuditoria({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="auditar" className="scroll-mt-28 space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

/** Regras publicadas na gold, com rótulo legível. */
export function GeracaoRegras({ regras }: { regras: { rotulo: string; texto: string }[] }) {
  return (
    <dl className="grid gap-4 md:grid-cols-2">
      {regras.map((r) => (
        <div key={r.rotulo} className="min-w-0">
          <dt className="rotulo text-mineral">{r.rotulo}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-carvao [overflow-wrap:anywhere]">{r.texto}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Lista de frases (limitações da proveniência, tratamento do A11, controles). */
export function GeracaoFrases({ itens }: { itens: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao-muted [overflow-wrap:anywhere]">
      {itens.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

/**
 * Documentos oficiais que sustentam o achado A11, com o trecho literal capturado (quando o
 * texto foi encontrado) e a constatação da plataforma separada da citação.
 */
export function GeracaoDocumentos({ documentos }: { documentos: EvidenciaDocumental[] }) {
  return (
    <ul className="space-y-4 text-sm text-carvao-muted">
      {documentos.map((d, i) => (
        <li key={`${d.documento}:${i}`} className="space-y-1 [overflow-wrap:anywhere]">
          <p>
            {d.url ? (
              <a href={d.url} rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                {d.orgao}, {d.documento}
              </a>
            ) : (
              <span className="text-carvao">
                {d.orgao}, {d.documento}
              </span>
            )}
            {d.versao ? `, versão ${d.versao}` : ""}
            {d.data_documento ? ` de ${d.data_documento.replaceAll("-", "/")}` : ""}
            {d.capturado_em ? `; capturado em ${carimbo(d.capturado_em)}` : "; sem captura registrada"}.
          </p>
          {d.trecho ? (
            <p className="pl-4">
              <span className="text-carvao">&ldquo;{d.trecho}&rdquo;</span> <span className="text-xs">(trecho literal do documento)</span>
            </p>
          ) : (
            <p className="pl-4 text-xs">Trecho não encontrado na captura; o documento é citado só como referência.</p>
          )}
          {d.constatacao && <p className="pl-4 text-xs">Constatação da plataforma, não citação: {d.constatacao}</p>}
        </li>
      ))}
    </ul>
  );
}
