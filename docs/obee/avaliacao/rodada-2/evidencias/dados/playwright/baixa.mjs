import { abre, BASE } from "./pw.mjs";
import fs from "node:fs";
const OUT = "/home/user/scrutiniums/docs/obee/avaliacao/rodada-2/evidencias/dados/downloads/";
const { b, ctx } = await abre();
const p = await ctx.newPage();
const errs=[]; p.on("console",m=>{if(["error","warning"].includes(m.type())) errs.push(m.text().slice(0,200))}); p.on("pageerror",e=>errs.push("pageerror "+e.message));
async function clica(rotaOuUrl, nomeBotao, arquivo, preparo) {
  await p.goto(BASE+rotaOuUrl, {waitUntil:"networkidle"});
  if (preparo) await preparo();
  const loc = p.getByRole("button", {name: nomeBotao}).first();
  const n = await p.getByRole("button", {name: nomeBotao}).count();
  if (!n) { console.log("SEM BOTÃO", rotaOuUrl, nomeBotao); return; }
  const [d] = await Promise.all([p.waitForEvent("download"), loc.click()]);
  const sug = d.suggestedFilename();
  await d.saveAs(OUT+arquivo);
  console.log(rotaOuUrl, "->", sug, "->", arquivo, fs.statSync(OUT+arquivo).size, "bytes");
}
await clica("/gastos?med=despesa_mat&ano=2022", /Baixar estes valores/, "gastos_despesa_mat_2022_nominal.csv");
await clica("/gastos?med=despesa_hab&ano=2023", /Baixar estes valores/, "gastos_despesa_hab_2023_nominal.csv");
await clica("/gastos?med=despesa_hab&ano=2021&moeda=real", /Baixar estes valores/, "gastos_despesa_hab_2021_real.csv");
await clica("/gastos?med=despesa_hab&ano=2023", /Dicionário das colunas/, "dicionario_colunas.csv");
await clica("/resultados?med=ideb&ano=2022&etapa=anos_finais", /Baixar estes valores/, "resultados_ideb_2022_anos_finais.csv");
await clica("/resultados?med=saeb&ano=2023&etapa=anos_iniciais&disc=portugues", /Baixar estes valores/, "resultados_saeb_2023_ai_portugues.csv");
await clica("/atendimento?med=atu&ano=2024&etapa=creche", /Baixar estes valores/, "atendimento_atu_2024_creche.csv");
await clica("/comparar?med=despesa_hab&ano=2023&reg=NE", /Baixar estes valores/, "comparar_despesa_hab_2023_NE.csv");
// evolução
await clica("/gastos?med=despesa_hab&cap=recife&vis=evolucao", /Baixar/, "evolucao_recife_despesa_hab.csv");
// tabela comparativa
await clica("/comparar?med=despesa_hab&ano=2023&vis=tabela", /Baixar/, "comparar_tabela_completa_2023.csv");
console.log("erros console:", errs);
await b.close();
