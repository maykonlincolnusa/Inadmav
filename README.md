# inAdmav

Sistema de gestão da Igreja ADMAV — membresia, cargos, aniversariantes,
células, eventos e financeiro.

O protótipo original em HTML está preservado em
[docs/prototipo-inadmav.html](docs/prototipo-inadmav.html) e serve de
referência visual e funcional.

---

## De onde veio o desenho

O sistema foi construído em cima de dores concretas relatadas pela
secretaria da igreja. Vale registrar porque elas explicam decisões que
parecem estranhas fora de contexto:

| Dor relatada | Como o sistema responde |
|---|---|
| "precisa ter nome, **cargo**, nascimento, endereço" | Campos no cadastro; cargo é entidade própria |
| "uma aba pros ministros, um pros diáconos, um pra membros" | Cargos agrupados — "Ministro" é grupo (Pastor/Evangelista/Presbítero), não cargo |
| "no nome de cada um, a informação individual" | Ficha em `/pessoas/[id]` |
| "listagem de **aniversariantes do mês**, fica muito complicado manualmente" | Tela dedicada, com navegação entre meses, cópia e impressão |
| "a intenção é que **otimize** isso" | Formulário público: a pessoa se cadastra sozinha |

Duas decisões técnicas vêm direto daí:

**O ano de nascimento é opcional.** Muita gente não sabe ou não informa. Se
o campo travasse, a secretária desistiria e voltaria ao caderno. Guardamos
`nasc_dia`, `nasc_mes` e `nasc_ano` separados — dia e mês bastam para a
lista de aniversariantes, e `nasc_mes` indexado torna "quem faz aniversário
em setembro" uma consulta direta.

**Cargo e situação são eixos diferentes.** Alguém é *Membro* **e**
*Presbítero* ao mesmo tempo. Um campo só não daria conta.

> ⚠️ **A lista de cargos precisa ser confirmada com a liderança da ADMAV.**
> A nomenclatura varia entre ministérios. O padrão está em
> `backend/app/models/enums.py` (`CARGOS_PADRAO`) e é editável em
> Configurações, sem deploy.

---

## Arquitetura

```
Next.js 15 (Cloud Run)  ──HTTPS+ID token──>  FastAPI (Cloud Run)
       │                                            │
       └── Firebase Auth (login)                    └── Firestore
```

O frontend **não lê o Firestore direto** — tudo passa pela API, que valida
papel e igreja. As regras em `firebase/firestore.rules` são a segunda
tranca.

```
backend/    FastAPI + Firestore
  app/core/         config, firebase, security (papéis)
  app/models/       enums do domínio
  app/schemas/      Pydantic (entrada/saída)
  app/repositories/ acesso ao Firestore
  app/services/     regra de negócio (aniversariantes)
  app/api/v1/       rotas
  scripts/          criar_igreja.py
frontend/   Next.js 15 + Tailwind
  src/app/          páginas (App Router)
  src/components/   UI, logo, formulários
  src/lib/          api, firebase, sessão, tipos, formato
firebase/   regras e índices do Firestore
docs/       protótipo HTML original
```

### Papéis

| Papel | Vê pessoas | Edita pessoas | Vê financeiro | Gerencia acessos |
|---|:--:|:--:|:--:|:--:|
| Administrador | ✅ | ✅ | ✅ | ✅ |
| Secretaria | ✅ | ✅ | — | — |
| Tesoureiro | ✅ | — | ✅ | — |
| Líder de célula | só a dele | — | — | — |
| Leitor | ✅ | — | — | — |

Ficha de membro é dado pessoal sensível pela LGPD (revela filiação
religiosa) — daí a separação.

---

## Rodando local

### 1. Firebase

No [console](https://console.firebase.google.com): crie o projeto, ative
**Authentication → E-mail/senha** e o **Firestore**.

### 2. Backend

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate      # Windows
pip install -r requirements.txt
cp .env.example .env        # preencha GCP_PROJECT_ID e BOOTSTRAP_ADMIN_EMAILS
# Recomendado para credenciais locais: gcloud auth application-default login
python scripts/criar_igreja.py --id sede --nome "Igreja ADMAV" --sigla ADMAV
uvicorn app.main:app --reload --port 8080
```

Docs da API: http://localhost:8080/docs

### 3. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local    # preencha as chaves do Firebase Web
npm run dev
```

http://localhost:3000

### 4. Primeiro acesso

1. Crie sua conta no Firebase Auth (Console → Authentication → Adicionar)
2. Entre em `/entrar` — o e-mail em `BOOTSTRAP_ADMIN_EMAILS` vira admin
3. Convide o resto da equipe em Configurações

---

## Deploy no Google Cloud

```bash
export PROJETO=seu-projeto
export REGIAO=southamerica-east1        # São Paulo

gcloud config set project $PROJETO
gcloud services enable run.googleapis.com firestore.googleapis.com \
  artifactregistry.googleapis.com cloudbuild.googleapis.com

# Regras e índices do Firestore
# The versioned firebase.json points at firebase/firestore.*.
firebase deploy --project $PROJETO --only firestore:rules,firestore:indexes

# --- Backend ---
gcloud run deploy inadmav-api \
  --source backend --region $REGIAO --allow-unauthenticated \
  --set-env-vars "ENV=prod,GCP_PROJECT_ID=$PROJETO,CORS_ORIGINS=https://SEU-FRONT.run.app,BOOTSTRAP_ADMIN_EMAILS=seu@email.com"

# --- Frontend ---
gcloud run deploy inadmav-web \
  --source frontend --region $REGIAO --allow-unauthenticated \
  --set-build-env-vars "NEXT_PUBLIC_API_URL=https://SEU-BACK.run.app,NEXT_PUBLIC_FIREBASE_API_KEY=...,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...,NEXT_PUBLIC_FIREBASE_PROJECT_ID=$PROJETO,NEXT_PUBLIC_FIREBASE_APP_ID=..."
```

A service account do Cloud Run precisa do papel **Cloud Datastore User**.
Depois do primeiro deploy, atualize `CORS_ORIGINS` no backend com a URL
real do frontend.

> Os índices do Firestore (`firebase/firestore.indexes.json`) precisam
> existir antes do primeiro uso — sem eles, a consulta de aniversariantes
> falha com "índice necessário".

---

## Identidade visual

Monocromática, derivada da logo (chama branca sobre preto). A hierarquia
vem de peso tipográfico, espaço e contraste — não de cor. O botão principal
é o inverso do fundo. A única exceção é o vermelho de perigo: remover um
membro é irreversível e sinalizar isso só com tipografia seria irresponsável.

Temas claro e escuro, seguindo o aparelho e com alternância manual.

A marca está desenhada em SVG em `src/components/logo.tsx`, para escalar de
16px a tela cheia herdando a cor do texto. Para usar o arquivo oficial,
coloque-o em `frontend/public/logo.svg` e troque `<Marca />` por
`<img src="/logo.svg" />`.

---

## O que ficou de fora

Deliberadamente, para caber no primeiro ciclo de uso real:

- **Frequência/presença** em cultos e células
- **Importação de planilha** — hoje o volume inicial entra pelo formulário
  ou na mão
- **Recibo de dízimo em PDF** — o vínculo com a pessoa já é gravado
- **Relatórios e comparativos** — o financeiro mostra o mês corrente
- **Escalas de ministério**

A ordem depois do primeiro uso deve sair do que a secretaria pedir, não
desta lista.
