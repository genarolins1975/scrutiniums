import type { ReactNode } from "react";
import type { Natureza, Proveniencia } from "@/lib/energia/tipos";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { SobreEsteDado } from "@/components/evidencia/SobreEsteDado";

/**
 * Regra editorial da plataforma incorporada ao design system: toda
 * visualização relevante responde, nesta ordem, O que estou vendo? Por que
 * importa? O que mudou? Como interpretar? O que NÃO posso concluir? Qual é a
 * fonte? Os seis campos são obrigatórios no tipo: um painel sem "o que não
 * posso concluir" não compila.
 */
export type RegraEditorial = {
  /** O que estou vendo: pergunta ou conclusão no título. */
  pergunta: string;
  /** Indicador · unidade (subtítulo técnico). */
  subtitulo: string;
  porQueImporta: ReactNode;
  oQueMudou: ReactNode;
  comoInterpretar: ReactNode;
  naoConcluir: ReactNode;
  proveniencia: Proveniencia;
};

export function PainelEvidencia({
  id,
  natureza,
  children,
  nivel,
  extraFonte,
  ...r
}: RegraEditorial & {
  id: string;
  natureza?: Natureza;
  children: ReactNode;
  /** Modo mínimo em que o painel aparece (ver ModoProfundidade). */
  nivel?: "entender" | "analisar" | "auditar";
  extraFonte?: ReactNode;
}) {
  const nat = natureza ?? r.proveniencia.natureza;
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} data-nivel={nivel} className="scroll-mt-28 border border-linha bg-superficie">
      <header className="px-5 pt-6 md:px-8">
        <h3 id={`${id}-titulo`} className="font-serif text-xl leading-snug text-carvao md:text-2xl">
          {r.pergunta}
        </h3>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-mineral">
          <span>{r.subtitulo}</span>
          <SeloNatureza natureza={nat} />
        </p>
      </header>
      <div className="px-3 py-5 md:px-6">{children}</div>
      <div className="grid gap-px border-t border-linha bg-linha md:grid-cols-2">
        <Bloco rotulo="Por que isso importa">{r.porQueImporta}</Bloco>
        <Bloco rotulo="O que mudou">{r.oQueMudou}</Bloco>
        <Bloco rotulo="Como interpretar">{r.comoInterpretar}</Bloco>
        <Bloco rotulo="O que não é possível concluir">{r.naoConcluir}</Bloco>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-linha px-5 py-3 md:px-8">
        <p className="text-xs leading-relaxed text-mineral">
          Fonte: {r.proveniencia.fonte.orgao}, {r.proveniencia.fonte.dataset}. Referência até{" "}
          {fim(r.proveniencia.periodo_referencia.fim)}. {extraFonte}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {r.proveniencia.download && (
            <a href={r.proveniencia.download} download className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
              Baixar CSV
            </a>
          )}
          <SobreEsteDado p={r.proveniencia} />
        </div>
      </footer>
    </section>
  );
}

function fim(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return iso.length > 10 ? `${d}/${m}/${a} ${iso.slice(11, 16)}` : `${d}/${m}/${a}`;
}

function Bloco({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="bg-superficie px-5 py-4 md:px-8">
      <p className="rotulo text-mineral">{rotulo}</p>
      <div className="mt-1.5 text-sm leading-relaxed text-carvao-muted">{children}</div>
    </div>
  );
}
