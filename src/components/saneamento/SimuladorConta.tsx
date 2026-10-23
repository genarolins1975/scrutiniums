"use client";

import { useMemo } from "react";
import { ExportacaoComConta } from "@/components/acesso/ExportacaoComConta";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { Controles } from "@/components/painel/Controles";
import { FaixaNumeros } from "@/components/painel/FaixaNumeros";
import { GraficoBarras } from "@/components/painel/GraficoBarras";
import { NumeroIndicador } from "@/components/painel/NumeroIndicador";
import { TabelaDados } from "@/components/painel/TabelaDados";
import { useEstadoUrl } from "@/components/painel/useEstadoUrl";
import type { CelulaTabela, NumeroProps } from "@/lib/painel/tipos";
import { TARIFAS } from "@/lib/saneamento/tarifas";
import { CABECALHO_EXPORTACAO, acimaDoLimite, arredondamentoDifere, calcularConta, leituras, linhasExportacao, somasExibidas } from "@/lib/saneamento/conta";
import { baixarCsv } from "@/lib/saneamento/csv";
import { numero, reais } from "@/lib/saneamento/formato";
import { ESQUEMA_SIMULADOR, PRESETS, categoriaComparavel, curto } from "@/lib/saneamento/simulador";

/**
 * Simulador da conta de água e esgoto (capítulo 5.1) no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): em vez de um
 * bloco só, ilhas que leem e escrevem o mesmo recorte da URL (?t=, ?cat=, ?m3=, ?ad=, ?comp=) e se avisam pelo useEstadoUrl. Os
 * controles são a ação da abertura; as três leituras da conta, a faixa de números; a comparação entre tabelas, uma figura; a
 * decomposição por faixa, a tabela; o CSV, o método. O cálculo é o mesmo de antes (src/lib/saneamento/conta.ts).
 */

const controle = "mt-1 min-h-[44px] w-full min-w-0 border border-mineral bg-superficie px-3 py-2 text-sm text-carvao";

/** O estado da simulação e o que se calcula dele; cada ilha chama o seu, sincronizado pela URL. */
function useSimulador() {
  const [s, set] = useEstadoUrl(ESQUEMA_SIMULADOR);
  const t = TARIFAS.find((x) => x.id === s.t) ?? TARIFAS[0];
  const catId = s.cat in t.categorias ? s.cat : "residencial";
  const cat = t.categorias[catId];
  const consumo = Math.round(s.m3 * 10) / 10;
  const adicionais = s.ad && t.adicionais ? t.adicionais : [];
  const fora = acimaDoLimite(cat, consumo);
  const conta = fora ? null : calcularConta(cat, consumo, adicionais);
  const l = fora ? null : leituras(t, catId, consumo);
  // volume faturado pela tabela escolhida (inteiro quando o prestador despreza a fração de m³) e o que é mostrado ao leitor
  const efetivo = conta?.consumo ?? consumo;
  const fmtC = (x: number) => numero(x, x % 1 ? 1 : 0);
  return { s, set, t, catId, cat, consumo, conta, l, efetivo, fmtC };
}

/** A primeira ação da página: tabela verificada, categoria, consumo do mês, consumos de referência e cobranças adicionais. */
export function SimuladorControles() {
  const { s, set, t, catId, consumo } = useSimulador();
  return (
    <Controles rotulo="Simulação da conta" idioma="pt">
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-[2fr_1.4fr_1fr]">
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
    </Controles>
  );
}

/**
 * As três leituras da conta simulada, na faixa de números do kit: a conta total, o preço médio efetivo e quanto custa o metro cúbico
 * seguinte. Acima do teto do ato, a conta não é calculada e aparece como ausência com o motivo, nunca como zero.
 */
