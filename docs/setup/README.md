# Guia de Instalação

## Visão geral

A aplicação executável é `backend-php`. Serve:

- A REST API em `/api/*`
- O website estático a partir de `frontend/`

O backend requer uma base de dados MySQL e um ficheiro `.env` na pasta `backend-php/`.

## Requisitos

- PHP 8.1+
- Composer
- MySQL 8+ ou servidor compatível
- Servidor web (Apache, Nginx) ou servidor embutido do PHP para desenvolvimento

## Configuração do ambiente

Copiar o template:

```bash
cp backend-php/.env.example backend-php/.env
```

De seguida, configurar os seguintes valores:

| Variável | Obrigatório | Finalidade |
| --- | --- | --- |
| `JWT_SECRET` | Sim | Assina os tokens JWT de acesso |
| `DB_HOST` | Sim | Nome do servidor ou IP da base de dados |
| `DB_PORT` | Sim | Porta da base de dados (predefinição: `3306`) |
| `DB_USER` | Sim | Nome de utilizador da base de dados |
| `DB_PASSWORD` | Não | Palavra-passe da base de dados |
| `DB_NAME` | Sim | Nome da base de dados a criar/utilizar (predefinição: `afv_booking`) |

Arranque opcional do administrador principal:

| Variável | Obrigatório | Finalidade |
| --- | --- | --- |
| `PRIMARY_ADMIN_NAME` | Não | Nome de apresentação do administrador principal |
| `PRIMARY_ADMIN_EMAIL` | Recomendado | E-mail utilizado para encontrar ou criar o administrador principal |
| `PRIMARY_ADMIN_PASSWORD` | Recomendado | Palavra-passe em texto simples ou hash bcrypt |
| `PRIMARY_ADMIN_VATSIM_CID` | Não | CID VATSIM opcional |
| `PRIMARY_ADMIN_FLIGHT_HOURS` | Não | Horas de voo iniciais |
| `PRIMARY_ADMIN_POINTS` | Não | Pontos iniciais |

Dados de preços opcionais:

| Variável | Obrigatório | Finalidade |
| --- | --- | --- |
| `ALPHA_VANTAGE_KEY` | Não | Obtém dados do Brent crude para ajustes de preço dinâmico |

## Instalação

A partir da pasta `backend-php/`:

```bash
cd backend-php
composer install
```

## Certificados SSL (CA Bundle)

O backend utiliza o ficheiro [`backend-php/cacert.pem`](../../backend-php/cacert.pem) incluído no repositório para verificar ligações HTTPS externas (API VATSIM e METAR). O ficheiro é o pacote de certificados raiz Mozilla e é referenciado automaticamente pelo código.

### Windows

O PHP no Windows não inclui um pacote de certificados SSL por omissão. É necessário configurar o `php.ini` para que **todas** as ligações HTTPS funcionem corretamente:

1. Descobrir o caminho do `php.ini` ativo:

```bash
php -r "echo php_ini_loaded_file();"
```

2. Abrir esse ficheiro e definir as seguintes opções (ajustar o caminho conforme a instalação):

```ini
curl.cainfo = "C:\php-x.x.x\cacert.pem"
openssl.cafile="C:\php-x.x.x\cacert.pem"
```

3. Copiar o ficheiro `cacert.pem` para esse local:

```powershell
Copy-Item "backend-php\cacert.pem" "C:\php-x.x.x\cacert.pem"
```

4. Reiniciar o servidor PHP.

### Linux / macOS

Nenhuma configuração adicional necessária. O sistema operativo disponibiliza o pacote de certificados automaticamente.

## Executar o projeto

### Servidor embutido do PHP (desenvolvimento)

```bash
cd backend-php
php -S localhost:8080 -t public
```

A URL predefinida é `http://localhost:8080`.

### Apache / Nginx (produção)

Configurar o servidor web para apontar o `document root` para `backend-php/public/`. O ficheiro `backend-php/public/.htaccess` já inclui as regras de reescrita necessárias para o Apache.

## O que acontece no arranque

O fluxo de arranque da aplicação está implementado em [`backend-php/public/index.php`](../../backend-php/public/index.php) e [`backend-php/src/Repositories/Database.php`](../../backend-php/src/Repositories/Database.php).

No arranque, a aplicação:

1. Carrega `.env` a partir de `backend-php/`.
2. Liga-se ao MySQL e cria a base de dados configurada se necessário.
3. Executa o schema SQL a partir de [`database/mysql.sql`](../../database/mysql.sql).
4. Aplica verificações de compatibilidade ao nível do código para algumas colunas e índices.
5. Inicializa aeroportos, aeronaves, horários de rotas e estatísticas da companhia se a base de dados estiver vazia.
6. Cria ou atualiza a conta do administrador principal se as variáveis de arranque estiverem presentes.
7. Inicia o servidor HTTP Slim 4.

## Primeiro acesso de administrador

Não existe nenhuma conta de administrador predefinida implementada no código.

Para garantir acesso de administrador num ambiente novo, definir:

- `PRIMARY_ADMIN_EMAIL`
- `PRIMARY_ADMIN_PASSWORD`

No arranque, a aplicação irá:

- criar esse utilizador como administrador principal, ou
- atualizar o utilizador existente correspondente e elevá-lo a administrador principal

## Resolução de problemas

### O servidor termina durante o arranque

Verificar:

- O MySQL está em execução
- As credenciais da base de dados em `.env` estão corretas
- O utilizador configurado tem permissão para criar ou aceder à base de dados pretendida

### O website carrega mas as chamadas à API falham

Verificar:

- O backend arrancou sem erros de base de dados
- `http://localhost:8080/api/health` devolve uma resposta JSON válida

### A página Live VATSIM mostra 0 pilotos mesmo havendo pilotos online

Em Windows, isto indica normalmente um problema com os certificados SSL do PHP, que impede o backend de comunicar com `data.vatsim.net` e `aviationweather.gov`.

Verificar:

- O ficheiro `backend-php/cacert.pem` está presente (executar `git pull` se necessário)
- As opções `curl.cainfo` e `openssl.cafile` estão definidas no `php.ini` (ver secção [Certificados SSL](#certificados-ssl-ca-bundle))
- O servidor PHP foi reiniciado após alterações ao `php.ini`

Para confirmar que o PHP consegue comunicar com o VATSIM após a correção:

```bash
php -r "
\$ch = curl_init('https://data.vatsim.net/v3/vatsim-data.json');
curl_setopt(\$ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt(\$ch, CURLOPT_TIMEOUT, 8);
\$body = curl_exec(\$ch);
echo curl_error(\$ch) ?: 'OK — ' . strlen(\$body) . ' bytes';
curl_close(\$ch);
"
```

### Não existe nenhuma conta de administrador

Definir `PRIMARY_ADMIN_EMAIL` e `PRIMARY_ADMIN_PASSWORD` e reiniciar o servidor.

## Estrutura da base de dados

O schema completo encontra-se em [`database/mysql.sql`](../../database/mysql.sql).

Tabelas principais:

| Tabela | Finalidade |
| --- | --- |
| `users` | Contas de utilizadores |
| `aircraft` | Frota de aeronaves |
| `airports` | Dados de aeroportos |
| `routes` | Rotas de voo |
| `route_schedules` | Horários e números de voo |
| `bookings` | Reservas |
| `booking_passengers` | Detalhes dos passageiros por reserva |
| `booking_segments` | Segmentos do itinerário por reserva |
| `booked_seats` | Ocupação de lugares por voo e data |
| `airline_stats` | Perfil e estatísticas da companhia aérea |
