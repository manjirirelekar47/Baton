"""Role-matrix leakage test: every role against every label (Master Guide section 14)."""
from app.core import acl

EXPECTED_READ = {
    "approver": {"L1", "L2", "L3"},
    "leaver": {"L1", "L2"},
    "incoming_maintainer": {"L1", "L2"},
    "incoming_contributor": {"L1"},
}
EXPECTED_COUNT = {
    "approver": set(),
    "leaver": {"L3"},
    "incoming_maintainer": {"L3"},
    "incoming_contributor": {"L2", "L3"},
}


def _claim(cid, label, evidence_labels=()):
    return {"claim_id": cid, "acl_label": label, "evidence": [{"acl_label": x} for x in evidence_labels]}


def test_every_role_against_every_label():
    for role in acl.ROLES:
        for label in acl.LABELS:
            result = acl.filter_for_role(role, [_claim("c", label, [label])])
            if label in EXPECTED_READ[role]:
                assert len(result.visible) == 1 and result.hidden_count == 0, (role, label)
            elif label in EXPECTED_COUNT[role]:
                assert result.visible == [] and result.hidden_count == 1, (role, label)
            else:
                assert result.visible == [] and result.hidden_count == 0, (role, label)


def test_l4_is_never_rendered_and_never_counted():
    for role in acl.ROLES:
        result = acl.filter_for_role(role, [_claim("secret", "L4", ["L4"])])
        assert result.visible == [] and result.hidden_count == 0


def test_claim_inherits_the_strictest_evidence_label():
    claim = _claim("c", "L1", ["L1", "L3"])
    assert acl.effective_label(claim) == "L3"
    assert acl.filter_for_role("incoming_contributor", [claim]).hidden_count == 1
    assert acl.filter_for_role("approver", [claim]).visible[0]["claim_id"] == "c"


def test_fail_closed_on_unknown_role_and_label():
    assert acl.filter_for_role("stranger", [_claim("c", "L1")]).visible == []
    assert acl.filter_for_role("stranger", [_claim("c", "L1")]).hidden_count == 0
    assert acl.effective_label({"claim_id": "c"}) == "L4"
    assert acl.effective_label(_claim("c", "L9")) == "L4"
    assert acl.can_read("approver", None) is False
