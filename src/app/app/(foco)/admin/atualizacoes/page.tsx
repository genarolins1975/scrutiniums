import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { PageTitle } from "@/components/ui/SectionHeading";
import { QuadroAtualizacoes } from "@/components/admin/QuadroAtualizacoes";
import { TarefasOperacao } from "@/components/admin/TarefasOperacao";
import { lerQuadro } from "@/lib/operacoes/quadro";
import { lerEstadoOperacoes } from "@/lib/operacoes/estado";
import { combinarTarefas, monitorVigente, tarefasSugeridas } from "@/lib/operacoes/modelo";
import { listarTarefas } from "@/lib/operacoes/tarefas";

export const dynamic = "force-dynamic";
async function exigirAdmin() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  if (!isAdmin(user)) notFound();
}
export async function generateMetadata(): Promise<Metadata> {
  await exigirAdmin();
  return { title: "Atualização dos dados · Administração", robots: { index: false, follow: false } };
}
export default async function Atualizacoes({ searchParams }: { searchParams: { situacao?: string } }) {
  await exigirAdmin();
  const [linhas, leitura, salvas] = await Promise.all([lerQuadro(), lerEstadoOperacoes(), listarTarefas()]);
  const agora = new Date();
  const pendentes = linhas.filter((l) => l.situacao.estado !== "em-dia").length;
  return <div className="mx-auto w-full max-w-page px-4 py-6 sm:px-6 sm:py-10">
    <Link href="/app/admin" className="mb-1 inline-flex min-h-11 items-center text-sm text-destaque underline underline-offset-4">Voltar à administração</Link>
    <div className="[&>header]:pb-4"><PageTitle title="Atualização dos dados" description={pendentes ? `${pendentes} de ${linhas.length} áreas pedem conferência de frescor. Acompanhe as publicações e os encaminhamentos abaixo.` : `As ${linhas.length} áreas estão dentro do prazo de publicação. Confira também as rotinas e tarefas de integração.`} /></div>
    <nav aria-label="Seções de atualização" className="my-3 grid grid-cols-2 gap-4 text-sm sm:flex sm:gap-x-6"><a href="#publicacoes" className="inline-flex min-h-11 items-center text-destaque underline underline-offset-4">Quadro geral</a><a href="#tarefas" className="inline-flex min-h-11 items-center text-destaque underline underline-offset-4">Tarefas do ADM</a></nav>
    <div className="space-y-12"><QuadroAtualizacoes linhas={linhas} leitura={leitura} agora={agora} filtro={searchParams.situacao === "atencao" ? "atencao" : "todas"} />
      <TarefasOperacao iniciais={combinarTarefas(tarefasSugeridas(leitura.estado), salvas)} monitorDisponivel={monitorVigente(leitura.estado, agora) && leitura.estado?.erros.length === 0} /></div>
  </div>;
}
