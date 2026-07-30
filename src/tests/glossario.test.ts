import { describe, expect, it } from "vitest";
import { getGlossaryEntry, GLOSSARIO, type GlossaryEntry } from "@/lib/data/glossario";

// Os 8 campos da anatomia padrão de um verbete, além de slug/nome/unidade.
const CAMPOS_OBRIGATORIOS: (keyof GlossaryEntry)[] = [
  "definicao",
  "formula",
  "interpretacao",
  "fonte",
  "cobertura",
  "frequencia",
  "limitacoes",
  "revisaoMetodologica",
];

describe("glossario", () => {
  it("tem pelo menos uma entrada", () => {
    expect(GLOSSARIO.length).toBeGreaterThan(0);
  });

  it("slugs são únicos", () => {
    const slugs = GLOSSARIO.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("slugs seguem o formato kebab-case", () => {
    for (const e of GLOSSARIO) {
      expect(e.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("todas as entradas têm os 8 campos metodológicos não vazios", () => {
    for (const entry of GLOSSARIO) {
      for (const campo of CAMPOS_OBRIGATORIOS) {
        expect(entry[campo], `${entry.slug}.${campo}`).toBeTypeOf("string");
        expect(entry[campo].trim().length, `${entry.slug}.${campo} vazio`).toBeGreaterThan(0);
      }
    }
  });

  it("nome e unidade também são não vazios", () => {
    for (const entry of GLOSSARIO) {
      expect(entry.nome.trim().length).toBeGreaterThan(0);
      expect(entry.unidade.trim().length).toBeGreaterThan(0);
    }
  });

  it("getGlossaryEntry encontra por slug e retorna undefined para inexistente", () => {
    const primeiro = GLOSSARIO[0];
    expect(getGlossaryEntry(primeiro.slug)).toEqual(primeiro);
    expect(getGlossaryEntry("nao-existe")).toBeUndefined();
  });
});
