/**
 * Reporter do Vitest que grava, por arquivo de teste, onde o tempo foi gasto.
 *
 * O reporter JSON padrão só registra o corpo dos testes. Em 22/10/2026 a suíte gastou 720 s de
 * CPU e só 272 s em corpo de teste: o resto é subir o processo, preparar o ambiente e importar
 * React, Next e os módulos da página. Este reporter separa as parcelas (API de diagnóstico do
 * Vitest 4) para que a medida antes e depois de uma otimização mostre de onde veio o ganho.
 *
 * Uso: npx vitest run --reporter=default --reporter=./scripts/vitest-tempos.mjs
 * Saída: vitest-tempos.json na raiz (gitignorado), ou o caminho em TEMPOS_SAIDA.
 */
import { writeFileSync } from "node:fs";

export default class TemposPorArquivo {
  onTestRunEnd(modulos) {
    const arquivos = modulos.map((m) => {
      const d = m.diagnostic();
      let testes = 0;
      for (const t of m.children.allTests()) if (t.result().state !== "skipped") testes++;
      return {
        arquivo: m.relativeModuleId,
        estado: m.state(),
        testes,
        ambiente_ms: Math.round(d.environmentSetupDuration),
        preparo_ms: Math.round(d.prepareDuration),
        importacao_ms: Math.round(d.collectDuration),
        setup_ms: Math.round(d.setupDuration),
        corpo_ms: Math.round(d.duration),
      };
    });
    writeFileSync(process.env.TEMPOS_SAIDA || "vitest-tempos.json", JSON.stringify({ gerado_em: new Date().toISOString(), arquivos }, null, 1) + "\n");
  }
}
