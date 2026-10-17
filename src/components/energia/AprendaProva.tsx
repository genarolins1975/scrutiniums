import Link from "@/components/i18n/LinkIdioma";
import { NATUREZAS, SeloNatureza } from "@/components/evidencia/SeloNatureza";
import type { Natureza } from "@/lib/energia/tipos";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { conjuntoLegivel, dataRef, diaBrasilia, textoPeriodo } from "@/lib/energia/evidencia";
import type { Evidencia } from "@/lib/energia/evidencia";
import type { Prova } from "@/lib/energia/conteudo/provas";
import { comVolta } from "@/lib/energia/conteudo/trilhas";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { NATUREZA_EN, rotuloFicha, valorExibidoNoIdioma } from "@/lib/energia/i18n/aprenda";
import type { Idioma } from "@/lib/idioma";

/**
 * Rótulo lido da ficha (indicador, entidade): na página inglesa, a forma da tabela exata de i18n/aprenda.ts; sem ela, o texto da gold
 * em português, marcado.
 */
function RotuloFicha({ texto, regiao, idioma }: { texto: string; regiao: string; idioma: Idioma }) {
  const en = rotuloFicha(texto, idioma);
  return en !== null ? <>{en}</> : <TrechoPortugues regiao={regiao}>{texto}</TrechoPortugues>;
}

/**
 * Base do número quando o valor exibido não a traz ("61,5%" com unidade "% da EAR máxima"
 * vira "61,5% da EAR máxima"). Valores em reais já trazem a unidade na exibição.
 */
function baseDoValor(ev: Evidencia): string | null {
  const u = ev.unidade?.trim();
  const v = ev.valor_exibido.trim();
  if (!u || v.startsWith("R$") || v.includes(u)) return null;
  if (u.startsWith("%")) return v.endsWith("%") ? u.slice(1).trim() || null : null;
  return /\d$/.test(v) ? u : null;
}

/** Legenda visível dos selos de natureza do exemplo (a explicação não pode morar só no atributo title, que o toque não mostra). */
function LegendaNatureza({ naturezas }: { naturezas: Natureza[] }) {
  if (!naturezas.length) return null;
  const idioma = idiomaEnergia();
  const texto = (n: Natureza) => (idioma === "en" ? NATUREZA_EN[n] : NATUREZAS[n]);
  return (
    <p className="mt-2 text-xs leading-relaxed text-mineral" data-legenda-natureza="true">
      {naturezas.map((n, i) => (
        <span key={n}>
          {i > 0 && " "}
          <span aria-hidden="true">{NATUREZAS[n].glifo}</span> {texto(n).rotulo}: {texto(n).definicao}
        </span>
      ))}
    </p>
  );
}

/**
 * Número real que ilustra um verbete ou um passo de trilha. Com ficha publicada, mostra o
 * valor exatamente como o painel o exibe, o recorte, a natureza, a ficha de prova e o
 * link ao painel; sem ficha, o exemplo em texto com o selo de cada número. O link leva
 * ?volta= para o painel oferecer o caminho de volta a este contexto (RetornoContexto).
 * Renderiza no servidor; só a ficha de prova é cliente.
 */
