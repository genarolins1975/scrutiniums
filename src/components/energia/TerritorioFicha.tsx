"use client";

import type { ReactNode } from "react";
import { dataBR, num } from "@/lib/energia/formato";
import {
  NOME_SUBMERCADO,
  ROTULO_ESTADO_SM,
  ROTULO_VINCULO,
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

/**
 * Ficha da entidade escolhida na página Minha região (P002). A regra do critério de
 * aceite fica visível aqui: cada número aparece debaixo do cabeçalho do seu grão, com
 * o rótulo que a gold publica para ele no município ("da distribuidora que atende o
 * município, valor da área inteira da distribuidora, não do município"). Ausência
 * aparece com o motivo publicado, nunca como zero; fonte com mês antigo traz a
 * defasagem escrita.
 */

const LINK = "inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";
const BOTAO_LINK = "inline-flex min-h-[44px] items-center text-left text-energia-dark underline underline-offset-4 hover:text-carvao focus:outline-none focus-visible:ring-2 focus-visible:ring-energia";

/**
 * Bloco de um grão. Na ficha do município, o rótulo publicado pela gold diz de quem é o
 * valor ("da distribuidora que atende o município, valor da área inteira"); nas fichas
 * das outras entidades, `nota` substitui esse rótulo.
 */
function Grao({ grao, titulo, dados, children, id, nota }: { grao: IdGraoTerritorio; titulo?: string; dados: DadosExplorador; children: ReactNode; id?: string; nota?: string }) {
  const g = dados.graos.find((x) => x.id === grao);
  return (
    <section className="border-t border-linha pt-3" data-grao={grao} id={id}>
      <h4 className="text-sm font-medium text-carvao">{titulo ?? g?.rotulo ?? grao}</h4>
      {nota ? <p className="mt-0.5 text-xs text-carvao-muted">{nota}</p> : g && <p className="mt-0.5 text-xs text-carvao-muted">Valor {g.rotulo_no_municipio}.</p>}
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function Item({ rotulo, valor, detalhe }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 text-sm">
      <dt className="text-carvao-muted">{rotulo}</dt>
      <dd className="text-right tabular-nums text-carvao">{valor}</dd>
      {detalhe && <dd className="col-span-2 text-xs text-carvao-muted">{detalhe}</dd>}
    </div>
  );
}

function Fonte({ dados, chave, extra }: { dados: DadosExplorador; chave: ChaveFonte; extra?: string | null }) {
  const f = dados.fontes[chave];
  if (!f) return null;
  return (
    <p className="text-xs text-mineral">
      Fonte: {f.orgao}, {f.conjunto}; referência {f.periodo}.{extra ? ` ${extra}.` : ""}
    </p>
  );
}

function Ausente({ motivo }: { motivo: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-carvao-muted">
      <span aria-hidden="true" className="inline-block h-3 w-3 border border-mineral" style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--cor-mineral) 0 1px, transparent 1px 4px)" }} />
      sem dado{motivo ? `: ${motivo}` : ""}
    </span>
  );
}

function valorOu(v: number | null | undefined, casas: number, unidade: string, motivo: string | null = null): ReactNode {
  return v === null || v === undefined ? <Ausente motivo={motivo} /> : `${num(v, casas)}${unidade ? ` ${unidade}` : ""}`;
}

