"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GeracaoAviso, GeracaoEscolha, GeracaoRecorte } from "@/components/energia/GeracaoControles";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { mesAno, num } from "@/lib/energia/formato";
import {
  CATEGORIAS,
  COR_CATEGORIA,
  COR_COMPARACAO,
  CURTO_CATEGORIA,
  DO_REGIAO,
  JANELAS,
  NOME_REGIAO,
  NO_REGIAO,
  PERIMETROS,
  REGIOES,
  ROTULO_JANELA,
  ROTULO_PERIMETRO,
  colunasMatriz,
  colunasMensalMatriz,
  janelaEscolhida,
  janelaReferencia,
  janelasDisponiveis,
  linhasCategoriasMensal,
  linhasMatriz,
  linhasMensalMatriz,
  paraTabela,
  periodoMix,
  primeiroMesComMmgd,
  respostaMatriz,
  ressalvasDaJanela,
  textoNatureza,
} from "@/lib/energia/geracao";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { CategoriaGeracao, Matriz, MensalSin } from "@/lib/energia/tipos-geracao";

/**
 * P021, matriz efetiva. O recorte fica na URL: região (?rg=), janela (?jan=), perímetro com
 * ou sem a MMGD estimada (?per=), categoria selecionada (?cat=), categorias comparadas no
 * histórico (?cmp=, até quatro) e o intervalo do histórico (?de=, ?ate=); busca, ordem e
 * filtros de cada tabela também (prefixos mx, mm, mc). Escolher uma categoria na barra ou
 * na tabela leva a mesma categoria ao histórico mensal.
 *
 * A resposta escrita, o gráfico de participação e a tabela equivalente saem da mesma
 * janela (linhasMatriz): mudar o recorte muda os três juntos. Nenhuma participação é
 * calculada aqui; a referência de comparação é a janela de 365 dias da mesma região (ou a
 * de 30 dias, quando a escolhida já é a de 365).
 */
const ESQUEMA = {
  rg: campo(tiposUrl.opcao(REGIOES), "SIN"),
  jan: campo(tiposUrl.opcao(JANELAS), "30d"),
  per: campo(tiposUrl.opcao(PERIMETROS), "com"),
  cat: campo(tiposUrl.texto({ max: 30 }), ""),
  cmp: campo(tiposUrl.lista(tiposUrl.opcao(CATEGORIAS), { max: LIMITE_COMPARACAO }), [] as CategoriaGeracao[]),
  de: campo(tiposUrl.mes(), ""),
  ate: campo(tiposUrl.mes(), ""),
};

const OPCOES_REGIAO = REGIOES.map((r) => ({ id: r, rotulo: r === "SE" ? "SE/CO" : r === "SIN" ? "SIN" : NOME_REGIAO[r], detalhe: NOME_REGIAO[r] }));
const OPCOES_PERIMETRO = PERIMETROS.map((p) => ({ id: p, rotulo: ROTULO_PERIMETRO[p] }));

