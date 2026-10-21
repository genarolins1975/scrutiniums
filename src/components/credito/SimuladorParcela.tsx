"use client";

import { useEffect, useId, useState } from "react";
import { calcular, compararComCet, problemaDaEntrada, taxaAnualDeMensal, taxaMensalDeAnual } from "@/lib/credito/parcela";
import { num, reais } from "@/lib/credito/formato";

export type TaxaReferencia = {
  /** % ao ano, como publicado (banco) ou a mediana da modalidade. */
  aa: number;
  /** % ao mês como publicado pelo Banco Central, quando a referência é a taxa do banco. */
  am: number | null;
  origem: "banco" | "mediana";
  /** De onde vem a taxa, em uma frase: "Taxa publicada de BCO X em ...". */
  descricao: string;
};

type Iniciais = { valor: string; prazo: string; taxa: string; unidade: "aa" | "am"; cet: string };

/** Número digitado no padrão brasileiro ("10.000,50") ou com ponto decimal ("10000.5"). Vazio ou inválido: NaN. */
export function lerNumero(txt: string): number {
  const limpo = txt.replace(/R\$|%|\s/g, "");
  if (!limpo) return Number.NaN;
  // com vírgula, o ponto é separador de milhar; sem vírgula, "10.000" (grupos de três) também é milhar e "22.48", decimal
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(limpo) ? limpo.replace(/\./g, "") : limpo;
  return /^-?\d+(\.\d+)?$/.test(normal) ? Number(normal) : Number.NaN;
}

const campo =
  "mt-1 block min-h-[44px] w-full border border-linha bg-superficie px-3 text-base tabular-nums text-carvao focus:border-bronze focus:outline-none focus:ring-2 focus:ring-bronze/30";

/**
 * Simulador do custo da dívida: parcela pela tabela Price, total pago e juros totais, com a taxa publicada pelo
 * Banco Central para o banco e a modalidade (ou a mediana da modalidade), que o leitor pode trocar pela sua; e, se o
 * leitor informar o CET do contrato, quanto o custo total muda. Os campos ficam no endereço (?valor=&prazo=&taxa=&cet=)
 * para compartilhar o cálculo. Rotulado como cálculo: não é previsão nem oferta.
 */
