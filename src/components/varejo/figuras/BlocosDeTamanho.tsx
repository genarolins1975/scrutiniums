import Link from "next/link";
import { LogoEmpresa } from "@/components/varejo/LogoEmpresa";
import { num, pct, reaisDeMilhoes } from "@/lib/varejo/formato";
import { nomeCurtoDoGrupo, type BlocoDeTamanho, type SegmentoDeTamanho } from "@/lib/varejo/grupos";
import { corDoSegmento, HACHURA } from "./escala";
import { mosaico, type Caixa } from "./geometria";

/** "R$ 123,6 bi": o valor dentro do bloco, curto; por extenso ele está na lista do celular, na tabela e no rótulo acessível. */
const bi = (milhoes: number) => `R$ ${num(milhoes / 1000, 1)} bi`;

type Composicao = { largura: number; altura: number; faixa: number; pxPorUnidade: number };

/**
 * Duas composições do mesmo mosaico: a larga (a partir de 1024 px) e a de tablet. As medidas são unidades abstratas; `faixa` é a
 * altura reservada ao nome do segmento em cima de cada região e `pxPorUnidade` a menor escala em que a composição aparece, usada só
 * para decidir quanto texto cabe em cada bloco (nunca para posicionar: a posição é sempre percentual).
 */
const LARGA: Composicao = { largura: 1000, altura: 470, faixa: 27, pxPorUnidade: 0.93 };
const TABLET: Composicao = { largura: 1000, altura: 760, faixa: 42, pxPorUnidade: 0.6 };

function Bloco({ b, caixa, comp, cor, href, marcado }: Readonly<{ b: BlocoDeTamanho; caixa: Caixa; comp: Composicao; cor: string; href: string | null; marcado: boolean }>) {
  const w = caixa.w * comp.pxPorUnidade;
  const h = caixa.h * comp.pxPorUnidade;
  const estimado = b.natureza === "estimado_pela_fonte";
  // quanto cabe no bloco: completo (logo, nome, venda e parte), compacto (logo e uma linha) ou só a linha com nome e venda
  const borda = estimado ? 10 : 0;
  const comLogo = w - borda >= 104 && h - borda >= 96;
  const compacto = !comLogo && w - borda >= 100 && h - borda >= 62;
  const grande = w >= 190 && h >= 150;
  const rotulo = `${b.grupo}, ${num(b.posicao)}º no ranking: ${reaisDeMilhoes(b.vendas_milhoes)}${estimado ? ", estimado pela fonte" : ""}, ${pct(b.participacao)} da soma dos grupos listados`;
  const corpo = !comLogo ? (
    <span className={`flex h-full w-full flex-col overflow-hidden px-2 ${compacto ? "justify-between py-1.5" : "justify-center py-0.5"}`} style={{ background: cor }}>
      {compacto && <LogoEmpresa slug={b.slug} nome={b.grupo} tamanho="p" decorativo semLogo="placa" />}
      <span className="flex min-w-0 items-baseline justify-between gap-2 text-xs leading-tight text-carvao">
        <span className="truncate font-medium">{nomeCurtoDoGrupo(b.grupo)}</span>
        <span className="shrink-0 whitespace-nowrap tabular-nums">
          {bi(b.vendas_milhoes)}
          {estimado ? ", est." : ""}
        </span>
      </span>
    </span>
  ) : (
    <span className="flex h-full w-full flex-col justify-between overflow-hidden p-2" style={{ background: cor }}>
      <span className="block min-w-0">
        <LogoEmpresa slug={b.slug} nome={b.grupo} tamanho="p" decorativo semLogo="placa" />
        <span className="mt-1.5 block truncate text-sm font-medium leading-tight text-carvao">{b.grupo}</span>
      </span>
      <span className="block min-w-0 text-carvao">
        <span className={`block whitespace-nowrap tabular-nums leading-none ${grande ? "numero-m" : "numero-p"}`}>{bi(b.vendas_milhoes)}</span>
        <span className="mt-1 block truncate text-xs leading-tight">{estimado ? `estimado · ${pct(b.participacao)}` : `${pct(b.participacao)} da amostra`}</span>
      </span>
    </span>
  );
  // a estimativa da fonte leva uma moldura hachurada em volta do bloco, além da palavra "estimado": o miolo segue liso, para o texto ler bem
  const classe = `absolute block overflow-hidden ${estimado ? "p-[5px]" : ""} ${marcado ? "z-10 outline outline-[3px] outline-carvao" : ""}`;
  const estilo = { left: `${(100 * caixa.x) / comp.largura}%`, top: `${(100 * caixa.y) / comp.altura}%`, width: `${(100 * caixa.w) / comp.largura}%`, height: `${(100 * caixa.h) / comp.altura}%`, background: cor, ...(estimado ? { backgroundImage: HACHURA } : {}) };
  return href ? (
    <Link href={href} prefetch={false} aria-label={`${rotulo}. Abrir a ficha.`} data-bloco-grupo={b.slug} data-estimado={estimado ? "" : undefined} className={`${classe} transition-transform duration-150 ease-out motion-safe:active:scale-[0.985] [@media(hover:hover)]:hover:z-10 [@media(hover:hover)]:hover:outline [@media(hover:hover)]:hover:outline-2 [@media(hover:hover)]:hover:outline-carvao`} style={estilo}>
      {corpo}
    </Link>
  ) : (
    <span role="img" aria-label={rotulo} data-bloco-grupo={b.slug} data-estimado={estimado ? "" : undefined} className={classe} style={estilo}>
      {corpo}
    </span>
  );
}

