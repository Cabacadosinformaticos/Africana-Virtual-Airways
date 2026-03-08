# ✈️ Africana Virtual Airways

**Africana Virtual Airways** é uma plataforma web desenvolvida no âmbito da unidade curricular **Projeto de Desenvolvimento Web** da **Licenciatura em Engenharia Informática do IADE – Universidade Europeia**.

O projeto consiste no desenvolvimento de uma **web application completa para reserva de voos**, inspirada em plataformas reais de companhias aéreas como Emirates ou Lufthansa. O sistema permite aos utilizadores pesquisar voos, selecionar lugares, gerir reservas e explorar informações da companhia aérea através de uma interface moderna e interativa.

A plataforma pretende simular o funcionamento de um **sistema digital de gestão de uma companhia aérea**, integrando componentes de frontend interativo, backend com lógica de negócio, APIs externas e ferramentas administrativas para gestão operacional.

O projeto segue a metodologia **Project-Based Learning (PBL)** e tem como objetivo aplicar conhecimentos de desenvolvimento web, arquitetura de sistemas, integração de APIs e design de interfaces centradas no utilizador.

---

# 🎯 Objetivo do Projeto

O objetivo principal é desenvolver uma **plataforma web funcional para gestão e reserva de voos**, simulando os principais serviços digitais oferecidos por companhias aéreas modernas.

Entre os principais objetivos estão:

- Criar uma **interface intuitiva para pesquisa e reserva de voos**
- Implementar um **sistema de gestão de reservas (PNR)**
- Integrar **dados externos de aviação e meteorologia**
- Desenvolver **visualizações interativas de rotas e aeronaves**
- Construir um **backoffice administrativo para monitorização do sistema**
- Aplicar boas práticas de **UI/UX, segurança e arquitetura web**

---

# 🖥️ Frontend

O frontend da plataforma será responsável pela **experiência do utilizador**, disponibilizando várias interfaces interativas relacionadas com a operação da companhia aérea.

## Sistema de Reserva (Booking UI)

Interface de pesquisa de voos que permite ao utilizador selecionar origem, destino e datas de viagem, bem como preencher os dados dos passageiros para concluir a reserva.

## Mapa de Assentos Interativo

Representação visual da cabine da aeronave que permite ao utilizador selecionar lugares disponíveis em tempo real.

## Gestão de Reserva

Portal **“Minhas Viagens”** onde os utilizadores podem inserir a referência da reserva (PNR) para consultar itinerários, detalhes do voo e estado da reserva.

## Rede de Destinos

Visualização global das rotas operadas pela companhia através de um **globo interativo em 3D**, utilizando tecnologias como **Three.js** ou **WebGL**.

## Galeria da Frota

Página responsiva dedicada à apresentação da frota da companhia aérea, organizada hierarquicamente desde aeronaves ligeiras (ex: **Cessna 172**) até aeronaves de grande capacidade como **Boeing 747** ou **Airbus A380**, incluindo especificações técnicas.

## In-Flight Entertainment (IFE)

Centro de entretenimento digital inspirado nos sistemas reais das companhias aéreas, incluindo:

- leitor de vídeo para conteúdos multimédia  
- jogos baseados em browser desenvolvidos com **HTML5 Canvas**

## Live Flight Map

Mapa interativo que apresenta aeronaves em movimento, utilizando bibliotecas como **Leaflet** ou **Mapbox**, permitindo acompanhar rotas e posições em tempo real.

---

# ⚙️ Backend

O backend será responsável pela **lógica de negócio, gestão de dados e integração com serviços externos**.

## Motor de Reservas e Sistema PNR

Sistema responsável pela geração de **Passenger Name Records (PNR)** únicos e pela gestão das reservas efetuadas.

Funcionalidades principais:

- criação de reservas  
- modificação de itinerários  
- cancelamento de voos  
- armazenamento em **base de dados relacional (MySQL)**

## Integração VATSIM & Weather API

Integração com APIs externas para enriquecimento da informação de voo.

Inclui:

- consumo da **API VATSIM** para obtenção de voos ativos  
- cálculo dinâmico de **ETA (Estimated Time of Arrival)**  
- integração com **OpenWeather API** para dados meteorológicos do destino  

## Gestão de Conteúdo (CMS)

Sistema interno responsável pela gestão dos conteúdos da plataforma, incluindo:

- streaming de conteúdos de entretenimento  
- lógica de pontuações e **high scores** para jogos do sistema IFE  

## Backoffice Administrativo

Painel administrativo restrito que permite monitorizar e gerir o funcionamento da plataforma.

Entre as funcionalidades:

- monitorização de tráfego  
- gestão de frota  
- gestão de reservas  
- análise estatística de utilização  

## Segurança e Autenticação

Implementação de mecanismos de segurança para proteger o sistema.

Inclui:

- autenticação de administradores  
- proteção de rotas sensíveis da API  
- controlo de acesso ao painel administrativo  

---

# 👥 Equipa de Desenvolvimento

Projeto desenvolvido por:

**Tiago Manuel Antunes Cabaça**  
Número de aluno: 20241185  

**César de Oliveira Rodrigues**  
Número de aluno: 20240449  

**Muhammad Sudeis Abdul Latif Sacoor**  
Número de aluno: 20241707  

Licenciatura em **Engenharia Informática**  
**IADE – Universidade Europeia**

---

# 📜 Licença

Este projeto é distribuído sob a licença **MIT License**.

A licença MIT permite que o software seja utilizado, modificado e distribuído livremente, desde que seja mantido o aviso de copyright original e a referência à licença.

Para mais detalhes consultar o ficheiro **LICENSE** presente neste repositório.
