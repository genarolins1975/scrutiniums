/**
 * Frescor das publicações. `credito` é o selo das páginas públicas do Crédito;
 * `regras` é a faixa de frescor por domínio das entradas com conta. Os dois leem
 * limiares.json, o mesmo arquivo da vigília. Este índice é seguro para
 * componentes de cliente: a leitura de disco fica em ./dominios (só servidor).
 */
export * from "./credito";
export * from "./regras";
