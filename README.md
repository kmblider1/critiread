# CritiRead

CTDF asosidagi tanqidiy fikrlash platformasi (DSc dissertatsiyasi amaliy komponenti).
Jonli: https://critiread.ibratprint.uz

## Arxitektura
- `public/` — statik frontend (`index.html`, `style.css`, `data.js` ochiq mazmun, `app.js` mantiq)
- `functions/api/[[path]].js` — Cloudflare Pages Functions (API), D1 bazasi (`DB` binding)
- `functions/_content.js` — mashq/test savollari va **javob kalitlari (faqat serverda)**
- `schema.sql` — D1 sxemasi · `wrangler.toml` — sozlama (D1 `critiread`)
- `tools/` — `api-test.mjs` (integratsion sinov), `extract-content.js`, `balance-keys.mjs`, `split-frontend.js`

## Invariantlar
1. A=5,B=4,C=3,D=2; CT% → baho: 90→5, 70→4, 60→3, aks holda 2
2. Ikki mustaqil oqim: rubrika → CT% va profil; PRE/POST diagnostika → faqat Δ va Cohen's d (bahoga kirmaydi)
3. Javob kalitlari frontendga hech qachon yuborilmaydi

## Lokal ishga tushirish va sinov
```bash
npx wrangler d1 execute critiread --local --persist-to .wrangler/t --file=schema.sql
npx wrangler pages dev --port 8789 --persist-to .wrangler/t
BASE=http://localhost:8789 node tools/api-test.mjs   # bo'sh bazada: 57 sinov
```

## Birinchi sozlash (jonli)
Bazada foydalanuvchi bo'lmasa, `/#/login` o'qituvchi hisobini yaratish formasini ko'rsatadi
(parolni egasining o'zi kiritadi). Keyin o'qituvchi talaba hisoblarini «Talabalar» bo'limida yaratadi.

## Deploy
`git push` → Cloudflare Pages `critiread-app` (branch `main`) avtomatik chiqaradi.
