import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { COOKIE_OBSERVATORIO, DOMINIOS, type DominioId } from "@/lib/dominios";
import { gold, integra } from "@/lib/energia/gold";
import { metaEducacao } from "@/lib/eficiencia/dados";
import { carimbo, dataBR, mesAno } from "@/lib/energia/formato";
import styles from "./escolha.module.css";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";

export const metadata: Metadata = {
  title: "Escolha seu observatório",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

/** Última atualização de cada observatório, lida das golds publicadas. */
function atualizacao(id: DominioId): { rotulo: string; linhas: string[] } {
  if (id === "credito") {
    try {
      const meta = JSON.parse(readFileSync(join(process.cwd(), "public", "obs", "data", "gold", "meta.json"), "utf-8"));
      const linhas = [];
      if (meta?.vintages?.sgs) linhas.push(`Crédito do SFN (BCB/SGS): data-base ${mesAno(meta.vintages.sgs)}`);
      if (meta?.vintages?.ifdata) linhas.push(`Instituições (IF.data): data-base ${mesAno(meta.vintages.ifdata)}`);
      if (meta?.gerado_em) linhas.push(`Processado em ${carimbo(meta.gerado_em)}`);
      return { rotulo: "Último dado disponível", linhas: linhas.length ? linhas : ["Data-base indisponível no momento."] };
    } catch {
      return { rotulo: "Último dado disponível", linhas: ["Data-base indisponível no momento."] };
    }
  }
  if (id === "eficiencia") {
    const m = metaEducacao();
    const linhas = [];
    if (m?.dados_capturados_ate) linhas.push(`Educação municipal nas capitais: dados capturados até ${dataBR(m.dados_capturados_ate.slice(0, 10))}`);
    if (m?.gerado_em) linhas.push(`Processado em ${carimbo(m.gerado_em)}`);
    return { rotulo: "Último dado disponível", linhas: linhas.length ? linhas : ["Data de captura indisponível no momento."] };
  }
  const hid = gold.hidrologia();
  const pld = gold.pld();
  const meta = gold.meta();
  const linhas = [];
  if (integra(hid)) linhas.push(`Operação do SIN (ONS): dados até ${dataBR(hid.dia_referencia_ear)}`);
  if (integra(pld)) linhas.push(`PLD (CCEE): até ${dataBR(pld.dia_referencia)}`);
  if (meta?.gerado_em) linhas.push(`Processado em ${carimbo(meta.gerado_em)}`);
  return { rotulo: "Última atualização operacional", linhas: linhas.length ? linhas : ["Atualização indisponível no momento."] };
}

const GUIAS: Record<DominioId, { chamada: string; temas: [string, string][] }> = {
  credito: {
    chamada: "O dinheiro, o acesso e o risco.",
    temas: [["Mercado de crédito", "Carteiras, juros e inadimplência"], ["Instituições e produtos", "Bancos, condições e comparações"], ["Pessoas e territórios", "Acesso, regiões e pagamentos"]],
  },
  energia: {
    chamada: "Do sistema elétrico à sua conta.",
    temas: [["Operação do sistema", "Água, geração, carga e rede"], ["Preços e mercado", "PLD, tarifas e empresas"], ["Consumidor e território", "Conta de luz, qualidade e regiões"]],
  },
  eficiencia: {
    chamada: "Os recursos públicos na vida das pessoas.",
    temas: [["Recursos", "Quanto o Estado aplica"], ["Acesso e atendimento", "Quem os serviços alcançam"], ["Resultados", "Educação, Saúde, Trabalho e Renda e Segurança Alimentar"]],
  },
};

/** Símbolos temáticos: identidade de cada área, sem representar dados. */
function Simbolo({ id }: { id: DominioId }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden="true" className={styles.simbolo}>
      {id === "credito" ? <>
        <path d="M12 29 40 13l28 16H12Zm5 34h46M12 69h56M23 36v20m17-20v20m17-20v20" />
        <circle cx="40" cy="24" r="3" />
      </> : id === "energia" ? <>
        <circle cx="40" cy="40" r="28" />
        <path d="m44 19-21 25h15l-2 18 22-26H43l1-17Z" />
        <path d="M40 5v7m0 56v7M5 40h7m56 0h7" />
      </> : <>
        <path d="M10 67h60M17 61V29h20v32m6 0V18h20v43M23 37h8m-8 8h8m-8 8h8m18-27h8m-8 9h8m-8 9h8m-8 9h8" />
        <path d="M8 21h14m-7-7v14M66 8v9m-4-4h8" />
      </>}
    </svg>
  );
}

