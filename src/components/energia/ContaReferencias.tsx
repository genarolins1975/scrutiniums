"use client";

import type { ReactNode } from "react";
import { ContaPontos, MarcaDaLegenda as Marcador, type PontoFaixa } from "@/components/energia/ContaPontos";
import { ContaRolavel } from "@/components/energia/ContaRolavel";
import { textoDestaquePerfil, textoReferenciasPerfil, type DestaquePerfil, type ReferenciasPerfil } from "@/lib/energia/conta";
import { num, reais } from "@/lib/energia/formato";

/**
 * As distribuidoras do mesmo consumo numa figura só: cada uma é um ponto numa escala que parte do zero, com a mediana, a faixa do 1º ao
 * 3º quartil (onde está a metade central), o menor e o maior custo e as distribuidoras em destaque (?dist=) como losangos. É a figura
 * que a abertura mostra antes do ranking: as 81 de uma vez, onde a lista de barras mostra uma dúzia por vez; o ranking diz quem é
 * cada uma, e esta diz onde ficam os extremos, a mediana e a sua distribuidora.
 *
 * Os valores vêm de `referenciasDoPerfil`, `destaquesDoPerfil` e das linhas do ranking (src/lib/energia/conta.ts), os mesmos da faixa
 * de métricas, da frase do painel e da tabela. A figura não calcula nada: desenha (ContaPontos). Texto e tabela dizem o mesmo que o
 * desenho (a tabela equivalente traz também a tarifa TE + TUSD de cada referência; os pontos são as linhas da tabela do ranking), e o
 * desenho não depende de cor: nome escrito no menor, no maior e nos destaques, mediana em linha com rótulo, pontos fora do grupo
 * escolhido vazados.
 */

