"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RedeEscolha } from "@/components/energia/RedeControles";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { dataBR, mesAno } from "@/lib/energia/formato";
import {
  COLUNAS_ATLS,
  COLUNAS_INTERRUPCOES_ANO,
  COLUNAS_PERTURBACOES,
  COR_COMPARACAO,
  COR_SM,
  NOME_SM,
  REGIOES_BALANCO,
  fluxoEscolhido,
  fluxosAtivos,
  linhasAtls,
  linhasInterrupcoesAno,
  linhasPerturbacoes,
  paraTabela,
  respostaRestricoes,
  serieAtls,
} from "@/lib/energia/rede";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { RestricoesRede, SubsistemaOuSin } from "@/lib/energia/tipos-rede";

/**
 * P030, restrições publicadas. O recorte fica na URL: fluxo do ATLS escolhido (?fl=),
 * fluxos comparados no histórico (?fls=, até quatro), região das interrupções (?smi=)
 * e intervalo do histórico mensal (?de=, ?ate=); busca, ordem, filtros e página de cada
 * tabela também (prefixos at, atm, at.h, int, mp, pr). Escolher um fluxo na barra ou na
 * tabela muda a ficha de prova, a definição e o histórico juntos.
 *
 * Pergunta própria (Anexo A, P030): sem limites operativos públicos (achado A06), o
 * painel mostra a evidência publicada de limitação, que é o tempo acima do limite
 * sistêmico (ATLS) e os cortes de carga. Nenhum percentual de utilização é calculado.
 */
const ESQUEMA = {
  fl: campo(tiposUrl.texto({ max: 20 }), ""),
  fls: campo(tiposUrl.lista(tiposUrl.texto({ max: 20 }), { max: LIMITE_COMPARACAO }), [] as string[]),
  smi: campo(tiposUrl.opcao(REGIOES_BALANCO), "SIN"),
  de: campo(tiposUrl.mes(), ""),
  ate: campo(tiposUrl.mes(), ""),
};

const OPCOES_REGIAO = REGIOES_BALANCO.map((sm) => ({ id: sm, rotulo: sm === "SE" ? "SE/CO" : NOME_SM[sm], detalhe: NOME_SM[sm] }));