function Mosaico({ segmentos, comp, href, marcados, segmentoAtivo, className }: Readonly<{ segmentos: readonly SegmentoDeTamanho[]; comp: Composicao; href: (slug: string) => string | null; marcados: ReadonlySet<string>; segmentoAtivo: string | null; className: string }>) {
  const vao = 5;
  const regioes = mosaico(segmentos.map((s) => ({ ...s, valor: s.vendas_milhoes })), { x: 0, y: 0, w: comp.largura, h: comp.altura });
  return (
    <div className={`relative w-full ${className}`} style={{ aspectRatio: `${comp.largura} / ${comp.altura}` }}>
      {regioes.map((r) => {
        const cor = corDoSegmento(r.segmento);
        const dentro: Caixa = { x: r.x + vao / 2, y: r.y + comp.faixa, w: r.w - vao, h: r.h - comp.faixa - vao / 2 };
        const blocos = mosaico(r.blocos.map((b) => ({ ...b, valor: b.vendas_milhoes })), dentro);
        const larguraPx = r.w * comp.pxPorUnidade;
        const ativo = segmentoAtivo === r.segmento;
        return (
          <div key={r.segmento} data-regiao-segmento={r.segmento}>
            <p
              className={`absolute flex items-end gap-x-2 overflow-hidden whitespace-nowrap pb-1 text-xs leading-none text-carvao ${ativo ? "font-semibold" : "font-medium"}`}
              style={{ left: `${(100 * (r.x + vao / 2)) / comp.largura}%`, top: `${(100 * r.y) / comp.altura}%`, width: `${(100 * (r.w - vao)) / comp.largura}%`, height: `${(100 * comp.faixa) / comp.altura}%` }}
            >
              <span aria-hidden="true" className="mb-px h-2.5 w-2.5 shrink-0" style={{ background: cor, boxShadow: "inset 0 0 0 1px var(--cor-carvao-muted)" }} />
              <span className="truncate">{r.nome}</span>
              {larguraPx >= 210 && <span className="shrink-0 font-normal tabular-nums text-carvao-muted">{pct(r.participacao)} da amostra</span>}
            </p>
            {blocos.map((b) => {
              // 1 unidade de respiro entre blocos vizinhos, tirada de dentro de cada um
              const caixa: Caixa = { x: b.x + 1, y: b.y + 1, w: Math.max(0, b.w - 2), h: Math.max(0, b.h - 2) };
              return <Bloco key={b.slug} b={b} caixa={caixa} comp={comp} cor={cor} href={b.tem_ficha ? href(b.slug) : null} marcado={marcados.has(b.slug)} />;
            })}
          </div>
        );
      })}
    </div>
  );
}

/**
 * "O tamanho de cada grupo": um mosaico em que a área de cada bloco é a venda do grupo, reunidos e coloridos por segmento, com o
 * nome do segmento escrito sobre a região dele. Cada bloco traz o logo (ou a placa com o nome), a venda e a parte na soma dos grupos
 * listados; a estimativa da fonte leva moldura hachurada e a palavra "estimado". Clicar abre a ficha. O que a figura torna possível
 * e a barra não tornava: ver de relance quanto do total cabe a cada segmento e quantos grupos são precisos para igualar o primeiro.
 *
 * No celular o mosaico vira lista: uma barra por grupo, na mesma escala, sob o título do segmento. Tudo no servidor; os valores
 * chegam de `tamanhosPorSegmento` (src/lib/varejo/grupos.ts) e o denominador é sempre a soma dos grupos listados.
 */
