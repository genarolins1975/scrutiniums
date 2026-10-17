import Link from "next/link";
import { ListadasLogo } from "@/components/energia/ListadasLogo";
import { ROTULO_SEGMENTO, type CartaoListada, type EloCadeia } from "@/lib/energia/empresas-entrada";
import { num } from "@/lib/energia/formato";
import { logoDe, ROTA_LISTADAS } from "@/lib/energia/listadas";
import type { ManifestoLogos } from "@/lib/energia/tipos-listadas";

/**
 * Peças da abertura de Empresas: a vitrine das companhias listadas (a entrada mais procurada, à vista logo depois dos números) e o mapa
 * da cadeia do setor (o que cada elo faz, como é remunerado e quantos agentes declaram atuar nele). Servidor, sem JavaScript de cliente.
 */

const link = "text-energia-dark underline underline-offset-4 hover:text-carvao";

/** Cartões das companhias da carteira do IEE: logo, nome, papel, peso no índice e o que controla em cada segmento. */
export function VitrineListadas({ cartoes, logos, dataCarteira }: { cartoes: CartaoListada[]; logos: ManifestoLogos | null; dataCarteira: string }) {
  return (
    <section id="listadas" aria-labelledby="listadas-titulo" data-vitrine-listadas="" className="scroll-mt-28 border-t border-linha pt-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="max-w-2xl">
          <p className="rotulo text-mineral">Companhias listadas na bolsa</p>
          <h2 id="listadas-titulo" className="ed-h2 mt-1 font-serif text-carvao">
            As {cartoes.length} companhias do Índice de Energia Elétrica
          </h2>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-carvao-muted">
            Carteira do IEE da B3 de {dataCarteira}, na ordem do peso no índice. Cada ficha reúne ativos, controle, demonstrações, desempenho das ações e fatos
            relevantes.
          </p>
        </div>
        <Link href={ROTA_LISTADAS} className="inline-flex min-h-[44px] items-center gap-1.5 border border-energia-dark px-4 text-sm font-medium text-energia-dark hover:bg-energia-fundo">
          Comparar as {cartoes.length} lado a lado <span aria-hidden="true">→</span>
        </Link>
      </div>
      <ul className="mt-6 grid grid-cols-1 gap-px overflow-hidden border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cartoes.map((c) => {
          const logo = logoDe(logos, c.papel);
          return (
            <li key={c.papel} className="bg-superficie">
              <Link
                href={c.href}
                className="group flex h-full min-h-[148px] flex-col gap-3 p-4 outline-offset-[-3px] hover:bg-energia-fundo focus-visible:bg-energia-fundo"
                aria-label={`${c.nome}, ${c.papel}: abrir a ficha`}
              >
                <div className="flex items-center justify-between gap-3">
                  <ListadasLogo logo={logo} nome={c.nome} tamanho="md" decorativo={!!logo?.arquivo} />
                  <span className="text-right text-xs tabular-nums text-mineral">
                    {c.papel}
                    <br />
                    {num(c.peso, 1)}% do IEE
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-carvao group-hover:underline group-hover:underline-offset-4">{c.nome}</p>
                  <ul className="mt-1.5 space-y-0.5 text-sm text-carvao-muted">
                    {c.medidas.length ? (
                      c.medidas.map((m) => (
                        <li key={m.segmento} className="flex justify-between gap-3">
                          <span>{ROTULO_SEGMENTO[m.segmento]}</span>
                          <span className="tabular-nums text-carvao">{m.texto}</span>
                        </li>
                      ))
                    ) : (
                      <li>Sem ativo de geração, transmissão ou distribuição sob controle no cadastro</li>
                    )}
                  </ul>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 max-w-3xl text-xs leading-relaxed text-carvao-muted">
        Geração em MW sob controle (SIGA), transmissão em km de circuito em operação (SIGET) e distribuição em unidades consumidoras, cada uma na sua unidade: os
        segmentos não se somam. Ativos de sociedades com controle compartilhado não entram. Símbolos são os arquivos oficiais publicados por cada companhia.
      </p>
    </section>
  );
}

/**
 * Mapa da cadeia: geração, transmissão e distribuição na ordem do fluxo físico da energia, com a seta só entre elos físicos, e a
 * comercialização numa faixa à parte, porque negocia contratos e não opera ativo. Cada elo diz o que faz, como é remunerado, quantos
 * agentes declaram o ramo e leva ao painel que o detalha.
 */
export function MapaCadeia({ elos, dataAgentes }: { elos: EloCadeia[]; dataAgentes: string }) {
  const fisicos = elos.filter((e) => e.id !== "comercializacao");
  const comercio = elos.find((e) => e.id === "comercializacao");
  return (
    <section id="cadeia" aria-labelledby="cadeia-titulo" data-mapa-cadeia="" className="scroll-mt-28 border-t border-linha pt-8 pb-10">
      <p className="rotulo text-mineral">Como o setor se organiza</p>
      <h2 id="cadeia-titulo" className="ed-h2 mt-1 font-serif text-carvao">
        Da usina à tomada: quem faz cada parte
      </h2>
      <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-carvao-muted">
        A energia percorre três elos físicos, cada um com regras e remuneração próprias. Uma mesma empresa pode atuar em mais de um.
      </p>
      <figure className="mt-6">
        <ol className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
          {fisicos.map((e, i) => (
            <li key={e.id} className="contents">
              {i > 0 && (
                <span aria-hidden="true" className="flex items-center justify-center text-energia md:flex-col">
                  <span className="text-xs uppercase tracking-wider text-mineral md:mb-1">energia</span>
                  <span className="ml-2 text-2xl leading-none md:ml-0">
                    <span className="md:hidden">↓</span>
                    <span className="hidden md:inline">→</span>
                  </span>
                </span>
              )}
              <Elo e={e} dataAgentes={dataAgentes} />
            </li>
          ))}
        </ol>
        {comercio && (
          <div className="mt-3 grid gap-3 border border-dashed border-linha bg-papel p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-center">
            <div>
              <p className="rotulo text-mineral">Fora do fluxo físico</p>
              <p className="ed-h3 mt-1 font-serif text-carvao">{comercio.titulo}</p>
            </div>
            <div className="text-sm leading-relaxed text-carvao-muted">
              <p>
                {comercio.faz} {comercio.remuneracao}
              </p>
              <p className="mt-1">
                {comercio.agentes !== null && (
                  <>
                    <span className="tabular-nums text-carvao">{num(comercio.agentes, 0)}</span> agentes declaram o ramo ·{" "}
                  </>
                )}
                <Link href={comercio.href} className={link}>
                  {comercio.link}
                </Link>
              </p>
            </div>
          </div>
        )}
        <figcaption className="mt-3 max-w-3xl text-xs leading-relaxed text-carvao-muted">
          Agentes ativos por ramo declarado no Cadastro Institucional de Agentes da ANEEL de {dataAgentes}; um agente pode declarar mais de um ramo, então as contagens não
          se somam. Potência fiscalizada do SIGA (capacidade instalada, não energia gerada), circuitos do SIGET e unidades consumidoras da base de continuidade da ANEEL.
        </figcaption>
      </figure>
    </section>
  );
}

function Elo({ e, dataAgentes }: { e: EloCadeia; dataAgentes: string }) {
  return (
    <div className="flex flex-col border-t-[3px] border-energia bg-superficie p-4 shadow-[inset_0_0_0_1px_theme(colors.linha)]">
      <p className="ed-h3 font-serif text-carvao">{e.titulo}</p>
      <p className="mt-2 text-sm leading-relaxed text-carvao">{e.faz}</p>
      <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{e.remuneracao}</p>
      <dl className="mt-3 space-y-1 border-t border-linha pt-3 text-sm">
        {e.agentes !== null && (
          <div className="flex justify-between gap-3">
            <dt className="text-carvao-muted">Agentes com o ramo</dt>
            <dd className="tabular-nums text-carvao" title={`Cadastro de ${dataAgentes}`}>
              {num(e.agentes, 0)}
            </dd>
          </div>
        )}
        <div>
          <dt className="sr-only">Escala</dt>
          <dd className="text-carvao">{e.medida}</dd>
        </div>
      </dl>
      <Link href={e.href} className={`mt-auto inline-flex min-h-[44px] items-center pt-2 text-sm ${link}`}>
        {e.link}
        <span aria-hidden="true" className="ml-1.5">
          →
        </span>
      </Link>
    </div>
  );
}
