#!/usr/bin/env python3
"""
PDV Pro - Agente Local de Impressão
====================================

Rode este script no computador que fica dentro da sua rede local (mesmo Wi-Fi/LAN
que as impressoras térmicas). Ele conecta na API do PDV Pro (nuvem), busca
os pedidos pendentes de impressão e envia os comandos ESC/POS para cada
impressora pelo endereço IP:9100 (padrão de impressoras Epson, Elgin,
Bematech, Daruma, etc.).

USO:
    1. Instale Python 3.8+ no PC.
    2. Configure abaixo (ou via variáveis de ambiente):
        - API_BASE
        - EMAIL / SENHA (usuário do PDV Pro)
    3. Execute: python agent.py

Requisitos: apenas biblioteca padrão + `requests` (`pip install requests`).
"""
import os
import time
import socket
import sys
import json
import logging

try:
    import requests
except ImportError:
    print("Instale a biblioteca requests: pip install requests")
    sys.exit(1)

# ---- CONFIGURAÇÃO ----
API_BASE = os.environ.get("PDV_API_BASE", "https://sales-hub-774.preview.emergentagent.com/api")
EMAIL = os.environ.get("PDV_EMAIL", "admin@pdvpro.com")
SENHA = os.environ.get("PDV_SENHA", "admin123")
POLL_INTERVAL = int(os.environ.get("PDV_POLL_INTERVAL", "3"))  # segundos
PRINT_TIMEOUT = int(os.environ.get("PDV_PRINT_TIMEOUT", "8"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("print-agent")


def login() -> str:
    r = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": EMAIL, "password": SENHA},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def get_jobs(token: str):
    r = requests.get(
        f"{API_BASE}/print/queue",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    if r.status_code == 401:
        return None
    r.raise_for_status()
    return r.json()


def mark_done(token: str, job_id: str):
    requests.post(
        f"{API_BASE}/print/queue/{job_id}/done",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )


def mark_fail(token: str, job_id: str, error: str):
    try:
        requests.post(
            f"{API_BASE}/print/queue/{job_id}/fail",
            headers={"Authorization": f"Bearer {token}"},
            json={"error": error},
            timeout=10,
        )
    except Exception:
        pass


def send_to_printer(ip: str, port: int, payload: str) -> bool:
    """Send ESC/POS payload to a network thermal printer."""
    try:
        with socket.create_connection((ip, port), timeout=PRINT_TIMEOUT) as s:
            data = payload.encode("cp860", errors="replace")  # portuguese charset
            s.sendall(data)
            time.sleep(0.4)
        return True
    except Exception as e:
        log.error("Falha impressao %s:%s -> %s", ip, port, e)
        return False


def main():
    log.info("PDV Pro Print Agent iniciado")
    log.info("API: %s | usuario: %s | intervalo: %ss", API_BASE, EMAIL, POLL_INTERVAL)

    token = None
    while True:
        try:
            if token is None:
                token = login()
                log.info("Autenticado com sucesso.")

            jobs = get_jobs(token)
            if jobs is None:  # 401
                log.warning("Sessão expirada, reautenticando...")
                token = None
                continue

            if jobs:
                log.info("Novos trabalhos: %d", len(jobs))

            for job in jobs:
                ip = job.get("printer_ip")
                port = int(job.get("printer_port") or 9100)
                payload = job.get("payload", "")
                log.info(
                    "Imprimindo job %s -> %s (%s:%s) - comanda %s",
                    job["id"][:8], job.get("printer_name"), ip, port, job.get("order_code"),
                )
                ok = send_to_printer(ip, port, payload)
                if ok:
                    mark_done(token, job["id"])
                    log.info("  OK")
                else:
                    mark_fail(token, job["id"], f"falha ao conectar em {ip}:{port}")

        except requests.HTTPError as e:
            log.error("HTTP: %s", e)
            token = None
        except requests.ConnectionError:
            log.warning("Sem conexao com a API, tentando de novo...")
        except KeyboardInterrupt:
            log.info("Encerrando...")
            break
        except Exception as e:
            log.exception("Erro inesperado: %s", e)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
