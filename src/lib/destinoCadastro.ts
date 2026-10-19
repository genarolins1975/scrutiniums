import { analisarUrlPagina } from "./i18n-url";
import { safeInternalPath } from "./onboarding";
import { OBSERVATORIOS } from "./observatorios/lista";
import { donoDaRota, observatorio } from "./observatorios/registro";

/**
 * Para onde a pessoa vai depois da última etapa do cadastro, dito pelo nome.
 * O destino é o mesmo que a API do perfil devolve: o cookie
 * scrutiniums_destino (COOKIE_DESTINO), gravado pelo middleware quando um
 * painel barrou quem estava sem sessão. O nome vem do registro dos
 * observatórios; rota sem nome registrado não ganha nome inventado.
 */
export type DestinoCadastro =
  | { tipo: "painel"; nome: string; colecao: string | null }
  | { tipo: "observatorio"; nome: string }
  | { tipo: "escolha" }
  | { tipo: "pagina" };

export function destinoDoCadastro(cookie: string | null | undefined): DestinoCadastro {
  const destino = safeInternalPath(cookie);
  if (!destino) return { tipo: "escolha" };
  const caminho = (analisarUrlPagina(destino)?.caminhoPt ?? destino).split(/[?#]/)[0].replace(/(.)\/$/, "$1");
  if (caminho === "/app" || caminho === "/app/observatorios") return { tipo: "escolha" };

  const obs = OBSERVATORIOS.find((o) => o.entrada === caminho);
  if (obs) return { tipo: "observatorio", nome: obs.nome };

  const painel = donoDaRota(caminho);
  if (!painel) return { tipo: "pagina" };
  const colecao = observatorio(painel.observatorio).colecoes.find((c) => c.id === painel.colecao)?.nome ?? null;
  // "Início" e títulos contidos no nome da coleção dizem menos que ele.
  if (colecao && (painel.titulo === "Início" || colecao.toLowerCase().includes(painel.titulo.toLowerCase()))) return { tipo: "painel", nome: colecao, colecao: null };
  return { tipo: "painel", nome: painel.titulo, colecao };
}
