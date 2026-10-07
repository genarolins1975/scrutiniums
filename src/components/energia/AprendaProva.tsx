import Link from "next/link";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { textoPeriodo } from "@/lib/energia/evidencia";
import type { Evidencia } from "@/lib/energia/evidencia";
import type { Prova } from "@/lib/energia/conteudo/provas";
import { comVolta } from "@/lib/energia/conteudo/trilhas";

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

/**
 * Número real que ilustra um verbete ou um passo de trilha. Com ficha publicada, mostra o
 * valor exatamente como o painel o exibe, o recorte, a natureza, a ficha de prova e o
 * link ao painel; sem ficha, o exemplo em texto com o selo de cada número. O link leva
 * ?volta= para o painel oferecer o caminho de volta a este contexto (RetornoContexto).
 * Renderiza no servidor; só a ficha de prova é cliente.
 */
export function AprendaProva({ prova, volta }: { prova: Prova | null; volta: string }) {
  if (!prova)
    return <p className="text-carvao-muted">Exemplo com dado integrado indisponível nesta publicação: a gold do módulo não trouxe o número.</p>;
  if (prova.tipo === "texto")
    return (
      <p data-prova="texto">
        {prova.partes.map((pt, i) => (
          <span key={i}>
            {pt.texto}
            {pt.natureza && (
              <span className="ml-1 align-middle">
                <SeloNatureza natureza={pt.natureza} />
              </span>
            )}
          </span>
        ))}{" "}
        <Link href={comVolta(prova.href, volta)} className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4">
          ver no painel
        </Link>
      </p>
    );
  const { evidencia: ev, painel, natureza, leitura, complemento } = prova.dado;
  const base = baseDoValor(ev);
  return (
    <figure data-prova="evidencia" className="border border-linha bg-superficie p-4 sm:p-5">
      <figcaption className="rotulo text-mineral">{ev.indicador}</figcaption>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-serif text-2xl leading-tight tabular-nums text-carvao">
          {ev.valor_exibido}
          {base && <span className="ml-1.5 font-sans text-sm text-mineral">{base}</span>}
        </span>
        <SeloNatureza natureza={natureza} />
      </p>
      <p className="mt-1 text-xs text-mineral">
        {textoPeriodo(ev.periodo)} · {ev.entidade}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-carvao">{leitura}</p>
      {complemento && (
        <p className="mt-2 text-sm leading-relaxed text-carvao" data-complemento="true">
          {complemento}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-5">
        <Link href={comVolta(painel.href, volta)} className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4">
          Ver no painel: {painel.rotulo}
        </Link>
        <ComproveNumero evidencia={ev} endereco={painel.href} />
      </div>
    </figure>
  );
}
