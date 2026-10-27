import { describe, expect, it } from "vitest";
import { portasPublicadas, vitrinesPublicadas, diretorioPublicado, frescorPublicado, atualizacaoPublicada } from "@/lib/publicacao/entradas";
import { portas } from "@/lib/perguntas/portas";
import { vitrines } from "@/lib/vitrine";
import { diretorioDoMapa } from "@/lib/observatorios/mapaConta";
import { dadosFrescor } from "@/lib/frescor/dominios";
import { IDS_DOMINIOS } from "@/lib/frescor/regras";
import { DOMINIOS } from "@/lib/dominios";
import { atualizacaoObservatorio } from "@/lib/atualizacaoObservatorios";
const serializar = (v: unknown) => JSON.parse(JSON.stringify(v));
describe("manifesto das entradas", () => {
  it("preserva números, fontes, períodos, ausência e destinos da publicação corrente", () => {
    expect(portasPublicadas).toEqual(serializar(portas()));
    expect(vitrinesPublicadas).toEqual(serializar(vitrines()));
    expect(frescorPublicado(IDS_DOMINIOS)).toEqual(serializar(dadosFrescor(IDS_DOMINIOS)));
    for (const d of DOMINIOS) expect(atualizacaoPublicada(d.id)).toEqual(atualizacaoObservatorio(d.id));
  });
  it.each(["2026-10-27", "2027-04-01"])("mantém o diretório e calcula atrasos na data da leitura: %s", dia => {
    const agora = new Date(dia);
    expect(serializar(diretorioPublicado(agora))).toEqual(serializar(diretorioDoMapa(agora)));
  });
});
