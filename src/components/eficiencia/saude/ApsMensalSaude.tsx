"use client";

import { useMemo } from "react";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { Controles, TabelaDados } from "@/components/painel";
import { useEstadoUrl } from "@/components/painel/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/painel/estadoUrl";
import { competenciaBr, MEDIDAS_MENSAIS, mesesDoAno, expandirApsMensal, type ApsMensalCompacta, type MedidaMensal } from "@/lib/eficiencia/saude/mensal";
import { dataBr } from "@/lib/eficiencia/formato";
import { Selecao } from "../controles";

export function ApsMensalSaude({ compacto }: { compacto: ApsMensalCompacta }) {
  const dados = useMemo(() => expandirApsMensal(compacto), [compacto]);
  const capitais = Object.entries(dados.fontes).sort((a, b) => a[1].capital.localeCompare(b[1].capital, "pt-BR"));
  const anos = [...new Set(dados.competencias.map((c) => c.slice(0, 4)))];
  const esquema = useMemo(() => ({
    aps_cap: campo(tiposUrl.opcao(Object.keys(dados.fontes)), Object.keys(dados.fontes)[0]),
    aps_ano: campo(tiposUrl.opcao([...new Set(dados.competencias.map((c) => c.slice(0, 4)))]), dados.competencias.at(-1)!.slice(0, 4)),
    aps_mes: campo(tiposUrl.opcao(dados.competencias), dados.competencias.at(-1)!),
    aps_med: campo(tiposUrl.opcao(Object.keys(MEDIDAS_MENSAIS) as MedidaMensal[]), "cobertura_pct" as MedidaMensal),
    aps_vista: campo(tiposUrl.opcao(["serie", "capitais"]), "serie"),
  }), [dados]);
  const [estado, definir] = useEstadoUrl(esquema);
  const m = MEDIDAS_MENSAIS[estado.aps_med];
  const fonte = dados.fontes[estado.aps_cap];
  const serie = estado.aps_vista === "serie";
  const meses = mesesDoAno(dados, Number(estado.aps_cap), estado.aps_ano);
  const linhas = serie
    ? meses.map(({ competencia, linha }) => [competenciaBr(competencia), linha?.[estado.aps_med] ?? null, linha?.populacao_referencia ?? null, linha ? (linha.metodo === "regra_anterior_2021" ? "Regra anterior (2021)" : linha.status === "INCOMPLETO" ? "Registro incompleto" : linha.status === "PROVISORIO" ? "Provisório (cadastro incompleto)" : "Registro disponível") : "Sem registro"])
    : capitais.map(([codigo, f]) => {
      const r = dados.linhas.find((x) => x.codigo_ibge === Number(codigo) && x.competencia === estado.aps_mes);
      return [`${f.capital} (${f.uf})`, r?.[estado.aps_med] ?? null, r?.populacao_referencia ?? null, r ? (r.metodo === "regra_anterior_2021" ? "Regra anterior (2021)" : r.status === "INCOMPLETO" ? "Registro incompleto" : r.status === "PROVISORIO" ? "Provisório (cadastro incompleto)" : "Registro disponível") : "Sem registro"];
    });
  const comValor = linhas.filter((r) => r[1] !== null).length;
  const ano = serie ? estado.aps_ano : estado.aps_mes.slice(0, 4);
  const captura = serie ? fonte.capturado_em : Object.values(dados.fontes).map((f) => f.capturado_em).sort().at(-1)!;
  return (
    <Recolhido id="aps-mensal" aberto nivelTitulo={2} titulo="Como a atenção primária muda mês a mês?"
      resumo={`Equipes registradas e cobertura potencial estimada nas ${capitais.length} capitais, de ${competenciaBr(dados.competencias[0])} a ${competenciaBr(dados.competencias.at(-1)!)}.`}>
      <p className="t-corpo max-w-prose2 text-carvao-muted">Cada mês é um retrato do cadastro; somar os meses contaria as mesmas equipes várias vezes.</p>
      <div className="mt-6">
        <Controles idioma="pt" rotulo="Recorte mensal da atenção primária" resumo={`${comValor} de ${linhas.length} ${serie ? "meses" : "capitais"} com valor para a medida selecionada.`}>
          <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Selecao id="aps-vista" rotulo="Leitura" ajuda="Este recorte mensal é independente do anual." valor={estado.aps_vista} opcoes={[{ v: "serie", t: "Meses de uma capital" }, { v: "capitais", t: "Capitais no mesmo mês" }]} aoMudar={(v) => definir({ aps_vista: v as "serie" | "capitais" })} />
            {serie ? <Selecao id="aps-capital" rotulo="Capital" ajuda="Serviços registrados no território." valor={estado.aps_cap} opcoes={capitais.map(([v, f]) => ({ v, t: `${f.capital} (${f.uf})` }))} aoMudar={(v) => definir({ aps_cap: v })} /> : <Selecao id="aps-mes" rotulo="Competência" ajuda="Sem misturar meses diferentes." valor={estado.aps_mes} opcoes={dados.competencias.map((v) => ({ v, t: competenciaBr(v) }))} aoMudar={(v) => definir({ aps_mes: v })} />}
            {serie && <Selecao id="aps-ano" rotulo="Ano" ajuda="Somente meses já disponíveis na captura." valor={estado.aps_ano} opcoes={anos.map((v) => ({ v, t: v }))} aoMudar={(v) => definir({ aps_ano: v })} />}
            <Selecao id="aps-medida" rotulo="Medida mensal" ajuda={m.unidade} valor={estado.aps_med} opcoes={Object.entries(MEDIDAS_MENSAIS).map(([v, x]) => ({ v, t: x.nome }))} aoMudar={(v) => definir({ aps_med: v as MedidaMensal })} />
          </div>
        </Controles>
      </div>
      <h3 className="t-h3 mt-6">{m.nome} · {serie ? `${fonte.capital}, ${ano}` : competenciaBr(estado.aps_mes)}</h3>
      <p className="t-meta mt-2 text-carvao-muted"><SeloNatureza natureza="OBSERVADO" idioma="pt" /> Valores publicados pela fonte, inclusive quando provisórios.</p>
      <p className="t-meta mt-2 text-carvao-muted">Unidade: {m.unidade}. Fonte: Ministério da Saúde, Relatório APS. Captura {serie ? "em" : "até"} {dataBr(captura)}; os registros estão sujeitos a revisão.</p>
      {ano === "2021" && <p className="t-corpo mt-3 max-w-prose2 text-carvao">Em 2021, a capacidade segue a regra anterior e não reproduz a fórmula atual. Os valores são históricos e ficam fora da comparação com os anos seguintes.</p>}
      {Number(ano) >= 2026 && <p className="t-corpo mt-3 max-w-prose2 text-carvao">Em 2026, o cadastro vinculado das equipes especiais está incompleto na captura. Estes registros são provisórios, apenas para consulta; não entram nas comparações anuais nem indicam redução real da cobertura ou dos atendimentos.</p>}
      <p className="t-meta mt-3 text-carvao-muted sm:hidden">A tabela continua à direita. Deslize para consultar população e situação.</p>
      <TabelaDados idioma="pt" recolhida={false} titulo={`${m.nome}: ${serie ? fonte.capital : "capitais"}, ${serie ? ano : competenciaBr(estado.aps_mes)}`} colunas={[serie ? "Competência" : "Capital", `${m.nome} (${m.unidade})`, "População de referência (habitantes)", "Situação"]} linhas={linhas} casas={[null, m.casas, 0, null]} limite={linhas.length} fixarPrimeiraColuna csv="/eficiencia/series/saude_aps_mensal.csv" nota="O CSV completo reúne todas as capitais, competências e medidas, com URL, captura e hash do arquivo de origem. Ausência permanece sem dado; zero é um registro numérico." />
      <p className="t-corpo mt-4 max-w-prose2 text-carvao-muted">Cobertura potencial não mede pessoas atendidas, consultas, qualidade ou acesso. A população ao lado é a referência usada pelo Ministério em cada mês; uma troca dessa base também altera a cobertura. Percentuais acima de 100% são preservados como publicados.</p>
      <details className="mt-4 border-t border-linha py-2">
        <summary className="min-h-[44px] cursor-pointer py-3 text-obee-dark">Fonte, fórmula e limites da série mensal</summary>
        <div className="t-corpo max-w-prose2 space-y-3 text-carvao-muted">
          <p>A partir de 2022, conferimos a capacidade contra eSF × 3.500 + eAP 20h × 1.750 + eAP 30h × 2.625 + cadastros vinculados a eCR, eSFR e eAPP. A cobertura é capacidade ÷ população de referência × 100, conforme a Nota Técnica nº 2/2025 da SAPS/MS. Essa conferência aritmética não comprova funcionamento dos serviços.</p>
          <p>As contagens são da resposta oficial do Relatório APS, sem estimar meses ausentes. A série de 2021 tem método anterior. O Distrito Federal exige tratamento separado por reunir competências estaduais e municipais.</p>
          <p><a href="https://relatorioaps.saude.gov.br/" className="text-obee-dark underline underline-offset-4">Abrir Relatório APS</a>{" · "}<a href="/eficiencia/series/saude_manifesto_das_capturas.json" className="text-obee-dark underline underline-offset-4">Manifesto das capturas</a></p>
          <p className="t-meta break-all">Versão {dados.versao}. SHA-256 da série mensal: {dados.hash_dados}.</p>
        </div>
      </details>
    </Recolhido>
  );
}
