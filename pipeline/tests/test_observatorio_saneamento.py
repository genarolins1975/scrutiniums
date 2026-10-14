import os
import unittest

from pipeline.observatorio_saneamento import gold


class ObservatorioSaneamento(unittest.TestCase):
    """A gold publicada é reproduzível a partir do seed e as conferências fecham."""

    @classmethod
    def setUpClass(cls):
        cls.g = gold.construir()
        cls.arqs = gold.arquivos(cls.g)

    def test_gold_reproduzivel_byte_a_byte(self):
        for nome, b in self.arqs.items():
            caminho = os.path.join(gold.DESTINO, nome)
            with open(caminho, "rb") as f:
                self.assertEqual(f.read(), b, nome)

    def test_conferencias_fecham(self):
        conf = {c["id"]: c["valores"] for c in self.g["meta"]["conferencias"]}
        esg = conf["esgoto_populacao_universos"]
        self.assertEqual(esg["soma"], esg["dfe0001_consolidado_brasil"])
        self.assertEqual(esg["dfe0001_municipios_com_indicadores"] + esg["dfe0001_municipios_delegacao_sem_atendimento"], esg["soma"])
        for c in self.g["meta"]["conferencias"]:
            if "diferenca" in c["valores"]:
                self.assertEqual(c["valores"]["diferenca"], 0, c["id"])

    def test_investimento_dos_prestadores_reproduz_o_consolidado(self):
        br = next(a for a in self.g["agregados"] if a["id"] == "BR")
        for campo, servico in (("investimento_agua", "agua"), ("investimento_esgoto", "esgoto")):
            soma = gold.soma_parcial([p[campo] for p in self.g["prestadores"]])
            self.assertAlmostEqual(soma, br["sinisa"][servico]["investimento"]["total"], places=2, msg=campo)

    def test_cobertura(self):
        cob = self.g["meta"]["cobertura"]
        self.assertEqual(cob["municipios_ibge"], 5571)
        self.assertEqual(cob["municipios_censo_2022"], 5570)
        self.assertEqual(cob["agua_participantes"], 5144)
        self.assertEqual(cob["esgoto_participantes"], 2749)
        self.assertEqual(cob["esgoto_delegacao_sem_atendimento"], 1154)

    def test_ausencia_nao_vira_zero(self):
        fora = [m for m in self.g["municipios"] if m["s_ag"] == "nao_participou"]
        self.assertTrue(fora)
        for m in fora:
            self.assertIsNone(m["IAG0001"], m["id"])
            self.assertIsNone(m["ag_pop_at"], m["id"])

    def test_desigualdades_hashes_e_totais_oficiais(self):
        from pipeline.observatorio_saneamento.desigualdades import construir, SPECS, numero
        d = construir()  # valida cada SHA-256, classificação, chave e limite de universo
        self.assertEqual(len(SPECS), 14)
        self.assertEqual(d["territorios"]["1:1"]["parda-esgoto"], [28509481, 91613309])
        self.assertEqual(d["territorios"]["1:1"]["quilombolas-esgoto"], [936282, 1327483])
        self.assertEqual(numero("-"), 0)
        for v in ("X", "..", "...", ""):
            self.assertIsNone(numero(v))
        with self.assertRaises(ValueError):
            numero("erro da API")

    def test_desigualdades_divergencias_sao_publicadas_sem_redistribuir(self):
        conf = self.g["meta"]["desigualdades"]["conferencias"]
        divergencias = {(c["id"], c["nivel"], c["campo"]): c["diferenca"] for c in conf if c["diferenca"]}
        self.assertEqual(divergencias, {
            ("favelas-agua", 6, "numerador"): -259,
            ("favelas-esgoto", 6, "numerador"): -679,
            ("favelas-esgoto", 6, "denominador"): -819,
        })
        self.assertEqual(self.g["meta"]["desigualdades"]["residuos_cor_raca"], {"universo": 7164, "agua": 596, "esgoto": 1276})
        for c in conf:
            if c["diferenca"]:
                self.assertEqual(c["ausentes"], 3)
        br = next(a for a in self.g["agregados"] if a["id"] == "BR")
        self.assertEqual(br["desigualdades"]["favelas-esgoto"], [4360958, 16349896])
        self.assertEqual(sum(m["des_favelas-esgoto_num"] is not None and (m["des_favelas-esgoto_den"] or 0) > 0 for m in self.g["municipios"]), 652)

    def test_desigualdades_catalogo_e_regioes(self):
        import json
        from pathlib import Path
        from pipeline.observatorio_saneamento.desigualdades import SPECS
        catalogo = json.loads((Path(gold.__file__).resolve().parents[2] / "src/lib/saneamento/dados/desigualdades.json").read_text())
        self.assertEqual(catalogo, [{k: s[k] for k in ["id", "grupo", "rotulo", "medida", "tabela", "unidade", "universo"]} for s in SPECS])
        for a in self.g["agregados"]:
            self.assertEqual(len(a["desigualdades"]), 14, a["id"])
        self.assertEqual(next(s for s in SPECS if s["id"] == "favelas-agua")["unidade"], "domicílios")
        self.assertEqual(next(s for s in SPECS if s["id"] == "favelas-esgoto")["unidade"], "moradores")

    def test_sisagua_registro_e_ausencia(self):
        sis = self.g["meta"]["sisagua"]
        a24 = sis["por_ano"]["2024"]
        self.assertEqual(a24["municipios"], {"universo": 5571, "controle": 4563, "vigilancia": 5071, "ambos": 4351, "nenhum": 288})
        self.assertEqual(sis["por_ano"]["2025"]["municipios"]["nenhum"], 219)
        for ano in ("2024", "2025"):
            self.assertEqual(sis["por_ano"][ano]["codigos_fora_do_universo"], {"controle": [], "plano": [], "vigilancia": []})
        # sem registro de controle: nenhuma medida de controle, nunca zero
        sem = [m for m in self.g["municipios"] if m["qa_reg_ctrl_2024"] == 0]
        self.assertEqual(len(sem), 5571 - 4563)
        for m in sem:
            for mid in ("ctrl_ecoli", "ctrl_colif", "ctrl_cloro", "ctrl_turb"):
                self.assertIsNone(m[f"qa_{mid}_2024_num"], m["id"])
                self.assertIsNone(m[f"qa_{mid}_2024_den"], m["id"])
        # numerador nunca passa o denominador; denominador nunca é zero
        for m in self.g["municipios"]:
            for c in sisagua_campos_num():
                n, d = m[c], m[c[:-4] + "_den"]
                self.assertEqual(n is None, d is None, c)
                if d is not None:
                    self.assertTrue(0 <= n <= d and d > 0, (m["id"], c))
        # DF: Regiões Administrativas agregadas em Brasília
        df = next(m for m in self.g["municipios"] if m["id"] == "5300108")
        self.assertEqual(df["qa_reg_ctrl_2024"], 1)
        self.assertGreater(a24["exclusoes"]["vigilancia"]["linhas_ra_df"], 0)

    def test_sisagua_conferencia_publicada_sem_ajuste(self):
        conf = {c["parametro"]: c for c in self.g["meta"]["sisagua"]["por_ano"]["2024"]["conferencia_fora_padrao"]}
        self.assertEqual(conf["ecoli"]["controle_mensal"], 3929)
        self.assertEqual(conf["ecoli"]["arquivo_fora_do_padrao"], 964)
        self.assertEqual(conf["ecoli"]["diferenca"], 964 - 3929)
        plano = self.g["meta"]["sisagua"]["por_ano"]["2024"]["plano"]
        self.assertEqual((plano["cobertas"], plano["exigidas"]), (1145079, 1961604))
        self.assertLessEqual(plano["cobertas"], plano["realizadas"])

    def test_sisagua_seed_adulterada_falha(self):
        import gzip
        import json
        import tempfile
        from pipeline.observatorio_saneamento import sisagua
        with tempfile.TemporaryDirectory() as d:
            original = sisagua.SEED
            try:
                for n in os.listdir(original):
                    with open(os.path.join(original, n), "rb") as f, open(os.path.join(d, n), "wb") as g:
                        g.write(f.read())
                with gzip.open(os.path.join(d, "sisagua_2024.json.gz"), "rb") as f:
                    dados = json.loads(f.read())
                dados["controle"]["355030"]["ecoli"][0] += 1
                with gzip.open(os.path.join(d, "sisagua_2024.json.gz"), "wb") as f:
                    f.write(json.dumps(dados, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode())
                sisagua.SEED = d
                with self.assertRaisesRegex(ValueError, "SHA-256"):
                    sisagua.construir(["355030"])
            finally:
                sisagua.SEED = original


def sisagua_campos_num():
    from pipeline.observatorio_saneamento import sisagua
    return [c for c in sisagua.campos() if c.endswith("_num")]


def _zip(pasta, nome, cabecalho, linhas):
    import csv
    import io
    import zipfile
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", lineterminator="\r\n")
    w.writerow(cabecalho)
    for l in linhas:
        w.writerow(l)
    caminho = os.path.join(pasta, nome)
    with zipfile.ZipFile(caminho, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(nome.replace("_csv.zip", ".csv"), buf.getvalue().encode("latin-1"))
    return caminho


class Sisagua(unittest.TestCase):
    """Agregação em fluxo com um ZIP sintético que reproduz as armadilhas dos arquivos reais."""

    def setUp(self):
        import tempfile
        from pipeline.observatorio_saneamento import sisagua as s
        self.s = s
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)

    def controle(self, linhas):
        s = self.s
        def l(mun, forma, tipo, mes, ponto, par, campo, valor):
            r = [""] * len(s.CAB_CONTROLE)
            I = {c: i for i, c in enumerate(s.CAB_CONTROLE)}
            r[I["Código IBGE"]], r[I["Código Forma de abastecimento"]], r[I["Tipo da Forma de Abastecimento"]] = mun, forma, tipo
            r[I["Ano de referência"]], r[I["Mês de referência"]], r[I["Ponto de Monitoramento"]] = "2024", str(mes), ponto
            r[I["Parâmetro"]], r[I["Campo"]], r[I["Valor"]] = par, campo, valor
            return r
        return _zip(self.dir.name, "controle_mensal_parametros_basicos_2024_csv.zip", s.CAB_CONTROLE, [l(*x) for x in linhas])

    def test_controle_regras(self):
        D, C = "SISTEMA DE DISTRIBUIÇÃO", "PONTO DE CONSUMO"
        z = self.controle([
            # E. coli válido, com contagem "12,0" (inteiro com vírgula)
            ("355030", "S1", "SAA", 1, D, "Escherichia coli", "Número de amostras analisadas", "12,0"),
            ("355030", "S1", "SAA", 1, D, "Escherichia coli", "N de amostras com presença para Escherichia coli", "1"),
            ("355030", "S1", "SAA", 1, D, "Escherichia coli", "N de amostras com ausência para Escherichia coli", "11"),
            # contagem fracionária: grupo inteiro fica fora
            ("355030", "S1", "SAA", 2, D, "Escherichia coli", "Número de amostras analisadas", "0,01"),
            ("355030", "S1", "SAA", 2, D, "Escherichia coli", "N de amostras com presença para Escherichia coli", "0"),
            # turbidez com rótulo de grafia diferente (ponto decimal, espaços)
            ("355030", "C9", "SAC", 1, C, "Turbidez (uT)", "Número de amostras analisadas", "4"),
            ("355030", "C9", "SAC", 1, C, "Turbidez (uT)", "Número de dados >  5.0 uT", "1"),
            # saída do tratamento não entra na medida da rede
            ("355030", "S1", "SAA", 1, "SAÍDA DO TRATAMENTO", "Escherichia coli", "Número de amostras analisadas", "30"),
            # Região Administrativa do DF e o mesmo sistema em duas RAs: grupos separados, somados em 530010
            ("530033", "S5", "SAA", 1, D, "Coliformes totais", "Número de amostras analisadas", "5"),
            ("530033", "S5", "SAA", 1, D, "Coliformes totais", "N de amostras com presença de coliformes totais", "1"),
            ("530034", "S5", "SAA", 1, D, "Coliformes totais", "Número de amostras analisadas", "7"),
            ("530034", "S5", "SAA", 1, D, "Coliformes totais", "N de amostras com presença de coliformes totais", "0"),
            # inconsistente: presença + ausência diferente do total
            ("110001", "S7", "SAA", 1, D, "Coliformes totais", "Número de amostras analisadas", "5"),
            ("110001", "S7", "SAA", 1, D, "Coliformes totais", "N de amostras com presença de coliformes totais", "1"),
            ("110001", "S7", "SAA", 1, D, "Coliformes totais", "N de amostras com ausência de coliformes totais", "3"),
        ])
        mun, realizadas, exc = self.s.agregar_controle(z, 2024)
        self.assertEqual(mun["355030"]["ecoli"], [1, 12])
        self.assertEqual(mun["355030"]["turbidez"], [1, 4])
        self.assertEqual(mun["530010"]["coliformes"], [1, 12])
        self.assertNotIn("coliformes", mun["110001"])
        self.assertEqual(mun["110001"]["formas"], 1)  # há registro, sem medida válida
        self.assertEqual(exc["valor_nao_inteiro_ecoli"], 1)
        self.assertEqual(exc["grupo_inconsistente_coliformes"], 1)
        self.assertEqual(exc["linhas_ra_df"], 4)
        self.assertEqual(realizadas[("530010", "530033", "S5")], 5)

    def test_rotulo_novo_interrompe(self):
        z = self.controle([("355030", "S1", "SAA", 1, "SISTEMA DE DISTRIBUIÇÃO", "Escherichia coli", "Número de amostras positivas", "1")])
        with self.assertRaisesRegex(ValueError, "não mapeado"):
            self.s.agregar_controle(z, 2024)

    def test_cabecalho_mudado_interrompe(self):
        z = _zip(self.dir.name, "x_csv.zip", ["Outro"] + self.s.CAB_CONTROLE[1:], [])
        with self.assertRaisesRegex(ValueError, "cabeçalho"):
            list(self.s.ler_csv(z, self.s.CAB_CONTROLE))

    def test_plano_cobertura_limitada_por_sistema(self):
        s = self.s
        I = {c: i for i, c in enumerate(s.CAB_PLANO)}
        def l(mun, forma, valor, razao):
            r = [""] * len(s.CAB_PLANO)
            r[I["CO_MUNICIPIO_IBGE"]], r[I["NU_SOLUCAO_ABASTECIMENTO"]], r[I["VALOR"]], r[I["RAZAO_HAB_DOMICILIO"]] = mun, forma, valor, razao
            r[I["TP_ABASTECIMENTO"]], r[I["PT_MONITORAMENTO"]], r[I["PARAMETRO"]] = "SAA", "SISTEMA DE DISTRIBUIÇÃO", "Coliformes totais"
            r[I["CAMPO"]], r[I["NU_ANO"]] = "Total Anual de Análises", "2024"
            return r
        z = _zip(self.dir.name, "plano_csv.zip", s.CAB_PLANO, [
            l("355030", "S1", "120", "2.96"), l("355030", "S1", "120", "3.55"),  # repetida com outra razão: mesmo valor
            l("355030", "S2", "60", "2.96"),
            l("355030", "S3", "10", "2.96"), l("355030", "S3", "12", "3.55"),  # conflito: fora
        ])
        out, exc = s.agregar_plano(z, 2024, {("355030", "355030", "S1"): 200, ("355030", "355030", "S2"): 30, ("320000", "320000", "S9"): 5})
        self.assertEqual(out["355030"], {"cobertas": 150, "exigidas": 180, "realizadas": 230, "formas": 2, "formas_sem_controle": 0})
        self.assertEqual(exc["forma_com_valor_conflitante_ou_invalido"], 1)
        self.assertEqual(exc["formas_com_controle_sem_plano"], 1)

    def test_vigilancia_regras(self):
        s = self.s
        I = {c: i for i, c in enumerate(s.CAB_VIGILANCIA)}
        def l(mun, amostra, tipo, proc, par, res, motivo="Rotina", ld="", lq=""):
            r = [""] * len(s.CAB_VIGILANCIA)
            r[I["CO_MUNICIPIO_IBGE"]], r[I["NU_AMOSTRA"]], r[I["TP_ABASTECIMENTO"]], r[I["TP_PROCEDENCIA_COLETA"]] = mun, amostra, tipo, proc
            r[I["PARAMETRO"]], r[I["RESULTADO"]], r[I["TP_MOTIVO_COLETA"]], r[I["LD"]], r[I["LQ"]] = par, res, motivo, ld, lq
            r[I["NU_ANO"]], r[I["NU_MES"]], r[I["DT_COLETA"]], r[I["NU_SOLUCAO_ABASTECIMENTO"]] = "2024", "04", "2024/04/19", "S1"
            return r
        R, A, E, CL = "SISTEMA DE DISTRIBUIÇÃO", "SOLUÇÃO ALTERNATIVA", "Escherichia coli", "Cloro residual livre (mg/L)"
        z = _zip(self.dir.name, "vig_csv.zip", s.CAB_VIGILANCIA, [
            l("355030", "1", "SAA", R, E, "PRESENTE"),
            l("355030", "1", "SAA", R, E, "PRESENTE"),  # duplicata
            l("355030", "2", "SAA", R, E, "AUSENTE"),
            l("355030", "3", "SAC", A, E, "AUSENTE"),
            l("355030", "4", "SAI", A, E, "PRESENTE"),  # solução individual: só no quadro nacional
            l("355030", "5", "SAA", R, E, "PRESENTE", motivo="Denúncia"),
            l("355030", "6", "SAA", R, CL, "0,1"),
            l("355030", "7", "SAA", R, CL, "0.97"),
            l("355030", "8", "SAA", R, CL, "MENOR_LQ", lq="0,10"),  # abaixo de LQ <= 0,2: abaixo do mínimo
            l("355030", "9", "SAA", R, CL, "MENOR_LQ", lq="0,50"),  # sem conclusão: fora
            l("355030", "10", "SAA", R, CL, "?"),
            l("530001", "11", "SAA", R, E, "AUSENTE"),
        ])
        mun, nac, exc = s.agregar_vigilancia(z, 2024)
        self.assertEqual(mun["355030"]["ecoli"], [1, 3])
        self.assertEqual(mun["355030"]["cloro"], [2, 3])
        self.assertEqual(mun["530010"]["ecoli"], [0, 1])
        self.assertEqual(nac["SAI|SOLUÇÃO ALTERNATIVA|ecoli"], [1, 1])
        self.assertEqual(exc["duplicata"], 1)
        self.assertEqual(exc["motivo_denuncia"], 1)
        self.assertEqual(exc["limite_cloro"], 1)
        self.assertEqual(exc["invalido_cloro"], 1)
        self.assertEqual(exc["linhas_ra_df"], 1)


if __name__ == "__main__":
    unittest.main()
