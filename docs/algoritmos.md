# Lógica de Negócio

A lógica de negócio central tem três componentes, implementadas em [`../includes/helpers.php`](../includes/helpers.php) e [`../api/admin.php`](../api/admin.php):

1. Pesquisa de itinerários, que encontra ligações entre dois aeroportos, incluindo voos com escala.
2. Cálculo dinâmico de preços, que determina a tarifa em função de vários fatores.
3. Análise estatística, que alimenta o dashboard administrativo.

## 1. Pesquisa de itinerários

A rede de voos é modelada como um grafo dirigido: os nós são aeroportos (códigos ICAO) e as arestas são rotas ativas. Pesquisar um voo equivale a encontrar caminhos do aeroporto de origem para o de destino.

### Procura de caminhos

A função `_search_find_paths()` aplica uma pesquisa em largura (Breadth-First Search):

* Cada item da fila contém o aeroporto atual, o caminho percorrido e o conjunto de aeroportos já visitados.
* Em cada passo, expande para todas as rotas que partem do aeroporto atual.
* Se a rota chega ao destino, o caminho é guardado como resultado.
* Caso contrário, continua a expandir enquanto o caminho tiver menos de 3 segmentos (no máximo 2 escalas) e o próximo aeroporto ainda não tiver sido visitado, evitando ciclos.
* A procura termina ao atingir 50 caminhos candidatos, um limite de segurança.

```
fila := [(origem, [], {origem})]
enquanto fila nao vazia e |caminhos| < 50:
    (atual, caminho, visitados) := remover da fila
    para cada rota que parte de 'atual':
        proximo := destino da rota
        novoCaminho := caminho + rota
        se proximo == destino:
            caminhos := caminhos + novoCaminho
        senao se |novoCaminho| < 3 e proximo nao em visitados:
            inserir na fila (proximo, novoCaminho, visitados + {proximo})
```

### Construção e horários

Para cada caminho encontrado, a função `_search_build_path()` gera itinerários concretos:

* Voos diretos (1 segmento): um itinerário por cada horário ativo da rota.
* Voos com escala (2 a 3 segmentos): parte de cada horário do primeiro troço e, em cada escala, escolhe a primeira ligação válida, ou seja, a que respeita uma escala mínima de 90 minutos, procurando no próprio dia e, se necessário, no dia seguinte.

Cada segmento é hidratado com data e hora de partida e de chegada, duração, distância e aeronave. As chegadas no dia seguinte são assinaladas com o sufixo `+1`.

### Ordenação e resposta

Os itinerários são ordenados por número de escalas e, em caso de empate, por preço de económica. São devolvidos no máximo 8 resultados, acompanhados de um resumo com o número total de resultados e a indicação de existirem opções com escala.

O custo da pesquisa está limitado por construção (no máximo 3 segmentos, 50 caminhos e 8 resultados), o que garante um tempo de resposta estável mesmo numa rede de 100 rotas.

## 2. Cálculo dinâmico de preços

O preço por pessoa de cada segmento, na função `calc_price()`, resulta da seguinte fórmula:

```
porPessoa = round(
    tarifaBase
  * (0.70 + 0.30 * multCombustivel)    // componente de combustivel
  * multClasse                         // classe de cabine
  * multSazonal                        // epoca e regiao do destino
  * multProcura                        // fator de ocupacao
  + 45                                 // impostos e taxas (USD)
)
```

O preço total de um itinerário é a soma dos segmentos, multiplicada pelo número de passageiros.

### Tarifa base

A tarifa base é `max(45, km * 0.065)`, com um desconto de 20 por cento (fator 0.80) para rotas de longo curso acima de 5000 km, refletindo a economia de escala dos voos longos.

### Multiplicador de classe

| Classe | Multiplicador |
|---|---|
| Económica | 1.0 |
| Executiva | 3.2 |
| Primeira | 6.5 |

Em itinerários com escala, os troços sem cabine executiva ou primeira recaem no preço da classe imediatamente inferior disponível.

### Multiplicador de combustível

Obtido a partir do preço do Brent crude (Alpha Vantage), normalizado e limitado:

```
multCombustivel = clamp(0.70 + 0.30 * (precoPetroleo / 80), 0.70, 1.50)
```

O preço é colocado em cache durante 24 horas. Sem chave de API ou sem rede, é usado o valor de referência de 80 USD por barril, que corresponde ao multiplicador 1.0. O combustível pesa apenas numa fração do preço (`0.70 + 0.30 * mult`), o que evita oscilações excessivas.

### Multiplicador sazonal

Depende do mês da viagem e da região do aeroporto de destino, inferida do prefixo ICAO pela função `pricing_region()`: África, Europa, Médio Oriente, Américas ou Ásia-Pacífico. Cada região tem o seu perfil de época alta e baixa (por exemplo, a Europa atinge o pico de junho a agosto e a África de novembro a fevereiro). Os multiplicadores variam tipicamente entre 0.78 e 1.40, com as etiquetas `peak`, `high`, `shoulder` e `low`.

### Multiplicador de procura

Depende do fator de ocupação do voo:

| Ocupação | Multiplicador |
|---|---|
| 90 por cento ou mais | 1.45 |
| 75 a 89 por cento | 1.20 |
| 50 a 74 por cento | 1.00 |
| 25 a 49 por cento | 0.85 |
| abaixo de 25 por cento | 0.70 |

Este fator modela a lógica de yield management das companhias reais: quanto mais cheio o voo, mais caro o lugar.

### Transparência

O endpoint `GET /api/flights/pricing-factors` expõe os fatores em vigor (preço do petróleo e multiplicadores sazonais por região), permitindo ao frontend mostrar ao utilizador a razão do preço de um voo, indo ao encontro da necessidade de transparência identificada na investigação de utilizadores.

## 3. Análise estatística

O backoffice inclui um motor de estatística, no endpoint `GET /api/admin/metrics`, que gera dinamicamente, a partir da base de dados, indicadores descritivos e inferenciais sobre as reservas:

* Descritiva: média, mediana, moda, desvio-padrão, variância e percentis (P10, P25, P75 e P90) do preço dos bilhetes; histograma de preços; distribuição por classe de cabine; top de rotas e de nacionalidades.
* Inferencial: intervalo de confiança a 95 por cento da média do preço, calculado como `média mais ou menos 1.96 vezes o erro-padrão`.
* Séries temporais e KPIs: evolução mensal de reservas e de novos utilizadores ao longo de 12 meses, dispersão de distância contra preço, mapa de calor de dia da semana contra classe, taxa de conversão, taxa de cancelamento e bilhete médio.

Estes dados alimentam os gráficos do dashboard administrativo e cumprem o requisito de análise estatística do projeto.
