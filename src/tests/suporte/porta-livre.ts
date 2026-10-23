import { createServer } from "node:net";

/**
 * Porta TCP livre em 127.0.0.1, pedida ao sistema.
 *
 * O Vite trata `server.port: 0` como "não informado" e usa 5173 (`!configPort` em startServer). Os auxiliares de navegador
 * pediam porta 0 com strictPort e recebiam sempre 5173: quando dois desses arquivos rodavam ao mesmo tempo, um caía com
 * "Port 5173 is already in use" (visto em 22/10/2026 ao pôr os testes pesados primeiro com seis workers). A porta vem do
 * sistema e o servidor sobe nela, ainda com strictPort.
 */
export function portaLivre(): Promise<number> {
  return new Promise((resolver, rejeitar) => {
    const servidor = createServer();
    servidor.unref();
    servidor.on("error", rejeitar);
    servidor.listen(0, "127.0.0.1", () => {
      const endereco = servidor.address();
      const porta = typeof endereco === "object" && endereco ? endereco.port : 0;
      servidor.close(() => (porta ? resolver(porta) : rejeitar(new Error("O sistema não devolveu uma porta livre."))));
    });
  });
}
