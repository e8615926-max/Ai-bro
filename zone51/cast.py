"""Внешность персонажей."""
from human import Look

ANDREY = Look(skin=(232, 188, 156, 255), hair=(58, 40, 28, 255), hair_style="short", top="track", top_col=(40, 54, 120, 255),
              accent=(236, 236, 242, 255), pants=(36, 48, 108, 255), shoes=(110, 32, 30, 255), extras={"stubble"})
SASHA = Look(skin=(240, 204, 178, 255), hair=(196, 92, 40, 255), hair_style="messy", top="hoodie", top_col=(84, 96, 88, 255),
             accent=(230, 230, 230, 255), pants=(54, 50, 56, 255), shoes=(36, 34, 36, 255), eyes=(70, 110, 70, 255), extras={"mole", "freckles"})
MAMA = Look(skin=(226, 182, 152, 255), hair=(130, 76, 60, 255), hair_style="curly", top="mama", top_col=(120, 40, 50, 255),
            pants=(50, 40, 44, 255), shoes=(40, 30, 28, 255), female=True, extras={"earrings", "lipstick"})
ELLI = Look(skin=(236, 192, 168, 255), hair=(92, 52, 38, 255), hair_style="ponytail", top="coat", top_col=(150, 120, 86, 255),
            pants=(36, 32, 44, 255), shoes=(26, 22, 24, 255), eyes=(70, 110, 140, 255), female=True, extras={"lipstick"})
CLARK = Look(skin=(212, 160, 128, 255), hair=(60, 44, 36, 255), hair_style="short", top="uniform", top_col=(34, 46, 88, 255),
             pants=(24, 26, 44, 255), shoes=(14, 14, 16, 255), width=1.12, extras={"cap", "mustache"})
COP2 = Look(skin=(150, 104, 80, 255), hair=(20, 16, 14, 255), hair_style="short", top="uniform", top_col=(34, 46, 88, 255),
            pants=(24, 26, 44, 255), shoes=(14, 14, 16, 255), extras={"cap"})
COP3 = Look(skin=(226, 184, 150, 255), hair=(150, 110, 60, 255), hair_style="short", top="uniform", top_col=(34, 46, 88, 255),
            pants=(24, 26, 44, 255), shoes=(14, 14, 16, 255), width=0.95, extras={"cap"})
HAZMAT = Look(top="hazmat", top_col=(230, 200, 40, 255), pants=(230, 200, 40, 255), shoes=(30, 30, 30, 255), hair_style="none", extras={"hood"})
FIRE = Look(skin=(220, 170, 140, 255), top="fire", top_col=(60, 56, 44, 255), pants=(60, 56, 44, 255), shoes=(20, 20, 20, 255), hair_style="short", extras={"helmet"})
DOCTOR = Look(skin=(224, 180, 150, 255), hair=(40, 30, 26, 255), top="doctor", top_col=(236, 240, 244, 255), pants=(120, 170, 220, 255),
              shoes=(240, 240, 240, 255), hair_style="short", extras={"mask"})
BOY = Look(skin=(244, 206, 180, 255), hair=(200, 150, 60, 255), hair_style="messy", top="shirt", top_col=(230, 60, 60, 255), accent=(255, 255, 255, 255),
           pants=(50, 90, 170, 255), child=True, extras={"freckles"})
