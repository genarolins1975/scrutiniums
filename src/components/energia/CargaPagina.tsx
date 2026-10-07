import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CargaLinkPainel } from "@/components/energia/CargaLinkPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { PAINEIS_CARGA, ROTA_CARGA, rotaPainel, type PainelCarga } from "@/lib/energia/carga";
import { carimbo } from "@/lib/energia/formato";
import type { FonteCarga } from "@/lib/energia/tipos-carga";
import { datasLegiveis } from "@/lib/energia/visao";

/**
 * Peças de servidor das páginas da Carga (um painel por página: /setor-eletrico/carga
 * para o P025, /perfil-horario para o P026 e /clima-e-calendario para o P027):
 * navegação entre os painéis, recorte (período, universo e unidade), avisos de
 * ausência e defasagem, rodapé com downloads, link compartilhável e próxima pergunta,
 * os blocos dos modos Analisar e Auditar e a lista de fontes.
 *
 * Por que um painel por página: cada painel tem séries horárias ou diárias, várias
 * tabelas equivalentes e fichas de prova; juntos passariam da meta de cerca de 600 KB
 * de HTML por página (contrato, seção 5.1).
 */

/** Navegação entre os três painéis; o atual leva aria-current. */
export function CargaNavegacao({ atual }: { atual: PainelCarga }) {
  return (
    <nav aria-label="Painéis da carga" className="pb-4">
      <ol className="flex flex-wrap gap-2 text-sm">
        {PAINEIS_CARGA.map((p) => (
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

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function CargaIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="carga" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
        <Indisponivel
          titulo="Carga indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold de detalhe da carga (public/energia/gold/carga_detalhe.json) não foi gerada ou não passou na validação física; a última publicação válida é mantida quando existe."
          }
        />
        <p className="mt-6 text-sm">
          <Link href={ROTA_CARGA} className="text-energia-dark underline underline-offset-4">
            Voltar à carga
          </Link>
        </p>
      </main>
    </>
  );
}

/** Período, universo e unidade do painel, logo abaixo da resposta (anatomia da seção 7.2, item 3). */
export function CargaRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
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
export function CargaAviso({ children, tipo = "nota" }: { children: ReactNode; tipo?: "nota" | "alerta" }) {
  return (
    <p
      role={tipo === "alerta" ? "alert" : undefined}
      className={`border-l-2 pl-3 text-sm leading-relaxed ${tipo === "alerta" ? "border-aviso text-carvao" : "border-mineral text-carvao-muted"}`}
    >
      {children}
    </p>
  );
}

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta (seção 7.2, itens 9 e 10). */
export function CargaSeguir({ ancora, proximo, downloads }: { ancora: string; proximo: { href: string; pergunta: string }; downloads: { rotulo: string; url: string }[] }) {
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
        <CargaLinkPainel ancora={ancora} />
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

export function CargaAnalise({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="analisar" className="scroll-mt-28 space-y-4 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function CargaAuditoria({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} data-nivel="auditar" className="scroll-mt-28 space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

/** Lista das fontes usadas no painel, com recurso, licença, período e última captura. */
export function CargaFontes({ fontes }: { fontes: FonteCarga[] }) {
  return (
    <ul className="space-y-2 text-sm text-carvao-muted">
      {fontes.map((f) => (
        // recurso pode ser um endereço longo sem espaço: quebra dentro da linha em vez de alargar a página no celular
        <li key={f.id} className="leading-relaxed [overflow-wrap:anywhere]">
          <span className="text-carvao">
            {f.orgao}, {f.conjunto}
          </span>
          : {f.recurso}. Grão: {f.grao}
          {f.unidade ? `; unidade: ${f.unidade}` : ""}
          {f.periodo ? `; período: ${datasLegiveis(f.periodo.inicio ?? "sem início")} a ${datasLegiveis(f.periodo.fim ?? "sem fim")}` : ""}
          {f.ultima_captura ? `; última captura: ${carimbo(f.ultima_captura)}` : ""}. Licença: {f.licenca}.{" "}
          <a href={f.url} className="text-energia-dark underline underline-offset-4" rel="noopener noreferrer">
            Endereço da fonte
          </a>
        </li>
      ))}
    </ul>
  );
}
