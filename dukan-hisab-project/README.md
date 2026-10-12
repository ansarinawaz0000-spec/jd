# 🧵 दुकान हिसाब (Standalone)

Kapde ki dukaan + silayi ka hisab-kitaab app — apne server par chalao, apna data apne paas.

**Kya-kya hai:**
- 🏠 घर — कुल बिक्री, मिल चुका, लेना बाकी
- 👤 ग्राहक — नाम, मोबाइल, शर्ट-पैंट के नाप (बदलने पर update होता है, duplicate नहीं)
- 🧾 ऑर्डर — हर कपड़े (पैंट/शर्ट/कोट/कुर्ता/पैजामा) के लिए **अलग कारीगर** + मजदूरी
- ✂️ कारीगर — काम, मजदूरी, दी हुई पेमेंट, बाकी
- 🧵 स्टॉक — कपड़ा (shirting/suiting…) मीटर में, रेट/मीटर, कम-स्टॉक चेतावनी
- 💰 हिसाब — आमदनी/खर्च ledger

**Tech:** Node.js + Express + SQLite (koi build step nahi — `npm install && npm start` bas).

---

## 1. Apne computer par chalao (test ke liye)

```bash
npm install
npm start
```

Phir browser me kholo: **http://localhost:3000**

> Pehli baar app **khaali** khulega — koi demo data nahi hai. Apna asli data dalne ke liye neeche "Data import" dekho.

## 2. Apna purana data import karo

Data file (`dukan-hisab-data-export.json`) is folder ke **bahar** rakho ya path do:

```bash
# default path: ../your_files/dukan-hisab-data-export.json
npm run seed

# ya apna path do:
SEED_FILE=/path/to/dukan-hisab-data-export.json npm run seed
```

## 3. GitHub par dalo

1. [github.com](https://github.com) par naya repository banao (jaise naam: `dukan-hisab`)
2. Is folder me terminal kholo aur:
```bash
git init
git add .
git commit -m "Dukan Hisab app"
git branch -M main
git remote add origin https://github.com/TUMHARA-USERNAME/dukan-hisab.git
git push -u origin main
```
> `TUMHARA-USERNAME` ki jagah apna GitHub username likho.

## 4. Railway par deploy karo (recommended — data bachta hai)

1. [railway.app](https://railway.app) par GitHub se login karo
2. **New Project → Deploy from GitHub repo** → apna `dukan-hisab` repo chuno
3. Deploy hote hi ek public URL milega (Settings → Networking → Generate Domain)
4. **Zaroori — data bachane ke liye:** Project me **+ New → Volume** jodo, mount path rakho `/data`
5. Service ke **Variables** me jao aur add karo: `DB_PATH` = `/data/dukan-hisab.db`
6. Phir terminal (ya deploy ke baad) me ek baar data import karo — Railway dashboard → service → **Settings** me "Run a command" jaisa option ho to `npm run seed` chalao, ya local se seed karke DB file upload karo (neeche backup section dekho).

> ⚠️ **Bina volume ke** Railway par bhi restart/deploy par data ud jayega. Volume lagana mat bhoolna!

## 5. Render par deploy karo

1. [render.com](https://render.com) par GitHub se login karo
2. **New → Web Service** → repo chuno. Ye `render.yaml` apne aap padh liya jayega.
3. ⚠️ **Render ke FREE plan par data save NAHI rehta** — har restart par SQLite file reset ho jati hai. Permanent data chahiye to paid plan + disk lagana padega (render.yaml me disk ka commented hissa hai). Isliye **asli dukaan ke liye Railway behtar hai.**

## 6. Mobile par app ki tarah install karo (PWA — Android)

1. Phone ke **Chrome** me apne app ka URL kholo (Railway/Render wala link)
2. Chrome menu (⋮) → **"Add to Home screen"** / **"Install app"** dabao
3. Home screen par 🧵 icon aa jayega — ab ye app ki tarah khulega, full-screen!

## 7. Data ka backup lo

Database ek hi file hai — ise copy kar lo, bas:

- Local: `data/dukan-hisab.db`
- Railway volume: `/data/dukan-hisab.db` (volume se download karke)
- Docker: `docker cp <container>:/data/dukan-hisab.db ./backup.db`

Hafte me ek baar backup le lena — dukaan ka hisab hai, sambhal ke! 💾

## 8. Zaroori baatein

- **Ek hi jagah chalao:** Ya to Muse wala app, ya ye wala — dono me alag-alag data hoga, judenge nahi.
- **Password:** Is version me login nahi hai — link jiske paas, wo khol sakta hai. Apna Railway URL kisi anjaan ko mat do.
- **Port:** `PORT` env var se badal sakte ho (Railway/Render khud set karte hain).
- **Database path:** `DB_PATH` env var se badal sakte ho.
