"use client";

import { useMemo } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { TARIFAS, type TarifaVerificada } from "@/lib/saneamento/tarifas";
import { CABECALHO_EXPORTACAO, acimaDoLimite, calcularConta, leituras, linhasExportacao } from "@/lib/saneamento/conta";
import { baixarCsv } from "@/lib/saneamento/csv";
import { numero, reais } from "@/lib/saneamento/formato";

const controle = "mt-1 min-h-[44px] w-full min-w-0 border border-mineral bg-superficie px-3 py-2 text-sm text-carvao";
const PRESETS = [5, 10, 15, 20];

/** Rótulo curto da tabela para gráficos: sigla, UF e recorte. */
function curto(t: TarifaVerificada) {
  const sigla = t.prestador.match(/\(([^)]+)\)/)?.[1] ?? t.prestador;
  const recorte = t.id.endsWith("curitiba") ? ", Curitiba" : t.id.endsWith("demais") ? ", demais" : t.id.endsWith("t1") ? ", Tabela 1" : "";
  return `${sigla} (${t.uf}${recorte})`;
}

/** Categoria equivalente entre tabelas para a comparação padronizada. */
function categoriaComparavel(t: TarifaVerificada, tipo: "residencial" | "social"): string | null {
  if (tipo === "residencial") return "residencial";
  const prefer = ["social_2", "social", "social_pernambucana"];
  return prefer.find((k) => k in t.categorias) ?? null;
}

