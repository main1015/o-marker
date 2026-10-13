import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_REGULAR = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc"
if not os.path.exists(FONT_REGULAR):
    FONT_REGULAR = FONT_BOLD

ICON_PATH = "apps/extension/assets/icon.png"

def create_gradient_bg(width, height, color1, color2):
    """创建线性渐变背景"""
    base = Image.new("RGB", (width, height), color1)
    top = Image.new("RGB", (width, height), color2)
    mask = Image.new("L", (width, height))
    mask_data = []
    for y in range(height):
        # 45度对角线渐变或者垂直渐变
        ratio = y / height
        val = int(255 * ratio)
        mask_data.extend([val] * width)
    mask.putdata(mask_data)
    base.paste(top, (0, 0), mask)
    return base

def add_glow(img, x, y, radius, color):
    """在图片上添加柔和弥散发光光晕"""
    glow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow_layer)
    draw.ellipse([x - radius, y - radius, x + radius, y + radius], fill=color)
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius // 2))
    img.paste(glow_layer, (0, 0), glow_layer)

def generate_small_promo():
    w, h = 440, 280
    im = create_gradient_bg(w, h, (15, 23, 42), (30, 27, 75)) # slate-900 to indigo-950
    im = im.convert("RGBA")

    # 光晕
    add_glow(im, 220, 80, 100, (99, 102, 241, 100)) # indigo glow
    add_glow(im, 360, 220, 80, (59, 130, 246, 60))  # blue glow

    # 放置图标
    if os.path.exists(ICON_PATH):
        icon = Image.open(ICON_PATH).convert("RGBA")
        icon = icon.resize((72, 72), Image.LANCZOS)
        im.paste(icon, ((w - 72) // 2, 35), icon)

    draw = ImageDraw.Draw(im)
    title_font = ImageFont.truetype(FONT_BOLD, 26)
    sub_font = ImageFont.truetype(FONT_BOLD, 13)
    tag_font = ImageFont.truetype(FONT_BOLD, 11)

    # 标题
    title = "o-marker"
    draw.text((w // 2, 126), title, font=title_font, fill=(255, 255, 255), anchor="mm")

    # 副标题
    subtitle = "下一代智能书签与知识收藏助手"
    draw.text((w // 2, 158), subtitle, font=sub_font, fill=(199, 210, 254), anchor="mm")

    # 标签徽章
    tags = ["极速收集", "Raindrop交互", "自托管同步"]
    badge_y = 205
    total_badge_w = len(tags) * 90 + (len(tags) - 1) * 10
    start_x = (w - total_badge_w) // 2

    for i, tag in enumerate(tags):
        bx = start_x + i * 100
        by = badge_y
        draw.rounded_rectangle([bx, by, bx + 92, by + 26], radius=13, fill=(30, 41, 59, 220), outline=(99, 102, 241, 180), width=1)
        draw.text((bx + 46, by + 13), tag, font=tag_font, fill=(224, 231, 255), anchor="mm")

    final_img = im.convert("RGB")
    final_img.save("store_assets/small_promo_440x280.png")
    print("Generated small_promo_440x280.png")

def generate_promo_marquee():
    w, h = 1400, 560
    im = create_gradient_bg(w, h, (10, 15, 30), (20, 20, 55))
    im = im.convert("RGBA")

    # 多重柔光背景
    add_glow(im, 300, 200, 260, (99, 102, 241, 70))
    add_glow(im, 1000, 300, 320, (59, 130, 246, 50))
    add_glow(im, 1200, 150, 180, (168, 85, 247, 40))

    draw = ImageDraw.Draw(im)

    # 左侧内容
    # 放置 Logo
    if os.path.exists(ICON_PATH):
        icon = Image.open(ICON_PATH).convert("RGBA")
        icon = icon.resize((96, 96), Image.LANCZOS)
        im.paste(icon, (100, 80), icon)

    f_title = ImageFont.truetype(FONT_BOLD, 48)
    f_sub = ImageFont.truetype(FONT_BOLD, 22)
    f_desc = ImageFont.truetype(FONT_BOLD, 16)
    f_item = ImageFont.truetype(FONT_BOLD, 15)

    draw.text((220, 105), "o-marker", font=f_title, fill=(255, 255, 255))
    draw.text((225, 165), "现代智能书签管理器 · 像呼吸一样自然的知识收藏", font=f_sub, fill=(165, 180, 252))

    draw.text((100, 230), "专为追求极致体验的知识工作者打造。吸取 Raindrop.io 设计精粹，支持标签体系、", font=f_desc, fill=(148, 163, 184))
    draw.text((100, 260), "集合管理与全文检索，打造个人自托管的永久网络智库。", font=f_desc, fill=(148, 163, 184))

    # 四大特性卡片
    features = [
        ("⚡ 极速保存", "支持快捷键即时截取当前页与元数据"),
        ("📁 集合与标签", "多层级树状目录与灵活多维标签管理"),
        ("🎨 现代交互", "Raindrop 级抽屉动效与精致视觉体验"),
        ("🔒 隐私与自托管", "完全自主可控的数据同步与离线归档")
    ]

    for i, (f_name, f_d) in enumerate(features):
        col = i % 2
        row = i // 2
        fx = 100 + col * 270
        fy = 320 + row * 95
        draw.rounded_rectangle([fx, fy, fx + 250, fy + 75], radius=12, fill=(15, 23, 42, 200), outline=(51, 65, 85, 200), width=1)
        draw.text((fx + 16, fy + 16), f_name, font=f_item, fill=(241, 245, 249))
        draw.text((fx + 16, fy + 44), f_d, font=ImageFont.truetype(FONT_REGULAR, 11), fill=(148, 163, 184))

    # 右侧卡片立体透视模拟
    mock_x, mock_y, mock_w, mock_h = 750, 70, 560, 420
    draw.rounded_rectangle([mock_x, mock_y, mock_x + mock_w, mock_y + mock_h], radius=16, fill=(15, 23, 42, 230), outline=(99, 102, 241, 140), width=2)
    # 模拟顶部窗口控制按钮
    draw.ellipse([mock_x + 20, mock_y + 18, mock_x + 32, mock_y + 30], fill=(239, 68, 68))
    draw.ellipse([mock_x + 40, mock_y + 18, mock_x + 52, mock_y + 30], fill=(245, 158, 11))
    draw.ellipse([mock_x + 60, mock_y + 18, mock_x + 72, mock_y + 30], fill=(34, 197, 94))
    draw.line([mock_x, mock_y + 46, mock_x + mock_w, mock_y + 46], fill=(30, 41, 59), width=1)
    draw.text((mock_x + mock_w // 2, mock_y + 24), "o-marker Bookmark Editor", font=ImageFont.truetype(FONT_BOLD, 13), fill=(148, 163, 184), anchor="mm")

    # 模拟右侧书签编辑抽屉卡片内容
    card_items = [
        ("网页标题", "Tailwind CSS - Rapidly build modern websites without ever leaving your HTML"),
        ("URL 地址", "https://tailwindcss.com/docs/utility-first"),
        ("归属集合", "📁 前端工程 / 核心工具库"),
        ("标签分类", "🏷️ #css #design #framework"),
        ("备忘速记", "支持随时呼出查看离线快照与高亮标记，双击直达目标锚点。")
    ]

    item_y = mock_y + 65
    for label, val in card_items:
        draw.text((mock_x + 25, item_y), label, font=ImageFont.truetype(FONT_BOLD, 12), fill=(99, 102, 241))
        draw.rounded_rectangle([mock_x + 25, item_y + 20, mock_x + mock_w - 25, item_y + 55], radius=8, fill=(30, 41, 59, 180), outline=(51, 65, 85, 120), width=1)
        draw.text((mock_x + 38, item_y + 37), val[:46] + ("..." if len(val) > 46 else ""), font=ImageFont.truetype(FONT_REGULAR, 12), fill=(226, 232, 240), anchor="lm")
        item_y += 66

    final_img = im.convert("RGB")
    final_img.save("store_assets/promo_marquee_1400x560.png")
    print("Generated promo_marquee_1400x560.png")

def generate_screenshot():
    w, h = 1280, 800
    im = create_gradient_bg(w, h, (15, 23, 42), (30, 41, 59))
    im = im.convert("RGBA")

    draw = ImageDraw.Draw(im)

    # 1. 模拟 Chrome 浏览器窗口顶部
    header_h = 75
    draw.rectangle([0, 0, w, header_h], fill=(30, 41, 59))
    draw.line([0, header_h, w, header_h], fill=(51, 65, 85), width=1)

    # 窗口红黄绿小圆点
    draw.ellipse([20, 18, 32, 30], fill=(239, 68, 68))
    draw.ellipse([40, 18, 52, 30], fill=(245, 158, 11))
    draw.ellipse([60, 18, 72, 30], fill=(34, 197, 94))

    # 活动标签页
    draw.rounded_rectangle([90, 8, 290, 40], radius=8, fill=(51, 65, 85))
    draw.text((115, 24), "GitHub - main1015/o-marker", font=ImageFont.truetype(FONT_BOLD, 11), fill=(241, 245, 249), anchor="lm")

    # 地址栏
    draw.rounded_rectangle([90, 44, w - 180, 70], radius=6, fill=(15, 23, 42))
    draw.text((110, 57), "🔒  https://github.com/main1015/o-marker", font=ImageFont.truetype(FONT_REGULAR, 12), fill=(148, 163, 184), anchor="lm")

    # 右上角插件图标发光点
    if os.path.exists(ICON_PATH):
        ext_icon = Image.open(ICON_PATH).convert("RGBA").resize((22, 22), Image.LANCZOS)
        im.paste(ext_icon, (w - 70, 46), ext_icon)

    # 2. 模拟宿主网页内容（左侧大背景）
    web_y = header_h + 30
    draw.text((80, web_y + 40), "o-marker / The Next-Gen Bookmark Manager", font=ImageFont.truetype(FONT_BOLD, 32), fill=(248, 250, 252))
    draw.text((80, web_y + 90), "A clean, modern bookmark manager inspired by Raindrop and built with Plasmo & Next.js.", font=ImageFont.truetype(FONT_REGULAR, 16), fill=(148, 163, 184))

    # 模拟网页中的卡片网格
    for row in range(2):
        for col in range(2):
            cx = 80 + col * 360
            cy = web_y + 150 + row * 180
            draw.rounded_rectangle([cx, cy, cx + 330, cy + 150], radius=12, fill=(30, 41, 59, 180), outline=(51, 65, 85, 120), width=1)
            draw.text((cx + 20, cy + 30), f"Bookmark Record #{row*2 + col + 1}", font=ImageFont.truetype(FONT_BOLD, 16), fill=(226, 232, 240))
            draw.text((cx + 20, cy + 65), "https://example.com/docs/guide", font=ImageFont.truetype(FONT_REGULAR, 12), fill=(99, 102, 241))
            draw.text((cx + 20, cy + 105), "🏷️  #productivity  #reading", font=ImageFont.truetype(FONT_BOLD, 12), fill=(148, 163, 184))

    # 3. 核心亮点：右上角展开的 o-marker 悬浮弹窗 (Popup / Drawer)
    pop_w, pop_h = 390, 620
    pop_x, pop_y = w - pop_w - 40, header_h + 20
    # 弹窗阴影
    shadow = Image.new("RGBA", (pop_w + 40, pop_h + 40), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.rounded_rectangle([20, 20, pop_w + 20, pop_h + 20], radius=16, fill=(0, 0, 0, 180))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    im.paste(shadow, (pop_x - 20, pop_y - 20), shadow)

    # 弹窗主体
    draw.rounded_rectangle([pop_x, pop_y, pop_x + pop_w, pop_y + pop_h], radius=16, fill=(15, 23, 42, 250), outline=(99, 102, 241, 200), width=2)

    # 弹窗 Header
    if os.path.exists(ICON_PATH):
        pop_icon = Image.open(ICON_PATH).convert("RGBA").resize((28, 28), Image.LANCZOS)
        im.paste(pop_icon, (pop_x + 20, pop_y + 18), pop_icon)
    draw.text((pop_x + 56, pop_y + 32), "o-marker 快捷保存", font=ImageFont.truetype(FONT_BOLD, 16), fill=(255, 255, 255), anchor="lm")
    draw.text((pop_x + pop_w - 25, pop_y + 32), "✕", font=ImageFont.truetype(FONT_BOLD, 14), fill=(148, 163, 184), anchor="mm")
    draw.line([pop_x, pop_y + 58, pop_x + pop_w, pop_y + 58], fill=(30, 41, 59), width=1)

    # 弹窗表单控件
    form_items = [
        ("网页标题", "GitHub - main1015/o-marker", 75),
        ("网址 URL", "https://github.com/main1015/o-marker", 155),
        ("选择集合目录", "📁 个人知识库 / 开发工具 (已选择)", 235),
        ("标签分类 (Tags)", "🏷️  github, bookmark, productivity", 315),
        ("速记笔记 / 描述", "支持全文深度索引与离线快照，自动抓取 Favicon 与预览卡片。", 395)
    ]

    for label, val, offset_y in form_items:
        draw.text((pop_x + 24, pop_y + offset_y), label, font=ImageFont.truetype(FONT_BOLD, 12), fill=(148, 163, 184))
        draw.rounded_rectangle([pop_x + 24, pop_y + offset_y + 20, pop_x + pop_w - 24, pop_y + offset_y + 56], radius=8, fill=(30, 41, 59), outline=(71, 85, 105), width=1)
        draw.text((pop_x + 36, pop_y + offset_y + 38), val[:32] + ("..." if len(val) > 32 else ""), font=ImageFont.truetype(FONT_REGULAR, 12), fill=(241, 245, 249), anchor="lm")

    # 底部保存按钮
    btn_y = pop_y + 535
    draw.rounded_rectangle([pop_x + 24, btn_y, pop_x + pop_w - 24, btn_y + 44], radius=10, fill=(79, 70, 229)) # indigo-600
    draw.text((pop_x + pop_w // 2, btn_y + 22), "💾  立即保存书签", font=ImageFont.truetype(FONT_BOLD, 14), fill=(255, 255, 255), anchor="mm")

    final_img = im.convert("RGB")
    final_img.save("store_assets/screenshot_1280x800.png")
    print("Generated screenshot_1280x800.png")

if __name__ == "__main__":
    generate_small_promo()
    generate_promo_marquee()
    generate_screenshot()
