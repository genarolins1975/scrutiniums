"use client";

import { useId } from "react";
import { BotaoLink } from "@/components/home/BotaoLink";
import { useSelecaoGas } from "@/components/gas/useSelecaoGas";
import { numero } from "@/lib/eficiencia/seguranca/formato";

export type UfSeuEstado = {
  sigla: string;
  nome: string;
  /** Vítimas de homicídio doloso por 100 mil habitantes no ano da comparação; null é ausência, com o motivo. */
  taxa: number | null;
  /** O mesmo número do "Para você" do mapa da conta (numeroViolenciaNaUf), já formatado: uma leitura só para a taxa da UF. */
  valor: string | null;
  motivo: string | null;
  posicao: number | null;
  /** Óbitos por agressão por 100 mil no último ano final do SIM. */
  sim: number | null;
  /** Mortes por causa externa de intenção indeterminada, % das mortes por causas externas, mesmo ano do SIM. */
  indeterminadas: number | null;
};

export type DadosSeuEstado = {
  ano: number;
  anoSim: number;
  rota: string;
  comparadas: number;
  brasil: { taxa: number; sim: number | null; indeterminadas: number | null };
  ufs: UfSeuEstado[];
  fonteSinesp: string;
  fonteSim: string;
};

const BR = "BR";

/** Escala da faixa: de zero ao primeiro múltiplo de 5 acima da maior taxa, para a posição nunca encostar na borda. */
function teto(max: number): number {
  return Math.max(5, Math.ceil((max * 1.02) / 5) * 5);
}

/**
 * "Como está o meu estado?", num painel escuro (direção do Figma, página "02 · Segurança"): a escolha de UF logo depois dos números, com a taxa de homicídio doloso da UF, a do Brasil e a posição
 * entre as UFs com dado, o registro de saúde do mesmo estado e a faixa das 27 UFs com rótulos diretos (maior, menor, Brasil e a UF
 * escolhida). É também o destino mais procurado a um clique: "Comparar os estados" leva à comparação por UF com a mesma UF (?uf=).
 * A escolha anda junto com o modelo didático da página (a mesma chave `uf` na URL). Posição descreve onde a UF está, nunca nota.
 */
