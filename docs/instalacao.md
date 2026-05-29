# Instalação e Execução

## Visão geral

A Africana Virtual Airways é uma aplicação em PHP sem framework. O mesmo projeto serve as páginas web (ficheiros `.php` na raiz) e a REST API (`api/*.php`), partilhando lógica em `includes/`. Não requer Composer nem Node.js.

Em desenvolvimento, todos os pedidos passam pelo `router.php` através do servidor embutido do PHP. Em produção, o `.htaccess` da raiz faz o routing equivalente em Apache.

## Requisitos

* PHP 8.1 ou superior, com as extensões `pdo_mysql`, `openssl` e `curl` (ou `allow_url_fopen` ativo, usado pelas integrações externas).
* MySQL 8 ou superior, ou um servidor compatível.
* Em produção, Apache com `mod_rewrite` ativo (o repositório inclui o `.htaccess`).

## Configuração do ambiente

Copiar o template e preencher os valores:

```bash
cp .env.example .env
```

| Variável | Obrigatória | Finalidade |
|---|---|---|
| `JWT_SECRET` | Sim | Segredo que assina os tokens JWT (usar uma string aleatória longa) |
| `DB_HOST` | Sim | Servidor MySQL (predefinição `127.0.0.1`) |
| `DB_PORT` | Não | Porta MySQL (predefinição `3306`) |
| `DB_USER` | Sim | Utilizador MySQL |
| `DB_PASSWORD` | Não | Palavra-passe MySQL |
| `DB_NAME` | Sim | Nome da base de dados (predefinição `afv_booking`) |
| `CORS_ORIGIN` | Não | Origem permitida para CORS (predefinição `*`) |
| `ALPHA_VANTAGE_KEY` | Não | Chave para o preço do Brent crude no pricing dinâmico. Sem ela, é usado o valor de 80 USD por barril |

### Administrador principal

Para garantir uma conta de administrador num ambiente novo, definir as variáveis seguintes. No arranque, a conta é criada ou, se já existir uma conta com o mesmo email, é elevada a administrador principal.

| Variável | Finalidade |
|---|---|
| `PRIMARY_ADMIN_EMAIL` | Email do administrador principal |
| `PRIMARY_ADMIN_PASSWORD` | Palavra-passe (texto simples ou hash bcrypt) |
| `PRIMARY_ADMIN_NAME` | Nome de apresentação |
| `PRIMARY_ADMIN_VATSIM_CID` | CID VATSIM (opcional) |
| `PRIMARY_ADMIN_FLIGHT_HOURS`, `PRIMARY_ADMIN_POINTS` | Valores iniciais de perfil |

As variáveis `NODE_ENV` e `PORT` presentes no `.env.example` são legado e não são utilizadas pela aplicação.

## Executar em desenvolvimento

A partir da raiz do projeto:

```bash
php -S localhost:3000 router.php
```

Abrir `http://localhost:3000`. O `router.php` trata das páginas, dos endpoints `/api/*` e dos ficheiros estáticos.

### O que acontece no primeiro arranque

Na primeira vez que uma página ou endpoint acede à base de dados, através de `includes/db.php`, a aplicação:

1. Carrega o `.env`.
2. Liga-se ao MySQL e cria a base de dados configurada, se não existir.
3. Executa o schema de [`../database/mysql.sql`](../database/mysql.sql).
4. Aplica migrações leves de colunas e índices e faz backfill de reservas anteriores, quando aplicável.
5. Cria ou atualiza o administrador principal, se as variáveis `PRIMARY_ADMIN_*` estiverem definidas.
6. Popula os dados de seed (aeroportos, frota, rotas, horários e estatísticas), caso as tabelas estejam vazias.

O processo é idempotente, pelo que é possível arrancar com a base de dados já populada sem duplicar dados.

## Executar em produção (Apache)

Apontar o `DocumentRoot` para a raiz do projeto. O `.htaccess` incluído:

* encaminha `api/<grupo>(/...)` para o respetivo `api/<grupo>.php`;
* transforma `/<pagina>` em `<pagina>.php`, permitindo URLs sem extensão;
* serve ficheiros e pastas existentes diretamente;
* bloqueia o acesso HTTP a `includes/`, `data/` e `database/`.

Garantir que o `mod_rewrite` está ativo e que o ficheiro `.env` fica fora do alcance público.

## Certificados SSL em Windows

As integrações externas (VATSIM, METAR e Alpha Vantage) usam pedidos HTTPS. Em Windows, o PHP não traz por omissão um conjunto de certificados raiz, o que pode fazer falhar essas chamadas. O sintoma típico é o Live Flight Map mostrar 0 pilotos mesmo havendo voos online.

Para resolver:

1. Descarregar o `cacert.pem` da Mozilla em https://curl.se/ca/cacert.pem
2. Descobrir o `php.ini` ativo:

   ```bash
   php -r "echo php_ini_loaded_file();"
   ```

3. Definir nesse ficheiro o caminho do bundle, ajustando conforme a instalação:

   ```ini
   openssl.cafile = "C:\php\cacert.pem"
   curl.cainfo    = "C:\php\cacert.pem"
   ```

4. Reiniciar o servidor PHP.

Em Linux e macOS normalmente não é necessária configuração adicional, uma vez que o sistema operativo disponibiliza os certificados.

## Resolução de problemas

**O arranque falha com erro de base de dados.** Confirmar que o MySQL está em execução, que as credenciais no `.env` estão corretas e que o utilizador tem permissão para criar ou aceder à base de dados.

**As páginas carregam mas a API falha.** Confirmar que `http://localhost:3000/api/health` devolve `{"status":"ok", ...}`.

**O Live Flight Map mostra 0 pilotos.** Em Windows, é quase sempre o problema de certificados SSL descrito acima. Configurar `openssl.cafile` e `curl.cainfo` e reiniciar o servidor.

**Não é possível entrar no backoffice.** Definir `PRIMARY_ADMIN_EMAIL` e `PRIMARY_ADMIN_PASSWORD` no `.env` e reiniciar o servidor.

## Estrutura da base de dados

O detalhe completo encontra-se em [`base-de-dados.md`](base-de-dados.md). O schema executável está em [`../database/mysql.sql`](../database/mysql.sql).
