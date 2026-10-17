import gzip
import hashlib
import json
import re
import unittest

from pipeline.observatorio_saneamento import controle

CAMPOS = [
    "CNPJ_Companhia", "Data_Referencia", "Versao", "ID_Documento", "Nome_Companhia", "ID_Acionista", "Acionista", "Tipo_Pessoa_Acionista",
    "CPF_CNPJ_Acionista", "ID_Acionista_Relacionado", "Acionista_Relacionado", "Quantidade_Acao_Ordinaria_Circulacao",
    "Percentual_Acao_Ordinaria_Circulacao", "Quantidade_Acao_Preferencial_Circulacao", "Percentual_Acao_Preferencial_Circulacao",
    "Quantidade_Total_Acoes_Circulacao", "Percentual_Total_Acoes_Circulacao", "Residente_Exterior", "Data_Ultima_Alteracao",
    "Acionista_Controlador", "Participante_Acordo_Acionistas",
]


def linha(id_, nome, tipo, pai, on, pn, total, qtd=1, ctrl="N", acordo="N", doc="1"):
    base = {c: "" for c in CAMPOS}
    base.update({
        "CNPJ_Companhia": "11.111.111/0001-11", "ID_Documento": doc, "Nome_Companhia": "CIA TESTE", "ID_Acionista": str(id_),
        "Acionista": nome, "Tipo_Pessoa_Acionista": tipo, "CPF_CNPJ_Acionista": "22.222.222/0001-22" if tipo == "PJ" else ("123.456.789-09" if tipo == "PF" else ""),
        "ID_Acionista_Relacionado": str(pai) if pai else "", "Percentual_Acao_Ordinaria_Circulacao": on, "Percentual_Acao_Preferencial_Circulacao": pn,
        "Percentual_Total_Acoes_Circulacao": total, "Quantidade_Total_Acoes_Circulacao": str(qtd), "Residente_Exterior": "N",
        "Acionista_Controlador": ctrl, "Participante_Acordo_Acionistas": acordo,
    })
    return base


POSICAO = [
    linha(1, "HOLDING SA", "PJ", None, "60", "60", "60", 600, ctrl="S"),
    linha(2, "Maria Controladora", "PF", 1, "50", "50", "50", 500, ctrl="S"),
    linha(3, "João Minoritário", "PF", 1, "30", "30", "30", 300),
    linha(4, "Ana Minoritária", "PF", 1, "20", "20", "20", 200),
    linha(5, "Ações Tesouraria", "", 1, "0", "0", "0", 0),
    linha(6, "FUNDO XPTO", "PJ", None, "39.999", "39.999", "39.999", 399),
    linha(7, "COMPANHIA PAULISTA DE PARCERIAS", "PJ", None, "0.000000", "0.000000", "0.000000", 30),
    linha(8, "Ações Tesouraria", "", None, "0", "0", "0", 0),
    linha(9, "Outros", "", None, "0.001", "0.001", "0.001", 1),
]


class Declarados(unittest.TestCase):
    def test_conta_so_agua_e_esgoto_com_prestacao_existente_e_cnpj_valido(self):
        base = {"Cod_IBGE": 1100023, "Número do CNPJ do prestador de serviços no município": "11.111.111/0001-11",
                "Tipo de serviço prestado": "Abastecimento de Água", "Existe a prestação do serviço no município?": "Sim"}
        r = controle.declarados([
            base,
            dict(base, Cod_IBGE=1100031, **{"Tipo de serviço prestado": "Esgotamento Sanitário"}),
            dict(base, Cod_IBGE=1100049, **{"Tipo de serviço prestado": "Limpeza Urbana e Manejo de Resíduos Sólidos"}),
            dict(base, Cod_IBGE=1100056, **{"Existe a prestação do serviço no município?": "Não"}),
            dict(base, Cod_IBGE=1100064, **{"Número do CNPJ do prestador de serviços no município": "123"}),
        ])
        self.assertEqual(r, {"11111111000111": {"1100023", "1100031"}})


