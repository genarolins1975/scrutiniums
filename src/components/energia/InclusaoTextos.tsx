import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { dataBR } from "@/lib/energia/formato";
import {
  ancoraEventoRegulacao,
  baseLegalTarifaSocial,
  codigoUf,
  dataBaseReaisPof,
  destaquesParticipacaoRendaPof,
  destaquesRendaPof,
  orcamentoBase,
  periodoPof,
  pctTexto,
  respostaAcessoIndicador,
  respostaOrcamento,
  respostaOrcamentoRenda,
  respostaTarifaSocialMedida,
  rotaPainel,
  textoEstimadorDestaque,
  textoPofHistorica,
  textoPrecisaoPof,
  vereditoAcessoIndicador,
  vereditoOrcamento,
  vereditoOrcamentoRenda,
  vereditoTarifaSocialMedida,
  type BasePof,
  type IndicadorPnad,
  type MedidaTsee,
} from "@/lib/energia/inclusao";
import type { Acesso, Orcamento, TarifaSocial } from "@/lib/energia/tipos-inclusao";
import type { GoldRegulacao } from "@/lib/energia/tipos-regulacao";

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
      {base ? ` As faixas de renda são as classes de rendimento total mensal da família, em reais de ${base}, a data de referência dos valores da pesquisa.` : ""} A precisão de cada estimativa vem do plano
      amostral (estrato e unidade primária) e é medida pelo coeficiente de variação (CV): {textoPrecisaoPof(o.regra_precisao)}
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

/**
 * Frase de resposta do painel de orçamento na base escolhida (despesa total ou renda): o mesmo texto e os mesmos números do
 * veredito e da resposta completa daquela base. É região viva, porque muda quando o leitor troca a base.
 */
export function OrcamentoResposta({ o, base }: { o: Orcamento; base: BasePof }) {
  const classes = orcamentoBase(o, (l) => !codigoUf(l.territorio));
  return base === "despesa" ? (
    <RespostaCurta id="p061" veredito={vereditoOrcamento(classes)} vivo>
      {respostaOrcamento(classes)}
    </RespostaCurta>
  ) : (
    <RespostaCurta id="p061" veredito={vereditoOrcamentoRenda(classes)} vivo>
      {respostaOrcamentoRenda(classes)}
    </RespostaCurta>
  );
}

/**
 * Faixa de métricas do orçamento na base escolhida. Despesa: razão de médias (todas as famílias, com a ficha; menor e maior faixa).
 * Renda: média das participações na renda, porque na renda não há razão de médias (a menor faixa traz a ficha que a gold publica;
 * o conjunto e a maior faixa saem das mesmas linhas do gráfico). A nota diz que estimador o destaque usa.
 */
export function OrcamentoFaixa({ o, base, anoPublicacao }: { o: Orcamento; base: BasePof; anoPublicacao: string }) {
  const classes = orcamentoBase(o, (l) => !codigoUf(l.territorio));
  const periodoMedidas = `POF ${periodoPof(o)}`;
  const nota = (
    <>
      <p>{textoPofHistorica(o, anoPublicacao)}</p>
      <p className="mt-1">{textoEstimadorDestaque(classes, base)}</p>
    </>
  );
  if (base === "despesa") {
    const d = destaquesRendaPof(classes);
    return (
      <FaixaMetricas colunas={3} rotulo="Peso da energia no orçamento das famílias" nota={nota}>
        <Numero
          variante="faixa"
          rotulo="Razão de médias, todas as famílias"
          natureza="ESTIMADO"
          evidencia={o.evidencias.razao_medias_brasil}
          formato="pct"
          casas={1}
          unidade="da despesa total"
          periodo={periodoMedidas}
          cor="var(--cor-energia)"
          endereco={`${rotaPainel("p061")}#p061`}
        />
        {d.baixa && (
          <Numero
            variante="faixa"
            rotulo="Razão de médias, menor faixa de renda"
            natureza="ESTIMADO"
            valor={d.baixa.valor}
            formato="pct"
            casas={1}
            unidade="da despesa total"
            recorte={d.baixa.rotulo}
            periodo={periodoMedidas}
            motivoAusencia="Estimativa suprimida pela precisão."
          />
        )}
        {d.alta && (
          <Numero
            variante="faixa"
            rotulo="Razão de médias, maior faixa de renda"
            natureza="ESTIMADO"
            valor={d.alta.valor}
            formato="pct"
            casas={1}
            unidade="da despesa total"
            recorte={d.alta.rotulo}
            periodo={periodoMedidas}
            motivoAusencia="Estimativa suprimida pela precisão."
          />
        )}
      </FaixaMetricas>
    );
  }
  const d = destaquesParticipacaoRendaPof(classes);
  return (
    <FaixaMetricas colunas={3} rotulo="Peso da energia na renda das famílias" nota={nota}>
      <Numero
        variante="faixa"
        rotulo="Média das participações na renda, todas as famílias"
        natureza="ESTIMADO"
        valor={d.total}
        formato="pct"
        casas={1}
        unidade="da renda"
        periodo={periodoMedidas}
        cor="var(--cor-energia)"
        motivoAusencia="Estimativa suprimida pela precisão."
      />
      {d.baixa && (
        <Numero
          variante="faixa"
          rotulo="Média das participações na renda, menor faixa de renda"
          natureza="ESTIMADO"
          evidencia={o.evidencias.media_razoes_renda_classe_baixa}
          formato="pct"
          casas={1}
          unidade="da renda"
          recorte={d.baixa.rotulo}
          periodo={periodoMedidas}
          endereco={`${rotaPainel("p061")}#p061`}
        />
      )}
      {d.alta && (
        <Numero
          variante="faixa"
          rotulo="Média das participações na renda, maior faixa de renda"
          natureza="ESTIMADO"
          valor={d.alta.valor}
          formato="pct"
          casas={1}
          unidade="da renda"
          recorte={d.alta.rotulo}
          periodo={periodoMedidas}
          motivoAusencia="Estimativa suprimida pela precisão."
        />
      )}
    </FaixaMetricas>
  );
}

