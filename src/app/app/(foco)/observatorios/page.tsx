import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { COOKIE_OBSERVATORIO } from "@/lib/dominios";
import { OPCOES_OBSERVATORIOS, type OpcaoObservatorioId } from "@/lib/opcoesObservatorios";
import { atualizacaoObservatorio } from "@/lib/atualizacaoObservatorios";
import styles from "./escolha.module.css";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";

export const metadata: Metadata = {
  title: "Escolha seu observatório",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

const GUIAS: Record<OpcaoObservatorioId, { chamada: string; temas: [string, string][] }> = {
  judiciario: {
    chamada: "Recursos, filas e tempos da Justiça brasileira.",
    temas: [["Recursos e despesas", "Série financeira e composição dos gastos"], ["Tempos e filas", "Duração dos processos, pendências e congestionamento"], ["Comparar tribunais", "57 fichas e comparação dentro de cada ramo"]],
  },
  saneamento: {
    chamada: "Água, esgoto, preço regulado e metas em cada município.",
    temas: [["Acesso e carência", "Censo 2022 e SINISA 2024 nos 5.570 municípios"], ["Preço regulado", "Tarifas verificadas, decisões dos reguladores e conta das famílias"], ["Prestadores, investimento e metas", "Quem presta, quem regula, quanto se investe e quanto falta"]],
  },
  gas: {
    chamada: "Do poço ao botijão e ao gás canalizado.",
    temas: [["Produção e aproveitamento", "Quanto se produz, reinjeta, queima e disponibiliza"], ["Importação e preços", "Origem do gás importado e preço em cada elo"], ["Consumidor", "Botijão, GNV e inflação do gás por UF"]],
  },
  estados: {
    chamada: "Receitas, despesas e dívida nas 27 UFs.",
    temas: [["Execução do orçamento", "Da autorização ao pagamento, com saldos e valores exatos"], ["Receitas, despesas e dívida", "Composição do gasto, financiamento e condição fiscal"], ["Comparação entre estados", "Recortes regionais, mediana, tabelas e fontes originais"]],
  },
  contas: {
    chamada: "Do orçamento às entregas do governo federal.",
    temas: [["Orçamento e resultado fiscal", "Autorizações, pagamentos, receitas e saldo"], ["Custos e variações", "Maiores componentes e mudanças entre os anos"], ["Compromissos e entregas", "Restos a pagar e metas físicas registradas"]],
  },
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
    temas: [["Recursos", "Quanto o Estado aplica"], ["Acesso e atendimento", "Quem os serviços alcançam"], ["Resultados", "Educação, Saúde e Trabalho e Renda"]],
  },
};

/** Símbolos temáticos: identidade de cada área, sem representar dados. */
function Simbolo({ id }: { id: OpcaoObservatorioId }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden="true" className={styles.simbolo}>
      {id === "credito" ? <>
        <path d="M12 29 40 13l28 16H12Zm5 34h46M12 69h56M23 36v20m17-20v20m17-20v20" />
        <circle cx="40" cy="24" r="3" />
      </> : id === "judiciario" ? <>
        <path d="M17 12h29l10 10v12M17 12v54h19M46 12v12h10M25 32h21M25 41h12M25 50h8" />
        <circle cx="54" cy="54" r="17" />
        <path d="M54 43v11l7 5" />
      </> : id === "energia" ? <>
        <circle cx="40" cy="40" r="28" />
        <path d="m44 19-21 25h15l-2 18 22-26H43l1-17Z" />
        <path d="M40 5v7m0 56v7M5 40h7m56 0h7" />
      </> : id === "saneamento" ? <>
        <path d="M40 10c-9 13-16 22-16 31a16 16 0 0 0 32 0c0-9-7-18-16-31Z" />
        <path d="M10 66h60M18 58c4 0 4-4 8-4s4 4 8 4 4-4 8-4 4 4 8 4 4-4 8-4" />
      </> : id === "estados" ? <>
        <path d="M10 66h60M15 59V37h12v22m7 0V22h12v37m7 0V30h12v29M15 15h12m7 0h12m7 0h12" />
      </> : id === "gas" ? <>
        <path d="M40 10c9 12 18 21 18 34a18 18 0 0 1-36 0c0-8 4-14 9-19 1 7 4 11 8 12-3-8-2-17 1-27Z" />
        <path d="M33 50a7 7 0 0 0 14 0c0-5-4-8-7-12-3 4-7 7-7 12ZM12 70h56" />
      </> : id === "contas" ? <>
        <path d="M20 10h30l12 12v48H20V10Zm30 0v14h12M28 33h26M28 41h26M28 60V50m12 10V46m12 14V52M26 64h30" />
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
            <h1 id="titulo-escolha">O Brasil, sob diferentes perspectivas.</h1>
            <p className={styles.introducao}>Escolha seu observatório e explore o tema que importa para você.</p>
          </div>
          <p className={styles.metodo}>Dados públicos. Método transparente.<br />Fontes e limites à vista, em cada análise.</p>
        </section>

        <ul className={styles.grade} aria-label="Escolha seu observatório">
          {OPCOES_OBSERVATORIOS.map((d) => {
            const at = atualizacaoObservatorio(d.id);
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
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 16 16 4M4 4h12v12" /></svg>
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
