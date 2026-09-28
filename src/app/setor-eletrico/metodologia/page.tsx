import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { NATUREZAS, SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { LISTA_UNIDADES } from "@/components/evidencia/Unidade";
import { LinhagemDados } from "@/components/energia/LinhagemDados";
import { etapasLinhagem } from "@/lib/energia/linhagem";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold } from "@/lib/energia/gold";
import { carimbo, rotuloRegra } from "@/lib/energia/formato";
import type { Natureza } from "@/lib/energia/tipos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Metodologia: como os números são produzidos, e o que eles não dizem",
  description:
    "Taxonomia de natureza do dado, regra editorial, linhagem das séries, vintages sem look-ahead, regras de classificação publicadas, governança de previsão e limitações do Observatório Brasileiro do Setor Elétrico.",
  alternates: { canonical: "/setor-eletrico/metodologia" },
};

function S({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-linha py-10">
      <h2 id={`${id}-h`} className="font-serif text-2xl text-carvao">{titulo}</h2>
      <div className="mt-4 max-w-4xl space-y-4 leading-relaxed text-carvao">{children}</div>
    </section>
  );
}

const ROTULO_FRASE: Record<string, string> = {
  reservatorios: "Reservatórios",
  afluencias: "Afluências",
  carga: "Carga",
  termica: "Participação térmica",
  pld: "PLD",
  preco: "PLD",
  descolamento: "Diferença entre submercados",
};

