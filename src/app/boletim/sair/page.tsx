import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle } from "@/components/ui/SectionHeading";
import { ConfirmarSaidaBoletim } from "@/components/boletim/ConfirmarSaidaBoletim";

export const metadata: Metadata = {
  title: "Sair do boletim",
  robots: { index: false },
};

/**
 * Página de saída do boletim mensal, alcançada pelo link do e-mail.
 * Não exige login: o token assinado identifica a conta. A mutação só
 * acontece no clique de confirmação (nunca no GET do link), para que
 * scanners de e-mail que pré-buscam URLs não descadastrem ninguém.
 */
export default function SairBoletimPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <PublicHeaderView />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <PageTitle
          label="Boletim mensal"
          title="Deixar de receber o boletim"
          description="Confirme abaixo para não receber mais o boletim mensal por e-mail. Você pode voltar a recebê-lo a qualquer momento na sua conta."
        />
        <div className="mt-10 max-w-prose2">
          {token ? (
            <ConfirmarSaidaBoletim token={token} />
          ) : (
            <p className="text-sm text-carvao-muted">
              Link incompleto. Use o link de saída que aparece no rodapé do boletim — ou
              gerencie a preferência em{" "}
              <Link href="/app/conta" className="underline decoration-linha underline-offset-4 hover:text-bronze">
                sua conta
              </Link>
              .
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