export function SeuEstado({ dados: d }: { dados: DadosSeuEstado }) {
  const escolha = useSelecaoGas("uf", [BR, ...d.ufs.map((u) => u.sigla)], BR);
  const id = useId();
  const uf = escolha.valor === BR ? null : d.ufs.find((u) => u.sigla === escolha.valor) ?? null;
  const comDado = d.ufs.filter((u): u is UfSeuEstado & { taxa: number } => u.taxa !== null).sort((a, b) => b.taxa - a.taxa);
  const maior = comDado[0];
  const menor = comDado[comDado.length - 1];
  const max = teto(maior.taxa);
  const pos = (v: number) => `${(v / max) * 100}%`;
  const diferenca = uf?.taxa != null ? uf.taxa - d.brasil.taxa : null;
  const destino = `${d.rota}/estados${uf ? `?uf=${uf.sigla}` : ""}`;
  // rótulos de baixo: menor à esquerda, Brasil no centro, maior à direita; um rótulo que encostaria no vizinho sobe para a linha de cima
  const perto = (a: number, b: number) => Math.abs(a - b) / max < 0.16;
  const brasilEmCima = perto(d.brasil.taxa, menor.taxa) || perto(d.brasil.taxa, maior.taxa);

  return (
    <section aria-labelledby={`${id}-titulo`} className="bg-carvao px-5 py-8 text-marfim sm:px-8 md:py-10 lg:px-10" data-painel-escuro="">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <h2 id={`${id}-titulo`} className="t-h2 text-marfim">Como está o meu estado?</h2>
          <p className="mt-3 max-w-prose2 t-corpo text-mineral-soft">
            A taxa de homicídio doloso registrada pela polícia do estado, a posição entre as {d.comparadas} UFs com dado e o que o registro de saúde conta no mesmo estado.
          </p>
          <label htmlFor={id} className="rotulo mt-6 block text-mineral-soft">Estado</label>
          <select
            id={id}
            value={escolha.valor}
            onChange={(e) => escolha.selecionar(e.target.value)}
            className="mt-2 min-h-[44px] w-full max-w-sm border border-mineral bg-superficie px-3 text-base text-carvao focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-marfim"
          >
            <option value={BR}>Brasil, todas as UFs</option>
            {[...d.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((u) => <option key={u.sigla} value={u.sigla}>{u.nome}</option>)}
          </select>
        </div>

        <div aria-live="polite" className="min-w-0">
          <p className="text-sm text-mineral-soft">Vítimas de homicídio doloso, {uf ? uf.nome : "Brasil"}, {d.ano}</p>
          {uf && uf.taxa === null ? (
            <p className="mt-2 t-corpo text-marfim">
              Indisponível nesta publicação. <span className="text-mineral-soft">{uf.motivo}</span>
            </p>
          ) : (
            <p className="mt-2">
              <span className="numero-g text-marfim">{uf ? uf.valor : numero(d.brasil.taxa, 1)}</span> <span className="text-sm text-mineral-soft">por 100 mil habitantes</span>
            </p>
          )}
          <p className="mt-3 max-w-prose2 t-corpo text-marfim">
            {!uf
              ? `De ${numero(menor.taxa, 1)} em ${menor.nome} a ${numero(maior.taxa, 1)} em ${maior.nome}: a taxa da UF mais alta é ${numero(maior.taxa / menor.taxa, 1)} vezes a da mais baixa.`
              : uf.taxa === null
                ? `Sem a taxa de ${uf.nome}, a UF fica fora da ordem; o Brasil tem ${numero(d.brasil.taxa, 1)} por 100 mil.`
                : `${diferenca === 0 ? "Igual à" : `${numero(Math.abs(diferenca ?? 0), 1)} ${Math.abs(diferenca ?? 0) >= 2 ? "pontos" : "ponto"} ${(diferenca ?? 0) > 0 ? "acima da" : "abaixo da"}`} taxa do Brasil (${numero(d.brasil.taxa, 1)}). ${uf.posicao}ª maior taxa entre as ${d.comparadas} UFs com dado.`}
          </p>
          <dl className="mt-5 grid gap-px border border-linha-escura bg-linha-escura sm:grid-cols-2">
            <div className="bg-carvao p-4">
              <dt className="text-sm leading-snug text-mineral-soft">Óbitos por agressão no registro de saúde, {d.anoSim}</dt>
              <dd className="mt-1">
                {(uf ? uf.sim : d.brasil.sim) === null ? <span className="text-base text-marfim">Indisponível nesta publicação</span> : <><span className="numero-p text-marfim">{numero((uf ? uf.sim : d.brasil.sim) as number, 1)}</span> <span className="text-sm text-mineral-soft">por 100 mil</span></>}
              </dd>
            </div>
            <div className="bg-carvao p-4">
              <dt className="text-sm leading-snug text-mineral-soft">Mortes violentas sem intenção definida, {d.anoSim}</dt>
              <dd className="mt-1">
                {(uf ? uf.indeterminadas : d.brasil.indeterminadas) === null ? <span className="text-base text-marfim">Indisponível nesta publicação</span> : <><span className="numero-p text-marfim">{numero((uf ? uf.indeterminadas : d.brasil.indeterminadas) as number, 1)}%</span> <span className="text-sm text-mineral-soft">das mortes por causas externas</span></>}
              </dd>
            </div>
          </dl>
          <p className="mt-2 t-meta text-mineral-soft">Quanto maior a parcela sem intenção definida, menos o registro de saúde capta dos homicídios do estado.</p>
        </div>
      </div>

      <figure className="mt-10" aria-labelledby={`${id}-faixa`}>
        <figcaption id={`${id}-faixa`} className="text-sm text-marfim">
          As {comDado.length} UFs com dado em {d.ano}, por taxa de homicídio doloso <span className="text-mineral-soft">· cada ponto é uma UF; a posição não é nota</span>
        </figcaption>
        <div aria-hidden="true" className="relative mt-4 h-[104px]">
          <div className={`absolute inset-x-0 top-[8px] h-6`}>
            {uf?.taxa != null && (
              <span className="absolute -translate-x-1/2 whitespace-nowrap text-sm font-semibold text-marfim" style={{ left: `clamp(2rem, ${pos(uf.taxa)}, calc(100% - 2rem))` }}>
                {uf.sigla} {numero(uf.taxa, 1)}
              </span>
            )}
            {brasilEmCima && !uf && (
              <span className="absolute -translate-x-1/2 whitespace-nowrap text-sm text-mineral-soft" style={{ left: pos(d.brasil.taxa) }}>Brasil {numero(d.brasil.taxa, 1)}</span>
            )}
          </div>
          <div className="absolute inset-x-0 top-[48px] h-px bg-linha-escura" />
          <div className="absolute top-[34px] h-[30px] border-l-2 border-dashed border-mineral-soft" style={{ left: pos(d.brasil.taxa) }} />
          {comDado.map((u) => (
            <span
              key={u.sigla}
              className={`absolute top-[48px] -translate-x-1/2 -translate-y-1/2 rounded-full ${u.sigla === uf?.sigla ? "z-10 h-4 w-4 border-2 border-carvao bg-marfim ring-2 ring-marfim" : "h-2.5 w-2.5 bg-marfim/45"}`}
              style={{ left: pos(u.taxa) }}
            />
          ))}
          <div className="absolute inset-x-0 top-[70px] text-sm text-mineral-soft">
            <span className="absolute whitespace-nowrap" style={{ left: `max(0px, calc(${pos(menor.taxa)} - 0.5rem))` }}>
              {menor.sigla} {numero(menor.taxa, 1)}
            </span>
            {!brasilEmCima && (
              <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pos(d.brasil.taxa) }}>
                Brasil {numero(d.brasil.taxa, 1)}
              </span>
            )}
            <span className="absolute whitespace-nowrap" style={{ right: `max(0px, calc(100% - ${pos(maior.taxa)} - 0.5rem))` }}>
              {maior.sigla} {numero(maior.taxa, 1)}
            </span>
          </div>
        </div>
        <p className="t-meta text-mineral-soft">
          Escala de 0 a {numero(max, 0)} por 100 mil habitantes; a linha tracejada é o Brasil. {d.fonteSinesp}; polícias estaduais, UF onde o fato foi registrado. Taxa do SIM: {d.fonteSim}, UF de residência.
        </p>
      </figure>

      <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
        <BotaoLink href={destino} variant="dark">{uf ? `Comparar ${uf.sigla} com os outros estados` : "Comparar os estados"}</BotaoLink>
        <details className="group/ordem min-w-0 basis-full sm:basis-auto">
          <summary className="flex min-h-[44px] cursor-pointer items-center text-sm text-marfim underline decoration-mineral-soft underline-offset-4">As {comDado.length} UFs em ordem, com a taxa</summary>
          <ol className="mt-3 grid max-w-3xl gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {comDado.map((u) => (
              <li key={u.sigla} className={`flex items-baseline justify-between gap-3 border-b border-linha-escura py-1.5 text-sm ${u.sigla === uf?.sigla ? "font-semibold text-marfim" : "text-marfim"}`}>
                <span className="min-w-0"><span className="mr-2 inline-block w-6 text-right tabular-nums text-mineral-soft">{u.posicao}</span>{u.nome}</span>
                <span className="tabular-nums">{numero(u.taxa, 1)}</span>
              </li>
            ))}
          </ol>
          {d.ufs.some((u) => u.taxa === null) && <p className="mt-2 t-meta text-mineral-soft">Sem dado publicado em {d.ano}: {d.ufs.filter((u) => u.taxa === null).map((u) => u.nome).join(", ")}.</p>}
        </details>
      </div>
    </section>
  );
}
