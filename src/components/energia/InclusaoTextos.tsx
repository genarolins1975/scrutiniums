import { dataBaseReaisPof, pctTexto, textoPrecisaoPof } from "@/lib/energia/inclusao";
import type { Orcamento } from "@/lib/energia/tipos-inclusao";

/**
 * Notas do painel de orçamento (POF), compartilhadas pela síntese e pela página de peso no orçamento: as duas mostram a mesma figura
 * e precisam dizer a mesma coisa sobre ela. Cada definição fica junto da medida que a usa (família, razão de médias, média das
 * participações, faixa de renda), e a idade da pesquisa fica junto do valor. Nenhum período, ano ou valor é escrito à mão: tudo vem
 * da gold.
 */

export function OrcamentoPorQueImporta() {
  return (
    <>
      O mesmo valor de conta pesa diferente conforme a renda. A POF é a única pesquisa oficial que mede a despesa das famílias com energia elétrica junto com a despesa total e a renda,
      com plano amostral que permite estimar a precisão.
    </>
  );
}

export function OrcamentoComoInterpretar({ o }: { o: Orcamento }) {
  const base = dataBaseReaisPof(o);
  return (
    <>
      Razão de médias é a despesa média com energia dividida pela despesa média total (a &ldquo;distribuição&rdquo; que o IBGE publica). Média das participações calcula a participação em
      cada família e tira a média ponderada. As duas respondem a perguntas diferentes e aparecem lado a lado; a mediana mostra a família típica. Família é a unidade da POF e pode não ser
      a titular da conta de luz da casa em que mora.
      {base ? ` As faixas de renda são as classes de rendimento total mensal da família, em reais de ${base}, a data de referência dos valores da pesquisa.` : ""} Precisão pelo plano
      amostral (estrato e unidade primária): {textoPrecisaoPof(o.regra_precisao)}
    </>
  );
}

export function OrcamentoNaoConcluir({ o, anoPublicacao }: { o: Orcamento; anoPublicacao: string }) {
  const fim = o.proveniencia.microdados.periodo_referencia.fim.slice(0, 4);
  return (
    <>
      Não representa {anoPublicacao}: os preços e a Tarifa Social mudaram desde {fim}, e nenhuma atualização modelada é publicada. Não existe recorte municipal: a amostra não permite. Os
      limiares de {o.limiares_pct.map((x) => pctTexto(x, 0)).join(", ")} não definem pobreza energética; são sensibilidade.
    </>
  );
}
