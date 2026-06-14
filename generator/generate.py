"""
generator/generate.py — Fake network log event producer.

Rules:
- NEVER write to a shared file. Only POST to /api/v1/ingest.
- All events conform exactly to the Log Event Schema.
- Accepts --rate (events/sec) and --burst (spike multiplier) flags.
"""

import argparse
import asyncio
import json
import random
import uuid
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv
import os

load_dotenv()

INGEST_URL = os.getenv("INGEST_URL", "http://localhost:8000/api/v1/ingest")

# ---------------------------------------------------------------------------
# Fake IP pools — these lat/lng coordinates are also used by the 3D Globe
# to place attack markers. The frontend hardcodes the same mapping.
# ---------------------------------------------------------------------------

SOURCE_IPS = [
    "185.220.101.47",   # Tor exit — Russia
    "45.33.32.156",     # Linode — US
    "91.108.4.202",     # Telegram infra — Netherlands
    "104.21.45.89",     # Cloudflare — US
    "198.51.100.7",     # TEST-NET — generic
    "203.0.113.42",     # TEST-NET — generic
    "192.0.2.18",       # TEST-NET — generic
    "5.188.206.14",     # RU botnet
    "194.165.16.20",    # UA VPS
    "77.88.55.60",      # Yandex — Russia
    "159.65.92.11",     # DigitalOcean — Germany
    "165.22.58.130",    # DigitalOcean — Singapore
    "167.172.138.143",  # DigitalOcean — US
    "209.141.55.170",   # US VPS
    "218.92.0.186",     # CN — China Telecom
    "220.181.38.251",   # CN — Baidu
    "1.180.0.1",        # CN — APNIC
    "61.135.169.125",   # CN
    "175.45.176.3",     # KP — North Korea (well-known range)
    "196.216.2.1",      # ZA — South Africa
]

DEST_IPS = [
    "10.0.0.1",
    "10.0.0.2",
    "10.0.0.3",
    "10.0.0.10",
    "10.0.0.11",
    "10.0.0.20",
    "10.0.0.50",
    "10.0.0.100",
    "172.16.0.1",
    "172.16.0.5",
    "172.16.1.1",
    "192.168.1.1",
    "192.168.1.100",
    "192.168.2.1",
    "192.168.10.5",
]

USERNAMES = ["admin", "root", "user1", "svc_account", "dbadmin", "guest", None, None]

ACTIONS = ["LOGIN", "REQUEST", "TRANSFER"]

# Status code pools per action — weighted toward realistic distributions
STATUS_CODES = {
    "LOGIN":    ([200] * 3) + ([401] * 5) + ([403] * 2),
    "REQUEST":  ([200] * 6) + ([404] * 2) + ([500] * 1) + ([403] * 1),
    "TRANSFER": ([200] * 7) + ([500] * 2) + ([403] * 1),
}

# ---------------------------------------------------------------------------
# Threat scenario generators
# These deliberately produce events that WILL trigger rules engine alerts.
# ---------------------------------------------------------------------------

def make_brute_force_burst(source_ip: str) -> list[dict]:
    """6 failed LOGINs from same IP within a tight window → HIGH BRUTE_FORCE."""
    events = []
    for _ in range(6):
        events.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source_ip": source_ip,
            "dest_ip": random.choice(DEST_IPS),
            "action": "LOGIN",
            "status_code": 401,
            "username": random.choice(["admin", "root", "administrator"]),
            "bytes_sent": 0,
        })
    return events


def make_port_scan_burst(source_ip: str) -> list[dict]:
    """12 REQUESTs to distinct dest IPs from same source → HIGH PORT_SCAN."""
    dest_pool = random.sample(DEST_IPS, min(12, len(DEST_IPS)))
    extra = [f"10.0.{random.randint(1, 254)}.{random.randint(1, 254)}"
             for _ in range(max(0, 12 - len(dest_pool)))]
    events = []
    for dest in dest_pool + extra:
        events.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source_ip": source_ip,
            "dest_ip": dest,
            "action": "REQUEST",
            "status_code": random.choice([403, 404, 200]),
            "username": None,
            "bytes_sent": random.randint(64, 1024),
        })
    return events


