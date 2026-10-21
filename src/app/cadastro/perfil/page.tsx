import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { nextStepPath } from "@/lib/onboarding";
import type { OnboardingStatus } from "@/lib/schema";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { cpfObrigatorioParaTelefone } from "@/lib/cpf-telefone";
import { COOKIE_DESTINO } from "@/lib/rotasPublicas";
import { destinoDoCadastro, type DestinoCadastro } from "@/lib/destinoCadastro";
import { PerfilForm } from "@/components/onboarding/PerfilForm";

export const metadata: Metadata = { title: "Crie sua senha e complete seu perfil" };
export const dynamic = "force-dynamic";

/** Para onde a pessoa vai ao concluir, pelo mesmo destino que a API do perfil devolve. */
function FraseDestino({ destino }: { destino: DestinoCadastro }) {
  switch (destino.tipo) {
    case "painel":
      return (
        <>
          Depois disso, você volta para <strong className="font-semibold text-carvao">{destino.nome}</strong>
          {destino.colecao ? `, em ${destino.colecao}` : ""}.
        </>
      );
    case "observatorio":
      return (
        <>
          Depois disso, você volta para o <strong className="font-semibold text-carvao">{destino.nome}</strong>.
        </>
      );
    case "pagina":
      return <>Depois disso, você volta para a página que pediu.</>;
    default:
      return <>Depois disso, você escolhe por qual observatório começar.</>;
  }
}

/**
 * Etapa 3: senha, CPF, UF e perfil de uso (instituição, área e cargo só nos
 * perfis profissionais). Sem sessão → /cadastro; etapa diferente → redireciona.
 */
export default async function PerfilPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/cadastro");
  }
  if (user.onboardingStatus !== "PROFILE_PENDING") {
    redirect(nextStepPath(user.onboardingStatus as OnboardingStatus));
  }

  const exigeCpf = cpfObrigatorioParaTelefone(user);
  if (exigeCpf === null) redirect("/cadastro/telefone");

  const destino = destinoDoCadastro(cookies().get(COOKIE_DESTINO)?.value);

  return (
    <section className="border border-linha bg-papel p-6 sm:p-8 md:p-10">
      <StepIndicator current={3} />
      <h1 className="mt-6 font-serif text-3xl text-carvao">Crie sua senha e complete seu perfil</h1>
      <p className="mt-3 text-base leading-relaxed text-carvao-muted" data-destino={destino.tipo}>
        Última etapa. <FraseDestino destino={destino} />
      </p>
      <div className="mt-8">
        <PerfilForm exigeCpf={exigeCpf} />
      </div>
    </section>
  );
}
