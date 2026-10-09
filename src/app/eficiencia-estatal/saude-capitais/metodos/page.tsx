import type { Metadata } from "next";
import { statSync } from "node:fs";
import { join } from "node:path";
import { CatalogoIndicadores, ListaValidacoes, MatrizDeFontes } from "@/components/eficiencia/saude/CatalogoSaude";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { contextosSaude } from "@/lib/eficiencia/saude/contexto";
import { ARQUIVO_GOLD_SAUDE, goldSaude } from "@/lib/eficiencia/saude/dados";
import { dataBr, decimal, rotuloVersaoCatalogo } from "@/lib/eficiencia/formato";
import { SIGLAS } from "@/components/eficiencia/Siglas";
import { REPOSITORIO } from "@/lib/energia/datasets";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Dados e métodos de Saúde nas capitais",
  description: "Catálogo de indicadores, decisões sobre cada fonte, validações, reprodução passo a passo e arquivos para download do módulo Saúde nas capitais.",
  alternates: { canonical: "/eficiencia-estatal/saude-capitais/metodos" },
};

function tamanho(caminho: string): string {
  try {
    return `${decimal(statSync(join(process.cwd(), "public", caminho)).size / 1_000_000, 1)} MB`;
  } catch {
    return "tamanho não verificado";
  }
}

const Secao = ({ id, titulo, intro, children }: { id: string; titulo: string; intro?: string; children: React.ReactNode }) => (
  <section id={id} tabIndex={-1} aria-labelledby={`${id}-t`} className="scroll-mt-24 border-t border-linha pt-8 focus:outline-none">
    <h2 id={`${id}-t`} className="font-serif text-[1.6rem] leading-snug text-obee-tinta">{titulo}</h2>
    {intro && <p className="mt-1 max-w-prose2 text-[0.9375rem] leading-relaxed text-carvao-muted">{intro}</p>}
    <div className="mt-5">{children}</div>
  </section>
);

