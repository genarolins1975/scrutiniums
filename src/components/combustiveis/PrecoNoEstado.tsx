"use client";

import { useId, useState } from "react";
import { useSelecaoGas } from "@/components/gas/useSelecaoGas";
import { mesExtenso, num, reais } from "@/lib/gas/formato";
import type { IdCombustivel, ProdutoCombustivel } from "@/lib/gas/gold";

/** Opção "Brasil" do seletor: a média nacional da ANP, que também é a referência de cada estado. */
export const BRASIL = "BR";

export type PrecoBrasil = { medio: number; minimo: number | null; maximo: number | null; postos: number | null };

/** O que a primeira tela usa de cada UF (a página manda ao navegador só isto, não a linha inteira da gold). */
export type PrecoUfEnxuto = { medio: number; postos: number | null; dif_brasil: number; dif_brasil_pct: number };
export type LinhaUfEnxuta = { uf: string; nome: string; etanol_gasolina_pct: number | null } & Record<IdCombustivel, PrecoUfEnxuto | null>;

export type DadosPrecoNoEstado = {
  ultimoMes: string;
  produtos: ProdutoCombustivel[];
  brasil: Record<IdCombustivel, PrecoBrasil>;
  ufs: LinhaUfEnxuta[];
};

/** Lista do seletor: Brasil primeiro, depois as UFs em ordem alfabética (a mesma em todas as ilhas da página). */
export function opcoesUf(ufs: { uf: string; nome: string }[]): { valor: string; rotulo: string }[] {
  return [{ valor: BRASIL, rotulo: "Brasil (média nacional)" }, ...[...ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((u) => ({ valor: u.uf, rotulo: u.nome }))];
}

/** "R$ 0,46 (7,0%) acima da média do Brasil"; zero calculado é "igual à média do Brasil", nunca ausência. */
function distancia(dif: number, pct: number): string {
  if (Math.abs(dif) < 0.005) return "Igual à média do Brasil";
  return `${reais(Math.abs(dif), 2)} (${num(Math.abs(pct), 1)}%) ${dif > 0 ? "acima" : "abaixo"} da média do Brasil`;
}

/** Revisão independente, 27/10/2026: a quebra pode vir após R$, nunca entre os algarismos. */
function ReaisLegiveis({ valor }: { valor: number }) {
  const texto = reais(valor, 2);
  const partes = texto.match(/^(R\$\s)(.+)$/);
  if (!partes) return <>{texto}</>;
  return <>{partes[1]}<wbr /><span data-quantia-inteira="" className="whitespace-nowrap">{partes[2]}</span></>;
}

/**
 * Primeira tela do painel e da consulta: o seletor de estado (na URL, `?uf=`) e, para a escolha, o preço médio do litro
 * de cada combustível no último mês da pesquisa da ANP, com os postos pesquisados e a distância para a média do Brasil
 * em reais e em percentual. A conta do tanque multiplica o preço médio pelos litros escolhidos: é uma conta, não o preço
 * de um posto. Combustível sem preço publicado para a UF aparece como "sem dado", nunca como zero.
 */
export function PrecoNoEstado({ dados, titulo, destacarTanque = false }: { dados: DadosPrecoNoEstado; titulo?: string; destacarTanque?: boolean }) {
  const id = useId();
  const opcoes = opcoesUf(dados.ufs);
  const escolha = useSelecaoGas("uf", opcoes.map((o) => o.valor), BRASIL);
  const [litros, setLitros] = useState(40);
  const linha = escolha.valor === BRASIL ? null : dados.ufs.find((u) => u.uf === escolha.valor) ?? null;
  const nome = linha ? linha.nome : "Brasil";
  const mes = mesExtenso(dados.ultimoMes);
  const litrosValidos = Number.isFinite(litros) && litros > 0 && litros <= 1000;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="min-w-0 max-w-full basis-[10rem] flex-1 sm:flex-none">
          <label htmlFor={`${id}-uf`} className="block text-sm text-carvao">Seu estado</label>
          <select
            id={`${id}-uf`}
            value={escolha.valor}
            onChange={(e) => escolha.selecionar(e.target.value)}
            className="mt-1 min-h-[44px] w-full max-w-[16rem] border border-mineral bg-superficie px-3 text-base text-carvao"
          >
            {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        </div>
        <div className="w-24 shrink-0">
          <label htmlFor={`${id}-litros`} className="block text-sm text-carvao">Litros</label>
          <input
            id={`${id}-litros`}
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            step={1}
            value={Number.isFinite(litros) ? litros : ""}
            onChange={(e) => setLitros(e.target.value === "" ? Number.NaN : Number(e.target.value))}
            className="mt-1 min-h-[44px] w-24 border border-mineral bg-superficie px-3 text-base text-carvao [font-variant-numeric:tabular-nums]"
            aria-describedby={`${id}-litros-nota`}
          />
        </div>
      </div>
      <p id={`${id}-litros-nota`} className="max-w-prose2 text-xs leading-relaxed text-mineral">
        Cálculo pela média mensal vezes os litros escolhidos. 40 litros é só um exemplo.
      </p>
      {!litrosValidos && <p role="status" className="text-sm text-carvao-muted">Informe de 1 a 1.000 litros para calcular o tanque. Os preços por litro continuam disponíveis.</p>}
      {escolha.invalida && <p aria-live="polite" className="text-sm text-carvao-muted">O estado informado no endereço não está na pesquisa. Exibimos a média do Brasil.</p>}

      <div role="status" aria-live="polite" data-resposta-especifica="">
        <h2 className="ed-h2 max-w-3xl font-serif text-carvao">{titulo ?? `${destacarTanque ? "Custo do tanque" : "Preço médio do litro"}: ${nome}, ${mes}`}</h2>
        <p className="mt-2 text-xs leading-relaxed text-mineral">Fonte: ANP, pesquisa de preços nos postos · {mes}. {destacarTanque ? "Custo calculado pela média observada, não uma cotação de posto." : "Média observada na pesquisa."}</p>
        <ul className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
          {dados.produtos.map((p) => {
            const br = dados.brasil[p.id];
            const uf = linha ? linha[p.id] : null;
            const preco = linha ? uf?.medio ?? null : br.medio;
            const postos = linha ? uf?.postos ?? null : br.postos;
            return (
              <li key={p.id} className="min-w-0 border-t-2 border-gas pt-3" data-combustivel={p.id}>
                <p className="text-sm text-carvao-muted">{p.nome}</p>
                {preco === null ? (
                  <>
                    <p data-valor-resposta="" className="mt-1 text-[1.75rem] leading-tight text-mineral">sem dado</p>
                    <p className="mt-1 text-xs leading-relaxed text-mineral">A ANP não publicou preço deste combustível para a UF em {mes}.</p>
                  </>
                ) : (
                  <>
                    <p data-valor-resposta="" className="mt-1 font-sans text-[1.75rem] leading-tight tracking-tight text-carvao [font-variant-numeric:tabular-nums]">
                      <ReaisLegiveis valor={destacarTanque && litrosValidos ? preco * litros : preco} /> <span className="text-base text-carvao-muted">{destacarTanque && litrosValidos ? `para ${num(litros, 0)} litros` : "por litro"}</span>
                    </p>
                    {destacarTanque && <p className="mt-2 text-sm text-carvao-muted">{reais(preco, 2)} por litro · média observada</p>}
                    <p className="mt-1 text-xs leading-relaxed text-mineral">
                      {mes} · {postos === null ? "postos pesquisados: sem dado" : `${num(postos, 0)} postos pesquisados`}
                    </p>
                    {postos !== null && postos < 10 && (
                      <p className="mt-1 text-xs leading-relaxed text-carvao-muted">Amostra de menos de 10 postos: a média pode variar muito de um mês para outro.</p>
                    )}
                    {uf ? (
                      <p className="mt-2 text-sm leading-snug text-carvao">{destacarTanque && "Preço por litro: "}{distancia(uf.dif_brasil, uf.dif_brasil_pct)} ({reais(br.medio, 2)} por litro)</p>
                    ) : (
                      <p className="mt-2 text-sm leading-snug text-carvao">Menor e maior preço da pesquisa: {reais(br.minimo, 2)} a {reais(br.maximo, 2)}</p>
                    )}
                    {litrosValidos && !destacarTanque && (
                      <p className="mt-1 text-sm leading-snug text-carvao-muted [font-variant-numeric:tabular-nums]">
                        {num(litros, 0)} litros: {reais(preco * litros, 2)}
                      </p>
                    )}
                  </>
                )}
                {p.nota && <p className="mt-2 border-l-2 border-gas-soft pl-2 text-xs leading-relaxed text-carvao-muted">{p.nota}</p>}
              </li>
            );
          })}
        </ul>
      </div>
      {linha && linha.etanol_gasolina_pct !== null && (
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          {nome}: o litro de etanol custou em média {num(linha.etanol_gasolina_pct, 1)}% do preço do litro de gasolina em {mes}.
        </p>
      )}
    </div>
  );
}