class Arvore(unittest.TestCase):
    def test_pessoa_fisica_sem_controle_entra_somada_e_linha_de_preenchimento_sai(self):
        topo, agregadas, filhos, _ = controle._arvore(POSICAO)
        nomes = [n["nome"] for n in topo]
        self.assertEqual(nomes[0], "HOLDING SA")  # maior participação primeiro
        self.assertEqual(nomes[-1], "Outros")  # residuais por último
        holding = topo[0]
        self.assertEqual([f["nome"] for f in holding["filhos"]], ["Maria Controladora", "2 pessoas físicas não controladoras"])
        soma = holding["filhos"][1]
        self.assertEqual((soma["pct_total"], soma["agregado"], soma["controlador"]), (50.0, 2, False))
        self.assertEqual(agregadas, 2)
        self.assertNotIn("João Minoritário", json.dumps(topo, ensure_ascii=False))

    def test_posicao_minuscula_com_acoes_fica_e_a_vazia_sai(self):
        topo, *_ = controle._arvore(POSICAO)
        nomes = [n["nome"] for n in topo]
        self.assertIn("COMPANHIA PAULISTA DE PARCERIAS", nomes)
        self.assertEqual(nomes.count("Ações Tesouraria"), 0)  # zero ações e zero por cento
        self.assertIn("Outros", nomes)

    def test_nao_publica_cpf_nem_representante(self):
        topo, *_ = controle._arvore(POSICAO)
        texto = json.dumps(topo, ensure_ascii=False)
        self.assertIsNone(re.search(r"\d{3}\.\d{3}\.\d{3}-\d{2}", texto))
        self.assertNotIn("123.456", texto)
        self.assertIn("22.222.222/0001-22", texto)  # CNPJ de pessoa jurídica é publicado

    def test_acionista_relacionado_inexistente_e_ciclo_interrompem(self):
        orfa = POSICAO + [linha(10, "Órfão", "PJ", 99, "1", "1", "1")]
        with self.assertRaisesRegex(ValueError, "inexistente"):
            controle._arvore(orfa)
        ciclo = [linha(1, "A", "PJ", 2, "100", "100", "100"), linha(2, "B", "PJ", 1, "100", "100", "100")]
        with self.assertRaisesRegex(ValueError, "ciclo"):
            controle._arvore(ciclo)


class Conferencia(unittest.TestCase):
    def test_posicoes_diretas_somam_cem_e_cadeia_fecha(self):
        _, _, filhos, _ = controle._arvore(POSICAO)
        r = controle._conferir("11111111000111", POSICAO, filhos)
        self.assertAlmostEqual(r["soma_topo_total"], 100.0, places=3)
        self.assertEqual(r["maior_desvio_cadeia"], 0.0)

    def test_soma_direta_diferente_de_cem_interrompe(self):
        ruim = [dict(l) for l in POSICAO]
        ruim[0]["Percentual_Total_Acoes_Circulacao"] = "55"
        _, _, filhos, _ = controle._arvore(ruim)
        with self.assertRaisesRegex(ValueError, "posições diretas"):
            controle._conferir("11111111000111", ruim, filhos)

    def test_cadeia_que_nao_fecha_interrompe(self):
        ruim = [dict(l) for l in POSICAO]
        ruim[1]["Percentual_Total_Acoes_Circulacao"] = "40"
        _, _, filhos, _ = controle._arvore(ruim)
        with self.assertRaisesRegex(ValueError, "acionistas de um acionista"):
            controle._conferir("11111111000111", ruim, filhos)


class FichaDoPrestador(unittest.TestCase):
    def test_exige_cobertura_e_nao_escolhe_em_empate(self):
        decl = {"1", "2", "3", "4", "5"}
        p = lambda id_, mun: {"id": id_, "municipios_agua": mun, "municipios_esgoto": []}  # noqa: E731
        self.assertEqual(controle._ficha(decl, [p("a", ["1", "2", "3", "4", "5", "6"]), p("b", ["1"])]), ("a", 1.0))
        self.assertEqual(controle._ficha(decl, [p("a", ["1", "2", "3"])]), (None, None))  # 60% < 80%
        self.assertEqual(controle._ficha(decl, [p("a", ["1", "2", "3", "4", "5"]), p("b", ["1", "2", "3", "4", "5"])]), (None, None))
        self.assertEqual(controle._ficha(decl, [p("a", ["1", "2", "3", "4"]), p("b", ["1", "2", "3", "4", "5"])]), ("b", 1.0))


