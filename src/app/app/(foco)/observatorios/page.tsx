import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { COOKIE_OBSERVATORIO, colecaoDoCaminho, lerUltimoAcesso } from "@/lib/observatorios/ultimoAcesso";
import { diretorioDoMapa } from "@/lib/observatorios/mapaConta";
import { PARA_VOCE_POR_UF, paraVoceDoMapa, ufValida } from "@/lib/observatorios/paraVoce";
import { listarRecortes } from "@/lib/conta/recortes";
import { listarAlertas } from "@/lib/conta/alertas";
import { IDS_DOMINIOS, textosDominio, type DominioFrescorId } from "@/lib/frescor/regras";
import { EXEMPLO_DO_CAMPO } from "@/lib/busca/exemplos";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { MapaDaConta, type Retomar } from "@/components/observatorios/MapaDaConta";

export const metadata: Metadata = {
  title: "Encontre o painel",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

const ehDominioFrescor = (id: string): id is DominioFrescorId => (IDS_DOMINIOS as string[]).includes(id);

/**
 * Mapa da área logada, "Encontre o painel": o destino de todo login e da home com sessão (Iniciativa M1 do parecer de UX de
 * 23/10/2026; a anatomia está em MapaDaConta). Lê a sessão, o cookie de último acesso (gravado pelo middleware), os recortes e
 * os avisos da conta; por isso é dinâmica. Falha na leitura de recortes ou avisos não derruba o mapa: a parte some.
 */
export default async function EncontreOPainelPagina() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");

  const { secoes, totais } = diretorioDoMapa();
  const ultimo = lerUltimoAcesso(cookies().get(COOKIE_OBSERVATORIO)?.value);
  const [recortes, alertas] = await Promise.allSettled([listarRecortes(user.id), listarAlertas(user.id)]);
  const listaRecortes = recortes.status === "fulfilled" ? recortes.value : [];
  const listaAlertas = alertas.status === "fulfilled" ? alertas.value : [];

  const colecaoNoMapa = (id: string) => secoes.flatMap((o) => o.colecoes).find((c) => c.id === id);
  const retomar: Retomar = {
    continuar: ultimo && {
      ...ultimo,
      observatorioNome: OBSERVATORIOS.find((o) => o.id === ultimo.observatorio)!.nomeCurto,
      pergunta: ultimo.colecao ? (colecaoNoMapa(ultimo.colecao)?.pergunta ?? null) : OBSERVATORIOS.find((o) => o.id === ultimo.observatorio)!.pergunta,
    },
    recortes: listaRecortes.slice(0, 3).map((r) => ({ titulo: r.titulo, caminho: r.caminho, colecao: colecaoDoCaminho(r.caminho)?.nome ?? null })),
    totalRecortes: listaRecortes.length,
    avisos: listaAlertas.map((a) => (ehDominioFrescor(a.dominio) ? textosDominio(a.dominio).nome : a.dominio)),
  };

  // decisão 1 da seção 8 do parecer, pendente do dono: sem ela, a UF da conta não escolhe os números
  const uf = PARA_VOCE_POR_UF ? ufValida(user.uf) : null;
  const paraVoce = { ...paraVoceDoMapa(uf), comNumeros: uf !== null };

  return (
    <>
      <MarcaVisita secao="app:observatorios" />
      <MapaDaConta retomar={retomar} exemplo={EXEMPLO_DO_CAMPO} paraVoce={paraVoce} secoes={secoes} totais={totais} />
    </>
  );
}
