"""拡大機（ポスタープリンター）用の原稿を作成する。

A4・上下左右中央・黒100%で、レイアウトごとに次の2ファイルを出力する。
  - PDF : 印刷用。フォント埋め込み・文字の正確な中央配置
  - Word: 編集用。Windows に BIZ UDゴシック が入っていれば同じ見た目になる
レイアウト:
  - A4縦・1ページ1文字
  - A4横・1ページ2文字
使い方: python3 make_poster.py  （BIZUDGothic-Bold.ttf を FONT_FILE に置くこと）
"""
from dataclasses import dataclass
from pathlib import Path

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Mm, Pt, RGBColor

TEXT = "お米マーク総選挙"
FONT = "BIZ UDGothic"  # 日本語表示名: BIZ UDゴシック（Bold で使用）
FONT_FILE = Path.home() / ".fonts" / "BIZUDGothic-Bold.ttf"
MARGIN_MM = 15
OUT_DIR = Path(__file__).parent


@dataclass
class Layout:
    name: str  # 出力ファイル名の末尾
    page_w_mm: float
    page_h_mm: float
    chars_per_page: int
    font_size_pt: int


LAYOUTS = [
    # 全角1文字 ≒ 176mm 角
    Layout("", 210, 297, 1, 500),
    # 余白内の幅 267mm に2文字 → 1文字 ≒ 132mm 角
    Layout("_A4横2文字", 297, 210, 2, 375),
]


def pages(layout):
    n = layout.chars_per_page
    return [TEXT[i : i + n] for i in range(0, len(TEXT), n)]


def set_font(run, size_pt):
    run.font.name = FONT
    run.font.size = Pt(size_pt)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0, 0, 0)
    rfonts = run._element.get_or_add_rPr().get_or_add_rFonts()
    for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        rfonts.set(qn(attr), FONT)


def build_docx(layout):
    path = OUT_DIR / f"{TEXT}{layout.name}.docx"
    doc = Document()

    section = doc.sections[0]
    if layout.page_w_mm > layout.page_h_mm:
        section.orientation = WD_ORIENT.LANDSCAPE
    section.page_width, section.page_height = Mm(layout.page_w_mm), Mm(layout.page_h_mm)
    for side in ("top_margin", "bottom_margin", "left_margin", "right_margin"):
        setattr(section, side, Mm(MARGIN_MM))
    section.header_distance = section.footer_distance = Mm(0)

    # 上下中央: 行の高さ＝文字サイズとし、残りの半分を段落前の余白にする
    # （セクションの上下中央揃えは LibreOffice が反映しないため使わない）
    # 固定行間では文字が行の上側に寄るため、実測（LibreOffice 変換）で
    # 文字サイズ 500pt あたり 14mm 下げる
    line_mm = layout.font_size_pt * 25.4 / 72
    offset_mm = 14 * layout.font_size_pt / 500
    space_before_mm = (layout.page_h_mm - 2 * MARGIN_MM - line_mm) / 2 + offset_mm

    # 既定の空段落を削除
    body = doc.element.body
    for p in list(body.iterchildren(qn("w:p"))):
        body.remove(p)

    for i, chars in enumerate(pages(layout)):
        para = doc.add_paragraph()
        fmt = para.paragraph_format
        fmt.alignment = WD_ALIGN_PARAGRAPH.CENTER
        fmt.space_before = Mm(space_before_mm)
        fmt.space_after = Pt(0)
        fmt.line_spacing_rule = WD_LINE_SPACING.EXACTLY
        fmt.line_spacing = Pt(layout.font_size_pt)
        fmt.page_break_before = i > 0
        # 文字グリッドへの吸着を無効化（日本語版 Word で位置がずれないように）
        snap = OxmlElement("w:snapToGrid")
        snap.set(qn("w:val"), "0")
        para._p.get_or_add_pPr().append(snap)
        set_font(para.add_run(chars), layout.font_size_pt)

    doc.save(path)
    print(f"saved: {path} ({len(pages(layout))} pages)")


def build_pdf(layout):
    path = OUT_DIR / f"{TEXT}{layout.name}.pdf"
    font = TTFont("BIZUDGothic-Bold", str(FONT_FILE))
    pdfmetrics.registerFont(font)
    size = layout.font_size_pt
    # 全角の仮想ボディ（ascent〜descent）の中心をページ中心に合わせる
    em_center = (font.face.ascent + font.face.descent) / 2 / 1000 * size
    page_w, page_h = layout.page_w_mm * mm, layout.page_h_mm * mm

    c = canvas.Canvas(str(path), pagesize=(page_w, page_h), initialFontName=font.fontName)
    c.setTitle(TEXT)
    for chars in pages(layout):
        c.setFillColorRGB(0, 0, 0)
        c.setFont(font.fontName, size)
        c.drawCentredString(page_w / 2, page_h / 2 - em_center, chars)
        c.showPage()
    c.save()
    print(f"saved: {path} ({len(pages(layout))} pages)")


def main():
    for layout in LAYOUTS:
        build_docx(layout)
        build_pdf(layout)


if __name__ == "__main__":
    main()
