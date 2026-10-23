"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ANO_CENSO_2010,
  ANO_CENSO_2022,
  ANO_PRAZO,
  PARAMETROS_SABESP,
  PUBLICADO_SABESP,
  anoCivil,
  receitaATarifa,
  ritmoAteMeta,
  variarSabesp,
} from "@/lib/saneamento/laboratorios";
import { numero, sinal } from "@/lib/saneamento/formato";

/**
 * Modelos didáticos do Observatório do Saneamento. As grandezas são escolhidas pela pessoa a partir de valores
 * publicados, e cada modelo diz o que deixa de fora. Controles nativos com rótulo visível, valor escrito ao lado e
 * alvo de 44 px; o resultado de cada mudança é anunciado por uma região viva; nenhuma informação depende só de cor.
 */

const bi = (milhoes: number) => `R$ ${numero(milhoes / 1000, 2)} bi`;

function Moldura({ id, titulo, rotulo, children }: { id: string; titulo: string; rotulo: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="space-y-5 border border-linha bg-papel p-4 sm:p-6" data-laboratorio={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`${id}-t`} className="font-serif text-xl text-carvao">
          {titulo}
        </h3>
        <span className="rotulo border border-dashed border-mineral px-2 py-0.5 text-xs text-carvao-muted">{rotulo}</span>
      </div>
      {children}
    </section>
  );
}

function Controle({
  rotulo,
  valor,
  texto,
  min,
  max,
  passo,
  onMudar,
  ajuda,
}: {
  rotulo: string;
  valor: number;
  /** Valor escrito ao lado do rótulo e lido pelo leitor de tela. */
  texto: string;
  min: number;
  max: number;
  passo: number;
  onMudar: (v: number) => void;
  ajuda?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 text-sm text-carvao">
        <span>{rotulo}</span>
        <span className="shrink-0 font-medium tabular-nums">{texto}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        aria-valuetext={texto}
        onChange={(e) => onMudar(Number(e.target.value))}
        className="block min-h-[44px] w-full accent-obee"
      />
      {ajuda && <p className="text-xs leading-relaxed text-carvao-muted">{ajuda}</p>}
    </div>
  );
}