export default async function EscolhaObservatorioPage() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  const ultimo = cookies().get(COOKIE_OBSERVATORIO)?.value;

  return (
    <div className={styles.pagina}>
      <MarcaVisita secao="app:observatorios" />
      <div className={styles.conteudo}>
        <section className={styles.abertura} aria-labelledby="titulo-escolha">
          <div>
            <p className={styles.rotulo}>Seu espaço de análise</p>
            <h1 id="titulo-escolha">O Brasil, sob três perspectivas.</h1>
            <p className={styles.introducao}>Escolha seu observatório e explore o tema que importa para você.</p>
          </div>
          <p className={styles.metodo}>Dados públicos. Método transparente.<br />Fontes e limites à vista, em cada análise.</p>
        </section>

        <ul className={styles.grade} aria-label="Escolha seu observatório">
          {DOMINIOS.map((d) => {
            const at = atualizacao(d.id);
            const guia = GUIAS[d.id];
            const recente = ultimo === d.id;
            return (
              <li key={d.id}>
                <article aria-label={d.nome} className={`${styles.cartao} ${styles[d.id]} ${recente ? styles.recente : ""}`}>
                  <div className={styles.capa}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className={styles.rotulo}>Observatório brasileiro</p>
                      {recente && <span className={styles.selo}>Último acesso</span>}
                    </div>
                    <div className={styles.identidade}>
                      <h2>{d.nomeCurto}</h2>
                      <Simbolo id={d.id} />
                    </div>
                    <p className={styles.chamada}>{guia.chamada}</p>
                  </div>
                  <div className={styles.temas}>
                    <p className={styles.rotulo}>O que você encontra</p>
                    <ul>
                      {guia.temas.map(([titulo, detalhe]) => (
                        <li key={titulo}>
                          <span aria-hidden="true" className={styles.ponto} />
                          <div><h3>{titulo}</h3><p>{detalhe}</p></div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* POST preserva cookie e evento sem disparar a escolha pelo prefetch. */}
                  <form method="post" action="/app/observatorios/entrar" className={styles.entrada}>
                    <input type="hidden" name="d" value={d.id} />
                    <button type="submit">
                      {recente ? "Continuar" : "Explorar"} {d.nomeCurto}
                      <span aria-hidden="true">↗</span>
                      <span className="sr-only"> — entrar no {d.nome}</span>
                    </button>
                  </form>
                  <details className={styles.atualizacao}>
                    <summary>Fontes e atualização <span aria-hidden="true">+</span></summary>
                    <div>
                      <p>{d.descricaoCurta}</p>
                      <p className={styles.rotulo}>{at.rotulo}</p>
                      <ul>{at.linhas.map((l) => <li key={l}>{l}</li>)}</ul>
                    </div>
                  </details>
                </article>
              </li>
            );
          })}
        </ul>

        <aside className={styles.conta} aria-label="Sua conta na plataforma">
          <div><h2>Uma conta. Todos os observatórios.</h2><p>Sua sessão e suas preferências acompanham você. Troque de tema pelo seletor no cabeçalho.</p></div>
          <Link href="/app/conta">Minha conta <span aria-hidden="true">→</span></Link>
        </aside>
      </div>
    </div>
  );
}
