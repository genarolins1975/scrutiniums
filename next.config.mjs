/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Drivers de banco fora do bundle do servidor: o PGlite carrega assets
    // (WASM) em tempo de execução e o pg usa require dinâmico.
    serverComponentsExternalPackages: ["@electric-sql/pglite", "pg"],
  },
  async rewrites() {
    // Observatório embutido: a SPA estática em public/obs responde por
    // qualquer rota sob /observatorio (roteamento interno via History API).
    return [
      { source: "/observatorio", destination: "/obs/index.html" },
      { source: "/observatorio/:path*", destination: "/obs/index.html" },
    ];
  },
};

export default nextConfig;
