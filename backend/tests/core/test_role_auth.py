"""Tests for role-based signup, invitation validation, and backend role authorization."""
from tests.conftest import login, make_supabase_token


def test_register_non_approver_roles(client):
    for role in ["leaver", "incoming_maintainer", "incoming_contributor"]:
        email = f"{role}-test@baton.test"
        uid = f"uid-{role}"
        sb_token = make_supabase_token(uid, email)
        res = client.post(
            "/auth/register",
            json={
                "user_id": uid,
                "email": email,
                "name": f"Test {role.title()}",
                "role": role,
                "supabase_token": sb_token,
            },
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert "token" in data
        assert data["user"]["role"] == role
        assert data["user"]["email"] == email
        assert data["user"]["is_demo"] is False

        # Verify /me endpoint reflects assigned role and identity
        me_res = client.get("/me", headers={"Authorization": f"Bearer {data['token']}"})
        assert me_res.status_code == 200
        me_data = me_res.json()
        assert me_data["role"] == role
        assert me_data["email"] == email
        assert me_data["is_demo"] is False


def test_approver_registration_requires_invitation(client):
    # 1. Registering as approver without invitation code fails with 403
    uid_fail_1 = "uid-approver-fail-1"
    email_fail_1 = "lead1@baton.test"
    res_no_code = client.post(
        "/auth/register",
        json={
            "user_id": uid_fail_1,
            "email": email_fail_1,
            "name": "Approver No Code",
            "role": "approver",
            "supabase_token": make_supabase_token(uid_fail_1, email_fail_1),
        },
    )
    assert res_no_code.status_code == 403
    assert "invitation code" in res_no_code.json()["detail"].lower()

    # 2. Registering with invalid invitation code fails with 403
    uid_fail_2 = "uid-approver-fail-2"
    email_fail_2 = "lead2@baton.test"
    res_invalid_code = client.post(
        "/auth/register",
        json={
            "user_id": uid_fail_2,
            "email": email_fail_2,
            "name": "Approver Bad Code",
            "role": "approver",
            "invitation_code": "INVALID-CODE-12345",
            "supabase_token": make_supabase_token(uid_fail_2, email_fail_2),
        },
    )
    assert res_invalid_code.status_code == 403
    assert "invitation code" in res_invalid_code.json()["detail"].lower()

    # Create dynamic invitation using approver login
    approver_headers = login(client, "approver")
    create_inv = client.post(
        "/auth/invitations",
        headers=approver_headers,
        json={"role": "approver", "email": "lead-valid@baton.test"},
    )
    assert create_inv.status_code == 200
    valid_code = create_inv.json()["code"]

    # 3. Registering with valid dynamic invitation code succeeds
    uid_valid = "uid-approver-success"
    email_valid = "lead-valid@baton.test"
    res_valid = client.post(
        "/auth/register",
        json={
            "user_id": uid_valid,
            "email": email_valid,
            "name": "Approver Valid",
            "role": "approver",
            "invitation_code": valid_code,
            "supabase_token": make_supabase_token(uid_valid, email_valid),
        },
    )
    assert res_valid.status_code == 200, res_valid.text
    data = res_valid.json()
    assert data["user"]["role"] == "approver"
    assert data["user"]["is_demo"] is False

    # 4. Reusing the same invitation code fails (single-use)
    uid_reuse = "uid-approver-reuse"
    email_reuse = "lead-reuse@baton.test"
    res_reuse = client.post(
        "/auth/register",
        json={
            "user_id": uid_reuse,
            "email": email_reuse,
            "name": "Approver Reuse",
            "role": "approver",
            "invitation_code": valid_code,
            "supabase_token": make_supabase_token(uid_reuse, email_reuse),
        },
    )
    assert res_reuse.status_code == 403


def test_invitation_validation_and_creation(client):
    # Non-approvers cannot create invitations
    uid_contrib = "uid-contrib-test"
    email_contrib = "c@baton.test"
    contrib_token = client.post(
        "/auth/register",
        json={
            "user_id": uid_contrib,
            "email": email_contrib,
            "name": "C",
            "role": "incoming_contributor",
            "supabase_token": make_supabase_token(uid_contrib, email_contrib),
        },
    ).json()["token"]
    forbidden_create = client.post(
        "/auth/invitations",
        headers={"Authorization": f"Bearer {contrib_token}"},
        json={"role": "approver"},
    )
    assert forbidden_create.status_code == 403

    # Approver can create new invitation
    approver_headers = login(client, "approver")
    create_res = client.post(
        "/auth/invitations",
        headers=approver_headers,
        json={"role": "approver", "email": "newlead@baton.test"},
    )
    assert create_res.status_code == 200
    inv = create_res.json()
    assert inv["code"].startswith("INV-APPROVER-")

    # Validate valid code
    val_res = client.get(f"/auth/invitations/validate?code={inv['code']}")
    assert val_res.status_code == 200
    assert val_res.json()["valid"] is True
    assert val_res.json()["role"] == "approver"

    # Validate invalid code
    bad_val = client.get("/auth/invitations/validate?code=DOES-NOT-EXIST")
    assert bad_val.status_code == 200
    assert bad_val.json()["valid"] is False

    # The new invitation code can be used to register
    uid_new = "uid-new-approver"
    email_new = "newlead@baton.test"
    reg_new = client.post(
        "/auth/register",
        json={
            "user_id": uid_new,
            "email": email_new,
            "name": "New Lead",
            "role": "approver",
            "invitation_code": inv["code"],
            "supabase_token": make_supabase_token(uid_new, email_new),
        },
    )
    assert reg_new.status_code == 200
    assert reg_new.json()["user"]["role"] == "approver"


def test_session_sync_endpoint(client):
    # User not yet registered
    uid_unknown = "sub-unknown-999"
    email_unknown = "unknown@baton.test"
    sync_new = client.post(
        "/auth/session",
        json={
            "user_id": uid_unknown,
            "email": email_unknown,
            "supabase_token": make_supabase_token(uid_unknown, email_unknown),
        },
    )
    assert sync_new.status_code == 200
    sync_new_data = sync_new.json()
    assert sync_new_data["registered"] is False
    assert sync_new_data["requires_role"] is True

    # User registers
    uid_known = "sub-known-123"
    email_known = "known@baton.test"
    reg = client.post(
        "/auth/register",
        json={
            "user_id": uid_known,
            "email": email_known,
            "name": "Known User",
            "role": "incoming_maintainer",
            "supabase_token": make_supabase_token(uid_known, email_known),
        },
    )
    assert reg.status_code == 200

    # User returns and syncs session
    sync_existing = client.post(
        "/auth/session",
        json={
            "user_id": uid_known,
            "email": email_known,
            "supabase_token": make_supabase_token(uid_known, email_known),
        },
    )
    assert sync_existing.status_code == 200
    sync_data = sync_existing.json()
    assert sync_data["registered"] is True
    assert sync_data["user"]["role"] == "incoming_maintainer"
    assert "token" in sync_data


def test_registered_account_cannot_switch_role(client):
    uid = "fixed-contributor"
    email = "fixed@baton.test"
    sb_token = make_supabase_token(uid, email)
    # Register as incoming_contributor
    reg = client.post(
        "/auth/register",
        json={
            "user_id": uid,
            "email": email,
            "name": "Fixed Contrib",
            "role": "incoming_contributor",
            "supabase_token": sb_token,
        },
    )
    assert reg.status_code == 200

    # Attempting to re-register with different role fails
    switch_attempt = client.post(
        "/auth/register",
        json={
            "user_id": uid,
            "email": email,
            "name": "Fixed Contrib",
            "role": "approver",
            "supabase_token": sb_token,
        },
    )
    assert switch_attempt.status_code == 400
    assert "role switching is disabled" in switch_attempt.json()["detail"].lower()


def test_backend_role_authorization(client):
    # 1. /reconstruct requires approver
    uid_contrib = "uid-c-auth"
    email_contrib = "c-auth@baton.test"
    contrib_res = client.post(
        "/auth/register",
        json={
            "user_id": uid_contrib,
            "email": email_contrib,
            "name": "Contrib",
            "role": "incoming_contributor",
            "supabase_token": make_supabase_token(uid_contrib, email_contrib),
        },
    )
    contrib_headers = {"Authorization": f"Bearer {contrib_res.json()['token']}"}
    reconstruct_forbidden = client.post("/reconstruct", headers=contrib_headers)
    assert reconstruct_forbidden.status_code == 403

    # Approver can trigger reconstruct
    approver_headers = login(client, "approver")
    reconstruct_allowed = client.post("/reconstruct", headers=approver_headers)
    assert reconstruct_allowed.status_code == 200

    # 2. /sources upload requires approver
    sources_forbidden = client.post(
        "/sources",
        headers=contrib_headers,
        data={"consent": True, "acl_label": "L1"},
        files={"file": ("test.md", b"# Test", "text/markdown")},
    )
    assert sources_forbidden.status_code == 403

    # 3. /review/approve requires approver
    approve_forbidden = client.post(
        "/review/approve",
        headers=contrib_headers,
        json={"shared_to_roles": ["incoming_maintainer"]},
    )
    assert approve_forbidden.status_code == 403


def test_backend_role_isolation_on_claims_and_gaps(client):
    uid_isol = "uid-isol"
    email_isol = "isol@baton.test"
    contrib_res = client.post(
        "/auth/register",
        json={
            "user_id": uid_isol,
            "email": email_isol,
            "name": "Isol User",
            "role": "incoming_contributor",
            "supabase_token": make_supabase_token(uid_isol, email_isol),
        },
    )
    contrib_headers = {"Authorization": f"Bearer {contrib_res.json()['token']}"}
    approver_headers = login(client, "approver")

    # Contributor sees claims with L1 only and higher tier claims as hidden_count
    c_claims = client.get("/claims", headers=contrib_headers).json()
    a_claims = client.get("/claims", headers=approver_headers).json()

    assert "claims" in c_claims
    assert "hidden_count" in c_claims
    assert len(a_claims["claims"]) >= len(c_claims["claims"])
    for claim in c_claims["claims"]:
        assert claim["acl_label"] == "L1"

    # Gaps are also role-filtered
    c_gaps = client.get("/gaps", headers=contrib_headers).json()
    for gap in c_gaps:
        assert gap.get("acl_label", "L1") == "L1"


# =============================================================================
# REGRESSION TEST SUITE FOR REQUIREMENT 7
# =============================================================================


def test_regression_invitation_abuse(client):
    approver_headers = login(client, "approver")

    # 1. Unauthenticated request to create invitation fails with 401
    unauth_create = client.post("/auth/invitations", json={"role": "approver"})
    assert unauth_create.status_code == 401

    # 2. Non-approver cannot create invitation
    uid_m = "uid-maintainer-abuse"
    email_m = "m-abuse@baton.test"
    m_token = client.post(
        "/auth/register",
        json={
            "user_id": uid_m,
            "email": email_m,
            "name": "Maintainer",
            "role": "incoming_maintainer",
            "supabase_token": make_supabase_token(uid_m, email_m),
        },
    ).json()["token"]
    forbidden_inv = client.post(
        "/auth/invitations",
        headers={"Authorization": f"Bearer {m_token}"},
        json={"role": "approver"},
    )
    assert forbidden_inv.status_code == 403

    # 3. Create invitation specifically targeted to a designated email
    designated_email = "target-lead@baton.test"
    create_res = client.post(
        "/auth/invitations",
        headers=approver_headers,
        json={"role": "approver", "email": designated_email},
    )
    assert create_res.status_code == 200
    inv_code = create_res.json()["code"]

    # 4. Attacker with different email attempts to use targeted invitation code -> 403
    attacker_uid = "uid-attacker"
    attacker_email = "attacker@baton.test"
    hijack_res = client.post(
        "/auth/register",
        json={
            "user_id": attacker_uid,
            "email": attacker_email,
            "name": "Attacker",
            "role": "approver",
            "invitation_code": inv_code,
            "supabase_token": make_supabase_token(attacker_uid, attacker_email),
        },
    )
    assert hijack_res.status_code == 403
    assert "different email" in hijack_res.json()["detail"].lower()

    # 5. Create invitation for role 'incoming_contributor' and try using it for 'approver'
    c_inv_res = client.post(
        "/auth/invitations",
        headers=approver_headers,
        json={"role": "incoming_contributor"},
    )
    c_code = c_inv_res.json()["code"]
    wrong_role_res = client.post(
        "/auth/register",
        json={
            "user_id": "uid-wrong-role",
            "email": "wrongrole@baton.test",
            "name": "Wrong Role",
            "role": "approver",
            "invitation_code": c_code,
            "supabase_token": make_supabase_token("uid-wrong-role", "wrongrole@baton.test"),
        },
    )
    assert wrong_role_res.status_code == 403
    assert "not valid for approver" in wrong_role_res.json()["detail"].lower()

    # 6. Target approver uses the code legitimately -> 200
    target_uid = "uid-target-approver"
    legit_res = client.post(
        "/auth/register",
        json={
            "user_id": target_uid,
            "email": designated_email,
            "name": "Target Lead",
            "role": "approver",
            "invitation_code": inv_code,
            "supabase_token": make_supabase_token(target_uid, designated_email),
        },
    )
    assert legit_res.status_code == 200
    assert legit_res.json()["user"]["role"] == "approver"

    # 7. Code reuse attempt immediately rejected -> 403
    another_email = "another-lead@baton.test"
    reuse_res = client.post(
        "/auth/register",
        json={
            "user_id": "uid-another-approver",
            "email": another_email,
            "name": "Another Lead",
            "role": "approver",
            "invitation_code": inv_code,
            "supabase_token": make_supabase_token("uid-another-approver", another_email),
        },
    )
    assert reuse_res.status_code == 403
    assert "invalid or expired" in reuse_res.json()["detail"].lower()


def test_regression_unverified_accounts(client):
    uid = "uid-unverified"
    email = "unverified@baton.test"

    # 1. Missing Supabase token entirely -> 401
    no_token_res = client.post(
        "/auth/register",
        json={
            "user_id": uid,
            "email": email,
            "name": "No Token User",
            "role": "incoming_contributor",
        },
    )
    assert no_token_res.status_code == 401
    assert "token required" in no_token_res.json()["detail"].lower()

    # 2. Rogue signed token with untrusted secret -> 401
    rogue_token = make_supabase_token(uid, email, secret="completely-untrusted-secret-key")
    rogue_res = client.post(
        "/auth/register",
        json={
            "user_id": uid,
            "email": email,
            "name": "Rogue User",
            "role": "incoming_contributor",
            "supabase_token": rogue_token,
        },
    )
    assert rogue_res.status_code == 401
    assert "invalid" in rogue_res.json()["detail"].lower()

    # 3. Expired token -> 401
    expired_token = make_supabase_token(uid, email, exp_delta=-60)
    expired_res = client.post(
        "/auth/register",
        json={
            "user_id": uid,
            "email": email,
            "name": "Expired User",
            "role": "incoming_contributor",
            "supabase_token": expired_token,
        },
    )
    assert expired_res.status_code == 401
    assert "expired" in expired_res.json()["detail"].lower()

    # 4. Token subject mismatch (sub != user_id) -> 403
    mismatched_sub_token = make_supabase_token("real-sub-from-token", email)
    spoofed_id_res = client.post(
        "/auth/register",
        json={
            "user_id": "different-user-id",
            "email": email,
            "name": "Spoofed ID User",
            "role": "incoming_contributor",
            "supabase_token": mismatched_sub_token,
        },
    )
    assert spoofed_id_res.status_code == 403
    assert "does not match requested user_id" in spoofed_id_res.json()["detail"].lower()

    # 5. Token email mismatch -> 403
    mismatched_email_token = make_supabase_token(uid, "token-email@baton.test")
    spoofed_email_res = client.post(
        "/auth/register",
        json={
            "user_id": uid,
            "email": "different-email@baton.test",
            "name": "Spoofed Email User",
            "role": "incoming_contributor",
            "supabase_token": mismatched_email_token,
        },
    )
    assert spoofed_email_res.status_code == 403
    assert "does not match requested email" in spoofed_email_res.json()["detail"].lower()

    # 6. Session sync without token -> 401
    sync_no_token = client.post("/auth/session", json={"user_id": uid, "email": email})
    assert sync_no_token.status_code == 401

    # 7. Session sync with mismatched token sub -> 403
    sync_bad_sub = client.post(
        "/auth/session",
        json={
            "user_id": "claimed-id",
            "email": email,
            "supabase_token": make_supabase_token("actual-token-id", email),
        },
    )
    assert sync_bad_sub.status_code == 403


def test_regression_duplicate_emails(client):
    uid_a = "uid-account-a"
    email = "shared-duplicate@baton.test"
    token_a = make_supabase_token(uid_a, email)

    # 1. User A registers with email
    res_a = client.post(
        "/auth/register",
        json={
            "user_id": uid_a,
            "email": email,
            "name": "Account A",
            "role": "incoming_maintainer",
            "supabase_token": token_a,
        },
    )
    assert res_a.status_code == 200

    # 2. User B tries to register with the same email under a different user_id -> 400
    uid_b = "uid-account-b"
    token_b = make_supabase_token(uid_b, email)
    res_b = client.post(
        "/auth/register",
        json={
            "user_id": uid_b,
            "email": email,
            "name": "Account B",
            "role": "incoming_contributor",
            "supabase_token": token_b,
        },
    )
    assert res_b.status_code == 400
    assert "already registered" in res_b.json()["detail"].lower()


def test_regression_role_escalation(client):
    uid = "uid-escalator"
    email = "escalator@baton.test"
    sb_token = make_supabase_token(uid, email)

    # 1. Register as incoming_contributor
    reg = client.post(
        "/auth/register",
        json={
            "user_id": uid,
            "email": email,
            "name": "Escalation Tester",
            "role": "incoming_contributor",
            "supabase_token": sb_token,
        },
    )
    assert reg.status_code == 200
    baton_token = reg.json()["token"]
    user_headers = {"Authorization": f"Bearer {baton_token}"}

    # 2. Attempt role change to approver via re-registration -> 400
    re_reg_approver = client.post(
        "/auth/register",
        json={
            "user_id": uid,
            "email": email,
            "name": "Escalation Tester",
            "role": "approver",
            "supabase_token": sb_token,
        },
    )
    assert re_reg_approver.status_code == 400
    assert "role switching is disabled" in re_reg_approver.json()["detail"].lower()

    # 3. Attempt role change to incoming_maintainer via re-registration -> 400
    re_reg_maint = client.post(
        "/auth/register",
        json={
            "user_id": uid,
            "email": email,
            "name": "Escalation Tester",
            "role": "incoming_maintainer",
            "supabase_token": sb_token,
        },
    )
    assert re_reg_maint.status_code == 400
    assert "role switching is disabled" in re_reg_maint.json()["detail"].lower()

    # 4. Privileged endpoint protection: Contributor cannot invoke approver APIs
    assert client.post("/reconstruct", headers=user_headers).status_code == 403
    assert client.post("/auth/invitations", headers=user_headers, json={"role": "approver"}).status_code == 403
    assert client.post("/review/approve", headers=user_headers, json={"shared_to_roles": ["incoming_maintainer"]}).status_code == 403
    assert client.post("/drift/scan", headers=user_headers).status_code == 403
    assert client.post(
        "/sources",
        headers=user_headers,
        data={"consent": True, "acl_label": "L1"},
        files={"file": ("test.md", b"# Test", "text/markdown")},
    ).status_code == 403


def test_regression_oauth_registration_flow(client):
    oauth_uid = "oauth-provider-user-456"
    oauth_email = "oauth.engineer@company.test"
    oauth_token = make_supabase_token(oauth_uid, oauth_email)

    # 1. First-time OAuth login session check: user is not yet registered
    session_check_1 = client.post(
        "/auth/session",
        json={
            "user_id": oauth_uid,
            "email": oauth_email,
            "supabase_token": oauth_token,
        },
    )
    assert session_check_1.status_code == 200
    s_data = session_check_1.json()
    assert s_data["registered"] is False
    assert s_data["requires_role"] is True
    assert s_data["user_id"] == oauth_uid
    assert s_data["email"] == oauth_email

    # 2. User completes registration after choosing role (e.g. incoming_maintainer)
    reg_res = client.post(
        "/auth/register",
        json={
            "user_id": oauth_uid,
            "email": oauth_email,
            "name": "OAuth Engineer",
            "role": "incoming_maintainer",
            "supabase_token": oauth_token,
        },
    )
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert "token" in reg_data
    assert reg_data["user"]["role"] == "incoming_maintainer"
    assert reg_data["user"]["is_demo"] is False

    # 3. Subsequent OAuth session sync: user is now recognized and logged in
    session_check_2 = client.post(
        "/auth/session",
        json={
            "user_id": oauth_uid,
            "email": oauth_email,
            "supabase_token": oauth_token,
        },
    )
    assert session_check_2.status_code == 200
    s2_data = session_check_2.json()
    assert s2_data["registered"] is True
    assert s2_data["user"]["id"] == oauth_uid
    assert s2_data["user"]["role"] == "incoming_maintainer"
    assert "token" in s2_data

    # 4. Token from session sync is valid on authenticated endpoints
    me_res = client.get("/me", headers={"Authorization": f"Bearer {s2_data['token']}"})
    assert me_res.status_code == 200
    assert me_res.json()["role"] == "incoming_maintainer"


def test_regression_session_sync_es256_and_error_handling(client, monkeypatch):
    """Verify that ES256 asymmetric Supabase JWTs, invalid signatures, and malformed tokens
    are cleanly handled without raising 500 Internal Server Error."""
    import json
    import time

    import jwt
    from cryptography.hazmat.primitives.asymmetric import ec
    from jwt.algorithms import ECAlgorithm

    # 1. Setup mock ES256 keypair and configure SUPABASE_JWKS
    priv_key = ec.generate_private_key(ec.SECP256R1())
    pub_key = priv_key.public_key()
    jwk_dict = ECAlgorithm.to_jwk(pub_key, as_dict=True)
    jwk_dict["kid"] = "test-es256-kid"
    monkeypatch.setenv("SUPABASE_JWKS", json.dumps({"keys": [jwk_dict]}))

    uid = "uid-supabase-es256-user"
    email = "es256.user@company.test"
    valid_es256_token = jwt.encode(
        {
            "sub": uid,
            "email": email,
            "exp": int(time.time()) + 3600,
            "aud": "authenticated",
            "role": "authenticated",
        },
        priv_key,
        algorithm="ES256",
        headers={"kid": "test-es256-kid"},
    )

    # 2. Unregistered user session sync with ES256 token returns 200 (requires_role)
    resp_unreg = client.post(
        "/auth/session",
        json={"user_id": uid, "email": email, "supabase_token": valid_es256_token},
    )
    assert resp_unreg.status_code == 200, resp_unreg.text
    unreg_data = resp_unreg.json()
    assert unreg_data["registered"] is False
    assert unreg_data["requires_role"] is True

    # 3. Register user with this ES256 token
    reg_resp = client.post(
        "/auth/register",
        json={
            "user_id": uid,
            "email": email,
            "name": "ES256 User",
            "role": "leaver",
            "supabase_token": valid_es256_token,
        },
    )
    assert reg_resp.status_code == 200, reg_resp.text

    # 4. Registered user session sync with ES256 token returns 200 with registered=True
    resp_reg = client.post(
        "/auth/session",
        json={"user_id": uid, "email": email, "supabase_token": valid_es256_token},
    )
    assert resp_reg.status_code == 200, resp_reg.text
    reg_data = resp_reg.json()
    assert reg_data["registered"] is True
    assert reg_data["user"]["id"] == uid
    assert reg_data["user"]["role"] == "leaver"
    assert "token" in reg_data

    # 5. ES256 token signed by an untrusted key returns 401 (NOT 500!)
    other_priv_key = ec.generate_private_key(ec.SECP256R1())
    untrusted_token = jwt.encode(
        {"sub": uid, "email": email, "exp": int(time.time()) + 3600},
        other_priv_key,
        algorithm="ES256",
        headers={"kid": "unknown-kid"},
    )
    resp_untrusted = client.post(
        "/auth/session",
        json={"user_id": uid, "email": email, "supabase_token": untrusted_token},
    )
    assert resp_untrusted.status_code == 401
    assert "signature" in resp_untrusted.json()["detail"].lower() or "verification" in resp_untrusted.json()["detail"].lower()

    # 6. Malformed token string returns 401 (NOT 500!)
    resp_malformed = client.post(
        "/auth/session",
        json={"user_id": uid, "email": email, "supabase_token": "not.a.valid.jwt"},
    )
    assert resp_malformed.status_code == 401
    assert "jwt" in resp_malformed.json()["detail"].lower() or "token" in resp_malformed.json()["detail"].lower()

    # 7. Expired token returns 401 (NOT 500!)
    expired_token = jwt.encode(
        {"sub": uid, "email": email, "exp": int(time.time()) - 3600},
        priv_key,
        algorithm="ES256",
        headers={"kid": "test-es256-kid"},
    )
    resp_expired = client.post(
        "/auth/session",
        json={"user_id": uid, "email": email, "supabase_token": expired_token},
    )
    assert resp_expired.status_code == 401
    assert "expired" in resp_expired.json()["detail"].lower()


def test_provision_workspace_cannot_grant_approver_or_bypass_invitations(client):
    """Verify _provision_workspace() cannot grant Approver access or bypass invitation controls."""
    import pytest
    from fastapi import HTTPException
    from sqlalchemy.orm import Session

    from app.core.auth import _provision_workspace
    from app.core.db import get_engine

    # 1. Attempting to provision a workspace with role="approver" must be rejected with 403
    with Session(get_engine()) as session:
        with pytest.raises(HTTPException) as exc_info:
            _provision_workspace("user-uuid-1", {"email": "lead@test.com"}, session, role="approver")
        assert exc_info.value.status_code == 403
        assert "invitation" in exc_info.value.detail.lower()

    # 2. Default provisioning defaults to non-approver (incoming_contributor)
    with Session(get_engine()) as session:
        user = _provision_workspace("user-uuid-2", {"email": "contrib@test.com"}, session)
        assert user.role == "incoming_contributor"
        assert user.role != "approver"

    # 3. Unregistered user calling protected endpoints with unknown token cannot bypass registration
    unregistered_token = make_supabase_token("unregistered-uuid-3", "unregistered@test.com")
    resp_unreg = client.get("/me", headers={"Authorization": f"Bearer {unregistered_token}"})
    assert resp_unreg.status_code == 401
    assert "no longer has access" in resp_unreg.json()["detail"].lower() or "sign in" in resp_unreg.json()["detail"].lower()


def test_direct_supabase_jwt_auth_and_identity_mapping(client):
    """Verify that raw Supabase JWTs are validated server-side and mapped via identity_mappings."""
    uid = "uid-supa-direct-1"
    email = "supa-direct@baton.test"
    sb_token = make_supabase_token(uid, email)

    # 1. Register user
    reg = client.post(
        "/auth/register",
        json={
            "user_id": uid,
            "email": email,
            "name": "Supa Direct User",
            "role": "incoming_maintainer",
            "supabase_token": sb_token,
        },
    )
    assert reg.status_code == 200

    # 2. Directly call /me with raw Supabase Bearer token (NOT Baton HS256 token!)
    me_res = client.get("/me", headers={"Authorization": f"Bearer {sb_token}"})
    assert me_res.status_code == 200
    data = me_res.json()
    assert data["id"] == uid
    assert data["email"] == email
    assert data["role"] == "incoming_maintainer"
    assert data["is_demo"] is False


def test_default_deny_for_unmapped_supabase_token(client):
    """Verify Default Deny: an unmapped Supabase token cannot access protected endpoints."""
    uid = "unmapped-intruder"
    email = "intruder@external.test"
    sb_token = make_supabase_token(uid, email)

    for path in ["/me", "/claims", "/gaps", "/sources", "/handover/v1/view"]:
        res = client.get(path, headers={"Authorization": f"Bearer {sb_token}"})
        assert res.status_code == 401
        detail = res.json()["detail"].lower()
        assert "not mapped" in detail or "no longer has access" in detail or "sign in" in detail


def test_strict_multi_project_workspace_isolation(client):
    """Verify that different users in different projects are strictly isolated across APIs."""
    approver_headers = login(client, "approver")

    # Create invitations for two approvers in different workspaces
    inv_a = client.post("/auth/invitations", headers=approver_headers, json={"role": "approver", "email": "lead-a@test.com"}).json()["code"]
    inv_b = client.post("/auth/invitations", headers=approver_headers, json={"role": "approver", "email": "lead-b@test.com"}).json()["code"]

    uid_a = "uid-project-lead-a"
    email_a = "lead-a@test.com"
    token_a = client.post(
        "/auth/register",
        json={
            "user_id": uid_a,
            "email": email_a,
            "name": "Lead Alpha",
            "role": "approver",
            "invitation_code": inv_a,
            "project_id": "proj-workspace-alpha",
            "supabase_token": make_supabase_token(uid_a, email_a),
        },
    ).json()["token"]

    uid_b = "uid-project-lead-b"
    email_b = "lead-b@test.com"
    token_b = client.post(
        "/auth/register",
        json={
            "user_id": uid_b,
            "email": email_b,
            "name": "Lead Beta",
            "role": "approver",
            "invitation_code": inv_b,
            "project_id": "proj-workspace-beta",
            "supabase_token": make_supabase_token(uid_b, email_b),
        },
    ).json()["token"]

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Upload source in Project Alpha
    upload_res = client.post(
        "/sources",
        headers=headers_a,
        data={"consent": True, "acl_label": "L1"},
        files={"file": ("alpha_readme.md", b"# Alpha Project Docs", "text/markdown")},
    )
    assert upload_res.status_code == 201

    # Lead Alpha sees the source
    sources_a = client.get("/sources", headers=headers_a).json()
    assert any(s.get("title") == "alpha_readme.md" for s in sources_a)

    # Lead Beta in Project Beta CANNOT see Project Alpha's source
    sources_b = client.get("/sources", headers=headers_b).json()
    assert not any(s.get("title") == "alpha_readme.md" for s in sources_b)