export function ContaReferencias({
  referencias: r,
  destaques,
  pontos,
  controle,
  resposta,
  seletor,
  selecionadas,
  grupo,
  aoEscolher,
}: {
  referencias: ReferenciasPerfil;
  destaques: DestaquePerfil[];
  /** Uma distribuidora por ponto (o custo do perfil); `apagado` marca a que ficou fora do grupo escolhido. */
  pontos: PontoFaixa[];
  /** Controle do perfil, na linha do título da figura. */
  controle?: ReactNode;
  /** Frase que lê a figura (a resposta curta do painel), logo abaixo da legenda. */
  resposta?: ReactNode;
  /** Seletores da distribuidora em destaque (lista e busca por município), ao lado da lista dos destaques. */
  seletor?: ReactNode;
  /** Distribuidoras selecionadas, com o botão de limpar e o aviso do limite. */
  selecionadas?: ReactNode;
  /** Descrição do grupo escolhido ("30 permissionárias"), quando há filtro; os demais pontos ficam vazados. */
  grupo?: string | null;
  /** Clique num ponto (atalho do mouse e do toque; a lista, a busca e a tabela são as vias do teclado). */
  aoEscolher?: (id: string) => void;
}) {
  const titulo = `Custo de ${r.perfil} kWh/mês das ${r.n} distribuidoras, só pela tarifa B1 residencial (sem tributos e sem bandeira): menor, mediana e maior, com a faixa do 1º ao 3º quartil`;

  if (!r.menor || !r.maior || r.mediana === null) {
    return (
      <div data-grafico="referencias" className="w-full">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <p className="text-sm font-medium text-carvao">{titulo}</p>
          {controle}
        </div>
        <p role="status" className="border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao-muted">
          Sem referências do custo de {r.perfil} kWh por mês nesta publicação: nenhuma distribuidora tem tarifa B1 residencial vigente na data.
        </p>
        {resposta && <div className="mt-4">{resposta}</div>}
      </div>
    );
  }

  const menor = r.menor;
  const maior = r.maior;
  const mediana = r.mediana;
  const temFaixa = r.p25 !== null && r.p75 !== null;
  const linhas: { id: string; rotulo: string; valor: number | null; tarifa: number | null }[] = [
    { id: "menor", rotulo: `Menor (${menor.sigla})`, valor: menor.valor, tarifa: r.tarifa.menor },
    { id: "p25", rotulo: "1º quartil", valor: r.p25, tarifa: r.tarifa.p25 },
    { id: "mediana", rotulo: `Mediana de ${r.n} distribuidoras`, valor: mediana, tarifa: r.tarifa.mediana },
    { id: "p75", rotulo: "3º quartil", valor: r.p75, tarifa: r.tarifa.p75 },
    { id: "maior", rotulo: `Maior (${maior.sigla})`, valor: maior.valor, tarifa: r.tarifa.maior },
    ...destaques.map((d) => ({ id: `d-${d.cnpj}`, rotulo: `Em destaque: ${d.sigla}`, valor: d.valor, tarifa: d.tarifa })),
  ];

  return (
    <div data-grafico="referencias" className="w-full">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <p className="text-sm font-medium text-carvao" data-titulo-grafico="true">
          As {r.n} distribuidoras para {num(r.perfil, 0)} kWh/mês
          <span className="font-normal text-mineral">, em R$/mês</span>
        </p>
        {controle}
      </div>
      {resposta && <div className="mb-3">{resposta}</div>}
      <div>
        <ContaPontos
          descricao={`${textoReferenciasPerfil(r)} Cada ponto é uma distribuidora.`}
          pontos={pontos}
          faixa={temFaixa ? { de: r.p25 as number, ate: r.p75 as number, rotulo: `Do 1º ao 3º quartil: ${reais(r.p25)} a ${reais(r.p75)}` } : null}
          marcas={[{ valor: mediana, rotulo: `Mediana ${reais(mediana)}`, tipo: "mediana" }]}
          escolhidos={destaques.map((d) => d.cnpj)}
          formatar={(v) => reais(v)}
          zeroNoEixo
          aoEscolher={aoEscolher}
        />
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-carvao-muted" aria-label="Legenda">
        <li className="flex items-center gap-1.5">
          <Marcador tipo="ponto" />
          uma distribuidora
        </li>
        <li className="flex items-center gap-1.5">
          <Marcador tipo="extremo" />
          menor e maior
        </li>
        <li className="flex items-center gap-1.5">
          <Marcador tipo="mediana" />
          mediana
        </li>
        {temFaixa && (
          <li className="flex items-center gap-1.5">
            <Marcador tipo="faixa" />
            do 1º ao 3º quartil, a metade central ({reais(r.p25)} a {reais(r.p75)})
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <Marcador tipo="destaque" />
          distribuidora em destaque
        </li>
        {grupo && (
          <li className="flex items-center gap-1.5">
            <Marcador tipo="vazado" />
            fora do grupo escolhido ({grupo})
          </li>
        )}
        <li className="text-mineral">{r.n} distribuidoras com tarifa B1 residencial vigente, sem tributos e sem bandeira</li>
      </ul>
      <div className="mt-3 space-y-3">
        {seletor}
        <div className="min-w-0 space-y-2">
          {selecionadas}
          {destaques.length > 0 ? (
            <ul className="space-y-1 text-sm text-carvao" aria-label="Distribuidoras em destaque" aria-live="polite" data-destaques-perfil="">
              {destaques.map((d, i) => (
                <li key={d.cnpj} className="flex items-start gap-2">
                  <span className="mt-1">
                    <Marcador tipo="destaque" />
                  </span>
                  <span className={i === 0 ? "font-medium" : ""}>{textoDestaquePerfil(d)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-carvao-muted" data-destaques-perfil="">
              Escolha uma distribuidora para ver onde ela fica entre o menor e o maior custo. Vale também clicar num ponto, numa barra do ranking ou numa linha da tabela.
            </p>
          )}
        </div>
      </div>
      <details className="mt-2 text-xs">
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
          Dados do gráfico em tabela ({linhas.length.toLocaleString("pt-BR")} linhas)
        </summary>
        <ContaRolavel rotulo={`${titulo}: dados em tabela (rolável)`} className="mt-2">
          <table className="w-full border-collapse tabular-nums">
            <caption className="sr-only">{`${titulo}, em R$/mês e em R$/MWh. Os ${r.n} pontos são as linhas da tabela do ranking.`}</caption>
            <thead>
              <tr className="text-left text-mineral">
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">
                  Referência
                </th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 text-right font-medium">
                  Custo de {num(r.perfil, 0)} kWh (R$/mês)
                </th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 text-right font-medium">
                  Tarifa TE + TUSD (R$/MWh)
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-b border-linha">
                  <th scope="row" className="px-2 py-1 text-left font-normal text-carvao">
                    {l.rotulo}
                  </th>
                  <td className="px-2 py-1 text-right text-carvao">{l.valor === null ? <span className="italic text-mineral">sem dado</span> : num(l.valor, 2)}</td>
                  <td className="px-2 py-1 text-right text-carvao">{l.tarifa === null ? <span className="italic text-mineral">sem dado</span> : num(l.tarifa, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ContaRolavel>
        <p className="mt-1 text-carvao-muted">
          Os {r.n} pontos da figura são as {r.n} linhas da tabela do ranking, logo abaixo, com o mesmo custo de {num(r.perfil, 0)} kWh.
        </p>
      </details>
    </div>
  );
}
