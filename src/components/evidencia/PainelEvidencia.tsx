import { fonteLegivel } from "@/lib/energia/bastidor";
import type { ReactNode } from "react";
import type { Natureza, Proveniencia } from "@/lib/energia/tipos";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { SobreEsteDado } from "@/components/evidencia/SobreEsteDado";
import { provenienciaLegivel } from "@/lib/energia/mercado";

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

/** Outro número do mesmo painel com natureza ou transformação própria (padrão
 * histórico, média de janela, saldo de outro conjunto): selo e gaveta próprios. */
export type ProvenienciaComplementar = { rotulo: string; p: Proveniencia };

export function PainelEvidencia({
  id,
  natureza,
  children,
  nivel,
  extraFonte,
  complementares: complementaresBrutos = [],
  nivelTitulo = 2,
  proveniencia: provenienciaBruta,
  ...restante
}: RegraEditorial & {
  id: string;
  natureza?: Natureza;
  children: ReactNode;
  /** Modo mínimo em que o painel aparece (ver ModoProfundidade). */
  nivel?: "entender" | "analisar" | "auditar";
  extraFonte?: ReactNode;
  complementares?: ProvenienciaComplementar[];
  /** 2 em páginas de módulo (logo abaixo do h1); 3 dentro de seções que já têm h2. */
  nivelTitulo?: 2 | 3;
}) {
  // datas ISO soltas nos textos que o pipeline escreve saem na forma da página (dd/mm/aaaa)
  const r = { ...restante, proveniencia: provenienciaLegivel(provenienciaBruta) };
  const complementares = complementaresBrutos.map((c) => ({ ...c, p: provenienciaLegivel(c.p) }));
  const nat = natureza ?? r.proveniencia.natureza;
  // um selo por natureza presente no painel (principal e complementares), sem repetir
  const selos = Array.from(new Set<Natureza>([nat, ...complementares.map((c) => c.p.natureza)]));
  // todas as fontes do painel (principal e complementares), cada uma com a sua data de referência
  const fontes: { nome: string; ate: string }[] = [];
  for (const p of [r.proveniencia, ...complementares.map((c) => c.p)]) {
    const nome = `${p.fonte.orgao}, ${p.fonte.dataset}`;
    const existente = fontes.find((f) => f.nome === nome);
    if (!existente) fontes.push({ nome, ate: p.periodo_referencia.fim });
    else if (p.periodo_referencia.fim > existente.ate) existente.ate = p.periodo_referencia.fim;
  }
  const Titulo = nivelTitulo === 3 ? "h3" : "h2";
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} data-nivel={nivel} className="scroll-mt-28 border border-linha bg-superficie">
      <header className="px-5 pt-6 md:px-8">
        <Titulo id={`${id}-titulo`} className="font-serif text-xl leading-snug text-carvao md:text-2xl">
          {r.pergunta}
        </Titulo>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-mineral">
          <span>{r.subtitulo}</span>
          {selos.map((n) => (
            <SeloNatureza key={n} natureza={n} />
          ))}
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
          {fontes.length === 1
            ? `Fonte: ${fonteLegivel(fontes[0].nome)}. Referência até ${fim(fontes[0].ate)}. `
            : `Fontes: ${fontes.map((f) => `${fonteLegivel(f.nome)} (referência até ${fim(f.ate)})`).join("; ")}. `}
          {extraFonte}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {r.proveniencia.download && (
            <a href={r.proveniencia.download} download className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
              Baixar CSV
            </a>
          )}
          <SobreEsteDado p={r.proveniencia} />
        </div>
        {complementares.length > 0 && (
          <ul className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 border-t border-linha pt-2">
            {complementares.map((c) => (
              <li key={c.rotulo} className="flex flex-wrap items-center gap-2">
                <SeloNatureza natureza={c.p.natureza} />
                <SobreEsteDado p={c.p} rotulo={c.rotulo} />
              </li>
            ))}
          </ul>
        )}
      </footer>
    </section>
  );
}

function fim(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  if (d === undefined) return m === undefined ? a : `${m}/${a}`;
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
