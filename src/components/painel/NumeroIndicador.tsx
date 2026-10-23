import Link from "@/components/i18n/LinkIdioma";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { num, pct, reais } from "@/lib/painel/formato";
import { tx } from "@/lib/painel/idioma";
import type { FormatoIndicador, NumeroProps, VariacaoIndicador } from "@/lib/painel/tipos";

type Idioma = "pt" | "en";

const TAMANHO: Record<"g" | "m" | "p", string> = {
  // a 390 px a faixa tem dois números por linha: o principal desce um degrau para caber sem cortar
  g: "numero-m sm:numero-g",
  m: "numero-p sm:numero-m",
  p: "numero-p",
};

/** Valor no padrão da página; a unidade monetária já escrita no valor sai da unidade ao lado ("R$ 41,23" e "/MWh"). */
export function valorIndicador(valor: number, formato: FormatoIndicador = "decimal", casas: number | undefined, idioma: Idioma): string {
  if (formato === "inteiro") return num(valor, 0, idioma);
  if (formato === "percentual") return pct(valor, casas ?? 1, idioma);
  if (formato === "reais") return reais(valor, casas ?? 2, idioma);
  return num(valor, casas ?? 1, idioma);
}

export function unidadeIndicador(unidade: string, formato: FormatoIndicador = "decimal"): string {
  const u = unidade.trim();
  if (formato === "reais") return u.replace(/^R\$\s*/, "");
  if (formato === "percentual") return u.replace(/^%\s*/, "");
  return u;
}

/**
 * Variação em palavras, com a direção decidida sobre o valor já arredondado (+0,004 com duas casas é "estável", não "alta de
 * 0,00"). O glifo é forma, não cor: alta e queda nunca são verde e vermelho, porque subir não é bom nem ruim por si.
 */
export function textoVariacao(v: VariacaoIndicador, unidade: string, casasNumero: number | undefined, idioma: Idioma): { glifo: string; texto: string } {
  const casas = v.casas ?? casasNumero ?? 1;
  const arred = Number(v.valor.toFixed(casas));
  const sufixo = v.unidade === "pp" ? tx(" p.p.", " pp", idioma) : v.unidade === "%" ? "%" : ` ${unidade}`;
  if (arred === 0) return { glifo: "=", texto: tx(`estável ${v.base}`, `unchanged ${v.base}`, idioma) };
  const valor = `${num(Math.abs(arred), casas, idioma)}${sufixo}`;
  return arred > 0
    ? { glifo: "▲", texto: tx(`alta de ${valor} ${v.base}`, `up ${valor} ${v.base}`, idioma) }
    : { glifo: "▼", texto: tx(`queda de ${valor} ${v.base}`, `down ${valor} ${v.base}`, idioma) };
}

/**
 * O número de indicador da plataforma, nos painéis (FaixaNumeros) e, pela mesma forma, nas entradas (NumeroEscala): rótulo, valor em
 * serifa com algarismos tabulares, unidade ao lado, a linha "recorte · período · natureza", a variação em palavras e a fonte. Fonte,
 * período e natureza são obrigatórios no tipo; valor ausente exige o motivo e aparece como "Indisponível nesta publicação", nunca
 * como zero. A prova do número (fonte · período) fica em `data-prova-numero`, que o teste do molde lê.
 *
 * Sem estado: renderiza no servidor. "Comprove este número" (`comprove`) é o gatilho da ficha de prova do domínio, ao lado do número.
 */
export function NumeroIndicador(props: NumeroProps & { idioma?: Idioma }) {
  const { rotulo, formato = "decimal", casas, unidade, periodo, recorte, fonte, natureza, variacao, nota, comprove, href, tamanho = "m", marcador, id } = props;
  const idioma = props.idioma ?? (tx("pt", "en") as Idioma);
  const ausente = props.valor === null;
  const valor = props.valorTexto ?? (typeof props.valor === "number" ? valorIndicador(props.valor, formato, casas, idioma) : null);
  const u = unidadeIndicador(unidade, formato);
  const vari = variacao ? textoVariacao(variacao, u || unidade, casas, idioma) : null;
  return (
    <div
      id={id}
      role="group"
      aria-label={rotulo}
      className="flex min-w-0 flex-col"
      data-numero-indicador=""
      data-natureza={natureza}
      data-ausente={ausente ? "" : undefined}
      data-prova-numero={`${fonte} · ${periodo}`}
    >
      <p className="t-meta flex items-start gap-2 text-carvao-muted">
        {marcador && <span aria-hidden="true" className="mt-[0.4em] inline-block h-2 w-2 shrink-0" style={{ background: marcador }} />}
        <span>{rotulo}</span>
      </p>
      {ausente ? (
        <>
          <p className="t-corpo mt-1.5 text-carvao">{tx("Indisponível nesta publicação", "Unavailable in this publication", idioma)}</p>
          <p className="t-meta mt-1 text-carvao-muted" data-motivo-ausencia="">
            {props.motivoAusencia}
          </p>
        </>
      ) : (
        <p className="mt-1.5 leading-none text-carvao">
          <span className={TAMANHO[tamanho]}>{valor}</span>
          {u && <span className="t-meta ml-1.5 text-carvao-muted">{u}</span>}
        </p>
      )}
      <p className="t-meta mt-2 flex flex-wrap items-center gap-x-2 text-carvao-muted">
        <span>{recorte ? `${recorte} · ${periodo}` : periodo}</span>
        <SeloNatureza natureza={natureza} texto idioma={idioma} />
      </p>
      {vari && (
        <p className="t-meta mt-1 tabular-nums text-carvao-muted" data-variacao="">
          <span aria-hidden="true" className="mr-1">
            {vari.glifo}
          </span>
          {vari.texto}
        </p>
      )}
      <p className="t-meta mt-1 text-mineral">
        {tx("Fonte: ", "Source: ", idioma)}
        {fonte}
      </p>
      {nota && <div className="t-meta mt-2 text-carvao-muted">{nota}</div>}
      {(comprove || href) && (
        <div className="mt-auto flex flex-wrap items-center gap-x-4 pt-1">
          {comprove}
          {href && (
            <Link href={href} prefetch={false} className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4">
              {tx("Ver no painel", "See in the panel", idioma)}
              <SeloComConta href={href} idioma={idioma} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
