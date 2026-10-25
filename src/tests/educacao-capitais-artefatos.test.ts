import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dadosPainel, goldEducacao } from "@/lib/eficiencia/dados";
import { contextos } from "@/lib/eficiencia/contexto";
import { RecursoResultado } from "@/components/observatorios/RecursoResultado";
import { EscoresServicos } from "@/components/eficiencia/EscoresServicos";
import { GraficoPontos } from "@/components/painel/GraficoPontos";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => "/eficiencia-estatal/educacao-municipal-capitais",
  useRouter: () => ({push:()=>undefined,replace:()=>undefined,prefetch:()=>undefined}),
  useSearchParams: () => new URLSearchParams("cap=recife"),
}));

vi.mock("@/components/energia/useEstadoUrl", async () => {
  const real = await vi.importActual<typeof import("@/components/energia/useEstadoUrl")>("@/components/energia/useEstadoUrl");
  return {...real, useEstadoUrl: (...args: Parameters<typeof real.useEstadoUrl>) => real.useEstadoUrl(args[0], {...args[1], buscaInicial:"cap=recife"})};
});

/** PR 3 do pedido do dono: cinco elos reais e preparação sem link, preservando demais consumidores. */
describe("Educação nas capitais: artefatos e consumidores compartilhados",()=>{
  it("a sequência de cinco elos usa o envelope e conserva a ausência",()=>{
    const h=renderToStaticMarkup(createElement(RecursoResultado,{sequencia:[{titulo:"Dado ausente",texto:"Universo identificado",numero:{rotulo:"Medida",valor:null,unidade:"alunos",periodo:"edição publicada",fonte:"INEP",href:"/educacao-municipal",nota:"Não divulgado"}}]}));
    expect(h).toContain('id="recurso-educacao"');
    expect(h).toContain("Não divulgado");
    expect(h).toContain("Universo identificado");
    const anterior=renderToStaticMarkup(createElement(RecursoResultado,{temas:[]}));
    expect(anterior).toContain('id="recurso"');
    expect(anterior).not.toContain('id="recurso-educacao"');
  });
  it("a preparação não oferece ação enquanto o consumidor anterior conserva o método",()=>{
    const novo=renderToStaticMarkup(createElement(EscoresServicos,{capitulo:"education",preparacao:true}));
    expect(novo).not.toMatch(/<a\s/);
    expect(novo).toContain("Não calculável");
    expect(renderToStaticMarkup(createElement(EscoresServicos,{capitulo:"health"}))).toContain("/eficiencia-estatal/seguranca-alimentar/metodos");
  });
  it("o eixo pode conservar os limites naturais sem acrescentar observações",()=>{
    const h=renderToStaticMarkup(createElement(GraficoPontos,{titulo:"Ideb",itens:[{id:"a",rotulo:"Capital A",valor:6,referencia:5}],unidade:"pontos",rotuloValor:"Ideb",rotuloReferencia:"Mediana",limitesEixo:[0,10],zeroNoEixo:true}));
    expect(h).toMatch(/>10,0<\/text>/);
    expect(h).toContain("Capital A");
    expect(h).not.toContain('data-id="10"');
  });
  it("o laboratório usa a capital real e a ponte contábil existente",async()=>{
    const g=goldEducacao()!;
    const {LaboratoriosCapitais}=await import("@/components/eficiencia/LaboratoriosCapitais");
    const h=renderToStaticMarkup(createElement(LaboratoriosCapitais,{dados:dadosPainel(g),contextos:contextos(g)}));
    expect(h).toContain('id="laboratorio-ponte"');
    expect(h).toContain('id="recurso-educacao"');
    expect(h).toContain("Recife");
    expect(h).toContain("Siconfi");
  });
});