function Opcoes<T extends string>({ rotulo, nome, opcoes, valor, onMudar }: { rotulo: string; nome: string; opcoes: readonly (readonly [T, string])[]; valor: T; onMudar: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap items-center gap-2">
      <span className="rotulo text-mineral">{rotulo}</span>
      {opcoes.map(([id, rot]) => (
        <label
          key={id}
          className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 text-sm ${
            valor === id ? "border-obee bg-obee-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted"
          }`}
        >
          <input type="radio" name={nome} value={id} checked={valor === id} onChange={() => onMudar(id)} className="accent-obee" />
          {rot}
        </label>
      ))}
    </div>
  );
}

function Cartao({ rotulo, valor, nota, destaque = false }: { rotulo: string; valor: ReactNode; nota?: ReactNode; destaque?: boolean }) {
  return (
    <div className={`border px-3 py-2 ${destaque ? "border-obee bg-obee-fundo" : "border-linha bg-superficie"}`}>
      <p className="text-xs text-carvao-muted">{rotulo}</p>
      <p className="mt-0.5 text-lg font-medium tabular-nums text-carvao">{valor}</p>
      {nota && <p className="mt-0.5 text-xs leading-relaxed text-carvao-muted">{nota}</p>}
    </div>
  );
}

function Botao({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-sm text-obee-dark underline-offset-4 hover:underline">
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ 1. da receita à tarifa */

const INICIAL_RECEITA = { custosPct: 0, basePct: 0, wacc: PARAMETROS_SABESP.wacc, volumePct: 0 };

/** Cores dos blocos da receita: identidade do bloco, nunca juízo. Cada bloco tem rótulo e valor escritos na legenda. */
const BLOCOS = [
  { id: "custos", rotulo: "Custos operacionais e outras despesas", cor: "var(--escala-seq-5)" },
  { id: "remuneracao", rotulo: "Remuneração do capital (WACC × base)", cor: "var(--escala-seq-3)" },
  { id: "depreciacao", rotulo: "Depreciação (quota de reintegração)", cor: "var(--cor-bronze)" },
  { id: "giro", rotulo: "Capital de giro", cor: "var(--cor-bronze-soft)" },
] as const;

/** Escala fixa da barra, em R$ milhões, para que a mudança de tamanho seja visível entre posições dos controles. */
const ESCALA_RECEITA = 40000;

export function LabReceitaTarifa() {
  const [v, setV] = useState(INICIAL_RECEITA);
  const p = useMemo(() => variarSabesp(v), [v]);
  const r = receitaATarifa(p);
  const pub = PUBLICADO_SABESP;
  const delta = r.tarifaMedia - pub.tarifaMediaBase;
  const deltaPct = (delta / pub.tarifaMediaBase) * 100;
  const pontoWacc = p.base / 100;
  const valores: Record<(typeof BLOCOS)[number]["id"], number> = { custos: p.custos, remuneracao: r.remuneracao, depreciacao: p.depreciacao, giro: p.capitalGiro };
  const publicado = v.custosPct === 0 && v.basePct === 0 && v.volumePct === 0 && v.wacc === PARAMETROS_SABESP.wacc;
  const pctTexto = (x: number) => (x === 0 ? "como publicado" : `${sinal(x, 0)}%`);

  return (
    <Moldura id="lab-receita-tarifa" titulo="Da receita à tarifa média: o 1º reajuste da Sabesp" rotulo="Modelo didático">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        O regulador soma o que reconhece como custo do serviço, inclusive a remuneração do capital investido, desconta outras receitas e divide pelo
        volume. Os controles partem dos valores que a ARSESP publicou para a Sabesp, com vigência em 1º de janeiro de 2026. Mude um bloco e veja quanto
        a tarifa média se move.
      </p>
      <div className="grid gap-6 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Controle
            rotulo="Custos operacionais e outras despesas"
            valor={v.custosPct}
            texto={pctTexto(v.custosPct)}
            min={-30}
            max={30}
            passo={1}
            onMudar={(x) => setV({ ...v, custosPct: x })}
            ajuda={<>Publicado {bi(PARAMETROS_SABESP.custos)}; no modelo, {bi(p.custos)} por ano.</>}
          />
          <Controle
            rotulo="Base de remuneração (ativos líquidos e outorga)"
            valor={v.basePct}
            texto={pctTexto(v.basePct)}
            min={-30}
            max={30}
            passo={1}
            onMudar={(x) => setV({ ...v, basePct: x })}
            ajuda={<>Publicado {bi(PARAMETROS_SABESP.base)}; no modelo, {bi(p.base)}.</>}
          />
          <Controle
            rotulo="Custo de capital (WACC real antes de impostos)"
            valor={v.wacc}
            texto={`${numero(v.wacc, 2)}%`}
            min={8}
            max={16}
            passo={0.01}
            onMudar={(x) => setV({ ...v, wacc: x })}
            ajuda={<>Fixado no contrato em {numero(PARAMETROS_SABESP.wacc, 2)}% para o 1º ciclo.</>}
          />
          <Controle
            rotulo="Volume medido"
            valor={v.volumePct}
            texto={pctTexto(v.volumePct)}
            min={-20}
            max={20}
            passo={1}
            onMudar={(x) => setV({ ...v, volumePct: x })}
            ajuda={<>Publicado {numero(PARAMETROS_SABESP.volume, 0)} milhões de m³; no modelo, {numero(p.volume, 0)}.</>}
          />
          {!publicado && <Botao onClick={() => setV(INICIAL_RECEITA)}>Voltar aos valores publicados</Botao>}
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Cartao
              destaque
              rotulo="Tarifa média no modelo"
              valor={`R$ ${numero(r.tarifaMedia, 4)}/m³`}
              nota={
                publicado ? (
                  <>Igual à tarifa média base publicada pela ARSESP.</>
                ) : (
                  <>
                    {sinal(delta, 4)} R$/m³ ({sinal(deltaPct, 1)}%) sobre a publicada, R$ {numero(pub.tarifaMediaBase, 4)}/m³.
                  </>
                )
              }
            />
            <Cartao
              rotulo="Receita requerida no modelo"
              valor={bi(r.receitaRequerida)}
              nota={<>Publicada: {bi(pub.receitaRequerida)} por ano, a preços de outubro de 2025.</>}
            />
          </div>

          <figure>
            <figcaption className="text-xs text-carvao-muted">Composição da receita requerida, R$ bilhões por ano (escala fixa até R$ 40 bi)</figcaption>
            <div className="mt-2 flex h-6 w-full bg-superficie" aria-hidden="true">
              {BLOCOS.map((b) => (
                <div
                  key={b.id}
                  className="h-full border-r-2 border-papel last:border-r-0"
                  style={{ width: `${(valores[b.id] / ESCALA_RECEITA) * 100}%`, background: b.cor }}
                />
              ))}
            </div>
            <ul className="mt-2 grid gap-x-6 gap-y-1 text-xs text-carvao sm:grid-cols-2">
              {BLOCOS.map((b) => (
                <li key={b.id} className="flex items-baseline gap-2">
                  <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0" style={{ background: b.cor }} />
                  <span className="flex-1">{b.rotulo}</span>
                  <span className="tabular-nums">{bi(valores[b.id])}</span>
                </li>
              ))}
            </ul>
          </figure>

          <ol className="space-y-1 border-t border-linha pt-3 text-sm text-carvao">
            <li className="flex justify-between gap-3">
              <span>Receita requerida</span>
              <span className="shrink-0 whitespace-nowrap tabular-nums">{bi(r.receitaRequerida)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>(−) Fator K e receitas complementares e adicionais</span>
              <span className="shrink-0 whitespace-nowrap tabular-nums">{bi(p.deducoes)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>÷ volume medido, milhões de m³</span>
              <span className="shrink-0 whitespace-nowrap tabular-nums">{numero(p.volume, 2)}</span>
            </li>
            <li className="flex justify-between gap-3 font-medium">
              <span>= tarifa média, R$/m³</span>
              <span className="shrink-0 whitespace-nowrap tabular-nums">{numero(r.tarifaMedia, 4)}</span>
            </li>
          </ol>

          <p aria-live="polite" className="text-sm leading-relaxed text-carvao">
            Com essa base, cada ponto percentual de custo de capital vale {bi(pontoWacc)} de receita por ano, ou R$ {numero(pontoWacc / p.volume, 4)} por
            m³.{" "}
            {publicado
              ? "Mexa nos controles para ver o efeito na conta."
              : `Se a variação de ${sinal(deltaPct, 1)}% fosse aplicada igualmente a todas as faixas da tabela, uma conta de R$ 100,00 (valor de exemplo) passaria a R$ ${numero(100 * (1 + deltaPct / 100), 2)}.`}
          </p>
        </div>
      </div>

      <div className="border-t border-dashed border-mineral pt-4 text-sm leading-relaxed text-carvao-muted">
        <p className="font-medium text-carvao">O que este modelo deixa de fora</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Os componentes financeiros, que levam a tarifa média base à tarifa de equilíbrio (saldo de {sinal(pub.componentesFinanceiros, 4)} R$/m³, para R${" "}
            {numero(pub.tarifaEquilibrio, 4)}/m³), e a escolha da tarifa aplicada: vale a menor entre a de equilíbrio e a tabela do contrato corrigida.
          </li>
          <li>
            Efeitos de segunda ordem: a depreciação e o capital de giro ficam nos valores publicados quando a base muda, e a inadimplência regulatória (1,65% no
            1º ciclo) fica dentro dos custos sem acompanhar a receita.
          </li>
          <li>Fator X, Fator U e Fator Q do contrato.</li>
          <li>
            A estrutura tarifária: categorias, faixas, tarifa social e subsídio cruzado decidem quanto cada usuário paga. A tarifa média não é o preço do seu
            metro cúbico; a conta de cada tabela está no simulador (5.1).
          </li>
        </ul>
        <p className="mt-3 text-xs">
          Fonte: ARSESP, Nota Técnica do 1º reajuste, Tarifa de Equilíbrio (PDF p.56), e Contrato de Concessão 01/2024, Anexo VIII. Custos somam OPEX,
          outras despesas e receitas irrecuperáveis; a base soma a base de remuneração líquida e a outorga líquida. Com os valores publicados, o modelo
          reproduz a receita requerida e a tarifa média base da nota técnica. Outros reguladores usam outro método: a AGEPAR, por exemplo, desconta fluxos
          de caixa do ciclo (5.2).
        </p>
      </div>
    </Moldura>
  );
}

/* ------------------------------------------------------------------ 2. ritmo até a meta */

export type TerritorioRitmo = {
  id: string;
  nome: string;
  grupo: "Brasil e regiões" | "Unidades da Federação";
  agua: { v2010: number; v2022: number } | null;
  esgoto: { v2010: number; v2022: number } | null;
};

type Servico = "esgoto" | "agua";

const ROTULO_SERVICO: Record<Servico, string> = {
  esgoto: "Esgoto: rede geral ou pluvial",
  agua: "Água: rede geral como forma principal",
};

/** Geometria do gráfico. A largura é a medida na tela (uma unidade do viewBox = 1 px), para o texto não encolher no celular. */
const G = { h: 256, esq: 38, dir: 74, topo: 22, base: 30, x0: 2010, x1: 2034 };
const gy = (v: number) => G.topo + (1 - v / 100) * (G.h - G.topo - G.base);
/** Além deste ano, a extrapolação linear não informa nada; a frase diz só que a meta fica para depois. */
const ANO_LIMITE_FRASE = 2100;

/** Largura em px do elemento, acompanhada por ResizeObserver; `inicial` vale na renderização do servidor. */
function useLargura(inicial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura] as const;
}

export function LabRitmoMeta({ territorios, metas }: { territorios: TerritorioRitmo[]; metas: { agua: number; esgoto: number } }) {
  const idSelect = useId();
  const [refGrafico, w] = useLargura(420);
  const gx = (ano: number) => G.esq + ((ano - G.x0) / (G.x1 - G.x0)) * (w - G.esq - G.dir);
  const [tid, setTid] = useState(territorios[0]?.id ?? "BR");
  const [servico, setServico] = useState<Servico>("esgoto");
  const t = territorios.find((x) => x.id === tid) ?? territorios[0];
  const serie = t?.[servico] ?? null;
  const meta = metas[servico];
  const base = serie ? ritmoAteMeta({ ...serie, meta }, 0) : null;
  // Ritmos exatos, sem arredondar: o botão do ritmo exigido tem de chegar à meta no prazo (o controle só exibe duas casas).
  const inicial = base ? Math.max(0, base.observado) : 0;
  const [ritmo, setRitmo] = useState(inicial);
  const [chave, setChave] = useState(`${tid}:${servico}`);
  // Troca de território ou serviço volta o ritmo ao observado (estado derivado na renderização, sem efeito).
  if (chave !== `${tid}:${servico}`) {
    setChave(`${tid}:${servico}`);
    setRitmo(inicial);
  }
  if (!t || !serie || !base) return null;
  const r = ritmoAteMeta({ ...serie, meta }, ritmo);
  const max = Math.max(3, Math.ceil(base.exigido * 1.25));
  const anoMeta = r.anoMeta == null ? null : anoCivil(r.anoMeta);
  // Se o ritmo escolhido chega a 100% antes do prazo, a linha para em 100% e segue reta.
  const fimProjecao = ritmo > 0 && serie.v2022 + ritmo * (ANO_PRAZO - ANO_CENSO_2022) > 100 ? ANO_CENSO_2022 + (100 - serie.v2022) / ritmo : ANO_PRAZO;
  // Rótulos à direita do prazo: valor projetado e meta. Colados (menos de 16 px), o maior vai acima e o outro abaixo.
  const yEm = gy(r.em2033);
  const yMeta = gy(meta);
  const colados = Math.abs(yEm - yMeta) < 16;
  const emAcima = r.em2033 >= meta;
  const rotuloEm = colados ? (emAcima ? Math.min(yEm, yMeta) - 6 : Math.max(yEm, yMeta) + 16) : yEm + 4;
  const rotuloMeta = colados ? (emAcima ? Math.max(yEm, yMeta) + 16 : Math.min(yEm, yMeta) - 6) : yMeta + 4;
  const ufs = territorios.filter((x) => x.grupo === "Unidades da Federação");
  const regioes = territorios.filter((x) => x.grupo === "Brasil e regiões");

  return (
    <Moldura id="lab-ritmo-meta" titulo="Que ritmo leva à meta?" rotulo="Modelo didático · projeção aritmética">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        Escolha um território e um serviço. A linha cheia liga os Censos de 2010 e 2022, medidos da mesma forma; a tracejada prolonga, a partir de 2022,
        o ritmo que você escolher. O ritmo começa no observado entre os Censos.
      </p>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="space-y-1">
          <label htmlFor={idSelect} className="rotulo block text-mineral">
            Território
          </label>
          <select
            id={idSelect}
            value={tid}
            onChange={(e) => setTid(e.target.value)}
            className="min-h-[44px] border border-linha bg-superficie px-3 text-sm text-carvao"
          >
            <optgroup label="Brasil e regiões">
              {regioes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome}
                </option>
              ))}
            </optgroup>
            <optgroup label="Unidades da Federação">
              {ufs.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <Opcoes
          rotulo="Serviço"
          nome="lab-ritmo-servico"
          opcoes={[
            ["esgoto", ROTULO_SERVICO.esgoto],
            ["agua", ROTULO_SERVICO.agua],
          ]}
          valor={servico}
          onMudar={setServico}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
        <figure className="max-w-[40rem]">
          <div ref={refGrafico}>
            <svg viewBox={`0 0 ${w} ${G.h}`} width="100%" height={G.h} role="img" aria-labelledby="lab-ritmo-desc">
              <desc id="lab-ritmo-desc">
                {`${t.nome}, ${ROTULO_SERVICO[servico].toLowerCase()}: ${numero(serie.v2010, 1)}% em 2010 e ${numero(serie.v2022, 1)}% em 2022. No ritmo de ${numero(ritmo, 2)} pontos por ano, ${numero(r.em2033, 1)}% no fim de 2033; meta de ${meta}%.`}
              </desc>
              {[0, 25, 50, 75, 100].map((v) => (
                <g key={v}>
                  <line x1={G.esq} x2={w - G.dir} y1={gy(v)} y2={gy(v)} stroke="var(--cor-linha)" strokeWidth={1} />
                  <text x={G.esq - 6} y={gy(v) + 4} textAnchor="end" fontSize={12} fill="var(--cor-carvao-muted)">
                    {v}%
                  </text>
                </g>
              ))}
              {[2010, 2014, 2018, 2022, 2026].map((a) => (
                <text key={a} x={gx(a)} y={G.h - G.base + 16} textAnchor="middle" fontSize={12} fill="var(--cor-carvao-muted)">
                  {a}
                </text>
              ))}
              <line x1={gx(ANO_PRAZO)} x2={gx(ANO_PRAZO)} y1={G.topo} y2={G.h - G.base} stroke="var(--cor-carvao-muted)" strokeWidth={1} />
              <text x={gx(ANO_PRAZO)} y={G.h - G.base + 16} textAnchor="middle" fontSize={12} fill="var(--cor-carvao)">
                fim de 2033
              </text>
              {/* meta */}
              <line x1={G.esq} x2={gx(ANO_PRAZO)} y1={gy(meta)} y2={gy(meta)} stroke="var(--cor-carvao)" strokeWidth={1} strokeDasharray="2 3" />
              <text x={gx(ANO_PRAZO) + 6} y={rotuloMeta} fontSize={13} fill="var(--cor-carvao)">
                meta {meta}%
              </text>
              {/* ritmo exigido */}
              {base.exigido > 0 && (
                <line
                  x1={gx(ANO_CENSO_2022)}
                  y1={gy(serie.v2022)}
                  x2={gx(ANO_PRAZO)}
                  y2={gy(meta)}
                  stroke="var(--cor-bronze)"
                  strokeWidth={2}
                  strokeDasharray="1 4"
                  strokeLinecap="round"
                />
              )}
              {/* observado entre os Censos */}
              <line x1={gx(ANO_CENSO_2010)} y1={gy(serie.v2010)} x2={gx(ANO_CENSO_2022)} y2={gy(serie.v2022)} stroke="var(--cor-obee)" strokeWidth={2.5} />
              {/* ritmo escolhido */}
              <line
                x1={gx(ANO_CENSO_2022)}
                y1={gy(serie.v2022)}
                x2={gx(fimProjecao)}
                y2={gy(fimProjecao === ANO_PRAZO ? r.em2033 : 100)}
                stroke="var(--cor-obee)"
                strokeWidth={2.5}
                strokeDasharray="7 5"
              />
              {fimProjecao < ANO_PRAZO && (
                <line x1={gx(fimProjecao)} y1={gy(100)} x2={gx(ANO_PRAZO)} y2={gy(100)} stroke="var(--cor-obee)" strokeWidth={2.5} strokeDasharray="7 5" />
              )}
              {[
                [ANO_CENSO_2010, serie.v2010],
                [ANO_CENSO_2022, serie.v2022],
              ].map(([a, v]) => (
                <g key={a}>
                  <circle cx={gx(a)} cy={gy(v)} r={5} fill="var(--cor-obee)" stroke="var(--cor-papel)" strokeWidth={2} />
                  <text x={gx(a)} y={gy(v) + (v > 85 ? 18 : -10)} textAnchor="middle" fontSize={13} fill="var(--cor-carvao)">
                    {numero(v, 1)}%
                  </text>
                </g>
              ))}
              <circle cx={gx(ANO_PRAZO)} cy={gy(r.em2033)} r={5} fill="var(--cor-papel)" stroke="var(--cor-obee)" strokeWidth={2.5} />
              <text
                x={gx(ANO_PRAZO) + 6}
                y={rotuloEm}
                fontSize={13}
                fontWeight={600}
                fill="var(--cor-carvao)"
              >
                {numero(r.em2033, 1)}%
              </text>
            </svg>
          </div>
          <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-carvao">
            <span className="inline-flex items-center gap-2">
              <svg width="26" height="8" aria-hidden="true">
                <line x1="1" x2="25" y1="4" y2="4" stroke="var(--cor-obee)" strokeWidth="2.5" />
              </svg>
              Censos 2010 e 2022
            </span>
            <span className="inline-flex items-center gap-2">
              <svg width="26" height="8" aria-hidden="true">
                <line x1="1" x2="25" y1="4" y2="4" stroke="var(--cor-obee)" strokeWidth="2.5" strokeDasharray="7 5" />
              </svg>
              Ritmo escolhido
            </span>
            <span className="inline-flex items-center gap-2">
              <svg width="26" height="8" aria-hidden="true">
                <line x1="2" x2="25" y1="4" y2="4" stroke="var(--cor-bronze)" strokeWidth="2" strokeDasharray="1 4" strokeLinecap="round" />
              </svg>
              Ritmo exigido pela meta
            </span>
          </figcaption>
        </figure>

        <div className="space-y-3">
          <Controle
            rotulo="Ritmo a partir de agosto de 2022"
            valor={ritmo}
            texto={`${numero(ritmo, 2)} p.p. por ano`}
            min={0}
            max={max}
            passo={0.01}
            onMudar={setRitmo}
          />
          <div className="flex flex-wrap gap-2">
            <Botao onClick={() => setRitmo(inicial)}>Usar o ritmo observado</Botao>
            {base.exigido > 0 && <Botao onClick={() => setRitmo(base.exigido)}>Usar o ritmo exigido</Botao>}
          </div>
          <Cartao
            rotulo="Ritmo observado, 2010 a 2022"
            valor={`${sinal(base.observado, 2)} p.p./ano`}
            nota={base.observado <= 0 ? "A parcela caiu ou ficou estável entre os Censos; o controle parte de zero." : undefined}
          />
          <Cartao
            rotulo={`Ritmo exigido para ${meta}% até o fim de 2033`}
            valor={base.exigido > 0 ? `${numero(base.exigido, 2)} p.p./ano` : "já na meta nesta régua"}
            nota={base.razao != null ? `${numero(base.razao, 1)} vezes o observado` : undefined}
          />
          <Cartao
            destaque
            rotulo="No ritmo escolhido"
            valor={`${numero(r.em2033, 1)}% no fim de 2033`}
            nota={
              <span aria-live="polite">
                {anoMeta == null
                  ? "Com ritmo zero, a meta não é alcançada."
                  : base.exigido === 0
                    ? "A parcela já estava na meta em 2022."
                    : anoMeta > ANO_LIMITE_FRASE
                      ? `Neste ritmo, a meta de ${meta}% não seria alcançada antes de ${ANO_LIMITE_FRASE}.`
                      : `A meta de ${meta}% seria alcançada em ${anoMeta}${anoMeta > 2033 ? `, ${anoMeta - 2033} ano${anoMeta - 2033 > 1 ? "s" : ""} depois do prazo` : ", dentro do prazo"}.`}
              </span>
            }
          />
        </div>
      </div>

      <div className="border-t border-dashed border-mineral pt-4 text-sm leading-relaxed text-carvao-muted">
        <p className="font-medium text-carvao">O que este modelo deixa de fora</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            A régua não é a da meta legal. O Censo conta moradores com rede geral como forma principal de abastecimento e com esgoto ligado à rede geral ou
            pluvial. A meta é aferida pela NR ANA 8/2024 em domicílios, aceita soluções alternativas previstas pelo regulador e, no esgoto, exige tratamento,
            que o Censo não mede. Chegar à meta nesta régua não equivale a cumprir a lei, e ficar abaixo dela não equivale a descumpri-la.
          </li>
          <li>Ritmo constante e linear: o modelo não considera crescimento da população, obras contratadas, mudança de política nem saturação perto de 100%.</li>
          <li>A tabela desta página usa o indicador oficial do SINISA de 2024; o laboratório usa o Censo, a única medida igual nas duas pontas. Os ritmos das duas não se substituem.</li>
        </ul>
        <p className="mt-3 text-xs">
          Fonte: IBGE, Censos Demográficos 2010 e 2022 (data de referência em 1º de agosto), moradores em domicílios particulares permanentes ocupados; Lei
          11.445/2007, art. 11-B. Observado = (2022 − 2010) ÷ 12 anos; exigido = (meta − 2022) ÷ 11,4 anos, de agosto de 2022 a 31/12/2033.
        </p>
      </div>
    </Moldura>
  );
}
