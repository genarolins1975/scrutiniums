"use client";

import { useId } from "react";
import { useLitrosTanque } from "./useLitrosTanque";
import { useSelecaoGas } from "@/components/gas/useSelecaoGas";
import { FaixaNumeros } from "@/components/painel/FaixaNumeros";
import { NumeroIndicador } from "@/components/painel/NumeroIndicador";
import { mesExtenso, num, reais } from "@/lib/gas/formato";
import { BRASIL, opcoesUf, type DadosPrecoNoEstado } from "./PrecoNoEstado";

/**
 * A consulta "Quanto custa encher o tanque no meu estado?" no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o
 * seletor de estado e os litros vão na abertura (a primeira ação do leitor) e o resultado na faixa de números. São duas ilhas da
 * mesma página: estado e litros andam pela URL (`?uf=` e `?litros=`), inclusive ao reabrir um recorte compartilhado.
 *
 * Os números são os mesmos do PrecoNoEstado, lidos dos mesmos campos: preço médio da ANP, postos pesquisados, distância para a
 * média do Brasil e a conta do tanque (preço médio vezes os litros). Combustível sem preço para a UF é ausência com o motivo,
 * nunca zero.
 */

function useEstado(dados: DadosPrecoNoEstado) {
  const opcoes = opcoesUf(dados.ufs);
  const escolha = useSelecaoGas("uf", opcoes.map((o) => o.valor), BRASIL);
  const linha = escolha.valor === BRASIL ? null : dados.ufs.find((u) => u.uf === escolha.valor) ?? null;
  return { opcoes, escolha, linha };
}

/** "R$ 0,46 (7,0%) acima da média do Brasil"; zero calculado é "igual à média do Brasil", nunca ausência. */
function distancia(dif: number, pct: number): string {
  if (Math.abs(dif) < 0.005) return "Igual à média do Brasil";
  return `${reais(Math.abs(dif), 2)} (${num(Math.abs(pct), 1)}%) ${dif > 0 ? "acima" : "abaixo"} da média do Brasil`;
}

/** A primeira ação da consulta: o estado e os litros no tanque, cada um com rótulo visível. */
export function SeletorTanque({ dados }: { dados: DadosPrecoNoEstado }) {
  const id = useId();
  const { opcoes, escolha } = useEstado(dados);
  const [litros, setLitros] = useLitrosTanque();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <label htmlFor={`${id}-uf`} className="block text-sm text-carvao">
            Seu estado
          </label>
          <select
            id={`${id}-uf`}
            value={escolha.valor}
            onChange={(e) => escolha.selecionar(e.target.value)}
            className="mt-1 min-h-[44px] min-w-[16rem] max-w-full border border-mineral bg-superficie px-3 text-base text-carvao"
          >
            {opcoes.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-litros`} className="block text-sm text-carvao">
            Litros no tanque
          </label>
          <input
            id={`${id}-litros`}
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            step={1}
            value={Number.isFinite(litros) ? litros : ""}
            onChange={(e) => setLitros(e.target.value === "" ? Number.NaN : Number(e.target.value))}
            className="mt-1 min-h-[44px] w-28 border border-mineral bg-superficie px-3 text-base text-carvao [font-variant-numeric:tabular-nums]"
            aria-describedby={`${id}-litros-nota`}
          />
        </div>
      </div>
      <p id={`${id}-litros-nota`} className="t-meta max-w-prose2 text-mineral">
        A conta do tanque é o preço médio vezes os litros escolhidos (40 litros é só um exemplo). O valor pago varia de posto para posto.
      </p>
      {escolha.invalida && (
        <p aria-live="polite" className="t-meta text-carvao-muted">
          O estado informado no endereço não está na pesquisa. Exibimos a média do Brasil.
        </p>
      )}
    </div>
  );
}

/** O resultado da consulta: o preço médio do litro de cada combustível na escolha, um NumeroIndicador por combustível. */
export function FaixaTanque({ dados }: { dados: DadosPrecoNoEstado }) {
  const { linha } = useEstado(dados);
  const [litros] = useLitrosTanque();
  const nome = linha ? linha.nome : "Brasil";
  const mes = mesExtenso(dados.ultimoMes);
  const litrosValidos = Number.isFinite(litros) && litros > 0 && litros <= 1000;
  return (
    <div role="status" aria-live="polite">
      <FaixaNumeros
        rotulo={`Preço médio do litro: ${nome}, ${mes}`}
        nota={
          linha && linha.etanol_gasolina_pct !== null ? (
            <>
              {nome}: o litro de etanol custou em média {num(linha.etanol_gasolina_pct, 1)}% do preço do litro de gasolina em {mes}.
            </>
          ) : undefined
        }
      >
        {dados.produtos.map((p) => {
          const br = dados.brasil[p.id];
          const uf = linha ? linha[p.id] : null;
          const preco = linha ? uf?.medio ?? null : br.medio;
          const postos = linha ? uf?.postos ?? null : br.postos;
          const base = { rotulo: p.nome, unidade: "R$ por litro", periodo: mes, recorte: nome, fonte: "ANP, Levantamento de Preços de Combustíveis", natureza: "OBSERVADO" as const, tamanho: "m" as const };
          if (preco === null) return <NumeroIndicador key={p.id} {...base} valor={null} motivoAusencia={`A ANP não publicou preço deste combustível para a UF em ${mes}.`} nota={p.nota ?? undefined} />;
          return (
            <NumeroIndicador
              key={p.id}
              {...base}
              valor={preco}
              formato="reais"
              casas={2}
              nota={
                <div className="space-y-1" data-combustivel={p.id}>
                  <p>{postos === null ? "Postos pesquisados: sem dado" : `${num(postos, 0)} postos pesquisados`}</p>
                  {postos !== null && postos < 10 && <p>Amostra de menos de 10 postos: a média pode variar muito de um mês para outro.</p>}
                  {uf ? (
                    <p className="text-carvao">
                      {distancia(uf.dif_brasil, uf.dif_brasil_pct)} ({reais(br.medio, 2)})
                    </p>
                  ) : (
                    <p className="text-carvao">
                      Menor e maior preço da pesquisa: {reais(br.minimo, 2)} a {reais(br.maximo, 2)}
                    </p>
                  )}
                  {litrosValidos && (
                    <p className="[font-variant-numeric:tabular-nums]">
                      {num(litros, 0)} litros: {reais(preco * litros, 2)}
                    </p>
                  )}
                  {p.nota && <p>{p.nota}</p>}
                </div>
              }
            />
          );
        })}
      </FaixaNumeros>
    </div>
  );
}
