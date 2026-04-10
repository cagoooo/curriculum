"""
Generate favicon.png and og-image.png for the curriculum review tool.
Run: python generate_assets.py
"""
import sys, io
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
else:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from PIL import Image, ImageDraw, ImageFont
import math, os

FONT_REGULAR = "C:/Windows/Fonts/msjh.ttc"
FONT_BOLD    = "C:/Windows/Fonts/msjhbd.ttc"

# ─── Colors ────────────────────────────────────────────────
C_DARK   = (27,  94,  80)   # #1b5e50
C_MID    = (46, 125, 111)   # #2e7d6f
C_LIGHT  = (61, 155, 138)   # #3d9b8a
C_GREEN  = (39, 174,  96)   # #27ae60
C_WHITE  = (255, 255, 255)
C_PALE   = (224, 242, 239)  # #e0f2ef
C_YELLOW = (255, 193,   7)  # badge accent


def font(path, size):
    return ImageFont.truetype(path, size)


# ════════════════════════════════════════════════════════════
# 1. FAVICON  (256×256 → saved as PNG; also exported as ICO)
# ════════════════════════════════════════════════════════════
def make_favicon():
    SIZE = 256
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Rounded square background
    margin = 8
    r = 52
    d.rounded_rectangle([margin, margin, SIZE-margin, SIZE-margin],
                        radius=r, fill=C_MID)

    # Document body (white card)
    doc_x, doc_y = 62, 48
    doc_w, doc_h = 148, 190
    d.rounded_rectangle([doc_x, doc_y, doc_x+doc_w, doc_y+doc_h],
                        radius=10, fill=C_WHITE)

    # Folded corner
    fold = 28
    d.polygon([
        (doc_x+doc_w-fold, doc_y),
        (doc_x+doc_w, doc_y+fold),
        (doc_x+doc_w-fold, doc_y+fold),
    ], fill=C_PALE)

    # Text lines on document
    line_color = C_LIGHT
    lx = doc_x + 18
    for i, width_pct in enumerate([0.72, 0.55, 0.68, 0.45]):
        ly = doc_y + 55 + i * 28
        lw = int(doc_w * 0.75 * width_pct)
        d.rounded_rectangle([lx, ly, lx+lw, ly+10], radius=5, fill=line_color)

    # Green checkmark badge
    badge_cx, badge_cy, badge_r = SIZE - 68, SIZE - 68, 44
    d.ellipse([badge_cx-badge_r, badge_cy-badge_r,
               badge_cx+badge_r, badge_cy+badge_r], fill=C_GREEN)
    # Checkmark
    pts = [(badge_cx-18, badge_cy), (badge_cx-4, badge_cy+16),
           (badge_cx+20, badge_cy-18)]
    d.line(pts, fill=C_WHITE, width=10, joint="curve")

    img.save("favicon.png")

    # Also export multi-size ICO
    ico_sizes = [(16,16),(32,32),(48,48),(64,64),(128,128)]
    icons = [img.resize(s, Image.LANCZOS) for s in ico_sizes]
    icons[0].save("favicon.ico", format="ICO",
                  append_images=icons[1:],
                  sizes=ico_sizes)
    print("✅ favicon.png + favicon.ico saved")


# ════════════════════════════════════════════════════════════
# 2. OG IMAGE  (1200×630)
# ════════════════════════════════════════════════════════════
def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i]-c1[i])*t) for i in range(3))

