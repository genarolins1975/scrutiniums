"use client";

import { useId, useMemo, useState } from "react";
import { ContaBuscaMunicipio } from "@/components/energia/ContaBuscaMunicipio";
import { useMesCorrente } from "@/components/energia/useMesCorrente";
import { Nome } from "@/components/i18n/Nome";
import { bandeiraUsada, fonteBandeira, fraseBandeira, situacaoBandeira } from "@/lib/energia/bandeira-do-mes";
import { distribuidorasDoMunicipio, nomeLigacao, rotuloDistribuidora, simular, type MunicipioEncontrado } from "@/lib/energia/conta";
import { formatos } from "@/lib/energia/formato";
import { bandeiraNoIdioma } from "@/lib/energia/i18n/conta-inclusao";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { BandeiraVigente, Simulador } from "@/lib/energia/tipos-conta";

/**
 * Versão aperitivo da Conta de luz (princípio do aperitivo, 20/10/2026): "Quanto custa a conta de luz na minha cidade?". O leitor
 * escolhe o município (a busca da página completa, ContaBuscaMunicipio) ou a distribuidora e informa o consumo do mês; a estimativa
 * sai da mesma função do simulador da página completa (`simular`), na classe residencial, ligação monofásica, com a bandeira do mês
 * escolhida pela mesma regra (`situacaoBandeira`). Nenhuma comparação entre distribuidoras: a lista só serve para escolher a sua.
 */

/** [CNPJ, sigla, início da vigência, ato, TE e TUSD residenciais em R$/MWh, UF]: só a tarifa que a estimativa usa. */
export type DistribuidoraAperitivo = [string, string | null, string, string, number | null, number | null, string | null];

const CLASSE = "residencial" as const;
const LIGACAO = "monofasico" as const;
const KWH_INICIAL = 150; // o mesmo padrão do simulador da página completa (?skwh=)
const KWH_MAX = 10000;

