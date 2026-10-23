import Link from "next/link";
import { BuscaPlataforma } from "@/components/busca/BuscaPlataforma";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { ACENTO } from "@/components/home/acentos";
import { ParceriaTecnica } from "@/components/layout/ParceriaTecnica";
import { ParaVoce } from "@/components/observatorios/ParaVoce";
import { SeloProntidao } from "@/components/observatorios/SeloProntidao";
import { LinkMedido } from "@/components/telemetria/LinkMedido";
import { atualizacaoObservatorio } from "@/lib/atualizacaoObservatorios";
import type { TotaisInventario } from "@/lib/observatorios/inventario";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import type { LinhaColecao, SecaoObservatorio } from "@/lib/observatorios/mapaConta";
import type { PerguntaParaVoce } from "@/lib/observatorios/paraVoce";
import { navegacaoDaColecao } from "@/lib/observatorios/navegacaoColecao";
import type { UltimoAcesso } from "@/lib/observatorios/ultimoAcesso";
import styles from "./MapaDaConta.module.css";

/** O que a fatia "retomar" mostra; cada parte só existe quando há conteúdo. */
export type Retomar = {
  continuar: (UltimoAcesso & { observatorioNome: string; pergunta: string | null }) | null;
  recortes: { titulo: string; caminho: string; colecao: string | null }[];
  totalRecortes: number;
  avisos: string[];
};

const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Mapa da área logada, "Encontre o painel" (Iniciativa M1 do parecer de UX de 23/10/2026): a página de quem acabou de entrar
 * e de quem volta. Tarefa em uma frase: quem chega decide em uma tela para onde vai; quem volta retoma de onde parou.
 *
 * Fatias, nesta ordem, cada uma marcada `data-fatia` (conferidas por src/tests/mapa-conta.test.ts):
 *  1. `retomar`: só quando há último acesso, recorte salvo ou aviso; nunca estado vazio;
 *  2. `abertura`: o H1, uma frase e a busca da plataforma;
 *  3. `para-voce`: as perguntas do estado e da cidade do leitor, no mesmo componente das entradas;
 *  4. `destinos`: as 28 coleções nos seis observatórios, em grade (nunca `columns`), cada coleção um link direto;
 *  5. `metodo`: um só `<details>`, com o inventário, a legenda dos selos e as fontes de cada coleção.
 *
 * Todo destino é `<a href>`; os cliques do diretório são contados por LinkMedido, sem formulário. O `<main>` é o do layout da
 * conta (src/app/app/(foco)/layout.tsx); este elemento é o conteúdo dele, como as entradas que abrem o `<main>` no layout.
 */
