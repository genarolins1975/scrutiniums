import type { EstadoModelo as E } from "@/lib/energia/tipos";

const INFO: Record<E, { rotulo: string; cls: string; texto: string }> = {
  PESQUISA: { rotulo: "Pesquisa", cls: "border-aviso text-aviso", texto: "Não pode aparecer como previsão oficial." },
  VALIDACAO: { rotulo: "Validação", cls: "border-natureza-previsto text-natureza-previsto", texto: "Só na área técnica, marcado como em validação." },
  PRODUCAO: { rotulo: "Produção", cls: "border-sucesso text-sucesso", texto: "Alimenta a previsão principal." },
  APOSENTADO: { rotulo: "Aposentado", cls: "border-mineral text-mineral", texto: "Previsões antigas permanecem no arquivo." },
};

export function EstadoModelo({ estado, comTexto = false }: { estado: E; comTexto?: boolean }) {
  const i = INFO[estado];
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={`rotulo border px-1.5 py-0.5 !text-xs ${i.cls}`}>
        <span className="sr-only">Estado do modelo: </span>
        {i.rotulo}
      </span>
      {comTexto && <span className="text-xs text-mineral">{i.texto}</span>}
    </span>
  );
}
