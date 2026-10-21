import Link from "next/link";
import type { DominioId } from "@/lib/dominios";
import { DetalhesFechaveis } from "@/components/layout/DetalhesFechaveis";
import { Nome } from "@/components/i18n/Nome";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { hrefNoIdioma } from "@/lib/i18n-href";
import { OBSERVATORIOS, destinoObservatorio } from "@/lib/observatorios/lista";
import { colecaoDoDominio, contextoAtual, type ContextoRota } from "@/lib/observatorios/contexto";

/**
 * Seletor discreto da coleção corrente ("Setor Elétrico ▾"), com as 28 coleções do registro agrupadas pelos seis
 * observatórios (src/lib/observatorios/lista.ts). A coleção atual é a dona do endereço (donoDaRota, via contextoAtual),
 * a mesma que o rótulo acima do H1 (RotuloContexto) e a trilha (Trilha) mostram; `atual` só vale quando o endereço não
 * está no registro. <details> nativo: funciona sem JavaScript e abre por teclado e toque; com JavaScript, fecha com Esc,
 * com clique fora e quando o foco sai do menu. Troca de observatório sem novo login: a sessão e as preferências são da
 * plataforma.
 */
export function SwitcherObservatorio({
  atual = null,
  contexto,
  onDark = false,
}: {
  atual?: DominioId | null;
  /** Contexto já resolvido (testes); sem ele, o do endereço em renderização. */
  contexto?: ContextoRota | null;
  onDark?: boolean;
}) {
  // idioma pelo endereço (vale em qualquer observatório); nomes de observatório e coleção são nomes próprios e ficam em português, marcados
  const idioma = idiomaEnergia();
  const ctx = contexto !== undefined ? contexto : contextoAtual();
  const doDominio = !ctx && atual ? colecaoDoDominio(atual) : null;
  const colecaoAtual = ctx?.colecao ?? doDominio?.colecao ?? null;
  const observatorioAtual = ctx?.observatorio ?? doDominio?.observatorio ?? null;
  const rotulo = colecaoAtual?.nome ?? observatorioAtual?.nomeCurto ?? null;
  const cor = onDark ? "text-marfim" : "text-carvao";
  const item = "flex min-h-[36px] items-center px-3 py-1.5 [@media(pointer:coarse)]:min-h-[44px]";
  return (
    <DetalhesFechaveis className="group relative">
      <summary
        className={`rotulo flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 ${cor} hover:text-energia-dark [&::-webkit-details-marker]:hidden`}
        aria-label={
          colecaoAtual
            ? tx(`Coleção atual: ${colecaoAtual.nome}. Trocar de coleção ou de observatório`, `Current collection: ${colecaoAtual.nome}. Switch collection or observatory`, idioma)
            : observatorioAtual
              ? tx(`Observatório atual: ${observatorioAtual.nome}. Trocar de coleção ou de observatório`, `Current observatory: ${observatorioAtual.nome}. Switch collection or observatory`, idioma)
              : tx("Trocar de observatório", "Switch observatory", idioma)
        }
      >
        {/* nome longo ("Dívida e crédito das famílias") não empurra a conta para fora da linha da marca no celular */}
        <span className="max-w-[11rem] truncate sm:max-w-[16rem]">{rotulo ? <Nome>{rotulo}</Nome> : tx("Observatórios", "Observatories", idioma)}</span>
        <span aria-hidden="true" className="text-[0.7em] transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      {/* no celular o menu ocupa a largura útil (fixo, 1rem de margem) para não sair da tela; no desktop, duas colunas */}
      <div className="fixed inset-x-4 z-40 mt-1 hidden max-h-[80vh] overflow-y-auto border border-linha bg-superficie p-2 shadow-[0_8px_24px_rgba(26,29,33,0.12)] group-open:block sm:absolute sm:inset-x-auto sm:left-0 sm:w-[34rem]">
        <div className="sm:columns-2 sm:gap-2">
          {OBSERVATORIOS.map((o) => (
            <div key={o.id} className="break-inside-avoid border-b border-linha pb-1 last:border-b-0 sm:border-b-0">
              <Link
                href={destinoObservatorio(o)}
                prefetch={false}
                aria-current={!colecaoAtual && observatorioAtual?.id === o.id ? "true" : undefined}
                className={`rotulo ${item} text-mineral hover:text-carvao aria-[current=true]:text-carvao`}
              >
                <Nome>{o.nomeCurto}</Nome>
              </Link>
              <ul>
                {o.colecoes.map((c) => {
                  const eAtual = colecaoAtual?.id === c.id && observatorioAtual?.id === o.id;
                  return (
                    <li key={c.id}>
                      <Link
                        href={hrefNoIdioma(c.href, idioma)}
                        prefetch={false}
                        aria-current={eAtual ? "true" : undefined}
                        className={`${item} text-sm text-carvao hover:bg-papel aria-[current=true]:bg-papel aria-[current=true]:font-semibold`}
                      >
                        <Nome>{c.nome}</Nome>
                        {eAtual && <span className="sr-only">{tx(" (atual)", " (current)", idioma)}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <Link href="/app/observatorios" className={`rotulo mt-1 ${item} border-t border-linha text-mineral hover:text-carvao`}>
          {tx("Escolher na minha conta →", "Choose in my account →", idioma)}
        </Link>
      </div>
    </DetalhesFechaveis>
  );
}
