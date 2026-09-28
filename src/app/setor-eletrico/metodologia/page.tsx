import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { NATUREZAS, SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold } from "@/lib/energia/gold";
import { carimbo } from "@/lib/energia/formato";
import type { Natureza } from "@/lib/energia/tipos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Metodologia do Observatório do Setor Elétrico",
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

function Regras({ titulo, regras }: { titulo: string; regras?: Record<string, string> }) {
  if (!regras) return null;
  return (
    <div className="border border-linha bg-superficie p-5">
      <h3 className="font-medium text-carvao">{titulo}</h3>
      <dl className="mt-3 space-y-3">
        {Object.entries(regras).map(([k, v]) => (
          <div key={k}>
            <dt className="rotulo text-mineral">{k.replaceAll("_", " ")}</dt>
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
      <CabecalhoEnergia atual="dados" />
      <MarcaVisita secao="energia:metodologia" />
      <main className="mx-auto max-w-page px-6 pb-16">
        <CabecalhoModulo rotulo="Metodologia" titulo="Como os números deste observatório são produzidos, e o que eles não dizem">
          Esta página descreve o caminho de cada número: da fonte primária à tela, com as regras que produzem cada classificação.
          Documentação técnica completa em <code className="font-mono text-sm">docs/observatorios/</code> no repositório.
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

        <S id="editorial" titulo="Regra editorial">
          <p>Toda visualização relevante responde, nesta ordem: o que estou vendo, por que importa, o que mudou, como interpretar, o que não é possível concluir e qual é a fonte. A regra é obrigatória no componente de painel: um painel sem esses campos não é construído.</p>
        </S>

        <S id="linhagem" titulo="Linhagem e vintages">
          <pre className="overflow-x-auto border border-linha bg-superficie p-4 font-mono text-xs leading-relaxed text-carvao">{`FONTE (CCEE, ONS, ANEEL)
  ↓ captura: arquivo original, sha256, url, capturado_em, publicado_em (metadado da fonte)
BRONZE: cópia imutável por captura
  ↓ normalização determinística
SILVER: observações por vintage (append only)
  ↓ regras publicadas
GOLD: indicadores com proveniência (public/energia/gold)
  ↓
INDICADOR → VISUALIZAÇÃO | MODELO

Previsões: VINTAGE DA FONTE → FEATURES → VERSÃO DO MODELO → PUBLICAÇÃO → REALIZADO → APURAÇÃO`}</pre>
          <p>
            Cada observação guarda a vintage de onde veio. Uma revisão da fonte (o ONS declara que seus dados passam por consistência recorrente) cria uma vintage
            nova sem apagar a anterior. A consulta &quot;como estava em&quot; devolve o valor conhecido em qualquer instante, e é a única que features de modelo e
            backtests podem usar: nenhuma previsão usa dado capturado depois do seu corte.
          </p>
          <p className="text-sm text-carvao-muted">
            Datas distinguidas: período de referência; publicação pela fonte (quando informada); captura pela Scrutiniums; corte da previsão; emissão.
          </p>
        </S>

        <S id="classificacao" titulo="Regras de classificação publicadas">
          <p>Nenhuma classificação (&quot;baixo&quot;, &quot;alto&quot;, &quot;fora da faixa usual&quot;) existe sem regra estatística declarada. As regras em vigor, lidas da própria gold:</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Regras titulo="PLD" regras={gold.pld()?.regras} />
            <Regras titulo="Hidrologia" regras={gold.hidrologia()?.regras} />
            <Regras titulo="Carga" regras={gold.carga()?.regras} />
            <Regras titulo="Geração" regras={gold.geracao()?.regras} />
            <Regras titulo="Rede" regras={gold.rede()?.regras} />
          </div>
        </S>

        <S id="sintese" titulo="Frases e alertas da Visão geral">
          <p>A síntese &quot;o sistema em 60 segundos&quot; e a lista &quot;o que observar&quot; são montadas por regras fixas a partir da gold; nenhum texto é redigido livremente. Cada frase tem sua regra; cada alerta, sua condição.</p>
          {sintese && (
            <ul className="space-y-2 text-sm">
              {sintese.frases.map((f) => (
                <li key={f.id} className="border border-linha bg-superficie p-3"><strong className="font-medium">{f.id}:</strong> {f.regra}</li>
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
            <li>O portal de dados abertos da CCEE respondeu HTTP 403 ao ambiente de construção em 28/09/2026. O PLD vem das capturas primárias de 27/09/2026 versionadas com sha256; a coleta direta é tentada a cada execução e a falha é registrada.</li>
            <li>Os limites regulatórios do PLD (mínimo, máximo horário e estrutural) não foram auditados; o &quot;menor valor observado no ano&quot; é descritivo e nunca é chamado de piso.</li>
            <li>Limites de intercâmbio, CVU por usina, geração por usina e por motivo de despacho estão catalogados e ainda não integrados.</li>
            <li>Definições de conceitos cujas fontes primárias (CCEE, legislação) não foram acessadas aparecem como verbetes em preparação.</li>
            <li>Valores monetários em R$ nominais.</li>
          </ul>
        </S>

        <S id="versao" titulo="Versão desta publicação">
          {meta ? (
            <p className="text-sm">
              Gold processada em {carimbo(meta.gerado_em)} · pipeline {meta.versao_pipeline}
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