export function RedeRestricoes({
  restricoes,
  evidencias,
  fonteAtls,
  fonteInterrupcoes,
  versao,
  destaques,
}: {
  restricoes: Pick<RestricoesRede, "atls" | "interrupcoes">;
  /** Fichas de prova das horas de 12 meses por fluxo (chave atls_12m.<fluxo>). */
  evidencias: Record<string, Evidencia>;
  fonteAtls: string;
  fonteInterrupcoes: string;
  versao: string;
  destaques?: ReactNode;
}) {
  const r = restricoes;
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const ativos = useMemo(() => fluxosAtivos(r.atls), [r.atls]);
  const escolhido = fluxoEscolhido(r.atls, v.fl);
  const linhasAtivos = useMemo(() => linhasAtls(ativos), [ativos]);
  const linhasTodos = useMemo(() => linhasAtls(r.atls.fluxos), [r.atls.fluxos]);
  const conhecidos = new Set(r.atls.fluxos.map((f) => f.fluxo));
  const comparados = (v.fls as string[]).filter((f) => conhecidos.has(f));
  const noHistorico = comparados.length ? comparados : escolhido ? [escolhido.fluxo] : [];
  const fluxosHistorico = r.atls.fluxos.filter((f) => noHistorico.includes(f.fluxo));
  const serie = useMemo(() => serieAtls(fluxosHistorico), [fluxosHistorico]);
  const smi = v.smi as SubsistemaOuSin;
  const anual = useMemo(() => linhasInterrupcoesAno(r.interrupcoes, smi), [r.interrupcoes, smi]);
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const selecionar = (id: string | null) => definir({ fl: id ?? "" });
  const ev = escolhido ? evidencias[`atls_12m.${escolhido.fluxo}`] : undefined;
  const ultimo = r.atls.ultimo_mes;

  return (
    <div className="space-y-6">
      <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="p030">
        {respostaRestricoes(r)}
      </p>

      <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-0.5">
            ATLS: {ativos[0]?.ultimos_12_meses ? `${mesAno(ativos[0].ultimos_12_meses.inicio)} a ${mesAno(ativos[0].ultimos_12_meses.fim)}` : "sem janela"} (mensal, último mês{" "}
            {ultimo ? mesAno(ultimo) : "sem dado"}); interrupções: {dataBR(r.interrupcoes.ultimos_12_meses.inicio)} a {dataBR(r.interrupcoes.ultimos_12_meses.fim)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5">
            Fluxos sistêmicos que o ONS acompanha no ATLS ({ativos.length} publicados no último mês, {r.atls.fluxos.length} no histórico); perturbações com corte de carga
            registradas pelo ONS
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">Unidade</dt>
          <dd className="mt-0.5">Horas acima do limite (h); energia não suprida em MWh</dd>
        </div>
      </dl>

      {destaques}

      <GraficoBarras
        titulo={`Horas acima do limite em 12 meses, fluxos publicados em ${ultimo ? mesAno(ultimo) : "último mês"}`}
        dados={paraTabela(linhasAtivos)}
        chaveCategoria="id"
        chaveRotulo="fluxo"
        series={[{ id: "horas_12m", rotulo: "Horas acima do limite", cor: "var(--cor-energia)" }]}
        unidade="h"
        casas={1}
        orientacao="horizontal"
        rotulosValor
        selecionado={escolhido?.fluxo ?? null}
        onSelecionar={selecionar}
      />
      <TabelaInterativa
        titulo="Tabela equivalente: fluxos publicados no último mês"
        colunas={COLUNAS_ATLS}
        linhas={paraTabela(linhasAtivos)}
        chaveLinha="id"
        colunaRotulo="fluxo"
        fonte={fonteAtls}
        versao={versao}
        nomeArquivo="rede-atls-12-meses"
        chaveUrl="at"
        selecionado={escolhido?.fluxo ?? null}
        onSelecionar={selecionar}
        nota="Definição só quando conferida literalmente em documento público do ONS; as demais siglas ficam sem definição. A correspondência entre siglas do ATLS e as fronteiras do conjunto de intercâmbio não é direta e não é feita."
      />

      {escolhido && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_1fr]">
            <Numero
              rotulo={`Horas acima do limite em 12 meses, ${escolhido.fluxo}`}
              natureza="CALCULADO"
              valor={ev ? undefined : (escolhido.ultimos_12_meses?.horas_violacao ?? null)}
              evidencia={ev ?? null}
              casas={1}
              unidade="h"
              periodo={escolhido.ultimos_12_meses ? `${mesAno(escolhido.ultimos_12_meses.inicio)} a ${mesAno(escolhido.ultimos_12_meses.fim)}` : undefined}
              tamanho="medio"
              motivoAusencia="Sem mês publicado na janela."
              nota={escolhido.ativo ? undefined : `Fluxo encerrado: último mês publicado ${escolhido.fim ? mesAno(escolhido.fim) : "sem dado"}; a janela é a dos seus 12 últimos meses.`}
            />
            <div className="space-y-2 text-sm text-carvao-muted">
              <p>
                <span className="text-carvao">{escolhido.fluxo}</span>
                {escolhido.definicao ? `: ${escolhido.definicao} (definição conferida em ${escolhido.documento_definicao ?? "documento do ONS"}).` : ": sem definição em documento público conferido; a sigla é publicada como o ONS a escreve."}
              </p>
              <p>
                No arquivo de {escolhido.inicio ? mesAno(escolhido.inicio) : "sem início"} a {escolhido.fim ? mesAno(escolhido.fim) : "sem fim"}: {escolhido.meses_com_violacao} de{" "}
                {escolhido.meses} meses com alguma hora acima do limite.
                {escolhido.conferencias.meses_denominador_diferente_do_calendario.length
                  ? ` Em ${escolhido.conferencias.meses_denominador_diferente_do_calendario.length} meses o período de observação implícito difere do calendário em uma hora (registrado, sem causa atribuída).`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <Comparador
          rotulo={`Fluxos no histórico (até ${LIMITE_COMPARACAO}); sem escolha, o fluxo selecionado acima`}
          entidades={r.atls.fluxos.map((f) => ({ id: f.fluxo, rotulo: f.fluxo, detalhe: f.definicao ?? (f.ativo ? "publicado no último mês" : "encerrado") }))}
          selecionadas={comparados}
          onMudar={(ids) => definir({ fls: ids })}
          dicaBusca="FNS, RSUL, FNESE"
          vazio={escolhido ? `Mostrando ${escolhido.fluxo}. Escolha até quatro fluxos para comparar na mesma escala.` : "Escolha até quatro fluxos."}
        >
          {() => null}
        </Comparador>
        {serie.length ? (
          <GraficoLinhas
            titulo={`Horas acima do limite por mês: ${noHistorico.join(", ")}`}
            dados={serie}
            chaveX="m"
            formatoX="mes"
            series={noHistorico.map((f, i) => ({ id: f, rotulo: f, cor: COR_COMPARACAO[i % COR_COMPARACAO.length] }))}
            unidade="h"
            casas={1}
            zeroNoEixo
            zoom
            intervalo={intervalo}
            onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
          />
        ) : (
          <p className="border-l-2 border-mineral pl-3 text-sm text-carvao-muted">
            {noHistorico.join(", ")}: sem mês publicado desde o início da série da gold; o histórico completo, desde 2017, está no arquivo do ATLS para download.
          </p>
        )}
        <TabelaInterativa
          titulo={`Tabela equivalente: horas acima do limite por mês (${noHistorico.join(", ")})`}
          colunas={[{ id: "m", rotulo: "Mês", tipo: "texto" }, ...noHistorico.map((f) => ({ id: f, rotulo: f, tipo: "numero" as const, unidade: "h", casas: 1 }))]}
          linhas={paraTabela(serie)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonteAtls}
          versao={versao}
          nomeArquivo={`rede-atls-mensal-${noHistorico.join("-")}`}
          chaveUrl="atm"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
          semLinhas="Nenhum mês publicado na série da gold para os fluxos escolhidos."
          nota="Mês sem publicação do fluxo fica vazio (ausência), distinto de zero hora acima do limite."
        />
      </div>

      <div className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Cortes de carga por ano</h3>
        <RedeEscolha legenda="Região" opcoes={OPCOES_REGIAO} valor={smi} onEscolher={(x) => definir({ smi: x })} />
        <GraficoBarras
          titulo={`Energia não suprida em cortes de carga por ano, ${smi === "SIN" ? "SIN" : NOME_SM[smi]}`}
          dados={paraTabela(anual)}
          chaveCategoria="id"
          chaveRotulo="ano"
          series={[{ id: "ens_mwh", rotulo: "Energia não suprida", cor: COR_SM[smi] }]}
          unidade="MWh"
          casas={1}
        />
        <p className="text-sm text-carvao-muted">
          {anual.some((l) => l.parcial === "sim") ? `${anual.filter((l) => l.parcial === "sim").map((l) => l.id).join(", ")} é parcial e não se compara com anos completos. ` : ""}
          Um corte de carga registrado não prova limite de intercâmbio, e este painel não atribui causa aos registros.
        </p>
        <TabelaInterativa
          titulo={`Tabela equivalente: cortes de carga por ano, ${smi === "SIN" ? "SIN" : NOME_SM[smi]}`}
          colunas={COLUNAS_INTERRUPCOES_ANO}
          linhas={paraTabela(anual)}
          chaveLinha="id"
          colunaRotulo="ano"
          fonte={fonteInterrupcoes}
          versao={versao}
          nomeArquivo={`rede-interrupcoes-${smi}`}
          chaveUrl="int"
          ordemInicial={{ coluna: "ano", direcao: "desc" }}
        />
      </div>

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Perturbações: as maiores e as mais recentes</h3>
        <TabelaInterativa
          titulo={`As ${r.interrupcoes.maiores_perturbacoes.length} perturbações com mais energia não suprida desde ${dataBR(r.interrupcoes.inicio)}`}
          colunas={COLUNAS_PERTURBACOES}
          linhas={paraTabela(linhasPerturbacoes(r.interrupcoes.maiores_perturbacoes))}
          chaveLinha="id"
          colunaRotulo="cod_perturbacao"
          fonte={fonteInterrupcoes}
          versao={versao}
          nomeArquivo="rede-maiores-perturbacoes"
          chaveUrl="mp"
          ordemInicial={{ coluna: "ens_mwh", direcao: "desc" }}
        />
        <TabelaInterativa
          titulo={`As ${r.interrupcoes.perturbacoes_recentes.length} perturbações mais recentes, até ${dataBR(r.interrupcoes.fim)}`}
          colunas={COLUNAS_PERTURBACOES}
          linhas={paraTabela(linhasPerturbacoes(r.interrupcoes.perturbacoes_recentes))}
          chaveLinha="id"
          colunaRotulo="cod_perturbacao"
          fonte={fonteInterrupcoes}
          versao={versao}
          nomeArquivo="rede-perturbacoes-recentes"
          chaveUrl="pr"
          ordemInicial={{ coluna: "inicio", direcao: "desc" }}
          nota={`${r.interrupcoes.registros_abaixo_de_100mw.toLocaleString("pt-BR")} dos ${r.interrupcoes.registros.toLocaleString("pt-BR")} registros têm carga interrompida abaixo de 100 MW, embora a descrição do conjunto cite cortes maiores que 100 MW por 10 minutos ou mais; os registros são publicados como vieram.`}
        />
      </div>

      <div data-nivel="auditar" className="space-y-3 border-t border-dashed border-linha pt-4">
        <h3 className="font-serif text-lg text-carvao">Todos os fluxos do arquivo do ATLS, inclusive os encerrados</h3>
        <TabelaInterativa
          titulo="Fluxos do ATLS no arquivo do ONS"
          colunas={COLUNAS_ATLS}
          linhas={paraTabela(linhasTodos)}
          chaveLinha="id"
          colunaRotulo="fluxo"
          fonte={fonteAtls}
          versao={versao}
          nomeArquivo="rede-atls-fluxos"
          chaveUrl="at.h"
          selecionado={escolhido?.fluxo ?? null}
          onSelecionar={selecionar}
          nota={`Unidade publicada: ${r.atls.unidade_publicada}. Fluxo encerrado tem a janela de 12 meses terminada no seu último mês publicado.`}
        />
      </div>
    </div>
  );
}
