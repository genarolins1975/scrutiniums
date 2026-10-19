import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { Nome } from "@/components/i18n/Nome";
import { dataBR } from "@/lib/energia/formato";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { hrefNoIdioma } from "@/lib/i18n-href";
import { dadoNo, dadoTexto } from "@/lib/energia/i18n/conta-inclusao";
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
  textosRegraTarifaSocial,
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
  return tx(
    <>
      O mesmo valor de conta pesa diferente conforme a renda. A POF é a única pesquisa oficial que mede a despesa das famílias com energia elétrica junto com a despesa total e a renda,
      com plano amostral que permite estimar a precisão.
    </>,
    <>
      The same bill amount weighs differently depending on income. The POF (IBGE&rsquo;s household budget survey) is the only official survey that measures families&rsquo; electricity
      expense together with total expense and income, with a sample design that allows precision to be estimated.
    </>,
  );
}

export function OrcamentoComoInterpretar({ o }: { o: Orcamento }) {
  const base = dataBaseReaisPof(o);
  return tx(
    <>
      Razão de médias é a despesa média com energia dividida pela despesa média total (a &ldquo;distribuição&rdquo; que o IBGE publica). Média das participações calcula a participação em
      cada família e tira a média ponderada. As duas respondem a perguntas diferentes e aparecem lado a lado; a mediana mostra a família típica. Família é a unidade da POF e pode não ser
      a titular da conta de luz da casa em que mora.
      {base ? ` As faixas de renda são as classes de rendimento total mensal da família, em reais de ${base}, a data de referência dos valores da pesquisa.` : ""} A precisão de cada estimativa vem do plano
      amostral (estrato e unidade primária) e é medida pelo coeficiente de variação (CV): {textoPrecisaoPof(o.regra_precisao)}
    </>,
    <>
      The ratio of averages is the average electricity expense divided by the average total expense (the &ldquo;distribution&rdquo; IBGE publishes). The average of the shares calculates the
      share in each family and takes the weighted average. The two answer different questions and appear side by side; the median shows the typical family. The family is the POF&rsquo;s
      unit and may not be the holder of the electricity bill of the home where it lives.
      {base ? ` The income brackets are the classes of the family's total monthly income, in reais of ${base}, the reference date of the survey's values.` : ""} The precision of each estimate
      comes from the sample design (stratum and primary unit) and is measured by the coefficient of variation (CV): {textoPrecisaoPof(o.regra_precisao)}
    </>,
  );
}