export function SimuladorConta() {
  const esquema = useMemo(
    () => ({
      t: campo(tiposUrl.opcao(TARIFAS.map((t) => t.id)), TARIFAS[0].id),
      cat: campo(tiposUrl.texto({ max: 40 }), "residencial"),
      m3: campo(tiposUrl.numero({ min: 0, max: 100 }), 10, { historico: "replace" }),
      ad: campo(tiposUrl.booleano(), false),
      comp: campo(tiposUrl.opcao(["residencial", "social"] as const), "residencial"),
    }),
    [],
  );
  const [s, set] = useEstadoUrl(esquema);
  const t = TARIFAS.find((x) => x.id === s.t) ?? TARIFAS[0];
  const catId = s.cat in t.categorias ? s.cat : "residencial";
  const cat = t.categorias[catId];
  const consumo = Math.round(s.m3 * 10) / 10;
  const adicionais = s.ad && t.adicionais ? t.adicionais : [];
  const fora = acimaDoLimite(cat, consumo);
  const conta = fora ? null : calcularConta(cat, consumo, adicionais);
  const l = fora ? null : leituras(t, catId, consumo);

  const comparacao = useMemo(
    () =>
      TARIFAS.map((x) => {
        const k = categoriaComparavel(x, s.comp);
        const c = k && !acimaDoLimite(x.categorias[k], consumo) ? calcularConta(x.categorias[k], consumo) : null;
        return {
          id: x.id,
          rotulo: `${curto(x)}${k && k !== "residencial" ? `: ${x.categorias[k].rotulo}` : ""}`,
          agua: c?.agua ?? null,
          esgoto: c ? (c.esgoto ?? null) : null,
        };
      }),
    [consumo, s.comp],
  );
  const curva = useMemo(() => {
    const pts: Record<string, number | string | null>[] = [];
    for (let c = 0; c <= 40; c++) {
      const p: Record<string, number | string | null> = { consumo: String(c) };
      for (const x of TARIFAS) p[x.id] = calcularConta(x.categorias.residencial, c).total;
      pts.push(p);
    }
    return pts;
  }, []);
  const cores = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)", "var(--escala-seq-3)", "var(--san-div-neg-2)", "var(--escala-seq-5)", "var(--san-div-neg-1)", "var(--serie-comp-5)"];

  const exportar = () => baixarCsv("saneamento-contas-simuladas.csv", CABECALHO_EXPORTACAO, linhasExportacao(TARIFAS));

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 border border-linha bg-superficie p-4 md:grid-cols-[2fr_1.4fr_1fr]">
        <label className="min-w-0 text-sm text-carvao">
          Tabela verificada
          <select aria-label="Tabela verificada" className={controle} value={t.id} onChange={(e) => set({ t: e.target.value, cat: "residencial" })}>
            {TARIFAS.map((x) => (
              <option key={x.id} value={x.id}>
                {curto(x)} · {x.regulador}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-sm text-carvao">
          Categoria
          <select aria-label="Categoria" className={controle} value={catId} onChange={(e) => set({ cat: e.target.value })}>
            {Object.entries(t.categorias).map(([k, c]) => (
              <option key={k} value={k}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </label>
        <div className="min-w-0 text-sm text-carvao">
          <label htmlFor="sim-m3">Consumo no mês (m³)</label>
          <input
            id="sim-m3"
            type="number"
            min={0}
            max={100}
            step={1}
            inputMode="decimal"
            value={consumo}
            onChange={(e) => set({ m3: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            className={controle}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 md:col-span-3">
          <span className="text-sm text-carvao-muted">Consumos de referência:</span>
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={consumo === p}
              onClick={() => set({ m3: p })}
              className={`inline-flex min-h-[44px] min-w-[56px] items-center justify-center border px-3 text-sm ${consumo === p ? "border-obee bg-obee-fundo text-carvao" : "border-mineral text-carvao hover:border-obee"}`}
            >
              {p} m³
            </button>
          ))}
          {t.adicionais?.map((a) => (
            <label key={a.id} className="ml-2 inline-flex min-h-[44px] items-center gap-2 text-sm text-carvao">
              <input type="checkbox" checked={s.ad} onChange={(e) => set({ ad: e.target.checked })} />
              Incluir {a.rotulo}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="fatura-titulo" className="min-w-0">
          <h3 id="fatura-titulo" className="font-serif text-xl text-carvao">
            Conta simulada: {cat.rotulo.toLowerCase()}, {numero(consumo, consumo % 1 ? 1 : 0)} m³, 1 economia
          </h3>
          <p className="mt-1 text-sm text-carvao-muted">
            {t.prestador} · {t.ato} · {t.vigencia}
          </p>
          {!conta ? (
            <p className="mt-4 border-l-2 border-aviso pl-3 text-sm text-carvao-muted">
              O ato só define preço para esta categoria até {numero(cat.consumoMaximo ?? 0, 0)} m³ por mês. Para {numero(consumo, consumo % 1 ? 1 : 0)} m³ o simulador não calcula a
              conta, porque não há regra publicada para o volume acima do teto.
            </p>
          ) : (
          <div className="tabela-scroll mt-4" tabIndex={0} role="region" aria-label="Decomposição da conta (rolável)">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <caption className="sr-only">Decomposição da conta simulada por serviço e faixa de consumo</caption>
              <thead>
                <tr className="border-b border-carvao text-left">
                  <th scope="col" className="py-2 pr-3 font-medium">Item</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Volume (m³)</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Preço (R$/m³)</th>
                  <th scope="col" className="py-2 text-right font-medium">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {(["agua", "esgoto", "adicional"] as const).map((sv) => {
                  const ls = conta.linhas.filter((x) => x.servico === sv);
                  if (!ls.length) return null;
                  return [
                    <tr key={sv + "-t"} className="border-b border-linha bg-papel">
                      <th scope="rowgroup" colSpan={4} className="py-1.5 text-left text-xs font-medium uppercase tracking-label text-mineral">
                        {sv === "agua" ? "Água" : sv === "esgoto" ? "Esgoto" : "Cobranças adicionais"}
                      </th>
                    </tr>,
                    ...ls.map((x, i) => (
                      <tr key={sv + i} className="border-b border-linha">
                        <th scope="row" className="py-1.5 pr-3 text-left font-normal text-carvao">{x.rotulo}</th>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-carvao-muted">{x.volume == null ? "" : numero(x.volume, x.volume % 1 ? 1 : 0)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-carvao-muted">{x.preco == null ? "" : numero(x.preco, x.preco * 100 % 1 ? 3 : 2)}</td>
                        <td className="py-1.5 text-right tabular-nums text-carvao">{numero(x.valor, 2)}</td>
                      </tr>
                    )),
                  ];
                })}
                <tr className="border-t-2 border-carvao">
                  <th scope="row" colSpan={3} className="py-2 text-left font-medium text-carvao">Total do mês</th>
                  <td className="py-2 text-right font-serif text-xl tabular-nums text-carvao">{reais(conta.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          )}
          {cat.esgotoNaoVerificado && <p className="mt-3 border-l-2 border-aviso pl-3 text-sm text-carvao-muted">{cat.esgotoNaoVerificado}</p>}
          {t.metodoNaoVerificado && <p className="mt-3 border-l-2 border-aviso pl-3 text-sm text-carvao-muted">{t.metodoNaoVerificado}</p>}
          <p className="mt-3 text-xs leading-relaxed text-carvao-muted">
            Inclui só o que a tabela verificada define. Ficam fora: tributos destacados à parte quando houver, multas, juros, serviços avulsos,
            taxas municipais (como a de lixo) e regras de quem tem mais de uma economia por medidor. A conta real depende do perfil completo do
            imóvel.
          </p>
        </section>
        <aside aria-label="Leituras da conta" className="border-t border-linha pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          {!conta || !l ? (
            <p className="text-sm text-carvao-muted">Conta não calculada: consumo acima do teto que o ato define para esta categoria.</p>
          ) : (
          <dl className="space-y-5 text-sm">
            <div>
              <dt className="text-carvao-muted">Conta total</dt>
              <dd className="font-serif text-3xl tabular-nums text-carvao">{reais(conta.total)}</dd>
              <dd className="text-xs text-carvao-muted">
                Água {reais(conta.agua)}
                {conta.esgoto != null ? ` · esgoto ${reais(conta.esgoto)}` : " · esgoto não simulado"}
                {conta.adicionais ? ` · adicionais ${reais(conta.adicionais)}` : ""}
              </dd>
            </div>
            <div className="border-t border-linha pt-4">
              <dt className="text-carvao-muted">Preço médio efetivo</dt>
              <dd className="font-serif text-2xl tabular-nums text-carvao">{l.precoMedio == null ? "não se aplica" : `${reais(l.precoMedio)}/m³`}</dd>
              <dd className="text-xs text-carvao-muted">Conta sem adicionais dividida pelo consumo. Com valor mínimo ou parte fixa, cai à medida que o consumo sobe até a faixa seguinte.</dd>
            </div>
            <div className="border-t border-linha pt-4">
              <dt className="text-carvao-muted">Custo de mais 1 m³</dt>
              <dd className="font-serif text-2xl tabular-nums text-carvao">{l.m3Adicional == null ? "não definido no ato" : reais(l.m3Adicional)}</dd>
              <dd className="text-xs text-carvao-muted">Quanto a conta sobe ao passar de {numero(consumo, consumo % 1 ? 1 : 0)} para {numero(consumo + 1, consumo % 1 ? 1 : 0)} m³ (água e esgoto).</dd>
            </div>
          </dl>
          )}
        </aside>
      </div>

      <section aria-labelledby="comparar-titulo" className="mt-12">
        <h3 id="comparar-titulo" className="font-serif text-xl text-carvao">
          Mesmo consumo, tabelas diferentes
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
          <span className="text-carvao-muted">Comparar a categoria</span>
          <label className="inline-flex min-h-[44px] items-center gap-2">
            <input type="radio" name="sim-comp" checked={s.comp === "residencial"} onChange={() => set({ comp: "residencial" })} /> Residencial
          </label>
          <label className="inline-flex min-h-[44px] items-center gap-2">
            <input type="radio" name="sim-comp" checked={s.comp === "social"} onChange={() => set({ comp: "social" })} /> Social, quando houver
          </label>
        </div>
        <GraficoBarras
          titulo={`Conta de ${numero(consumo, consumo % 1 ? 1 : 0)} m³ por tabela verificada, ${s.comp === "residencial" ? "categoria residencial" : "categoria social"} (R$ por mês, 1 economia)`}
          dados={comparacao}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={[
            { id: "agua", rotulo: "Água", cor: "var(--cor-obee)" },
            { id: "esgoto", rotulo: "Esgoto", cor: "var(--escala-seq-2)" },
          ]}
          unidade="R$"
          casas={2}
          orientacao="horizontal"
          empilhado
          rotulosValor
          selecionado={t.id}
          onSelecionar={(id) => id && set({ t: id })}
        />
        <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
          Consumo, número de economias e tipo de esgoto (convencional) são os mesmos em todas as barras. Mudam o ato e a data de vigência de cada
          tabela, que estão na ficha abaixo. Barra ausente: a categoria não tem preço definido no ato para o consumo escolhido (a social da Saneago acima de 20 m³) ou, no esgoto, a cobrança não foi verificada. A diferença de conta não mede qualidade
          nem eficiência do prestador.
        </p>
      </section>

      <section aria-labelledby="curva-titulo" className="mt-12">
        <h3 id="curva-titulo" className="sr-only">
          Conta residencial de 0 a 40 m³
        </h3>
        <GraficoLinhas
          titulo="Conta residencial de água e esgoto conforme o consumo, de 0 a 40 m³ (R$ por mês)"
          dados={curva}
          chaveX="consumo"
          series={TARIFAS.map((x, i) => ({ id: x.id, rotulo: curto(x), cor: cores[i % cores.length] }))}
          unidade="R$"
          casas={2}
          formatoX="texto"
          zeroNoEixo
          rotulosDiretos
        />
        <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
          Os degraus são as faixas: onde a curva fica plana, o valor mínimo cobre o consumo; onde ela empina, cada metro cúbico custa mais.
        </p>
      </section>

      <div className="mt-8">
        <button type="button" onClick={exportar} className="inline-flex min-h-[44px] items-center border border-obee px-4 text-sm font-medium text-obee-dark hover:bg-obee-fundo">
          Baixar CSV: todas as tabelas e categorias a 5, 10, 15, 20 e 30 m³
        </button>
      </div>
    </div>
  );
}
