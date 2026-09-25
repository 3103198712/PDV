# PDV Pro — Restaurante · PRD

## Problema Original
"pretendo criar um app baseado em uma base de dados que tenho de um software de pdv"
Depois: PDV é de restaurante que atende iFood, hóspedes de hotel, mesas do salão e buffet de eventos. Precisa impressão de pedidos e API para app Android de garçom.

## User Personas
- **Admin** — acesso total, gerencia usuários e configurações
- **Gerente** — gestão operacional, estoque, relatórios, cancelamentos
- **Operador/Garçom** — abre mesas, lança pedidos, imprime cozinha/pré-conta, fecha contas

## Requisitos (fixos)
- 4 canais de venda: mesa (30 mesas), hotel (quarto + hóspede), ifood (nº pedido manual), buffet (evento)
- 4 setores de impressão: cozinha_quente, cozinha_fria, bar, buffet
- Impressão 80mm via navegador (comanda de cozinha por setor, pré-conta, cupom final)
- Auth JWT Bearer (funciona para app Android futuro)
- Papéis: admin, gerente, operador

## Arquitetura
- Backend FastAPI + MongoDB (motor async), JWT (pyjwt), bcrypt
- Frontend React + Tailwind + shadcn/ui + Recharts + Sonner
- Todos endpoints em /api, tokens via header Authorization Bearer

## Implementado (2026-01)
- Auth (register admin-only, login, /me, delete user)
- Produtos CRUD com campo `sector`
- Clientes CRUD
- Mesas (30 seed) com status livre/ocupada
- Comandas (orders): abrir por canal, adicionar itens, mark-printed, fechar (gera venda) com taxa serviço 10% e desconto, cancelar
- Vendas listagem + detalhe + cancelamento (devolve estoque)
- Estoque: movimentações entrada/saida/ajuste
- Relatórios: dashboard KPIs, vendas 7d, top produtos, top clientes, vendas por período 30d, distribuição pagamentos
- Usuários: CRUD admin
- Impressão 80mm: /print/kitchen/:orderId (agrupa por setor, só itens não impressos), /print/preconta/:orderId, /print/cupom/:saleId
- Seed: 3 usuários (admin/gerente/operador), 30 produtos restaurante, 10 clientes, 30 mesas, 25 vendas históricas

## Backlog / Próximos
- P1: Integração real com iFood (API de merchant/homologação)
- P1: Impressão por setor com IP direto (impressoras físicas na cozinha/bar)
- P1: App Android nativo do garçom consumindo a API
- P2: Reservas de mesa
- P2: Programa de fidelidade / cashback
- P2: NFC-e / cupom fiscal (integração SEFAZ)
- P2: Multi-lojas / franquias
- P3: Delivery próprio com rota e status

## Endpoints principais
- POST /api/auth/login, GET /api/auth/me
- GET/POST/PUT/DELETE /api/products (CRUD)
- GET/PUT /api/tables
- GET/POST /api/orders, POST /api/orders/{id}/items, /close, /cancel, /mark-printed
- GET /api/sales, GET /api/sales/{id}, POST /api/sales/{id}/cancel
- POST /api/stock/movements
- GET /api/reports/dashboard, /top-products, /top-customers, /sales-by-period
