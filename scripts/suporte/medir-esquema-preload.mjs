// Instrumentação exclusiva do servidor local. Registra operação e duração,
// nunca parâmetros, conteúdo de contas ou credenciais.
import { PGlite } from "@electric-sql/pglite";
const query = PGlite.prototype.query;
PGlite.prototype.query = async function (consulta, ...args) {
  const esquema = /^(?:CREATE |ALTER |DO |UPDATE users SET onboarding_status|SELECT 1 FROM esquema_versoes|INSERT INTO esquema_versoes)/i.test(consulta.trim());
  const inicio = performance.now();
  try {
    return await query.call(this, consulta, ...args);
  } finally {
    if (esquema) console.log("MEDICAO_ESQUEMA " + JSON.stringify({
      operacao: consulta.trim().split(/\s+/)[0].toUpperCase(),
      ms: Math.round((performance.now() - inicio) * 100) / 100,
    }));
  }
};
