"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GeracaoAviso, GeracaoEscolha, GeracaoRecorte } from "@/components/energia/GeracaoControles";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { mesAno, num } from "@/lib/energia/formato";
import {
  COLUNAS_PARCELAS,
  COLUNAS_USINAS_TERMICAS,
  COMBUSTIVEIS,
  COR_COMBUSTIVEL,
  COR_COMPARACAO,
  COR_MOTIVO,
  CURTO_COMBUSTIVEL,
  CURTO_MOTIVO,
  GLOSA_MOTIVO,
  JANELAS_TERMICA,
  ROTULO_ORIGEM_COMBUSTIVEL,
  colunasCombustivelMotivo,
  colunasTermicaMensal,
  combustiveisComSerie,
  linhasCombustivelMensal,
  linhasCombustivelMotivo,
  linhasMotivosUsinas,
  linhasParcelas,
  linhasTermicaMensal,
  linhasUsinasTermicas,
  maioresUsinasTermicas,
  minusculaPalavras,
  motivoPrincipal,
  paraTabela,
  respostaTermica,
  usinasPadraoComparacao,
  usinaTermicaEscolhida,
  vereditoTermica,
  type TermicaCliente,
} from "@/lib/energia/geracao";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { CategoriaCombustivel } from "@/lib/energia/tipos-geracao";

/**
 * P022, despacho térmico. O recorte fica na URL: usina escolhida (?us=), usinas comparadas
 * (?cmp=, até quatro), combustíveis comparados na série mensal (?cb=, até quatro) e o
 * alcance da série por motivo (?jt=, 24 meses ou desde 2019); busca, ordem e filtros de cada
 * tabela também (prefixos cm, tm, us, pc, mu, cbm). Escolher uma usina na tabela leva a
 * mesma usina à ficha de motivos e parcelas.
 *
 * Combustível e motivo são dimensões separadas: as barras empilham motivos dentro de cada
 * combustível, e a soma dos motivos de cada barra fecha com a geração verificada do
 * combustível, a menos da parcela "não classificada" publicada na tabela. Nada é inferido
 * do preço.
 *
 * Ordem da página: o veredito, a figura principal (combustível por motivo) com a legenda dos motivos e do recorte, a
 * tabela equivalente e as notas do painel (`notas`); depois seções visíveis com pergunta própria (o motivo mês a mês e
 * as usinas) e, em Analisar, o combustível mês a mês. As medidas de abertura (12 meses) ficam na faixa de métricas da página.
 */
const ESQUEMA = {
  us: campo(tiposUrl.texto({ max: 40 }), ""),
  cmp: campo(tiposUrl.lista(tiposUrl.texto({ max: 40 }), { max: LIMITE_COMPARACAO }), [] as string[]),
  cb: campo(tiposUrl.lista(tiposUrl.opcao(COMBUSTIVEIS), { max: LIMITE_COMPARACAO }), [] as CategoriaCombustivel[]),
  jt: campo(tiposUrl.opcao(JANELAS_TERMICA), "24m"),
  de: campo(tiposUrl.mes(), ""),
  ate: campo(tiposUrl.mes(), ""),
};

const OPCOES_JANELA = [
  { id: "24m" as const, rotulo: "24 meses mais recentes" },
  { id: "tudo" as const, rotulo: "Desde 2019" },
];

