import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { aguardarHidratacao, aguardarSessaoResolvida } from "../../scripts/ux-cromo-medida.mjs";
import { NO_MOLDE } from "./suporte/entradas-molde";
import { exigirBuild, subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";

/**
 * Orçamento de comprimento das entradas (Iniciativa 4 do parecer de UX de 21/10/2026; decisão do dono de 22/10/2026: seguir
 * sempre o padrão). No build de produção, a altura total da página (do topo da barra comum ao fim do rodapé):
 *  - entrada de coleção ou de observatório (e a irmã inglesa do Setor Elétrico), com sessão: até 6.500 px a 1440 e 11.000 px a 390;
 *  - o Crédito aberto (/observatorio-do-credito sem sessão, a apresentação pública do tema): até 3.500 px a 1440 e 7.000 px a 390;
 *  - o mapa da conta (/app/observatorios, com sessão; Iniciativa M1 do parecer de UX de 23/10/2026): até 3.500 px a 1440 e 7.000 px
 *    a 390, o mesmo orçamento das portas, e o primeiro cartão do "Para você" começa acima de 900 px a 1440;
 *  - o primeiro número da escala começa acima de 900 px a 1440, na primeira tela.
 * O que não cabe vai para blocos recolhidos na mesma página, com o conteúdo inteiro no HTML; nada é apagado para caber.
 * Sem build (.next/BUILD_ID) o teste não roda; com EXIGIR_BUILD_HTML=1 (CI), a falta do build reprova.
 */
const ORCAMENTO = {
  entrada: { 1440: 6500, 390: 11000 },
  creditoAberto: { 1440: 3500, 390: 7000 },
  mapa: { 1440: 3500, 390: 7000 },
} as const;
const TOPO_PRIMEIRO_NUMERO = 900;
/** As entradas no molde e a irmã inglesa do Setor Elétrico, a mesma entrada com o texto em inglês (que quebra em mais linhas). */
const ENTRADAS = [...NO_MOLDE, "/en/setor-eletrico"];

describe("orçamento de comprimento", () => {
  it("o build existe quando o CI exige", () => {
    if (exigirBuild) expect(temBuild, "rodar npm run build antes dos testes").toBe(true);
  });
});

describe.skipIf(!temBuild)("orçamento de comprimento no navegador (build de produção)", () => {
  let servidor: ServidorProducao;
  let navegador: Browser | undefined;

  beforeAll(async () => {
    servidor = await subirServidor("comprimento");
    navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE || undefined });
  }, 120_000);

  afterAll(async () => {
    await navegador?.close();
    await servidor?.parar();
  });

  async function medir(largura: 1440 | 390, rotas: readonly string[], comSessao: boolean, teto: number) {
    const ctx = await navegador!.newContext({ viewport: { width: largura, height: largura === 1440 ? 900 : 844 } });
    if (comSessao) await ctx.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem, httpOnly: true, sameSite: "Lax", secure: false }]);
    const fora: string[] = [];
    try {
      for (const rota of rotas) {
        const page = await ctx.newPage();
        const resp = await page.goto(servidor.origem + rota, { waitUntil: "load", timeout: 60_000 });
        expect(resp?.status(), rota).toBe(200);
        expect(new URL(page.url()).pathname, `${rota} não pode cair no login`).toBe(rota);
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
        // com sessão, mede depois de o navegador resolvê-la, como o orçamento de cromo: a faixa de consulta aberta vem no HTML e só
        // sai então (a espera por rede ociosa pode estourar sob carga)
        await aguardarSessaoResolvida(page, comSessao);
        // e depois de a página assentar no cliente (barra hidratada, frescor calculado): medida antes disso sai abaixo da real
        await aguardarHidratacao(page);
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        const m = await page.evaluate(() => {
          const n = document.querySelector("[data-entrada] [data-numero-escala], [data-mapa-conta] [data-para-voce-pergunta]");
          return { altura: document.documentElement.scrollHeight, numero: n ? Math.round(n.getBoundingClientRect().top + window.scrollY) : null };
        });
        if (m.altura > teto) fora.push(`${rota}: ${m.altura} px (máximo ${teto})`);
        if (largura === 1440 && m.numero !== null && m.numero >= TOPO_PRIMEIRO_NUMERO) fora.push(`${rota}: primeiro número em ${m.numero} px (máximo ${TOPO_PRIMEIRO_NUMERO})`);
        await page.close();
      }
    } finally {
      await ctx.close();
    }
    return fora;
  }

  for (const largura of [1440, 390] as const) {
    it(`${largura} px, com sessão: as ${ENTRADAS.length} entradas no molde cabem em ${ORCAMENTO.entrada[largura]} px`, async () => {
      expect(await medir(largura, ENTRADAS, true, ORCAMENTO.entrada[largura])).toEqual([]);
    }, 300_000);

    it(`${largura} px, com sessão: o mapa da conta cabe em ${ORCAMENTO.mapa[largura]} px`, async () => {
      expect(await medir(largura, ["/app/observatorios"], true, ORCAMENTO.mapa[largura])).toEqual([]);
    }, 120_000);

    it(`${largura} px, sem sessão: o Crédito aberto cabe em ${ORCAMENTO.creditoAberto[largura]} px`, async () => {
      expect(await medir(largura, ["/observatorio-do-credito"], false, ORCAMENTO.creditoAberto[largura])).toEqual([]);
    }, 120_000);
  }
});