export function OrcamentoNaoConcluir({ o, anoPublicacao }: { o: Orcamento; anoPublicacao: string }) {
  const fim = o.proveniencia.microdados.periodo_referencia.fim.slice(0, 4);
  return tx(
    <>
      Não representa {anoPublicacao}: os preços e a Tarifa Social mudaram desde {fim}, e nenhuma atualização modelada é publicada. Não existe recorte municipal: a amostra não permite. Os
      limiares de {o.limiares_pct.map((x) => pctTexto(x, 0)).join(", ")} não definem pobreza energética; são sensibilidade.
    </>,
    <>
      It does not represent {anoPublicacao}: prices and the Tarifa Social have changed since {fim}, and no modeled update is published. There is no municipal breakdown: the sample does
      not allow it. The thresholds of {o.limiares_pct.map((x) => pctTexto(x, 0)).join(", ")} do not define energy poverty; they are a sensitivity check.
    </>,
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
  const idioma = idiomaEnergia();
  const classes = orcamentoBase(o, (l) => !codigoUf(l.territorio));
  const periodoMedidas = `POF ${periodoPof(o)}`;
  const daDespesa = tx("da despesa total", "of total expense");
  const daRenda = tx("da renda", "of income");
  const suprimida = tx("Estimativa suprimida pela precisão.", "Estimate suppressed due to precision.");
  const nota = (
    <>
      <p>{textoPofHistorica(o, anoPublicacao)}</p>
      <p className="mt-1">{textoEstimadorDestaque(classes, base)}</p>
    </>
  );
  if (base === "despesa") {
    const d = destaquesRendaPof(classes);
    return (
      <FaixaMetricas colunas={3} rotulo={tx("Peso da energia no orçamento das famílias", "Weight of energy in family budgets")} nota={nota}>
        <Numero
          variante="faixa"
          rotulo={tx("Razão de médias, todas as famílias", "Ratio of averages, all families")}
          natureza="ESTIMADO"
          evidencia={o.evidencias.razao_medias_brasil}
          formato="pct"
          casas={1}
          unidade={daDespesa}
          periodo={periodoMedidas}
          cor="var(--cor-energia)"
          endereco={`${rotaPainel("p061")}#p061`}
        />
        {d.baixa && (
          <Numero
            variante="faixa"
            rotulo={tx("Razão de médias, menor faixa de renda", "Ratio of averages, lowest income bracket")}
            natureza="ESTIMADO"
            valor={d.baixa.valor}
            formato="pct"
            casas={1}
            unidade={daDespesa}
            recorte={dadoTexto(d.baixa.rotulo, idioma)}
            periodo={periodoMedidas}
            motivoAusencia={suprimida}
          />
        )}
        {d.alta && (
          <Numero
            variante="faixa"
            rotulo={tx("Razão de médias, maior faixa de renda", "Ratio of averages, highest income bracket")}
            natureza="ESTIMADO"
            valor={d.alta.valor}
            formato="pct"
            casas={1}
            unidade={daDespesa}
            recorte={dadoTexto(d.alta.rotulo, idioma)}
            periodo={periodoMedidas}
            motivoAusencia={suprimida}
          />
        )}
      </FaixaMetricas>
    );
  }
  const d = destaquesParticipacaoRendaPof(classes);
  return (
    <FaixaMetricas colunas={3} rotulo={tx("Peso da energia na renda das famílias", "Weight of energy in family income")} nota={nota}>
      <Numero
        variante="faixa"
        rotulo={tx("Média das participações na renda, todas as famílias", "Average share of income, all families")}
        natureza="ESTIMADO"
        valor={d.total}
        formato="pct"
        casas={1}
        unidade={daRenda}
        periodo={periodoMedidas}
        cor="var(--cor-energia)"
        motivoAusencia={suprimida}
      />
      {d.baixa && (
        <Numero
          variante="faixa"
          rotulo={tx("Média das participações na renda, menor faixa de renda", "Average share of income, lowest income bracket")}
          natureza="ESTIMADO"
          evidencia={o.evidencias.media_razoes_renda_classe_baixa}
          formato="pct"
          casas={1}
          unidade={daRenda}
          recorte={dadoTexto(d.baixa.rotulo, idioma)}
          periodo={periodoMedidas}
          endereco={`${rotaPainel("p061")}#p061`}
        />
      )}
      {d.alta && (
        <Numero
          variante="faixa"
          rotulo={tx("Média das participações na renda, maior faixa de renda", "Average share of income, highest income bracket")}
          natureza="ESTIMADO"
          valor={d.alta.valor}
          formato="pct"
          casas={1}
          unidade={daRenda}
          recorte={dadoTexto(d.alta.rotulo, idioma)}
          periodo={periodoMedidas}
          motivoAusencia={suprimida}
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
  const br = a.pnad_serie.find((l) => l.territorio === "BR" && l.ano === a.ano_referencia && l.situacao === "total"); // i18n: dado
  const endereco = `${rotaPainel("p062")}#p062`;
  const semEstimativa = tx("Sem estimativa nesta publicação.", "No estimate in this publication.");
  const domicilio = tx("Domicílio: a moradia, com ou sem ligação à rede.", "Household: the dwelling, with or without a grid connection.");
  if (ind === "rede") {
    return (
      <Numero
        variante="faixa"
        rotulo={tx(`Domicílios ligados à rede geral, ${a.ano_referencia}`, `Households connected to the general grid, ${a.ano_referencia}`)}
        natureza="ESTIMADO"
        valor={br?.pct_rede_geral ?? null}
        formato="pct"
        casas={1}
        unidade={tx("dos domicílios", "of households")}
        periodo={a.ano_referencia}
        cor="var(--cor-energia)"
        motivoAusencia={semEstimativa}
        nota={br ? tx(`${domicilio} Coeficiente de variação de ${pctTexto(br.cv_pct_rede_geral, 1)}.`, `${domicilio} Coefficient of variation of ${pctTexto(br.cv_pct_rede_geral, 1)}.`) : undefined}
        endereco={endereco}
      />
    );
  }
  if (ind === "integral") {
    return (
      <Numero
        variante="faixa"
        rotulo={tx(`Rede em tempo integral, entre os ligados à rede geral, ${a.ano_referencia}`, `Full-time grid, among those connected to the general grid, ${a.ano_referencia}`)}
        natureza="ESTIMADO"
        valor={br?.pct_integral_entre_rede ?? null}
        formato="pct"
        casas={1}
        unidade={tx("dos ligados à rede geral", "of those connected to the general grid")}
        periodo={a.ano_referencia}
        cor="var(--cor-energia)"
        motivoAusencia={semEstimativa}
        nota={
          br
            ? tx(
                `O percentual é sobre os ligados à rede, não sobre todos os domicílios. Coeficiente de variação de ${pctTexto(br.cv_pct_integral, 1)}.`,
                `The percentage is over those connected to the grid, not over all households. Coefficient of variation of ${pctTexto(br.cv_pct_integral, 1)}.`,
              )
            : undefined
        }
        endereco={endereco}
      />
    );
  }
  return (
    <Numero
      variante="faixa"
      rotulo={tx(`Domicílios sem energia de nenhuma fonte, ${a.ano_referencia}`, `Households without energy from any source, ${a.ano_referencia}`)}
      natureza="ESTIMADO"
      evidencia={a.evidencia_sem_energia}
      casas={0}
      unidade={tx("mil domicílios", "thousand households")}
      cor="var(--cor-energia)"
      motivoAusencia={semEstimativa}
      nota={
        br
          ? tx(
              `${domicilio} ${pctTexto(br.pct_sem_energia, 1)} dos domicílios. Entre os ligados à rede geral, ${pctTexto(br.pct_integral_entre_rede, 1)} têm fornecimento em tempo integral (coeficiente de variação de ${pctTexto(br.cv_pct_integral, 1)}, tabela 6738 do IBGE).`,
              `${domicilio} ${pctTexto(br.pct_sem_energia, 1)} of households. Among those connected to the general grid, ${pctTexto(br.pct_integral_entre_rede, 1)} have full-time supply (coefficient of variation of ${pctTexto(br.cv_pct_integral, 1)}, IBGE table 6738).`,
            )
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
 * Regra vigente da Tarifa Social (gratuidade até 80 kWh), com o ato, a data e o início da vigência, e os números separados em antes e
 * depois dela, cada lado com fonte, unidade e mês (banca de 19/10/2026). Sem mês completo posterior à regra, o lado "depois" declara a
 * ausência e o mês do dado mais recente; nada é estimado. Gold anterior a esses campos: nada aparece.
 */
export function TarifaSocialRegraVigente({ t, className = "" }: { t: TarifaSocial; className?: string }) {
  const idioma = idiomaEnergia();
  const x = textosRegraTarifaSocial(t, idioma);
  const r = t.regra_vigente;
  if (!x || !r) return null;
  return (
    <section
      data-regra-tarifa-social=""
      data-pos-regra={x.mesPosRegra ?? "ausente"}
      aria-labelledby="regra-tarifa-social-titulo"
      className={`max-w-4xl space-y-3 border-l-2 border-energia pl-4 ${className}`}
    >
      <h3 id="regra-tarifa-social-titulo" className="font-serif text-lg text-carvao">
        {tx("A regra vigente e o que é antes e depois dela", "The rule in force and what comes before and after it")}
      </h3>
      <p className="text-base leading-relaxed text-carvao">{x.regra}</p>
      <p className="text-sm leading-relaxed text-carvao-muted">
        {x.anterior} {x.conferencia}{" "}
        <a href={r.fonte} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
          {tx("Página da ANEEL", "ANEEL page")}
        </a>
        {" · "}
        <a href={r.lei_url} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
          {tx("Lei nº 15.235/2025", "Law No. 15,235/2025")}
        </a>
        .
      </p>
      <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
        <div data-lado="antes">
          <dt className="rotulo text-mineral">{tx(`Antes da regra (até ${x.vigencia})`, `Before the rule (until ${x.vigencia})`)}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-carvao">{x.antes}</dd>
        </div>
        <div data-lado="depois" data-ausente={x.depoisAusente ? "sim" : "nao"}>
          <dt className="rotulo text-mineral">{tx(`Depois da regra (desde ${x.vigencia})`, `After the rule (since ${x.vigencia})`)}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-carvao">{x.depois}</dd>
        </div>
      </dl>
      <p className="text-xs leading-relaxed text-carvao-muted">
        {x.transicao ? `${x.transicao} ` : ""}
        {tx(
          "Unidade consumidora (SCS) e fatura (Beneficiários da CDE) são unidades diferentes: a comparação entre os dois lados é só entre faturas.",
          "Consumer unit (SCS) and bill (CDE Beneficiaries) are different units: the comparison between the two sides is only between bills.",
        )}
      </p>
    </section>
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
  const efeito = (lei.resumo.includes(": ") ? lei.resumo.slice(lei.resumo.indexOf(": ") + 2) : lei.resumo).replace("CadÚnico", "Cadastro Único"); // i18n: dado
  // em inglês o nome do ato fica como a fonte o publica (nome próprio); o que a lei faz sai da tabela exata ou marcado como português
  return tx(
    <span data-base-legal="" className={`block ${className}`}>
      {mpv?.ato ? `A ${mpv.ato.replace("Medida Provisória", "Medida Provisória (MPV)")}, foi convertida na ${lei.ato}` : `A ${lei.ato}`}
      {lei.data_publicacao ? `, publicada em ${dataBR(lei.data_publicacao)}` : ""}. Segundo a linha do tempo da Regulação, a lei {efeito}
      {ren?.ato ? ` A ANEEL a regulou na ${ren.ato}.` : ""}{" "}
      <a href={ancoraEventoRegulacao(lei.id)} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
        Ver na linha do tempo da Regulação
      </a>
      .
    </span>,
    <span data-base-legal="" className={`block ${className}`}>
      {mpv?.ato ? (
        <>
          <Nome>{mpv.ato}</Nome> (Provisional Measure, MPV) was converted into <Nome>{lei.ato}</Nome>
        </>
      ) : (
        <Nome>{lei.ato}</Nome>
      )}
      {lei.data_publicacao ? `, published on ${dataBR(lei.data_publicacao)}` : ""}. According to the Regulation timeline, the law {dadoNo(efeito, "base-legal-tarifa-social", "en")}
      {ren?.ato ? (
        <>
          {" "}
          ANEEL regulated it in <Nome>{ren.ato}</Nome>.
        </>
      ) : null}{" "}
      <a href={hrefNoIdioma(ancoraEventoRegulacao(lei.id), "en")} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
        See it on the Regulation timeline
      </a>
      .
    </span>,
  );
}