export function SimuladorParcela({
  referencia,
  mediana,
  iniciais,
}: {
  referencia: TaxaReferencia;
  /** Mediana da modalidade, % ao ano, para a comparação (null quando a referência já é a mediana). */
  mediana: number | null;
  iniciais: Iniciais;
}) {
  const id = useId();
  const taxaPadrao = num(referencia.aa, 2);
  const [valorTxt, setValor] = useState(iniciais.valor);
  const [prazoTxt, setPrazo] = useState(iniciais.prazo);
  const [unidade, setUnidade] = useState<"aa" | "am">(iniciais.unidade);
  const [taxaTxt, setTaxa] = useState(iniciais.taxa || (iniciais.unidade === "am" ? num(referencia.am ?? taxaMensalDeAnual(referencia.aa), 2) : taxaPadrao));
  const [cetTxt, setCet] = useState(iniciais.cet);

  const valor = lerNumero(valorTxt);
  const meses = lerNumero(prazoTxt);
  const taxaDigitada = lerNumero(taxaTxt);
  const anualPct = unidade === "aa" ? taxaDigitada : taxaAnualDeMensal(taxaDigitada);
  const cet = lerNumero(cetTxt);
  const entrada = { valor, meses, anualPct };
  const problema = taxaTxt.trim() === "" ? "Informe a taxa de juros." : problemaDaEntrada(entrada);
  const resultado = problema ? null : calcular(entrada);

  // a taxa é a publicada enquanto o leitor não a muda (a referência do banco já vem com a taxa mensal publicada)
  const padraoNaUnidade = unidade === "aa" ? taxaPadrao : num(referencia.am ?? taxaMensalDeAnual(referencia.aa), 2);
  const taxaPropria = taxaTxt.trim() !== padraoNaUnidade;

  const cetValido = cetTxt.trim() !== "" && Number.isFinite(cet) && cet >= 0 && !problema;
  const problemaCet = cetTxt.trim() !== "" && !(Number.isFinite(cet) && cet >= 0) ? "Informe o CET em % ao ano, por exemplo 35,40." : null;
  const comparacao = cetValido && !problemaDaEntrada({ ...entrada, anualPct: cet }) ? compararComCet(entrada, cet) : null;
  const comMediana = mediana !== null && !problema ? calcular({ ...entrada, anualPct: mediana }) : null;

  // estado no endereço, para compartilhar o cálculo; a taxa só entra quando o leitor a mudou
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const p = new URLSearchParams(window.location.search);
        const definir = (k: string, v: string) => (v.trim() ? p.set(k, v.trim()) : p.delete(k));
        definir("valor", valorTxt);
        definir("prazo", prazoTxt);
        definir("taxa", taxaPropria ? taxaTxt : "");
        definir("un", unidade === "am" ? "am" : "");
        definir("cet", cetTxt);
        const novo = `${window.location.pathname}?${p.toString()}${window.location.hash}`;
        if (novo !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, "", novo);
      } catch {
        // sem acesso ao histórico (moldura, modo restrito): o cálculo segue funcionando
      }
    }, 300);
    return () => clearTimeout(t);
  }, [valorTxt, prazoTxt, taxaTxt, unidade, cetTxt, taxaPropria]);

  function trocarUnidade(nova: "aa" | "am") {
    if (nova === unidade) return;
    const v = lerNumero(taxaTxt);
    if (Number.isFinite(v)) {
      // mantém o significado da taxa: converte o valor digitado para a unidade nova; a publicada volta ao valor publicado
      if (!taxaPropria) setTaxa(nova === "aa" ? taxaPadrao : num(referencia.am ?? taxaMensalDeAnual(referencia.aa), 2));
      else setTaxa(num(nova === "aa" ? taxaAnualDeMensal(v) : taxaMensalDeAnual(v), 2));
    }
    setUnidade(nova);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <form className="space-y-5" onSubmit={(e) => e.preventDefault()} aria-describedby={`${id}-sobre`}>
        <p id={`${id}-sobre`} className="sr-only">
          O resultado é atualizado a cada alteração.
        </p>
        <label className="block text-sm text-carvao-muted">
          Valor do empréstimo, em reais
          <input inputMode="decimal" name="valor" value={valorTxt} onChange={(e) => setValor(e.target.value)} className={campo} autoComplete="off" />
        </label>
        <label className="block text-sm text-carvao-muted">
          Prazo, em meses
          <input inputMode="numeric" name="prazo" value={prazoTxt} onChange={(e) => setPrazo(e.target.value)} className={campo} autoComplete="off" />
        </label>
        <fieldset>
          <legend className="text-sm text-carvao-muted">Taxa de juros</legend>
          <div className="mt-1 flex gap-2">
            <input
              inputMode="decimal"
              name="taxa"
              aria-label={`Taxa de juros, em % ${unidade === "aa" ? "ao ano" : "ao mês"}`}
              value={taxaTxt}
              onChange={(e) => setTaxa(e.target.value)}
              className={`${campo} mt-0 flex-1`}
              autoComplete="off"
            />
            <div role="radiogroup" aria-label="Unidade da taxa" className="flex">
              {(["aa", "am"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  role="radio"
                  aria-checked={unidade === u}
                  onClick={() => trocarUnidade(u)}
                  className={`min-h-[44px] min-w-[4.5rem] border px-2 text-sm ${unidade === u ? "border-carvao bg-carvao text-superficie" : "border-linha bg-superficie text-carvao-muted hover:text-carvao"}`}
                >
                  % {u === "aa" ? "ao ano" : "ao mês"}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
            {taxaPropria ? (
              <>
                Taxa digitada por você.{" "}
                <button type="button" className="text-carvao underline decoration-linha underline-offset-4" onClick={() => setTaxa(padraoNaUnidade)}>
                  Voltar à taxa publicada ({padraoNaUnidade}% {unidade === "aa" ? "ao ano" : "ao mês"})
                </button>
              </>
            ) : (
              referencia.descricao
            )}
          </p>
        </fieldset>
        <label className="block text-sm text-carvao-muted">
          CET informado pelo banco no contrato, em % ao ano (opcional)
          <input inputMode="decimal" name="cet" value={cetTxt} onChange={(e) => setCet(e.target.value)} className={campo} autoComplete="off" placeholder="ex.: 35,40" />
          <span className="mt-1 block text-xs leading-relaxed">O Custo Efetivo Total aparece no contrato e na proposta, sempre ao ano.</span>
        </label>
      </form>

      <div aria-live="polite">
        <p className="rotulo text-bronze-dark">Cálculo, não é previsão nem oferta</p>
        {problema || !resultado ? (
          <p className="mt-4 border-l-2 border-aviso bg-marfim px-4 py-3 text-sm text-carvao" role="status">
            {problema}
          </p>
        ) : (
          <>
            <dl className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-3" data-resultado="">
              <div className="border-t border-carvao pt-3">
                <dt className="text-sm text-carvao-muted">Parcela mensal</dt>
                <dd className="mt-1 font-label text-[1.8rem] leading-tight tabular-nums text-carvao">{reais(resultado.parcela)}</dd>
                <dd className="mt-1 text-sm text-carvao-muted">{meses} {meses === 1 ? "parcela" : "parcelas iguais"}</dd>
              </div>
              <div className="border-t border-carvao pt-3">
                <dt className="text-sm text-carvao-muted">Total pago</dt>
                <dd className="mt-1 font-label text-[1.8rem] leading-tight tabular-nums text-carvao">{reais(resultado.total)}</dd>
                <dd className="mt-1 text-sm text-carvao-muted">soma das parcelas</dd>
              </div>
              <div className="border-t border-carvao pt-3">
                <dt className="text-sm text-carvao-muted">Juros totais</dt>
                <dd className="mt-1 font-label text-[1.8rem] leading-tight tabular-nums text-carvao">{reais(resultado.juros)}</dd>
                <dd className="mt-1 text-sm text-carvao-muted">{num((resultado.juros / valor) * 100, 1)}% do valor tomado</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-carvao-muted">
              Taxa usada: {num(resultado.anualPct)}% ao ano, equivalente a {num(resultado.mensalPct)}% ao mês (juros compostos).{" "}
              {taxaPropria ? "Taxa digitada por você." : referencia.origem === "banco" ? "Taxa média publicada pelo Banco Central para o banco escolhido." : "Mediana das taxas publicadas pelo Banco Central para a modalidade."}
            </p>

            {comMediana && (
              <p className="mt-3 text-sm leading-relaxed text-carvao-muted" data-comparacao-mediana="">
                Com a mediana das instituições na modalidade ({num(mediana as number)}% ao ano), a parcela seria {reais(comMediana.parcela)} e o total pago,{" "}
                {reais(comMediana.total)}.
              </p>
            )}

            <div className="mt-8 border-t border-linha pt-5" data-comparacao-cet="">
              <h3 className="text-base font-medium text-carvao">E com o CET do contrato?</h3>
              {problemaCet ? (
                <p className="mt-2 text-sm text-carvao" role="status">{problemaCet}</p>
              ) : comparacao ? (
                <>
                  <dl className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-3">
                    <div>
                      <dt className="text-sm text-carvao-muted">Parcela com o CET</dt>
                      <dd className="mt-1 text-xl tabular-nums text-carvao">{reais(comparacao.comCet.parcela)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-carvao-muted">Total pago com o CET</dt>
                      <dd className="mt-1 text-xl tabular-nums text-carvao">{reais(comparacao.comCet.total)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-carvao-muted">Diferença no total pago</dt>
                      <dd className="mt-1 text-xl tabular-nums text-carvao">
                        {comparacao.diferencaTotal >= 0 ? "+" : "−"}
                        {reais(Math.abs(comparacao.diferencaTotal))}
                      </dd>
                      {comparacao.diferencaTotalPct !== null && (
                        <dd className="text-sm text-carvao-muted">
                          {comparacao.diferencaTotalPct >= 0 ? "+" : "−"}
                          {num(Math.abs(comparacao.diferencaTotalPct), 1)}% sobre o total calculado só com juros
                        </dd>
                      )}
                    </div>
                  </dl>
                  <p className="mt-3 text-sm leading-relaxed text-carvao-muted">
                    O CET informado fica {num(Math.abs(comparacao.diferencaTaxaPp))} pontos percentuais ao ano {comparacao.diferencaTaxaPp >= 0 ? "acima" : "abaixo"} da
                    taxa usada no cálculo. Quando a taxa usada é a taxa de juros do mesmo contrato, a diferença no total corresponde a tarifas, seguros e
                    tributos incluídos no CET, supondo parcelas iguais sobre o mesmo valor liberado. Comparada à taxa média publicada, a diferença soma esses
                    encargos à distância entre a taxa do seu contrato e a média.
                  </p>
                  {comparacao.diferencaTaxaPp < 0 && (
                    <p className="mt-2 text-sm leading-relaxed text-carvao">
                      O CET informado é menor que a taxa de juros usada. Como o CET inclui os juros e os demais encargos do mesmo contrato, confira se as duas
                      taxas se referem à mesma operação e se ambas estão ao ano.
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                  Informe o CET do seu contrato para ver quanto tarifas, seguros e tributos mudam a parcela e o total pago.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
