"use client";

import type { ReactNode } from "react";
import { dataBR, num } from "@/lib/energia/formato";
import {
  ehSemSinalPerdas,
  motivoLegivel,
  nomeSm,
  rotulosEstadoSm,
  rotulosVinculo,
  semRegistroDaBase,
  linksDistribuidora,
  linksMunicipio,
  inteiro,
  numTexto,
  potenciaUsina,
  respostaDistribuidora,
  respostaMunicipio,
  respostaSubmercado,
  respostaUf,
  respostaUsina,
  textoDefasagem,
  textoDescontoLiquido,
  textoReferencia,
  type ChaveFonte,
  type DadosExplorador,
  type IndiceDistribuidoras,
  type LinhaConjunto,
  type LinhaDistribuidora,
  type LinhaSubmercado,
  type LinhaUf,
  type MunicipioT,
  type Selecao,
  type UsinaT,
} from "@/lib/energia/territorio";
import type { IdGraoTerritorio, LinkModulo } from "@/lib/energia/tipos-territorio";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { OUTORGA_SIGA_EN, rotuloDado } from "@/lib/energia/i18n/expansao-transicao-territorio";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * Ficha da entidade escolhida na página Minha região (P002). A regra do critério de
 * aceite fica visível aqui: cada número aparece debaixo do cabeçalho do seu grão, com
 * o rótulo que a gold publica para ele no município ("da distribuidora que atende o
 * município, valor da área inteira da distribuidora, não do município"). Ausência
 * aparece com o motivo publicado, nunca como zero; fonte com mês antigo traz a
 * defasagem escrita.
 */

/**
 * Frase gerada em inglês que cita nomes próprios em português (usinas, municípios): cada ocorrência de um dos nomes sai marcada
 * como nome próprio. Em português, o texto puro.
 */
export function ComNomes({ texto, nomes }: { texto: string; nomes: readonly string[] }) {
  const idioma = useIdioma();
  const validos = nomes.filter(Boolean);
  if (idioma !== "en" || !validos.length) return <>{texto}</>;
  const escapa = (n: string) => n.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
  const re = new RegExp("(" + validos.map(escapa).join("|") + ")", "g");
  return (
    <>
      {texto.split(re).map((parte, i) => (validos.includes(parte) ? <Nome key={i}>{parte}</Nome> : parte))}
    </>
  );
}

const LINK = "inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";
const BOTAO_LINK = "inline-flex min-h-[44px] items-center text-left text-energia-dark underline underline-offset-4 hover:text-carvao focus:outline-none focus-visible:ring-2 focus-visible:ring-energia";

/**
 * Bloco de um grão. Na ficha do município, o rótulo publicado pela gold diz de quem é o
 * valor ("da distribuidora que atende o município, valor da área inteira"); nas fichas
 * das outras entidades, `nota` substitui esse rótulo.
 */
function Grao({ grao, titulo, dados, children, id, nota }: { grao: IdGraoTerritorio; titulo?: string; dados: DadosExplorador; children: ReactNode; id?: string; nota?: string }) {
  const tx = useTx();
  const g = dados.graos.find((x) => x.id === grao);
  return (
    <section className="border-t border-linha pt-3" data-grao={grao} id={id}>
      <h4 className="text-sm font-medium text-carvao">{titulo ?? g?.rotulo ?? grao}</h4>
      {nota ? (
        <p className="mt-0.5 text-xs text-carvao-muted">{nota}</p>
      ) : (
        g && <p className="mt-0.5 text-xs text-carvao-muted">{tx(`Valor ${g.rotulo_no_municipio}.`, `Value ${g.rotulo_no_municipio}.`)}</p>
      )}
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function Item({ rotulo, valor, detalhe }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode }) {
  return (
    // Rótulo e valor ficam um sobre o outro abaixo de 640 px e na coluna estreita da ficha (24 rem, a partir de 1024 px); entre 640 e 1023 px, em duas colunas
    // com largura mínima para o rótulo e quebra no valor: uma coluna "auto" deixava o valor longo ("sem dado: incorporada por...") tomar a linha e o rótulo
    // escrever por cima dele.
    <div className="grid grid-cols-1 gap-y-0.5 text-sm sm:grid-cols-[minmax(8rem,2fr)_minmax(0,3fr)] sm:gap-x-3 lg:grid-cols-1">
      <dt className="min-w-0 text-carvao-muted [overflow-wrap:normal] [word-break:normal] hyphens-none">{rotulo}</dt>
      <dd className="min-w-0 tabular-nums text-carvao [overflow-wrap:anywhere] sm:text-right lg:text-left">{valor}</dd>
      {detalhe && <dd className="min-w-0 text-xs text-carvao-muted [overflow-wrap:anywhere] sm:col-span-2 lg:col-span-1">{detalhe}</dd>}
    </div>
  );
}

function Fonte({ dados, chave, extra }: { dados: DadosExplorador; chave: ChaveFonte; extra?: string | null }) {
  const tx = useTx();
  const f = dados.fontes[chave];
  if (!f) return null;
  return (
    <p className="text-xs text-mineral">
      {tx(
        <>
          Fonte: {f.orgao}, {f.conjunto}; referência {f.periodo}.{extra ? ` ${extra}.` : ""}
        </>,
        <>
          Source: {f.orgao}, <Nome>{f.conjunto}</Nome>; reference {f.periodo}.{extra ? ` ${extra}.` : ""}
        </>,
      )}
    </p>
  );
}

/** Motivo de ausência publicado pela gold (texto em português): na página inglesa, marcado como trecho só em português. */
function Motivo({ texto }: { texto: string }) {
  return <TrechoPortugues regiao="territorio-motivo">{motivoLegivel(texto)}</TrechoPortugues>;
}

function Ausente({ motivo }: { motivo: string | null }) {
  const tx = useTx();
  return (
    <span className="inline-flex max-w-full items-start gap-1.5 text-left text-carvao-muted">
      <span aria-hidden="true" className="mt-1 inline-block h-3 w-3 shrink-0 border border-mineral" style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--cor-mineral) 0 1px, transparent 1px 4px)" }} />
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {tx("sem dado", "no data")}
        {motivo ? (
          <>
            {": "}
            <Motivo texto={motivo} />
          </>
        ) : (
          ""
        )}
      </span>
    </span>
  );
}