export function SimuladorNumeros() {
  const { t, cat, consumo, conta, l, efetivo, fmtC } = useSimulador();
  const comum = { periodo: t.vigencia, fonte: `${t.regulador}, ${t.ato}`, natureza: "CALCULADO" as const, recorte: `${t.prestador}, ${cat.rotulo.toLowerCase()}, ${fmtC(efetivo)} m³` };
  const teto = `O ato só define preço para esta categoria até ${numero(cat.consumoMaximo ?? 0, 0)} m³ por mês. Para ${numero(consumo, consumo % 1 ? 1 : 0)} m³ o simulador não calcula a conta, porque não há regra publicada para o volume acima do teto.`;
  const numeros: NumeroProps[] = !conta || !l
    ? [
        { ...comum, rotulo: "Conta total", valor: null, unidade: "por mês", motivoAusencia: teto },
        { ...comum, rotulo: "Preço médio efetivo", valor: null, unidade: "R$/m³", motivoAusencia: "Conta não calculada: consumo acima do teto que o ato define para esta categoria." },
        { ...comum, rotulo: "Custo de mais 1 m³", valor: null, unidade: "R$", motivoAusencia: "Conta não calculada: consumo acima do teto que o ato define para esta categoria." },
      ]
    : [
        {
          ...comum,
          rotulo: "Conta total",
          valor: conta.total,
          valorTexto: reais(conta.total),
          unidade: "por mês",
          nota: (
            <>
              Água {reais(conta.agua)}
              {conta.esgoto != null ? ` · esgoto ${reais(conta.esgoto)}` : " · esgoto não simulado"}
              {conta.adicionais ? ` · adicionais ${reais(conta.adicionais)}` : ""}
            </>
          ),
        },
        l.precoMedio == null
          ? { ...comum, rotulo: "Preço médio efetivo", formato: "texto", valorTexto: "não se aplica", unidade: "", nota: "Conta sem adicionais dividida pelo consumo. Com valor mínimo ou parte fixa, cai à medida que o consumo sobe até a faixa seguinte." }
          : {
              ...comum,
              rotulo: "Preço médio efetivo",
              valor: l.precoMedio,
              valorTexto: `${reais(l.precoMedio)}/m³`,
              unidade: "",
              nota: "Conta sem adicionais dividida pelo consumo. Com valor mínimo ou parte fixa, cai à medida que o consumo sobe até a faixa seguinte.",
            },
        l.m3Adicional == null
          ? { ...comum, rotulo: "Custo de mais 1 m³", formato: "texto", valorTexto: "não definido no ato", unidade: "", nota: `Quanto a conta sobe ao passar de ${fmtC(efetivo)} para ${fmtC(efetivo + 1)} m³ (água e esgoto).` }
          : { ...comum, rotulo: "Custo de mais 1 m³", valor: l.m3Adicional, valorTexto: reais(l.m3Adicional), unidade: "", nota: `Quanto a conta sobe ao passar de ${fmtC(efetivo)} para ${fmtC(efetivo + 1)} m³ (água e esgoto).` },
      ];
  return (
    <FaixaNumeros rotulo="Leituras da conta" nota="Três leituras diferentes: a conta total, o preço médio efetivo e quanto custa o metro cúbico seguinte." idioma="pt">
      {numeros.map((n) => (
        <NumeroIndicador key={n.rotulo} {...n} tamanho={n.rotulo === "Conta total" ? "g" : "m"} idioma="pt" />
      ))}
    </FaixaNumeros>
  );
}

/** A decomposição da conta simulada por serviço e faixa (fatia `tabelas`), com os avisos que acompanham a conta. */
export function SimuladorFatura() {
  const { t, cat, consumo, conta, efetivo, fmtC } = useSimulador();
  // somas que o leitor vê (linhas da tabela e subtotais) e quais delas não fecham com o total
  const somas = conta ? somasExibidas(conta) : null;
  const partesQueDiferem =
    conta && somas && arredondamentoDifere(conta)
      ? [
          Math.round(somas.linhas * 100) !== Math.round(conta.total * 100) ? `as linhas da tabela somam ${reais(somas.linhas)}` : null,
          Math.round(somas.servicos * 100) !== Math.round(conta.total * 100) ? `água, esgoto e adicionais somam ${reais(somas.servicos)}` : null,
        ].filter((x): x is string => x != null)
      : [];
  const SERVICO = { agua: "Água", esgoto: "Esgoto", adicional: "Cobranças adicionais" } as const;
  const linhas: CelulaTabela[][] = conta
    ? [
        ...(["agua", "esgoto", "adicional"] as const).flatMap((sv) => conta.linhas.filter((x) => x.servico === sv).map((x) => [x.rotulo, SERVICO[sv], x.volume, x.preco, x.valor] as CelulaTabela[])),
        ["Total do mês", "", null, null, conta.total],
      ]
    : [];
  // a precisão é a da regra de antes: volume com uma casa quando há fração; preço com três casas quando a tabela tem milésimos
  const casasVolume = conta?.linhas.some((x) => x.volume != null && x.volume % 1 !== 0) ? 1 : 0;
  const casasPreco = conta?.linhas.some((x) => x.preco != null && (x.preco * 100) % 1 !== 0) ? 3 : 2;
  const avisos = (
    <>
      {conta && somas && partesQueDiferem.length > 0 && (
        <span className="block">
          Cada valor é arredondado ao centavo e o total é arredondado uma só vez, sobre a soma sem arredondar: aqui {partesQueDiferem.join(" e ")}, e o total é {reais(conta.total)}. Nenhum ato
          consultado define a regra de arredondamento.
        </span>
      )}
      {cat.esgotoNaoVerificado && <span className="mt-3 block border-l-2 border-aviso pl-3">{cat.esgotoNaoVerificado}</span>}
      {t.metodoNaoVerificado && <span className="mt-3 block border-l-2 border-aviso pl-3">{t.metodoNaoVerificado}</span>}
      <span className="mt-3 block">
        Inclui só o que a tabela verificada define. Ficam fora: tributos destacados à parte quando houver, multas, juros, serviços avulsos, taxas municipais (como a de lixo) e regras de quem tem
        mais de uma economia por medidor. A conta real depende do perfil completo do imóvel.
      </span>
    </>
  );
  return (
    <Recolhido
      id="fatura"
      aberto
      nivelTitulo={2}
      titulo={`Conta simulada: ${cat.rotulo.toLowerCase()}, ${fmtC(efetivo)} m³, 1 economia`}
      resumo={`${t.prestador} · ${t.ato} · ${t.vigencia}`}
    >
      <div className="space-y-3 pb-6">
        {conta && efetivo !== consumo && (
          <p className="text-sm text-carvao-muted">
            Esta tabela despreza a fração de metro cúbico: {fmtC(consumo)} m³ informados, {fmtC(efetivo)} m³ faturados.
          </p>
        )}
        {!conta ? (
          <>
            <p className="border-l-2 border-aviso pl-3 text-sm text-carvao-muted">
              O ato só define preço para esta categoria até {numero(cat.consumoMaximo ?? 0, 0)} m³ por mês. Para {numero(consumo, consumo % 1 ? 1 : 0)} m³ o simulador não calcula a conta, porque
              não há regra publicada para o volume acima do teto.
            </p>
            <p className="t-meta max-w-prose2 text-carvao-muted">{avisos}</p>
          </>
        ) : (
          <TabelaDados
            titulo="Decomposição da conta simulada por serviço e faixa de consumo"
            colunas={["Item", "Serviço", "Volume (m³)", "Preço (R$/m³)", "Valor (R$)"]}
            linhas={linhas}
            casas={[null, null, casasVolume, casasPreco, 2]}
            limite={linhas.length}
            recolhida={false}
            destaqueUltimaLinha
            ausencia={{ "Volume (m³)": "não se aplica", "Preço (R$/m³)": "não se aplica" }}
            nota={avisos}
            idioma="pt"
          />
        )}
      </div>
    </Recolhido>
  );
}