export function MapaDaConta({
  retomar,
  exemplo,
  paraVoce,
  secoes,
  totais,
}: Readonly<{
  retomar: Retomar;
  /** Texto de exemplo do campo de busca (EXEMPLO_DO_CAMPO). */
  exemplo: string;
  paraVoce: { estado: PerguntaParaVoce[]; cidade: PerguntaParaVoce[]; comNumeros: boolean };
  secoes: SecaoObservatorio[];
  totais: TotaisInventario;
}>) {
  const temRetomar = !!retomar.continuar || retomar.recortes.length > 0 || retomar.avisos.length > 0;
  return (
    <div id="conteudo" data-mapa-conta="" className="mx-auto w-full max-w-page px-6 pb-12">
      {temRetomar && <FatiaRetomar retomar={retomar} />}

      <section data-fatia="abertura" aria-labelledby="mapa-titulo" className={styles.abertura}>
        <div>
          <h1 id="mapa-titulo" className="t-h1 text-carvao">
            Encontre o painel
          </h1>
          <p className="t-corpo mt-3 max-w-prose2 text-carvao-muted">
            Vinte e oito coleções em seis observatórios. Busque pelo tema, pelo lugar ou pela pergunta, ou escolha abaixo.
          </p>
        </div>
        <BuscaPlataforma variante="pagina" exemplo={exemplo} rotulo="Busca em toda a plataforma" rotuloVisivel />
      </section>

      <div data-fatia="para-voce">
        {paraVoce.comNumeros ? (
          <ParaVoce
            perguntas={paraVoce.estado}
            conteiner=""
            className="border-t border-linha"
            descricao="Perguntas sobre o seu estado e a sua cidade, a um clique. Cada número traz fonte e período; o destino mostra o detalhe."
          >
            <MinhaCidade perguntas={paraVoce.cidade} />
          </ParaVoce>
        ) : (
          <ParaVoce
            perguntas={paraVoce.estado}
            forma="lista"
            tituloLista="No seu estado"
            conteiner=""
            className="border-t border-linha"
            descricao="Perguntas sobre o seu estado e a sua cidade, a um clique. Os números aparecem no destino, depois de escolher o lugar."
          >
            <MinhaCidade perguntas={paraVoce.cidade} />
          </ParaVoce>
        )}
      </div>

      <div data-fatia="destinos" className={styles.destinos}>
        {secoes.map((o) => (
          <section key={o.id} id={`obs-${o.id}`} aria-labelledby={`obs-${o.id}-titulo`} className={styles.secao} data-observatorio={o.id}>
            <div aria-hidden="true" className={`${styles.filete} ${ACENTO[o.acento].filete}`} />
            <h2 id={`obs-${o.id}-titulo`} className="t-h2 text-carvao">
              {o.entrada ? (
                <LinkMedido href={o.entrada} secao={`mapa:o:${o.id}`} className={styles.titulo}>
                  {o.nomeCurto}
                  <span aria-hidden="true" className={styles.seta}>
                    →
                  </span>
                </LinkMedido>
              ) : (
                o.nomeCurto
              )}
            </h2>
            <p className="t-corpo mt-1 text-carvao-muted">{o.pergunta}</p>
            {o.id === "energia-e-infraestrutura" && (
              <div className="mt-2">
                <ParceriaTecnica variante="compacto" idioma="pt" />
              </div>
            )}
            <ul className={styles.colecoes}>
              {o.colecoes.map((c) => (
                <li key={c.id}>
                  <Colecao c={c} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Metodo secoes={secoes} totais={totais} />
    </div>
  );
}

/** "Continuar em …", até três recortes e os avisos configurados: cada parte só quando existe. */
function FatiaRetomar({ retomar }: Readonly<{ retomar: Retomar }>) {
  const { continuar, recortes, totalRecortes, avisos } = retomar;
  return (
    <section data-fatia="retomar" aria-label="Retomar de onde parou" className={styles.retomar}>
      {continuar && (
        <div className={styles.retomarItem} data-retomar="continuar">
          <p className="rotulo text-carvao-muted">Onde você parou</p>
          <Link href={continuar.href} prefetch={false} className={`${styles.alvo} t-corpo font-medium text-carvao`}>
            {`Continuar em ${continuar.nome}`} <span aria-hidden="true">→</span>
          </Link>
          <p className="t-meta text-carvao-muted">
            {continuar.tipo === "colecao" ? `Observatório ${continuar.observatorioNome}` : "Entrada do observatório"}
            {continuar.pergunta ? ` · ${continuar.pergunta}` : ""}
          </p>
        </div>
      )}
      {recortes.length > 0 && (
        <div className={styles.retomarItem} data-retomar="recortes">
          <p className="rotulo text-carvao-muted">Recortes salvos</p>
          <ul>
            {recortes.map((r) => (
              <li key={r.caminho}>
                <Link href={r.caminho} prefetch={false} className={`${styles.alvo} t-corpo text-carvao`}>
                  {r.titulo}
                  <span aria-hidden="true" className={styles.seta}>
                    →
                  </span>
                </Link>
                {r.colecao && <span className="t-meta block text-mineral">{r.colecao}</span>}
              </li>
            ))}
          </ul>
          {totalRecortes > recortes.length && (
            <Link href="/app/conta#recortes" prefetch={false} className={`${styles.alvo} t-meta text-carvao`}>
              {`Todos os recortes (${totalRecortes.toLocaleString("pt-BR")})`} <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      )}
      {avisos.length > 0 && (
        <div className={styles.retomarItem} data-retomar="avisos">
          <p className="rotulo text-carvao-muted">Avisos por e-mail</p>
          <Link href="/app/conta#alertas" prefetch={false} className={`${styles.alvo} t-corpo text-carvao`}>
            {`Avisar quando atualizar: ${plural(avisos.length, "fonte", "fontes")}`} <span aria-hidden="true">→</span>
          </Link>
          <p className="t-meta text-carvao-muted">{avisos.join(", ")}</p>
        </div>
      )}
    </section>
  );
}

/** As consultas por cidade, sem número até a conta guardar o município (Iniciativa I3): a mesma lista do "No seu estado". */
function MinhaCidade({ perguntas }: Readonly<{ perguntas: PerguntaParaVoce[] }>) {
  return (
    <div data-minha-cidade="">
      <h3 className="t-h3 text-carvao">Na sua cidade</h3>
      <ul className="mt-2 grid gap-x-8 md:grid-cols-2 lg:grid-cols-4">
        {perguntas.map((p) => (
          <li key={p.id} data-para-voce-pergunta={p.id} data-sem-numero={p.semNumero ?? ""} className="min-w-0 border-t border-linha">
            <Link href={p.href} prefetch={false} className="group flex min-h-[44px] items-center justify-between gap-x-3 py-2 t-corpo text-carvao">
              <span className="group-hover:underline group-hover:decoration-linha group-hover:underline-offset-4">{p.pergunta}</span>
              <span aria-hidden="true" className="text-mineral">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Uma coleção: o nome como link, a pergunta curta, o estado e, quando há, as páginas num `<details>`. */
function Colecao({ c }: Readonly<{ c: LinhaColecao }>) {
  const estado = (
    <>
      {plural(c.contagem, "página", "páginas")}
      {c.dadosAte && <> · dados até {c.dadosAte}</>}
      {c.atraso && <> · {minuscula(c.atraso)}</>}
    </>
  );
  return (
    <article aria-labelledby={`col-${c.id}`} className={styles.colecao} data-colecao={c.id}>
      <h3 id={`col-${c.id}`} className={styles.nome}>
        <LinkMedido href={c.href} secao={`mapa:${c.id}`} className={`${styles.alvo} t-corpo font-medium text-carvao`}>
          {c.nome}
          <span aria-hidden="true" className={styles.seta}>
            →
          </span>
        </LinkMedido>
        {c.prontidao && <SeloProntidao valor={c.prontidao} />}
      </h3>
      {c.paginas.length > 0 ? (
        <details className={styles.paginas}>
          <summary className="t-meta text-mineral" data-estado-colecao="">
            <span>{estado}</span>
            <span className={styles.abrir}>
              <span className={styles.fechado}>Ver as páginas</span>
              <span className={styles.aberto}>Fechar a lista</span>
              <span aria-hidden="true" className={styles.sinal} />
            </span>
          </summary>
          <ul>
            {c.paginas.map((p) => (
              <li key={p.rota ?? `previsto:${p.titulo}`}>
                {p.rota ? (
                  <Link href={p.rota} prefetch={false} className={`${styles.alvo} t-corpo text-carvao`}>
                    {p.titulo}
                    {p.situacao === "parcial" && <SeloProntidao valor="parcial" className="ml-2" />}
                  </Link>
                ) : (
                  // prevista: sem página, nunca link
                  <span className={`${styles.alvo} t-corpo text-carvao-muted`} title={p.pendencia}>
                    {p.titulo}
                    <SeloProntidao valor="preparacao" detalhe={p.pendencia} className="ml-2" />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className={`${styles.estado} t-meta text-mineral`} data-estado-colecao="">
          {estado}
        </p>
      )}
    </article>
  );
}

/** Um só `<details>` no fim: o inventário, a legenda dos selos e as fontes de cada coleção, na ordem do diretório. */
function Metodo({ secoes, totais }: Readonly<{ secoes: SecaoObservatorio[]; totais: TotaisInventario }>) {
  return (
    <details data-fatia="metodo" className={styles.metodo}>
      <summary className="t-h3 text-carvao">
        Como este mapa é montado
        <span aria-hidden="true" className={styles.sinal} />
      </summary>
      <div className="t-corpo max-w-prose2 text-carvao-muted">
        <p className="mt-4" data-totais="">
          {plural(totais.colecoes, "coleção", "coleções")} em {OBSERVATORIOS.length === 6 ? "seis" : OBSERVATORIOS.length} observatórios;{" "}
          {plural(totais.publicadas, "página publicada", "páginas publicadas")}, {plural(totais.parciais, "com cobertura parcial", "com cobertura parcial")},{" "}
          {plural(totais.previstas, "prevista", "previstas")} e ainda sem página. A contagem de cada coleção soma a entrada e as páginas que existem; as
          previstas aparecem na lista, sem link.
        </p>
        <ul className="mt-4 space-y-1" aria-label="Legenda dos selos">
          <li>
            <SeloProntidao valor="parcial" />: no ar, com parte da cobertura declarada.
          </li>
          <li>
            <SeloProntidao valor="preparacao" />: consta do catálogo, ainda sem página.
          </li>
          <li>
            <SeloProntidao valor="piloto" />: no ar como etapa piloto, com escopo reduzido declarado.
          </li>
        </ul>
        <p className="mt-4">
          &ldquo;Dados até&rdquo; é a referência mais recente dos números principais da fonte da coleção. Coleção sem fonte própria de atualização fica
          sem essa data. Ausência de dado é declarada, nunca estimada.
        </p>
      </div>
      <h3 className="t-h3 mt-8 text-carvao">Fontes e atualização</h3>
      <div className={styles.fontes}>
        {secoes.map((o) => (
          <section key={o.id} aria-labelledby={`fontes-${o.id}`}>
            <h4 id={`fontes-${o.id}`} className="rotulo text-carvao-muted">
              {o.nomeCurto}
            </h4>
            {o.colecoes.map((c) => {
              // a Justiça tem as linhas do snapshot do CNJ; nas demais coleções sem fonte própria, as linhas do domínio de origem
              // falariam de outra base (a Eficiência Estatal data a Educação das capitais): vale o método da coleção
              const linhas = c.fontes.length === 0 && c.id === "justica" ? atualizacaoObservatorio("judiciario").linhas : [];
              const metodo = navegacaoDaColecao(c.id).atalhos.metodo;
              return (
                <div key={c.id} className={styles.fonte} data-fontes-colecao={c.id}>
                  <p className="t-corpo font-medium text-carvao">{c.nome}</p>
                  {c.fontes.length > 0 ? (
                    <FaixaFrescor dominios={c.fontes} variante="metodo" />
                  ) : linhas.length > 0 ? (
                    <ul className="t-meta mt-1 space-y-1 text-carvao-muted">
                      {linhas.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  ) : metodo ? (
                    <p className="t-meta mt-1 text-carvao-muted">
                      Sem fonte única de atualização: fontes e períodos de cada página no{" "}
                      <Link href={metodo} prefetch={false} className="underline decoration-linha underline-offset-4 hover:decoration-carvao">
                        método da coleção
                      </Link>
                      .
                    </p>
                  ) : (
                    <p className="t-meta mt-1 text-carvao-muted">Sem fonte única de atualização: fontes e períodos em cada página da coleção.</p>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </details>
  );
}
