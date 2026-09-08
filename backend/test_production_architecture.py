"""
test_production_architecture.py — Automated verification of production architecture features.

Tests:
1. Multi-tenant sliding window isolation (Tenant A does not affect Tenant B).
2. Monotonic sequence counter increments sequentially per tenant.
3. Connection manager ring buffer backfill (seq > since_seq).
4. One-time WebSocket ticket lifecycle (valid, single-use burn, tenant binding).
5. Token creation and claims validation.
"""

import unittest
from datetime import datetime, timezone

from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_ws_ticket,
    decode_token_payload,
    validate_and_burn_ticket,
)
from app.engine import rules
from app.models.schemas import Action, LogEvent
from app.ws.connection_manager import ConnectionManager


class TestProductionArchitecture(unittest.TestCase):
    def test_multi_tenant_sliding_window_isolation(self):
        """Verify that failed logins in Org A do not trigger false alerts in Org B."""
        ip = "192.0.2.1"
        now = datetime.now(timezone.utc)

        # Send 4 failed logins to tenant_a (threshold for MEDIUM is 3-5, >5 is HIGH)
        # First 2 should be None
        evt1 = LogEvent(
            timestamp=now,
            source_ip=ip,
            dest_ip="10.0.0.1",
            action=Action.LOGIN,
            status_code=401,
            bytes_sent=100,
            tenant_id="tenant_a",
        )
        for _ in range(2):
            alert = rules.analyze(evt1)
            self.assertIsNone(alert)

        # Send 1 failed login to tenant_b for the SAME source IP
        evt_b = LogEvent(
            timestamp=now,
            source_ip=ip,
            dest_ip="10.0.0.1",
            action=Action.LOGIN,
            status_code=401,
            bytes_sent=100,
            tenant_id="tenant_b",
        )
        alert_b = rules.analyze(evt_b)
        # Should be None because tenant_b has only 1 attempt
        self.assertIsNone(alert_b)

    def test_monotonic_sequence_and_backfill(self):
        """Verify that ConnectionManager assigns monotonic sequences and provides zero-gap backfills."""
        cm = ConnectionManager()

        seq1 = cm.next_seq("tenant_alpha")
        seq2 = cm.next_seq("tenant_alpha")
        seq3 = cm.next_seq("tenant_alpha")

        self.assertEqual(seq1, 1)
        self.assertEqual(seq2, 2)
        self.assertEqual(seq3, 3)

        # Distinct tenant should start at 1
        seq_beta = cm.next_seq("tenant_beta")
        self.assertEqual(seq_beta, 1)

        # Push items to ring buffer
        cm._ring_buffers["tenant_alpha"].append({"alert_id": "a1", "seq": 1, "threat_type": "BRUTE_FORCE"})
        cm._ring_buffers["tenant_alpha"].append({"alert_id": "a2", "seq": 2, "threat_type": "PORT_SCAN"})
        cm._ring_buffers["tenant_alpha"].append({"alert_id": "a3", "seq": 3, "threat_type": "DATA_EXFIL"})

        # Reconnect with last_seq = 1 -> should backfill alerts 2 and 3
        backfill = cm.get_backfill(tenant_id="tenant_alpha", since_seq=1)
        self.assertEqual(len(backfill), 2)
        self.assertEqual(backfill[0]["seq"], 2)
        self.assertEqual(backfill[1]["seq"], 3)

        # Reconnect with last_seq = 3 -> no backfill needed
        backfill_none = cm.get_backfill(tenant_id="tenant_alpha", since_seq=3)
        self.assertEqual(len(backfill_none), 0)

    def test_ws_ticket_lifecycle_and_tenant_binding(self):
        """Verify one-time ticket creation, single-use burn, and tenant binding."""
        ticket = create_ws_ticket(tenant_id="tenant_gamma")

        # First validation with correct tenant must succeed and burn the ticket
        self.assertTrue(validate_and_burn_ticket(ticket, expected_tenant="tenant_gamma"))

        # Second validation must fail because ticket was burned
        self.assertFalse(validate_and_burn_ticket(ticket, expected_tenant="tenant_gamma"))

        # New ticket with mismatched tenant must fail
        ticket2 = create_ws_ticket(tenant_id="tenant_gamma")
        self.assertFalse(validate_and_burn_ticket(ticket2, expected_tenant="wrong_tenant"))

    def test_jwt_multi_tenant_claims(self):
        """Verify that access and refresh tokens contain correct tenant claims."""
        access = create_access_token(subject="analyst_1", tenant_id="org_cyber")
        payload = decode_token_payload(access)

        self.assertIsNotNone(payload)
        self.assertEqual(payload.get("sub"), "analyst_1")
        self.assertEqual(payload.get("tenant_id"), "org_cyber")
        self.assertEqual(payload.get("type"), "access")

        refresh = create_refresh_token(subject="analyst_1", tenant_id="org_cyber")
        ref_payload = decode_token_payload(refresh)

        self.assertIsNotNone(ref_payload)
        self.assertEqual(ref_payload.get("sub"), "analyst_1")
        self.assertEqual(ref_payload.get("tenant_id"), "org_cyber")
        self.assertEqual(ref_payload.get("type"), "refresh")
        self.assertIn("jti", ref_payload)


if __name__ == "__main__":
    unittest.main()