/** Frase de resposta do Acesso no indicador escolhido (sem energia, ligados à rede geral, rede em tempo integral); região viva. */
export function AcessoResposta({ a, ind }: { a: Acesso; ind: IndicadorPnad }) {
  return (
    <RespostaCurta id="p062" veredito={vereditoAcessoIndicador(a, ind)} vivo>
      {respostaAcessoIndicador(a, ind)}
    </RespostaCurta>
  );
}

/**
 * Primeiro cartão da faixa de métricas do Acesso, no indicador escolhido. Sem energia: o número em mil domicílios, com a ficha que a
 * gold publica. Ligados à rede geral e rede em tempo integral: o percentual do Brasil, da mesma linha da PNAD que o gráfico lê; a gold
 * não publica ficha para eles, e o cartão diz o coeficiente de variação.
 */
export function AcessoCartaoIndicador({ a, ind }: { a: Acesso; ind: IndicadorPnad }) {
  const br = a.pnad_serie.find((l) => l.territorio === "BR" && l.ano === a.ano_referencia && l.situacao === "total");
  const endereco = `${rotaPainel("p062")}#p062`;
  if (ind === "rede") {
    return (
      <Numero
        variante="faixa"
        rotulo={`Domicílios ligados à rede geral, ${a.ano_referencia}`}
        natureza="ESTIMADO"
        valor={br?.pct_rede_geral ?? null}
        formato="pct"
        casas={1}
        unidade="dos domicílios"
        periodo={a.ano_referencia}
        cor="var(--cor-energia)"
        motivoAusencia="Sem estimativa nesta publicação."
        nota={br ? `Domicílio: a moradia, com ou sem ligação à rede. Coeficiente de variação de ${pctTexto(br.cv_pct_rede_geral, 1)}.` : undefined}
        endereco={endereco}
      />
    );
  }
  if (ind === "integral") {
    return (
      <Numero
        variante="faixa"
        rotulo={`Rede em tempo integral, entre os ligados à rede geral, ${a.ano_referencia}`}
        natureza="ESTIMADO"
        valor={br?.pct_integral_entre_rede ?? null}
        formato="pct"
        casas={1}
        unidade="dos ligados à rede geral"
        periodo={a.ano_referencia}
        cor="var(--cor-energia)"
        motivoAusencia="Sem estimativa nesta publicação."
        nota={br ? `O percentual é sobre os ligados à rede, não sobre todos os domicílios. Coeficiente de variação de ${pctTexto(br.cv_pct_integral, 1)}.` : undefined}
        endereco={endereco}
      />
    );
  }
  return (
    <Numero
      variante="faixa"
      rotulo={`Domicílios sem energia de nenhuma fonte, ${a.ano_referencia}`}
      natureza="ESTIMADO"
      evidencia={a.evidencia_sem_energia}
      casas={0}
      unidade="mil domicílios"
      cor="var(--cor-energia)"
      motivoAusencia="Sem estimativa nesta publicação."
      nota={
        br
          ? `Domicílio: a moradia, com ou sem ligação à rede. ${pctTexto(br.pct_sem_energia, 1)} dos domicílios. Entre os ligados à rede geral, ${pctTexto(br.pct_integral_entre_rede, 1)} têm fornecimento em tempo integral (coeficiente de variação de ${pctTexto(br.cv_pct_integral, 1)}, tabela 6738 do IBGE).`
          : undefined
      }
      endereco={endereco}
    />
  );
}

/** Frase de resposta da Tarifa Social na medida escolhida (UC, participação nas residenciais ou DMR); região viva. */
export function TarifaSocialResposta({ t, medida }: { t: TarifaSocial; medida: MedidaTsee }) {
  return (
    <RespostaCurta id="p059" veredito={vereditoTarifaSocialMedida(t, medida)} vivo>
      {respostaTarifaSocialMedida(t, medida)}
    </RespostaCurta>
  );
}

/**
 * Base legal da regra de 80 kWh, lida da linha do tempo da Regulação do próprio observatório: a Medida Provisória (MPV) e a lei que a
 * converteu, com os atos, as datas de publicação e o que a lei faz, e o link para o evento. Nada além do que a linha do tempo traz; sem a
 * lei na linha do tempo, nada aparece.
 */
export function InclusaoBaseLegal({ reg, className = "" }: { reg: GoldRegulacao | null; className?: string }) {
  const { mpv, lei, ren } = baseLegalTarifaSocial(reg);
  if (!lei) return null;
  const efeito = lei.resumo.includes(": ") ? lei.resumo.slice(lei.resumo.indexOf(": ") + 2) : lei.resumo;
  return (
    <span data-base-legal="" className={`block ${className}`}>
      {mpv?.ato ? `A ${mpv.ato.replace("Medida Provisória", "Medida Provisória (MPV)")}, foi convertida na ${lei.ato}` : `A ${lei.ato}`}
      {lei.data_publicacao ? `, publicada em ${dataBR(lei.data_publicacao)}` : ""}. Segundo a linha do tempo da Regulação, a lei {efeito.replace("CadÚnico", "Cadastro Único")}
      {ren?.ato ? ` A ANEEL a regulou na ${ren.ato}.` : ""}{" "}
      <a href={ancoraEventoRegulacao(lei.id)} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
        Ver na linha do tempo da Regulação
      </a>
      .
    </span>
  );
}
