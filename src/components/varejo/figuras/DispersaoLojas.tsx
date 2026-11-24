import Link from "next/link";
import { num, reaisDeMilhoes } from "@/lib/varejo/formato";
import { nomeCurtoDoGrupo, nomeDoSegmento, type ModeloDeLoja } from "@/lib/varejo/grupos";
import { corDoSegmento, HACHURA } from "./escala";
import { logaritmica } from "./geometria";

type Ponto = ModeloDeLoja & { vendas_milhoes: number; lojas: number; venda_por_loja_milhoes: number };

/** Marcas "redondas" de uma escala logarítmica dentro do domínio: 1, 2 e 5 de cada década. */
function marcasLog(min: number, max: number): number[] {
  const saida: number[] = [];
  for (let d = Math.floor(Math.log10(min)); d <= Math.ceil(Math.log10(max)); d++) for (const f of [1, 2, 5]) if (f * 10 ** d >= min && f * 10 ** d <= max) saida.push(f * 10 ** d);
  return saida;
}

/** Domínio alargado até a marca redonda (1, 2, 5) abaixo do menor e acima do maior valor. */
function dominioLog(valores: number[]): [number, number] {
  const passos = (v: number, cima: boolean) => {
    const d = 10 ** Math.floor(Math.log10(v));
    const opcoes = [1, 2, 5, 10].map((f) => f * d);
    return cima ? opcoes.find((o) => o >= v * 1.08) ?? 10 * d : [...opcoes].reverse().find((o) => o <= v / 1.08) ?? d / 2;
  };
  return [passos(Math.min(...valores), false), passos(Math.max(...valores), true)];
}

/**
 * "Poucas lojas enormes ou muitas lojas pequenas?": cada grupo é um ponto, com o número de lojas na horizontal e a venda na
 * vertical. As duas réguas são logarítmicas (cada marca multiplica a anterior, dito na legenda), porque a lista vai de cem a quatro
 * mil lojas; nessa escala, as diagonais tracejadas são linhas de mesma venda por loja, e é a distância até elas que separa os
 * modelos de negócio: o atacarejo fica perto da diagonal de cima, as farmácias perto da de baixo. Ponto vazado é venda estimada pela
 * fonte. Rótulo direto em cada ponto; a cor é a do segmento. Grupo sem número de lojas na fonte fica fora do desenho e é listado.
 *
 * No celular os rótulos não caberiam: a figura vira a lista ordenada pela venda por loja, com a barra a partir do zero.
 */
