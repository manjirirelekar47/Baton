"""Validation tests for review request schemas (failure cases first)."""
import pytest
from pydantic import ValidationError

from app.modules.review.schemas import ActionRequest, ApproveRequest, GapAnswerRequest


def test_edit_requires_statement():
    with pytest.raises(ValidationError):
        ActionRequest(action="edit")


def test_edit_with_statement_ok():
    assert ActionRequest(action="edit", edited_statement="  Rohan owns payments  ").edited_statement == "Rohan owns payments"


def test_resolve_conflict_requires_chosen_claim():
    with pytest.raises(ValidationError):
        ActionRequest(action="resolve_conflict")


def test_accept_uncertainty_requires_note():
    with pytest.raises(ValidationError):
        ActionRequest(action="accept_uncertainty")


def test_unknown_action_rejected():
    with pytest.raises(ValidationError):
        ActionRequest(action="publish_everything")


def test_extra_fields_rejected():
    with pytest.raises(ValidationError):
        ActionRequest(action="confirm", is_admin=True)


def test_note_too_long_rejected():
    with pytest.raises(ValidationError):
        ActionRequest(action="confirm", note="x" * 1001)


def test_approve_defaults_to_both_incoming_roles():
    assert ApproveRequest().shared_to_roles == ["incoming_contributor", "incoming_maintainer"]


def test_approve_empty_roles_rejected():
    with pytest.raises(ValidationError):
        ApproveRequest(shared_to_roles=[])


def test_approve_cannot_share_to_non_incoming_role():
    with pytest.raises(ValidationError):
        ApproveRequest(shared_to_roles=["approver"])


def test_gap_answer_too_short_rejected():
    with pytest.raises(ValidationError):
        GapAnswerRequest(gap_id="g1", answer="  a ")