function Links({ itens, titulo = "Na página de origem" }: { itens: LinkModulo[]; titulo?: string }) {
  if (!itens.length) return null;
  return (
    <div>
      <p className="rotulo text-mineral">{titulo}</p>
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

function Cabeca({ rotulo, nome, resposta, tipo }: { rotulo: string; nome: string; resposta: string; tipo: string }) {
  return (
    <header>
      <p className="rotulo text-mineral">{rotulo}</p>
      <h3 className="mt-1 font-serif text-xl leading-snug text-carvao">{nome}</h3>
      <p className="mt-2 text-sm leading-relaxed text-carvao" data-resposta-ficha={tipo}>
        {resposta}
      </p>
    </header>
  );
}

/* ---------------------------------------------------------------- distribuidora (blocos) */

export function BlocosDistribuidora({ d, dados, compacto = false }: { d: LinhaDistribuidora; dados: DadosExplorador; compacto?: boolean }) {
  const defTsee = textoDefasagem(d.tsee_ref, dados.dataReferencia);
  return (
    <dl className="space-y-2">
      <Item
        rotulo={`Perdas totais sobre a energia injetada${d.perdas_ano ? ` (${d.perdas_ano})` : ""}`}
        valor={valorOu(d.perdas_pct, 2, "%", d.perdas_motivo)}
        detalhe={[d.perdas_situacao === "ano parcial" ? `ano parcial, ${d.perdas_meses} meses: não comparável a ano completo` : null, d.perdas_ressalvas].filter(Boolean).join(" ") || undefined}
      />
      <Item
        rotulo={`DEC e FEC${d.qual_ano ? ` (${d.qual_ano})` : ""}`}
        valor={d.dec_h === null ? <Ausente motivo={d.qual_motivo} /> : `${num(d.dec_h, 2)} h; ${numTexto(d.fec, 2)} interrupções`}
        detalhe={d.dec_h === null ? undefined : `limites: ${numTexto(d.dec_lim_h, 2)} h e ${numTexto(d.fec_lim, 2)} interrupções`}
      />
      <Item
        rotulo="Tarifa B1 residencial (TE + TUSD, sem tributos)"
        valor={valorOu(d.tarifa, 2, "R$/MWh", d.tarifa_motivo)}
        detalhe={d.tarifa === null ? undefined : `TE ${numTexto(d.te, 2)} e TUSD ${numTexto(d.tusd, 2)}; ${d.tarifa_ato ?? "ato sem número"}, vigência ${d.tarifa_vigencia ?? "sem data"}`}
      />
      <Item
        rotulo="MMGD cadastrada na distribuidora"
        valor={d.mmgd_un === null ? <Ausente motivo={d.mmgd_motivo} /> : `${inteiro(d.mmgd_un)} unidades; ${numTexto(d.mmgd_mw, 1)} MW`}
        detalhe={d.mmgd_ref ? `cadastro de ${dataBR(d.mmgd_ref)}` : undefined}
      />
      <Item
        rotulo="Residenciais com Tarifa Social"
        valor={d.tsee_pct === null ? <Ausente motivo={d.tsee_motivo} /> : `${num(d.tsee_pct, 2)}% (${inteiro(d.tsee_uc)} unidades)`}
        detalhe={d.tsee_ref ? `referência ${textoReferencia(d.tsee_ref)}${defTsee ? `; ${defTsee}` : ""}` : undefined}
      />
      {!compacto && (
        <p className="text-xs text-mineral">
          Fontes: ANEEL (SAMP Balanço, Indicadores de Continuidade, Tarifas de aplicação, Relação de MMGD, SCS), pelos módulos Perdas, Qualidade, Conta de luz, Transição e Inclusão.
        </p>
      )}
    </dl>
  );
}

/* ---------------------------------------------------------------- submercado e UF (blocos) */

export function BlocosSubmercado({ s, dados }: { s: LinhaSubmercado; dados: DadosExplorador }) {
  const def = textoDefasagem(s.mmgd_ons_ref, dados.dataReferencia);
  return (
    <dl className="space-y-2">
      <Item rotulo={`PLD médio do dia${s.pld_dia_ref ? ` (${dataBR(s.pld_dia_ref)})` : ""}`} valor={valorOu(s.pld_dia, 2, "R$/MWh", s.pld_dia_motivo)} detalhe="média das 24 horas, não ponderada pela carga" />
      <Item
        rotulo={`PLD médio do mês${s.pld_mes_ref ? ` (${textoReferencia(s.pld_mes_ref)})` : ""}`}
        valor={valorOu(s.pld_mes, 2, "R$/MWh", s.pld_mes_motivo)}
        detalhe={s.pld_mes_dias ? `${inteiro(s.pld_mes_dias)} dias publicados` : undefined}
      />
      <Item
        rotulo={`Energia armazenada${s.ear_ref ? ` (${dataBR(s.ear_ref)})` : ""}`}
        valor={valorOu(s.ear_pct, 1, "% da máxima", s.ear_motivo)}
        detalhe={s.ear_mwmes === null ? undefined : `${numTexto(s.ear_mwmes, 0)} de ${numTexto(s.ear_max_mwmes, 0)} MWmês`}
      />
      <Item
        rotulo={`Carga atendida por MMGD, estimativa do ONS${s.mmgd_ons_ref ? ` (${textoReferencia(s.mmgd_ons_ref)})` : ""}`}
        valor={valorOu(s.mmgd_ons, 0, "MWmed", s.mmgd_ons_motivo)}
        detalhe={def ?? "estimada pelo ONS, não medida"}
      />
      <Fonte dados={dados} chave="pld_dia" />
      <Fonte dados={dados} chave="ear" />
    </dl>
  );
}

export function BlocosUf({ u, dados }: { u: LinhaUf; dados: DadosExplorador }) {
  const def = textoDefasagem(u.tsee_ref, dados.dataReferencia);
  return (
    <dl className="space-y-2">
      <Item
        rotulo="Capacidade em operação (UF principal da usina)"
        valor={u.cap_mw === null ? <Ausente motivo={u.cap_motivo} /> : `${num(u.cap_mw, 1)} MW (${inteiro(u.cap_usinas)} usinas)`}
        detalhe={u.cap_origem ?? undefined}
      />
      <Item
        rotulo={`Faturas com Tarifa Social${u.tsee_ref ? ` (${textoReferencia(u.tsee_ref)})` : ""}`}
        valor={valorOu(u.tsee_faturas, 0, "faturas", u.tsee_motivo)}
        detalhe={u.tsee_desconto === null ? undefined : `desconto de R$ ${num(u.tsee_desconto, 2)} no mês${def ? `; ${def}` : ""}`}
      />
      <Item
        rotulo={`Localidades em sistema isolado${u.isol_ref ? ` (ciclo ${u.isol_ref})` : ""}`}
        valor={u.isol_localidades === null ? <Ausente motivo={u.isol_motivo} /> : `${inteiro(u.isol_localidades)}`}
        detalhe={u.isol_pop === null ? undefined : `${inteiro(u.isol_pop)} habitantes declarados pela fonte`}
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
}: {
  m: MunicipioT;
  dados: DadosExplorador;
  idx: IndiceDistribuidoras;
  conjuntos: LinhaConjunto[];
  submercado: LinhaSubmercado | null;
  uf: LinhaUf | null;
  onSelecionar: (s: Selecao) => void;
}) {
  const ano = dados.referencias.populacao_ano;
  const defTsee = textoDefasagem(dados.referencias.tsee_mes_cde, dados.dataReferencia);
  return (
    <article className="space-y-4" aria-label={`Ficha do município ${m.nome}`}>
      <Cabeca rotulo={`Município · ${m.uf} · IBGE ${m.ibge}`} nome={m.nome} resposta={respostaMunicipio(m, { distribuidoras: idx, populacaoAno: ano })} tipo="mun" />

      <Grao grao="municipio" titulo="Do município" dados={dados}>
        <dl className="space-y-2">
          <Item rotulo={`População estimada (IBGE, ${ano ?? "sem ano"})`} valor={valorOu(m.pop, 0, "hab")} />
          <Item
            rotulo="MMGD cadastrada"
            valor={m.mmgd_un === null ? <Ausente motivo={null} /> : `${inteiro(m.mmgd_un)} unidades; ${numTexto(m.mmgd_kw, 0)} kW`}
            detalhe={m.mmgd_w_hab === null ? "sem população estimada: razão por habitante sem dado" : `${num(m.mmgd_w_hab, 1)} W por habitante; capacidade instalada, não energia`}
          />
          <Item
            rotulo={`Faturas com Tarifa Social (${textoReferencia(dados.referencias.tsee_mes_cde)})`}
            valor={valorOu(m.tsee_faturas, 0, "faturas")}
            detalhe={
              m.tsee_proxy_pct === null
                ? defTsee ?? undefined
                : `${num(m.tsee_proxy_pct, 1)}% por família de baixa renda do CadÚnico (proxy)${m.tsee_base_pequena ? ", base de menos de 50 famílias" : ""}${defTsee ? `; ${defTsee}` : ""}`
            }
          />
          <Item rotulo="Domicílios atendidos pelo Luz para Todos (2004 em diante)" valor={m.lpt_dom === null ? <Ausente motivo="município sem linha no arquivo do programa" /> : inteiro(m.lpt_dom)} />
          <Item
            rotulo="Usinas em operação declaradas só neste município"
            valor={`${inteiro(m.usi_op_n)}; ${num(m.usi_op_mw, 1)} MW`}
            detalhe={`a construir: ${inteiro(m.usi_cart_n)} (${num(m.usi_cart_mw, 1)} MW outorgados)`}
          />
          <Item rotulo="Registros do SIGA de até 10 kW (à parte)" valor={`${inteiro(m.usi_reg_n)}; ${num(m.usi_reg_kw, 0)} kW`} />
          <Item
            rotulo="Localidades em sistema isolado (PASI)"
            valor={inteiro(m.isol_n)}
            detalhe={m.isol_n > 0 ? `${m.isol_pop === null ? "população não publicada" : `${inteiro(m.isol_pop)} habitantes`}; ${m.isol_sede ? "a sede é localidade isolada" : "a sede está no SIN"}` : undefined}
          />
          {m.usi_multi.length > 0 && (
            <Item
              rotulo="Usinas declaradas também em outros municípios"
              valor={inteiro(m.usi_multi.length)}
              detalhe={`listadas, sem potência somada aqui: ${m.usi_multi.slice(0, 6).join(", ")}${m.usi_multi.length > 6 ? " e outras" : ""}`}
            />
          )}
        </dl>
        <Fonte dados={dados} chave="mmgd" />
        <Fonte dados={dados} chave="usinas" />
      </Grao>

      <Grao grao="distribuidora" titulo={m.dist.length > 1 ? "Das distribuidoras que atendem o município" : "Da distribuidora que atende o município"} dados={dados}>
        {m.dist.length === 0 && <p className="text-sm text-carvao-muted">Sem distribuidora com vínculo na relação oficial vigente: nenhum valor de distribuidora se aplica.</p>}
        {m.dist.map(([i, e]) => {
          const d = idx.get(i);
          if (!d) return null;
          return (
            <div key={i} className="space-y-1.5 border-l-2 border-linha pl-3">
              <p className="text-sm text-carvao">
                <button type="button" className={BOTAO_LINK} onClick={() => onSelecionar({ tipo: "dist", id: d.id })}>
                  {d.sigla}
                </button>{" "}
                <span className="text-carvao-muted">(vínculo {ROTULO_VINCULO[e]}{e === 0 ? ": listada com ressalva" : ""})</span>
              </p>
              <BlocosDistribuidora d={d} dados={dados} compacto />
              <Links itens={linksDistribuidora(d.id)} titulo="Levar esta distribuidora para" />
            </div>
          );
        })}
      </Grao>

      <Grao grao="conjunto" titulo="Dos conjuntos elétricos que atendem o município" dados={dados}>
        {conjuntos.length === 0 ? (
          <p className="text-sm text-carvao-muted">Nenhum conjunto elétrico publicado para o município.</p>
        ) : (
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Conjuntos elétricos do município (tabela rolável)">
            <table className="w-full min-w-[22rem] border-collapse text-xs tabular-nums">
              <caption className="sr-only">Conjuntos elétricos do município: DEC e FEC do conjunto inteiro, com os limites</caption>
              <thead>
                <tr className="text-left text-mineral">
                  <th scope="col" className="border-b border-linha px-1 py-1 font-medium">Conjunto</th>
                  <th scope="col" className="border-b border-linha px-1 py-1 text-right font-medium">DEC (h)</th>
                  <th scope="col" className="border-b border-linha px-1 py-1 text-right font-medium">FEC</th>
                  <th scope="col" className="border-b border-linha px-1 py-1 text-right font-medium">Municípios</th>
                </tr>
              </thead>
              <tbody>
                {conjuntos.map((c) => (
                  <tr key={c.id} className="border-b border-linha last:border-b-0">
                    <th scope="row" className="px-1 py-1 text-left font-normal text-carvao">
                      {c.nome} <span className="text-carvao-muted">({c.distribuidora}, {c.ano})</span>
                    </th>
                    <td className="px-1 py-1 text-right text-carvao">
                      {numTexto(c.dec_h, 2)} <span className="text-carvao-muted">/ {numTexto(c.dec_lim_h, 2)}</span>
                    </td>
                    <td className="px-1 py-1 text-right text-carvao">
                      {numTexto(c.fec, 2)} <span className="text-carvao-muted">/ {numTexto(c.fec_lim, 2)}</span>
                    </td>
                    <td className="px-1 py-1 text-right text-carvao">{inteiro(c.n_mun)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-carvao-muted">Realizado / limite. O conjunto pode cobrir vários municípios ou só parte deste.</p>
        <Fonte dados={dados} chave="conjuntos" />
      </Grao>

      <Grao grao="submercado" titulo="Do submercado da UF" dados={dados}>
        {m.sm_estado === "fora_do_sin" || !m.sm || !submercado ? (
          <p className="text-sm text-carvao" data-nao-se-aplica="submercado">
            Não se aplica: {m.sm_estado === "fora_do_sin" ? `${m.nome} está fora do SIN (${m.isol_sede ? "sede em localidade isolada" : "ao menos metade da população em localidades isoladas"}). PLD, energia armazenada e MMGD estimada do submercado não valem para o município.` : "sem submercado provado."}
          </p>
        ) : (
          <>
            <p className="text-sm text-carvao">
              <button type="button" className={BOTAO_LINK} onClick={() => onSelecionar({ tipo: "sm", id: submercado.id })}>
                {submercado.nome}
              </button>{" "}
              <span className="text-carvao-muted">({m.sm_estado ? ROTULO_ESTADO_SM[m.sm_estado] : "sem estado"})</span>
            </p>
            <BlocosSubmercado s={submercado} dados={dados} />
          </>
        )}
      </Grao>

      {uf && (
        <Grao grao="uf" titulo={`Da UF (${uf.nome ?? uf.uf})`} dados={dados}>
          <BlocosUf u={uf} dados={dados} />
        </Grao>
      )}

      <Links itens={linksMunicipio(m.ibge)} titulo="Levar este município para" />
    </article>
  );
}

export function FichaDistribuidora({ d, dados, onSelecionar }: { d: LinhaDistribuidora; dados: DadosExplorador; onSelecionar: (s: Selecao) => void }) {
  return (
    <article className="space-y-4" aria-label={`Ficha da distribuidora ${d.sigla}`}>
      <Cabeca rotulo={`Distribuidora · CNPJ ${d.cnpj_formatado ?? d.id}`} nome={d.nome ? `${d.sigla}: ${d.nome}` : d.sigla} resposta={respostaDistribuidora(d)} tipo="dist" />
      <Grao grao="distribuidora" titulo="Área de atuação (relação oficial)" dados={dados} nota="Municípios inteiros que a relação oficial da ANEEL liga a esta distribuidora; não há polígono oficial de concessão acessível.">
        <dl className="space-y-2">
          <Item rotulo="Municípios" valor={inteiro(d.municipios)} detalhe={`${inteiro(d.confirmados)} confirmados; ${inteiro(d.so_mmgd)} só pelo cadastro de MMGD; ${inteiro(d.nao_confirmados)} sem confirmação`} />
          <Item rotulo="Exclusivos e compartilhados" valor={`${inteiro(d.exclusivos)} e ${inteiro(d.compartilhados)}`} />
          <Item rotulo="UFs" valor={d.ufs || "nenhuma"} />
          <Item
            rotulo="Municípios por submercado (só os do SIN)"
            valor={d.submercados || "nenhum"}
            detalhe={d.fora_do_sin ? `${inteiro(d.fora_do_sin)} municípios fora do SIN não entram; ${inteiro(d.com_localidade_isolada)} com localidade isolada` : undefined}
          />
        </dl>
        {d.submercado_unico && (
          <p className="text-sm">
            <button type="button" className={BOTAO_LINK} onClick={() => onSelecionar({ tipo: "sm", id: d.submercado_unico! })}>
              Ver o submercado {NOME_SUBMERCADO[d.submercado_unico]}
            </button>
          </p>
        )}
      </Grao>
      <Grao grao="distribuidora" titulo="Indicadores da distribuidora inteira" dados={dados} nota="Valores da área inteira: não descrevem nenhum município e não servem para comparar municípios da mesma distribuidora.">
        <BlocosDistribuidora d={d} dados={dados} />
      </Grao>
      <Links itens={linksDistribuidora(d.id)} titulo="Levar esta distribuidora para" />
    </article>
  );
}

export function FichaSubmercado({ s, dados, onSelecionar }: { s: LinhaSubmercado; dados: DadosExplorador; onSelecionar: (s: Selecao) => void }) {
  return (
    <article className="space-y-4" aria-label={`Ficha do submercado ${s.nome}`}>
      <Cabeca rotulo="Submercado" nome={s.nome} resposta={respostaSubmercado(s)} tipo="sm" />
      <Grao grao="submercado" titulo="Do submercado inteiro" dados={dados} nota="Valores do submercado: não são de uma UF nem de um município.">
        <BlocosSubmercado s={s} dados={dados} />
      </Grao>
      <Grao grao="uf" titulo="UFs do submercado" dados={dados} nota="UFs cujas áreas de carga o ONS soma no submercado (camada oficial da EPE).">
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
          Pertença conferida pela soma da carga das áreas do ONS (mediana do resíduo por meia hora: {s.mediana_residuo}).
          {s.ufs_area_sem_carga ? ` UF com área de carga sem carga nos dias conferidos: ${s.ufs_area_sem_carga}.` : ""}
        </p>
        <Fonte dados={dados} chave="areas_carga" />
      </Grao>
      <Links
        itens={[
          { rotulo: "Preço de curto prazo (PLD)", href: "/setor-eletrico/pld" },
          { rotulo: "Água e clima", href: "/setor-eletrico/agua-e-clima" },
          { rotulo: "Carga", href: "/setor-eletrico/carga" },
        ]}
      />
    </article>
  );
}

export function FichaUf({ u, s, dados, onSelecionar }: { u: LinhaUf; s: LinhaSubmercado | null; dados: DadosExplorador; onSelecionar: (s: Selecao) => void }) {
  return (
    <article className="space-y-4" aria-label={`Ficha da UF ${u.nome ?? u.uf}`}>
      <Cabeca rotulo={`UF · ${u.uf}`} nome={u.nome ?? u.uf} resposta={respostaUf(u)} tipo="uf" />
      <Grao grao="uf" titulo="Da UF" dados={dados} nota="Valores da UF inteira.">
        <dl className="space-y-2">
          <Item rotulo="Municípios" valor={inteiro(u.municipios)} detalhe={`${inteiro(u.fora_do_sin)} fora do SIN; ${inteiro(u.com_localidade_isolada)} com localidade isolada`} />
          <Item rotulo="Áreas de carga do ONS" valor={u.subsistema ?? "sem submercado"} detalhe={u.areas} />
        </dl>
        <BlocosUf u={u} dados={dados} />
        <Fonte dados={dados} chave="subsistema_uf" />
      </Grao>
      {s && (
        <Grao grao="submercado" titulo={`Do submercado ${s.nome}`} dados={dados} nota="Valores do submercado inteiro, não da UF.">
          <p className="text-sm">
            <button type="button" className={BOTAO_LINK} onClick={() => onSelecionar({ tipo: "sm", id: s.id })}>
              Ver o submercado {s.nome}
            </button>
          </p>
          <BlocosSubmercado s={s} dados={dados} />
        </Grao>
      )}
    </article>
  );
}

export function FichaUsina({ u, dados, nomeMunicipio, onSelecionar }: { u: UsinaT; dados: DadosExplorador; nomeMunicipio: (ibge: string) => string; onSelecionar: (s: Selecao) => void }) {
  const pot = potenciaUsina(u);
  return (
    <article className="space-y-4" aria-label={`Ficha da usina ${u.nome}`}>
      <Cabeca rotulo={`Usina · CEG ${u.ceg}`} nome={u.nome} resposta={respostaUsina(u, nomeMunicipio)} tipo="usi" />
      <Grao grao="usina" titulo="Da usina (ponto)" dados={dados} nota="Ponto do SIGA (centróide aproximado). O submercado de uma usina depende do ponto de conexão, que o SIGA não publica.">
        <dl className="space-y-2">
          <Item rotulo="Tipo e outorga" valor={`${u.tipo}; ${u.outorga ?? "outorga sem dado"}`} />
          <Item rotulo={u.estagio === "operacao" ? "Potência fiscalizada" : "Potência outorgada"} valor={valorOu(pot, pot !== null && pot < 1 ? 3 : 1, "MW")} />
          <Item rotulo="UF informada pelo SIGA" valor={u.uf ?? "sem dado"} />
          <Item
            rotulo="Coordenada"
            valor={u.coord_no_declarado === 1 ? "no município declarado" : u.coord_no_declarado === 0 ? "fora do município declarado" : "sem conferência"}
            detalhe="conferida na malha de qualidade máxima do IBGE; a declaração prevalece"
          />
        </dl>
        <Fonte dados={dados} chave="usinas" />
      </Grao>
      <Grao grao="municipio" titulo="Municípios declarados" dados={dados} nota="Municípios que o SIGA declara para a usina, pelo nome oficial do IBGE.">
        {u.municipios.length === 0 ? (
          <p className="text-sm text-carvao-muted">Nenhum município declarado foi reconhecido no cadastro do IBGE.</p>
        ) : (
          <ul className="flex flex-wrap gap-x-3">
            {u.municipios.map((ibge) => (
              <li key={ibge}>
                <button type="button" className={BOTAO_LINK} onClick={() => onSelecionar({ tipo: "mun", id: ibge })}>
                  {nomeMunicipio(ibge)}
                </button>
              </li>
            ))}
          </ul>
        )}
        {u.n_declarados > 1 && <p className="text-xs text-carvao-muted">Usina em mais de um município: listada em cada um, sem a potência repartida nem somada a nenhum deles.</p>}
      </Grao>
      <Links itens={[{ rotulo: "Expansão: carteira e cronograma", href: "/setor-eletrico/expansao" }]} />
    </article>
  );
}
