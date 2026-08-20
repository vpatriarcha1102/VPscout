# VPScouts — Plataforma de Scout de Futsal

App de scout, treinos, atletas e estatísticas de futsal. Pode ser instalado
na tela inicial do celular como um app (PWA) e — se você seguir o passo 3
abaixo — todo mundo (você e os alunos) vê os mesmos dados, em tempo real,
cada um no seu próprio aparelho.

> **Atalho**: se você preferir, crie o projeto Firebase (passo 3.1 a 3.5) e
> cole as 6 chaves que aparecerem de volta na conversa com o Claude — ele
> preenche o `.env` pra você e devolve o projeto já pronto, sem precisar
> mexer em arquivo nenhum na mão.

## 1. Colocar no GitHub

1. Crie uma conta em [github.com](https://github.com) se ainda não tiver.
2. Clique em **New repository**, dê um nome (ex: `vpscouts`) e crie (pode
   deixar público ou privado).
3. No seu computador, dentro desta pasta, rode:
   ```bash
   git init
   git add .
   git commit -m "Primeira versão do VPScouts"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/vpscouts.git
   git push -u origin main
   ```
   (troque `SEU_USUARIO` pelo seu usuário do GitHub)

## 2. Publicar o site pelo Netlify

Como você já usa o Netlify, é o caminho mais simples:

1. Acesse [app.netlify.com](https://app.netlify.com) e entre com sua conta.
2. Clique em **Add new site → Import an existing project**.
3. Escolha **GitHub** e selecione o repositório que você acabou de criar
   (passo 1).
4. O Netlify já detecta as configurações sozinho pelo arquivo
   `netlify.toml` incluso neste projeto (comando `npm run build`, pasta
   `dist`). Não precisa mudar nada — clique em **Deploy site**.
5. Depois do deploy, o Netlify te dá uma URL (algo como
   `https://nome-aleatorio.netlify.app`). Você pode trocar esse nome em
   **Site settings → Change site name**.

A partir daí, todo `git push` que você fizer no repositório publica uma
nova versão automaticamente.

### Alternativas: GitHub Pages ou Vercel
Se preferir, este projeto também já vem pronto para
[GitHub Pages](https://pages.github.com) (workflow em
`.github/workflows/deploy.yml` — ative em **Settings → Pages → Source →
GitHub Actions**, e troque `base: "/"` por `base: "/nome-do-repositorio/"`
no `vite.config.js`) ou para [Vercel](https://vercel.com) (mesmo processo
de importar o repositório do GitHub).

## 3. Sincronizar entre dispositivos (todos verem os mesmos dados) — IMPORTANTE

**Sem este passo, cada aparelho (o seu, o de cada aluno) guarda os dados só
pra si mesmo — foi exatamente o que aconteceu no seu teste pelo Netlify.**
Pra que o que você cadastra apareça pros alunos automaticamente, os dados
precisam ficar num lugar compartilhado na nuvem, não só no navegador de cada
um. Este projeto já vem pronto pra usar o **Firebase** (do Google — tem
plano gratuito bem generoso, suficiente pra uma escolinha de futsal usar à
vontade). Leva uns 10 minutos a primeira vez:

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
   e entre com uma conta Google.
2. Clique em **Adicionar projeto**, dê um nome (ex: `vpscouts`) e crie
   (pode desativar o Google Analytics, não é necessário).
3. No menu lateral, clique em **Firestore Database** → **Criar banco de
   dados**. Escolha uma localização (qualquer uma próxima do Brasil serve)
   e comece em **modo de teste** (production mode também funciona, mas
   você vai precisar ajustar as regras — veja abaixo).
4. Ainda no console, clique no ícone de engrenagem → **Configurações do
   projeto**. Em **Seus apps**, clique no ícone `</>` (Web) pra criar um
   app web. Dê um nome qualquer e clique em **Registrar app**.
5. O Firebase vai mostrar um bloco de código com `apiKey`, `authDomain`,
   `projectId` etc. Copie esses valores.
6. Nesta pasta do projeto, copie o arquivo `.env.example` para um novo
   arquivo chamado `.env` e cole os valores que você copiou:
   ```
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=vpscouts-xxxxx.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=vpscouts-xxxxx
   VITE_FIREBASE_STORAGE_BUCKET=vpscouts-xxxxx.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123
   ```
7. Nas **regras do Firestore** (aba **Regras**, dentro de Firestore
   Database), cole isto e publique:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /vpscouts_kv/{document} {
         allow read, write: if true;
       }
     }
   }
   ```
   Isso libera leitura e escrita pra quem tiver o link do app — como o
   próprio app já separa "treinador" (edita) de "aluno" (só vê) por PIN,
   isso é suficiente pra uma escolinha. Não é uma segurança de nível
   bancário, mas ninguém encontra os dados sem o link do seu app.
8. Rode `npm install` de novo (pra baixar o pacote do Firebase) e depois
   `npm run dev` pra testar localmente — se cadastrar um jogo e abrir o
   app em outra aba, o jogo já deve aparecer lá também, ao vivo.
9. **No Netlify**: vá em **Site settings → Environment variables → Add a
   variable** e crie as 6 (mesmos nomes do `.env`, ex: `VITE_FIREBASE_API_KEY`,
   com o valor correspondente). Depois vá em **Deploys → Trigger deploy →
   Deploy site** pra publicar de novo já com as chaves.
   **Se estiver publicando pelo GitHub Pages**: vá em **Settings → Secrets
   and variables → Actions** no repositório e crie um "Repository secret"
   pra cada uma das 6 variáveis. Depois é só dar `git push` de novo.

Pronto — a partir daqui, você cadastra um jogo ou atleta no seu celular, e
qualquer aluno com o link (e o PIN dele) já vê a informação no aparelho
dele, sem precisar fazer nada.

> Sem esse passo o app continua funcionando normalmente (cai sozinho pra
> localStorage), só que cada aparelho fica isolado — foi o comportamento
> que você viu no teste do Netlify.

## 4. Rodar localmente (opcional, pra testar antes de publicar)

```bash
npm install
npm run dev
```
Abre em `http://localhost:5173`.

