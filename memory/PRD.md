# PDV Pro — Restaurante · PRD

## Problema original
"pretendo criar um app baseado em uma base de dados que tenho de um software de pdv"
Escopo evoluído: restaurante que atende iFood, hóspedes de hotel, mesas do salão (30) e buffet de eventos. Precisa impressão de pedidos, API pronta para app Android do garçom, painel de cozinha (KDS), impressão direta em impressoras térmicas por IP, divisão de conta em várias notas.

## Personas
- **Admin** — configurações, usuários, impressoras
- **Gerente** — operação completa, cancelamentos, estoque
- **Operador/Garçom** — abre mesa, lança pedido, imprime cozinha/pré-conta, fecha conta

## Requisitos fixos
- 4 canais: mesa (30 mesas), hotel (quarto+hóspede), ifood (nº manual), buffet (evento)
- 4 setores de impressão: cozinha_quente, cozinha_fria, bar, buffet (+ caixa para cupom)
- Auth JWT Bearer (compatível com apps mobile futuros)
- Impressão via navegador (80mm) **ou** direta IP:9100 via agente Python local
- KDS por setor com colunas Pendente/Preparando/Pronto e cronômetro por item
- Divisão de conta em até 20 notas
- PWA: instalável no Android via Chrome ("Adicionar à tela inicial")

## Arquitetura
- Backend: FastAPI + MongoDB (motor async) + JWT (PyJWT) + bcrypt
- Frontend: React + Tailwind + shadcn/ui + Recharts + Sonner + PWA (manifest + service worker)
- Agente local: script Python autônomo (`/app/print_agent/agent.py`)
- Todos endpoints em `/api`, token via `Authorization: Bearer`

## Implementado
### Iter 1 (base retail)
- Auth (register admin-only, login, /me, delete user)
- Produtos, Clientes, Vendas, Estoque, Relatórios, Usuários
- Dashboard KPIs + gráficos

### Iter 2 (pivot restaurante)
- Produtos com `sector`; seed 30 pratos/bebidas do ramo
- 30 mesas seed; endpoints /api/tables
- Comandas (orders): 4 canais, adicionar itens, mark-printed, fechar (gera venda), cancelar, taxa serviço 10%
- Impressão 80mm no navegador: cupom cozinha (por setor), pré-conta, cupom final

### Iter 3 (impressão IP + KDS + PWA + split)
- Impressoras cadastráveis por setor (nome/IP/porta/ativa)
- Fila de impressão (print_jobs) com ESC/POS gerado no backend (com \x1b \x1d, corte, negrito, tamanho duplo)
- Agente Python local (`agent.py`) que faz polling, envia via socket TCP e marca done/fail
- KDS: `/kds` (seleção de setor) + `/kds/{sector}` (3 colunas + cronômetro colorido por urgência)
- Endpoints: GET /kds/{sector}, POST /kds/orders/{oid}/items/{iid}/status
- Divisão de conta: POST /orders/{id}/close-split com `splits: 1..20` gera N vendas ratateadas
- PWA: manifest.json, service-worker.js, ícones 192/512, InstallPrompt no cliente
- Layout mobile responsivo: sidebar vira drawer com hamburguer no topo

## Backlog
- P1: App Android nativo do garçom (agora a API está pronta; PWA cobre o caso na maioria dos aparelhos)
- P1: Integração real com iFood (API merchant + homologação)
- P1: NFC-e / cupom fiscal integrado com SEFAZ
- P2: Reservas de mesa (data/horário + confirmação WhatsApp)
- P2: Programa de fidelidade / cashback
- P2: Multi-lojas
- P3: Push web para KDS (WebSocket) em vez de polling
- P3: Delivery próprio com status de rota

## Endpoints principais
- POST /api/auth/login, GET /api/auth/me
- GET/POST/PUT/DELETE /api/products, /api/customers, /api/printers
- GET/PUT /api/tables
- GET/POST /api/orders, /api/orders/{id}/items, /close, /close-split, /cancel, /mark-printed
- GET /api/sales, /api/sales/{id}, POST /api/sales/{id}/cancel
- POST /api/stock/movements
- GET /api/reports/dashboard, /top-products, /top-customers, /sales-by-period
- GET /api/print/queue, POST /api/print/queue/{id}/done|fail, GET /api/print/jobs
- GET /api/kds/{sector}, POST /api/kds/orders/{oid}/items/{iid}/status
