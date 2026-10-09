# Deploy

Um comando, tres passadas, nenhuma URL escrita a mao.

```powershell
.\infra\deploy.ps1 -Verificar   # so confere os pre-requisitos
.\infra\deploy.ps1              # publica backend e frontend
```

## Por que um script e nao os comandos do README

O README da raiz mostra os `gcloud run deploy` crus, e eles funcionam — mas
escondem um no. O backend precisa da URL do frontend para o `CORS_ORIGINS`,
e o frontend precisa da URL do backend para o `NEXT_PUBLIC_API_URL`. Nenhuma
das duas existe antes do primeiro deploy.

Na mao isso vira: deploya, copia a URL, edita o comando, deploya de novo,
copia a outra URL, volta e corrige o primeiro. Toda vez. O script faz as
tres passadas e **le as URLs de volta** do Cloud Run em vez de adivinhar o
formato:

1. Backend sobe com um CORS provisorio
2. Frontend sobe com a URL real do backend, embutida no bundle
3. Backend e atualizado com a URL real do frontend

## O que ele resolve alem disso

**Encontra o gcloud e conserta o Python.** O alias `python.exe` da Microsoft
Store sequestra a chamada e o gcloud morre com "Python nao foi encontrado".
O script aponta `CLOUDSDK_PYTHON` para o Python embutido no proprio SDK, sem
precisar mexer nas configuracoes do Windows.

**Confere a conta antes de comecar.** Deploy com a conta errada falha tarde
e com mensagem ruim. O script checa que a `CONTA` do `deploy.env` esta
autenticada e enxerga o projeto — e para com uma instrucao clara se nao.

**Para cedo se o projeto nao tem faturamento.** Cloud Run, Cloud Build e
Artifact Registry so ligam em projeto com conta de faturamento vinculada
(plano Blaze). Sem essa checagem o deploy morre la na frente, no `services
enable`, com uma mensagem que fala de "API desativada" e nao diz a causa
real. O script confere antes e imprime o link para vincular.

**Liga `identitytoolkit.googleapis.com`.** O README nao menciona, mas
`app/core/security.py` chama `verify_id_token(token, check_revoked=True)`, e
o `check_revoked` le o registro do usuario no Firebase Auth. Sem essa API a
primeira requisicao autenticada falha com 403 — um erro que nao parece ter
nada a ver com a causa.

**Da os dois papeis a service account.** `roles/datastore.user` para o
Firestore (o README cita) e `roles/firebaseauth.viewer` para o
`check_revoked` (o README nao cita).

**Usa `--set-build-env-vars` no frontend.** As `NEXT_PUBLIC_*` sao embutidas
no bundle durante o build, nao lidas em runtime. Passar como env do servico
nao teria efeito nenhum no JavaScript que chega ao navegador — o site
subiria e o login quebraria sem erro obvio.

**Poe um teto de instancias.** O padrao do Cloud Run e 100 instancias por
servico — ordens de grandeza acima do que uma igreja usa, e sem teto um
pico (ou abuso do formulario publico) vira conta no fim do mes. O
`MAX_INSTANCIAS` do `deploy.env` vale para os dois servicos; o padrao e 5
e deixar vazio volta ao comportamento do Cloud Run.

## Arquivos

| Arquivo | Papel |
|---|---|
| `deploy.ps1` | o script |
| `deploy.env` | configuracao real — **fora do git** |
| `deploy.env.example` | modelo para quem clonar o repo |
| `../backend/.gcloudignore` | o que nao sobe do backend |
| `../frontend/.gcloudignore` | idem, e barra `node_modules/` e `.env.local` |

O `deploy.env` deixa as `NEXT_PUBLIC_FIREBASE_*` vazias de proposito: o
script le de `frontend/.env.local`, que ja e a fonte da verdade. Sao as
mesmas em local e producao, e duplicar so criaria mais um lugar para
desatualizar. Se precisar sobrescrever, preencha no `deploy.env` — ele vence.

## O build nao roda nesta maquina

`--source` manda um tarball do diretorio para o **Cloud Build**, que monta o
container na infraestrutura do Google. Nao precisa de Docker local nem de
espaco em disco para imagens. Por isso os `.gcloudignore` importam: sem
eles, o `node_modules/` inteiro viajaria no upload.

## Depois do primeiro deploy

Tres coisas manuais, uma vez so, no console do Firebase:

1. **Authentication > Sign-in method > E-mail/senha**: ativar
2. **Authentication > Settings > Authorized domains**: adicionar o host do
   site. Sem isso o Firebase recusa o login vindo do dominio `.run.app`
3. Entrar em `/entrar` com um e-mail de `BOOTSTRAP_ADMIN_EMAILS`

O script imprime o host exato a adicionar no passo 2.

## Regras e indices do Firestore

Sao um deploy separado, e nao entram neste script porque mudam em outra
frequencia — so quando voce mexe nas regras ou adiciona um indice:

```
firebase deploy --only firestore:rules,firestore:indexes --project inadmav
```
