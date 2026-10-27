"use client";

import Link from "next/link";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { dataBr, distanciaBrasil, mesAno, mesExtenso, pct, pctSinal, pp } from "@/lib/inflacao/formato";
import { BRASIL, type DadosPrimeiraTela } from "@/lib/inflacao/tipos";
import { ROTA_COMIDA } from "@/lib/inflacao/paginas";
import { BarraDivergente, COR_AREA, SeletorArea, dominio, useArea } from "./comum";

const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";

/**
 * Primeira tela do painel e da consulta: o seletor da área (na URL, `?area=`) e, para o último mês, a inflação em 12 meses
 * do índice geral da área e do Brasil, a diferença em pontos percentuais, e os nove grupos com a variação em 12 meses, o
 * peso no orçamento e o Brasil ao lado. Todos os números vêm prontos da gold; nada é estimado no navegador.
 */
export function InflacaoNaArea({ dados, comLinkComida = true, recolherGrupos = false }: { dados: DadosPrimeiraTela; comLinkComida?: boolean; recolherGrupos?: boolean }) {
  const escolha = useArea(dados.areas);
  const br = dados.areas.find((a) => a.id === BRASIL)!;
  const area = dados.areas.find((a) => a.id === escolha.valor) ?? br;
  const ehBrasil = area.id === BRASIL;
  const { ref } = dados;
  const mes = mesExtenso(ref.ultimoMes);
  const janela = `${mesAno(ref.inicioJanela)} a ${mesAno(ref.ultimoMes)}`;
  const escala = dominio(dados.grupos.flatMap((g) => [area.grupos[g.id].doze, br.grupos[g.id].doze]));
  const grupos = (
    <div>
          <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            Variação em 12 meses até {mesAno(ref.ultimoMes)} e peso de cada grupo no orçamento das famílias da pesquisa em {mesAno(ref.ultimoMes)}
            {ehBrasil ? ", no Brasil." : `, em ${area.nome}. O traço escuro marca o Brasil.`}
          </p>
          <ul className="mt-4 divide-y divide-linha border-y border-linha">
            {dados.grupos.map((g) => {
              const x = area.grupos[g.id];
              const b = br.grupos[g.id];
              return (
                <li key={g.id} className="grid gap-x-6 gap-y-1 py-3 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,13rem)] md:items-center" data-grupo={g.id}>
                  <div className="min-w-0">
                    <p className="text-[0.95rem] leading-snug text-carvao">{g.nome}</p>
                    <p className="text-xs leading-relaxed text-mineral [font-variant-numeric:tabular-nums]">{pct(x.peso)} do orçamento</p>
                  </div>
                  <BarraDivergente valor={x.doze} min={escala.min} max={escala.max} referencia={ehBrasil ? null : b.doze} cor={COR_AREA} />
                  <p className="text-sm leading-snug text-carvao [font-variant-numeric:tabular-nums] md:text-right">
                    <span className="font-medium">{pctSinal(x.doze)}</span>
                    {!ehBrasil && (
                      <span className="text-carvao-muted">
                        {" "}· Brasil {pctSinal(b.doze)} ({pp(x.dif, 2, true)})
                      </span>
                    )}
                  </p>
                  {comLinkComida && g.numero === 1 && (
                    <p className="text-xs leading-relaxed text-carvao-muted md:col-span-3">
                      Os alimentos item por item, da feira ao prato feito, estão no painel{" "}
                      <Link href={ROTA_COMIDA} prefetch={prefetchDoLink(ROTA_COMIDA)} className={link}>
                        Comida no prato
                        <SeloComConta href={ROTA_COMIDA} />
                      </Link>
                      , o painel principal da inflação dos alimentos.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 max-w-prose2 text-xs leading-relaxed text-mineral">
            Barras na mesma escala, a partir do zero; queda de preço vai para a esquerda. Os pesos somam 100% em cada área e mês. Peso maior quer dizer que o grupo
            ocupa uma parte maior do orçamento médio, não que ele subiu mais.
          </p>
        </div>
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <SeletorArea areas={dados.areas} valor={area.id} onChange={escolha.selecionar} grande />
        <p className="max-w-prose2 basis-[22rem] text-xs leading-relaxed text-mineral">
          O IBGE pesquisa 16 áreas: 10 regiões metropolitanas e 6 capitais. Cidade fora da lista não tem IPCA próprio; o índice da área mais próxima não é o seu.
        </p>
      </div>
      {escolha.invalida && <p aria-live="polite" className="text-sm text-carvao-muted">A área informada no endereço não está no IPCA. Exibimos o Brasil.</p>}

      <div className="space-y-6">
        <div role="status" aria-live="polite" data-resposta-especifica="">
          <h2 className="ed-h2 max-w-3xl font-serif text-carvao">Inflação em 12 meses</h2>
          <div className="mt-5 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:max-w-4xl">
            <div className="min-w-0 border-t-2 border-bronze pt-3" data-medida="area">
              <p className="text-sm text-carvao-muted">{ehBrasil ? "Brasil, IPCA índice geral" : `${area.rotulo}, IPCA índice geral`}</p>
              <p data-valor-resposta="" className="mt-1 font-sans text-[2.25rem] leading-tight tracking-tight text-carvao [font-variant-numeric:tabular-nums]">
                {pct(area.geral.doze)} <span className="text-base text-carvao-muted">em 12 meses</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-mineral">{janela} · variação acumulada em 12 meses</p>
              {!ehBrasil && <p className="mt-2 text-sm leading-snug text-carvao">{distanciaBrasil(area.geral.dif).replace(/^./, (c) => c.toUpperCase())}.</p>}
            </div>
            {ehBrasil ? (
              <div className="min-w-0 border-t border-linha pt-3 text-sm leading-relaxed text-carvao-muted">
                <p>
                  O índice do Brasil combina as 16 áreas, cada uma com um peso definido pelo IBGE. Escolha a sua cidade ou região para ver a inflação dela ao
                  lado da do país.
                </p>
              </div>
            ) : (
              <div className="min-w-0 border-t-2 border-linha pt-3" data-medida="brasil">
                <p className="text-sm text-carvao-muted">Brasil, IPCA índice geral</p>
                <p className="mt-1 font-sans text-[2.25rem] leading-tight tracking-tight text-carvao [font-variant-numeric:tabular-nums]">
                  {pct(br.geral.doze)} <span className="text-base text-carvao-muted">em 12 meses</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-mineral">{janela} · a referência nacional</p>
              </div>
            )}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-carvao-muted">
            Só em {mes}: {pctSinal(area.geral.mensal)} no mês. No ano, de janeiro a {mes.split(" de ")[0]}: {pct(area.geral.ano)}.
          </p>
          <p className="mt-2 max-w-prose2 text-xs leading-relaxed text-mineral">
            Fonte: IBGE, IPCA, tabela {ref.tabela} do SIDRA, divulgada em {dataBr(ref.divulgadoEm)}. Variação percentual dos preços; a diferença entre a área e o
            Brasil é a subtração das duas variações, em pontos percentuais (p.p.).
          </p>
        </div>

        {recolherGrupos ? <Recolhido id="grupos-na-area" titulo="Os nove grupos de despesa" resumo="Variação, peso no orçamento e comparação com o Brasil.">{grupos}</Recolhido> : <div><h3 className="font-serif text-xl text-carvao">Os nove grupos de despesa</h3>{grupos}</div>}
      </div>
    </div>
  );
}