export function DispersaoLojas({ modelos, href, titulo, ano }: Readonly<{ modelos: readonly ModeloDeLoja[]; href: (slug: string) => string | null; titulo: string; ano: string }>) {
  const pontos = modelos.filter((m): m is Ponto => m.vendas_milhoes !== null && m.lojas !== null && m.venda_por_loja_milhoes !== null);
  const fora = modelos.filter((m) => !pontos.includes(m as Ponto));
  if (pontos.length === 0) return <p className="t-meta italic text-mineral" data-grafico="dispersao-lojas">A fonte não publicou o número de lojas dos grupos desta lista.</p>;
  const L = 1000;
  const A = 560;
  const dx = dominioLog(pontos.map((p) => p.lojas));
  const dy = dominioLog(pontos.map((p) => p.vendas_milhoes / 1000));
  const x = logaritmica(dx, [0, L]);
  const y = logaritmica(dy, [A, 0]);
  const mx = marcasLog(dx[0], dx[1]);
  const my = marcasLog(dy[0], dy[1]);
  // diagonais de mesma venda por loja (R$ milhões por loja): as potências de dez e os seus triplos que cruzam o quadro
  const diagonais = [3, 10, 30, 100, 300].filter((k) => (k * dx[0]) / 1000 < dy[1] && (k * dx[1]) / 1000 > dy[0]);
  const diagonal = (k: number) => {
    // vendas (R$ bi) = k × lojas ÷ 1000, cortada no quadro
    const l0 = Math.max(dx[0], (dy[0] * 1000) / k);
    const l1 = Math.min(dx[1], (dy[1] * 1000) / k);
    return { x0: x(l0), y0: y((k * l0) / 1000), x1: x(l1), y1: y((k * l1) / 1000) };
  };
  // rótulo de cada ponto: à direita, à esquerda, acima ou abaixo, o primeiro lugar que não cobre ponto nem rótulo já posto (medidas
  // aproximadas, em unidades do quadro; a ordem é do maior grupo para o menor, para os maiores ficarem com o melhor lugar)
  const ocupados: { x0: number; y0: number; x1: number; y1: number }[] = pontos.map((p) => ({ x0: x(p.lojas) - 9, y0: y(p.vendas_milhoes / 1000) - 9, x1: x(p.lojas) + 9, y1: y(p.vendas_milhoes / 1000) + 9 }));
  // os rótulos das diagonais (na ponta de cima de cada uma) já têm lugar: nenhum nome de grupo cai sobre eles
  for (const k of diagonais) {
    const d = diagonal(k);
    if (d.y1 <= 1) ocupados.push({ x0: d.x1 - 65, y0: 0, x1: d.x1 + 65, y1: 24 });
    else ocupados.push({ x0: d.x1 - 135, y0: d.y1 - 12, x1: L, y1: d.y1 + 12 });
  }
  const cobre = (c: { x0: number; y0: number; x1: number; y1: number }) => c.x0 < 0 || c.x1 > L || c.y0 < 0 || c.y1 > A || ocupados.some((o) => c.x0 < o.x1 && c.x1 > o.x0 && c.y0 < o.y1 && c.y1 > o.y0);
  const rotulos = [...pontos].sort((a, b) => b.vendas_milhoes - a.vendas_milhoes).map((p) => {
    const nome = nomeCurtoDoGrupo(p.grupo);
    const w = nome.length * 7.4 + 6;
    const h = 20;
    const px = x(p.lojas);
    const py = y(p.vendas_milhoes / 1000);
    const opcoes = [
      { lado: "direita", x0: px + 11, y0: py - h / 2 },
      { lado: "esquerda", x0: px - 11 - w, y0: py - h / 2 },
      { lado: "acima", x0: px - w / 2, y0: py - 11 - h },
      { lado: "abaixo", x0: px - w / 2, y0: py + 11 },
      { lado: "direita-acima", x0: px + 8, y0: py - 8 - h },
      { lado: "esquerda-abaixo", x0: px - 8 - w, y0: py + 8 },
    ].map((o) => ({ ...o, x1: o.x0 + w, y1: o.y0 + h }));
    const escolha = opcoes.find((o) => !cobre(o)) ?? opcoes[0];
    ocupados.push(escolha);
    return { p, nome, ...escolha };
  });
  const temEstimado = pontos.some((p) => p.natureza === "estimado_pela_fonte");
  const segmentos = Array.from(new Set(pontos.map((p) => p.segmento ?? "outros")));
  const porLoja = [...pontos].sort((a, b) => b.venda_por_loja_milhoes - a.venda_por_loja_milhoes);
  const maior = porLoja[0].venda_por_loja_milhoes;
  const descricao = `${titulo}. ${porLoja[0].grupo} tem a maior venda por loja, R$ ${num(maior, 0)} milhões, com ${num(porLoja[0].lojas)} lojas; ${porLoja[porLoja.length - 1].grupo} a menor, R$ ${num(porLoja[porLoja.length - 1].venda_por_loja_milhoes, 1)} milhões, com ${num(porLoja[porLoja.length - 1].lojas)} lojas.`;
  return (
    <div data-grafico="dispersao-lojas" data-figura-varejo="dispersao-lojas" className="min-w-0">
      <ul className="t-meta flex flex-wrap gap-x-5 gap-y-1 text-carvao-muted" aria-label="Segmentos e marcas">
        {segmentos.map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background: corDoSegmento(s), boxShadow: "inset 0 0 0 1.5px var(--cor-carvao)" }} />
            {nomeDoSegmento(s)}
          </li>
        ))}
        {temEstimado && (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full bg-mineral" style={{ backgroundImage: HACHURA, boxShadow: "inset 0 0 0 1.5px var(--cor-carvao)" }} />
            hachura: venda estimada pela fonte
          </li>
        )}
      </ul>

      <div className="mt-4 hidden md:grid md:grid-cols-[3.25rem_minmax(0,1fr)]" role="img" aria-label={descricao}>
        <div className="relative" aria-hidden="true">
          {my.map((m) => (
            <span key={m} className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-mineral" style={{ top: `${(100 * y(m)) / A}%` }}>
              {num(m)}
            </span>
          ))}
        </div>
        <div className="relative" style={{ aspectRatio: `${L} / ${A}` }} aria-hidden="true">
          <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" focusable="false">
            {my.map((m) => <line key={`y${m}`} x1={0} x2={L} y1={y(m)} y2={y(m)} stroke="var(--cor-grade)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
            {mx.map((m) => <line key={`x${m}`} y1={0} y2={A} x1={x(m)} x2={x(m)} stroke="var(--cor-grade)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
            {diagonais.map((k) => {
              const d = diagonal(k);
              return <line key={k} x1={d.x0} y1={d.y0} x2={d.x1} y2={d.y1} stroke="var(--cor-mineral)" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />;
            })}
          </svg>
          {diagonais.map((k) => {
            const d = diagonal(k);
            // o rótulo da diagonal vai na ponta de cima dela, por dentro do quadro
            const noTopo = d.y1 <= 1;
            return (
              <span key={k} className={`absolute whitespace-nowrap bg-papel px-1 text-xs leading-none text-mineral ${noTopo ? "-translate-x-1/2" : "-translate-x-full -translate-y-1/2"}`} style={{ left: `${(100 * d.x1) / L}%`, top: noTopo ? "0.25rem" : `${(100 * d.y1) / A}%` }}>
                R$ {num(k)} mi por loja
              </span>
            );
          })}
          {pontos.map((p) => (
            <span key={p.slug} data-ponto-grupo={p.slug} className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(100 * x(p.lojas)) / L}%`, top: `${(100 * y(p.vendas_milhoes / 1000)) / A}%`, background: corDoSegmento(p.segmento), boxShadow: "inset 0 0 0 1.5px var(--cor-carvao)", ...(p.natureza === "estimado_pela_fonte" ? { backgroundImage: HACHURA } : {}) }} />
          ))}
          {rotulos.map((r) => (
            <span key={r.p.slug} className="absolute whitespace-nowrap text-xs leading-5 text-carvao" style={{ left: `${(100 * (r.x0 + 3)) / L}%`, top: `${(100 * r.y0) / A}%` }}>
              {r.nome}
            </span>
          ))}
        </div>
        <span aria-hidden="true" />
        <div className="relative mt-1.5 h-9" aria-hidden="true">
          {mx.map((m) => (
            <span key={m} className={`absolute text-xs tabular-nums text-mineral ${x(m) > L - 12 ? "-translate-x-full" : "-translate-x-1/2"}`} style={{ left: `${(100 * x(m)) / L}%` }}>
              {num(m)}
            </span>
          ))}
          <span className="absolute bottom-0 right-0 text-xs text-carvao-muted">lojas no fim de {ano} →</span>
          <span className="absolute bottom-0 left-0 text-xs text-carvao-muted">↑ venda em {ano}, R$ bilhões</span>
        </div>
      </div>

      {/* celular: a venda por loja em barras, da maior para a menor */}
      <p className="t-meta mt-3 text-carvao-muted md:hidden">Venda por loja em {ano}, em R$ milhões, da maior para a menor; a barra parte do zero.</p>
      <ol className="mt-2 border-t border-carvao md:hidden" aria-label={`${titulo}: venda por loja, da maior para a menor`} data-dispersao-em-lista="">
        {porLoja.map((p) => {
          const destino = p.tem_ficha ? href(p.slug) : null;
          return (
            <li key={p.slug} className="border-b border-linha py-2">
              <div className="flex items-baseline gap-2.5">
                <span className="min-w-0 flex-1 text-sm leading-snug text-carvao">
                  {destino ? (
                    <Link href={destino} prefetch={false} className="underline decoration-linha underline-offset-4">
                      {p.grupo}
                    </Link>
                  ) : (
                    p.grupo
                  )}
                  <span className="text-xs text-carvao-muted">
                    {" "}
                    · {num(p.lojas)} lojas{p.natureza === "estimado_pela_fonte" ? ", venda estimada" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums text-carvao">R$ {num(p.venda_por_loja_milhoes, p.venda_por_loja_milhoes < 20 ? 1 : 0)} mi</span>
              </div>
              <span aria-hidden="true" className="mt-1 block h-2.5">
                <span className="block h-full min-w-[2px]" style={{ width: `${(100 * p.venda_por_loja_milhoes) / maior}%`, background: corDoSegmento(p.segmento), boxShadow: "inset 0 0 0 1px var(--cor-carvao-muted)", ...(p.natureza === "estimado_pela_fonte" ? { backgroundImage: HACHURA } : {}) }} />
              </span>
            </li>
          );
        })}
      </ol>

      {fora.length > 0 && (
        <p className="t-meta mt-3 text-carvao" data-fora-da-dispersao={fora.length}>
          <span className="font-medium">Fora do desenho, sem número de lojas na fonte:</span>{" "}
          {fora.map((m) => `${m.grupo}${m.vendas_milhoes !== null ? ` (${reaisDeMilhoes(m.vendas_milhoes)}${m.natureza === "estimado_pela_fonte" ? ", estimado" : ""})` : ""}`).join("; ")}. Ausência de dado não é zero loja.
        </p>
      )}
      <p className="t-meta mt-2 hidden max-w-prose2 text-carvao-muted md:block">
        As duas réguas são logarítmicas: cada marca vale o dobro ou mais da anterior, para a lista inteira caber sem amontoar os menores. Nessa escala, cada diagonal tracejada reúne os pontos de mesma venda por loja.
      </p>
    </div>
  );
}