## 5. Instalar na tela inicial do celular ("Adicionar à tela de início")

Depois que o site estiver publicado (passo 2), acesse a URL pelo celular:

**Android (Chrome):**
1. Abra o link do app no Chrome.
2. Toque no menu (⋮) no canto superior direito.
3. Toque em **Adicionar à tela inicial** (ou **Instalar app**, se aparecer).

**iPhone/iPad (Safari):**
1. Abra o link do app no Safari (precisa ser no Safari, não funciona no Chrome do iPhone).
2. Toque no ícone de compartilhar (o quadrado com uma seta pra cima).
3. Toque em **Adicionar à Tela de Início**.

Depois disso, o VPScouts aparece como um ícone normal na tela do celular
(um ícone próprio, diferente do padrão do navegador) e abre em tela cheia,
sem a barra do navegador.

Envie o mesmo link para os alunos — cada um instala no próprio celular e
usa a **Área do Aluno** (com o PIN que você cadastrar no perfil dele) pra
ver os próprios números, sem poder editar nada — e agora, com o Firebase
configurado (passo 3), vendo os mesmos dados que você lançou.

## 6. Backup

O app já faz um backup automático toda semana (guarda as últimas 8 cópias)
e você também pode, a qualquer momento, tocar no ícone de escudo no topo
da tela (só aparece pra você, como treinador) para:
- Fazer um backup manual na hora
- Baixar uma cópia `.json` no seu celular/computador
- Restaurar um backup anterior, ou um arquivo `.json` salvo por você

Vale baixar uma cópia de vez em quando e guardar em algum lugar seu (Drive,
e-mail etc.) como segurança extra, independente do backup automático.

