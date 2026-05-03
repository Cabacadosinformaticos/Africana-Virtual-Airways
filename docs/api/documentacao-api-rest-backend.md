# Documentação da API REST: Africana Virtual Airways

## Índice

1. [Introdução](#1-introdução)
2. [Visão Geral](#2-visão-geral)
3. [Autenticação e Autorização](#3-autenticação-e-autorização)
4. [Códigos de Estado HTTP](#4-códigos-de-estado-http)
5. [Variáveis de Ambiente](#5-variáveis-de-ambiente)
6. [Endpoints](#6-endpoints)
   - [6.1 Health](#61-health)
   - [6.2 Autenticação](#62-autenticação)
   - [6.3 Voos](#63-voos)
   - [6.4 Frota](#64-frota)
   - [6.5 Reservas](#65-reservas)
   - [6.6 Administração](#66-administração)
   - [6.7 VATSIM](#67-vatsim)
7. [Modelos de Dados](#7-modelos-de-dados)
8. [Notas Técnicas](#8-notas-técnicas)
9. [Tabela Resumo dos Endpoints](#9-tabela-resumo-dos-endpoints)

---

## 1. Introdução

Este documento descreve a API REST do backend da aplicação **Africana Virtual Airways (AFV)**, uma companhia aérea virtual integrada na rede VATSIM.

A documentação foi elaborada a partir do código real em `backend-php/` e cobre todos os endpoints expostos, os seus parâmetros, os formatos de resposta e os erros esperados. Destina-se a qualquer pessoa que pretenda consumir a API, seja o frontend da aplicação, ferramentas de teste ou integrações externas.

---

## 2. Visão Geral

| Propriedade | Valor |
|---|---|
| Framework | Slim 4 (PHP) |
| URL base | `/api` |
| Formato de dados | JSON |
| Métodos HTTP suportados | `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS` |
| Autenticação | JWT (JSON Web Token) |

### 2.1 CORS

O backend configura automaticamente os seguintes cabeçalhos CORS em todas as respostas:

```
Access-Control-Allow-Origin: <CORS_ORIGIN>
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

O valor de `Access-Control-Allow-Origin` é definido pela variável de ambiente `CORS_ORIGIN` (por omissão: `*`).

Os pedidos `OPTIONS` (preflight) são tratados diretamente e devolvem `200 OK` com os ccabeçalhos CORS.

### 2.2 Formato das respostas

#### Sucesso

A API devolve diretamente o objeto ou array relevante, sem envelope adicional.

```json
{
  "status": "ok",
  "timestamp": "2026-05-03T18:00:00+00:00"
}
```

#### Erro

Em caso de erro, a resposta contém sempre um objeto com a chave `error`.

```json
{
  "error": "Mensagem descritiva do erro"
}
```

---

## 3. Autenticação e Autorização

A API utiliza **JWT (JSON Web Token)** com algoritmo de assinatura **HS256**.

O token deve ser incluído em todos os pedidos que exijam autenticação, no cabeçalho HTTP `Authorization`:

```http
Authorization: Bearer <token>
```

### 3.1 Conteúdo do token

O payload do JWT contém os seguintes campos relevantes:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | int | ID do utilizador |
| `email` | string | Email do utilizador |
| `name` | string | Nome do utilizador |
| `role` | string | Papel: `user` ou `admin` |
| `isPrimaryAdmin` | bool | Se é o administrador principal |
| `iat` | int | Data/hora de emissão (Unix timestamp) |
| `exp` | int | Data/hora de expiração (Unix timestamp) |

### 3.2 Níveis de acesso

| Nível | Descrição |
|---|---|
| **Público** | Não requer autenticação. |
| **Opcional** | O endpoint funciona sem token, mas se um token válido for enviado, o utilizador é associado ao pedido. |
| **Autenticado** | Exige token JWT válido. Devolve `401` se ausente ou inválido. |
| **Admin** | Exige token válido com `role = "admin"`. Devolve `403` caso contrário. |
| **Admin principal** | Exige token válido com `role = "admin"` e `isPrimaryAdmin = true`. |

---

## 4. Códigos de Estado HTTP

| Código | Significado |
|---|---|
| `200 OK` | Pedido processado com sucesso. |
| `201 Created` | Recurso criado com sucesso. |
| `400 Bad Request` | Pedido inválido: dados em falta, formato incorreto ou validação falhada. |
| `401 Unauthorized` | Token ausente, inválido ou expirado. |
| `403 Forbidden` | Autenticado, mas sem permissões para este recurso. |
| `404 Not Found` | O recurso solicitado não existe. |
| `409 Conflict` | Conflito com o estado atual dos dados (ex.: email duplicado, lugar já ocupado). |
| `500 Internal Server Error` | Erro inesperado no servidor. |

---

## 5. Variáveis de Ambiente

Estas variáveis são lidas pelo backend a partir de um ficheiro `.env` na raiz de `backend-php/`.

| Variável | Descrição |
|---|---|
| `JWT_SECRET` | Segredo usado para assinar e validar os tokens JWT. |
| `DB_HOST` | Host da base de dados MySQL. |
| `DB_PORT` | Porta da base de dados MySQL. |
| `DB_USER` | Utilizador da base de dados. |
| `DB_PASSWORD` | Palavra-passe da base de dados. |
| `DB_NAME` | Nome da base de dados. |
| `CORS_ORIGIN` | Origem(ns) permitida(s) para CORS. Por omissão: `*`. |
| `ALPHA_VANTAGE_KEY` | Chave de API para obter o preço do petróleo (Alpha Vantage). |
| `PRIMARY_ADMIN_EMAIL` | Email do administrador principal (criado no arranque se não existir). |
| `PRIMARY_ADMIN_PASSWORD` | Palavra-passe do administrador principal. |
| `PRIMARY_ADMIN_NAME` | Nome do administrador principal. |
| `PRIMARY_ADMIN_VATSIM_CID` | CID VATSIM do administrador principal. |
| `PRIMARY_ADMIN_FLIGHT_HOURS` | Horas de voo iniciais do administrador principal. |
| `PRIMARY_ADMIN_POINTS` | Pontos iniciais do administrador principal. |

---

## 6. Endpoints

### 6.1 Health

#### `GET /api/health`

Verifica se o backend está operacional. Útil para monitorização e verificações de disponibilidade.

- **Autenticação:** Público

##### Resposta `200`

```json
{
  "status": "ok",
  "timestamp": "2026-05-03T18:00:00+00:00"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `status` | string | Sempre `"ok"` quando o servidor responde. |
| `timestamp` | string | Data e hora atual no servidor (ISO 8601). |

---

### 6.2 Autenticação

#### `POST /api/auth/register`

Cria uma nova conta de utilizador. Devolve imediatamente um token JWT para autenticar a sessão sem necessidade de um segundo pedido de login.

- **Autenticação:** Público

##### Corpo do pedido

```json
{
  "name": "Tiago Cabaça",
  "email": "tiago@example.com",
  "password": "Segredo123",
  "vatsimCid": "1234567"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `name` | string | Sim | Nome completo do utilizador. |
| `email` | string | Sim | Endereço de email (deve ser único). |
| `password` | string | Sim | Palavra-passe em texto simples (será armazenada em hash). |
| `vatsimCid` | string | Não | Identificador de piloto na rede VATSIM. |

##### Resposta `201`

```json
{
  "token": "<jwt>",
  "user": {
    "id": 5,
    "name": "Tiago Cabaça",
    "email": "tiago@example.com",
    "vatsimCid": "1234567",
    "role": "user",
    "isPrimaryAdmin": false,
    "createdByUserId": null,
    "joinedAt": "2026-05-03 18:00:00",
    "flightHours": 0,
    "points": 0
  }
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `token` | string | JWT para usar nos pedidos autenticados. |
| `user` | object | Dados completos do utilizador recém-criado. |

##### Erros

| Código | Condição |
|---|---|
| `400` | Falta `name`, `email` ou `password`. |
| `409` | O email já está registado. |

---

#### `POST /api/auth/login`

Autentica um utilizador existente e devolve um token JWT.

- **Autenticação:** Público

##### Corpo do pedido

```json
{
  "email": "tiago@example.com",
  "password": "Segredo123"
}
```

| Campo | Tipo | Obrigatório |
|---|---|---|
| `email` | string | Sim |
| `password` | string | Sim |

##### Resposta `200`

```json
{
  "token": "<jwt>",
  "user": {
    "id": 5,
    "name": "Tiago Cabaça",
    "email": "tiago@example.com",
    "vatsimCid": "1234567",
    "role": "user",
    "isPrimaryAdmin": false
  }
}
```

##### Erros

| Código | Condição |
|---|---|
| `401` | Email não encontrado ou palavra-passe incorreta. |

---

#### `GET /api/auth/me`

Devolve os dados completos do utilizador correspondente ao token JWT fornecido.

- **Autenticação:** Autenticado

##### Resposta `200`

```json
{
  "id": 5,
  "name": "Tiago Cabaça",
  "email": "tiago@example.com",
  "vatsimCid": "1234567",
  "role": "user",
  "isPrimaryAdmin": false,
  "createdByUserId": null,
  "createdByName": null,
  "joinedAt": "2026-05-03 18:00:00",
  "flightHours": 0,
  "points": 0
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | int | ID único do utilizador. |
| `name` | string | Nome do utilizador. |
| `email` | string | Email do utilizador. |
| `vatsimCid` | string\|null | CID VATSIM, se registado. |
| `role` | string | `"user"` ou `"admin"`. |
| `isPrimaryAdmin` | bool | Se é o administrador principal. |
| `createdByUserId` | int\|null | ID do admin que criou a conta, se aplicável. |
| `createdByName` | string\|null | Nome do admin que criou a conta, se aplicável. |
| `joinedAt` | string | Data de registo. |
| `flightHours` | float | Total de horas de voo registadas. |
| `points` | int | Pontos acumulados. |

##### Erros

| Código | Condição |
|---|---|
| `401` | Token ausente, inválido ou expirado. |
| `404` | Utilizador não encontrado na base de dados. |

---

### 6.3 Voos

#### `GET /api/flights/search`

Pesquisa itinerários disponíveis entre dois aeroportos. Pode devolver voos diretos e com escala. Os preços apresentados são calculados dinamicamente com base no preço do petróleo e na sazonalidade.

- **Autenticação:** Público

##### Parâmetros de query

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `from` | string | Sim | Código ICAO do aeroporto de origem. |
| `to` | string | Sim | Código ICAO do aeroporto de destino. |
| `date` | string | Não | Data da viagem no formato `YYYY-MM-DD`. Se omitida, usa a data atual. |
| `passengers` | int | Não | Número de passageiros (mínimo: 1; por omissão: 1). |

##### Exemplo de pedido

```http
GET /api/flights/search?from=FQMA&to=FAOR&date=2026-06-10&passengers=2
```

##### Resposta `200`

```json
{
  "origin": {
    "icao": "FQMA",
    "iata": "MPM",
    "name": "Maputo International",
    "city": "Maputo",
    "country": "Mozambique"
  },
  "destination": {
    "icao": "FAOR",
    "iata": "JNB",
    "name": "O. R. Tambo International",
    "city": "Johannesburg",
    "country": "South Africa"
  },
  "travelDate": "2026-06-10",
  "itineraries": [
    {
      "itineraryId": "AFV101_2026-06-10",
      "stopCount": 0,
      "summary": "Non-stop",
      "durationMinutes": 90,
      "duration": "1h 30m",
      "layoverMinutes": 0,
      "segments": [],
      "pricesPerPerson": {
        "economy": 180,
        "business": 576,
        "first": 1170
      },
      "prices": {
        "economy": 360,
        "business": 1152,
        "first": 2340
      },
      "from": "FQMA",
      "to": "FAOR",
      "date": "2026-06-10"
    }
  ],
  "searchSummary": {
    "stopsOffered": false,
    "totalResults": 1
  }
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `origin` / `destination` | object | Dados dos aeroportos de origem e destino. |
| `itineraries` | array | Lista de itinerários encontrados. |
| `itineraries[].itineraryId` | string | Identificador do itinerário, no formato `flightNumber_date` (segmentos separados por `__`). |
| `itineraries[].stopCount` | int | Número de escalas (0 = direto). |
| `itineraries[].durationMinutes` | int | Duração total da viagem em minutos. |
| `itineraries[].pricesPerPerson` | object | Preços por pessoa para cada classe. Os campos `business` e `first` podem ser `null` se nenhuma aeronave da rota tiver esses lugares. |
| `itineraries[].prices` | object | Preços totais (pricesPerPerson × passengers). Os campos `business` e `first` seguem a mesma regra. |
| `searchSummary.totalResults` | int | Número de itinerários encontrados. |

##### Erros

| Código | Condição |
|---|---|
| `400` | Parâmetro `from` ou `to` em falta. |
| `404` | Aeroporto de origem ou destino não encontrado, ou rota impossível de calcular. |

---

#### `GET /api/flights/routes`

Lista as rotas ativas da companhia, com informação geográfica de origem, destino e hub.

- **Autenticação:** Público

##### Resposta `200`

Array de objetos de rota:

```json
[
  {
    "from": "FQMA",
    "to": "FAOR",
    "fromIata": "MPM",
    "toIata": "JNB",
    "fromCity": "Maputo",
    "toCity": "Johannesburg",
    "fromCoords": [-25.9208, 32.5726],
    "toCoords": [-26.1337, 28.2420],
    "distanceKm": 433,
    "hub": "FQMA",
    "hubIata": "MPM"
  }
]
```

| Campo | Tipo | Descrição |
|---|---|---|
| `from` / `to` | string | Códigos ICAO de origem e destino. |
| `fromIata` / `toIata` | string | Códigos IATA correspondentes. |
| `fromCoords` / `toCoords` | array | Coordenadas `[lat, lon]`. |
| `distanceKm` | int | Distância da rota em quilómetros. |
| `hub` | string | Código ICAO do hub desta rota. |

---

#### `GET /api/flights/airports`

Lista todos os aeroportos conhecidos pelo backend, indexados por código ICAO.

- **Autenticação:** Público

##### Resposta `200`

Objeto cujas chaves são códigos ICAO:

```json
{
  "FQMA": {
    "icao": "FQMA",
    "iata": "MPM",
    "name": "Maputo International",
    "city": "Maputo",
    "country": "Mozambique",
    "lat": -25.9208,
    "lon": 32.5726,
    "hub": true
  },
  "FAOR": {
    "icao": "FAOR",
    "iata": "JNB",
    "name": "O. R. Tambo International",
    "city": "Johannesburg",
    "country": "South Africa",
    "lat": -26.1337,
    "lon": 28.2420,
    "hub": false
  }
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `icao` | string | Código ICAO do aeroporto. |
| `iata` | string | Código IATA do aeroporto. |
| `name` | string | Nome oficial do aeroporto. |
| `city` | string | Cidade onde o aeroporto se localiza. |
| `country` | string | País do aeroporto. |
| `lat` / `lon` | float | Coordenadas geográficas. |
| `hub` | bool | Se é um hub da companhia. |

---

#### `POST /api/flights/itinerary`

Recebe um itinerário básico e devolve a versão enriquecida com segmentos completos (horários, aeronave, duração) e preços calculados. Usado antes de criar uma reserva para confirmar os dados do voo.

- **Autenticação:** Público

##### Corpo do pedido

```json
{
  "itinerary": {
    "from": "FQMA",
    "to": "FAOR",
    "date": "2026-06-10",
    "segments": [
      {
        "flightNumber": "AFV101",
        "from": "FQMA",
        "to": "FAOR"
      }
    ]
  },
  "passengers": 2
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `itinerary` | object | Sim | Itinerário base a validar. |
| `itinerary.from` | string | Sim | ICAO de origem. |
| `itinerary.to` | string | Sim | ICAO de destino. |
| `itinerary.date` | string | Sim | Data no formato `YYYY-MM-DD`. |
| `itinerary.segments` | array | Sim | Lista de segmentos do voo. |
| `itinerary.segments[].flightNumber` | string | Sim | Número do voo (ex.: `AFV101`). |
| `passengers` | int | Não | Número de passageiros (por omissão: 1). |

##### Resposta `200`

```json
{
  "itineraryId": "AFV101_2026-06-10",
  "stopCount": 0,
  "summary": "Non-stop",
  "durationMinutes": 90,
  "duration": "1h 30m",
  "from": "FQMA",
  "to": "FAOR",
  "date": "2026-06-10",
  "segments": [
    {
      "routeId": 1,
      "flightNumber": "AFV101",
      "from": "FQMA",
      "to": "FAOR",
      "departureDate": "2026-06-10",
      "arrivalDate": "2026-06-10",
      "departure": "08:00",
      "arrival": "09:30",
      "departureDateTime": "2026-06-10T08:00:00+00:00",
      "arrivalDateTime": "2026-06-10T09:30:00+00:00",
      "durationMinutes": 90,
      "duration": "1h 30m",
      "distanceKm": 433,
      "aircraft": {
        "id": 1,
        "registration": "ZS-ABC",
        "type": "B737-800"
      }
    }
  ],
  "pricesPerPerson": {
    "economy": 180,
    "business": 576,
    "first": 1170
  },
  "prices": {
    "economy": 360,
    "business": 1152,
    "first": 2340
  }
}
```

##### Erros

| Código | Condição |
|---|---|
| `400` | Itinerário em falta ou sem segmentos. |
| `409` | Um ou mais números de voo já não estão disponíveis. |

---

#### `GET /api/flights/pricing-factors`

Devolve os fatores externos que influenciam o cálculo de preços: preço atual do petróleo e multiplicadores sazonais por região.

- **Autenticação:** Público

##### Parâmetros de query

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `date` | string | Não | Data no formato `YYYY-MM-DD` usada para calcular os fatores sazonais. |

##### Resposta `200`

```json
{
  "oil": {
    "priceUSD": 82.5,
    "baseline": 80,
    "multiplier": 1.03,
    "source": "live",
    "cachedAt": "2026-05-03T17:00:00+00:00"
  },
  "seasonal": {
    "africa":       { "multiplier": 1.3,  "label": "peak" },
    "europe":       { "multiplier": 1.1,  "label": "high" },
    "middle_east":  { "multiplier": 1.25, "label": "peak" },
    "americas":     { "multiplier": 1.0,  "label": "shoulder" },
    "asia_pacific": { "multiplier": 1.05, "label": "high" }
  },
  "updatedAt": "2026-05-03T17:00:00+00:00"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `oil.priceUSD` | float | Preço atual do petróleo em dólares por barril. |
| `oil.baseline` | float | Preço de referência base para o cálculo. |
| `oil.multiplier` | float | Multiplicador resultante do preço atual face ao baseline. |
| `oil.source` | string | `"live"` se obtido da API externa, `"fallback"` se em cache ou falha. |
| `seasonal` | object | Multiplicadores sazonais para as 5 regiões: `africa`, `europe`, `middle_east`, `americas`, `asia_pacific`. |

---

#### `POST /api/flights/seat-map`

Devolve os lugares já ocupados para um determinado voo e classe de cabine. Usado para apresentar o mapa de lugares no processo de reserva.

- **Autenticação:** Público

##### Corpo do pedido

```json
{
  "itinerary": {
    "segments": [
      {
        "flightNumber": "AFV101",
        "departureDate": "2026-06-10"
      }
    ]
  },
  "cabinClass": "economy"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `itinerary` | object | Sim | Deve conter pelo menos um segmento com `flightNumber` e `departureDate`. |
| `cabinClass` | string | Sim | Classe de cabine: `economy`, `business` ou `first`. |

##### Resposta `200`

```json
{
  "occupiedSeats": ["12A", "12B", "14C"]
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `occupiedSeats` | array | Lista de designações de lugares já ocupados (ex.: `"12A"`). |

##### Erros

| Código | Condição |
|---|---|
| `400` | Itinerário em falta ou inválido. |
| `400` | `cabinClass` inválida (valor não é `economy`, `business` ou `first`). |

---

### 6.4 Frota

#### `GET /api/fleet`

Lista as aeronaves da companhia. Pode ser filtrada por hub ou categoria.

- **Autenticação:** Público

##### Parâmetros de query

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `hub` | string | Não | Filtra pelo código ICAO do hub. |
| `category` | string | Não | Filtra pela categoria da aeronave (ex.: `"Medium Haul"`). |

##### Resposta `200`

Array de aeronaves:

```json
[
  {
    "id": 1,
    "registration": "ZS-ABC",
    "type": "B737-800",
    "category": "Medium Haul",
    "hub": "FQMA",
    "hub_name": "Maputo International",
    "seats": {
      "economy": 150,
      "business": 16,
      "first": 0
    },
    "range_km": 5400,
    "cruise_speed_kmh": 840,
    "status": "active",
    "image": "/assets/aircraft/b737.png",
    "description": "Aeronave de médio curso."
  }
]
```

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | int | ID único da aeronave. |
| `registration` | string | Matrícula (ex.: `ZS-ABC`). |
| `type` | string | Modelo da aeronave (ex.: `B737-800`). |
| `category` | string | Categoria operacional (ex.: `Medium Haul`). |
| `hub` | string | Código ICAO do hub de estacionamento. |
| `seats` | object | Número de lugares por classe. |
| `range_km` | int | Alcance máximo em quilómetros. |
| `cruise_speed_kmh` | int | Velocidade de cruzeiro em km/h. |
| `status` | string | `"active"` ou `"retired"`. |

---

#### `GET /api/fleet/{id}`

Obtém uma aeronave específica pelo seu ID numérico ou pela sua matrícula.

- **Autenticação:** Público

##### Parâmetros de caminho

| Parâmetro | Descrição |
|---|---|
| `id` | ID numérico da aeronave ou matrícula (ex.: `1` ou `ZS-ABC`). |

##### Resposta `200`

Objeto aeronave (ver formato em `GET /api/fleet`).

##### Erros

| Código | Condição |
|---|---|
| `404` | Aeronave não encontrada. |

---

#### `POST /api/fleet`

Cria uma nova aeronave na frota.

- **Autenticação:** Admin

##### Corpo do pedido

```json
{
  "registration": "ZS-NEW",
  "type": "A320",
  "category": "Medium Haul",
  "hub": "FQMA",
  "hub_name": "Maputo International",
  "seats": {
    "economy": 150,
    "business": 12,
    "first": 0
  },
  "range_km": 6100,
  "cruise_speed_kmh": 830,
  "status": "active",
  "image": "/assets/aircraft/a320.png",
  "description": "Airbus A320 de médio curso."
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `registration` | string | Sim | Matrícula da aeronave (deve ser única). |
| `type` | string | Sim | Modelo da aeronave. |
| `category` | string | Sim | Categoria operacional. |
| `hub` | string | Sim | Código ICAO do hub. |
| `hub_name` | string | Sim | Nome do hub. |
| `seats` | object | Não | Objeto com campos `economy`, `business` e `first`. |
| `range_km` | int | Não | Alcance em km. |
| `cruise_speed_kmh` | int | Não | Velocidade de cruzeiro em km/h. |
| `status` | string | Não | Por omissão: `"active"`. |
| `image` | string | Não | URL ou caminho da imagem. |
| `description` | string | Não | Descrição textual. |

##### Resposta `201`

Objeto da aeronave criada (ver formato em `GET /api/fleet`).

##### Erros

| Código | Condição |
|---|---|
| `401` | Token ausente ou inválido. |
| `403` | O utilizador não é administrador. |

---

#### `PUT /api/fleet/{id}`

Atualiza os dados de uma aeronave existente.

- **Autenticação:** Admin

##### Parâmetros de caminho

| Parâmetro | Descrição |
|---|---|
| `id` | ID numérico da aeronave ou matrícula. |

##### Corpo do pedido

Os mesmos campos que `POST /api/fleet`, todos opcionais. Apenas os campos enviados são atualizados.

##### Resposta `200`

Objeto da aeronave atualizada.

##### Erros

| Código | Condição |
|---|---|
| `401` | Token ausente ou inválido. |
| `403` | O utilizador não é administrador. |
| `404` | Aeronave não encontrada. |

---

#### `DELETE /api/fleet/{id}`

Marca a aeronave como retirada de serviço (`status = "retired"`). Não elimina o registo da base de dados.

- **Autenticação:** Admin

##### Parâmetros de caminho

| Parâmetro | Descrição |
|---|---|
| `id` | ID numérico da aeronave ou matrícula. |

##### Resposta `200`

```json
{
  "message": "Aircraft retired"
}
```

##### Erros

| Código | Condição |
|---|---|
| `401` | Token ausente ou inválido. |
| `403` | O utilizador não é administrador. |
| `404` | Aeronave não encontrada. |

---

### 6.5 Reservas

#### `POST /api/bookings`

Cria uma nova reserva. Se existir um token JWT válido, a reserva fica associada ao utilizador autenticado. Sem token, o backend tenta associar a reserva a um utilizador existente com o mesmo email do passageiro principal.

- **Autenticação:** Opcional

##### Corpo do pedido

```json
{
  "itinerary": {
    "from": "FQMA",
    "to": "FAOR",
    "date": "2026-06-10",
    "segments": [
      {
        "flightNumber": "AFV101",
        "from": "FQMA",
        "to": "FAOR"
      }
    ]
  },
  "cabinClass": "economy",
  "passengers": 1,
  "seat": "12A",
  "passengerDetails": [
    {
      "firstName": "Tiago",
      "lastName": "Cabaça",
      "email": "tiago@example.com",
      "phone": "+351912345678",
      "nationality": "PT"
    }
  ]
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `itinerary` | object | Sim | Itinerário do voo (validado pelo backend). |
| `cabinClass` | string | Sim | Classe de cabine: `economy`, `business` ou `first`. |
| `passengers` | int | Não | Número de passageiros (por omissão: 1). |
| `seat` | string | Não | Lugar preferido para o passageiro principal. |
| `passengerDetails` | array | Sim | Lista de detalhes dos passageiros. |

##### Campos em `passengerDetails[]`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `firstName` | string | Sim (1.º passageiro) | Primeiro nome. |
| `lastName` | string | Sim (1.º passageiro) | Apelido. |
| `email` | string | Sim (1.º passageiro) | Email de contacto. |
| `phone` | string | Não | Número de telefone. |
| `nationality` | string | Não | Código de país (ISO 3166-1 alpha-2, ex.: `"PT"`). |
| `seat` | string | Não | Lugar deste passageiro. |

##### Resposta `201`

```json
{
  "id": 12,
  "bookingRef": "AFV8K7M2P",
  "userId": 5,
  "userName": "Tiago Cabaça",
  "passengerEmail": "tiago@example.com",
  "flightNumber": "AFV101",
  "from": "FQMA",
  "to": "FAOR",
  "date": "2026-06-10",
  "cabinClass": "economy",
  "passengers": 1,
  "totalPrice": 180,
  "status": "confirmed",
  "seat": "12A",
  "passengerDetails": [
    {
      "firstName": "Tiago",
      "lastName": "Cabaça",
      "email": "tiago@example.com",
      "phone": "+351912345678",
      "nationality": "PT",
      "seat": "12A"
    }
  ],
  "itinerary": { "segments": [] },
  "createdAt": "2026-05-03 18:00:00",
  "updatedAt": "2026-05-03 18:00:00",
  "cancelledAt": null
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `bookingRef` | string | Referência única da reserva, com prefixo `AFV`. |
| `totalPrice` | float | Preço total pago. |
| `status` | string | Estado inicial: `"confirmed"`. |
| `cancelledAt` | string\|null | Data de cancelamento, ou `null` se ativa. |

##### Erros

| Código | Condição |
|---|---|
| `400` | Campo `itinerary` em falta. |
| `400` | `cabinClass` inválida. |
| `400` | `passengerDetails` vazio ou em falta. |
| `400` | Passageiro principal sem nome ou email. |
| `409` | O lugar selecionado foi ocupado por outra reserva entretanto. |

---

#### `GET /api/bookings/my`

Lista todas as reservas do utilizador autenticado, ordenadas por data.

- **Autenticação:** Autenticado

##### Resposta `200`

Array de objetos reserva (ver formato em `POST /api/bookings`).

##### Erros

| Código | Condição |
|---|---|
| `401` | Token ausente ou inválido. |

---

#### `GET /api/bookings/lookup`

Permite consultar uma reserva sem autenticação, usando a referência da reserva e o email do passageiro principal. Útil para o fluxo de gestão de reservas sem conta.

- **Autenticação:** Público

##### Parâmetros de query

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `ref` | string | Sim | Referência da reserva (ex.: `AFV8K7M2P`). |
| `email` | string | Sim | Email do passageiro principal. |

##### Exemplo de pedido

```http
GET /api/bookings/lookup?ref=AFV8K7M2P&email=tiago@example.com
```

##### Resposta `200`

Objeto reserva (ver formato em `POST /api/bookings`).

##### Erros

| Código | Condição |
|---|---|
| `400` | Parâmetro `ref` ou `email` em falta. |
| `404` | Reserva não encontrada para essa combinação. |

---

#### `GET /api/bookings/{ref}`

Devolve os detalhes de uma reserva específica. Apenas o dono da reserva ou um administrador podem aceder.

- **Autenticação:** Autenticado

##### Parâmetros de caminho

| Parâmetro | Descrição |
|---|---|
| `ref` | Referência da reserva (ex.: `AFV8K7M2P`). |

##### Resposta `200`

Objeto reserva (ver formato em `POST /api/bookings`).

##### Erros

| Código | Condição |
|---|---|
| `401` | Token ausente ou inválido. |
| `403` | O utilizador não é dono da reserva nem administrador. |
| `404` | Reserva não encontrada. |

---

#### `PUT /api/bookings/{ref}/cancel`

Cancela uma reserva ativa. O estado passa para `"cancelled"` e os lugares anteriormente marcados são libertados.

- **Autenticação:** Autenticado

##### Parâmetros de caminho

| Parâmetro | Descrição |
|---|---|
| `ref` | Referência da reserva. |

##### Resposta `200`

Objeto reserva atualizado com `status = "cancelled"` e `cancelledAt` preenchido.

##### Erros

| Código | Condição |
|---|---|
| `400` | A reserva já estava cancelada. |
| `401` | Token ausente ou inválido. |
| `403` | O utilizador não tem permissão para cancelar esta reserva. |
| `404` | Reserva não encontrada. |

---

### 6.6 Administração

Todos os endpoints `/api/admin/*` exigem, no mínimo, o nível de acesso **Admin**. Dois deles requerem adicionalmente que o utilizador seja o **administrador principal**.

---

#### `GET /api/admin/stats`

Devolve estatísticas agregadas para o painel de administração: totais de reservas, receita, utilizadores, frota e rotas mais populares.

- **Autenticação:** Admin

##### Resposta `200`

```json
{
  "totalBookings": 100,
  "confirmedBookings": 95,
  "cancelledBookings": 5,
  "delayedBookings": 2,
  "todayBookings": 3,
  "totalRevenue": 50000,
  "totalUsers": 25,
  "activeFleet": 8,
  "revenueByClass": {
    "economy": 30000,
    "business": 15000,
    "first": 5000
  },
  "topRoutes": [
    {
      "route": "FQMA-FAOR",
      "count": 45
    }
  ]
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `totalBookings` | int | Total de reservas existentes. |
| `confirmedBookings` | int | Total de reservas não canceladas (todos os estados exceto `cancelled`). |
| `cancelledBookings` | int | Reservas canceladas. |
| `delayedBookings` | int | Reservas com estado `delayed`. |
| `todayBookings` | int | Reservas criadas hoje. |
| `totalRevenue` | float | Receita total gerada pelas reservas. |
| `activeFleet` | int | Número de aeronaves com estado `active`. |
| `revenueByClass` | object | Receita discriminada por classe de cabine. |
| `topRoutes` | array | Rotas com mais reservas. |

---

#### `GET /api/admin/users`

Lista todos os utilizadores registados. As palavras-passe não são incluídas na resposta.

- **Autenticação:** Admin

##### Resposta `200`

Array de objetos utilizador (ver modelo em [7.1 Utilizador](#71-utilizador)).

---

#### `POST /api/admin/users`

Cria um utilizador diretamente a partir da área de administração, com possibilidade de atribuir o papel `admin`.

- **Autenticação:** Admin principal

##### Corpo do pedido

```json
{
  "name": "Novo Admin",
  "email": "admin@example.com",
  "password": "Senha456",
  "role": "admin",
  "vatsimCid": "9876543"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `name` | string | Sim | Nome do utilizador. |
| `email` | string | Sim | Email (deve ser único). |
| `password` | string | Sim | Palavra-passe. |
| `role` | string | Não | `"admin"` ou `"user"`. Por omissão: `"user"`. |
| `vatsimCid` | string | Não | CID VATSIM. |

##### Resposta `201`

Objeto utilizador criado.

##### Erros

| Código | Condição |
|---|---|
| `400` | Falta `name`, `email` ou `password`. |
| `400` | `role` tem um valor inválido. |
| `403` | O utilizador autenticado não é o administrador principal. |
| `409` | Email já registado. |

---

#### `PUT /api/admin/users/{id}/role`

Altera o papel de um utilizador existente.

- **Autenticação:** Admin principal

##### Parâmetros de caminho

| Parâmetro | Descrição |
|---|---|
| `id` | ID numérico do utilizador. |

##### Corpo do pedido

```json
{
  "role": "admin"
}
```

| Campo | Tipo | Valores aceites |
|---|---|---|
| `role` | string | `"admin"` ou `"user"` |

##### Resposta `200`

Objeto utilizador atualizado.

##### Erros

| Código | Condição |
|---|---|
| `400` | Valor de `role` inválido. |
| `400` | Tentativa de alterar o papel do próprio administrador principal. |
| `403` | O utilizador autenticado não é o administrador principal. |
| `404` | Utilizador não encontrado. |

---

#### `GET /api/admin/bookings`

Lista todas as reservas de todos os utilizadores.

- **Autenticação:** Admin

##### Resposta `200`

Array de objetos reserva (ver modelo em [7.5 Reserva](#75-reserva)).

---

#### `PUT /api/admin/bookings/{ref}/status`

Atualiza o estado operacional de uma reserva (ex.: marcar como atrasada).

- **Autenticação:** Admin

##### Parâmetros de caminho

| Parâmetro | Descrição |
|---|---|
| `ref` | Referência da reserva. |

##### Corpo do pedido

```json
{
  "status": "delayed"
}
```

| Valor | Descrição |
|---|---|
| `confirmed` | Reserva confirmada (estado normal). |
| `on_time` | Voo a operar dentro do horário. |
| `delayed` | Voo com atraso. |
| `cancelled` | Reserva/voo cancelado. |

##### Resposta `200`

Objeto reserva atualizado.

##### Erros

| Código | Condição |
|---|---|
| `400` | Valor de `status` inválido. |
| `404` | Reserva não encontrada. |

---

#### `GET /api/admin/fleet`

Lista toda a frota em modo administrativo (inclui aeronaves retiradas de serviço).

- **Autenticação:** Admin

##### Resposta `200`

Array de objetos aeronave (ver modelo em [7.3 Aeronave](#73-aeronave)).

---

#### `GET /api/admin/lookups`

Devolve conjuntos de dados auxiliares usados para preencher formulários e seletores na interface administrativa.

- **Autenticação:** Admin

##### Resposta `200`

```json
{
  "airports": [],
  "aircraft": [],
  "routeStatuses": ["active", "inactive"]
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `airports` | array | Lista de aeroportos disponíveis. |
| `aircraft` | array | Lista de aeronaves disponíveis. |
| `routeStatuses` | array | Valores válidos para o estado de uma rota. |

---

#### `GET /api/admin/routes`

Lista todas as rotas com os respetivos horários e estatísticas agregadas.

- **Autenticação:** Admin

##### Resposta `200`

```json
{
  "summary": {
    "totalRoutes": 50,
    "activeRoutes": 48,
    "inactiveRoutes": 2,
    "routesWithAircraft": 45,
    "hubs": 3
  },
  "routes": []
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `summary` | object | Contagens agregadas das rotas. |
| `routes` | array | Lista completa de rotas com horários (ver modelo em [7.6 Rota](#76-rota)). |

---

#### `POST /api/admin/routes`

Cria uma nova rota e os respetivos horários de voo.

- **Autenticação:** Admin

##### Corpo do pedido

```json
{
  "fromAirport": "FQMA",
  "toAirport": "FAOR",
  "hubAirport": "FQMA",
  "aircraftId": 1,
  "status": "active",
  "schedules": [
    {
      "flightNumber": "AFV101",
      "slotCode": "morning",
      "departureTime": "08:00",
      "active": true
    }
  ]
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `fromAirport` | string | Sim | ICAO de origem. |
| `toAirport` | string | Sim | ICAO de destino (diferente de `fromAirport`). |
| `hubAirport` | string | Sim | ICAO do hub desta rota. |
| `aircraftId` | int | Não | ID da aeronave atribuída. |
| `status` | string | Não | `"active"` ou `"inactive"`. Por omissão: `"active"`. |
| `schedules` | array | Sim | Pelo menos um horário. |

##### Campos em `schedules[]`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `flightNumber` | string | Sim | Número do voo (deve ser único no sistema). |
| `slotCode` | string | Não | Identificador lógico do horário (ex.: `"morning"`). |
| `departureTime` | string | Sim | Hora de partida no formato `HH:MM` ou `HH:MM:SS`. |
| `active` | bool | Não | Estado do horário. Por omissão: `true`. |

##### Resposta `201`

Objeto da rota criada com horários (ver modelo em [7.6 Rota](#76-rota)).

##### Erros

| Código | Condição |
|---|---|
| `400` | Falta `fromAirport`, `toAirport` ou `hubAirport`. |
| `400` | `fromAirport` igual a `toAirport`. |
| `400` | Estado da rota inválido. |
| `400` | Sem horários definidos. |
| `400` | Número de voo em falta num horário. |
| `400` | Formato de `departureTime` inválido. |
| `400` | Aeroporto de origem, destino ou hub não existe. |
| `400` | Aeronave (`aircraftId`) não encontrada. |
| `409` | Já existe uma rota para este par de aeroportos. |
| `409` | Número de voo já atribuído a outra rota. |

---

#### `PUT /api/admin/routes/{id}`

Atualiza uma rota existente e os seus horários.

- **Autenticação:** Admin

##### Parâmetros de caminho

| Parâmetro | Descrição |
|---|---|
| `id` | ID numérico da rota. |

##### Corpo do pedido

Os mesmos campos que `POST /api/admin/routes`, todos opcionais (apenas os campos enviados são atualizados).

##### Resposta `200`

Objeto da rota atualizada.

##### Erros

| Código | Condição |
|---|---|
| `400` | ID de rota inválido. |
| `404` | Rota não encontrada. |
| `400` / `409` | Erros de validação idênticos aos do endpoint de criação. |

---

#### `GET /api/admin/airline-stats`

Devolve as estatísticas institucionais da companhia.

- **Autenticação:** Admin

##### Resposta `200`

Ver modelo em [7.7 Estatísticas da Companhia](#77-estatísticas-da-companhia).

##### Erros

| Código | Condição |
|---|---|
| `404` | Registo de estatísticas não encontrado. |

---

#### `PUT /api/admin/airline-stats`

Atualiza parcialmente as estatísticas institucionais da companhia. Apenas os campos enviados são alterados.

- **Autenticação:** Admin

##### Campos aceites no corpo

| Campo | Tipo | Descrição |
|---|---|---|
| `totalFlights` | int | Total de voos realizados. |
| `totalHours` | float | Total de horas de voo. |
| `activeMembers` | int | Número de membros ativos. |
| `foundedDate` | string | Data de fundação (`YYYY-MM-DD`). |
| `division` | string | Divisão VATSIM. |
| `callsignPrefix` | string | Prefixo do indicativo de chamada (ex.: `"AFV"`). |

##### Resposta `200`

Objeto de estatísticas atualizado.

##### Erros

| Código | Condição |
|---|---|
| `400` | Nenhum campo válido foi enviado no corpo. |

---

### 6.7 VATSIM

#### `GET /api/vatsim/online`

Devolve os pilotos da Africana Virtual Airways atualmente online na rede VATSIM, com dados calculados pelo backend (ETA, progresso do voo, condições meteorológicas no destino).

- **Autenticação:** Público

##### Resposta `200`

```json
{
  "source": "live",
  "onlinePilots": [
    {
      "callsign": "AFV101",
      "name": "Pilot Example",
      "cid": "1234567",
      "from": "FQMA",
      "to": "FAOR",
      "aircraft": "B738",
      "altitude": 35000,
      "groundspeed": 470,
      "lat": -25.5,
      "lon": 32.0,
      "heading": 180,
      "logonTime": "2026-05-03T16:00:00Z",
      "fromCoords": [-25.9208, 32.5726],
      "toCoords": [-26.1337, 28.2420],
      "timing": {
        "scheduledDep": "2026-05-03T15:00:00+00:00",
        "scheduledArr": "2026-05-03T16:30:00+00:00",
        "scheduledDepStr": "15:00",
        "scheduledArrStr": "16:30",
        "eta": "2026-05-03T16:40:00+00:00",
        "etaStr": "16:40",
        "depDelayMin": 10,
        "arrDelayMin": 10,
        "distanceRemainingKm": 120,
        "distanceTotalKm": 433,
        "progress": 72
      },
      "destinationWeather": {
        "temp": 21,
        "wind": "12 kt S",
        "conditions": "Mostly cloudy",
        "visText": null
      }
    }
  ],
  "count": 1,
  "updatedAt": "2026-05-03T18:00:00+00:00"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `source` | string | Sempre `"live"`. Em caso de falha na obtenção, devolve `onlinePilots: []` em vez de erro. |
| `onlinePilots` | array | Lista de pilotos atualmente online. |
| `onlinePilots[].callsign` | string | Indicativo de chamada do voo. |
| `onlinePilots[].cid` | string | CID VATSIM do piloto. |
| `onlinePilots[].altitude` | int | Altitude em pés. |
| `onlinePilots[].groundspeed` | int | Velocidade no solo em nós. |
| `onlinePilots[].timing.progress` | int | Progresso do voo em percentagem (0–100). |
| `onlinePilots[].timing.depDelayMin` | int | Atraso na partida em minutos. |
| `onlinePilots[].timing.eta` | string | Hora estimada de chegada (ISO 8601). |
| `onlinePilots[].destinationWeather` | object | Condições meteorológicas no aeroporto de destino (METAR). |
| `count` | int | Número de pilotos online. |
| `updatedAt` | string | Timestamp da última atualização. |

##### Notas

- Os dados VATSIM são guardados em cache durante **60 segundos**.
- Os dados METAR (meteorologia) são guardados em cache durante **10 minutos**.
- Em caso de falha na obtenção de dados externos, o endpoint responde com `onlinePilots: []` em vez de devolver erro.

---

#### `GET /api/vatsim/stats`

Devolve informação institucional pública da companhia (sem autenticação).

- **Autenticação:** Público

##### Resposta `200`

Ver modelo em [7.7 Estatísticas da Companhia](#77-estatísticas-da-companhia).

##### Erros

| Código | Condição |
|---|---|
| `404` | Estatísticas não encontradas. |

---

## 7. Modelos de Dados

### 7.1 Utilizador

```json
{
  "id": 1,
  "name": "Tiago Cabaça",
  "email": "tiago@example.com",
  "vatsimCid": "1234567",
  "role": "admin",
  "isPrimaryAdmin": false,
  "createdByUserId": null,
  "createdByName": null,
  "joinedAt": "2026-05-03 18:00:00",
  "flightHours": 42.5,
  "points": 1200
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | int | Identificador único. |
| `role` | string | `"user"` ou `"admin"`. |
| `isPrimaryAdmin` | bool | Apenas `true` para o administrador principal definido nas variáveis de ambiente. |
| `createdByUserId` | int\|null | ID do admin que criou este utilizador manualmente (`null` para auto-registo). |
| `flightHours` | float | Horas de voo acumuladas. |
| `points` | int | Pontos do programa de fidelização. |

---

### 7.2 Aeroporto

```json
{
  "icao": "FQMA",
  "iata": "MPM",
  "name": "Maputo International",
  "city": "Maputo",
  "country": "Mozambique",
  "lat": -25.9208,
  "lon": 32.5726,
  "hub": true
}
```

---

### 7.3 Aeronave

```json
{
  "id": 1,
  "registration": "ZS-ABC",
  "type": "B737-800",
  "category": "Medium Haul",
  "hub": "FQMA",
  "hub_name": "Maputo International",
  "seats": {
    "economy": 150,
    "business": 16,
    "first": 0
  },
  "range_km": 5400,
  "cruise_speed_kmh": 840,
  "status": "active",
  "image": "/assets/aircraft/b737.png",
  "description": "Aeronave de médio curso."
}
```

---

### 7.4 Segmento de Voo

Representa uma perna individual de um voo (um troço entre dois aeroportos).

```json
{
  "routeId": 1,
  "flightNumber": "AFV101",
  "from": "FQMA",
  "to": "FAOR",
  "departureDate": "2026-06-10",
  "arrivalDate": "2026-06-10",
  "departure": "08:00",
  "arrival": "09:30",
  "departureDateTime": "2026-06-10T08:00:00Z",
  "arrivalDateTime": "2026-06-10T09:30:00Z",
  "durationMinutes": 90,
  "distanceKm": 433,
  "aircraft": {
    "id": 1,
    "registration": "ZS-ABC",
    "type": "B737-800"
  }
}
```

---

### 7.5 Reserva

```json
{
  "id": 12,
  "bookingRef": "AFV8K7M2P",
  "userId": 5,
  "userName": "Tiago Cabaça",
  "passengerEmail": "tiago@example.com",
  "flightNumber": "AFV101",
  "from": "FQMA",
  "to": "FAOR",
  "date": "2026-06-10",
  "cabinClass": "economy",
  "passengers": 1,
  "totalPrice": 180,
  "status": "confirmed",
  "seat": "12A",
  "passengerDetails": [
    {
      "firstName": "Tiago",
      "lastName": "Cabaça",
      "email": "tiago@example.com",
      "phone": "+351912345678",
      "nationality": "PT",
      "seat": "12A"
    }
  ],
  "itinerary": {
    "segments": []
  },
  "createdAt": "2026-05-03 18:00:00",
  "updatedAt": "2026-05-03 18:00:00",
  "cancelledAt": null
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `bookingRef` | string | Referência única com prefixo `AFV` (gerada aleatoriamente). |
| `status` | string | `confirmed`, `on_time`, `delayed` ou `cancelled`. |
| `cancelledAt` | string\|null | Data de cancelamento (preenchida quando `status = "cancelled"`). |

---

### 7.6 Rota

```json
{
  "id": 1,
  "fromAirport": "FQMA",
  "toAirport": "FAOR",
  "hubAirport": "FQMA",
  "distanceKm": 433,
  "durationMinutes": 90,
  "status": "active",
  "aircraftId": 1,
  "aircraft": {
    "id": 1,
    "registration": "ZS-ABC",
    "type": "B737-800"
  },
  "fromAirportDetails": {
    "icao": "FQMA",
    "name": "Maputo International",
    "city": "Maputo",
    "country": "Mozambique"
  },
  "toAirportDetails": {
    "icao": "FAOR",
    "name": "O. R. Tambo International",
    "city": "Johannesburg",
    "country": "South Africa"
  },
  "hubAirportDetails": {
    "icao": "FQMA",
    "name": "Maputo International",
    "city": "Maputo",
    "country": "Mozambique"
  },
  "schedules": [
    {
      "id": 1,
      "flightNumber": "AFV101",
      "slotCode": "morning",
      "departureTime": "08:00:00",
      "active": true
    }
  ]
}
```

---

### 7.7 Estatísticas da Companhia

```json
{
  "totalFlights": 4287,
  "totalHours": 12950,
  "activeMembers": 63,
  "foundedDate": "2020-03-01",
  "firstFlight": {
    "from": "FQMA",
    "to": "FQNC",
    "date": "2020-03-01"
  },
  "division": "VATSIM Sub-Saharan Africa (VATSSA)",
  "callsignPrefix": "AFV",
  "updatedAt": "2026-05-03 18:00:00"
}
```

---

## 8. Notas Técnicas

### Inicialização do servidor

- Na inicialização, o backend estabelece a ligação à base de dados MySQL.
- Tenta também criar o administrador principal (definido pelas variáveis de ambiente) se não existir.
- Tenta atualizar o preço do petróleo via API externa; se a chamada falhar, o backend continua a funcionar com o último valor em cache ou com um valor de fallback.

### Tratamento de erros

- O handler global de erros devolve sempre JSON.
- Para erros de cliente (4xx), a mensagem em `error` é descritiva.
- Para erros internos (5xx), a resposta é sempre `{ "error": "Internal server error" }` para não expor detalhes do servidor.

### Referências de reserva

- As referências de reserva são geradas com o prefixo `AFV` seguido de caracteres aleatórios (ex.: `AFV8K7M2P`).

### Lugares ocupados

- Ao criar uma reserva com um lugar específico, esse lugar é registado na base de dados.
- Ao cancelar uma reserva, os lugares reservados são libertados automaticamente.
- A criação de reservas protege contra condições de corrida: se dois pedidos tentarem o mesmo lugar em simultâneo, apenas um terá sucesso (`409`).

### Integrações externas

| Serviço | Finalidade | Cache |
|---|---|---|
| VATSIM Data API | Dados de pilotos online | 60 segundos |
| Aviation Weather (METAR) | Condições meteorológicas nos destinos | 10 minutos |
| Alpha Vantage | Preço do petróleo (fator de preço) | 24 horas (ficheiro em disco) |

### SSL em Windows

Em ambientes Windows, o backend usa o ficheiro `backend-php/cacert.pem` para validar certificados SSL nas chamadas HTTP externas (VATSIM, METAR, Alpha Vantage).

---

## 9. Tabela Resumo dos Endpoints

| Método | Endpoint | Autenticação | Descrição |
|---|---|---|---|
| `GET` | `/api/health` | Público | Verificar disponibilidade do backend |
| `POST` | `/api/auth/register` | Público | Criar conta de utilizador |
| `POST` | `/api/auth/login` | Público | Autenticar utilizador |
| `GET` | `/api/auth/me` | Autenticado | Obter dados do utilizador atual |
| `GET` | `/api/flights/search` | Público | Pesquisar itinerários de voo |
| `GET` | `/api/flights/routes` | Público | Listar rotas ativas |
| `GET` | `/api/flights/airports` | Público | Listar todos os aeroportos |
| `POST` | `/api/flights/itinerary` | Público | Validar e enriquecer itinerário |
| `GET` | `/api/flights/pricing-factors` | Público | Obter fatores de cálculo de preço |
| `POST` | `/api/flights/seat-map` | Público | Obter lugares ocupados num voo |
| `GET` | `/api/fleet` | Público | Listar aeronaves (com filtros) |
| `GET` | `/api/fleet/{id}` | Público | Obter aeronave por ID ou matrícula |
| `POST` | `/api/fleet` | Admin | Criar aeronave |
| `PUT` | `/api/fleet/{id}` | Admin | Atualizar aeronave |
| `DELETE` | `/api/fleet/{id}` | Admin | Retirar aeronave de serviço |
| `POST` | `/api/bookings` | Opcional | Criar reserva |
| `GET` | `/api/bookings/my` | Autenticado | Listar reservas do utilizador |
| `GET` | `/api/bookings/lookup` | Público | Consultar reserva por referência e email |
| `GET` | `/api/bookings/{ref}` | Autenticado | Obter reserva específica |
| `PUT` | `/api/bookings/{ref}/cancel` | Autenticado | Cancelar reserva |
| `GET` | `/api/admin/stats` | Admin | Estatísticas do painel de administração |
| `GET` | `/api/admin/users` | Admin | Listar utilizadores |
| `POST` | `/api/admin/users` | Admin principal | Criar utilizador manualmente |
| `PUT` | `/api/admin/users/{id}/role` | Admin principal | Alterar papel de utilizador |
| `GET` | `/api/admin/bookings` | Admin | Listar todas as reservas |
| `PUT` | `/api/admin/bookings/{ref}/status` | Admin | Atualizar estado de reserva |
| `GET` | `/api/admin/fleet` | Admin | Listar frota (vista administrativa) |
| `GET` | `/api/admin/lookups` | Admin | Dados auxiliares para formulários |
| `GET` | `/api/admin/routes` | Admin | Listar rotas com horários |
| `POST` | `/api/admin/routes` | Admin | Criar rota |
| `PUT` | `/api/admin/routes/{id}` | Admin | Atualizar rota |
| `GET` | `/api/admin/airline-stats` | Admin | Obter estatísticas institucionais |
| `PUT` | `/api/admin/airline-stats` | Admin | Atualizar estatísticas institucionais |
| `GET` | `/api/vatsim/online` | Público | Listar pilotos AFV online (VATSIM) |
| `GET` | `/api/vatsim/stats` | Público | Obter estatísticas públicas da companhia |