export default function PaginaMetodos() {
  const g = goldSaude();
  if (!g) {
    return <Indisponivel titulo="Módulo indisponível" motivo="A base do módulo não foi encontrada nesta publicação. Nenhum número é exibido no lugar." faltante={["public/eficiencia/gold/saude_capitais.json"]} />;
  }
  const ctx = contextosSaude(g);
  const fichas = g.indicadores;
  const publicados = fichas.filter((f) => f.estado !== "NAO_PUBLICAVEL");
  const datas = g.fontes.map((f) => ({ id: f.id, papel: f.papel, ultima: f.capturas.map((c) => c.capturado_em ?? "").sort().slice(-1)[0], paginas: f.capturas.map((c) => ({ chave: c.chave, pagina: c.pagina, periodo: c.parametros ?? "" })) }));
  return (
    <div>
      <section aria-labelledby="titulo-metodos">
        <p className="rotulo text-mineral">Saúde nas capitais</p>
        <h1 id="titulo-metodos" className="mt-2 font-serif text-[2.1rem] leading-[1.08] tracking-tight text-obee-tinta md:text-[2.6rem]">Dados e métodos</h1>
        <p className="mt-3 max-w-prose2 text-[1.0625rem] leading-snug text-obee-tinta">De onde vem cada medida, como reproduzir o cálculo e o que foi avaliado e não publicado.</p>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-[0.9375rem]">
          {[["#perimetros", "Três perímetros"], ["#referencias", "Referências"], ["#siglas", "Siglas"], ["#indicadores", "Indicadores"], ["#decisoes-fontes", "Decisões sobre as fontes"], ["#validacoes", "Validações"], ["#reproducao", "Reprodução"], ["#arquivos", "Arquivos"], ["#atualidade", "Atualidade e versões"]].map(([h, t]) => (
            <li key={h}><a href={h} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">{t}</a></li>
          ))}
        </ul>
        <dl className="mt-6 grid max-w-[64rem] gap-x-10 gap-y-3 text-sm leading-snug sm:grid-cols-2">
          <div><dt className="font-semibold text-obee-tinta">Quero entender o que um número significa</dt><dd className="text-carvao-muted">Três perímetros, Referências e Siglas, abaixo. Em cada medida, o botão Sobre este dado abre a ficha.</dd></div>
          <div><dt className="font-semibold text-obee-tinta">Sou jornalista e preciso citar</dt><dd className="text-carvao-muted">Arquivos: CSV com fonte, endereço, data de captura, versão e hash. Cite a data de geração e o hash da linha.</dd></div>
          <div><dt className="font-semibold text-obee-tinta">Sou gestor e quero saber por que uma capital ficou fora</dt><dd className="text-carvao-muted">Decisões sobre as fontes e Validações; em cada página, o aviso de capitais fora da comparação traz o motivo.</dd></div>
          <div><dt className="font-semibold text-obee-tinta">Sou pesquisador e quero reproduzir</dt><dd className="text-carvao-muted">Reprodução: exemplos passo a passo, comando e arquivos do repositório; Atualidade e versões traz as capturas.</dd></div>
        </dl>
      </section>

      <div className="mt-8 space-y-12">
        <Secao id="perimetros" titulo="Três perímetros que não se confundem" intro="O módulo separa o que o município executa, o que está localizado no território e quem reside nele. Cada medida diz a qual deles pertence.">
          <div className="grid max-w-[64rem] gap-x-10 gap-y-5 text-sm leading-relaxed text-obee-tinta md:grid-cols-3">
            <div><h3 className="font-semibold">Recursos executados pelo município</h3><p className="mt-1">Despesa liquidada na função Saúde (DCA), percentual aplicado em ASPS e despesa por fonte (SIOPS). Não é o gasto de União e estado no território.</p></div>
            <div><h3 className="font-semibold">Serviços localizados no território</h3><p className="mt-1">UBS do CNES, equipes e cobertura potencial do Relatório APS. Gestão municipal, propriedade pública municipal, estabelecimento contratado e estabelecimento situado no município são conceitos distintos. Cadastro não comprova funcionamento nem acesso.</p></div>
            <div><h3 className="font-semibold">População residente</h3><p className="mt-1">Denominadores (IBGE) e internações por município de residência (RIPSA). Resultado descreve o sistema de saúde que atende os moradores, não a produção da prefeitura, e não é efeito exclusivo da gestão municipal.</p></div>
          </div>
          <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">O módulo não atribui nota às capitais, não classifica a gestão, não usa semáforo, fronteira estatística (DEA ou SFA), estimativa de perda nem recomendação de corte. Ordenar por valor é recurso de leitura.</p>
          {g.universo.excluidos.map((e) => (
            <p key={e.cod_ibge} className="mt-3 max-w-prose2 text-sm leading-relaxed text-obee-tinta"><span className="font-semibold">Fora do recorte: {e.nome}.</span> {e.motivo}</p>
          ))}
        </Secao>

        <Secao id="referencias" titulo="Como as referências são calculadas" intro="As referências descrevem o grupo de capitais; não são meta, padrão nem classificação.">
          <dl className="grid max-w-[64rem] gap-x-10 gap-y-3 text-sm leading-relaxed text-obee-tinta md:grid-cols-2">
            <div><dt className="font-semibold">Quem entra</dt><dd className="text-carvao-muted">{g.politica_referencias.elegibilidade}</dd></div>
            <div><dt className="font-semibold">Mediana</dt><dd className="text-carvao-muted">{g.politica_referencias.mediana}</dd></div>
            <div><dt className="font-semibold">Média simples</dt><dd className="text-carvao-muted">{g.politica_referencias.media}</dd></div>
            <div><dt className="font-semibold">Razão agregada</dt><dd className="text-carvao-muted">{g.politica_referencias.razao_agregada} Na unidade do indicador: por 10 mil habitantes, por 100 mil habitantes ou em %.</dd></div>
            <div><dt className="font-semibold">Metade central</dt><dd className="text-carvao-muted">{g.politica_referencias.quartis} {g.politica_referencias.limiar_quartis_nota}</dd></div>
            <div><dt className="font-semibold">Empates</dt><dd className="text-carvao-muted">{g.politica_referencias.empates}</dd></div>
            <div><dt className="font-semibold">Referência nacional</dt><dd className="text-carvao-muted">{g.politica_referencias.nacional} Só aparece quando o conceito, o perímetro e o período são os mesmos; senão fica como contexto separado.</dd></div>
            <div><dt className="font-semibold">Mínimo legal</dt><dd className="text-carvao-muted">15% da receita de impostos e transferências em ASPS (LC 141/2012, art. 7º): referência normativa, não meta.</dd></div>
          </dl>
        </Secao>

        <Secao id="siglas" titulo="Siglas" intro="Todas as siglas usadas nas páginas do módulo, por extenso.">
          <dl className="grid max-w-[64rem] gap-x-10 gap-y-1.5 text-sm leading-snug md:grid-cols-2">
            {Object.entries(SIGLAS).filter(([s]) => ["DCA", "RREO", "MSC", "IPCA", "SUS", "SIOPS", "CNES", "APS", "ASPS", "ICSAP", "RIPSA", "SIH", "AIH", "ANS", "UBS", "eSF", "eAP", "Siconfi", "SIDRA", "DOU"].includes(s)).map(([s, t]) => (
              <div key={s} className="flex gap-2"><dt className="w-14 shrink-0 font-semibold text-obee-tinta">{s}</dt><dd className="text-carvao-muted">{t}</dd></div>
            ))}
          </dl>
        </Secao>

        <Secao id="indicadores" titulo={`Catálogo de indicadores (${publicados.length} publicados, ${fichas.length - publicados.length} avaliados e não publicados)`} intro="Cada indicador tem ficha com definição, fórmula, fonte, período, perímetro, ausências, comparação, ressalvas e validações. Abra a ficha para ver os 16 campos.">
          <CatalogoIndicadores fichas={fichas} contextos={ctx} />
        </Secao>

        <Secao id="decisoes-fontes" titulo="Decisões sobre as fontes" intro="Para cada medida candidata: a fonte, o que foi testado, a cobertura das 26 capitais e a decisão (publicar com ressalva, apenas contexto ou não publicar), com o fundamento. A existência de um portal não prova que a série seja extraível e comparável.">
          <MatrizDeFontes linhas={g.matriz_fontes} />
        </Secao>

        <Secao id="validacoes" titulo="Validações" intro="Rodam em toda reconstrução. Uma validação reprovada impede a publicação da nova versão e mantém a última válida. Medições quantificam fatos que sustentam decisões e não aprovam nem reprovam.">
          <ListaValidacoes validacoes={g.validacoes} />
        </Secao>

        <Secao id="reproducao" titulo="Reprodução" intro="Qualquer número pode ser refeito a partir dos arquivos preservados no repositório, sem consulta ao portal da fonte.">
          <ol className="max-w-prose2 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-obee-tinta">
            <li>Baixe o CSV do indicador (seção Arquivos): cada linha traz valor, estado, nota, fonte, registro de origem, numerador e denominador, versão metodológica e o hash dos dados.</li>
            <li>Encontre a fonte e a data de captura no manifesto das capturas. Cada captura registra a URL, a data e o sha256 do arquivo original ou da resposta integral.</li>
            <li>Refaça o cálculo com a fórmula da ficha: o numerador e o denominador estão no CSV, e a população e o IPCA são os mesmos do painel de Educação nas capitais.</li>
            <li>Para reconstruir tudo sem rede, no <a href={REPOSITORIO} target="_blank" rel="noopener noreferrer" className="text-obee-dark underline underline-offset-4">repositório do Scrutiniums</a> (código em <code className="font-mono text-[0.8rem]">pipeline/eficiencia_saude</code>, recortes das fontes em <code className="font-mono text-[0.8rem]">pipeline/eficiencia_saude/seed</code>): <code className="font-mono text-[0.8rem]">python3 -m pipeline.eficiencia_saude.run</code>. A reconstrução imprime as validações e termina com erro se alguma for reprovada.</li>
            <li>Conferências de integridade: o sha256 do manifesto vale para o conteúdo descomprimido de cada recorte (o hash do arquivo compactado difere). O <code className="font-mono text-[0.8rem]">hash_dados</code> é o sha256 do JSON das observações, com chaves ordenadas, separadores compactos, caracteres acentuados mantidos (sem escape ASCII) e codificação UTF-8; reconstruir com o mesmo seed e o mesmo código reproduz o mesmo hash.</li>
          </ol>
          <details className="mt-4 max-w-prose2">
            <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Exemplos de reconstrução passo a passo (dado técnico)</summary>
            <ul className="mt-2 space-y-3 text-sm leading-snug text-obee-tinta">
              {g.trilhas.map((t) => (
                <li key={t.indicador}>
                  <p className="font-mono text-[0.8rem] text-carvao-muted">{t.indicador} · {t.nome} · {t.ano}</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-5">{t.passos.map((p, i) => <li key={i}>{p}</li>)}</ol>
                </li>
              ))}
            </ul>
          </details>
        </Secao>

        <Secao id="arquivos" titulo="Arquivos para download" intro="Séries completas, com estado, nota e registro de cada valor. Célula vazia não é zero. O arquivo JSON traz todas as observações do módulo.">
          <ul className="grid gap-x-8 gap-y-1 text-[0.9375rem] sm:grid-cols-2">
            {publicados.filter((f) => f.download).map((f) => (
              <li key={f.id}><a href={f.download!} download className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">{f.nome_curto}<span className="sr-only"> (CSV)</span></a></li>
            ))}
            <li><a href="/eficiencia/series/saude_referencias_capitais.csv" download className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Referências do grupo de capitais (CSV)</a></li>
            <li><a href="/eficiencia/series/saude_matriz_de_fontes.csv" download className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Decisões sobre as fontes (CSV)</a></li>
            <li><a href="/eficiencia/series/saude_dicionario_das_colunas.csv" download className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Dicionário das colunas (CSV)</a></li>
            <li><a href="/eficiencia/series/saude_manifesto_das_capturas.json" download className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Manifesto das capturas (JSON)</a></li>
            <li><a href={ARQUIVO_GOLD_SAUDE} download className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Todas as observações do módulo (JSON, {tamanho(ARQUIVO_GOLD_SAUDE)})</a></li>
          </ul>
        </Secao>

        <Secao id="atualidade" titulo="Atualidade e versões" intro="As fontes têm datas de referência diferentes: não há um único momento de atualização.">
          <p className="max-w-prose2 text-sm leading-relaxed text-obee-tinta">
            Versão do catálogo: {rotuloVersaoCatalogo(g.meta.versao_catalogo)}. Dados gerados em {dataBr(g.meta.gerado_em)}; última captura em {dataBr(g.meta.dados_capturados_ate)}. Hash dos dados: <code className="break-all font-mono text-[0.75rem]">{g.meta.hash_dados.slice(0, 16)}</code>.
          </p>
          <ul className="mt-4 divide-y divide-linha border-y border-linha text-sm">
            {datas.map((d) => (
              <li key={d.id} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_8rem]">
                <span className="font-mono text-[0.8rem] text-carvao-muted">{d.id}</span>
                <span className="leading-snug text-obee-tinta">{d.papel}</span>
                <span className="tabular-nums text-carvao-muted">captura em {dataBr(d.ultima)}</span>
              </li>
            ))}
          </ul>
        </Secao>
      </div>
    </div>
  );
}
