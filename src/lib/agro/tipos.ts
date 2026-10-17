export type CadeiaId = 'soja' | 'milho' | 'arroz' | 'feijao' | 'cafe' | 'bovinos' | 'leite';
export type CapituloId = 'producao' | 'custos-renda' | 'alimentos-consumo' | 'credito-protecao' | 'logistica-mercados' | 'empresas-trabalho' | 'clima-ambiente' | 'politicas-inclusao';
export type FonteAgro = {
    id: string;
    nome: string;
    url: string;
    arquivo: string;
    arquivoRepositorio: string;
    commitRepositorio: string;
    sha256Original: string;
    sha256Arquivo: string;
    licenca: string;
    estadoAcesso: string;
    limite: string;
};
export type CreditoUf = {
    id: string;
    sigla: string;
    regiao: string;
    valor: number;
    contratos: number;
    custeio: number;
    investimento: number;
    comercializacao: number;
    industrializacao: number;
};
export type OcupacaoUf = {
    id: string;
    nome: string;
    ano: number;
    pessoas: number | null;
    totalOcupadosComRenda: number | null;
    rendaMedia: number | null;
    rendaMediana: number | null;
};
export type ProducaoAgro = {
    cadeia: CadeiaId;
    territorio: string;
    nome: string;
    ano: number;
    indicador: 'areaPlantada' | 'areaColhida' | 'quantidade' | 'valorProducao' | 'rebanho';
    valor: number | null;
    unidade: string;
    fonte: string;
    estado: 'OBSERVADO' | 'ESTIMATIVA' | 'AUSENTE';
    nota: string;
};
export type SnapshotAgro = {
    versao: string;
    geradoEm: string;
    fontes: FonteAgro[];
    credito: {
        janela: {
            ini: string;
            fim: string;
        };
        capturaOriginal: string;
        nacional: {
            valor: number;
            contratos: number;
            custeio: number;
            investimento: number;
            comercializacao: number;
            industrializacao: number;
        };
        anteriorAdjacente: {
            inicio: string;
            fim: string;
            valor: number | null;
            mesesComDado: number;
            variacaoPct: number | null;
        };
        serie: {
            mes: string;
            valor: number;
            contratos: number;
            parcial: boolean;
            custeio: number;
            investimento: number;
            comercializacao: number;
            industrializacao: number;
        }[];
        ufs: CreditoUf[];
        programas: {
            id: string;
            nome: string;
            valor: number;
            contratos: number;
        }[];
        produtos: {
            nome: string;
            cadeia: CadeiaId | null;
            finalidade: string;
            valor: number;
            contratos: number;
        }[];
        coberturaProdutos: string;
        fonte: string;
    };
    trabalho: {
        formal: {
            periodo: string;
            preliminar: boolean;
            cnae: string;
            nome: string;
            estoque: number;
            saldoMes: number;
            saldo12Meses: number;
            serieSaldos: {
                ref: string;
                v: number;
            }[];
            serieVariacaoAnual: {
                ref: string;
                v: number;
            }[];
            limite: string;
            fonte: string;
        };
        ocupacoes: OcupacaoUf[];
        perfisOcupacao: {
            id: string;
            nome: string;
            sexo: string;
            ano: number;
            pessoas: number | null;
            rendaMedia: number | null;
            rendaMediana: number | null;
        }[];
        grupoOcupacional: string;
        universoOcupacao: string;
        fonteOcupacoes: string;
    };
    alimentos: {
        observacoes: {
            territory: string;
            year: number;
            secure: number;
            insecure: number;
            mild: number;
            moderate: number;
            severe: number;
        }[];
        fonte: string;
        universo: string;
    };
    inflacao: {
        indices: {
            mes: string;
            indice: number;
        }[];
        baseOriginal: string;
        fonte: string;
        limite: string;
    };
    producao: ProducaoAgro[];
    bloqueios: {
        id: string;
        estado: string;
        motivo: string;
    }[];
};
export type CategoriaArtefato = 'DADO OBSERVADO' | 'EXPLICAÇÃO CONCEITUAL' | 'CENÁRIO';
export type ArtefatoAgro = {
    id: string;
    titulo: string;
    requisito: string;
    perguntaEconomicaSocial: string;
    publico: string;
    objetivoAprendizagem: string;
    decisaoComparacao: string;
    formato: string;
    interacao: string;
    fonte: string;
    formulaHipoteses: string;
    granularidade: string;
    rota: string;
    alternativaAcessivel: string;
    testeAceite: string;
    categoria: CategoriaArtefato | null;
    status: string;
    limitacao: string;
};
