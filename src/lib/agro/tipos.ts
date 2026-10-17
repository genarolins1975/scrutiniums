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
    capturadoEm?: string;
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
    economia: EconomiaAgro | null;
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

export type SetoresAgro = { agro: number; industria: number; servicos: number; va: number; pib: number };
export type TaxaAgro = { periodo: string; agro: number | null; industria: number | null; servicos: number | null; pib: number | null };
export type ComercioAno = { ano: number; meses: number; fob: number; kg: number; valorUnitario: number | null };
export type PaisesAgro = { ano: number; fob: number; kg: number; paises: { pais: string; fob: number; kg: number; participacao: number }[] };
export type EconomiaAgro = {
    pib: {
        unidade: string;
        trimestres: ({ periodo: string } & SetoresAgro)[];
        anual: ({ ano: number; participacaoVa: number; participacaoPib: number } & SetoresAgro)[];
        ultimos4: { inicio: string; fim: string; agro: number; va: number; pib: number; participacaoVa: number; participacaoPib: number };
        crescimento: { trimestral: TaxaAgro[]; acumulado4: TaxaAgro[]; acumuladoAno: TaxaAgro[]; anual: (Omit<TaxaAgro, 'periodo'> & { ano: number })[] };
        fonte: string;
    };
    safra: {
        mesReferencia: string;
        anoSafra: number;
        unidades: { producao: string; area: string; rendimento: string };
        produtos: { id: string; nome: string; somaDeSafras?: string[]; anos: { ano: number; mesEstimativa: string; producao: number | null; area: number | null; rendimento: number | null }[] }[];
        fonte: string;
    };
    comercio: {
        atualizadoNaFonte: string;
        ultimoMes: string;
        anoCompleto: number;
        capitulosAgro: string[];
        definicaoAgro: string;
        exportacoes: {
            anual: { ano: number; total: number; agro: number; agroKg: number; participacao: number }[];
            composicao: { capitulo: string; nome: string; fob: number; kg: number }[];
            mensal: { mes: string; total: number; agro: number }[];
            acumulado: { ano: number; meses: number; agro: number; agroAnterior: number; total: number; totalAnterior: number; variacaoAgro: number | null; participacao: number | null };
            destinos: PaisesAgro;
        };
        soja: { ncm: string; anual: ComercioAno[]; destinos: PaisesAgro };
        insumos: {
            fertilizantes: ComercioAno[];
            defensivos: ComercioAno[];
            posicoes: { posicao: string; nome: string; anos: ComercioAno[] }[];
            origensFertilizantes: PaisesAgro;
            mesmoPeriodo: { soja: ComercioAno[]; fertilizantes: ComercioAno[]; defensivos: ComercioAno[]; relacao: (number | null)[] };
        };
        relacaoTroca: { ano: number; meses: number; soja: number | null; fertilizantes: number | null; relacao: number | null }[];
        fonte: string;
    };
    produtores: {
        ano: number;
        tipologia: Record<'total' | 'familiar' | 'naoFamiliar', { estabelecimentos: number; area: number; pessoal: number; comProducao: number; valorProducao: number }>;
        gruposArea: { id: string; nome: string; estabelecimentos: number | null; area: number | null; familiar: number | null }[];
        fonte: string;
    };
    trabalho: {
        trimestres: { periodo: string; ocupadosTotal: number | null; ocupadosAgro: number | null; rendimentoTotal: number | null; rendimentoAgro: number | null; participacao: number | null; razaoRendimento: number | null }[];
        fonte: string;
    };
    prato: {
        ultimoMes: string;
        meses: { mes: string; geral: number | null; alimentacaoBebidas: number | null; domicilio: number | null; fora: number | null }[];
        itens: { id: string; nome: string; doze: number | null; peso: number | null }[];
        fonte: string;
    };
    apoio: {
        juros: {
            ultimoMes: string;
            meses: ({ mes: string; valor: number; contratos: number; coberturaTaxa: number; selic: number | null } & Record<'geral' | 'pronaf' | 'pronamp' | 'demais' | 'equalizada' | 'controlada' | 'livre', number | null> & Record<'valor_equalizada' | 'valor_controlada' | 'valor_livre', number>)[];
            fonte: string;
        };
        pagamentos: { acoes: Record<string, string>; anos: { ano: number; total: number; acoes: Record<string, number> }[]; ultimoMesPagamento: string; atualizadoNaFonte: string | null; fonte: string };
    };
    ambiente: {
        prodes: { atualizado: string; anoPreliminar: number; taxaAmazoniaLegal: { inicio: number; fim: number; km2: number; estimada: boolean }[]; biomas: { id: string; nome: string; periodos: { inicio: number; fim: number; km2: number; anual: boolean; parcial: boolean }[] }[]; fonte: string };
        emissoes: { versao: string | null; unidade: string; anos: { ano: number; agropecuaria: number; mudancaUsoTerra: number; mudancaUsoTerraRemocao: number | null }[]; fonte: string };
        usoTerra: { url: string; unidade: string; anos: { ano: number; pastagem: number; agricultura: number; silvicultura: number; mosaico: number; vegetacaoNativa: number; total: number; agropecuaria: number }[]; fonte: string };
    };
};
