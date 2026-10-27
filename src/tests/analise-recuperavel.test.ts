import { describe, expect, it } from "vitest";
import { campo, escreverEstado, lerEstado, tiposUrl as t } from "@/lib/painel/estadoUrl";
import { resumoRecorte } from "@/lib/conta/resumoRecorte";

describe("Frente 3: recorte reproduzível (pedido do dono, 27/10/2026)", () => {
  it("o endereço compartilhado fixa inclusive os padrões que podem mudar na próxima publicação", () => {
    const original = { ano: campo(t.inteiro(), 2026), entidades: campo(t.lista(t.texto()), ["PE", "SP"]), zero: campo(t.numero(), 0) };
    const valores = lerEstado(original, "");
    const busca = escreverEstado(original, valores, "?utm_origem=nota%20econ%C3%B4mica", true);
    const outraPublicacao = { ano: campo(t.inteiro(), 2027), entidades: campo(t.lista(t.texto()), ["RJ"]), zero: campo(t.numero(), 10) };
    expect(lerEstado(outraPublicacao, busca)).toEqual(valores);
    expect(busca).toContain("utm_origem=nota%20econ%C3%B4mica");
    expect(escreverEstado(original, valores, "")).toBe("");
  });

  it("compartilhar lista vazia, falso e zero não os transforma em padrões ou ausências", () => {
    const esquema = { itens: campo(t.lista(t.texto()), ["a"]), corrigido: campo(t.booleano(), true), valor: campo(t.numero(), 20) };
    const valores = { itens: [], corrigido: false, valor: 0 };
    expect(lerEstado(esquema, escreverEstado(esquema, valores, "", true))).toEqual(valores);
  });

  it("o resumo mostra unidades conhecidas, sem inventar litros de recorte antigo ou rotular chaves desconhecidas", () => {
    const comVolume = resumoRecorte("/combustiveis?uf=PE&litros=60&hist.de=");
    expect(comVolume).toHaveLength(2);
    expect(comVolume[1].texto).toMatch(/60.*litros/);
    expect(resumoRecorte("/combustiveis?uf=PE")).toHaveLength(1);
    expect(resumoRecorte("/rota?segredo=valor&hist.de=x")).toEqual([]);
    expect(resumoRecorte("/combustiveis?litros=" )[0].texto).not.toMatch(/40|zero|NaN/);
    expect(resumoRecorte("/en/setor-eletrico/conta-de-luz?conta_kwh=450")[0].texto).toContain("450 kWh");
  });

  it("um parâmetro desconhecido não é interpretado como propriedade herdada do catálogo de estados", () => {
    for (const uf of ["__proto__", "constructor", "toString", "ZZ"]) {
      expect(resumoRecorte(`/combustiveis?uf=${uf}`)).toEqual([]);
      expect(resumoRecorte(`/setor-eletrico/conta-de-luz?conta_municipio=${uf}%7CRecife`)).toEqual([]);
    }
  });
});
