"""Release smoke test. Usage: python infra/smoke_test.py https://api.example.com
Walks: demo login, Reconstruct (replay), open a citation, approve, contributor view (leakage check)."""
import json
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")
RESTRICTED_MARKERS = ["Sponsor funding", "S4-301", "c-010"]


def call(method, path, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode()


def step(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f" ({detail})" if detail else ""))
    if not ok:
        sys.exit(1)


status, _ = call("GET", "/health")
step("health", status == 200, status)
status, _ = call("POST", "/demo/reset")
step("demo reset", status == 200, status)

status, body = call("POST", "/auth/demo-login", body={"role": "approver"})
step("approver login", status == 200, status)
approver = json.loads(body)["token"]

status, _ = call("POST", "/reconstruct", approver, {})
step("reconstruct (replay)", status == 200, status)
status, body = call("GET", "/chunks/S4-212", approver)
step("open citation", status == 200 and "Rohan took payments over" in body, status)
status, _ = call("POST", "/review/approve", approver, {})
step("approve", status == 200, status)
status, body = call("GET", "/versions", approver)
versions = json.loads(body)
step("version exists", status == 200 and len(versions) > 0)
version_id = versions[-1]["version_id"]

status, body = call("POST", "/auth/demo-login", body={"role": "incoming_contributor"})
step("contributor login", status == 200, status)
contributor = json.loads(body)["token"]
status, body = call("GET", f"/handover/{version_id}/view", contributor)
step("contributor view", status == 200, status)
leaked = [m for m in RESTRICTED_MARKERS if m in body]
step("no restricted text in response", not leaked, leaked)
status, _ = call("GET", f"/handover/{version_id}/plan", contributor)
step("contributor plan", status == 200, status)
print("All smoke checks passed")