def make_data_exfil_event(source_ip: str) -> dict:
    """Single TRANSFER with bytes_sent > 10_000_000 → HIGH DATA_EXFIL."""
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source_ip": source_ip,
        "dest_ip": random.choice(DEST_IPS),
        "action": "TRANSFER",
        "status_code": 200,
        "username": random.choice(["svc_account", "dbadmin"]),
        "bytes_sent": random.randint(10_000_001, 50_000_000),
    }


def make_random_event() -> dict:
    """Normal background traffic — usually benign."""
    action = random.choice(ACTIONS)
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source_ip": random.choice(SOURCE_IPS),
        "dest_ip": random.choice(DEST_IPS),
        "action": action,
        "status_code": random.choice(STATUS_CODES[action]),
        "username": random.choice(USERNAMES),
        "bytes_sent": random.randint(64, 500_000),
    }


# ---------------------------------------------------------------------------
# Async sender
# ---------------------------------------------------------------------------

async def send_event(client: httpx.AsyncClient, event: dict) -> None:
    try:
        resp = await client.post(INGEST_URL, json=event, timeout=5.0)
        status_marker = "✓" if resp.status_code == 200 else f"✗{resp.status_code}"
        print(f"[{status_marker}] {event['action']:8s} {event['source_ip']:20s} → {event['dest_ip']}")
    except httpx.RequestError as exc:
        print(f"[ERR] Could not reach backend: {exc}")


async def run(rate: float, burst: bool) -> None:
    """
    Main send loop.
    rate  — events per second (normal mode)
    burst — when True, periodically inject threat scenarios
    """
    interval = 1.0 / rate
    burst_counter = 0

    async with httpx.AsyncClient() as client:
        print(f"SentinelView Generator — target: {INGEST_URL}")
        print(f"Rate: {rate} evt/s  |  Burst mode: {'ON' if burst else 'OFF'}")
        print("-" * 60)

        while True:
            if burst and burst_counter % 20 == 0 and burst_counter > 0:
                # Every 20 normal events, inject a threat scenario
                scenario = random.choice(["brute_force", "port_scan", "exfil"])
                src = random.choice(SOURCE_IPS)

                if scenario == "brute_force":
                    print(f"\n>>> BURST: BRUTE_FORCE scenario from {src}")
                    for evt in make_brute_force_burst(src):
                        await send_event(client, evt)
                        await asyncio.sleep(0.05)

                elif scenario == "port_scan":
                    print(f"\n>>> BURST: PORT_SCAN scenario from {src}")
                    for evt in make_port_scan_burst(src):
                        await send_event(client, evt)
                        await asyncio.sleep(0.05)

                else:
                    print(f"\n>>> BURST: DATA_EXFIL scenario from {src}")
                    await send_event(client, make_data_exfil_event(src))

                print()

            else:
                await send_event(client, make_random_event())

            burst_counter += 1
            await asyncio.sleep(interval)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="SentinelView fake network log generator.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python generate.py --rate 2
  python generate.py --rate 5 --burst
  python generate.py --rate 1 --burst   # slowest burst demo
        """,
    )
    parser.add_argument(
        "--rate",
        type=float,
        default=1.0,
        help="Events per second to send (default: 1.0)",
    )
    parser.add_argument(
        "--burst",
        action="store_true",
        help="Periodically inject threat scenarios (brute force, port scan, exfil)",
    )
    args = parser.parse_args()

    if args.rate <= 0:
        parser.error("--rate must be greater than 0")

    asyncio.run(run(rate=args.rate, burst=args.burst))


if __name__ == "__main__":
    main()
