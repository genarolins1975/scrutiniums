import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { COOKIE_OBSERVATORIO } from "@/lib/dominios";
import { OPCOES_OBSERVATORIOS, type OpcaoObservatorioId } from "@/lib/opcoesObservatorios";
import { OBSERVATORIOS, OBSERVATORIO_PRINCIPAL, type ObservatorioId } from "@/lib/observatorios/lista";
import { inventario, totais } from "@/lib/observatorios/inventario";
import { atualizacaoObservatorio } from "@/lib/atualizacaoObservatorios";
import { listarRecortes } from "@/lib/conta/recortes";
import { listarAlertas } from "@/lib/conta/alertas";
import { IDS_DOMINIOS, textosDominio, type DominioFrescorId } from "@/lib/frescor/regras";
import styles from "./escolha.module.css";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { ParceriaTecnica } from "@/components/layout/ParceriaTecnica";
import { DiretorioPaineis } from "@/components/observatorios/DiretorioPaineis";

export const metadata: Metadata = {
  title: "Encontre o painel",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

/** Observatório em que cada cartão aparece: o principal do domínio; o Judiciário fica com a Eficiência Estatal. */
const OBSERVATORIO_DO_CARTAO = (id: OpcaoObservatorioId): ObservatorioId =>
  id === "judiciario" ? OBSERVATORIO_PRINCIPAL.eficiencia : OBSERVATORIO_PRINCIPAL[id];

const ehDominioFrescor = (id: string): id is DominioFrescorId => (IDS_DOMINIOS as string[]).includes(id);

/**
 * Mapa da área logada: um diretório de todas as coleções e páginas, com
 * filtro enquanto digita (DiretorioPaineis). Acima, o lugar do leitor na
 * plataforma: onde parou, recortes salvos e avisos. No fim, fontes e
 * atualização de cada coleção, recolhidas.
 */
export default async function EscolhaObservatorioPage() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  const ultimo = cookies().get(COOKIE_OBSERVATORIO)?.value;
  // o cookie guarda um observatório ou uma coleção; nos dois casos há um observatório a retomar
  const cartaoUltimo = OPCOES_OBSERVATORIOS.find((d) => d.id === ultimo);
  const observatorioUltimo = OBSERVATORIOS.find((o) => o.id === ultimo) ?? (cartaoUltimo ? OBSERVATORIOS.find((o) => o.id === OBSERVATORIO_DO_CARTAO(cartaoUltimo.id)) : undefined);

  // recortes e avisos vêm do banco; falha aqui não derruba o mapa, vira "indisponível"
  const [recortes, alertas] = await Promise.allSettled([listarRecortes(user.id), listarAlertas(user.id)]);
  const listaRecortes = recortes.status === "fulfilled" ? recortes.value : null;
  const listaAlertas = alertas.status === "fulfilled" ? alertas.value : null;
  const nomesAlertas = (listaAlertas ?? []).map((a) => (ehDominioFrescor(a.dominio) ? textosDominio(a.dominio).nome : a.dominio));

  const obs = inventario();
  const extras = Object.fromEntries(
    OBSERVATORIOS.map((o) => [
      o.id,
      // parceria técnica com o FGV CERI, só no observatório de infraestrutura
      o.id === "energia-e-infraestrutura" && (
        <div className={styles.parceria}>
          <ParceriaTecnica variante="compacto" idioma="pt" />
        </div>
      ),
    ]),
  ) as Partial<Record<ObservatorioId, React.ReactNode>>;

  return (
    <div className={styles.pagina}>
      <MarcaVisita secao="app:observatorios" />
      <div className={`${styles.lugar} flex flex-wrap items-start justify-between`} aria-label="Seu lugar na plataforma">
        <div className={styles.lugarItens}>
          {observatorioUltimo ? (
            <form method="post" action="/app/observatorios/entrar" className={styles.continuar}>
              {cartaoUltimo ? <input type="hidden" name="d" value={cartaoUltimo.id} /> : <input type="hidden" name="o" value={observatorioUltimo.id} />}
              <span><strong>Continuar:</strong> {cartaoUltimo ? cartaoUltimo.nomeCurto : observatorioUltimo.nomeCurto}</span>
              <button type="submit">Voltar ao painel <span aria-hidden="true">→</span></button>
            </form>
          ) : (
            <span className={styles.vazio}><strong>Continuar:</strong> ainda sem último acesso</span>
          )}
          <span className={listaRecortes && listaRecortes.length > 0 ? undefined : styles.vazio}>
            <strong>Recortes salvos:</strong>{" "}
            {listaRecortes === null
              ? "indisponíveis no momento"
              : listaRecortes.length === 0
                ? <>nenhum ainda · <Link href="/app/conta#recortes">como salvar</Link></>
                : <>{listaRecortes.length} · último: <Link href={listaRecortes[0].caminho} prefetch={false}>{listaRecortes[0].titulo}</Link> · <Link href="/app/conta#recortes">todos</Link></>}
          </span>
          <span className={nomesAlertas.length > 0 ? undefined : styles.vazio}>
            <strong>Avisos de atualização:</strong>{" "}
            {listaAlertas === null
              ? "indisponíveis no momento"
              : nomesAlertas.length === 0
                ? <>nenhum configurado · <Link href="/app/conta#alertas">escolher fontes</Link></>
                : <>{nomesAlertas.join(", ")} · <Link href="/app/conta#alertas">ajustar</Link></>}
          </span>
        </div>
        <Link href="/app/conta" className={styles.conta}>Minha conta <span aria-hidden="true">→</span></Link>
      </div>

      <div className={styles.conteudo}>
        <DiretorioPaineis observatorios={obs} totais={totais(obs)} extras={extras} />

        {/* método recolhido no fim: fontes, cobertura e atualização de cada coleção com pipeline próprio */}
        <section className={styles.fontes} aria-labelledby="fontes-titulo">
          <h2 id="fontes-titulo">Fontes e atualização</h2>
          <p>O que cada coleção lê, de que período e quando foi capturado. Ausência de dado é declarada, nunca estimada.</p>
          <div className={styles.fontesLista}>
            {OBSERVATORIOS.map((o) => {
              const cartoes = OPCOES_OBSERVATORIOS.filter((d) => OBSERVATORIO_DO_CARTAO(d.id) === o.id);
              if (cartoes.length === 0) return null;
              return (
                <div key={o.id}>
                  <p className={styles.rotulo}>{o.nomeCurto}</p>
                  {cartoes.map((d) => {
                    const at = atualizacaoObservatorio(d.id);
                    return (
                      <details key={d.id}>
                        <summary>{d.nomeCurto} <span aria-hidden="true">+</span></summary>
                        <div>
                          <p>{d.descricaoCurta}</p>
                          <p className={styles.rotulo}>{at.rotulo}</p>
                          <ul>{at.linhas.map((l) => <li key={l}>{l}</li>)}</ul>
                        </div>
                      </details>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
