import Link from "next/link";
import type { DominioId } from "@/lib/dominios";
import { DetalhesFechaveis } from "@/components/layout/DetalhesFechaveis";
import { SeletorColecoes } from "@/components/layout/NavegacaoContexto";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { caminhoAtual, colecaoDoDominio, indiceDoCaminho } from "@/lib/observatorios/contexto";

/**
 * Seletor discreto da coleção corrente ("Setor Elétrico ▾"), com as 28 coleções do registro agrupadas pelos seis
 * observatórios (src/lib/observatorios/lista.ts). A coleção atual é a dona do endereço no registro (contextoPuro.ts),
 * a mesma que o rótulo acima do H1 (RotuloContexto) e a trilha (Trilha) mostram, resolvida também no navegador a cada
 * navegação (SeletorColecoes); `atual` só vale quando o endereço não está no registro. <details> nativo: funciona sem
 * JavaScript e abre por teclado e toque; com JavaScript, fecha com Esc, com clique fora e quando o foco sai do menu. Troca
 * de observatório sem novo login: a sessão e as preferências são da plataforma.
 */
export function SwitcherObservatorio({
  atual = null,
  caminho,
  onDark = false,
  doProvedor = false,
}: {
  atual?: DominioId | null;
  /** Endereço a resolver (testes); sem ele, o da renderização. */
  caminho?: string | null;
  onDark?: boolean;
  /** Dentro de um ProvedorContexto (CabecalhoPlataforma): o índice vem dele e não se repete nas props. */
  doProvedor?: boolean;
}) {
  // idioma pelo endereço (vale em qualquer observatório); nomes de observatório e coleção são nomes próprios e ficam em português, marcados
  const idioma = idiomaEnergia();
  const endereco = caminho !== undefined ? caminho : caminhoAtual();
  const doDominio = atual ? colecaoDoDominio(atual) : null;
  return (
    <DetalhesFechaveis className="group relative">
      <SeletorColecoes
        {...(doProvedor ? {} : { indice: indiceDoCaminho(endereco), caminho: endereco })}
        padrao={doDominio ? { observatorio: doDominio.observatorio.id, colecao: doDominio.colecao.id } : null}
        idioma={idioma}
        onDark={onDark}
      >
        <Link href="/app/observatorios" className="rotulo sel-item sel-obs mt-1 border-t border-linha">
          {tx("Escolher na minha conta →", "Choose in my account →", idioma)}
        </Link>
      </SeletorColecoes>
    </DetalhesFechaveis>
  );
}
