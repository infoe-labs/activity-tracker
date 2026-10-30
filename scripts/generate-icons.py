"""Build app-owned icons from vector geometry; requires Pillow only for regeneration."""
from PIL import Image, ImageDraw
from pathlib import Path
for name,size in [('icon-192.png',192),('icon-512.png',512),('icon-maskable-512.png',512),('apple-touch-icon.png',180)]:
    scale=4
    image=Image.new('RGB',(size*scale,size*scale),'#45644f')
    draw=ImageDraw.Draw(image)
    def points(seq): return [(int(x*size*scale),int(y*size*scale)) for x,y in seq]
    draw.polygon(points([(.31,.63),(.30,.49),(.35,.37),(.47,.29),(.70,.27),(.69,.48),(.61,.62),(.48,.69),(.36,.68)]),fill='#edf1e6')
    draw.line(points([(.28,.75),(.40,.58),(.53,.46),(.62,.38)]),fill='#45644f',width=int(size*scale*.027))
    image.resize((size,size),Image.Resampling.LANCZOS).save(Path('public')/name)
