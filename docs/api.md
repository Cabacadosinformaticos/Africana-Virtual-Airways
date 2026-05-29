# Documentação da REST API

**Stack:** PHP 8 (sem framework)
**URL base:** `/api`
**Formato de dados:** JSON (todos os pedidos e respostas)

## Índice

1. [Autenticação](#autenticação)
2. [Formato de resposta global](#formato-de-resposta-global)
3. [Códigos de erro](#códigos-de-erro)
4. [Variáveis de ambiente](#variáveis-de-ambiente)
5. [Endpoints](#endpoints)
6. [Modelos de dados](#modelos-de-dados)
7. [Lógica de preços](#lógica-de-preços)
8. [Resumo de endpoints](#resumo-de-endpoints)

## Autenticação

A API utiliza JWT (JSON Web Tokens) assinados com HS256.

### Estrutura do token

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | int | ID do utilizador |
| `email` | string | Email do utilizador |
| `name` | string | Nome de apresentação |
| `role` | string | `admin` ou `user` |
| `isPrimaryAdmin` | bool | Indicador de administrador principal |
| `iat` | int | Data e hora de emissão |
| `exp` | int | Data e hora de expiração (24 horas) |

### Como enviar o token

```
Authorization: Bearer <token>
```

### Níveis de acesso

| Nível | Comportamento |
|---|---|
| Nenhum | Público, não é necessário token |
| Opcional | O token é lido se estiver presente e o utilizador é associado ao pedido |
| Obrigatório | Devolve `401` se o token estiver em falta ou for inválido |
| Admin | Devolve `403` se o token for válido mas a função não for `admin` |
| Admin principal | Devolve `403` se o utilizador não for o administrador principal |

## Formato de resposta global

### Sucesso

```json
{ "chave": "valor" }
```

As respostas bem-sucedidas devolvem diretamente o objeto ou array relevante. Não existe envelope exterior.

### Erro

```json
{ "error": "Mensagem legível" }
```

## Códigos de erro

| Código | Significado |
|---|---|
| `200` | OK |
| `201` | Criado |
| `400` | Pedido inválido, campo em falta ou inválido |
| `401` | Não autorizado, token em falta ou expirado |
| `403` | Proibido, permissões insuficientes |
| `404` | Não encontrado |
| `409` | Conflito, entrada duplicada ou lugar já ocupado |
| `500` | Erro interno do servidor |

## Variáveis de ambiente

### Obrigatórias

| Variável | Descrição |
|---|---|
| `JWT_SECRET` | Segredo de assinatura JWT |
| `DB_HOST` | Servidor MySQL |
| `DB_USER` | Utilizador MySQL |
| `DB_PASSWORD` | Palavra-passe MySQL |
| `DB_NAME` | Nome da base de dados (predefinição `afv_booking`) |

### Arranque do administrador principal

| Variável | Descrição |
|---|---|
| `PRIMARY_ADMIN_EMAIL` | Email do administrador |
| `PRIMARY_ADMIN_PASSWORD` | Palavra-passe do administrador |
| `PRIMARY_ADMIN_NAME` | Nome de apresentação |
| `PRIMARY_ADMIN_VATSIM_CID` | CID VATSIM |
| `PRIMARY_ADMIN_FLIGHT_HOURS` | Horas de voo iniciais |
| `PRIMARY_ADMIN_POINTS` | Pontos iniciais |

### Opcionais

| Variável | Predefinição | Descrição |
|---|---|---|
| `DB_PORT` | `3306` | Porta MySQL |
| `CORS_ORIGIN` | `*` | Origem CORS permitida |
| `ALPHA_VANTAGE_KEY` | (nenhuma) | Chave de API para o preço do petróleo em tempo real (Brent crude) |

## Endpoints

### Health

#### `GET /api/health`

Devolve o estado do serviço.

**Autenticação:** Nenhuma

**Resposta `200`**

```json
{
  "status": "ok",
  "timestamp": "2026-04-20T08:00:00Z"
}
```

### Auth

#### `POST /api/auth/register`

Cria uma nova conta de utilizador.

**Autenticação:** Nenhuma

**Corpo do pedido**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `name` | string | Sim | Nome de apresentação |
| `email` | string | Sim | Endereço de email |
| `password` | string | Sim | Palavra-passe |
| `vatsimCid` | string | Não | CID VATSIM |

**Resposta `201`**

```json
{
  "token": "<jwt>",
  "user": { "...Utilizador": true }
}
```

**Erros**

| Código | Motivo |
|---|---|
| `400` | Campo obrigatório em falta |
| `409` | Email já registado |

#### `POST /api/auth/login`

Autentica o utilizador e devolve um token.

**Autenticação:** Nenhuma

**Corpo do pedido**

| Campo | Tipo | Obrigatório |
|---|---|---|
| `email` | string | Sim |
| `password` | string | Sim |

**Resposta `200`**

```json
{
  "token": "<jwt>",
  "user": { "...Utilizador": true }
}
```

**Erros**

| Código | Motivo |
|---|---|
| `401` | Credenciais inválidas |

#### `GET /api/auth/me`

Devolve o perfil do utilizador autenticado.

**Autenticação:** Obrigatória

**Resposta `200`**: objeto [Utilizador](#utilizador) sem palavra-passe.

**Erros**

| Código | Motivo |
|---|---|
| `401` | Token em falta ou inválido |
| `404` | Utilizador não encontrado |

### Voos

#### `GET /api/flights/search`

Pesquisa itinerários disponíveis entre dois aeroportos.

**Autenticação:** Nenhuma

**Parâmetros de consulta**

| Parâmetro | Tipo | Obrigatório | Predefinição | Descrição |
|---|---|---|---|---|
| `from` | string | Sim | | Código ICAO de origem (por exemplo, `FQMA`) |
| `to` | string | Sim | | Código ICAO de destino |
| `date` | string | Não | 7 dias a partir de hoje | Data de viagem (`YYYY-MM-DD`) |
| `passengers` | int | Não | `1` | Número de passageiros (mínimo 1) |

**Resposta `200`**

```json
{
  "origin": { "...Aeroporto": true },
  "destination": { "...Aeroporto": true },
  "travelDate": "2026-04-20",
  "itineraries": [
    {
      "itineraryId": "AFV201_2026-04-20",
      "stopCount": 0,
      "summary": "Non-stop",
      "durationMinutes": 360,
      "duration": "6h 00m",
      "layoverMinutes": 0,
      "segments": [ { "...Segmento": true } ],
      "pricesPerPerson": { "economy": 450.00, "business": 1440.00, "first": 2925.00 },
      "prices": { "economy": 900.00, "business": 2880.00, "first": 5850.00 },
      "from": "FQMA",
      "to": "FAOR",
      "date": "2026-04-20"
    }
  ],
  "searchSummary": { "stopsOffered": false, "totalResults": 1 }
}
```

**Notas**

* Usa pesquisa em largura (BFS) com um máximo de 3 segmentos e escala mínima de 90 minutos.
* Devolve até 8 itinerários, ordenados por número de escalas e depois por preço.
* Os campos `business` e `first` em `pricesPerPerson` podem ser `null` quando nenhuma aeronave do itinerário oferece essa classe.

**Erros**

| Código | Motivo |
|---|---|
| `400` | `from` ou `to` em falta |
| `404` | Aeroporto não encontrado |

#### `GET /api/flights/routes`

Lista todas as rotas ativas com coordenadas.

**Autenticação:** Nenhuma

**Resposta `200`**: array de objetos de rota com aeroportos de origem e destino, coordenadas, distância e informação de hub.

#### `GET /api/flights/airports`

Lista todos os aeroportos da rede.

**Autenticação:** Nenhuma

**Resposta `200`**: mapa indexado pelo código ICAO.

```json
{
  "FQMA": { "...Aeroporto": true },
  "FAOR": { "...Aeroporto": true }
}
```

#### `POST /api/flights/itinerary`

Valida e hidrata um itinerário em bruto, adicionando horários exatos, preços e aeronaves.

**Autenticação:** Nenhuma

**Corpo do pedido**

| Campo | Tipo | Obrigatório |
|---|---|---|
| `itinerary` | objeto | Sim |
| `itinerary.segments` | array | Sim |
| `passengers` | int | Não |

**Resposta `200`**: objeto de itinerário hidratado com detalhes completos dos segmentos e preços.

**Erros**

| Código | Motivo |
|---|---|
| `400` | Itinerário inválido |
| `409` | Um ou mais segmentos deixaram de estar disponíveis |

#### `POST /api/flights/seat-map`

Obtém os lugares ocupados e o layout da cabine para um itinerário numa determinada classe.

**Autenticação:** Nenhuma

**Corpo do pedido**

| Campo | Tipo | Obrigatório | Valores |
|---|---|---|---|
| `itinerary` | objeto | Sim | |
| `itinerary.segments` | array | Sim | |
| `cabinClass` | string | Sim | `economy`, `business`, `first` |

**Resposta `200`**

```json
{
  "occupiedSeats": ["1A", "2B", "14C"],
  "layout": {
    "rows": 32,
    "config": "3-3-3",
    "rowOffset": 0,
    "deck": null
  }
}
```

O `layout` descreve a cabine da classe pedida (número de filas, configuração dos lugares e deslocamento de fila), obtido do seat map da aeronave em `data/aircraft.json`. Quando a aeronave não tem essa informação, é devolvido um layout por omissão.

**Erros**

| Código | Motivo |
|---|---|
| `400` | Itinerário ou classe de cabine inválidos |

#### `GET /api/flights/pricing-factors`

Obtém os multiplicadores de preço atuais (preço do petróleo e sazonalidade).

**Autenticação:** Nenhuma

**Parâmetros de consulta**

| Parâmetro | Tipo | Obrigatório |
|---|---|---|
| `date` | string | Não |

**Resposta `200`**

```json
{
  "oil": {
    "priceUSD": 82.50,
    "baseline": 80.00,
    "multiplier": 1.03,
    "source": "live",
    "cachedAt": "2026-04-20T06:00:00Z"
  },
  "seasonal": {
    "africa":       { "multiplier": 1.30, "label": "peak" },
    "europe":       { "multiplier": 1.10, "label": "high" },
    "americas":     { "multiplier": 1.00, "label": "shoulder" },
    "middle_east":  { "multiplier": 0.90, "label": "low" },
    "asia_pacific": { "multiplier": 1.20, "label": "high" }
  },
  "updatedAt": "2026-04-20T06:00:00Z"
}
```

### Frota

#### `GET /api/fleet`

Lista aeronaves, com filtros opcionais.

**Autenticação:** Nenhuma

**Parâmetros de consulta**

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `hub` | string | Não | Filtrar por código ICAO do hub |
| `category` | string | Não | Filtrar por categoria |

**Resposta `200`**: array de objetos [Aeronave](#aeronave).

#### `GET /api/fleet/{id}`

Obtém uma aeronave por ID ou matrícula.

**Autenticação:** Nenhuma

**Parâmetros de caminho**

| Parâmetro | Descrição |
|---|---|
| `id` | ID numérico da aeronave ou matrícula (por exemplo, `C9-AFV`) |

**Resposta `200`**: objeto [Aeronave](#aeronave).

**Erros**

| Código | Motivo |
|---|---|
| `404` | Aeronave não encontrada |

#### `POST /api/fleet`

Adiciona uma nova aeronave à frota.

**Autenticação:** Admin

**Corpo do pedido**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `registration` | string | Sim | Matrícula |
| `type` | string | Sim | Tipo de aeronave |
| `category` | string | Sim | Categoria |
| `hub` | string | Sim | Código ICAO do hub |
| `hub_name` | string | Sim | Nome de apresentação do hub |
| `seats` | objeto | Não | `{ economy, business, first }` |
| `range_km` | int | Não | Autonomia máxima em km |
| `cruise_speed_kmh` | int | Não | Velocidade de cruzeiro em km/h |
| `status` | string | Não | Predefinição `active` |
| `image` | string | Não | URL ou caminho da imagem |
| `description` | string | Não | Texto de descrição |

Os campos `registration`, `type`, `category`, `hub` e `hub_name` são obrigatórios, uma vez que o servidor os lê diretamente. Os restantes têm valores por omissão.

**Resposta `201`**: objeto [Aeronave](#aeronave) criado.

#### `PUT /api/fleet/{id}`

Atualiza uma aeronave.

**Autenticação:** Admin

**Parâmetros de caminho**: igual a `GET /api/fleet/{id}`.

**Corpo do pedido**: qualquer subconjunto dos campos de `POST /api/fleet`.

**Resposta `200`**: objeto [Aeronave](#aeronave) atualizado.

**Erros**

| Código | Motivo |
|---|---|
| `404` | Aeronave não encontrada |

#### `DELETE /api/fleet/{id}`

Retira uma aeronave de serviço, definindo o estado como `retired`.

**Autenticação:** Admin

**Parâmetros de caminho**: igual a `GET /api/fleet/{id}`.

**Resposta `200`**

```json
{ "message": "Aircraft retired" }
```

**Erros**

| Código | Motivo |
|---|---|
| `404` | Aeronave não encontrada |

### Reservas

#### `POST /api/bookings`

Cria uma nova reserva.

**Autenticação:** Opcional (a reserva é associada ao utilizador se estiver autenticado)

**Corpo do pedido**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `itinerary` | objeto | Sim | Itinerário com array `segments` |
| `cabinClass` | string | Sim | `economy`, `business` ou `first` |
| `passengers` | int | Não | Número de passageiros (predefinição 1) |
| `passengerDetails` | array | Sim | Um objeto por passageiro |
| `passengerDetails[].firstName` | string | Sim | |
| `passengerDetails[].lastName` | string | Sim | |
| `passengerDetails[].email` | string | Sim | |
| `passengerDetails[].phone` | string | Não | |
| `passengerDetails[].nationality` | string | Não | Código de país ISO |
| `passengerDetails[].seat` | string | Não | Número do lugar |
| `seat` | string | Não | Lugar principal (atalho para passageiro único) |

**Resposta `201`**: objeto [Reserva](#reserva).

**Formato da referência de reserva:** `AFV` mais 6 caracteres alfanuméricos aleatórios, excluindo caracteres ambíguos (`0`, `1`, `O`, `I`, `L`).

**Erros**

| Código | Motivo |
|---|---|
| `400` | Campos obrigatórios em falta |
| `409` | Lugar já ocupado |

#### `GET /api/bookings/my`

Lista todas as reservas do utilizador autenticado.

**Autenticação:** Obrigatória

**Resposta `200`**: array de objetos [Reserva](#reserva).

#### `GET /api/bookings/lookup`

Consulta uma reserva sem autenticação, usando referência mais verificação de email.

**Autenticação:** Nenhuma

**Parâmetros de consulta**

| Parâmetro | Tipo | Obrigatório |
|---|---|---|
| `ref` | string | Sim |
| `email` | string | Sim |

**Resposta `200`**: objeto [Reserva](#reserva).

**Erros**

| Código | Motivo |
|---|---|
| `400` | `ref` ou `email` em falta |
| `404` | Reserva não encontrada |

#### `GET /api/bookings/{ref}`

Obtém uma reserva específica pela referência.

**Autenticação:** Obrigatória (admin ou proprietário da reserva)

**Parâmetros de caminho**

| Parâmetro | Descrição |
|---|---|
| `ref` | Referência da reserva (por exemplo, `AFVABCDEF`) |

**Resposta `200`**: objeto [Reserva](#reserva).

**Erros**

| Código | Motivo |
|---|---|
| `403` | Não é o proprietário da reserva nem admin |
| `404` | Reserva não encontrada |

#### `PUT /api/bookings/{ref}/cancel`

Cancela uma reserva e liberta os lugares ocupados.

**Autenticação:** Obrigatória (admin ou proprietário da reserva)

**Parâmetros de caminho**: igual ao anterior.

**Resposta `200`**: objeto [Reserva](#reserva) atualizado com `status: "cancelled"`.

**Erros**

| Código | Motivo |
|---|---|
| `400` | Reserva já cancelada |
| `403` | Não é o proprietário da reserva nem admin |
| `404` | Reserva não encontrada |

### Admin

Todas as rotas `/api/admin/*` requerem autenticação de nível Admin.

#### `GET /api/admin/stats`

Estatísticas do painel de controlo.

**Resposta `200`**

```json
{
  "totalBookings": 100,
  "confirmedBookings": 95,
  "cancelledBookings": 5,
  "delayedBookings": 0,
  "todayBookings": 3,
  "totalRevenue": 50000.00,
  "totalUsers": 25,
  "activeFleet": 8,
  "revenueByClass": { "economy": 30000.00, "business": 15000.00, "first": 5000.00 },
  "topRoutes": [ { "route": "FQMA-FAOR", "count": 45 } ]
}
```

#### `GET /api/admin/metrics`

Indicadores analíticos para o dashboard, gerados dinamicamente a partir da base de dados. Inclui estatística descritiva (média, mediana, moda, desvio-padrão, variância e percentis P10, P25, P75 e P90), estatística inferencial (intervalo de confiança a 95 por cento da média do preço) e ainda séries temporais, distribuições e KPIs operacionais.

**Resposta `200`** (resumida)

```json
{
  "bookingTimeline":   [ { "month": "2026-04", "count": 12 } ],
  "userTimeline":      [ { "month": "2026-04", "count": 5 } ],
  "cabinDistribution": { "economy": 80, "business": 15, "first": 5 },
  "revenueByClass":    { "economy": 30000.0, "business": 15000.0, "first": 5000.0 },
  "avgPriceByClass":   { "economy": 375.0, "business": 1200.0, "first": 2500.0 },
  "topRoutes":         [ { "route": "FQMA -> FAOR", "count": 45 } ],
  "nationalityTop10":  [ { "label": "PT", "count": 30 } ],
  "priceStats": {
    "count": 100, "mean": 620.5, "median": 480.0, "mode": 400.0,
    "stddev": 410.2, "variance": 168264.0,
    "p10": 180.0, "p25": 300.0, "p75": 820.0, "p90": 1300.0,
    "ci95Lower": 540.1, "ci95Upper": 700.9
  },
  "priceHistogram":   [ { "label": "< $500", "count": 52 } ],
  "distancePrice":    [ { "x": 2000, "y": 450.0 } ],
  "heatmap":          { "2": { "economy": 10, "business": 2 } },
  "bookingLifecycle": { "total": 100, "active": 95, "goodStatus": 90, "onTime": 12 },
  "essentialMetrics": {
    "upcomingBookings": 40, "activeUsers30d": 18,
    "conversionRate": 64.0, "cancellationRate": 5.0, "avgTicketPrice": 621
  }
}
```

#### `GET /api/admin/users`

Lista todos os utilizadores.

**Resposta `200`**: array de objetos [Utilizador](#utilizador) sem palavras-passe.

#### `POST /api/admin/users`

Cria uma conta de utilizador. Apenas administrador principal.

**Corpo do pedido**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `name` | string | Sim | |
| `email` | string | Sim | |
| `password` | string | Sim | |
| `role` | string | Não | `admin` ou `user` (predefinição `user`) |
| `vatsimCid` | string | Não | |

**Resposta `201`**: objeto [Utilizador](#utilizador) criado.

**Erros**

| Código | Motivo |
|---|---|
| `403` | Não é o administrador principal |
| `409` | Email já registado |

#### `PUT /api/admin/users/{id}/role`

Altera a função de um utilizador. Apenas administrador principal.

**Parâmetros de caminho**

| Parâmetro | Descrição |
|---|---|
| `id` | ID do utilizador |

**Corpo do pedido**

| Campo | Tipo | Valores |
|---|---|---|
| `role` | string | `admin`, `user` |

**Resposta `200`**: objeto [Utilizador](#utilizador) atualizado.

**Erros**

| Código | Motivo |
|---|---|
| `400` | Não é possível alterar a função do próprio administrador principal |
| `403` | Não é o administrador principal |
| `404` | Utilizador não encontrado |

#### `GET /api/admin/bookings`

Lista todas as reservas.

**Resposta `200`**: array de objetos [Reserva](#reserva).

#### `PUT /api/admin/bookings/{ref}/status`

Atualiza o estado de uma reserva.

**Parâmetros de caminho**

| Parâmetro | Descrição |
|---|---|
| `ref` | Referência da reserva |

**Corpo do pedido**

| Campo | Tipo | Valores |
|---|---|---|
| `status` | string | `confirmed`, `on_time`, `delayed`, `cancelled` |

**Resposta `200`**: objeto [Reserva](#reserva) atualizado.

**Erros**

| Código | Motivo |
|---|---|
| `400` | Valor de estado inválido |
| `404` | Reserva não encontrada |

#### `GET /api/admin/fleet`

Lista todas as aeronaves, incluindo as retiradas de serviço.

**Resposta `200`**: array de objetos [Aeronave](#aeronave).

#### `GET /api/admin/lookups`

Obtém dados de referência para preencher formulários de administração.

**Resposta `200`**

```json
{
  "airports": [ { "...Aeroporto": true } ],
  "aircraft": [ { "...Aeronave": true } ],
  "routeStatuses": ["active", "inactive"]
}
```

#### `GET /api/admin/routes`

Lista todas as rotas com detalhes completos.

**Resposta `200`**

```json
{
  "summary": {
    "totalRoutes": 100,
    "activeRoutes": 98,
    "inactiveRoutes": 2,
    "routesWithAircraft": 95,
    "hubs": 2
  },
  "routes": [ { "...Rota": true } ]
}
```

#### `POST /api/admin/routes`

Cria uma nova rota com horários. A distância e a duração são calculadas no servidor.

**Corpo do pedido**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `fromAirport` | string | Sim | Código ICAO |
| `toAirport` | string | Sim | Código ICAO |
| `hubAirport` | string | Sim | Código ICAO |
| `aircraftId` | int | Não | ID da aeronave atribuída |
| `status` | string | Não | `active` (predefinição) ou `inactive` |
| `schedules` | array | Sim | Array de objetos de horário |
| `schedules[].flightNumber` | string | Sim | por exemplo, `AFV101` |
| `schedules[].slotCode` | string | Não | por exemplo, `morning` |
| `schedules[].departureTime` | string | Sim | `HH:MM` ou `HH:MM:SS` |
| `schedules[].active` | bool | Não | Predefinição `true` |

**Resposta `201`**: objeto [Rota](#rota) criado com horários.

**Erros**

| Código | Motivo |
|---|---|
| `400` | Campos em falta, aeroporto inexistente ou origem igual ao destino |
| `409` | Par de aeroportos ou número de voo já existente |

#### `PUT /api/admin/routes/{id}`

Atualiza uma rota e os seus horários.

**Parâmetros de caminho**

| Parâmetro | Descrição |
|---|---|
| `id` | ID da rota |

**Corpo do pedido**: mesma estrutura que `POST /api/admin/routes`.

**Resposta `200`**: objeto [Rota](#rota) atualizado.

**Erros**

| Código | Motivo |
|---|---|
| `404` | Rota não encontrada |

#### `GET /api/admin/airline-stats`

Obtém as estatísticas e o perfil da companhia aérea.

**Resposta `200`**: objeto [EstatísticasCompanhia](#estatísticascompanhia).

#### `PUT /api/admin/airline-stats`

Atualiza as estatísticas da companhia aérea (atualização parcial).

**Corpo do pedido**

| Campo | Tipo |
|---|---|
| `totalFlights` | int |
| `totalHours` | int |
| `activeMembers` | int |
| `foundedDate` | string (`YYYY-MM-DD`) |
| `division` | string |
| `callsignPrefix` | string |

**Resposta `200`**: objeto [EstatísticasCompanhia](#estatísticascompanhia) atualizado.

### VATSIM

#### `GET /api/vatsim/online`

Obtém os pilotos AFV atualmente online na rede VATSIM.

**Autenticação:** Nenhuma

**Resposta `200`**

```json
{
  "source": "live",
  "onlinePilots": [
    {
      "callsign": "AFV101",
      "name": "John Pilot",
      "cid": "123456",
      "from": "FQMA",
      "to": "FAOR",
      "aircraft": "B77W",
      "altitude": 35000,
      "groundspeed": 470,
      "lat": -23.5,
      "lon": 25.5,
      "heading": 180,
      "logonTime": "2026-04-20T10:00:00Z",
      "fromCoords": [-25.9208, 32.5725],
      "toCoords": [-26.1392, 28.2460],
      "timing": {
        "scheduledDep": "2026-04-20T08:00:00Z",
        "scheduledArr": "2026-04-20T14:00:00Z",
        "scheduledDepStr": "08:00",
        "scheduledArrStr": "14:00",
        "eta": "2026-04-20T14:30:00Z",
        "etaStr": "14:30",
        "depDelayMin": 15,
        "arrDelayMin": 25,
        "distanceRemainingKm": 500,
        "distanceTotalKm": 2000,
        "progress": 75
      },
      "destinationWeather": {
        "temp": 25,
        "wind": "12 kt W",
        "conditions": "Mostly cloudy",
        "visText": null
      }
    }
  ],
  "count": 1,
  "updatedAt": "2026-04-20T12:30:00Z"
}
```

**Notas**

* O endpoint filtra os indicativos iniciados por `AFV` e enriquece cada piloto com temporização (ETA, atrasos e progresso) e com a meteorologia do destino (METAR).
* Cache do lado do servidor: 60 segundos para os dados dos pilotos e 10 minutos para o METAR.
* A página Live também obtém as posições diretamente no navegador a partir de `https://data.vatsim.net/v3/vatsim-data.json`, usando `/api/flights/airports` para as coordenadas dos aeroportos.
* Em Windows, requer um CA bundle configurado no `php.ini` (`openssl.cafile` e `curl.cainfo`) para que as ligações HTTPS do servidor funcionem corretamente (ver [Instalação](instalacao.md#certificados-ssl-em-windows)).

#### `GET /api/vatsim/stats`

Obtém o perfil e as estatísticas da companhia aérea (os mesmos dados que `GET /api/admin/airline-stats`).

**Autenticação:** Nenhuma

**Resposta `200`**: objeto [EstatísticasCompanhia](#estatísticascompanhia).

## Modelos de dados

### Utilizador

```json
{
  "id": 1,
  "name": "João Silva",
  "email": "joao@exemplo.com",
  "vatsimCid": "123456",
  "role": "admin",
  "isPrimaryAdmin": false,
  "createdByUserId": null,
  "createdByName": null,
  "joinedAt": "2020-03-01 00:00:00",
  "flightHours": 120,
  "points": 3400
}
```

### Aeroporto

```json
{
  "icao": "FQMA",
  "iata": "MPM",
  "name": "Maputo International Airport",
  "city": "Maputo",
  "country": "Mozambique",
  "lat": -25.9208,
  "lon": 32.5725,
  "hub": true
}
```

### Aeronave

```json
{
  "id": 1,
  "registration": "C9-AFV",
  "type": "Airbus A340-600",
  "category": "Long Range",
  "hub": "FQMA",
  "hub_name": "Maputo",
  "seats": { "economy": 247, "business": 56, "first": 8 },
  "range_km": 14600,
  "cruise_speed_kmh": 905,
  "status": "active",
  "image": "/assets/img/fleet/C9-AFV.png",
  "description": "Aeronave de longo alcance de dois corredores."
}
```

### Segmento

```json
{
  "routeId": 1,
  "flightNumber": "AFV201",
  "from": "FQMA",
  "to": "FAOR",
  "departureDate": "2026-04-20",
  "arrivalDate": "2026-04-20",
  "departure": "08:00",
  "arrival": "14:00",
  "departureDateTime": "2026-04-20T08:00:00+00:00",
  "arrivalDateTime": "2026-04-20T14:00:00+00:00",
  "durationMinutes": 360,
  "duration": "6h 00m",
  "distanceKm": 2000,
  "aircraft": { "id": 1, "registration": "C9-AFV", "type": "Airbus A340-600" }
}
```

### Reserva

```json
{
  "id": 1,
  "bookingRef": "AFVABCDEF",
  "userId": 5,
  "userName": "João Silva",
  "passengerEmail": "joao@exemplo.com",
  "flightNumber": "AFV201 / AFV205",
  "from": "FQMA",
  "to": "FAOR",
  "date": "2026-04-20",
  "cabinClass": "economy",
  "passengers": 2,
  "totalPrice": 4500.50,
  "status": "confirmed",
  "seat": "12A",
  "passengerDetails": [
    {
      "firstName": "João",
      "lastName": "Silva",
      "email": "joao@exemplo.com",
      "phone": "+351912345678",
      "nationality": "PT",
      "seat": "12A"
    }
  ],
  "itinerary": { "segments": [ { "...Segmento": true } ] },
  "createdAt": "2026-04-01T10:00:00Z",
  "updatedAt": "2026-04-01T10:00:00Z",
  "cancelledAt": null
}
```

Valores de estado da reserva: `confirmed`, `on_time`, `delayed`, `cancelled`.

### Rota

```json
{
  "id": 1,
  "fromAirport": "FQMA",
  "toAirport": "FAOR",
  "hubAirport": "FQMA",
  "distanceKm": 2000,
  "durationMinutes": 360,
  "status": "active",
  "aircraftId": 1,
  "aircraft": { "...Aeronave": true },
  "fromAirportDetails": { "...Aeroporto": true },
  "toAirportDetails": { "...Aeroporto": true },
  "hubAirportDetails": { "...Aeroporto": true },
  "schedules": [
    { "id": 1, "flightNumber": "AFV201", "slotCode": "morning", "departureTime": "07:00:00", "active": true }
  ]
}
```

### EstatísticasCompanhia

```json
{
  "totalFlights": 4287,
  "totalHours": 12950,
  "activeMembers": 63,
  "foundedDate": "2020-03-01",
  "firstFlight": { "from": "FQMA", "to": "FQNC", "date": "2020-03-01" },
  "division": "VATSIM Sub-Saharan Africa (VATSSA)",
  "callsignPrefix": "AFV",
  "updatedAt": "2026-04-20T00:00:00Z"
}
```

## Lógica de preços

A lógica completa de pesquisa e de preços está documentada em [`algoritmos.md`](algoritmos.md). Em resumo:

### Fórmula de preço

```
porPessoa = round(
    tarifaBase
  * (0.70 + 0.30 * multCombustivel)
  * multClasse
  * multSazonal
  * multProcura
  + 45
)
```

### Tarifa base

`max(45, km * 0.065)`, com desconto de 20 por cento para rotas acima de 5000 km.

### Multiplicadores por classe de cabine

| Cabine | Multiplicador |
|---|---|
| Económica | 1.0 |
| Executiva | 3.2 |
| Primeira | 6.5 |

### Multiplicadores de procura (fator de ocupação)

| Fator de ocupação | Multiplicador |
|---|---|
| 90 por cento ou mais | 1.45 |
| 75 a 89 por cento | 1.20 |
| 50 a 74 por cento | 1.00 |
| 25 a 49 por cento | 0.85 |
| abaixo de 25 por cento | 0.70 |

### Multiplicador de combustível (preço do petróleo)

```
multCombustivel = clamp(0.70 + 0.30 * (precoPetroleo / 80), 0.70, 1.50)
```

Fonte: Alpha Vantage (Brent crude), em cache durante 24 horas.

### Multiplicadores sazonais

Multiplicadores específicos por região, aplicados por mês (por exemplo, a Europa atinge o pico de junho a agosto). Etiquetas: `peak`, `high`, `shoulder` e `low`.

## Resumo de endpoints

| Método | Endpoint | Autenticação | Descrição |
|---|---|---|---|
| `GET` | `/api/health` | Nenhuma | Estado do serviço |
| `POST` | `/api/auth/register` | Nenhuma | Registar utilizador |
| `POST` | `/api/auth/login` | Nenhuma | Iniciar sessão |
| `GET` | `/api/auth/me` | Obrigatória | Utilizador atual |
| `GET` | `/api/flights/search` | Nenhuma | Pesquisar itinerários |
| `GET` | `/api/flights/routes` | Nenhuma | Listar rotas |
| `GET` | `/api/flights/airports` | Nenhuma | Listar aeroportos |
| `POST` | `/api/flights/itinerary` | Nenhuma | Hidratar itinerário |
| `POST` | `/api/flights/seat-map` | Nenhuma | Lugares ocupados e layout |
| `GET` | `/api/flights/pricing-factors` | Nenhuma | Multiplicadores de preço |
| `GET` | `/api/fleet` | Nenhuma | Listar frota |
| `GET` | `/api/fleet/{id}` | Nenhuma | Obter aeronave |
| `POST` | `/api/fleet` | Admin | Criar aeronave |
| `PUT` | `/api/fleet/{id}` | Admin | Atualizar aeronave |
| `DELETE` | `/api/fleet/{id}` | Admin | Retirar aeronave |
| `POST` | `/api/bookings` | Opcional | Criar reserva |
| `GET` | `/api/bookings/my` | Obrigatória | As minhas reservas |
| `GET` | `/api/bookings/lookup` | Nenhuma | Consulta por referência e email |
| `GET` | `/api/bookings/{ref}` | Obrigatória | Obter reserva |
| `PUT` | `/api/bookings/{ref}/cancel` | Obrigatória | Cancelar reserva |
| `GET` | `/api/admin/stats` | Admin | Estatísticas do painel |
| `GET` | `/api/admin/metrics` | Admin | Métricas analíticas (descritiva e inferencial) |
| `GET` | `/api/admin/users` | Admin | Listar utilizadores |
| `POST` | `/api/admin/users` | Admin principal | Criar utilizador |
| `PUT` | `/api/admin/users/{id}/role` | Admin principal | Alterar função |
| `GET` | `/api/admin/bookings` | Admin | Todas as reservas |
| `PUT` | `/api/admin/bookings/{ref}/status` | Admin | Atualizar estado |
| `GET` | `/api/admin/fleet` | Admin | Todas as aeronaves |
| `GET` | `/api/admin/lookups` | Admin | Dados de referência |
| `GET` | `/api/admin/routes` | Admin | Todas as rotas |
| `POST` | `/api/admin/routes` | Admin | Criar rota |
| `PUT` | `/api/admin/routes/{id}` | Admin | Atualizar rota |
| `GET` | `/api/admin/airline-stats` | Admin | Estatísticas da companhia |
| `PUT` | `/api/admin/airline-stats` | Admin | Atualizar estatísticas |
| `GET` | `/api/vatsim/online` | Nenhuma | Pilotos online |
| `GET` | `/api/vatsim/stats` | Nenhuma | Estatísticas da companhia (público) |
