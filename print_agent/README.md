# PDV Pro — Agente Local de Impressão

Este agente roda no computador da sua rede (o "caixa" ou um mini-PC/Raspberry Pi) e envia os pedidos de impressão da nuvem para as impressoras térmicas locais.

## Como funciona

```
[PDV Pro nuvem]  --(fila HTTPS)-->  [Agente local Python]  --(TCP 9100)-->  [Impressoras Cozinha/Bar/Buffet]
```

1. Um garçom lança o pedido pelo app → backend enfileira jobs por setor.
2. O agente faz *polling* na API a cada 3s.
3. Para cada job, envia o payload ESC/POS via socket TCP para o `IP:9100` da impressora.

## Requisitos

- Python 3.8 ou superior (Windows, Linux, macOS, Raspberry Pi)
- Impressoras térmicas configuradas com IP fixo na rede (padrão Epson TM-T20/T88, Elgin i9, Bematech MP-4200, Daruma DR800)
- Rede com Wi-Fi ou cabo alcançando as impressoras

## Instalação

```bash
pip install requests
```

## Configuração

Abra `agent.py` e ajuste as variáveis no topo, ou defina como variáveis de ambiente:

```bash
export PDV_API_BASE="https://sua-instancia.emergentagent.com/api"
export PDV_EMAIL="admin@pdvpro.com"
export PDV_SENHA="admin123"
```

## Cadastro de impressoras

No painel web, vá em **Configurações → Impressoras** e crie uma entrada para cada impressora:

| Nome                | Setor           | IP              | Porta |
|---------------------|-----------------|-----------------|-------|
| Cozinha Quente 1    | cozinha_quente  | 192.168.1.201   | 9100  |
| Cozinha Fria        | cozinha_fria    | 192.168.1.202   | 9100  |
| Bar                 | bar             | 192.168.1.203   | 9100  |
| Buffet              | buffet          | 192.168.1.204   | 9100  |
| Caixa (cupom final) | caixa           | 192.168.1.200   | 9100  |

## Executar

```bash
python agent.py
```

Deixe rodando 24/7. Recomendamos usar **PM2**, **systemd** (Linux) ou o **Agendador de Tarefas** (Windows).

### Exemplo systemd (Linux)

`/etc/systemd/system/pdvpro-agent.service`
```ini
[Unit]
Description=PDV Pro Print Agent
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/pdvpro-agent
Environment="PDV_API_BASE=https://sua-instancia.emergentagent.com/api"
Environment="PDV_EMAIL=admin@pdvpro.com"
Environment="PDV_SENHA=admin123"
ExecStart=/usr/bin/python3 /home/pi/pdvpro-agent/agent.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable pdvpro-agent
sudo systemctl start pdvpro-agent
```

## Testar impressora manualmente

```bash
python -c "import socket; s=socket.create_connection(('192.168.1.201',9100),3); s.sendall(b'\x1b@Teste PDV Pro\n\n\n\x1dV\x00'); s.close()"
```

Se o cupom sair, tudo certo. Se não sair, cheque:
- IP correto? (ping do computador do agente)
- Impressora ligada e com papel?
- Porta 9100 aberta? (algumas usam 6100 ou 9101 — ajuste no cadastro)