function Regras({ titulo, regras }: { titulo: string; regras?: Record<string, string> }) {
  if (!regras) return null;
  return (
    <div className="border border-linha bg-superficie p-5">
      <h3 className="font-medium text-carvao">{titulo}</h3>
      <dl className="mt-3 space-y-3">
        {Object.entries(regras).map(([k, v]) => (
          <div key={k}>
            <dt className="rotulo text-mineral">{rotuloRegra(k)}</dt>
            <dd className="mt-0.5 text-sm text-carvao">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function MetodologiaEnergia() {
  const meta = gold.meta();
  const sintese = gold.sintese();
  return (
    <>
      <CabecalhoEnergia atual="metodologia" />
      <MarcaVisita secao="energia:metodologia" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <CabecalhoModulo rotulo="Metodologia" titulo="Como os números deste observatório são produzidos, e o que eles não dizem">
          Esta página descreve o caminho de cada número: da fonte primária à tela, com as regras que produzem cada classificação.
          A documentação técnica completa (arquitetura, catálogo de fontes, auditabilidade e governança de previsão) está no{" "}
          <a href="https://github.com/genarolins1975/scrutiniums/tree/main/docs/observatorios" target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
            repositório público do projeto ↗
          </a>, junto com o código que produz cada número.
        </CabecalhoModulo>

        <S id="natureza" titulo="Taxonomia de natureza do dado">
          <p>Todo número exibido carrega um selo. As categorias nunca se confundem, e a forma do selo muda com a categoria, não só a cor.</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {(Object.keys(NATUREZAS) as Natureza[]).map((n) => (
              <li key={n} className="flex items-start gap-3 border border-linha bg-superficie p-4">
                <SeloNatureza natureza={n} />
                <span className="text-sm text-carvao-muted">{NATUREZAS[n].definicao}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-carvao-muted">
            O CMO semanal é publicado pelo ONS como saída do modelo DECOMP: para a plataforma é OBSERVADO (valor oficial), com a nota de que é resultado
            de modelo da fonte. Médias diárias do PLD e participações por fonte são CALCULADAS pela Scrutiniums a partir de valores observados.
          </p>
        </S>

        <S id="unidades" titulo="Unidades">
          <p>Convenções de medida usadas neste observatório, com a unidade em que cada fonte publica:</p>
          <dl className="grid gap-3 md:grid-cols-3">
            {LISTA_UNIDADES.map((x) => (
              <div key={x.u} className="border border-linha bg-superficie p-4">
                <dt className="font-medium text-carvao">{x.u} · {x.nome}</dt>
                <dd className="mt-1 text-sm text-carvao-muted">{x.dica}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-carvao-muted">
            Preços em reais por megawatt-hora (R$/MWh), sempre nominais: sem correção pela inflação. A descrição do conjunto de PLD na CCEE registra a
            unidade apenas como R$; a do CMO semanal, no dicionário do ONS, como R$/MW.
          </p>
        </S>

        <S id="editorial" titulo="Regra editorial">
          <p>Toda visualização relevante responde, nesta ordem: o que estou vendo, por que importa, o que mudou, como interpretar, o que não é possível concluir e qual é a fonte. A regra é obrigatória no componente de painel: um painel sem esses campos não é construído.</p>
        </S>

        <S id="linhagem" titulo="Linhagem e vintages">
          <p>
            O processamento tem três camadas, com nomes usuais em engenharia de dados: bronze guarda o arquivo original de cada captura, silver guarda o
            histórico de observações por captura (vintage) e gold reúne os dados processados que as páginas publicam.
          </p>
          <div className="border border-linha bg-superficie p-4 md:p-5">
            <LinhagemDados etapas={etapasLinhagem()} />
          </div>
          <details className="text-sm">
            <summary className="rotulo min-h-[44px] cursor-pointer text-carvao-muted">Ver a linhagem em texto</summary>
          <pre tabIndex={0} aria-label="Linhagem dos dados, do arquivo da fonte à visualização (rolável)" className="overflow-x-auto border border-linha bg-superficie p-4 font-mono text-xs leading-relaxed text-carvao">{`FONTE (CCEE, ONS, ANEEL)
  ↓ captura: arquivo original, sha256, url, capturado_em, publicado_em (metadado da fonte)
BRONZE: cópia imutável por captura
  ↓ normalização determinística
SILVER (histórico): observações por vintage; só acrescenta, nunca apaga
  ↓ regras publicadas
GOLD (dados processados): indicadores com proveniência, publicados em /energia/gold
  ↓
INDICADOR → VISUALIZAÇÃO | MODELO

Previsões: VINTAGE DA FONTE → VARIÁVEIS DE ENTRADA → VERSÃO DO MODELO → PUBLICAÇÃO → REALIZADO → APURAÇÃO`}</pre>
          </details>
          <p>
            Cada observação guarda a vintage de onde veio. Uma revisão da fonte (o ONS declara que seus dados passam por consistência recorrente) cria uma vintage
            nova sem apagar a anterior. A consulta &quot;como estava em&quot; devolve o valor conhecido em qualquer instante (com fuso explícito, sem
            ambiguidade de data) e é a que as variáveis de entrada de modelos em produção e os testes retrospectivos por vintage devem usar. O backtest da pesquisa atual foi feito
            sobre um snapshot único, em pseudo tempo real; a limitação está declarada em cada cartão de modelo.
          </p>
          <p className="text-sm text-carvao-muted">
            Datas distinguidas: período de referência; publicação pela fonte (quando informada); captura pela Scrutiniums; corte da previsão; emissão.
          </p>
        </S>

        <S id="classificacao" titulo="Regras de classificação publicadas">
          <p>Nenhuma classificação (&quot;baixo&quot;, &quot;alto&quot;, &quot;fora da faixa usual&quot;) existe sem regra estatística declarada. As regras em vigor, lidas dos próprios dados publicados:</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Regras titulo="PLD" regras={gold.pld()?.regras} />
            <Regras titulo="Hidrologia" regras={gold.hidrologia()?.regras} />
            <Regras titulo="Carga" regras={gold.carga()?.regras} />
            <Regras titulo="Geração" regras={gold.geracao()?.regras} />
            <Regras titulo="Rede" regras={gold.rede()?.regras} />
          </div>
        </S>

        <S id="sintese" titulo="Frases e alertas da Visão geral">
          <p>A síntese &quot;o sistema em 60 segundos&quot; e a lista &quot;o que observar&quot; são montadas por regras fixas a partir dos dados processados; nenhum texto é redigido livremente. Cada frase tem sua regra; cada alerta, sua condição.</p>
          {sintese && (
            <ul className="space-y-2 text-sm">
              {sintese.frases.map((f) => (
                <li key={f.id} className="border border-linha bg-superficie p-3"><strong className="font-medium">{ROTULO_FRASE[f.id] ?? f.id}:</strong> {f.regra}</li>
              ))}
              {sintese.observar.map((o) => (
                <li key={o.id} className="border border-linha bg-superficie p-3"><strong className="font-medium">{o.titulo}:</strong> {o.condicao}</li>
              ))}
            </ul>
          )}
        </S>

        <S id="previsao" titulo="Governança de previsão">
          <p>
            Modelos têm estado explícito: PESQUISA, VALIDAÇÃO, PRODUÇÃO ou APOSENTADO. Só modelo em PRODUÇÃO alimenta a previsão principal. Cada previsão
            registrada ganha um identificador e um sha256 do conteúdo; correção cria novo registro que aponta para o original, com motivo. Faixas de
            incerteza só são chamadas de &quot;80%&quot; quando a cobertura medida fora do ajuste sustenta isso.
          </p>
          <p>
            Veja o <Link href="/setor-eletrico/pld/modelos" className="text-energia-dark underline underline-offset-4">registro de modelos</Link> e o{" "}
            <Link href="/setor-eletrico/pld/previsoes" className="text-energia-dark underline underline-offset-4">histórico de previsões</Link>.
          </p>
        </S>

        <S id="limitacoes" titulo="Limitações gerais desta fase">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              O portal de dados abertos da CCEE negou acesso a requisições automatizadas em tentativas manuais na manhã de 28/09/2026, não registradas no log de coletas, e aceitou a coleta automática mais tarde no mesmo dia; o
              histórico de 2021 a 2025 vem das capturas primárias de 27/09/2026, versionadas com sha256. A coleta direta é tentada em cada execução agendada da atualização.{" "}
              {meta?.fontes?.ccee_pld_horario?.ultima_tentativa
                ? `Última tentativa: ${carimbo(meta.fontes.ccee_pld_horario.ultima_tentativa.tentado_em)}, ${meta.fontes.ccee_pld_horario.ultima_tentativa.ok ? "bem-sucedida" : "sem sucesso"}.`
                : "Nenhuma tentativa registrada nesta publicação."}
            </li>
            <li>Os limites regulatórios do PLD (mínimo, máximo horário e estrutural) não foram auditados; o &quot;menor valor observado no ano&quot; é descritivo e nunca é chamado de piso.</li>
            <li>Limites de intercâmbio, CVU por usina, geração por usina e por motivo de despacho estão catalogados e ainda não integrados.</li>
            <li>Definições de conceitos cujas fontes primárias (CCEE, legislação) não foram acessadas aparecem como verbetes em preparação.</li>
            <li>Valores monetários em R$ nominais.</li>
            <li>O histórico de vintages persiste no cache da automação (GitHub Actions). O silver (banco com vintages e observações) tem cópia durável numa release do repositório; os arquivos brutos do bronze não têm, mas o sha256 de cada um fica registrado no silver. Se cache e cópia se perderem, a automação abre um alerta, os dados publicados continuam corretos e só o registro de revisões anteriores se perde.</li>
              <li>Quando a fonte remove uma referência de um arquivo, a remoção não é registrada: a série continua com o último valor publicado para ela. Revisões de valor são registradas.</li>
          </ul>
        </S>

        <S id="versao" titulo="Versão desta publicação">
          {meta ? (
            <p className="text-sm">
              Dados processados em {carimbo(meta.gerado_em)} · versão do processamento {meta.versao_pipeline}
              {meta.versao_codigo ? ` · código ${meta.versao_codigo}` : ""} · coleta executada nesta publicação: {meta.coleta_executada ? "sim" : "não (reconstrução a partir do estado salvo)"} ·
              falhas de construção: {meta.builders_falhos.length} · regressões retidas: {meta.regressoes.length}.
            </p>
          ) : (
            <p className="text-sm text-mineral">Metadados da publicação indisponíveis.</p>
          )}
        </S>
      </main>
    </>
  );
}
