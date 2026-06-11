<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1HqQqksmOHB8SrEVXgiHrdUcnG9LfihOz

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Simulador de Navio

O projeto inclui um jogo de simulação de navio em 2D. Com o servidor rodando,
acesse `http://localhost:3000/simulador.html`.

- **W/S** — telégrafo de máquinas (frente/ré)
- **A/D** — leme (bombordo/boreste)
- **ESPAÇO** — centrar o leme

Colete as 5 boias na ordem indicada e atraque no cais com menos de 2 nós.
Em telas de toque, use os botões na tela.

## Offloading Tandem — VLCC × FPSO Peregrino

Simulador de manobra de amarração em tandem de um VLCC ao FPSO Peregrino,
com offloading completo. Com o servidor rodando, acesse
`http://localhost:3000/vlcc.html`.

**Cenário configurável na tela inicial:**
- Condição de carga do VLCC (lastro, meia carga ou quase cheio)
- Vento de 0 a 35 nós, com direção
- Altura de mar (Hs) de 0,5 a 4,0 m
- Corrente de 0 a 2 nós, com direção

**Recursos simulados:**
- Hawser do FPSO com 150 m (tensão, alarme, abrasão e ruptura)
- Rebocador pela popa com cabo de trabalho de 500 m (força e direção)
- Lancha empurradora (empurra a proa para BB ou BE)
- Lancha de entrega do mensageiro do hawser na proa
- Lancha que segura a linha de mangotes
- VHF canal 16 com o FPSO (autorização, bombeio, ESD, emergências)
- Weathervaning: FPSO e VLCC giram conforme o vento muda durante o offloading
- Batida no casco, ruptura de mangote/hawser e vazamento de óleo no mar

**Controles:**
- `A`/`D` — leme em passos de 10° (BB/BE) · `ESPAÇO` — leme a meio
- `W`/`S` — telégrafo: muito devagar, devagar, meia força e toda força (AV/RÉ)
- `T` — força do rebocador · `G` — direção do reboque
- `1`/`2`/`3` — lancha empurradora (BB / parar / BE)
- `M` — lancha do mensageiro · `H` — hawser · `N` — mangotes · `O` — bombeio
- `V` — VHF · `F` — acelerar o tempo · `P` — pausa · `+`/`-` — zoom
