/** Modelos didáticos próprios. Valores de entrada são hipóteses, nunca séries observadas. */
const finitos = (xs: number[]) => xs.every(Number.isFinite);
const fracao = (x: number) => x >= 0 && x <= 1;

export type GeradorRisco = {
  energiaGWh: number; recurso: number; corte: number; preco: number; captura: number;
  hedge: number; contrato: number; estrutura: "fixo" | "producao";
  opexMilhoes: number; outrosMilhoes: number; dividaMilhoes: number;
};
export const GERADOR_BASE: GeradorRisco = {
  energiaGWh: 400, recurso: 1, corte: .05, preco: 200, captura: .8,
  hedge: .7, contrato: 230, estrutura: "fixo", opexMilhoes: 20, outrosMilhoes: 5, dividaMilhoes: 30,
};
export const CHOQUES_GERADOR = [
  { id: "base", nome: "Referência hipotética", recurso: 1, corte: .05, preco: 200, captura: .8, explicacao: "Produção disponível de referência, com 5% de corte e preço capturado abaixo da média de mercado." },
  { id: "excedente", nome: "Excedente e congestionamento", recurso: 1.1, corte: .25, preco: 100, captura: .55, explicacao: "Mais recurso natural coincide com rede limitada, cortes maiores e menor preço nas horas de geração." },
  { id: "escassez", nome: "Escassez com baixa produção", recurso: .55, corte: .02, preco: 500, captura: .95, explicacao: "Menos produção coincide com preços altos. A obrigação de volume fixo pode superar a energia disponível." },
] as const;

/** Hedge plano anual: Q0*h*(K-P). Pay-as-produced: h*G*(K-Pcapt).
 * A representação financeira é uma identidade agregada, não a contabilização CCEE. */
export function riscoGerador(v: GeradorRisco) {
  if (!finitos([v.energiaGWh,v.recurso,v.corte,v.preco,v.captura,v.hedge,v.contrato,v.opexMilhoes,v.outrosMilhoes,v.dividaMilhoes]) ||
    v.energiaGWh <= 0 || v.recurso < 0 || !fracao(v.corte) || !fracao(v.hedge) || v.preco < 0 || v.captura < 0 || v.contrato < 0 ||
    v.opexMilhoes < 0 || v.outrosMilhoes < 0 || v.dividaMilhoes < 0 || !["fixo","producao"].includes(v.estrutura)) return null;
  const potencialMWh = v.energiaGWh * 1000 * v.recurso;
  const geracaoMWh = potencialMWh * (1-v.corte);
  const precoCapturado = v.preco * v.captura;
  const contratadoMWh = (v.estrutura === "fixo" ? v.energiaGWh * 1000 : geracaoMWh) * v.hedge;
  const mercado = geracaoMWh * precoCapturado;
  const ajuste = contratadoMWh * (v.contrato - (v.estrutura === "fixo" ? v.preco : precoCapturado));
  const receita = mercado + ajuste;
  const cfads = receita - (v.opexMilhoes+v.outrosMilhoes)*1e6;
  const servico = v.dividaMilhoes*1e6;
  return { potencialMWh, geracaoMWh, cortadoMWh: potencialMWh-geracaoMWh, precoCapturado, contratadoMWh,
    mercado, ajuste, receita, cfads, servico, dscr: servico > 0 ? cfads/servico : null,
    aposDivida: cfads-servico, deficitVolumeMWh: Math.max(0,contratadoMWh-geracaoMWh),
    sensibilidadePreco: v.estrutura === "fixo" ? geracaoMWh*v.captura-contratadoMWh : geracaoMWh*(1-v.hedge)*v.captura };
}

export type BateriaRisco = { mw: number; mwh: number; eficiencia: number; ciclos: number; disponibilidade: number;
  compra: number; venda: number; degradacao: number; capexMilhoes: number; opexMilhoes: number;
  variavelMWh: number; anos: number; desconto: number; };
export const BATERIA_BASE: BateriaRisco = { mw:50,mwh:200,eficiencia:.85,ciclos:300,disponibilidade:.95,compra:100,venda:300,
  degradacao:.02,capexMilhoes:180,opexMilhoes:3,variavelMWh:10,anos:15,desconto:.1 };
export function riscoBateria(v: BateriaRisco) {
  if (!finitos(Object.values(v)) || v.mw<=0 || v.mwh<=0 || v.eficiencia<=0 || v.eficiencia>1 || v.ciclos<0 ||
    !fracao(v.disponibilidade) || !fracao(v.degradacao) || v.compra<0 || v.venda<0 || v.capexMilhoes<0 || v.opexMilhoes<0 ||
    v.variavelMWh<0 || !Number.isInteger(v.anos) || v.anos<1 || v.anos>40 || v.desconto<0 || v.desconto>1) return null;
  const capex = v.capexMilhoes*1e6;
  // Mesma potência AC para carregar e descarregar, sem simultaneidade. Horas úteis limitam ciclos.
  const horasPorCiclo = v.mwh/v.mw + v.mwh/v.eficiencia/v.mw;
  const tetoCiclos = 8760/horasPorCiclo;
  const ciclosEfetivos = Math.min(v.ciclos,tetoCiclos)*v.disponibilidade;
  const anos = Array.from({length:v.anos},(_,i) => {
    const ano=i+1, capacidade=v.mwh*Math.pow(1-v.degradacao,i);
    const saida=capacidade*ciclosEfetivos, entrada=saida/v.eficiencia;
    const receita=saida*v.venda, compra=entrada*v.compra, variavel=saida*v.variavelMWh;
    const caixa=receita-compra-variavel-v.opexMilhoes*1e6;
    const fator=1/Math.pow(1+v.desconto,ano);
    return {ano,capacidade,saida,entrada,receita,compra,variavel,caixa,fator,presente:caixa*fator};
  });
  const saidaVP=anos.reduce((s,a)=>s+a.saida*a.fator,0);
  const custosVP=capex+anos.reduce((s,a)=>s+(a.compra+a.variavel+v.opexMilhoes*1e6)*a.fator,0);
  const vpl=-capex+anos.reduce((s,a)=>s+a.presente,0);
  return {anos,vpl,ciclosEfetivos,tetoCiclos,limitado:v.ciclos>tetoCiclos,duracao:v.mwh/v.mw,
    entradaCiclo:v.mwh/v.eficiencia,perdasCiclo:v.mwh/v.eficiencia-v.mwh,
    margemCiclo:v.mwh*(v.venda-v.compra/v.eficiencia),
    equilibrioEnergia:v.compra/v.eficiencia,
    equilibrioCompleto:saidaVP>0?custosVP/saidaVP:null};
}