export function GeracaoTermica({
  termica,
  fonte,
  versao,
  notas,
  notasUniverso,
  contextoSemana,
}: {
  /** A gold da térmica sem as partes que só a auditoria usa (CVU, universo, identidade), montadas no servidor. */
  termica: TermicaCliente;
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Notas de universo e de método que valem para a figura principal (não classificado, combustível, universo que cresce, ponte com a matriz), sob o recorte. */
  notasUniverso?: ReactNode;
  /** A participação térmica dos 7 dias em contexto (seção montada no servidor com a gold de operação), entre a série mensal e as usinas. */
  contextoSemana?: ReactNode;
}) {
  const t = termica;
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const u = t.ultimos_12m;
  const cruzado = useMemo(() => linhasCombustivelMotivo(t), [t]);
  const cruzadoLinhas = cruzado.linhas;
  const mensalEscolhido = useMemo(() => linhasTermicaMensal(t, v.jt), [t, v.jt]);
  const mensal = mensalEscolhido.linhas;
  const ultimoMensal = mensal[mensal.length - 1];
  const usinas = useMemo(() => linhasUsinasTermicas(t), [t]);
  const usina = usinaTermicaEscolhida(t, v.us);
  const sel = usina && usinas.some((l) => l.id === usina.id) ? usina.id : null;
  const selecionar = (id: string | null) => definir({ us: id ?? "" });
  const parcelas = usina ? linhasParcelas(usina) : [];

  const conhecidas = new Set(t.usinas_12m.map((x) => x.id));
  const comparadas = (v.cmp as string[]).filter((id) => conhecidas.has(id));
  // sem escolha na tabela nem no comparador, a comparação abre com a maior usina de cada um de três combustíveis
  const padrao = useMemo(() => usinasPadraoComparacao(t.usinas_12m, 3), [t]);
  const comparacaoPadrao = comparadas.length === 0 && !v.us;
  const idsComparados = comparadas.length ? comparadas : comparacaoPadrao ? padrao.map((x) => x.id) : usina ? [usina.id] : [];
  const usinasComparadas = idsComparados.map((id) => t.usinas_12m.find((x) => x.id === id)!).filter(Boolean);
  const maiores = useMemo(() => maioresUsinasTermicas(t.usinas_12m, 10), [t]);
  const motivosUsinas = linhasMotivosUsinas(usinasComparadas);

  const comSerie = combustiveisComSerie(t);
  const cbs = (v.cb as CategoriaCombustivel[]).filter((c) => comSerie.includes(c));
  const noHistorico: CategoriaCombustivel[] = cbs.length ? cbs : comSerie.slice(0, 3);
  const chaveHistorico = noHistorico.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a lista é recriada a cada render; a chave textual estabiliza
  const combustivelMensal = useMemo(() => linhasCombustivelMensal(t, noHistorico), [t, chaveHistorico]);
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;

  const motivosNoGrafico = t.motivos.filter((m) => cruzado.motivos.includes(m.id));

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <RespostaCurta id="p022" veredito={vereditoTermica(t) || respostaTermica(t)}>
          {respostaTermica(t)}
        </RespostaCurta>
        <div className="space-y-4">
          <GraficoBarras
            titulo={`Geração térmica por combustível e motivo de despacho, ${mesAno(u.inicio)} a ${mesAno(u.fim)}`}
            dados={paraTabela(cruzadoLinhas)}
            chaveCategoria="id"
            chaveRotulo="combustivel"
            series={cruzado.motivos.map((m) => ({ id: m, rotulo: CURTO_MOTIVO[m], cor: COR_MOTIVO[m] }))}
            unidade="GWh"
            casas={0}
            orientacao="horizontal"
            empilhado
            rotulosValor
          />
          <div data-motivos="rotulos" className="space-y-1">
            <p className="rotulo text-mineral">O que cada motivo quer dizer, com o rótulo da base publicada</p>
            <p className="text-xs leading-relaxed text-carvao-muted">Térmica despachada é a que o ONS manda gerar na programação da operação; o motivo é a classificação que o ONS publica para essa geração.</p>
            <ul className="grid gap-x-8 gap-y-1.5 text-sm leading-snug text-carvao-muted sm:grid-cols-2">
              {motivosNoGrafico.map((m) => (
                <li key={m.id} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-[0.4em] inline-block h-2 w-2 shrink-0" style={{ background: COR_MOTIVO[m.id] }} />
                  <span>
                    <span className="text-carvao">{m.rotulo}</span>
                    <span className="block text-xs">{GLOSA_MOTIVO[m.id]}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <GeracaoRecorte
        periodo={`${mesAno(u.inicio)} a ${mesAno(u.fim)} (12 meses completos, ${num(u.horas, 0)} horas); série mensal desde ${mesAno(t.primeiro_mes_na_gold)} e no arquivo desde ${mesAno(t.primeiro_mes)}`}
        universo={
          <>
            Usinas térmicas despachadas pelo ONS<span data-nivel="analisar"> (Tipo I e II-A)</span>, inclusive nucleares; {num(t.usinas_12m_resumo.usinas_com_geracao, 0)} usinas com geração no período
          </>
        }
        unidade="MWmed (média do período), GWh (energia) e % da geração térmica verificada; CVU em R$/MWh"
      />
      {notasUniverso}
      <TabelaInterativa
        titulo="Tabela equivalente: geração por combustível e motivo, 12 meses"
        colunas={colunasCombustivelMotivo(cruzado.motivos)}
        linhas={paraTabela(cruzadoLinhas)}
        chaveLinha="id"
        colunaRotulo="combustivel"
        fonte={fonte}
        versao={versao}
        nomeArquivo="geracao-termica-combustivel-motivo"
        chaveUrl="cm"
        nota="Motivo sem geração no período fica fora das colunas (zero em todos os combustíveis). Não classificado é o total verificado menos a soma dos motivos, com sinal, como a fonte publica."
      />

      {notas}

      <SecaoDoPainel id="motivos-mensal" titulo="Por que as térmicas geraram, mês a mês?">
        <GeracaoEscolha legenda="Período" opcoes={OPCOES_JANELA} valor={v.jt} onEscolher={(x) => definir({ jt: x })} />
        <GraficoBarras
          titulo={`Geração térmica média do SIN por motivo de despacho, ${mensal[0] ? mesAno(mensal[0].m) : ""} a ${ultimoMensal ? mesAno(ultimoMensal.m) : ""}`}
          dados={paraTabela(mensal)}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={mensalEscolhido.motivos.map((m) => ({ id: m, rotulo: CURTO_MOTIVO[m], cor: COR_MOTIVO[m] }))}
          unidade="MWmed"
          casas={0}
          empilhado
          altura={320}
        />
        {ultimoMensal && ultimoMensal.parcial === "sim" && (
          <GeracaoAviso>O último mês ({ultimoMensal.mes}) é parcial: a média cobre só as horas já publicadas e não se compara com meses completos.</GeracaoAviso>
        )}
        <TabelaInterativa
          titulo="Tabela equivalente: geração térmica média por motivo, mês a mês"
          colunas={colunasTermicaMensal(mensalEscolhido.motivos)}
          linhas={paraTabela(mensal)}
          chaveLinha="id"
          colunaRotulo="mes"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`geracao-termica-motivo-mensal-${v.jt}`}
          chaveUrl="tm"
          nota="Unit commitment só existe a partir de jan/2020 (entrada do DESSEM na programação, segundo o dicionário do ONS); antes disso a coluna fica vazia. Constrained-off térmico é restrição de geração, publicado à parte e fora da soma."
        />
      </SecaoDoPainel>

      {contextoSemana}

      <SecaoDoPainel
        id="usinas"
        titulo={`Quais usinas mais geraram? As ${num(t.usinas_12m_resumo.publicadas, 0)} com mais geração somam ${num(t.usinas_12m_resumo.cobertura_da_energia_pct, 1)}% da energia térmica`}
      >
        <GraficoBarras
          titulo={`As ${maiores.length} usinas térmicas com mais geração, ${mesAno(u.inicio)} a ${mesAno(u.fim)}`}
          dados={maiores.map((x) => ({ id: x.id, rotulo: `${x.nome ?? x.id} (${minusculaPalavras(CURTO_COMBUSTIVEL[x.categoria])})`, gwh: x.mwh === null ? null : x.mwh / 1000 }))}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={[{ id: "gwh", rotulo: "Geração em 12 meses", cor: "var(--serie-termica)" }]}
          unidade="GWh"
          casas={0}
          orientacao="horizontal"
          alturaCategoria={44}
          rotulosValor
          selecionado={sel}
          onSelecionar={selecionar}
        />
        <TabelaInterativa
          titulo="Usinas térmicas: geração, motivo principal, combustível e CVU"
          colunas={COLUNAS_USINAS_TERMICAS}
          linhas={paraTabela(usinas)}
          chaveLinha="id"
          colunaRotulo="nome"
          fonte={fonte}
          versao={versao}
          nomeArquivo="geracao-termica-usinas-12m"
          chaveUrl="us"
          selecionado={sel}
          onSelecionar={selecionar}
          ordemInicial={{ coluna: "gwh", direcao: "desc" }}
          dicaBusca="Nome da usina ou CEG"
          nota={`A lista completa, mês a mês e com todas as usinas, está no CSV para download, no fim do painel. Combustível pela autoridade publicada (${Object.values(ROTULO_ORIGEM_COMBUSTIVEL).slice(0, 3).join("; ")}...); nunca pelo nome.`}
        />
        {usina && (
          <div className="space-y-3" data-usina={usina.id}>
            <p className="text-sm text-carvao">
              <span className="font-medium">{usina.nome ?? usina.id}</span>: {CURTO_COMBUSTIVEL[usina.categoria].toLowerCase()}, {num(usina.mwmed, 1)} MWmed em média nos 12
              meses; motivo com maior parcela: {motivoPrincipal(usina).toLowerCase()}.{" "}
              {usina.chaves_na_fonte.length > 1 ? `A fonte publica a usina sob ${usina.chaves_na_fonte.length} chaves (${usina.chaves_na_fonte.join(", ")}), ligadas por um elo do ONS.` : ""}
              {usina.cvu_semana_vigente === null && usina.parcelas.length > 1 ? " Com várias parcelas, o CVU é o de cada parcela, na tabela abaixo." : ""}
            </p>
            <TabelaInterativa
              titulo={`Parcelas de ${usina.nome ?? usina.id} no ONS: geração e CVU da semana vigente`}
              colunas={COLUNAS_PARCELAS}
              linhas={paraTabela(parcelas)}
              chaveLinha="id"
              colunaRotulo="nome"
              fonte={fonte}
              versao={versao}
              nomeArquivo={`geracao-termica-parcelas-${usina.id}`}
              chaveUrl="pc"
              semLinhas="Nenhuma parcela com geração no período ou CVU na semana."
              nota={usina.parcelas_omitidas ? `${usina.parcelas_omitidas} parcelas sem geração no período nem CVU na semana ficam fora da lista.` : undefined}
            />
          </div>
        )}
        <Comparador
          rotulo={`Usinas para comparar os motivos (até ${LIMITE_COMPARACAO}); sem escolha, a selecionada na tabela`}
          entidades={t.usinas_12m.map((x) => ({ id: x.id, rotulo: x.nome ?? x.id, detalhe: CURTO_COMBUSTIVEL[x.categoria], sinonimos: x.chaves_na_fonte }))}
          selecionadas={comparadas}
          onMudar={(ids) => definir({ cmp: ids })}
          dicaBusca="Angra, Pecém, Santa Cruz"
          vazio={
            comparacaoPadrao && usinasComparadas.length
              ? `Mostrando ${usinasComparadas.map((x) => x.nome ?? x.id).join(", ")}, a maior usina de cada um de ${usinasComparadas.length} combustíveis. Escolha até quatro usinas para comparar.`
              : usina
                ? `Mostrando ${usina.nome ?? usina.id}. Escolha até quatro usinas para comparar.`
                : "Escolha até quatro usinas."
          }
        >
          {() => null}
        </Comparador>
        {usinasComparadas.length > 0 && (
          <>
            <GraficoBarras
              titulo={`Parcela de cada motivo na geração da usina, 12 meses: ${usinasComparadas.map((x) => x.nome ?? x.id).join(", ")}`}
              dados={paraTabela(motivosUsinas)}
              chaveCategoria="id"
              chaveRotulo="motivo"
              series={usinasComparadas.map((x, i) => ({ id: x.id, rotulo: x.nome ?? x.id, cor: usinasComparadas.length > 1 ? COR_COMPARACAO[i % COR_COMPARACAO.length] : COR_COMBUSTIVEL[x.categoria] }))}
              unidade="%"
              casas={1}
              orientacao="horizontal"
              rotulosValor
            />
            <p className="text-xs leading-relaxed text-carvao-muted" data-cvu-comparadas="">
              CVU da semana vigente:{" "}
              {usinasComparadas
                .map((x) => `${x.nome ?? x.id}, ${x.cvu_semana_vigente === null ? "um valor por parcela (tabela de parcelas)" : `${num(x.cvu_semana_vigente, 2)} R$/MWh`}`)
                .join("; ")}
              . Custo declarado para a programação, não custo realizado
              {usinasComparadas.some((x) => x.cvu_semana_vigente === 0) ? "; CVU 0,00 é valor publicado pela fonte, mantido como publicado e nunca tratado como ausência" : ""}.
            </p>
            <TabelaInterativa
              titulo="Tabela equivalente: parcela de cada motivo por usina"
              colunas={[{ id: "motivo", rotulo: "Motivo", tipo: "texto" }, ...usinasComparadas.map((x) => ({ id: x.id, rotulo: x.nome ?? x.id, tipo: "percentual" as const, casas: 2 }))]}
              linhas={paraTabela(motivosUsinas)}
              chaveLinha="id"
              colunaRotulo="motivo"
              fonte={fonte}
              versao={versao}
              nomeArquivo={`geracao-termica-motivos-usinas`}
              chaveUrl="mu"
              nota="Motivo que a usina não teve no período aparece como zero: a fonte classifica toda a geração verificada da usina nos motivos publicados."
            />
          </>
        )}
      </SecaoDoPainel>

      <SecaoDoPainel nivel="analisar" id="combustiveis-mensal" titulo={`Geração térmica por combustível, mês a mês (até ${LIMITE_COMPARACAO} na mesma escala)`}>
        <Comparador
          rotulo={`Combustíveis (até ${LIMITE_COMPARACAO}); sem escolha, os três com mais geração na série`}
          entidades={comSerie.map((c) => ({ id: c, rotulo: CURTO_COMBUSTIVEL[c] }))}
          selecionadas={cbs}
          onMudar={(ids) => definir({ cb: ids as CategoriaCombustivel[] })}
          dicaBusca="Gás, carvão, óleo"
          vazio={`Mostrando ${noHistorico.map((c) => CURTO_COMBUSTIVEL[c]).join(", ")}.`}
        >
          {() => null}
        </Comparador>
        <GraficoLinhas
          titulo={`Geração térmica média mensal: ${noHistorico.map((c) => CURTO_COMBUSTIVEL[c]).join(", ")}`}
          dados={combustivelMensal}
          chaveX="m"
          formatoX="mes"
          series={noHistorico.map((c) => ({ id: c, rotulo: CURTO_COMBUSTIVEL[c], cor: COR_COMBUSTIVEL[c] }))}
          unidade="MWmed"
          casas={0}
          zeroNoEixo
          zoom
          intervalo={intervalo}
          onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
        />
        <TabelaInterativa
          titulo={`Tabela equivalente: geração térmica média mensal por combustível (${noHistorico.map((c) => CURTO_COMBUSTIVEL[c]).join(", ")})`}
          colunas={[{ id: "m", rotulo: "Mês", tipo: "texto" }, ...noHistorico.map((c) => ({ id: c, rotulo: CURTO_COMBUSTIVEL[c], tipo: "numero" as const, unidade: "MWmed", casas: 1 }))]}
          linhas={paraTabela(combustivelMensal)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`geracao-termica-combustivel-mensal-${noHistorico.join("-")}`}
          chaveUrl="cbm"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
          nota="Até 2025 o combustível vem pelo CEG da usina em outros conjuntos do ONS; desde 2026, do campo do próprio conjunto. As térmicas Tipo III sem combustível só aparecem na matriz efetiva."
        />
      </SecaoDoPainel>
    </div>
  );
}