/** "Mesmo consumo, tabelas diferentes": a categoria da comparação (controle junto da figura) e as barras empilhadas de água e esgoto. */
export function SimuladorComparacao() {
  const { s, set, t, consumo } = useSimulador();
  const algumaInteira = TARIFAS.some((x) => Object.values(x.categorias).some((c) => c.consumoInteiro));
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
  return (
    <div className="space-y-3">
      <Controles rotulo="Categoria da comparação" idioma="pt">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-carvao-muted">Comparar a categoria</span>
          <label className="inline-flex min-h-[44px] items-center gap-2">
            <input type="radio" name="sim-comp" checked={s.comp === "residencial"} onChange={() => set({ comp: "residencial" })} /> Residencial
          </label>
          <label className="inline-flex min-h-[44px] items-center gap-2">
            <input type="radio" name="sim-comp" checked={s.comp === "social"} onChange={() => set({ comp: "social" })} /> Social, quando houver
          </label>
        </div>
      </Controles>
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
      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        Consumo, número de economias e tipo de esgoto (convencional) são os mesmos em todas as barras
        {algumaInteira && consumo % 1 !== 0 ? ", salvo nas tabelas que desprezam a fração de metro cúbico (Corsan), que usam a parte inteira" : ""}. Mudam o ato e a data de vigência de cada
        tabela, que estão na ficha abaixo. Barra ausente: a categoria não tem preço definido no ato para o consumo escolhido (a social da Saneago acima de 20 m³ e a da Corsan acima de 15 m³) ou, no
        esgoto, a cobrança não foi verificada. A diferença de conta não mede qualidade nem eficiência do prestador.
      </p>
    </div>
  );
}

/** O CSV de todas as tabelas e categorias, montado no navegador: na página aberta, só com sessão (ExportacaoComConta). */
export function SimuladorExportacao() {
  const exportar = () => baixarCsv("saneamento-contas-simuladas.csv", CABECALHO_EXPORTACAO, linhasExportacao(TARIFAS));
  return (
    <ExportacaoComConta rotulo="Baixar CSV: todas as tabelas e categorias a 5, 10, 15, 20 e 30 m³">
      <button type="button" onClick={exportar} className="inline-flex min-h-[44px] items-center border border-obee px-4 text-sm font-medium text-obee-dark hover:bg-obee-fundo">
        Baixar CSV: todas as tabelas e categorias a 5, 10, 15, 20 e 30 m³
      </button>
    </ExportacaoComConta>
  );
}