export function BlocosDeTamanho({ segmentos, href, marcados = [], segmentoAtivo = null, titulo }: Readonly<{
  segmentos: readonly SegmentoDeTamanho[];
  href: (slug: string) => string | null;
  /** Grupos a contornar (os achados da busca). */
  marcados?: readonly string[];
  segmentoAtivo?: string | null;
  /** Nome acessível da figura. */
  titulo: string;
}>) {
  const marca = new Set(marcados);
  const maior = Math.max(0, ...segmentos.flatMap((s) => s.blocos.map((b) => b.vendas_milhoes)));
  if (!(maior > 0)) return <p className="t-meta italic text-mineral" data-grafico="blocos-de-tamanho">A fonte não publicou a venda de nenhum grupo desta lista.</p>;
  return (
    <div data-grafico="blocos-de-tamanho" data-figura-varejo="blocos-de-tamanho" className="min-w-0">
      <div role="group" aria-label={titulo}>
        <Mosaico segmentos={segmentos} comp={LARGA} href={href} marcados={marca} segmentoAtivo={segmentoAtivo} className="hidden lg:block" />
        <Mosaico segmentos={segmentos} comp={TABLET} href={href} marcados={marca} segmentoAtivo={segmentoAtivo} className="hidden sm:block lg:hidden" />
        {/* celular: a mesma leitura em lista, com a barra de cada grupo na escala do maior */}
        <div className="sm:hidden" data-blocos-em-lista="">
          {segmentos.map((s) => (
            <section key={s.segmento} className="mt-5 first:mt-0">
              <h3 className="flex items-baseline justify-between gap-3 border-b border-carvao pb-1 text-sm font-medium text-carvao">
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-3 w-3 shrink-0" style={{ background: corDoSegmento(s.segmento), boxShadow: "inset 0 0 0 1px var(--cor-carvao-muted)" }} />
                  {s.nome}
                </span>
                <span className="text-xs font-normal tabular-nums text-carvao-muted">{pct(s.participacao)} da amostra</span>
              </h3>
              <ul>
                {s.blocos.map((b) => {
                  const estimado = b.natureza === "estimado_pela_fonte";
                  const destino = b.tem_ficha ? href(b.slug) : null;
                  const linha = (
                    <span className="grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-x-3">
                      <LogoEmpresa slug={b.slug} nome={b.grupo} tamanho="p" decorativo semLogo="placa" />
                      <span className="min-w-0 text-sm leading-snug text-carvao">
                        <span className={`block truncate ${destino ? "underline decoration-linha underline-offset-4" : ""}`}>{nomeCurtoDoGrupo(b.grupo)}</span>
                        <span aria-hidden="true" className="mt-1 block h-2 w-full">
                          <span className="block h-full min-w-[2px]" style={{ width: `${(100 * b.vendas_milhoes) / maior}%`, background: "var(--cor-gas)", ...(estimado ? { backgroundImage: HACHURA } : {}) }} />
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-sm tabular-nums leading-snug text-carvao">
                        {bi(b.vendas_milhoes)}
                        <span className="block text-xs text-carvao-muted">{estimado ? `estimado · ${pct(b.participacao)}` : pct(b.participacao)}</span>
                      </span>
                    </span>
                  );
                  return (
                    <li key={b.slug} className={`border-b border-linha ${marca.has(b.slug) ? "bg-marfim" : ""}`}>
                      {destino ? (
                        <Link href={destino} prefetch={false} className="block py-2 motion-safe:active:scale-[0.99]">
                          {linha}
                        </Link>
                      ) : (
                        <span className="block py-2">{linha}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <ul className="t-meta mt-3 flex flex-wrap gap-x-6 gap-y-1 text-carvao-muted" aria-label="Como ler">
        <li className="hidden sm:block">Área de cada bloco: venda do grupo. Toque num bloco para abrir a ficha.</li>
        <li className="sm:hidden">Barra de cada grupo: a venda, na escala do maior. Toque para abrir a ficha.</li>
        {segmentos.some((s) => s.blocos.some((b) => b.natureza === "estimado_pela_fonte")) && (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-5 shrink-0 bg-mineral" style={{ backgroundImage: HACHURA }} />
            hachura: venda estimada pela fonte
          </li>
        )}
      </ul>
    </div>
  );
}
