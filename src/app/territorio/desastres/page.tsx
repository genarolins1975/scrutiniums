import type { Metadata } from "next";
import { GRUPOS, ROTULO_CURTO, lerDesastres, serieReconhecida } from "@/lib/territorio/desastres";
import { NOME_UF } from "@/lib/territorio/queimadas";
import { Figura, dataBr, n } from "@/components/territorio/Queimadas";
import { DoDesastreAoReconhecimento, SerieEmpilhada, TabelaDanos, TabelaSerie, TabelaUFDesastres } from "@/components/territorio/Desastres";
import { RotuloContexto } from "@/components/layout/RotuloContexto";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: tituloNaColecao("Desastres reconhecidos", "/territorio/desastres"),
  description: "Registros municipais de desastre com reconhecimento federal, de 2003 a 2025, por tipo e por estado, e os danos humanos registrados desde 2013, a partir do Atlas Digital de Desastres no Brasil.",
};

const FONTE = "Sedec/MIDR, Atlas Digital de Desastres no Brasil (base extraída do S2iD)";

/**
 * Painel de desastres do Observatório do Território e Clima: registros municipais com
 * reconhecimento federal de situação de emergência ou estado de calamidade, por tipo e
 * por estado, danos humanos desde 2013 com as ressalvas da própria base, o ano em curso
 * declarado como indisponível e o modelo didático do caminho até o reconhecimento.
 */
