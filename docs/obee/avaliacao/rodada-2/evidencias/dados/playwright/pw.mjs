import { createRequire } from "node:module";
const require = createRequire("/opt/node-tools/node_modules/");
export const { chromium } = require("playwright");
export const BASE = "http://localhost:3100/eficiencia-estatal/educacao-municipal-capitais";
export async function abre(opts={}) {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args:["--no-sandbox"] });
  const ctx = await b.newContext({ viewport:{width:opts.w||1440,height:opts.h||900}, acceptDownloads:true });
  return { b, ctx };
}
