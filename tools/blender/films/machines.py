# One line per slot machine for its 3D film (tokens.py, trailer.py, film.py): the title written in gold, the hero symbol
# (big, at the centre), the 5 symbols that turn around it, the owner's decor behind (video or image, blurred), the
# particles of its world (fx), the colour of its light (accent), its impact sound, the metal of the pieces (rim).
# Paths are relative to assets/games/. 'emoji:🦅' = an emoji drawn as a painting (Le Totem Extrême has no images).
GOLD, SILVER, BRONZE, ROSE = (1.0, 0.62, 0.20), (0.86, 0.88, 0.92), (0.80, 0.45, 0.20), (1.0, 0.55, 0.55)

M = {
    'dragons': dict(title="L'HYDRE", hero='dragons/super', ring=['dragons/d0', 'dragons/d1', 'dragons/d2', 'dragons/d3', 'dragons/d8'],
                    bg='dragons/fond-haut.mp4', fx='embers', accent=(1.0, 0.45, 0.10), sound='roar'),
    'redk': dict(title='DIAMANTS\nREDK', hero='redk/wild', ring=['redk/ruby', 'redk/s8', 'redk/s7', 'redk/s5', 'redk/scat'],
                 bg='redk/fond-haut.mp4', fx='sparkles', accent=(1.0, 0.18, 0.22), sound='boom'),
    'viking': dict(title='LE VALHALLA', hero='viking/wild-c', ring=['viking/s10', 'viking/s8', 'viking/s9', 'viking/s5', 'viking/s6'],
                   bg='viking/fond.mp4', fx='blue_embers', accent=(0.35, 0.70, 1.0), sound='boom', rim=SILVER),
    'anubis': dict(title="L'ANUBIS", hero='anubis/w', ring=['anubis/s0', 'anubis/s1', 'anubis/s2', 'anubis/s3', 'anubis/gk'],
                   bg='anubis/fond-haut.mp4', fx='dust', accent=(0.20, 0.85, 0.80), sound='boom'),
    'fortune': dict(title='LA FORTUNE', hero='fortune/wild', ring=['fortune/coin', 'fortune/s4', 'fortune/s5', 'fortune/s7', 'fortune/jackpot'],
                    bg='fortune/scene.webp', fx='coins', coin='fortune/coin', accent=(1.0, 0.30, 0.12), sound='gong'),
    'pirates': dict(title='LE COFFRE\nAUX PIRATES', hero='pirates/s6', ring=['pirates/macaw', 'pirates/chest', 'pirates/crown', 'pirates/s4', 'pirates/s5'],
                    bg='pirates/fond-haut.mp4', fx='coins', coin='wolf/coin', accent=(1.0, 0.70, 0.20), sound='boom', rim=BRONZE),
    'barillet': dict(title='LA ROULETTE\nRUSSE', hero='barillet/wild', ring=['barillet/s9', 'barillet/s8', 'barillet/scat', 'barillet/s7', 'barillet/s5'],
                     bg='barillet/fond-haut.mp4', fx='dust', accent=(1.0, 0.55, 0.18), sound='shot', rim=BRONZE),
    'cosmic': dict(title='LE COSMIQUE', hero='cosmic/nova', ring=['cosmic/s0', 'cosmic/s1', 'cosmic/s2', 'cosmic/s3', 'cosmic/s8'],
                   bg='cosmic/scene-haut.webp', fx='stars', accent=(0.30, 0.85, 1.0), sound='boom', rim=SILVER),
    'candy': dict(title='LA SWEETY', hero='candy/heart', ring=['candy/s4', 'candy/s6', 'candy/s8', 'candy/s0', 'candy/s9'],
                  bg='candy/scene-haut.webp', fx='confetti', accent=(1.0, 0.35, 0.75), sound='chime', rim=ROSE),
    'noel': dict(title='LA TOURNÉE\nDU PÈRE NOËL', hero='noel/wild', ring=['noel/s8', 'noel/globe', 'noel/s1', 'noel/s5', 'noel/s4'],
                 bg='noel/fond-haut.mp4', fx='snow', accent=(1.0, 0.25, 0.22), sound='bells'),
    'huff': dict(title='LE LOUP 2.0', hero='huff/wolf', ring=['huff/pig', 'huff/straw', 'huff/wood', 'huff/brick', 'huff/scatter'],
                 bg='huff/fond-haut.mp4', fx='straw', accent=(1.0, 0.78, 0.30), sound='wind'),
    'big-bad-wolf': dict(title='LE LOUP', hero='huff/wolfplain', ring=['huff/pig', 'huff/straw', 'huff/wood', 'huff/brick', 'wolf/coin'],
                         bg='wolf/fond-haut.mp4', fx='fireflies', accent=(0.55, 0.65, 1.0), sound='wind', rim=SILVER),
    'chasse': dict(title='THE HUNT', hero='chasse/gold', ring=['chasse/deer', 'chasse/boar', 'chasse/pheasant', 'chasse/rabbit', 'chasse/duck'],
                   bg='chasse/scene-haut.webp', fx='leaves', accent=(1.0, 0.75, 0.30), sound='shot', rim=BRONZE),
    'bling': dict(title='LA TOUR BLING', hero='bling/s0', ring=['bling/s1', 'bling/s2', 'bling/s3', 'bling/s5', 'bling/sc'],
                  bg='bling/fond-haut.mp4', fx='sparkles', accent=(0.85, 0.35, 1.0), sound='chime'),
    'billets': dict(title='LE COFFRE-FORT', hero='billets/jackpot', ring=['billets/b5', 'billets/b4', 'billets/case', 'billets/fs', 'billets/b3'],
                    bg='billets/scene-haut.webp', fx='notes', accent=(1.0, 0.80, 0.30), sound='boom'),
    'totemx': dict(title='LE TOTEM\nEXTRÊME', hero='emoji:☀️', ring=['emoji:👑', 'emoji:🦅', 'emoji:🐍', 'emoji:🪲', 'emoji:🏺'],
                   bg='totemx/fond-haut.mp4', fx='embers', accent=(1.0, 0.42, 0.08), sound='roar'),
}
BATCHES = [['dragons', 'redk', 'viking', 'anubis', 'fortune'],
           ['pirates', 'barillet', 'cosmic', 'candy', 'noel'],
           ['huff', 'big-bad-wolf', 'chasse', 'bling', 'billets', 'totemx']]