export function ContaLuzNaMinhaCidade({
  distribuidoras,
  regras,
  bandeiraVigente,
  mesDaPagina,
  dataReferencia,
}: {
  distribuidoras: DistribuidoraAperitivo[];
  regras: Simulador["regras"];
  bandeiraVigente: BandeiraVigente | null;
  mesDaPagina: string;
  dataReferencia: string;
}) {
  const uid = useId();
  const idioma = useIdioma();
  const tx = useTx();
  const { dataBR, mesAno, num, reais } = formatos(idioma);
  const porCnpj = useMemo(() => new Map(distribuidoras.map((d) => [d[0], d])), [distribuidoras]);
  const [cnpj, setCnpj] = useState<string>("");
  const [kwh, setKwh] = useState(KWH_INICIAL);
  const [texto, setTexto] = useState<string | null>(null);
  const [municipio, setMunicipio] = useState<{ m: MunicipioEncontrado; vinculos: MunicipioEncontrado["vinculos"] } | null>(null);

  const mesCorrente = useMesCorrente(mesDaPagina);
  const situacao = situacaoBandeira(bandeiraVigente, mesCorrente);
  const usada = bandeiraUsada(situacao);
  // a mesma escolha do simulador completo na opção "bandeira do mês": sem acionamento publicado, a bandeira fica fora (nunca vira verde)
  const adicional = usada?.bandeira ? (usada.rs_mwh ?? null) : null;
  const semBandeira = !usada?.bandeira || adicional === null;

  const dist = cnpj ? (porCnpj.get(cnpj) ?? null) : null;
  const sigla = dist ? rotuloDistribuidora(dist[1], dist[0]) : "";
  const r = useMemo(() => (dist ? simular({ residencial: [dist[4], dist[5]] }, CLASSE, kwh, LIGACAO, adicional, regras, idioma) : null), [dist, kwh, adicional, regras, idioma]);

  const kwhValido = (bruto: string) => {
    const n = Number(bruto);
    return bruto.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= KWH_MAX;
  };
  const kwhInvalido = texto !== null && !kwhValido(texto);

  const escolherMunicipio = (m: MunicipioEncontrado) => {
    const vinculos = distribuidorasDoMunicipio(m);
    setMunicipio({ m, vinculos });
    // uma só distribuidora com tarifa: escolhida direto; mais de uma: o leitor diz qual é a da casa dele
    const comTarifa = vinculos.filter((v) => porCnpj.has(v.cnpj));
    setCnpj(vinculos.length === 1 && comTarifa.length === 1 ? comTarifa[0].cnpj : "");
  };

  const nomeVinculo = (v: MunicipioEncontrado["vinculos"][number]) => {
    const d = porCnpj.get(v.cnpj);
    return d ? rotuloDistribuidora(d[1], d[0]) : v.sigla || `CNPJ ${v.cnpj}`;
  };

  return (
    <div className="space-y-6" data-conta-aperitivo="">
      <form className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_minmax(0,11rem)] md:items-start" onSubmit={(e) => e.preventDefault()} aria-label={tx("Escolha da distribuidora e do consumo", "Choice of distribution utility and consumption")}>
        <ContaBuscaMunicipio aoEscolher={escolherMunicipio} />
        <label className="flex min-w-0 flex-col gap-1 text-sm text-carvao">
          <span className="rotulo text-mineral">{tx("Ou escolha a distribuidora", "Or choose the distribution utility")}</span>
          <select
            value={cnpj}
            onChange={(e) => {
              setCnpj(e.target.value);
              setMunicipio(null);
            }}
            className="min-h-[44px] w-full min-w-0 max-w-full border border-linha bg-superficie px-2 text-sm text-carvao"
          >
            <option value="">{tx("Distribuidora (sigla e estado)", "Distribution utility (acronym and state)")}</option>
            {distribuidoras.map((d) => (
              // <option> não aceita o <span> de <Nome>: na página inglesa, a própria opção leva a marca de nome próprio
              <option key={d[0]} value={d[0]} {...(idioma === "en" ? { lang: "pt-BR", translate: "no" as const, "data-i18n-nome": "" } : {})}>
                {rotuloDistribuidora(d[1], d[0])}
                {d[6] ? ` (${d[6]})` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="flex min-w-0 flex-col gap-1 text-sm text-carvao">
          <label htmlFor={`${uid}-kwh`} className="rotulo text-mineral">
            {tx("Consumo no mês (kWh)", "Consumption in the month (kWh)")}
          </label>
          <input
            id={`${uid}-kwh`}
            type="number"
            inputMode="numeric"
            min={0}
            max={KWH_MAX}
            step={1}
            value={texto ?? String(kwh)}
            onChange={(e) => {
              setTexto(e.target.value);
              if (kwhValido(e.target.value)) setKwh(Number(e.target.value));
            }}
            onBlur={() => setTexto(null)}
            aria-invalid={kwhInvalido || undefined}
            aria-describedby={`${uid}-kwh-ajuda`}
            className={`min-h-[44px] w-full border bg-superficie px-2 tabular-nums text-carvao ${kwhInvalido ? "border-erro" : "border-linha"}`}
          />
          <span id={`${uid}-kwh-ajuda`} className={`text-xs leading-snug ${kwhInvalido ? "text-erro" : "text-carvao-muted"}`} role={kwhInvalido ? "alert" : undefined}>
            {kwhInvalido
              ? tx(`Digite um número inteiro de 0 a 10.000. A estimativa segue com ${num(kwh, 0)} kWh.`, `Enter a whole number from 0 to 10,000. The estimate stays at ${num(kwh, 0)} kWh.`)
              : tx("O consumo vem na fatura, em kWh.", "Consumption is on the bill, in kWh.")}
          </span>
        </div>
      </form>

      {municipio && (
        <div role="status" className="max-w-prose2 text-sm leading-relaxed text-carvao" data-municipio-escolhido="">
          {municipio.vinculos.length === 0 ? (
            tx(
              <>
                <Nome>{municipio.m.nome}</Nome> ({municipio.m.uf}): a relação da ANEEL não liga o município a uma distribuidora. Escolha a distribuidora na lista.
              </>,
              <>
                <Nome>{municipio.m.nome}</Nome> ({municipio.m.uf}): ANEEL&apos;s list does not link the municipality to a distribution utility. Choose the distribution utility from the list.
              </>,
            )
          ) : municipio.vinculos.length === 1 ? (
            <p>
              <Nome>{municipio.m.nome}</Nome> ({municipio.m.uf}): {tx("atendido por", "served by")} <Nome>{nomeVinculo(municipio.vinculos[0])}</Nome>
              {municipio.vinculos[0].estado === 0 ? tx(", vínculo sem confirmação na relação da ANEEL", ", link not confirmed in ANEEL's list") : ""}
              {porCnpj.has(municipio.vinculos[0].cnpj)
                ? "."
                : tx(
                    `, que não tem tarifa residencial vigente em ${dataBR(dataReferencia)}: a estimativa não é calculada.`,
                    `, which has no residential tariff in force on ${dataBR(dataReferencia)}: the estimate is not calculated.`,
                  )}
            </p>
          ) : (
            <>
              <p>
                <Nome>{municipio.m.nome}</Nome> ({municipio.m.uf}){" "}
                {tx(
                  "tem mais de uma distribuidora. A da sua casa está no alto da fatura; escolha qual é:",
                  "has more than one distribution utility. The one serving your home is at the top of the bill; choose which one:",
                )}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {municipio.vinculos.map((v) => {
                  const tem = porCnpj.has(v.cnpj);
                  const ativo = v.cnpj === cnpj;
                  return (
                    <li key={v.cnpj}>
                      {tem ? (
                        <button
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => setCnpj(v.cnpj)}
                          className={`inline-flex min-h-[44px] items-center border px-3 text-sm transition-[border-color,background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:active:scale-[0.97] ${ativo ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao [@media(hover:hover)]:hover:border-carvao"}`}
                        >
                          <Nome>{nomeVinculo(v)}</Nome>
                          {v.estado === 0 ? <span className="ml-1 text-xs text-carvao-muted">{tx("(vínculo sem confirmação)", "(link not confirmed)")}</span> : null}
                        </button>
                      ) : (
                        <span className="inline-flex min-h-[44px] items-center border border-dashed border-linha px-3 text-sm text-carvao-muted">
                          <Nome>{nomeVinculo(v)}</Nome>
                          <span className="ml-1 text-xs">{tx(`(sem tarifa vigente em ${dataBR(dataReferencia)})`, `(no tariff in force on ${dataBR(dataReferencia)})`)}</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      <section aria-labelledby={`${uid}-resultado`} aria-live="polite" className="border-y border-linha py-6" data-resultado-aperitivo={r?.disponivel ? "calculado" : "vazio"}>
        <h2 id={`${uid}-resultado`} className="rotulo text-mineral">
          {dist ? (
            <>
              {tx("Estimativa mensal,", "Monthly estimate,")} <Nome>{sigla}</Nome>
              {dist[6] ? ` (${dist[6]})` : ""}
            </>
          ) : (
            tx("Estimativa mensal", "Monthly estimate")
          )}
        </h2>
        {!dist ? (
          <p className="mt-3 max-w-prose2 font-serif text-xl leading-snug text-carvao-muted">
            {tx("Escolha o município ou a distribuidora para ver a estimativa.", "Choose the municipality or the distribution utility to see the estimate.")}
          </p>
        ) : r && r.disponivel ? (
          <>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-serif text-[2.5rem] leading-none tabular-nums text-carvao sm:text-[3rem]">{reais(r.total)}</span>
              <span className="text-sm text-carvao-muted">{tx("por mês, sem tributos", "per month, without taxes")}</span>
            </p>
            <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao">
              {tx(
                `${num(kwh, 0)} kWh no mês, classe residencial, ligação ${nomeLigacao(LIGACAO, idioma)}: ${reais(r.energia)} de energia e uso da rede (TE + TUSD)`,
                `${num(kwh, 0)} kWh in the month, residential class, ${nomeLigacao(LIGACAO, idioma)} connection: ${reais(r.energia)} for energy and grid use (TE + TUSD)`,
              )}
              {semBandeira
                ? tx("; a bandeira fica fora porque não há valor publicado.", "; the tariff flag is left out because no value is published.")
                : tx(
                    ` e ${reais(r.bandeira)} da bandeira ${bandeiraNoIdioma(usada?.bandeira ?? "", idioma).toLowerCase()}.`,
                    ` and ${reais(r.bandeira)} for the ${bandeiraNoIdioma(usada?.bandeira ?? "", idioma).toLowerCase()} tariff flag.`,
                  )}
            </p>
            {r.observacoes.length > 0 && (
              <ul className="mt-2 max-w-prose2 space-y-1 text-xs leading-relaxed text-carvao-muted">
                {r.observacoes.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="mt-3 max-w-prose2 text-sm text-carvao-muted">
            {tx("Estimativa indisponível:", "Estimate unavailable:")} {r?.motivo ?? ""}.
          </p>
        )}

        <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm md:grid-cols-3">
          <div className="min-w-0">
            <dt className="rotulo text-mineral">{tx("Bandeira considerada", "Tariff flag considered")}</dt>
            <dd className="mt-1 leading-relaxed text-carvao" data-bandeira-estado={situacao.estado} data-bandeira-mes={mesCorrente}>
              {situacao.estado === "corrente" ? (
                fraseBandeira(situacao, idioma)
              ) : (
                <>
                  <span className="font-medium">
                    {usada?.bandeira
                      ? `${bandeiraNoIdioma(usada.bandeira, idioma)}, ${mesAno(`${usada.mes}-01`)}${
                          usada.rs_mwh === null ? tx(", sem valor publicado", ", no published value") : usada.rs_mwh === 0 ? tx(", sem acréscimo", ", no surcharge") : `, ${reais(usada.rs_mwh / 1000, 5)}/kWh`
                        }.`
                      : tx("Nenhuma: não há bandeira publicada.", "None: no tariff flag is published.")}
                  </span>{" "}
                  <span className="text-carvao-muted">
                    {fraseBandeira(situacao, idioma)}
                    {situacao.estado === "mes_ausente"
                      ? tx(" A estimativa usa a última registrada, que não é a do mês corrente.", " The estimate uses the latest recorded one, which is not the current month's.")
                      : ""}
                  </span>
                </>
              )}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="rotulo text-mineral">{tx("Data da tarifa", "Tariff date")}</dt>
            <dd className="mt-1 leading-relaxed text-carvao">
              {dist
                ? tx(
                    <>
                      Vigência iniciada em {dataBR(dist[2])} (<Nome>{dist[3]}</Nome>), em vigor no arquivo de {dataBR(dataReferencia)}.
                    </>,
                    <>
                      Validity period started on {dataBR(dist[2])} (<Nome>{dist[3]}</Nome>), in force in the file of {dataBR(dataReferencia)}.
                    </>,
                  )
                : tx(`Tarifas em vigor no arquivo de ${dataBR(dataReferencia)}.`, `Tariffs in force in the file of ${dataBR(dataReferencia)}.`)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="rotulo text-mineral">{tx("Fonte", "Source")}</dt>
            <dd className="mt-1 leading-relaxed text-carvao">
              {tx("ANEEL, tarifas de aplicação das distribuidoras (tarifa B1 residencial convencional).", "ANEEL, applied tariffs of the distribution utilities (conventional residential B1 tariff).")}{" "}
              <span className="text-carvao-muted">{fonteBandeira(bandeiraVigente, idioma)}</span>
            </dd>
          </div>
        </dl>
      </section>

      <p className="max-w-prose2 border-l-2 border-energia pl-4 text-sm leading-relaxed text-carvao" data-ressalva-aperitivo="">
        <span className="font-medium">{tx("Não é a fatura.", "It is not the bill.")}</span>{" "}
        {tx(
          "Faltam ICMS, PIS/Pasep, Cofins e a contribuição de iluminação pública, que mudam por estado e por município; multas, parcelamentos e serviços também ficam fora.",
          "ICMS, PIS/Pasep, Cofins and the public lighting contribution are missing, and they vary by state and municipality; fines, installments and services are also left out.",
        )}
      </p>
    </div>
  );
}
