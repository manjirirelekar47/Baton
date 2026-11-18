from tests.conftest import login


def test_source_change_scan_creates_alert_and_non_approver_cannot_scan(client):
    approver = login(client, "approver")
    def upload(content):
        return client.post("/sources", headers=approver, data={"consent": "true", "acl_label": "L1"}, files={"file": ("release.md", content, "text/markdown")})
    assert upload(b"The release owner is Aarav.").status_code == 201
    first_scan = client.post("/drift/scan", headers=approver)
    assert first_scan.status_code == 200 and first_scan.json()["baselined"] >= 1
    assert upload(b"The release owner is Meera.").status_code == 201
    second_scan = client.post("/drift/scan", headers=approver)
    assert second_scan.status_code == 200 and second_scan.json()["changed"] >= 1
    alerts = client.get("/drift/alerts", headers=approver)
    assert alerts.status_code == 200
    assert alerts.json()[0]["title"] == "release.md"
    assert client.post("/drift/scan", headers=login(client, "incoming_contributor")).status_code == 403


def test_source_change_alerts_are_project_and_acl_filtered(client):
    approver = login(client, "approver")
    client.post("/sources", headers=approver, data={"consent": "true", "acl_label": "L3"}, files={"file": ("private.md", b"A private release decision.", "text/markdown")})
    client.post("/drift/scan", headers=approver)
    client.post("/sources", headers=approver, data={"consent": "true", "acl_label": "L3"}, files={"file": ("private.md", b"A changed private release decision.", "text/markdown")})
    client.post("/drift/scan", headers=approver)
    result = client.get("/drift/alerts", headers=login(client, "incoming_contributor"))
    assert result.status_code == 200
    assert all(alert["title"] != "private.md" for alert in result.json())


def test_demo_reset_clears_only_the_seeded_workspace_alerts(client):
    approver = login(client, "approver")
    client.post("/sources", headers=approver, data={"consent": "true", "acl_label": "L1"}, files={"file": ("reset-test.md", b"First version of a source.", "text/markdown")})
    client.post("/drift/scan", headers=approver)
    client.post("/sources", headers=approver, data={"consent": "true", "acl_label": "L1"}, files={"file": ("reset-test.md", b"Changed version of a source.", "text/markdown")})
    client.post("/drift/scan", headers=approver)
    assert client.get("/drift/alerts", headers=approver).json()
    assert client.post("/demo/reset").status_code == 200
    assert client.get("/drift/alerts", headers=approver).json() == []
