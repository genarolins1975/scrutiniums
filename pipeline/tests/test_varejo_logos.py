"""Manifesto de logos do Varejo (pipeline/varejo/logos.py). Sem rede: confere o manifesto publicado contra os arquivos
e prova que o conferidor recusa o que a regra recusa (sha256 trocado, SVG com conteúdo embutido, logo sem vínculo)."""
import copy
import json
import unittest

from pipeline.varejo import logos

try:  # a derivação com Pillow só roda na captura; o CI não o instala
    import PIL  # noqa: F401
    TEM_PIL = True
except ImportError:
    TEM_PIL = False


class LogosVarejo(unittest.TestCase):
    def manifesto(self):
        with open(logos.MANIFESTO, encoding="utf-8") as f:
            return json.load(f)

    def test_manifesto_publicado_confere(self):
        self.assertEqual(logos.conferir(), [])

    def test_curadoria_cobre_a_colecao_sem_repetir(self):
        slugs = [c[0] for c in logos.CURADORIA]
        self.assertEqual(len(slugs), len(set(slugs)))
        self.assertLessEqual(set(logos.slugs_da_colecao()), set(slugs))

    def test_conferidor_recusa_adulteracao(self):
        base = self.manifesto()
        com_logo = next(i for i, x in enumerate(base["logos"]) if x["arquivo"])
        for campo, valor, trecho in (("sha256", "0" * 64, "sha256"), ("vinculo", None, "vínculo"), ("largura", 1, "dimensões"),
                                     ("fundo", "cinza", "fundo"), ("url_origem", "http://exemplo.invalid/x.png", "https")):
            m = copy.deepcopy(base)
            m["logos"][com_logo][campo] = valor
            self.assertTrue(any(trecho in e for e in logos.conferir(m)), campo)
        m = copy.deepcopy(base)
        m["logos"].pop(com_logo)
        erros = logos.conferir(m)
        self.assertTrue(any("sem entrada" in e for e in erros))

    def test_svg_recusado(self):
        limpo = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>.a{fill:#000}</style><path class="a" d="M0 0h10v10z"/></svg>'
        self.assertFalse(logos.svg_recusado(limpo))
        for ruim in (b"<svg><script>alert(1)</script></svg>", b'<svg onload="x()"></svg>', b"<svg><foreignObject/></svg>",
                     b'<svg><image href="data:image/png;base64,AAAA"/></svg>', b'<svg><use href="https://exemplo.invalid/a.svg#b"/></svg>',
                     b'<!DOCTYPE svg [<!ENTITY x "y">]><svg/>', b'<svg><style>@import url(https://exemplo.invalid/a.css)</style></svg>'):
            self.assertTrue(logos.svg_recusado(ruim), ruim)

    def test_png_embutido_so_quando_o_svg_apenas_o_envolve(self):
        import base64
        png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
        b64 = base64.b64encode(png)
        envolve = b'<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,' + b64 + b'"/></svg>'
        self.assertEqual(logos.png_embutido(envolve), png)
        self.assertTrue(logos.svg_recusado(envolve))  # o SVG em si segue recusado
        self.assertIsNone(logos.png_embutido(envolve.replace(b"<image", b"<script>x()</script><image")))
        self.assertIsNone(logos.png_embutido(envolve.replace(b"</svg>", b'<image href="data:image/png;base64,' + b64 + b'"/></svg>')))
        self.assertIsNone(logos.png_embutido(b"<svg/>"))

    def test_png_da_pagina_exige_a_marca_do_elemento(self):
        import base64
        png = b"\x89PNG\r\n\x1a\n" + b"\x01" * 40
        b64 = base64.b64encode(png)
        pagina = b'<html><svg><image id="logo-x" width="1" xlink:href="data:image/png;base64,' + b64 + b'"/></svg></html>'
        self.assertEqual(logos.png_da_pagina(pagina, b'id="logo-x"'), png)
        self.assertIsNone(logos.png_da_pagina(pagina, b'id="outro"'))
        self.assertIsNone(logos.png_da_pagina(pagina + pagina, b'id="logo-x"'))

    @unittest.skipUnless(TEM_PIL, "Pillow não instalado: a derivação é ferramenta de captura, não de publicação; "
                                  "a integridade dos derivados publicados é conferida por test_derivados_publicados_integros")
    def test_derivacao_recorta_e_reduz_sem_mudar_o_formato(self):
        import io

        from PIL import Image
        orig = io.BytesIO()
        Image.new("RGBA", (400, 100), (10, 20, 30, 255)).save(orig, "PNG")
        saida, desc = logos.derivar(orig.getvalue(), (100, 10, 300, 90), 100)
        self.assertEqual(logos.formato_de(saida), "png")
        self.assertEqual(logos.dimensoes(saida, "png"), (100, 40))
        self.assertEqual(desc["caixa"], [100, 10, 300, 90])
        self.assertEqual(logos.derivar(orig.getvalue(), (100, 10, 300, 90), 100)[0], saida)

    def test_derivados_publicados_integros(self):
        """Sem Pillow: todo derivado do manifesto traz o sha256 do original e a operação, e o arquivo publicado bate com o
        sha256, o tamanho e as dimensões registradas, lidas do cabeçalho do próprio arquivo."""
        import hashlib
        import os
        derivados = [x for x in self.manifesto()["logos"] if x["derivado_de"]]
        self.assertLessEqual(set(logos.DERIVADOS), {x["slug"] for x in derivados})
        for x in derivados:
            self.assertRegex(x["derivado_de"], r"^[0-9a-f]{64}$", x["slug"])
            self.assertNotEqual(x["derivado_de"], x["sha256"], x["slug"])
            self.assertTrue(x["derivacao"] and x["derivacao"].get("operacao") and x["derivacao"].get("ferramenta"), x["slug"])
            with open(os.path.join(logos.DESTINO, os.path.basename(x["arquivo"])), "rb") as f:
                corpo = f.read()
            self.assertEqual(hashlib.sha256(corpo).hexdigest(), x["sha256"], x["slug"])
            self.assertEqual(len(corpo), x["bytes"], x["slug"])
            self.assertEqual(logos.formato_de(corpo), x["formato"], x["slug"])
            self.assertEqual(tuple(logos.dimensoes(corpo, x["formato"])), (x["largura"], x["altura"]), x["slug"])
            caixa = x["derivacao"].get("caixa")
            if caixa and not x["derivacao"].get("largura_max"):  # recorte puro: as medidas são as da caixa
                self.assertEqual((caixa[2] - caixa[0], caixa[3] - caixa[1]), (x["largura"], x["altura"]), x["slug"])

    def test_entradas_derivadas_e_do_dono_ficam_declaradas(self):
        porslug = {x["slug"]: x for x in self.manifesto()["logos"]}
        for slug in logos.DERIVADOS:
            self.assertTrue(porslug[slug]["derivado_de"], slug)
        for slug in logos.EXTRAIDOS:
            self.assertTrue(porslug[slug]["extraido_de"], slug)
        for slug, metodo in logos.METODO.items():
            if porslug[slug]["arquivo"]:  # pendente ainda sem arquivo segue como ausência
                self.assertEqual(porslug[slug]["metodo"], metodo, slug)


if __name__ == "__main__":
    unittest.main()
