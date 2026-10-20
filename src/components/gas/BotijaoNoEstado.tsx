"use client";

import { useId } from "react";
import { useSelecaoGas } from "@/components/gas/useSelecaoGas";
import { mesExtenso, num, reais } from "@/lib/gas/formato";
import type { DadosBotijaoNoEstado } from "@/lib/gas/botijaoNoEstado";

/** Opção "Brasil" do seletor: a média nacional da ANP, que também é a referência de cada estado. */
const BRASIL = "BR";

const revendas = (n: number | null) => (n === null ? "revendas pesquisadas: sem dado" : `${num(n, 0)} revendas pesquisadas`);

/**
 * Consulta do botijão no estado (versão aperitivo do Gás de cozinha): o seletor de estado (na URL, `?uf=`) e, para a
 * escolha, o preço médio do botijão de 13 kg no último mês da pesquisa da ANP, a média do Brasil e a diferença em reais e
 * em percentual. Os dados vêm prontos no HTML; nada é buscado no navegador. Diferença zero é "igual à média", nunca ausência.
 */
export function BotijaoNoEstado({ dados }: { dados: DadosBotijaoNoEstado }) {
  const id = useId();
  const opcoes = [{ valor: BRASIL, rotulo: "Brasil (média nacional)" }, ...dados.ufs.map((u) => ({ valor: u.uf, rotulo: u.nome }))];
  const escolha = useSelecaoGas("uf", opcoes.map((o) => o.valor), BRASIL);
  const linha = escolha.valor === BRASIL ? null : dados.ufs.find((u) => u.uf === escolha.valor) ?? null;
  const mes = mesExtenso(dados.ultimoMes);
  const br = dados.brasil;
  const igual = linha !== null && Math.abs(linha.dif_brasil) < 0.005;
  const lado = linha && linha.dif_brasil > 0 ? "acima" : "abaixo";
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor={`${id}-uf`} className="block text-sm text-carvao">Seu estado</label>
        <select
          id={`${id}-uf`}
          value={escolha.valor}
          onChange={(e) => escolha.selecionar(e.target.value)}
          className="mt-1 min-h-[44px] w-full border sm:w-80 border-mineral bg-superficie px-3 text-base text-carvao"
        >
          {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
      </div>
      {escolha.invalida && <p aria-live="polite" className="text-sm text-carvao-muted">O estado informado no endereço não está na pesquisa. Exibimos a média do Brasil.</p>}

      <div role="status" aria-live="polite">
        <h2 className="ed-h2 max-w-3xl font-serif text-carvao">Botijão de 13 kg {linha ? `em ${linha.nome}` : "no Brasil"}, {mes}</h2>
        <dl className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-3">
          {linha && (
            <div className="min-w-0 border-t-2 border-gas pt-3" data-botijao="uf">
              <dt className="text-sm text-carvao-muted">Preço médio em {linha.nome}</dt>
              <dd className="mt-1 text-[1.75rem] leading-tight tracking-tight text-carvao [font-variant-numeric:tabular-nums]">
                {reais(linha.medio, 2)} <span className="text-base text-carvao-muted">por botijão</span>
              </dd>
              <dd className="mt-1 text-xs leading-relaxed text-mineral">{mes} · {revendas(linha.postos)}</dd>
            </div>
          )}
          <div className={`min-w-0 border-t-2 pt-3 ${linha ? "border-linha" : "border-gas"}`} data-botijao="brasil">
            <dt className="text-sm text-carvao-muted">Média do Brasil</dt>
            <dd className={`mt-1 leading-tight tracking-tight text-carvao [font-variant-numeric:tabular-nums] ${linha ? "text-[1.375rem]" : "text-[1.75rem]"}`}>
              {reais(br.medio, 2)} <span className="text-base text-carvao-muted">por botijão</span>
            </dd>
            <dd className="mt-1 text-xs leading-relaxed text-mineral">{mes} · {revendas(br.postos)}</dd>
          </div>
          {linha && (
            <div className="min-w-0 border-t-2 border-linha pt-3" data-botijao="diferenca">
              <dt className="text-sm text-carvao-muted">Diferença para a média do Brasil</dt>
              {igual ? (
                <dd className="mt-1 text-[1.375rem] leading-tight text-carvao">Igual à média do Brasil</dd>
              ) : (
                <>
                  <dd className="mt-1 text-[1.375rem] leading-tight tracking-tight text-carvao [font-variant-numeric:tabular-nums]">
                    {reais(Math.abs(linha.dif_brasil), 2)} {lado}
                  </dd>
                  <dd className="mt-1 text-sm leading-snug text-carvao [font-variant-numeric:tabular-nums]">
                    {num(Math.abs(linha.dif_brasil_pct), 1)}% {lado} da média do Brasil
                  </dd>
                </>
              )}
            </div>
          )}
        </dl>
        {!linha && (
          <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            Escolha o seu estado para ver o preço médio do botijão nele e a diferença para a média do Brasil.
          </p>
        )}
      </div>
    </div>
  );
}
