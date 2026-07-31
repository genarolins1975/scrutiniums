import { describe, expect, it } from "vitest";
import { formatCpf, isValidCpf, maskCpf, normalizeCpf } from "@/lib/cpf";
import {
  AREAS_ATUACAO,
  AREAS_SET,
  NIVEIS_CARGO,
  NIVEIS_SET,
  TIPOS_INSTITUICAO,
  TIPOS_SET,
  UFS,
  UFS_SET,
  rotuloDe,
} from "@/lib/perfilOpcoes";

describe("cpf: validação por dígitos verificadores", () => {
  it("aceita CPFs válidos (com e sem máscara)", () => {
    // CPFs de teste com DVs corretos (gerados pelo algoritmo oficial)
    for (const cpf of ["529.982.247-25", "52998224725", "111.444.777-35", "935.411.347-80"]) {
      expect(isValidCpf(cpf), cpf).toBe(true);
    }
  });

  it("rejeita DVs errados, tamanhos errados e sequências repetidas", () => {
    for (const cpf of [
      "529.982.247-26", // DV errado
      "111.444.777-34", // DV errado
      "123.456.789-00", // DV errado
      "00000000000",
      "11111111111",
      "99999999999",
      "1234567890", // 10 dígitos
      "123456789012", // 12 dígitos
      "",
      "abc.def.ghi-jk",
    ]) {
      expect(isValidCpf(cpf), cpf).toBe(false);
    }
  });

  it("normaliza e formata durante a digitação", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
    expect(formatCpf("529")).toBe("529");
    expect(formatCpf("5299822")).toBe("529.982.2");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCpf("52998224725999")).toBe("529.982.247-25"); // trunca em 11
  });

  it("mascara para exibição sem revelar o CPF completo", () => {
    expect(maskCpf("52998224725")).toBe("•••.982.247-••");
    expect(maskCpf(null)).toBe("—");
    expect(maskCpf("123")).toBe("—");
    expect(maskCpf("52998224725")).not.toContain("529");
    expect(maskCpf("52998224725")).not.toContain("25");
  });
});

describe("perfil estruturado: allowlists fechadas", () => {
  it("todas as listas têm valores únicos e rótulos definidos", () => {
    for (const [nome, ops, set] of [
      ["tipos", TIPOS_INSTITUICAO, TIPOS_SET],
      ["areas", AREAS_ATUACAO, AREAS_SET],
      ["niveis", NIVEIS_CARGO, NIVEIS_SET],
      ["ufs", UFS, UFS_SET],
    ] as const) {
      expect(set.size, nome).toBe(ops.length);
      for (const o of ops) {
        expect(o.value, nome).toBeTruthy();
        expect(o.label, nome).toBeTruthy();
      }
    }
  });

  it("UFs cobrem as 27 unidades federativas mais Exterior", () => {
    expect(UFS).toHaveLength(28);
    expect(UFS_SET.has("SP")).toBe(true);
    expect(UFS_SET.has("EX")).toBe(true);
  });

  it("valores fora da lista são rejeitáveis e rótulo faz fallback seguro", () => {
    expect(TIPOS_SET.has("hacker")).toBe(false);
    expect(AREAS_SET.has("")).toBe(false);
    expect(rotuloDe(TIPOS_INSTITUICAO, "banco")).toBe("Banco");
    expect(rotuloDe(TIPOS_INSTITUICAO, null)).toBe("—");
    expect(rotuloDe(TIPOS_INSTITUICAO, "valor_desconhecido")).toBe("valor_desconhecido");
  });
});