export function GeracaoMatriz({
  janelas,
  mensal,
  nomes,
  marcos,
  fonte,
  versao,
  destaques,
}: {
  janelas: Matriz["janelas"];
  mensal: MensalSin;
  /** Nome completo de cada categoria, como a gold publica. */
  nomes: Record<CategoriaGeracao, string>;
  /** Mudanças de universo declaradas pela fonte, em AAAA-MM. */
  marcos: { x: string; rotulo: string }[];
  fonte: string;
  versao: string;
  destaques?: ReactNode;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const m = useMemo(() => ({ janelas }), [janelas]);
  const rg = v.rg;
  const per = v.per;
  const { janela, mix, ajustada } = janelaEscolhida(m, rg, v.jan);
  const ref = janelaReferencia(janela);
  const mixRef = janelas[rg]?.[ref] ?? null;
  const linhas = useMemo(() => linhasMatriz(m, rg, janela, per, nomes), [m, rg, janela, per, nomes]);
  const resposta = respostaMatriz(m, rg, janela, per);
  const ressalvas = ressalvasDaJanela(mix, nomes).filter((r) => !(per === "sem" && r.id === "solar_mmgd"));
  const presencas = linhas.filter((l) => l.presenca);
  const sel = linhas.some((l) => l.id === v.cat) ? (v.cat as CategoriaGeracao) : null;
  const selecionar = (id: string | null) => definir({ cat: id ?? "" });
  const opcoesJanela = janelasDisponiveis(m, rg).map((j) => ({ id: j, rotulo: ROTULO_JANELA[j] }));

  const mensalEscolhido = useMemo(() => linhasMensalMatriz(mensal, per), [mensal, per]);
  const mensalLinhas = mensalEscolhido.linhas;
  const inicioMmgd = primeiroMesComMmgd(mensal);
  const ultimo = mensalLinhas[mensalLinhas.length - 1];

  // histórico: as categorias comparadas; sem escolha, a selecionada; sem seleção, a maior da janela
  const comSerie = CATEGORIAS.filter((c) => mensal[c].some((x) => x !== null));
  const maior = [...linhas].sort((a, b) => (b.participacao ?? -1) - (a.participacao ?? -1))[0]?.id ?? "hidraulica";
  const comparadas = (v.cmp as CategoriaGeracao[]).filter((c) => comSerie.includes(c));
  const noHistorico: CategoriaGeracao[] = comparadas.length ? comparadas : [sel ?? maior];
  const chaveHistorico = noHistorico.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a lista é recriada a cada render; a chave textual estabiliza
  const historico = useMemo(() => linhasCategoriasMensal(mensal, noHistorico), [mensal, chaveHistorico]);
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;

  return (
    <div className="space-y-6">
      <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="p021">
        {resposta}
      </p>

      <GeracaoRecorte
        periodo={mix ? `${periodoMix(mix)}; dias completos (24 horas em todos os subsistemas)` : "sem janela publicada"}
        universo={
          <>
            Usinas, conjuntos e grupos de pequenas usinas da Geração por Usina do ONS, {NO_REGIAO[rg]}
            {mix ? `; natureza da energia: ${textoNatureza(mix.natureza_pct)}` : ""}
          </>
        }
        unidade={`MWmed (energia média do período) e % da geração ${per === "com" ? "com a MMGD estimada" : "sem a MMGD"}`}
      />

      {destaques}

      <div className="grid gap-4 md:grid-cols-3">
        <GeracaoEscolha legenda="Região" opcoes={OPCOES_REGIAO} valor={rg} onEscolher={(x) => definir({ rg: x })} />
        <GeracaoEscolha legenda="Janela" opcoes={opcoesJanela} valor={janela} onEscolher={(x) => definir({ jan: x })} />
        <GeracaoEscolha legenda="Perímetro" opcoes={OPCOES_PERIMETRO} valor={per} onEscolher={(x) => definir({ per: x })} />
      </div>
      {ajustada && (
        <GeracaoAviso>
          A janela pedida não é publicada para {NOME_REGIAO[rg]}: os subsistemas têm só 30 e 365 dias. Mostrando {ROTULO_JANELA[janela]}.
        </GeracaoAviso>
      )}

      <GraficoBarras
        titulo={`Participação na geração ${DO_REGIAO[rg]}: ${ROTULO_JANELA[janela]} contra ${ROTULO_JANELA[ref]} (${ROTULO_PERIMETRO[per].toLowerCase()})`}
        dados={paraTabela(linhas)}
        chaveCategoria="id"
        chaveRotulo="curto"
        series={[
          { id: "participacao", rotulo: mix ? `${ROTULO_JANELA[janela]} (${periodoMix(mix)})` : ROTULO_JANELA[janela], cor: "var(--cor-energia)" },
          { id: "participacao_ref", rotulo: mixRef ? `${ROTULO_JANELA[ref]} (${periodoMix(mixRef)})` : ROTULO_JANELA[ref], cor: "var(--serie-referencia)" },
        ]}
        unidade="%"
        casas={1}
        orientacao="horizontal"
        rotulosValor
        selecionado={sel}
        onSelecionar={selecionar}
      />
      {ressalvas.length > 0 && (
        <div className="space-y-1 border-l-2 border-aviso pl-3 text-sm text-carvao" data-ressalvas="p021">
          <p className="rotulo text-mineral">Ressalvas de universo nesta janela</p>
          <ul className="space-y-1">
            {ressalvas.map((r) => (
              <li key={r.id} className="[overflow-wrap:anywhere]">
                <span className="text-carvao">{CURTO_CATEGORIA[r.id]}</span>: {r.texto.replace(/^Ressalva de universo: /, "")}
              </li>
            ))}
          </ul>
          <p className="text-carvao-muted">A participação continua publicada, mas reflete só as usinas que a fonte publicou com dado; não se compara com a de períodos anteriores.</p>
        </div>
      )}
      {presencas.length > 0 && (
        <GeracaoAviso>
          Presença parcial no período: {presencas.map((l) => `${CURTO_CATEGORIA[l.id]} (${l.presenca})`).join("; ")}. A categoria entra com a energia dos dias em que existe.
        </GeracaoAviso>
      )}
      <TabelaInterativa
        titulo={`Tabela equivalente: geração e participação por categoria, ${NOME_REGIAO[rg]}`}
        colunas={colunasMatriz(janela, per)}
        linhas={paraTabela(linhas)}
        chaveLinha="id"
        colunaRotulo="categoria"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`geracao-matriz-${rg}-${janela}-${per}`}
        chaveUrl="mx"
        selecionado={sel}
        onSelecionar={selecionar}
        nota="Categoria sem linha no período fica vazia (ausência), distinta de zero. As participações vêm da gold, sem novo arredondamento; somam 100% dentro de 0,05 ponto em cada janela (controle publicado)."
      />

      <div className="space-y-4 border-t border-linha pt-5" id="historico-mensal">
        <h3 className="font-serif text-lg text-carvao">Energia por fonte, mês a mês ({ROTULO_PERIMETRO[per].toLowerCase()})</h3>
        <GraficoBarras
          titulo={`Geração média mensal do SIN por categoria, ${ROTULO_PERIMETRO[per].toLowerCase()}`}
          dados={paraTabela(mensalLinhas)}
          chaveCategoria="id"
          chaveRotulo="mes"
          series={mensalEscolhido.series.map((c) => ({ id: c, rotulo: CURTO_CATEGORIA[c], cor: COR_CATEGORIA[c] }))}
          unidade="MWmed"
          casas={0}
          empilhado
          altura={340}
        />
        <GeracaoAviso>
          {per === "com"
            ? `Com a MMGD, a série começa em ${inicioMmgd ? mesAno(inicioMmgd) : "sem mês"}, o primeiro mês em que a estimativa do ONS existe em todos os dias (ela começa em 29/04/2023). Para comparar com antes dessa data, escolha o perímetro sem MMGD.`
            : "Sem a MMGD, a série cobre todo o período publicado e pode ser comparada através de 29/04/2023. Em jan/2021 e fev/2021 os grupos térmicos Tipo III ainda não existiam na fonte: a pilha fica incompleta (hachura), não zero."}
          {ultimo && ultimo.parcial !== "não" ? ` O último mês (${ultimo.mes}) é ${ultimo.parcial}.` : ""}
        </GeracaoAviso>
        <TabelaInterativa
          titulo={`Tabela equivalente: geração média mensal por categoria (${ROTULO_PERIMETRO[per].toLowerCase()})`}
          colunas={colunasMensalMatriz(mensalEscolhido.series)}
          linhas={paraTabela(mensalLinhas)}
          chaveLinha="id"
          colunaRotulo="mes"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`geracao-matriz-mensal-${per}`}
          chaveUrl="mm"
          nota="Mês com ressalva de universo numa categoria: a participação dela naquele mês reflete só as usinas publicadas com dado."
        />
      </div>

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5" id="comparar-categorias">
        <h3 className="font-serif text-lg text-carvao">Comparar até {LIMITE_COMPARACAO} categorias na mesma escala</h3>
        <Comparador
          rotulo={`Categorias no histórico (até ${LIMITE_COMPARACAO}); sem escolha, a selecionada no gráfico ou a maior da janela`}
          entidades={comSerie.map((c) => ({ id: c, rotulo: CURTO_CATEGORIA[c], detalhe: nomes[c] }))}
          selecionadas={comparadas}
          onMudar={(ids) => definir({ cmp: ids as CategoriaGeracao[] })}
          dicaBusca="Eólica, gás, biomassa"
          vazio={`Mostrando ${CURTO_CATEGORIA[noHistorico[0]]}. Escolha até quatro categorias para comparar.`}
        >
          {() => null}
        </Comparador>
        <GraficoLinhas
          titulo={`Geração média mensal do SIN: ${noHistorico.map((c) => CURTO_CATEGORIA[c]).join(", ")}`}
          dados={historico}
          chaveX="m"
          formatoX="mes"
          series={noHistorico.map((c, i) => ({ id: c, rotulo: CURTO_CATEGORIA[c], cor: noHistorico.length > 1 ? COR_COMPARACAO[i % COR_COMPARACAO.length] : COR_CATEGORIA[c] }))}
          unidade="MWmed"
          casas={0}
          zeroNoEixo
          zoom
          intervalo={intervalo}
          onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
          marcos={marcos}
        />
        <TabelaInterativa
          titulo={`Tabela equivalente: geração média mensal (${noHistorico.map((c) => CURTO_CATEGORIA[c]).join(", ")})`}
          colunas={[{ id: "m", rotulo: "Mês", tipo: "texto" }, ...noHistorico.map((c) => ({ id: c, rotulo: CURTO_CATEGORIA[c], tipo: "numero" as const, unidade: "MWmed", casas: 1 }))]}
          linhas={paraTabela(historico)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`geracao-categorias-mensal-${noHistorico.join("-")}`}
          chaveUrl="mc"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
          nota={`Mês em que a categoria não tem linha na fonte fica vazio (ausência): a MMGD antes de 29/04/2023 e os grupos térmicos Tipo III antes de mar/2021, por exemplo. Valores de ${num(mensal.meses.length, 0)} meses.`}
        />
      </div>
    </div>
  );
}
