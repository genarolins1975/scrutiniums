import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle } from "@/components/ui/SectionHeading";
import { SeloFrescor } from "@/components/dados/SeloFrescor";
import { geradoEmPublicado } from "@/lib/dadosPublicos";
import { BASE_API, CONTRATO, catalogoGold, tamanho } from "@/lib/apiPublica";
import { INSTITUCIONAL, preenchido } from "@/lib/institucional";
import { URL_FEED_ALERTAS } from "@/lib/feedResumo";

/**
 * Documentação da API pública de leitura. Nenhum backend: os arquivos são os
 * mesmos que a SPA do crédito consome, servidos como estáticos pela Vercel.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "API de leitura do crédito",
  description:
    "Os dados da coleção Crédito e sistema financeiro em JSON, para quem está conectado com a conta gratuita: catálogo de arquivos, esquema, cadência de publicação, licença e política de versão e de quebra.",
  alternates: { canonical: "/dados/api" },
};

const code = "rounded-sm bg-marfim px-1 font-mono text-[0.85em] text-carvao";

export default function ApiPage() {
  const itens = catalogoGold();
  const aviso = INSTITUCIONAL.api.aviso_previo_quebra_dias;
  const licenca = INSTITUCIONAL.dados.licenca_derivados;
  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <PublicHeaderView />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <PageTitle
          label="Dados abertos"
          title="API de leitura"
          description="Os mesmos arquivos JSON que alimentam o Observatório do crédito, disponíveis para quem está conectado com a conta gratuita, na mesma sessão do navegador."
        />
        <SeloFrescor geradoEm={geradoEmPublicado()} className="mt-6" />

        <div className="mt-10 max-w-prose2 space-y-10 text-carvao-muted">
          <section aria-labelledby="api-acesso">
            <h2 id="api-acesso" className="font-serif text-2xl text-carvao">Acesso</h2>
            <p className="mt-3">
              Base: <code className={code}>{BASE_API}</code>. Cada arquivo é um GET simples, servido a quem tem sessão
              ativa na plataforma: a leitura acontece no próprio navegador conectado à conta gratuita, sem chave adicional.
              Respostas podem ter até uma hora de cache. Não há backend nem consulta parametrizada: filtre do seu lado.
            </p>
            <p className="mt-3">
              Exemplo: abra <code className={code}>{BASE_API}meta.json</code> com a sessão iniciada. O feed RSS da central de
              alertas segue a mesma regra: <a href={URL_FEED_ALERTAS} className="text-bronze underline underline-offset-4">{URL_FEED_ALERTAS}</a>.
            </p>
          </section>

          <section aria-labelledby="api-cadencia">
            <h2 id="api-cadencia" className="font-serif text-2xl text-carvao">Cadência</h2>
            <p className="mt-3">
              O pipeline coleta as fontes todos os dias e republica o conjunto inteiro só quando a nova versão passa nos testes
              de conteúdo; reprovada, a versão anterior segue no ar. O instante da última publicação está em{" "}
              <code className={code}>meta.json</code> → <code className={code}>gerado_em</code>, e a data-base de cada fonte em{" "}
              <code className={code}>meta.json</code> → <code className={code}>vintages</code>. Cada fonte tem calendário
              próprio: um arquivo republicado hoje pode trazer o mesmo mês de referência de ontem.
            </p>
          </section>

          <section aria-labelledby="api-esquema">
            <h2 id="api-esquema" className="font-serif text-2xl text-carvao">Esquema e convenções</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Todo arquivo do catálogo é um objeto JSON; as chaves de primeiro nível de cada um estão na tabela abaixo.</li>
              <li>Ausência é <code className={code}>null</code>, nunca zero: dado que a fonte não publicou não vira número.</li>
              <li>Datas em ISO 8601 (<code className={code}>AAAA-MM-DD</code>, ou <code className={code}>AAAA-MM-DDTHH:MM:SS+00:00</code> nos carimbos de processamento, em UTC).</li>
              <li>Quando um arquivo declara <code className={code}>disponivel: false</code> ou <code className={code}>ok: false</code>, o conteúdo está ausente por motivo declarado no próprio arquivo, não por erro silencioso.</li>
              <li>A maioria dos arquivos declara a fonte primária nos próprios metadados, mas não todos (recortes municipais, índices e listas auxiliares); a fonte de cada página do Observatório está em{" "}<Link href="/observatorio/methodology" className="text-bronze underline underline-offset-4">metodologia e fontes</Link>.</li>
            </ul>
          </section>

          <section aria-labelledby="api-versao">
            <h2 id="api-versao" className="font-serif text-2xl text-carvao">Versão e quebra</h2>
            <p className="mt-3">
              Contrato vigente: versão <strong className="text-carvao">{CONTRATO.versao}</strong>, de {CONTRATO.data.split("-").reverse().join("/")}, com{" "}
              {CONTRATO.arquivos.length} arquivos e {CONTRATO.diretorios.length} diretórios por entidade.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>É quebra: um arquivo do catálogo deixar de existir, ou uma chave de primeiro nível do contrato ser removida ou renomeada. Quebra é registrada com nova versão principal do contrato, nesta página.</li>
              <li>Não é quebra: arquivo novo, chave nova, valores novos e revisões de série feitas pela própria fonte.</li>
              <li>Verificação automática: todo arquivo do catálogo precisa existir e ser JSON válido para que qualquer publicação vá ao ar. A remoção de chave não bloqueia a publicação: é detectada por <code className={code}>node scripts/contrato-gold.mjs</code>, fora do ciclo diário.</li>
              {typeof aviso === "number" && aviso > 0 ? (
                <li>Aviso prévio de quebra: {aviso} dias, nesta página.</li>
              ) : null}
            </ul>
          </section>

          {preenchido(licenca) ? (
            <section aria-labelledby="api-licenca">
              <h2 id="api-licenca" className="font-serif text-2xl text-carvao">Licença</h2>
              <p className="mt-3">{licenca}</p>
            </section>
          ) : null}
        </div>

        <section aria-labelledby="api-catalogo" className="mt-12">
          <h2 id="api-catalogo" className="font-serif text-2xl text-carvao">Catálogo</h2>
          <p className="mt-2 text-sm text-mineral">{itens.length} arquivos no gold publicado neste deploy.</p>
          <div className="mt-4 overflow-x-auto border border-linha bg-papel">
            <table className="w-full text-sm">
              <caption className="sr-only">Arquivos JSON da API de leitura, com tamanho, data de processamento e chaves de primeiro nível</caption>
              <thead>
                <tr className="text-left text-xs text-mineral">
                  <th scope="col" className="p-3 font-normal">Arquivo</th>
                  <th scope="col" className="p-3 text-right font-normal">Tamanho</th>
                  <th scope="col" className="p-3 font-normal">Processado em</th>
                  <th scope="col" className="p-3 font-normal">Chaves de primeiro nível</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => (
                  <tr key={i.arquivo} className="border-t border-linha align-top">
                    <th scope="row" className="p-3 text-left font-normal">
                      <a href={`/obs/data/gold/${i.arquivo}`} className="font-mono text-xs text-bronze underline underline-offset-4">{i.arquivo}</a>
                      {i.noContrato ? null : <span className="ml-2 text-xs text-mineral">(fora do contrato {CONTRATO.versao})</span>}
                    </th>
                    <td className="p-3 text-right tabular-nums text-carvao-muted">{tamanho(i.bytes)}</td>
                    <td className="p-3 text-carvao-muted">{i.geradoEm ? i.geradoEm.slice(0, 10).split("-").reverse().join("/") : "não declarado"}</td>
                    <td className="p-3 font-mono text-xs text-carvao-muted [overflow-wrap:anywhere]">{i.chaves.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="mt-8 rotulo text-mineral">Diretórios por entidade</h3>
          <ul className="mt-3 space-y-2 text-sm text-carvao-muted">
            {CONTRATO.diretorios.map((d) => (
              <li key={d.diretorio}>
                <code className={code}>{d.padrao}</code>: {d.descricao}; {d.quantidade.toLocaleString("pt-BR")} arquivos no contrato {CONTRATO.versao}.
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-10 text-sm text-carvao-muted">
          Para citar um número, use a citação pronta de cada indicador em{" "}
          <Link href="/dados" className="text-bronze underline underline-offset-4">Dados abertos</Link>.
        </p>
      </main>
      <Footer />
    </div>
  );
}
