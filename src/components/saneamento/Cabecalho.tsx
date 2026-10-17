import Link from "next/link";
import { NavegacaoObservatorios } from "@/components/observatorios/NavegacaoObservatorios";
import { LogoMark } from "@/components/ui/Logo";
import { SwitcherObservatorio } from "@/components/layout/SwitcherObservatorio";
import { DetalhesFechaveis } from "@/components/layout/DetalhesFechaveis";
import { AcessoConta } from "@/components/energia/AcessoConta";
import { EIXOS, ROTA, ROTULO_SITUACAO, rotaCapitulo, type Capitulo } from "@/lib/saneamento/capitulos";

/**
 * Cabeçalho do Observatório Brasileiro do Saneamento: marca, seletor de
 * observatório, abas da plataforma, atalhos (Meu município, Método) e a
 * navegação pelos cinco eixos. Cada eixo abre a lista dos capítulos com a
 * situação de cada um; capítulo em preparação não vira link.
 *
 * `atual` é o slug da página (ex.: "acesso", "preco-regulado/simulador").
 */
export function Cabecalho({ atual }: { atual: string }) {
  const eixoAtual = EIXOS.find((e) => e.capitulos.some((c) => atual === c.slug || atual.startsWith(c.slug + "/")));
  return (
    <header className="border-b border-linha bg-superficie">
      <div className="ed-pagina flex flex-wrap items-center justify-between gap-x-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="Scrutiniums: página inicial" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2.5 sm:justify-start">
            <LogoMark size={20} />
            <span className="hidden font-serif text-base uppercase tracking-wide2 text-carvao sm:inline">Scrutiniums</span>
          </Link>
          <span aria-hidden="true" className="h-5 w-px bg-linha" />
          <SwitcherObservatorio atual="saneamento" />
        </div>
        <NavegacaoObservatorios atual="saneamento" />
        <div className="flex items-center gap-4 sm:gap-5">
          <Link
            href={`${ROTA}/municipio`}
            aria-current={atual === "municipio" ? "page" : undefined}
            className="rotulo hidden min-h-[44px] items-center text-carvao-muted hover:text-obee-dark md:inline-flex"
          >
            Meu município
          </Link>
          <Link
            href={`${ROTA}/internacional`}
            aria-current={atual === "internacional" ? "page" : undefined}
            className="rotulo hidden min-h-[44px] items-center text-carvao-muted hover:text-obee-dark md:inline-flex"
          >
            Brasil no mundo
          </Link>
          <Link
            href={`${ROTA}/metodologia`}
            aria-current={atual === "metodologia" ? "page" : undefined}
            className="rotulo hidden min-h-[44px] items-center text-carvao-muted hover:text-obee-dark md:inline-flex"
          >
            Método e fontes
          </Link>
          <AcessoConta destino={ROTA} />
        </div>
      </div>
      <nav aria-label="Navegação do Observatório do Saneamento" className="border-t border-linha">
        <div className="ed-pagina relative">
          <ul className="hidden flex-wrap gap-x-1 lg:flex">
            <li>
              <Link
                href={ROTA}
                aria-current={atual === "" ? "page" : undefined}
                className={`flex min-h-[44px] items-center border-b-2 px-3 text-sm ${atual === "" ? "border-obee text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}
              >
                Início
              </Link>
            </li>
            {EIXOS.map((e, i) => (
              <li key={e.id}>
                <DetalhesFechaveis className="group relative">
                  <summary
                    className={`flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm [&::-webkit-details-marker]:hidden ${
                      eixoAtual?.id === e.id ? "border-obee text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"
                    }`}
                  >
                    <span className="font-label text-xs text-mineral">{e.id}</span> {e.curto}
                    {eixoAtual?.id === e.id && <span className="sr-only"> (eixo da página atual)</span>}
                    <span aria-hidden="true" className="text-xs motion-safe:transition-transform group-open:rotate-180">
                      ▾
                    </span>
                  </summary>
                  <div
                    className={`absolute top-full z-40 mt-px hidden w-[26rem] border border-linha bg-superficie p-2 shadow-[0_8px_24px_rgba(26,29,33,0.12)] group-open:block ${
                      i >= EIXOS.length - 2 ? "right-0" : "left-0"
                    }`}
                  >
                    <p className="px-3 pb-2 pt-1 text-sm leading-snug text-carvao-muted">{e.resumo}</p>
                    <ul aria-label={e.rotulo}>
                      {e.capitulos.map((c) => (
                        <li key={c.numero}>
                          <ItemCapitulo c={c} atual={atual} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </DetalhesFechaveis>
              </li>
            ))}
            <li>
              <Link
                href={`${ROTA}/comparar`}
                aria-current={atual === "comparar" ? "page" : undefined}
                className={`flex min-h-[44px] items-center border-b-2 px-3 text-sm ${atual === "comparar" ? "border-obee text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}
              >
                Comparar
              </Link>
            </li>
          </ul>
          <div className="flex min-h-[44px] items-center gap-3 lg:hidden">
            <DetalhesFechaveis className="group shrink-0">
              <summary className="flex min-h-[44px] min-w-[44px] cursor-pointer list-none items-center gap-1.5 whitespace-nowrap pr-1 text-sm font-medium text-carvao hover:text-obee-dark [&::-webkit-details-marker]:hidden">
                Menu
                <span aria-hidden="true" className="text-xs motion-safe:transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <div className="absolute inset-x-0 top-full z-40 mt-px hidden max-h-[75vh] overflow-y-auto border border-linha bg-superficie p-2 shadow-[0_8px_24px_rgba(26,29,33,0.12)] group-open:block">
                <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                  <li><Link href={ROTA} className="flex min-h-[44px] items-center px-3 text-sm text-carvao hover:bg-obee-fundo">Início</Link></li>
                  <li><Link href={`${ROTA}/municipio`} className="flex min-h-[44px] items-center px-3 text-sm text-carvao hover:bg-obee-fundo">Meu município</Link></li>
                  <li><Link href={`${ROTA}/comparar`} className="flex min-h-[44px] items-center px-3 text-sm text-carvao hover:bg-obee-fundo">Comparar municípios</Link></li>
                  <li><Link href={`${ROTA}/internacional`} className="flex min-h-[44px] items-center px-3 text-sm text-carvao hover:bg-obee-fundo">Brasil no mundo</Link></li>
                  <li><Link href={`${ROTA}/metodologia`} className="flex min-h-[44px] items-center px-3 text-sm text-carvao hover:bg-obee-fundo">Método e fontes</Link></li>
                </ul>
                <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                  {EIXOS.map((e) => (
                    <div key={e.id} className="pb-2">
                      <p id={`menu-san-${e.id}`} className="rotulo px-3 pb-1 pt-3 text-mineral">
                        {e.id} · {e.rotulo}
                      </p>
                      <ul aria-labelledby={`menu-san-${e.id}`}>
                        {e.capitulos.map((c) => (
                          <li key={c.numero}>
                            <ItemCapitulo c={c} atual={atual} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </DetalhesFechaveis>
            {eixoAtual && (
              <p className="min-w-0 text-sm leading-tight text-carvao-muted">
                <span className="sr-only">Você está em: </span>
                {eixoAtual.rotulo}
              </p>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}

function ItemCapitulo({ c, atual }: { c: Capitulo; atual: string }) {
  const ativo = atual === c.slug || atual.startsWith(c.slug + "/");
  if (c.situacao === "em_preparacao") {
    return (
      <span className="flex min-h-[44px] items-baseline gap-2 px-3 py-2 text-sm text-carvao-muted">
        <span className="tabular-nums text-mineral">{c.numero}</span>
        <span>
          {c.rotulo} <span className="text-xs">· {ROTULO_SITUACAO[c.situacao].toLowerCase()}</span>
        </span>
      </span>
    );
  }
  return (
    <Link
      href={rotaCapitulo(c)}
      aria-current={atual === c.slug ? "page" : undefined}
      className={`flex min-h-[44px] items-baseline gap-2 px-3 py-2 text-sm hover:bg-obee-fundo ${ativo ? "font-medium text-carvao" : "text-carvao"}`}
    >
      <span className="tabular-nums text-mineral">{c.numero}</span>
      <span>
        {c.rotulo}
        {c.situacao === "parcial" && <span className="text-xs text-carvao-muted"> · cobertura parcial</span>}
      </span>
    </Link>
  );
}