export default function PaginaDesastres() {
  const g = lerDesastres();
  const serie = serieReconhecida(g);
  const ultimo = serie[serie.length - 1];
  const corrente = g.por_uf.ano_corrente;
  const danos = g.danos_humanos.serie.find((d) => d.ano === ultimo.ano && d.publicavel);
  const grupoLider = [...GRUPOS].sort((a, b) => ultimo.por_grupo_reconhecidos[b] - ultimo.por_grupo_reconhecidos[a])[0];
  const ufs = Object.entries(g.por_uf.ultimo_ano_completo.ufs).sort((a, b) => b[1].registros_reconhecidos - a[1].registros_reconhecidos);
  const [ufLider, dadosUf] = ufs[0];
  const primeiro = serie[0];

  const numeros = [
    { rotulo: `Registros municipais com reconhecimento federal em ${ultimo.ano}`, valor: n(ultimo.registros_reconhecidos), unidade: "registros", periodo: `ocorrências de ${ultimo.ano}`, nota: "Um registro é um município atingido por um desastre reconhecido pela União; não é o número de desastres." },
    { rotulo: `Municípios com ao menos um reconhecimento em ${ultimo.ano}`, valor: n(ultimo.municipios_distintos_com_reconhecimento), unidade: "municípios", periodo: `${n((100 * ultimo.municipios_distintos_com_reconhecimento) / 5570, 0)}% dos 5.570 municípios`, nota: "Cada município conta uma vez, mesmo com vários reconhecimentos no ano." },
    { rotulo: `Tipo mais frequente em ${ultimo.ano}`, valor: ROTULO_CURTO[grupoLider], unidade: "", periodo: `${n(ultimo.por_grupo_reconhecidos[grupoLider])} registros, ${n((100 * ultimo.por_grupo_reconhecidos[grupoLider]) / ultimo.registros_reconhecidos, 0)}% do ano`, nota: "Tipologia oficial da Defesa Civil (COBRADE), agrupada pela plataforma." },
    danos && { rotulo: `Desalojados registrados em ${ultimo.ano}`, valor: n(danos.desalojados), unidade: "pessoas", periodo: `e ${n(danos.desabrigados)} desabrigados`, nota: "Soma dos formulários dos municípios; zero na base também pode ser campo não preenchido." },
  ].filter(Boolean) as { rotulo: string; valor: string; unidade: string; periodo: string; nota: string }[];

  return (
    <main className="bg-papel">
      <section aria-labelledby="desastres-titulo" className="border-b border-linha bg-marfim">
        <div className="mx-auto max-w-page px-6 pb-12 pt-10 md:pb-14 md:pt-14">
          <RotuloContexto rota="/territorio/desastres" className="mt-8 flex flex-wrap items-center gap-x-3 text-mineral" marca={<span aria-hidden="true" className="h-[3px] w-8 bg-obee" />} />
          <h1 id="desastres-titulo" className="mt-5 max-w-4xl font-serif text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.1] text-carvao [text-wrap:balance]">
            Onde os desastres atingem os municípios?
          </h1>
          <p className="mt-6 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">
            Secas, chuvas, deslizamentos e outros desastres que a União reconheceu em cada município, de {primeiro.ano} a {ultimo.ano}, por tipo e por
            estado, e os danos humanos que os municípios registraram.
          </p>
          <dl className="mt-10 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-4">
            {numeros.map((x) => (
              <div key={x.rotulo} className="flex flex-col bg-papel p-5">
                <dt className="text-sm leading-snug text-carvao-muted">{x.rotulo}</dt>
                <dd className="mt-2">
                  <span className={`font-label leading-none tabular-nums text-carvao ${x.valor.length > 12 ? "text-[1.35rem]" : "text-[2rem]"}`}>{x.valor}</span>{" "}
                  {x.unidade && <span className="text-sm text-carvao-muted">{x.unidade}</span>}
                </dd>
                <dd className="mt-2 text-xs leading-relaxed text-mineral">{x.periodo}</dd>
                <dd className="mt-3 border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">{x.nota}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 max-w-prose2 border-l-2 border-obee pl-3 text-sm leading-relaxed text-carvao">
            A contagem é de registros municipais que obtiveram reconhecimento federal. Uma mesma chuva em vários municípios gera vários
            registros, e um município que não pediu reconhecimento fica de fora mesmo tendo sofrido um desastre.
          </p>
          {!corrente.disponivel && (
            <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              {corrente.ano} ainda não está disponível: a base consolidada vai até {dataBr(g.fonte.cobertura_eventos.fim)}. Os reconhecimentos de {corrente.ano} estão no S2iD,
              que não aceita consultas de fora do Brasil; não são zero.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="serie-desastres" className="mx-auto max-w-page px-6 py-12 md:py-14">
        <h2 id="serie-desastres" className="sr-only">Como os reconhecimentos variaram</h2>
        <Figura
          id="serie-reconhecidos"
          titulo={`Os reconhecimentos de cada ano, de ${primeiro.ano} a ${ultimo.ano}`}
          subtitulo="Registros municipais com reconhecimento federal, Brasil, por ano da ocorrência e tipo de desastre."
          fonte={<>{FONTE}, versão capturada em {dataBr(g.capturadoEm)}. As regras de reconhecimento mudaram em 2012, 2016, 2020 e 2022: anos distantes medem também mudança de regra.</>}
          tabela={<TabelaSerie g={g} />}
        >
          <SerieEmpilhada g={g} />
        </Figura>
      </section>

      <section aria-labelledby="ufs-desastres" className="border-t border-linha">
        <div className="mx-auto max-w-page px-6 py-12 md:py-14">
          <h2 id="ufs-desastres" className="font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">Os estados em {g.por_uf.ultimo_ano_completo.ano}</h2>
          <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            {NOME_UF[ufLider] ?? ufLider} teve mais registros reconhecidos ({n(dadosUf.registros_reconhecidos)}, em {n(dadosUf.municipios_distintos)} municípios). Estados com
            mais municípios tendem a somar mais registros: a contagem não está dividida pelo número de municípios.
          </p>
          <div className="mt-6 overflow-x-auto"><TabelaUFDesastres g={g} /></div>
          <p className="mt-3 text-xs leading-relaxed text-mineral">{FONTE}. Registros com reconhecimento federal e municípios distintos por estado.</p>
        </div>
      </section>

      <section aria-labelledby="danos-desastres" className="border-t border-linha">
        <div className="mx-auto max-w-page px-6 py-12 md:py-14">
          <h2 id="danos-desastres" className="font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">As pessoas atingidas, desde 2013</h2>
          <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            Óbitos, desabrigados (sem abrigo próprio, em abrigo público) e desalojados (fora de casa, em casa de parentes ou amigos), somados de
            todos os registros do ano, reconhecidos ou não. Começa em 2013, primeiro ano inteiro com o formulário eletrônico do S2iD; antes disso a série
            não é comparável.
          </p>
          <div className="mt-6 overflow-x-auto"><TabelaDanos g={g} /></div>
          <ul className="mt-4 max-w-prose2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao-muted">
            <li>Na base, campo não preenchido aparece como zero: a última coluna mostra quantos registros não têm nenhum dano humano informado.</li>
            <li>Os danos são os do momento do registro e não são atualizados depois: um desaparecido que morre não vira óbito na base.</li>
            <li>&ldquo;Afetados&rdquo; não é publicado: o total da base não fecha com a soma das categorias em cerca de um quarto dos registros.</li>
          </ul>
        </div>
      </section>

      <DoDesastreAoReconhecimento />

      <section aria-labelledby="metodo-desastres" className="mx-auto max-w-page px-6 py-12">
        <details className="border-t border-linha pt-4">
          <summary id="metodo-desastres" className="rotulo flex min-h-[44px] cursor-pointer items-center text-carvao-muted hover:text-carvao">Método, fontes e ressalvas</summary>
          <div className="mt-3 max-w-prose2 space-y-3 text-sm leading-relaxed text-carvao-muted">
            <p>
              Fonte: {g.fonte.nome} (<a href={g.fonte.pagina} className="underline decoration-linha underline-offset-4">página de downloads</a>,{" "}
              <a href={g.fonte.manual} className="underline decoration-linha underline-offset-4">manual</a>). {g.fonte.licenca} {g.fonte.cadencia}
            </p>
            <p>Unidade: {g.unidade} {g.ano_de_referencia}</p>
            <p>Grupos de tipologia: {GRUPOS.map((gr) => g.grupos[gr]).join("; ")}.</p>
            <ul className="list-disc space-y-2 pl-5">{g.ressalvas.map((r) => <li key={r}>{r}</li>)}</ul>
            {g.bloqueios.length > 0 && (
              <p>
                Fonte primária dos reconhecimentos, não acessada nesta captura: {g.bloqueios.map((b) => b.url).join(", ")} (bloqueio de acesso por localização).
                Por isso não há ano corrente, número de portaria nem separação entre situação de emergência e estado de calamidade.
              </p>
            )}
            <p>
              Captura em {dataBr(g.capturadoEm)}; último registro na base em {dataBr(g.fonte.ultimo_registro_na_base)}. Cada arquivo original tem sha256 e tamanho
              registrados. Conferência em 18/10/2026: registros por grupo, óbitos e desabrigados mais desalojados por ano batem com o painel oficial do Atlas.
            </p>
            <p>
              <a href="/territorio/gold/desastres.json" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Baixar os dados deste painel (JSON)</a>
            </p>
          </div>
        </details>
      </section>
    </main>
  );
}