function valorOu(v: number | null | undefined, casas: number, unidade: string, motivo: string | null = null, idioma: "pt" | "en" = "pt"): ReactNode {
  // percentual colado ao número, como no resto do observatório; demais unidades com espaço
  return v === null || v === undefined ? <Ausente motivo={motivo} /> : `${num(v, casas, idioma)}${unidade === "%" ? "%" : unidade ? ` ${unidade}` : ""}`;
}

function Links({ itens, titulo }: { itens: LinkModulo[]; titulo?: string }) {
  const tx = useTx();
  if (!itens.length) return null;
  return (
    <div>
      <p className="rotulo text-mineral">{titulo ?? tx("Na página de origem", "On the source page")}</p>
      <ul className="flex flex-wrap gap-x-4 text-sm">
        {itens.map((l) => (
          <li key={l.href}>
            <a href={l.href} className={LINK}>
              {l.rotulo}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cabeçalho da ficha: o título recebe o foco quando a escolha muda (tabIndex -1), e a ação (limpar a escolha) fica junto dele. */
function Cabeca({ rotulo, nome, resposta, tipo, acao }: { rotulo: string; nome: ReactNode; resposta: string; tipo: string; acao?: ReactNode }) {
  return (
    <header>
      <p className="rotulo text-mineral">{rotulo}</p>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0">
        <h3 tabIndex={-1} data-foco-ficha="" className="mt-1 font-serif text-xl leading-snug text-carvao focus:outline-none focus-visible:ring-2 focus-visible:ring-energia">
          {nome}
        </h3>
        {acao}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-carvao" data-resposta-ficha={tipo}>
        {resposta}
      </p>
    </header>
  );
}

/* ---------------------------------------------------------------- distribuidora (blocos) */

export function BlocosDistribuidora({ d, dados, compacto = false }: { d: LinhaDistribuidora; dados: DadosExplorador; compacto?: boolean }) {
  const tx = useTx();
  const idioma = useIdioma();
  const defTsee = textoDefasagem(d.tsee_ref, dados.dataReferencia, idioma);
  const comBase = d.perdas_base && d.perdas_base !== semRegistroDaBase(idioma);
  const sinalizada = d.perdas_sinal && !ehSemSinalPerdas(d.perdas_sinal);
  const detalhePerdasPt =
    [
      d.perdas_pct_pub !== null ? `sobre a energia injetada publicada seria ${num(d.perdas_pct_pub, 2)}%` : null,
      d.perdas_ressalvas ?? (sinalizada ? `taxa sinalizada pelo módulo Perdas (${d.perdas_sinal}): fica fora das comparações entre distribuidoras` : null),
    ]
      .filter(Boolean)
      .join(". ") || undefined;
  const publicadaEn = d.perdas_pct_pub !== null ? `over the published injected energy it would be ${num(d.perdas_pct_pub, 2, idioma)}%` : null;
  const detalhePerdasEn: ReactNode =
    publicadaEn || d.perdas_ressalvas || sinalizada ? (
      <>
        {publicadaEn}
        {publicadaEn && (d.perdas_ressalvas || sinalizada) ? ". " : ""}
        {d.perdas_ressalvas ? (
          <TrechoPortugues regiao="territorio-ressalva-perdas">{d.perdas_ressalvas}</TrechoPortugues>
        ) : sinalizada ? (
          `rate flagged by the Losses module (${d.perdas_sinal}): it is left out of comparisons between distribution utilities`
        ) : null}
      </>
    ) : undefined;
  const sd = tx("sem data", "no date");
  return (
    <>
    <dl className="space-y-2">
      <Item
        rotulo={tx(
          `Perdas totais${comBase ? ` sobre ${d.perdas_base}` : ""}${d.perdas_ano ? ` (${d.perdas_ano})` : ""}`,
          `Total losses${comBase ? ` over ${d.perdas_base}` : ""}${d.perdas_ano ? ` (${d.perdas_ano})` : ""}`,
        )}
        valor={valorOu(d.perdas_pct, 2, "%", d.perdas_motivo, idioma)}
        detalhe={tx<ReactNode>(detalhePerdasPt, detalhePerdasEn)}
      />
      <Item
        rotulo={tx(`DEC e FEC${d.qual_ano ? ` (${d.qual_ano})` : ""}`, `DEC and FEC${d.qual_ano ? ` (${d.qual_ano})` : ""}`)}
        valor={
          d.dec_h === null ? (
            <Ausente motivo={d.qual_motivo} />
          ) : (
            tx(`${num(d.dec_h, 2)} h; ${numTexto(d.fec, 2)} interrupções`, `${num(d.dec_h, 2, idioma)} h; ${numTexto(d.fec, 2, idioma)} interruptions`)
          )
        }
        detalhe={
          d.dec_h === null
            ? undefined
            : tx(
                `limites: ${numTexto(d.dec_lim_h, 2)} h e ${numTexto(d.fec_lim, 2)} interrupções`,
                `limits: ${numTexto(d.dec_lim_h, 2, idioma)} h and ${numTexto(d.fec_lim, 2, idioma)} interruptions`,
              )
        }
      />
      <Item
        rotulo={tx("Tarifa B1 residencial (TE + TUSD, sem tributos)", "Residential B1 tariff (TE + TUSD, before taxes)")}
        valor={valorOu(d.tarifa, 2, "R$/MWh", d.tarifa_motivo, idioma)}
        detalhe={
          d.tarifa === null
            ? undefined
            : tx(
                `${num(d.tarifa / 1000, 4)} R$/kWh, a unidade da conta de luz; TE ${numTexto(d.te, 2)} e TUSD ${numTexto(d.tusd, 2)} R$/MWh; ${d.tarifa_ato ?? "ato sem número"}, vigência ${d.tarifa_vigencia ?? "sem data"}`,
                `${num(d.tarifa / 1000, 4, idioma)} R$/kWh, the unit of the electricity bill; TE ${numTexto(d.te, 2, idioma)} and TUSD ${numTexto(d.tusd, 2, idioma)} R$/MWh; ${d.tarifa_ato ?? "act without a number"}, valid ${d.tarifa_vigencia ?? sd}`,
              )
        }
      />
      <Item
        rotulo={tx("MMGD cadastrada na distribuidora", "MMGD registered with the distribution utility")}
        valor={
          d.mmgd_un === null ? (
            <Ausente motivo={d.mmgd_motivo} />
          ) : (
            tx(`${inteiro(d.mmgd_un)} unidades; ${numTexto(d.mmgd_mw, 1)} MW`, `${inteiro(d.mmgd_un, idioma)} units; ${numTexto(d.mmgd_mw, 1, idioma)} MW`)
          )
        }
        detalhe={d.mmgd_ref ? tx(`cadastro de ${dataBR(d.mmgd_ref)}`, `register of ${dataBR(d.mmgd_ref, idioma)}`) : undefined}
      />
      <Item
        rotulo={tx("Residenciais com Tarifa Social", "Residential customers with the Social Tariff")}
        valor={
          d.tsee_pct === null ? (
            <Ausente motivo={d.tsee_motivo} />
          ) : (
            tx(`${num(d.tsee_pct, 2)}% (${inteiro(d.tsee_uc)} unidades)`, `${num(d.tsee_pct, 2, idioma)}% (${inteiro(d.tsee_uc, idioma)} units)`)
          )
        }
        detalhe={
          d.tsee_ref
            ? tx(
                `referência ${textoReferencia(d.tsee_ref)}${defTsee ? `; ${defTsee}` : ""}`,
                `reference ${textoReferencia(d.tsee_ref, idioma)}${defTsee ? `; ${defTsee}` : ""}`,
              )
            : undefined
        }
      />
    </dl>
    {!compacto && (
      <p className="mt-2 text-xs text-mineral">
        {tx(
          "Fontes: ANEEL (SAMP Balanço, Indicadores de Continuidade, Tarifas de aplicação, Relação de MMGD, SCS), pelos módulos Perdas, Qualidade, Conta de luz, Transição e Inclusão.",
          "Sources: ANEEL (SAMP Balance, Continuity Indicators, Applied Tariffs, MMGD List, SCS), through the Losses, Quality, Electricity Bill, Transition and Inclusion modules.",
        )}
      </p>
    )}
    </>
  );
}

/* ---------------------------------------------------------------- submercado e UF (blocos) */

export function BlocosSubmercado({ s, dados }: { s: LinhaSubmercado; dados: DadosExplorador }) {
  const tx = useTx();
  const idioma = useIdioma();
  const def = textoDefasagem(s.mmgd_ons_ref, dados.dataReferencia, idioma);
  return (
    <>
    <dl className="space-y-2">
      <Item
        rotulo={tx(`PLD médio do dia${s.pld_dia_ref ? ` (${dataBR(s.pld_dia_ref)})` : ""}`, `Average PLD of the day${s.pld_dia_ref ? ` (${dataBR(s.pld_dia_ref, idioma)})` : ""}`)}
        valor={valorOu(s.pld_dia, 2, "R$/MWh", s.pld_dia_motivo, idioma)}
        detalhe={tx("média das 24 horas, não ponderada pela carga", "average of the 24 hours, not weighted by load")}
      />
      <Item
        rotulo={tx(
          `PLD médio do mês${s.pld_mes_ref ? ` (${textoReferencia(s.pld_mes_ref)})` : ""}`,
          `Average PLD of the month${s.pld_mes_ref ? ` (${textoReferencia(s.pld_mes_ref, idioma)})` : ""}`,
        )}
        valor={valorOu(s.pld_mes, 2, "R$/MWh", s.pld_mes_motivo, idioma)}
        detalhe={s.pld_mes_dias ? tx(`${inteiro(s.pld_mes_dias)} dias publicados`, `${inteiro(s.pld_mes_dias, idioma)} days published`) : undefined}
      />
      <Item
        rotulo={tx(`Energia armazenada${s.ear_ref ? ` (${dataBR(s.ear_ref)})` : ""}`, `Stored energy${s.ear_ref ? ` (${dataBR(s.ear_ref, idioma)})` : ""}`)}
        valor={valorOu(s.ear_pct, 1, tx("% da máxima", "% of the maximum"), s.ear_motivo, idioma)}
        detalhe={
          s.ear_mwmes === null
            ? undefined
            : tx(`${numTexto(s.ear_mwmes, 0)} de ${numTexto(s.ear_max_mwmes, 0)} MWmês`, `${numTexto(s.ear_mwmes, 0, idioma)} of ${numTexto(s.ear_max_mwmes, 0, idioma)} MWmonth`)
        }
      />
      <Item
        rotulo={tx(
          `Carga atendida por MMGD, estimativa do ONS${s.mmgd_ons_ref ? ` (${textoReferencia(s.mmgd_ons_ref)})` : ""}`,
          `Load served by MMGD, ONS estimate${s.mmgd_ons_ref ? ` (${textoReferencia(s.mmgd_ons_ref, idioma)})` : ""}`,
        )}
        valor={valorOu(s.mmgd_ons, 0, tx("MWmed", "MWavg"), s.mmgd_ons_motivo, idioma)}
        detalhe={def ?? tx("estimada pelo ONS, não medida", "estimated by the ONS, not measured")}
      />
    </dl>
    <Fonte dados={dados} chave="pld_dia" />
    <Fonte dados={dados} chave="ear" />
    </>
  );
}

export function BlocosUf({ u, dados }: { u: LinhaUf; dados: DadosExplorador }) {
  const tx = useTx();
  const idioma = useIdioma();
  const n = (v: number | null | undefined) => inteiro(v, idioma);
  const def = textoDefasagem(u.tsee_ref, dados.dataReferencia, idioma);
  const liquido = textoDescontoLiquido(u.tsee_desconto, idioma);
  const umReg = u.cap_registros === 1;
  const registros = u.cap_registros
    ? tx(`; mais ${n(u.cap_registros)} ${umReg ? "registro" : "registros"} de até 10 kW, à parte`, `; plus ${n(u.cap_registros)} ${umReg ? "registration" : "registrations"} of up to 10 kW, counted separately`)
    : "";
  const multi = u.cap_multimunicipio
    ? tx(` e ${n(u.cap_multimunicipio)} em mais de um município ou sem município reconhecido`, ` and ${n(u.cap_multimunicipio)} in more than one municipality or with no recognized municipality`)
    : "";
  const reconcilia =
    u.cap_usinas !== null && u.cap_um_municipio !== null && u.cap_multimunicipio !== null
      ? tx(
          `${n(u.cap_um_municipio)} declaradas em um só município (as que a soma dos municípios conta)${multi}`,
          `${n(u.cap_um_municipio)} declared in a single municipality (the ones the sum of the municipalities counts)${multi}`,
        )
      : null;
  return (
    <dl className="space-y-2">
      <Item
        rotulo={tx("Capacidade em operação (UF principal da usina)", "Capacity in operation (plant's main state)")}
        valor={
          u.cap_mw === null ? (
            <Ausente motivo={u.cap_motivo} />
          ) : (
            tx(
              `${num(u.cap_mw, 1)} MW${u.cap_usinas === null ? "" : ` (${n(u.cap_usinas)} usinas${registros})`}`,
              `${num(u.cap_mw, 1, idioma)} MW${u.cap_usinas === null ? "" : ` (${n(u.cap_usinas)} plants${registros})`}`,
            )
          )
        }
        detalhe={
          [u.cap_origem, reconcilia, dados.notaMultiestadual].filter(Boolean).join(". ") ? (
            <ComNomes texto={[u.cap_origem, reconcilia, dados.notaMultiestadual].filter(Boolean).join(". ")} nomes={dados.nomesMultiestadual} />
          ) : undefined
        }
      />
      <Item
        rotulo={tx(
          `Faturas com Tarifa Social${u.tsee_ref ? ` (${textoReferencia(u.tsee_ref)})` : ""}`,
          `Bills with the Social Tariff${u.tsee_ref ? ` (${textoReferencia(u.tsee_ref, idioma)})` : ""}`,
        )}
        valor={valorOu(u.tsee_faturas, 0, tx("faturas", "bills"), u.tsee_motivo, idioma)}
        detalhe={tx("contagem de faturas do mês; cancelamentos e refaturamentos não entram nela", "count of the month's bills; cancellations and rebillings do not enter it")}
      />
      <Item
        rotulo={tx(
          `Desconto líquido da Tarifa Social${u.tsee_ref ? ` (${textoReferencia(u.tsee_ref)})` : ""}`,
          `Net Social Tariff discount${u.tsee_ref ? ` (${textoReferencia(u.tsee_ref, idioma)})` : ""}`,
        )}
        valor={u.tsee_desconto === null ? <Ausente motivo={u.tsee_motivo} /> : `R$ ${num(u.tsee_desconto, 2, idioma)}`}
        detalhe={[liquido, def].filter(Boolean).join(" ") || undefined}
      />
      <Item
        rotulo={tx(`Localidades em sistema isolado${u.isol_ref ? ` (ciclo ${u.isol_ref})` : ""}`, `Localities in an isolated system${u.isol_ref ? ` (cycle ${u.isol_ref})` : ""}`)}
        valor={u.isol_localidades === null ? <Ausente motivo={u.isol_motivo} /> : `${n(u.isol_localidades)}`}
        detalhe={u.isol_pop === null ? undefined : tx(`${n(u.isol_pop)} habitantes declarados pela fonte`, `${n(u.isol_pop)} inhabitants declared by the source`)}
      />
    </dl>
  );
}

/* ---------------------------------------------------------------- fichas */

export function FichaMunicipio({
  m,
  dados,
  idx,
  conjuntos,
  submercado,
  uf,
  onSelecionar,
  onVerUsinas,
  acao,
}: {
  m: MunicipioT;
  dados: DadosExplorador;
  idx: IndiceDistribuidoras;
  conjuntos: LinhaConjunto[];
  submercado: LinhaSubmercado | null;
  uf: LinhaUf | null;
  onSelecionar: (s: Selecao) => void;
  /** Abre a camada Usinas já filtrada por este município. */
  onVerUsinas?: (m: MunicipioT) => void;
  /** Ação junto do título da ficha (limpar a escolha). */
  acao?: ReactNode;
}) {
  const tx = useTx();
  const idioma = useIdioma();
  const n = (v: number | null | undefined) => inteiro(v, idioma);
  const vinculo = rotulosVinculo(idioma);
  const ano = dados.referencias.populacao_ano;
  const defTsee = textoDefasagem(dados.referencias.tsee_mes_cde, dados.dataReferencia, idioma);
  const basePequena = m.tsee_base_pequena ? tx(", base de menos de 50 famílias", ", base of fewer than 50 families") : "";
  const outras = m.usi_multi.length > 6 ? tx(" e outras", " and others") : "";
  return (
    <article className="space-y-4" aria-label={tx(`Ficha do município ${m.nome}`, `Sheet of the municipality ${m.nome}`)}>
      <Cabeca
        rotulo={tx(`Município · ${m.uf} · IBGE ${m.ibge}`, `Municipality · ${m.uf} · IBGE ${m.ibge}`)}
        nome={<Nome>{m.nome}</Nome>}
        resposta={respostaMunicipio(m, { distribuidoras: idx, populacaoAno: ano }, idioma)}
        tipo="mun"
        acao={acao}
      />

      <Grao grao="municipio" titulo={tx("Do município", "Of the municipality")} dados={dados}>
        <dl className="space-y-2">
          <Item rotulo={tx(`População estimada (IBGE, ${ano ?? "sem ano"})`, `Estimated population (IBGE, ${ano ?? "no year"})`)} valor={valorOu(m.pop, 0, tx("hab", "inhab."), null, idioma)} />
          <Item
            rotulo={tx("MMGD cadastrada", "Registered MMGD")}
            valor={m.mmgd_un === null ? <Ausente motivo={null} /> : tx(`${inteiro(m.mmgd_un)} unidades; ${numTexto(m.mmgd_kw, 0)} kW`, `${n(m.mmgd_un)} units; ${numTexto(m.mmgd_kw, 0, idioma)} kW`)}
            detalhe={
              m.mmgd_w_hab === null
                ? tx("sem população estimada: razão por habitante sem dado", "no estimated population: ratio per inhabitant with no data")
                : tx(
                    `${num(m.mmgd_w_hab, 1)} W por habitante; capacidade instalada, não energia`,
                    `${num(m.mmgd_w_hab, 1, idioma)} W per inhabitant; installed capacity, not energy`,
                  )
            }
          />
          <Item
            rotulo={tx(
              `Faturas com Tarifa Social (${textoReferencia(dados.referencias.tsee_mes_cde)})`,
              `Bills with the Social Tariff (${textoReferencia(dados.referencias.tsee_mes_cde, idioma)})`,
            )}
            valor={valorOu(m.tsee_faturas, 0, tx("faturas", "bills"), null, idioma)}
            detalhe={
              m.tsee_proxy_pct === null
                ? defTsee ?? undefined
                : tx(
                    `${num(m.tsee_proxy_pct, 1)}% por família de baixa renda do CadÚnico (proxy)${basePequena}${defTsee ? `; ${defTsee}` : ""}`,
                    `${num(m.tsee_proxy_pct, 1, idioma)}% per low-income CadUnico family (proxy)${basePequena}${defTsee ? `; ${defTsee}` : ""}`,
                  )
            }
          />
          <Item
            rotulo={tx("Domicílios atendidos pelo Luz para Todos (2004 em diante)", "Households served by Light for All (2004 onward)")}
            valor={m.lpt_dom === null ? <Ausente motivo={tx("município sem linha no arquivo do programa", "municipality without a row in the program file")} /> : n(m.lpt_dom)}
          />
          <Item
            rotulo={tx("Usinas em operação declaradas só neste município", "Plants in operation declared only in this municipality")}
            valor={`${n(m.usi_op_n)}; ${num(m.usi_op_mw, 1, idioma)} MW`}
            detalhe={
              <>
                {tx(`a construir: ${inteiro(m.usi_cart_n)} (${num(m.usi_cart_mw, 1)} MW outorgados)`, `to be built: ${n(m.usi_cart_n)} (${num(m.usi_cart_mw, 1, idioma)} granted MW)`)}
                {onVerUsinas && (m.usi_op_n > 0 || m.usi_cart_n > 0 || m.usi_multi.length > 0) && (
                  <>
                    {". "}
                    <button type="button" className={BOTAO_LINK} onClick={() => onVerUsinas(m)} data-ver-usinas="">
                      {tx("Ver as usinas deste município", "See the plants of this municipality")}
                    </button>
                  </>
                )}
              </>
            }
          />
          <Item rotulo={tx("Registros do SIGA de até 10 kW (à parte)", "SIGA registrations of up to 10 kW (counted separately)")} valor={`${n(m.usi_reg_n)}; ${num(m.usi_reg_kw, 0, idioma)} kW`} />
          <Item
            rotulo={tx("Localidades em sistema isolado (PASI)", "Localities in an isolated system (PASI)")}
            valor={n(m.isol_n)}
            detalhe={
              m.isol_n > 0
                ? tx(
                    `${m.isol_pop === null ? "população não publicada" : `${inteiro(m.isol_pop)} habitantes`}; ${m.isol_sede ? "a sede é localidade isolada" : "a sede está no SIN"}`,
                    `${m.isol_pop === null ? "population not published" : `${n(m.isol_pop)} inhabitants`}; ${m.isol_sede ? "the seat is an isolated locality" : "the seat is in the SIN"}`,
                  )
                : undefined
            }
          />
          {m.usi_multi.length > 0 && (
            <Item
              rotulo={tx("Usinas declaradas também em outros municípios", "Plants also declared in other municipalities")}
              valor={n(m.usi_multi.length)}
              detalhe={tx(
                `listadas, sem potência somada aqui: ${m.usi_multi.slice(0, 6).join(", ")}${outras}`,
                `listed, with no capacity added here: ${m.usi_multi.slice(0, 6).join(", ")}${outras}`,
              )}
            />
          )}
        </dl>
        <Fonte dados={dados} chave="mmgd" />
        <Fonte dados={dados} chave="usinas" />
      </Grao>

      <Grao
        grao="distribuidora"
        titulo={
          m.dist.length > 1
            ? tx("Das distribuidoras que atendem o município", "Of the distribution utilities serving the municipality")
            : tx("Da distribuidora que atende o município", "Of the distribution utility serving the municipality")
        }
        dados={dados}
      >
        {m.dist.length === 0 && (
          <p className="text-sm text-carvao-muted">
            {tx(
              "Sem distribuidora com vínculo na relação oficial vigente: nenhum valor de distribuidora se aplica.",
              "No distribution utility linked in the official list in force: no utility value applies.",
            )}
          </p>
        )}
        {m.dist.map(([i, e]) => {
          const d = idx.get(i);
          if (!d) return null;
          return (
            <div key={i} className="space-y-1.5 border-l-2 border-linha pl-3">
              <p className="text-sm text-carvao">
                <button type="button" className={BOTAO_LINK} onClick={() => onSelecionar({ tipo: "dist", id: d.id })}>
                  <Nome>{d.sigla}</Nome>
                </button>{" "}
                <span className="text-carvao-muted">
                  {tx(`(vínculo ${vinculo[e]}${e === 0 ? ": listada com ressalva" : ""})`, `(link ${vinculo[e]}${e === 0 ? ": listed with a caveat" : ""})`)}
                </span>
              </p>
              <BlocosDistribuidora d={d} dados={dados} compacto />
              <Links itens={linksDistribuidora(d.id, idioma)} titulo={tx("Levar esta distribuidora para", "Take this distribution utility to")} />
            </div>
          );
        })}
      </Grao>

      <Grao grao="conjunto" titulo={tx("Dos conjuntos elétricos que atendem o município", "Of the consumer sets serving the municipality")} dados={dados}>
        {conjuntos.length === 0 ? (
          <p className="text-sm text-carvao-muted">{tx("Nenhum conjunto elétrico publicado para o município.", "No consumer set published for the municipality.")}</p>
        ) : (
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx("Conjuntos elétricos do município (tabela rolável)", "Consumer sets of the municipality (scrollable table)")}>
            <table className="w-full min-w-[22rem] border-collapse text-xs tabular-nums">
              <caption className="sr-only">
                {tx("Conjuntos elétricos do município: DEC e FEC do conjunto inteiro, com os limites", "Consumer sets of the municipality: DEC and FEC of the whole set, with the limits")}
              </caption>
              <thead>
                <tr className="text-left text-mineral">
                  <th scope="col" className="border-b border-linha px-1 py-1 font-medium">{tx("Conjunto", "Consumer set")}</th>
                  <th scope="col" className="border-b border-linha px-1 py-1 text-right font-medium">DEC (h)</th>
                  <th scope="col" className="border-b border-linha px-1 py-1 text-right font-medium">FEC</th>
                  <th scope="col" className="border-b border-linha px-1 py-1 text-right font-medium">{tx("Municípios", "Municipalities")}</th>
                </tr>
              </thead>
              <tbody>
                {conjuntos.map((c) => (
                  <tr key={c.id} className="border-b border-linha last:border-b-0">
                    <th scope="row" className="px-1 py-1 text-left font-normal text-carvao">
                      <Nome>{c.nome}</Nome>{" "}
                      <span className="text-carvao-muted">
                        (<Nome>{c.distribuidora}</Nome>, {c.ano})
                      </span>
                    </th>
                    <td className="whitespace-nowrap px-1 py-1 text-right text-carvao">
                      {numTexto(c.dec_h, 2, idioma)} <span className="text-carvao-muted">/ {numTexto(c.dec_lim_h, 2, idioma)}</span>
                    </td>
                    <td className="whitespace-nowrap px-1 py-1 text-right text-carvao">
                      {numTexto(c.fec, 2, idioma)} <span className="text-carvao-muted">/ {numTexto(c.fec_lim, 2, idioma)}</span>
                    </td>
                    <td className="whitespace-nowrap px-1 py-1 text-right text-carvao">{n(c.n_mun)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-carvao-muted">
          {tx("Realizado / limite. O conjunto pode cobrir vários municípios ou só parte deste.", "Actual / limit. The set may cover several municipalities or only part of this one.")}
        </p>
        <Fonte dados={dados} chave="conjuntos" />
      </Grao>

      <Grao grao="submercado" titulo={tx("Do submercado da UF", "Of the state's submarket")} dados={dados}>
        {m.sm_estado === "fora_do_sin" || !m.sm || !submercado ? (
          <p className="text-sm text-carvao" data-nao-se-aplica="submercado">
            {tx(
              <>
                Não se aplica: {m.sm_estado === "fora_do_sin" ? `${m.nome} está fora do SIN (${m.isol_sede ? "sede em localidade isolada" : "ao menos metade da população em localidades isoladas"}). PLD, energia armazenada e MMGD estimada do submercado não valem para o município.` : "sem submercado conferido."}
              </>,
              <>
                Does not apply:{" "}
                {m.sm_estado === "fora_do_sin" ? (
                  <>
                    <Nome>{m.nome}</Nome> is outside the SIN ({m.isol_sede ? "seat in an isolated locality" : "at least half of the population in isolated localities"}). The submarket&apos;s PLD,
                    stored energy and estimated MMGD do not hold for the municipality.
                  </>
                ) : (
                  "no checked submarket."
                )}
              </>,
            )}
          </p>
        ) : (
          <>
            <p className="text-sm text-carvao">
              <button type="button" className={BOTAO_LINK} onClick={() => onSelecionar({ tipo: "sm", id: submercado.id })}>
                {submercado.nome}
              </button>{" "}
              <span className="text-carvao-muted">({m.sm_estado ? rotulosEstadoSm(idioma)[m.sm_estado] : tx("sem estado", "no status")})</span>
            </p>
            <BlocosSubmercado s={submercado} dados={dados} />
          </>
        )}
      </Grao>

      {uf && (
        <Grao
          grao="uf"
          titulo={tx(`Da UF (${uf.nome ?? uf.uf})`, `Of the state (${uf.nome ?? uf.uf})`)}
          dados={dados}
        >
          <BlocosUf u={uf} dados={dados} />
        </Grao>
      )}

      <Links itens={linksMunicipio(m.ibge, idioma)} titulo={tx("Levar este município para", "Take this municipality to")} />
    </article>
  );
}

export function FichaDistribuidora({ d, dados, onSelecionar, acao }: { d: LinhaDistribuidora; dados: DadosExplorador; onSelecionar: (s: Selecao) => void; acao?: ReactNode }) {
  const tx = useTx();
  const idioma = useIdioma();
  const n = (v: number | null | undefined) => inteiro(v, idioma);
  return (
    <article className="space-y-4" aria-label={tx(`Ficha da distribuidora ${d.sigla}`, `Sheet of the distribution utility ${d.sigla}`)}>
      <Cabeca
        rotulo={tx(`Distribuidora · CNPJ ${d.cnpj_formatado ?? d.id}`, `Distribution utility · CNPJ ${d.cnpj_formatado ?? d.id}`)}
        nome={<Nome>{d.nome ? `${d.sigla}: ${d.nome}` : d.sigla}</Nome>}
        resposta={respostaDistribuidora(d)}
        tipo="dist"
        acao={acao}
      />
      <Grao
        grao="distribuidora"
        titulo={tx("Área de atuação (relação oficial)", "Service area (official list)")}
        dados={dados}
        nota={tx(
          "Municípios inteiros que a relação oficial da ANEEL liga a esta distribuidora; não há polígono oficial de concessão acessível.",
          "Whole municipalities that ANEEL's official list links to this distribution utility; there is no accessible official concession polygon.",
        )}
      >
        <dl className="space-y-2">
          <Item
            rotulo={tx("Municípios", "Municipalities")}
            valor={n(d.municipios)}
            detalhe={tx(
              `${inteiro(d.confirmados)} confirmados; ${inteiro(d.so_mmgd)} só pelo cadastro de MMGD; ${inteiro(d.nao_confirmados)} sem confirmação`,
              `${n(d.confirmados)} confirmed; ${n(d.so_mmgd)} only through the MMGD register; ${n(d.nao_confirmados)} unconfirmed`,
            )}
          />
          <Item rotulo={tx("Exclusivos e compartilhados", "Exclusive and shared")} valor={tx(`${inteiro(d.exclusivos)} e ${inteiro(d.compartilhados)}`, `${n(d.exclusivos)} and ${n(d.compartilhados)}`)} />
          <Item rotulo={tx("UFs", "States")} valor={d.ufs || tx("nenhuma", "none")} />
          <Item
            rotulo={tx("Municípios por submercado (só os do SIN)", "Municipalities by submarket (only those in the SIN)")}
            valor={d.submercados || tx("nenhum", "none")}
            detalhe={
              d.fora_do_sin
                ? tx(
                    `${inteiro(d.fora_do_sin)} municípios fora do SIN não entram; ${inteiro(d.com_localidade_isolada)} com localidade isolada`,
                    `${n(d.fora_do_sin)} municipalities outside the SIN are left out; ${n(d.com_localidade_isolada)} with an isolated locality`,
                  )
                : undefined
            }
          />
        </dl>
        {d.submercado_unico && (
          <p className="text-sm">
            <button type="button" className={BOTAO_LINK} onClick={() => onSelecionar({ tipo: "sm", id: d.submercado_unico! })}>
              {tx(`Ver o submercado ${nomeSm(d.submercado_unico, idioma)}`, `See the ${nomeSm(d.submercado_unico, idioma)} submarket`)}
            </button>
          </p>
        )}
      </Grao>
      <Grao
        grao="distribuidora"
        titulo={tx("Indicadores da distribuidora inteira", "Indicators of the whole distribution utility")}
        dados={dados}
        nota={tx(
          "Valores da área inteira: não descrevem nenhum município e não servem para comparar municípios da mesma distribuidora.",
          "Values for the whole area: they describe no municipality and do not serve to compare municipalities of the same utility.",
        )}
      >
        <BlocosDistribuidora d={d} dados={dados} />
      </Grao>
      <Links itens={linksDistribuidora(d.id, idioma)} titulo={tx("Levar esta distribuidora para", "Take this distribution utility to")} />
    </article>
  );
}

export function FichaSubmercado({ s, dados, onSelecionar, acao }: { s: LinhaSubmercado; dados: DadosExplorador; onSelecionar: (s: Selecao) => void; acao?: ReactNode }) {
  const tx = useTx();
  return (
    <article className="space-y-4" aria-label={tx(`Ficha do submercado ${s.nome}`, `Sheet of the ${s.nome} submarket`)}>
      <Cabeca rotulo={tx("Submercado", "Submarket")} nome={s.nome} resposta={respostaSubmercado(s)} tipo="sm" acao={acao} />
      <Grao
        grao="submercado"
        titulo={tx("Do submercado inteiro", "Of the whole submarket")}
        dados={dados}
        nota={tx("Valores do submercado: não são de uma UF nem de um município.", "Submarket values: they are not a state's or a municipality's.")}
      >
        <BlocosSubmercado s={s} dados={dados} />
      </Grao>
      <Grao
        grao="uf"
        titulo={tx("UFs do submercado", "States of the submarket")}
        dados={dados}
        nota={tx("UFs cujas áreas de carga o ONS soma no submercado (camada oficial da EPE).", "States whose load areas the ONS adds up in the submarket (official EPE layer).")}
      >
        <ul className="flex flex-wrap gap-x-3">
          {s.ufs.split(", ").map((uf) => (
            <li key={uf}>
              <button type="button" className={BOTAO_LINK} onClick={() => onSelecionar({ tipo: "uf", id: uf })}>
                {uf}
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-carvao-muted">
          {tx(
            <>
              Pertença conferida pela soma da carga das áreas do ONS (mediana do resíduo por meia hora: {s.mediana_residuo}).
              {s.ufs_area_sem_carga ? ` UF com área de carga sem carga nos dias conferidos: ${s.ufs_area_sem_carga}.` : ""}
            </>,
            <>
              Membership checked by the sum of the ONS area loads (median residual per half hour: {s.mediana_residuo}).
              {s.ufs_area_sem_carga ? ` State with a load area without load on the days checked: ${s.ufs_area_sem_carga}.` : ""}
            </>,
          )}
        </p>
        <Fonte dados={dados} chave="areas_carga" />
      </Grao>
      <Links
        itens={[
          { rotulo: tx("Preço de curto prazo (PLD)", "Short-term price (PLD)"), href: "/setor-eletrico/pld" },
          { rotulo: tx("Água e clima", "Water and climate"), href: "/setor-eletrico/agua-e-clima" },
          { rotulo: tx("Carga", "Load"), href: "/setor-eletrico/carga" },
        ]}
      />
    </article>
  );
}

export function FichaUf({ u, s, dados, onSelecionar, acao }: { u: LinhaUf; s: LinhaSubmercado | null; dados: DadosExplorador; onSelecionar: (s: Selecao) => void; acao?: ReactNode }) {
  const tx = useTx();
  const idioma = useIdioma();
  const n = (v: number | null | undefined) => inteiro(v, idioma);
  return (
    <article className="space-y-4" aria-label={tx(`Ficha da UF ${u.nome ?? u.uf}`, `Sheet of the state ${u.nome ?? u.uf}`)}>
      <Cabeca rotulo={tx(`UF · ${u.uf}`, `State · ${u.uf}`)} nome={<Nome>{u.nome ?? u.uf}</Nome>} resposta={respostaUf(u)} tipo="uf" acao={acao} />
      <Grao grao="uf" titulo={tx("Da UF", "Of the state")} dados={dados} nota={tx("Valores da UF inteira.", "Values for the whole state.")}>
        <dl className="space-y-2">
          <Item
            rotulo={tx("Municípios", "Municipalities")}
            valor={n(u.municipios)}
            detalhe={tx(
              `${inteiro(u.fora_do_sin)} fora do SIN; ${inteiro(u.com_localidade_isolada)} com localidade isolada e dentro do SIN`,
              `${n(u.fora_do_sin)} outside the SIN; ${n(u.com_localidade_isolada)} with an isolated locality and inside the SIN`,
            )}
          />
          <Item rotulo={tx("Áreas de carga do ONS", "ONS load areas")} valor={u.subsistema ?? tx("sem submercado", "no submarket")} detalhe={<Nome>{u.areas}</Nome>} />
        </dl>
        <BlocosUf u={u} dados={dados} />
        <Fonte dados={dados} chave="subsistema_uf" />
      </Grao>
      {s && (
        <Grao grao="submercado" titulo={tx(`Do submercado ${s.nome}`, `Of the ${s.nome} submarket`)} dados={dados} nota={tx("Valores do submercado inteiro, não da UF.", "Values for the whole submarket, not the state's.")}>
          <p className="text-sm">
            <button type="button" className={BOTAO_LINK} onClick={() => onSelecionar({ tipo: "sm", id: s.id })}>
              {tx(`Ver o submercado ${s.nome}`, `See the ${s.nome} submarket`)}
            </button>
          </p>
          <BlocosSubmercado s={s} dados={dados} />
        </Grao>
      )}
    </article>
  );
}

export function FichaUsina({ u, dados, nomeMunicipio, onSelecionar, acao }: { u: UsinaT; dados: DadosExplorador; nomeMunicipio: (ibge: string) => string; onSelecionar: (s: Selecao) => void; acao?: ReactNode }) {
  const tx = useTx();
  const idioma = useIdioma();
  const pot = potenciaUsina(u);
  const outorga = u.outorga === null ? tx("outorga sem dado", "grant with no data") : rotuloDado(u.outorga, OUTORGA_SIGA_EN, idioma);
  return (
    <article className="space-y-4" aria-label={tx(`Ficha da usina ${u.nome}`, `Sheet of the plant ${u.nome}`)}>
      <Cabeca rotulo={tx(`Usina · CEG ${u.ceg}`, `Plant · CEG ${u.ceg}`)} nome={<Nome>{u.nome}</Nome>} resposta={respostaUsina(u, nomeMunicipio, idioma)} tipo="usi" acao={acao} />
      <Grao
        grao="usina" // i18n: dado
        titulo={tx("Da usina (ponto)", "Of the plant (point)")}
        dados={dados}
        nota={tx(
          "Ponto do SIGA (centróide aproximado). O submercado de uma usina depende do ponto de conexão, que o SIGA não publica.",
          "SIGA point (approximate centroid). A plant's submarket depends on its connection point, which SIGA does not publish.",
        )}
      >
        <dl className="space-y-2">
          <Item rotulo={tx("Tipo e outorga", "Type and grant")} valor={`${u.tipo}; ${outorga}`} />
          <Item
            rotulo={u.estagio === "operacao" ? tx("Potência fiscalizada", "Inspected capacity") : tx("Potência outorgada", "Granted capacity")}
            valor={valorOu(pot, pot !== null && pot < 1 ? 3 : 1, "MW", null, idioma)}
          />
          <Item rotulo={tx("UF informada pelo SIGA", "State reported by SIGA")} valor={u.uf ?? tx("sem dado", "no data")} />
          <Item
            rotulo={tx("Coordenada", "Coordinate")}
            valor={
              u.coord_no_declarado === 1
                ? tx("no município declarado", "in the declared municipality")
                : u.coord_no_declarado === 0
                  ? tx("fora do município declarado", "outside the declared municipality")
                  : tx("sem conferência", "not checked")
            }
            detalhe={tx("conferida na malha de qualidade máxima do IBGE; a declaração prevalece", "checked on the IBGE maximum-quality map; the declaration prevails")}
          />
        </dl>
        <Fonte dados={dados} chave="usinas" />
      </Grao>
      <Grao
        grao="municipio"
        titulo={tx("Municípios declarados", "Declared municipalities")}
        dados={dados}
        nota={tx("Municípios que o SIGA declara para a usina, pelo nome oficial do IBGE.", "Municipalities that SIGA declares for the plant, by official IBGE name.")}
      >
        {u.municipios.length === 0 ? (
          <p className="text-sm text-carvao-muted">{tx("Nenhum município declarado foi reconhecido no cadastro do IBGE.", "No declared municipality was recognized in the IBGE register.")}</p>
        ) : (
          <ul className="flex flex-wrap gap-x-3">
            {u.municipios.map((ibge) => (
              <li key={ibge}>
                <button type="button" className={BOTAO_LINK} onClick={() => onSelecionar({ tipo: "mun", id: ibge })}>
                  <Nome>{nomeMunicipio(ibge)}</Nome>
                </button>
              </li>
            ))}
          </ul>
        )}
        {u.n_declarados > 1 && (
          <p className="text-xs text-carvao-muted">
            {tx(
              "Usina em mais de um município: listada em cada um, sem a potência repartida nem somada a nenhum deles.",
              "Plant in more than one municipality: listed in each one, with the capacity neither split nor added to any of them.",
            )}
          </p>
        )}
      </Grao>
      <Links itens={[{ rotulo: tx("Expansão: carteira e cronograma", "Expansion: portfolio and schedule"), href: "/setor-eletrico/expansao" }]} />
    </article>
  );
}