class SeedPublicado(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifesto = json.loads((controle.SEED / "manifesto.json").read_text(encoding="utf-8"))
        gold = controle.AQUI.parent.parent / "public" / "saneamento" / "gold"
        cls.prestadores = json.loads((gold / "prestadores.json").read_text(encoding="utf-8"))
        cls.controle, cls.meta = controle.construir(controle.declarados_do_seed(), cls.prestadores)

    def test_arquivos_do_seed_conferem_com_o_manifesto(self):
        for a in self.manifesto["arquivos"].values():
            bruto = gzip.decompress((controle.SEED / a["arquivo"]).read_bytes())
            self.assertEqual(hashlib.sha256(bruto).hexdigest(), a["sha256"], a["arquivo"])
            self.assertEqual(len(bruto), a["bytes"])
        self.assertRegex(self.manifesto["zip"]["sha256"], r"^[a-f0-9]{64}$")
        self.assertEqual(self.manifesto["ano"], controle.ANO)

    def test_toda_companhia_do_filtro_esta_declarada_no_sinisa_e_tem_ficha(self):
        decl = controle.declarados_do_seed()
        self.assertEqual(set(self.manifesto["filtro"]["cnpjs"]) - set(decl), set())
        self.assertEqual(len(self.controle["companhias"]), len(self.manifesto["filtro"]["cnpjs"]))
        self.assertEqual(self.meta["sem_posicao"], [])
        ids = {p["id"] for p in self.prestadores}
        usados = [c["prestador"] for c in self.controle["companhias"] if c["prestador"]]
        self.assertEqual(len(usados), len(set(usados)), "uma ficha por companhia")
        for c in self.controle["companhias"]:
            self.assertIn(c["prestador"], ids, c["cnpj"])
            self.assertGreaterEqual(c["cobertura_municipios_ficha"], controle.LIMIAR_FICHA, c["cnpj"])

    def test_documento_usado_e_a_ultima_versao_do_indice(self):
        _, docs, _ = controle.ler_seed()
        for c in self.controle["companhias"]:
            versoes = [int(d["VERSAO"]) for d in docs if controle.cnpj14(d["CNPJ_CIA"]) == controle.cnpj14(c["cnpj"])]
            self.assertEqual(c["documento"]["versao"], max(versoes), c["cnpj"])

    def test_seed_sem_cpf_com_so_as_colunas_usadas_e_sem_nome_de_pessoa_fisica_nao_controladora(self):
        bruto = gzip.decompress((controle.SEED / self.manifesto["arquivos"]["posicao_acionaria"]["arquivo"]).read_bytes()).decode("utf-8")
        self.assertIsNone(controle.CPF.search(bruto))
        cabecalho = bruto.splitlines()[0].split(";")
        self.assertEqual(cabecalho, controle.COLUNAS_POSICAO)
        for c in ("Representante_Legal", "CPF_CNPJ_Representante_legal", "Nacionalidade", "Sigla_UF"):
            self.assertNotIn(c, cabecalho)
        _, _, pos = controle.ler_seed()
        for l in pos:
            if l["Tipo_Pessoa_Acionista"] == "PF":
                self.assertEqual(l["CPF_CNPJ_Acionista"], "")
                if l["Acionista_Controlador"] != "S" and l["Participante_Acordo_Acionistas"] != "S":
                    self.assertEqual(l["Acionista"], "Pessoa física")

    def test_reduzir_tira_cpf_e_o_nome_de_pessoa_fisica_comum_e_ler_seed_recusa_cpf(self):
        comum = controle.reduzir(linha(1, "João Minoritário", "PF", None, "10", "10", "10"))
        self.assertEqual((comum["Acionista"], comum["CPF_CNPJ_Acionista"]), ("Pessoa física", ""))
        ctrl = controle.reduzir(linha(2, "Maria Controladora", "PF", None, "10", "10", "10", ctrl="S"))
        self.assertEqual((ctrl["Acionista"], ctrl["CPF_CNPJ_Acionista"]), ("Maria Controladora", ""))
        acordo = controle.reduzir(linha(3, "Ana Em Acordo", "PF", None, "10", "10", "10", acordo="S"))
        self.assertEqual(acordo["Acionista"], "Ana Em Acordo")
        pj = controle.reduzir(linha(4, "FUNDO XPTO", "PJ", None, "10", "10", "10"))
        self.assertEqual(pj["CPF_CNPJ_Acionista"], "22.222.222/0001-22")  # CNPJ de pessoa jurídica fica
        self.assertEqual(list(pj), controle.COLUNAS_POSICAO)
        self.assertIsNotNone(controle.CPF.search("123.456.789-09"))
        self.assertIsNotNone(controle.CPF.search("12345678909"))

    def test_nenhum_cpf_na_gold(self):
        texto = json.dumps(self.controle, ensure_ascii=False)
        self.assertIsNone(re.search(r"\d{3}\.\d{3}\.\d{3}-\d{2}", texto))
        self.assertIsNone(re.search(r"(?<!\d)\d{11}(?!\d)", texto))
        cab, linhas = controle.linhas_csv(self.controle)
        self.assertEqual(len(cab), len(linhas[0]))
        self.assertIsNone(re.search(r"\d{3}\.\d{3}\.\d{3}-\d{2}", json.dumps(linhas, ensure_ascii=False)))

    def test_conferencias_dentro_da_tolerancia(self):
        self.assertEqual(len(self.meta["conferencias"]), len(self.controle["companhias"]))
        for c in self.meta["conferencias"]:
            self.assertLessEqual(abs(c["soma_topo_total"] - 100), controle.TOLERANCIA_PCT, c["cnpj"])
            self.assertLessEqual(c["maior_desvio_cadeia"], controle.TOLERANCIA_PCT, c["cnpj"])


if __name__ == "__main__":
    unittest.main()
