import gzip
import hashlib
import json
import unittest

from pipeline.observatorio_saneamento import saude

RESPOSTA = """<html><PRE>
"Munic&iacute;pio";"2021";"2022";"2023";"2024";"Total"
"110001 ALTA FLORESTA D'OESTE";2;3;-;1;6
"110002 ARIQUEMES";-;1.010;2;4;1.016
" MUNICIPIO IGNORADO - RO";-;1;-;-;1
"000000 Ignorado ou exterior";-;-;-;2;2
"Total";2;1.014;2;7;1.025
&
</PRE>
<div>Fonte: Ministério da Saúde - SIH/SUS Notas: Dados de teste. Legenda: - zero</div></html>"""


class InterpretarTabNet(unittest.TestCase):
    def test_le_municipios_ignorados_e_total(self):
        r = saude.interpretar(RESPOSTA)
        self.assertEqual(r["anos"], [2021, 2022, 2023, 2024])
        self.assertEqual(r["municipios"]["110001"], {2021: 2, 2022: 3, 2023: 0, 2024: 1})
        self.assertEqual(r["municipios"]["110002"][2022], 1010)  # separador de milhar
        self.assertEqual(r["ignorados"]["RO"][2022], 1)
        self.assertEqual(r["ignorados"]["EXTERIOR_OU_IGNORADO"][2024], 2)
        self.assertEqual(r["total"][2022], 1014)
        self.assertIn("Notas: Dados de teste.", r["notas"])
        self.assertNotIn("000000", r["municipios"])

    def test_linha_com_soma_diferente_do_total_interrompe(self):
        ruim = RESPOSTA.replace('"110001 ALTA FLORESTA D\'OESTE";2;3;-;1;6', '"110001 ALTA FLORESTA D\'OESTE";2;3;-;1;7')
        with self.assertRaisesRegex(ValueError, "soma dos anos"):
            saude.interpretar(ruim)

    def test_soma_das_linhas_diferente_da_linha_total_interrompe(self):
        ruim = RESPOSTA.replace('"Total";2;1.014;2;7;1.025', '"Total";2;1.016;2;7;1.027')
        with self.assertRaisesRegex(ValueError, "diverge da linha Total"):
            saude.interpretar(ruim)

    def test_valor_desconhecido_e_municipio_repetido_interrompem(self):
        with self.assertRaisesRegex(ValueError, "valor do TabNet desconhecido"):
            saude.interpretar(RESPOSTA.replace("-;1.010;2;4;1.016", "-;..;2;4;1.016"))
        with self.assertRaisesRegex(ValueError, "repetido"):
            saude.interpretar(RESPOSTA.replace('"110002 ARIQUEMES"', '"110001 ALTA FLORESTA D\'OESTE"'))

    def test_resposta_sem_tabela_ou_sem_total_interrompe(self):
        with self.assertRaisesRegex(ValueError, "sem tabela"):
            saude.interpretar("<html>Erro no servidor</html>")
        sem_total = RESPOSTA.replace('"Total";2;1.014;2;7;1.025\n', "")
        with self.assertRaisesRegex(ValueError, "sem linha Total"):
            saude.interpretar(sem_total)


DEF = """<select name="SCategoria_CID-10">
<option value="TODAS_AS_CATEGORIAS__">Todas as categorias</option>
<option value="1">A00 Cólera</option>
<option value="6">@A05 Outras intoxicações alimentares</option>
<option value="9">A27 Leptospirose</option>
<option value="10">A270 Leptospirose icterohemorrágica</option>
</select>
<select name="SLista_Morb__CID-10"><option value="5">Esquistossomose</option><option value="6">Esquistossomose</option></select>"""


class ResolverOpcoes(unittest.TestCase):
    def test_codigo_casa_pelo_inicio_e_com_arroba(self):
        r = saude.indices(DEF, "SCategoria_CID-10", ["A00", "A05", "A27"], por_codigo=True)
        self.assertEqual([i["valor"] for i in r], ["1", "6", "9"])  # A27 não casa com A270

    def test_rotulo_ausente_ou_ambiguo_interrompe(self):
        with self.assertRaisesRegex(ValueError, "casou 0"):
            saude.indices(DEF, "SCategoria_CID-10", ["B65"], por_codigo=True)
        with self.assertRaisesRegex(ValueError, "casou 2"):
            saude.indices(DEF, "SLista_Morb__CID-10", ["Esquistossomose"], por_codigo=False)

    def test_arquivos_ausentes_na_definicao_interrompem(self):
        d = '<select name="Arquivos"><option value="obtbr22.dbf">2022</option></select>'
        with self.assertRaisesRegex(ValueError, "arquivos ausentes"):
            saude.arquivos_tabnet(d, "sim")


class SeedPublicado(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifesto = json.loads((saude.SEED / "manifesto.json").read_text(encoding="utf-8"))

    def test_nove_consultas_com_sha256_dos_originais(self):
        self.assertEqual(len(self.manifesto["consultas"]), len(saude.GRUPOS) * len(saude.MEDIDAS))
        for c in self.manifesto["consultas"]:
            bruto = gzip.decompress((saude.SEED / c["arquivo"]).read_bytes())
            self.assertEqual(hashlib.sha256(bruto).hexdigest(), c["sha256"], c["id"])
            self.assertEqual(len(bruto), c["bytes"])

    def test_cada_consulta_registra_itens_resolvidos_e_notas_da_fonte(self):
        for c in self.manifesto["consultas"]:
            esperado = next(g for g in saude.GRUPOS if g["id"] == c["grupo"])["sim" if c["sistema"] == "sim" else "sih"]
            self.assertEqual(len(c["itens"]), len(esperado), c["id"])
            self.assertTrue(c["notas"].startswith("Fonte:"), c["id"])

    def test_janela_cabe_nos_dados_finais_do_sim(self):
        notas = next(c["notas"] for c in self.manifesto["consultas"] if c["sistema"] == "sim")
        self.assertIn("Dados finais disponíveis até 2024", notas)
        self.assertEqual(saude.ANOS, (2022, 2023, 2024))

    def test_construir_confere_cada_consulta_com_o_total_do_tabnet(self):
        ids6 = [f"{i}" for i in self._ids6()]
        municipais, bloco = saude.construir(ids6, {i: "XX" for i in ids6})
        self.assertEqual(len(municipais), len(ids6))
        for c in bloco["conferencias"]:
            self.assertEqual(c["diferenca"], 0, c["id"])
        self.assertEqual(bloco["municipios_sem_linha"], [])
        for i, campos_m in municipais.items():
            self.assertEqual(list(campos_m), saude.campos())
            for s, m, *_ in saude.MEDIDAS:
                partes = [campos_m[saude.campo(g["id"], s, m)] for g in saude.GRUPOS]
                self.assertEqual(campos_m[saude.campo("total", s, m)], sum(partes), i)
            self.assertLessEqual(campos_m[saude.campo("total", "sih", "obt")], campos_m[saude.campo("total", "sih", "int")], i)

    def _ids6(self):
        gold = json.loads((saude.AQUI.parent.parent / "public" / "saneamento" / "gold" / "municipios.json").read_text(encoding="utf-8"))
        return [l[0][:6] for l in gold["linhas"]]


if __name__ == "__main__":
    unittest.main()
