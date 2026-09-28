import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { COOKIE_OBSERVATORIO, DOMINIOS } from "@/lib/dominios";
import { PERGUNTAS_CREDITO, PERGUNTAS_ENERGIA, amostrasCredito, amostrasEnergia, miniaturaCredito, miniaturaEnergia } from "@/lib/amostras";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { PainelObservatorio } from "@/components/home/PainelObservatorio";
import { MiniaturaCredito } from "@/components/home/MiniaturaCredito";
import { MiniaturaEnergia } from "@/components/home/MiniaturaEnergia";

export const metadata: Metadata = {
  title: "O que você quer investigar hoje?",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

/**
 * Escolha pós login: dois portais visuais, cada um com uma amostra viva do seu
 * domínio (números reais, com fonte e data), a miniatura feita dos dados e as
 * perguntas que responde. Não é uma tela de aplicativos: é a pergunta do dia.
 */
export default async function EscolhaObservatorioPage() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  const ultimo = cookies().get(COOKIE_OBSERVATORIO)?.value;
  const [credito, energia] = DOMINIOS;
  const painéis = [
    { d: energia, numero: "01", miniatura: <MiniaturaEnergia dados={miniaturaEnergia()} />, perguntas: PERGUNTAS_ENERGIA, amostras: amostrasEnergia() },
    { d: credito, numero: "02", miniatura: <MiniaturaCredito dados={miniaturaCredito()} />, perguntas: PERGUNTAS_CREDITO, amostras: amostrasCredito() },
  ];

  return (
    <div className="mx-auto w-full max-w-page px-6 py-12 md:py-16">
      <MarcaVisita secao="app:observatorios" />
      <p className="rotulo text-mineral">Scrutiniums</p>
      <h1 className="mt-4 font-serif text-[clamp(2rem,4.4vw,3rem)] leading-tight text-carvao">O que você quer investigar hoje?</h1>
      <p className="mt-4 max-w-prose2 leading-relaxed text-carvao-muted md:text-lg">
        Dois observatórios sobre a mesma infraestrutura de dados, método e rastreabilidade. Cada painel abaixo mostra uma amostra viva do seu domínio,
        com fonte e data de referência.
      </p>

      <ul className="mt-10 grid gap-6 lg:grid-cols-2">
        {painéis.map((p) => (
          <li key={p.d.id}>
            <PainelObservatorio
              dominio={p.d}
              numero={p.numero}
              miniatura={p.miniatura}
              perguntas={p.perguntas}
              amostras={p.amostras.length ? p.amostras : undefined}
              acao={
                <>
                  {/* POST: a escolha grava cookie e evento; um link GET seria disparado pelo prefetch do Next */}
                  <form method="post" action="/app/observatorios/entrar">
                    <input type="hidden" name="d" value={p.d.id} />
                    <button type="submit" className="rotulo inline-flex min-h-[44px] items-center justify-center bg-carvao px-6 text-marfim hover:bg-carvao-soft">
                      Entrar <span aria-hidden="true" className="ml-2">→</span>
                      <span className="sr-only"> no {p.d.nome}</span>
                    </button>
                  </form>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    {ultimo === p.d.id && <span className="rotulo border border-linha px-2 py-1 text-mineral">sua última escolha aqui</span>}
                    {!p.amostras.length && <span className="text-xs text-mineral">Amostra indisponível nesta publicação.</span>}
                  </div>
                </>
              }
            />
          </li>
        ))}
      </ul>
      <p className="mt-10 text-sm text-mineral">
        Conta, preferências e sessão valem para os dois observatórios. Troque a qualquer momento pelo seletor no cabeçalho, sem novo login.{" "}
        <Link href="/app/conta" className="text-carvao underline underline-offset-4">
          Minha conta
        </Link>
      </p>
    </div>
  );
}
