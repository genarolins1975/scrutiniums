import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Rota mantida apenas por compatibilidade com links antigos: o e-mail
 * não é mais verificado por código — a validação do usuário é somente
 * por SMS na etapa do telefone.
 */
export default function VerificarEmailPage() {
  redirect("/cadastro/telefone");
}