export function AprendaProva({ prova, volta, alternativa }: { prova: Prova | null; volta: string; alternativa?: { rotulo: string; href: string } | null }) {
  if (!prova)
    return (
      <div data-prova="indisponivel" className="border border-dashed border-mineral bg-papel p-4 sm:p-5">
        <p className="text-sm leading-relaxed text-carvao">
          {tx(
            "Este exemplo está indisponível nesta publicação: o painel de origem não trouxe o número, e o observatório não o substitui por outro.",
            "This example is unavailable in this publication: the source panel did not bring the number, and the observatory does not replace it with another.",
          )}
        </p>
        {alternativa && (
          <Link href={comVolta(alternativa.href, volta)} className="mt-1 inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4">
            {tx("Abrir o painel:", "Open the panel:")} {alternativa.rotulo}
          </Link>
        )}
      </div>
    );
  if (prova.tipo === "texto") {
    const naturezas = Array.from(new Set(prova.partes.map((pt) => pt.natureza).filter((n): n is Natureza => !!n)));
    return (
      <figure data-prova="texto" className="border border-linha bg-superficie p-4 sm:p-5">
        <figcaption className="rotulo text-mineral">{tx("Número lido da base publicada", "Number read from the published database")}</figcaption>
        <p className="mt-2 leading-relaxed">
          {prova.partes.map((pt, i) => (
            <span key={i}>
              {pt.texto}
              {pt.natureza && (
                <span className="ml-1 align-middle">
                  <SeloNatureza natureza={pt.natureza} />
                </span>
              )}
            </span>
          ))}
        </p>
        <p className="mt-2 text-xs text-mineral">
          {tx(
            "Sem ficha Comprove própria neste exemplo: o número vem da base publicada do painel, que traz a fonte e a data de referência.",
            "No Check this number record of its own in this example: the number comes from the panel's published database, which carries the source and the reference date.",
          )}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-5">
          <Link href={comVolta(prova.href, volta)} className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4">
            {tx("Ver no painel", "See in the panel")}
          </Link>
        </div>
        <LegendaNatureza naturezas={naturezas} />
      </figure>
    );
  }
  const { evidencia: ev, painel, natureza, leitura, complemento } = prova.dado;
  const base = baseDoValor(ev);
  const conjunto = conjuntoLegivel(ev.fonte.conjunto);
  const fimRef = dataRef(ev.periodo.fim ?? ev.periodo.inicio);
  const idioma = idiomaEnergia();
  // a base do número em inglês só pela tabela exata; sem forma conferida, fica em português, marcada
  const baseEn = base ? rotuloFicha(base, idioma) : null;
  return (
    <figure data-prova="evidencia" className="border border-linha bg-superficie p-4 sm:p-5">
      <figcaption className="rotulo text-mineral">
        <RotuloFicha texto={ev.indicador} regiao="prova-indicador" idioma={idioma} />
      </figcaption>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-serif text-2xl leading-tight tabular-nums text-carvao">
          {valorExibidoNoIdioma(ev.valor_exibido, idioma)}
          {base && (
            <span className="ml-1.5 font-sans text-sm text-mineral">{baseEn ?? <TrechoPortugues regiao="prova-unidade">{base}</TrechoPortugues>}</span>
          )}
        </span>
        <SeloNatureza natureza={natureza} />
      </p>
      <p className="mt-1 text-xs text-mineral">
        {textoPeriodo(ev.periodo)} · <RotuloFicha texto={ev.entidade} regiao="prova-entidade" idioma={idioma} />
      </p>
      <p className="mt-1 text-xs text-mineral" data-fonte="true">
        {tx("Fonte:", "Source:")} {ev.fonte.orgao}, <Nome>{conjunto.texto}</Nome>.
        {fimRef ? tx(` Referência até ${fimRef}.`, ` Reference up to ${fimRef}.`) : ""}
        {ev.fonte.capturado_em ? tx(` Capturada em ${dataRef(diaBrasilia(ev.fonte.capturado_em))}.`, ` Captured on ${dataRef(diaBrasilia(ev.fonte.capturado_em))}.`) : ""}
        {conjunto.codigos.length > 0 && (
          <span data-nivel="analisar">
            {tx(" Código do conjunto na fonte:", " Dataset code at the source:")} <Nome>{conjunto.codigos.join(", ")}</Nome>.
          </span>
        )}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-carvao">{leitura}</p>
      {complemento && (
        <p className="mt-2 text-sm leading-relaxed text-carvao" data-complemento="true">
          {complemento}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-5">
        <Link href={comVolta(painel.href, volta)} className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4">
          {tx("Ver no painel:", "See in the panel:")} {painel.rotulo}
        </Link>
        <ComproveNumero evidencia={ev} endereco={painel.href} />
      </div>
      <LegendaNatureza naturezas={[natureza]} />
    </figure>
  );
}