export type InterrupcaoRisco = { probabilidade: number; danoMilhoes: number; dias: number; margemDiaMilhoes: number;
  franquiaMilhoes: number; limiteMilhoes: number; esperaDias: number; cobreInterrupcao: boolean; reducao: number; };
export const INTERRUPCAO_BASE: InterrupcaoRisco = {probabilidade:.05,danoMilhoes:20,dias:10,margemDiaMilhoes:.5,
  franquiaMilhoes:2,limiteMilhoes:15,esperaDias:3,cobreInterrupcao:true,reducao:.5};
/** Um único evento binário por ano; seguro estilizado com limite compartilhado. Não é modelo de catástrofe. */
export function riscoInterrupcao(v: InterrupcaoRisco) {
  if (!finitos([v.probabilidade,v.danoMilhoes,v.dias,v.margemDiaMilhoes,v.franquiaMilhoes,v.limiteMilhoes,v.esperaDias,v.reducao]) ||
    !fracao(v.probabilidade) || !fracao(v.reducao) || [v.danoMilhoes,v.dias,v.margemDiaMilhoes,v.franquiaMilhoes,v.limiteMilhoes,v.esperaDias].some(x=>x<0)) return null;
  const evento = (dano:number,dias:number) => {
    const interrupcao=dias*v.margemDiaMilhoes;
    const danoElegivel=Math.max(0,dano-v.franquiaMilhoes);
    const biElegivel=v.cobreInterrupcao?Math.max(0,dias-v.esperaDias)*v.margemDiaMilhoes:0;
    const indenizacao=Math.min(v.limiteMilhoes,danoElegivel+biElegivel);
    const bruto=dano+interrupcao, retido=bruto-indenizacao;
    return {dano,dias,interrupcao,indenizacao,bruto,retido,anualEsperada:retido*v.probabilidade};
  };
  const antes=evento(v.danoMilhoes,v.dias);
  const depois=evento(v.danoMilhoes*(1-v.reducao),v.dias*(1-v.reducao));
  return {antes,depois,economiaAnual:antes.anualEsperada-depois.anualEsperada};
}

export type DemandaRisco = { ti:number; uso:number; pue:number; picoUso:number; conexao:number;
  flex:number; horasEvento:number; eventos:number; recuperacaoHoras:number; atrasoMeses:number; };
export const DEMANDA_BASE: DemandaRisco = {ti:100,uso:.8,pue:1.3,picoUso:1,conexao:120,flex:.2,horasEvento:4,eventos:20,recuperacaoHoras:8,atrasoMeses:3};
export function riscoDemanda(v: DemandaRisco) {
  if (!finitos(Object.values(v)) || v.ti<=0 || !fracao(v.uso) || !fracao(v.picoUso) || v.picoUso<v.uso || v.pue<1 ||
    v.conexao<0 || !fracao(v.flex) || v.horasEvento<0 || v.eventos<0 || v.recuperacaoHoras<=0 || v.atrasoMeses<0 || v.atrasoMeses>12) return null;
  const media=v.ti*v.uso*v.pue, pico=v.ti*v.picoUso*v.pue;
  const reducaoMW=pico*v.flex, deslocadaMWh=reducaoMW*v.horasEvento;
  const reboteMW=deslocadaMWh/v.recuperacaoHoras;
  const horasAno=v.eventos*v.horasEvento;
  return {media,pico,gwhAno:media*8760/1000,gwhTI:v.ti*v.uso*8760/1000,
    gwhPrimeiroAno:media*8760/1000*(1-v.atrasoMeses/12),
    picoFlex:pico-reducaoMW,reducaoMW,deslocadaMWh,reboteMW,recuperacaoMW:media+reboteMW,
    folgaMW:v.conexao-pico,horasAno,deslocadaAnoGWh:deslocadaMWh*v.eventos/1000,
    agendaPossivel:v.eventos*(v.horasEvento+v.recuperacaoHoras)<=8760};
}

/** Captura usa energia; média de preço usa horas. Denominadores inválidos permanecem ausentes. */
export function precoCapturado(blocos: readonly { horas:number; mwh:number; preco:number }[]) {
  if (!blocos.length || blocos.some(b=>!finitos([b.horas,b.mwh,b.preco]) || b.horas<=0 || b.mwh<0)) return null;
  const energia=blocos.reduce((s,b)=>s+b.mwh,0), horas=blocos.reduce((s,b)=>s+b.horas,0);
  const media=blocos.reduce((s,b)=>s+b.preco*b.horas,0)/horas;
  const captura=energia>0?blocos.reduce((s,b)=>s+b.preco*b.mwh,0)/energia:null;
  return {energia,media,captura,fator:media>0&&captura!==null?captura/media:null};
}