def make_og():
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), C_DARK)
    d = ImageDraw.Draw(img)

    # ── Gradient background (vertical strips) ──────────────
    for x in range(W):
        t = x / W
        color = lerp_color(C_DARK, C_MID, t * 0.55)
        d.line([(x, 0), (x, H)], fill=color)

    # ── Decorative circles ─────────────────────────────────
    for cx, cy, cr, alpha in [
        (1050, 160, 240, 18),
        (1050, 160, 170, 28),
        (120,  530,  90, 15),
        (1100, 540,  55, 20),
    ]:
        overlay = Image.new("RGBA", (W, H), (0,0,0,0))
        od = ImageDraw.Draw(overlay)
        od.ellipse([cx-cr, cy-cr, cx+cr, cy+cr],
                   fill=(*C_LIGHT, alpha))
        img.paste(Image.alpha_composite(
            img.convert("RGBA"), overlay).convert("RGB"))
        d = ImageDraw.Draw(img)

    # ── Document card (right side) ─────────────────────────
    card_x, card_y, card_w, card_h = 820, 140, 270, 340
    # shadow
    shadow = Image.new("RGBA", (W, H), (0,0,0,0))
    sd = ImageDraw.Draw(shadow)
    for s in range(12, 0, -1):
        sd.rounded_rectangle(
            [card_x+s, card_y+s, card_x+card_w+s, card_y+card_h+s],
            radius=16, fill=(0,0,0, 10))
    img = Image.alpha_composite(img.convert("RGBA"), shadow).convert("RGB")
    d = ImageDraw.Draw(img)

    # card body
    d.rounded_rectangle([card_x, card_y, card_x+card_w, card_y+card_h],
                        radius=16, fill=(255,255,255,) )

    # card header bar
    d.rounded_rectangle([card_x, card_y, card_x+card_w, card_y+52],
                        radius=16, fill=C_MID)
    d.rectangle([card_x, card_y+36, card_x+card_w, card_y+52], fill=C_MID)

    # header text
    fsmall = font(FONT_BOLD, 20)
    d.text((card_x+card_w//2, card_y+26), "課程計畫審查",
           font=fsmall, fill=C_WHITE, anchor="mm")

    # document lines
    lx = card_x + 22
    for i, (w_pct, opacity) in enumerate([
        (0.78, 200),(0.60, 170),(0.70, 160),
        (0.50, 140),(0.65, 130),(0.45, 110),
    ]):
        ly = card_y + 80 + i * 32
        lw = int(card_w * 0.82 * w_pct)
        gray = int(220 - (1-w_pct)*60)
        d.rounded_rectangle([lx, ly, lx+lw, ly+12],
                            radius=6, fill=(gray, gray, gray))

    # checkmark badge on card
    bx, by, br = card_x+card_w-50, card_y+card_h-50, 36
    d.ellipse([bx-br, by-br, bx+br, by+br], fill=C_GREEN)
    ck = [(bx-16, by),(bx-4, by+14),(bx+18, by-16)]
    d.line(ck, fill=C_WHITE, width=7, joint="curve")

    # AI label badge on card
    d.rounded_rectangle([card_x+16, card_y+card_h-76,
                         card_x+90, card_y+card_h-52],
                        radius=10, fill=C_LIGHT)
    d.text((card_x+53, card_y+card_h-64), "AI 審查",
           font=font(FONT_BOLD, 16), fill=C_WHITE, anchor="mm")

    # ── Left-side text ─────────────────────────────────────

    # Badge pill: 桃園市115學年度
    pill_w, pill_h = 280, 38
    pill_x, pill_y = 72, 72
    d.rounded_rectangle([pill_x, pill_y, pill_x+pill_w, pill_y+pill_h],
                        radius=19, fill=(255,255,255,50))
    d.rounded_rectangle([pill_x, pill_y, pill_x+pill_w, pill_y+pill_h],
                        radius=19, outline=(255,255,255,80), width=1)
    d.text((pill_x+pill_w//2, pill_y+pill_h//2), "桃園市 115 學年度 · 國民小學",
           font=font(FONT_REGULAR, 17), fill=(255,255,255), anchor="mm")

    # Main title
    d.text((72, 175), "課程計畫",
           font=font(FONT_BOLD, 100), fill=C_WHITE)
    d.text((72, 280), "AI 審查工具",
           font=font(FONT_BOLD, 100), fill=C_WHITE)

    # Green accent line
    d.rounded_rectangle([72, 393, 620, 399], radius=3, fill=C_GREEN)

    # Subtitle
    d.text((72, 416), "上傳課程計畫 PDF，即可自動審查各項次是否符合規定",
           font=font(FONT_REGULAR, 24), fill=(255,255,255,))

    # Feature chips
    chips = ["📋 40+ 審查項次", "🤖 Gemini AI", "✏️ 可彈性修改提示詞"]
    cx = 72
    for chip in chips:
        fw = font(FONT_REGULAR, 18)
        tw = d.textlength(chip, font=fw)
        pw = int(tw) + 32
        d.rounded_rectangle([cx, 470, cx+pw, 514], radius=22,
                            fill=(255,255,255,38))
        d.rounded_rectangle([cx, 470, cx+pw, 514], radius=22,
                            outline=(255,255,255,60), width=1)
        d.text((cx+pw//2, 492), chip, font=fw, fill=C_WHITE, anchor="mm")
        cx += pw + 14

    # URL bottom left
    d.text((72, 578), "cagoooo.github.io/curriculum",
           font=font(FONT_REGULAR, 20), fill=(255,255,255,))

    # Credit bottom right
    d.text((W-60, 578), "阿凱老師製作",
           font=font(FONT_REGULAR, 20), fill=(255,255,255,), anchor="ra")

    img.save("og-image.png", format="PNG", optimize=True)
    print("✅ og-image.png saved (1200×630)")


# ════════════════════════════════════════════════════════════
if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    make_favicon()
    make_og()
    print("🎉 All assets generated!")
