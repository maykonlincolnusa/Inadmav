# Operacao em producao

Este repositorio configura o aplicativo; os recursos do projeto Google Cloud
precisam ser ativados uma vez por um administrador.

## Identidades e segredos

- Use uma service account exclusiva no Cloud Run da API, com apenas
  `roles/datastore.user` no projeto do Firestore.
- Anexe a service account ao servico com `--service-account`; nao envie um
  arquivo JSON de chave para o Cloud Run.
- Guarde qualquer segredo futuro no Secret Manager. As variaveis
  `NEXT_PUBLIC_*` do Firebase nao sao segredos e pertencem ao build web.

## Protecao do formulario publico

- Habilite Firebase App Check para o app web e valide o cabecalho
  `X-Firebase-AppCheck` somente no POST de cadastro publico.
- Se houver abuso recorrente, publique a API por um Application Load Balancer
  com Cloud Armor e limite de taxa. Nao use `X-Forwarded-For` recebido do
  navegador como uma identidade confiavel.

## Recuperacao e monitoramento

- Ative recuperacao point-in-time e um backup diario do Firestore com a
  retencao definida pela administracao.
- Crie alertas para erro 5xx, latencia p95 e crescimento de respostas 429 no
  cadastro publico.
- Revise logs para garantir que e-mail, telefone, endereco e tokens nunca
  sejam registrados.

## Ambientes e entrega

- Use projetos separados para staging e producao.
- Execute `firebase deploy --project <projeto> --only firestore:rules,firestore:indexes`
  a partir da raiz. O `firebase.json` associa as regras e os indices.
- Antes de cada deploy, execute os testes do backend, typecheck e build do
  frontend. A automacao de CI deve bloquear entregas se qualquer etapa falhar.
