import pytest
from app.models import User
from app.models_tasks import TaskRun
from app.services.billing.settlement import ensure_balance_for_task
from app.services.tokenfree_usage import (
    fetch_tokenfree_account,
    quota_to_cost_fen,
    sync_user_toraapi_balance,
)


@pytest.mark.asyncio
async def test_fetch_tokenfree_account_parses_subscription_and_token_usage(monkeypatch):
    async def fake_try_get(path: str, *, params=None, api_key=None):
        if path == "/api/usage/token/":
            return {
                "code": True,
                "message": "ok",
                "data": {
                    "object": "token_usage",
                    "name": "tora-main",
                    "total_granted": 5_000_000,
                    "total_used": 1_000_000,
                    "total_available": 4_000_000,
                    "unlimited_quota": False,
                },
            }
        if path == "/v1/dashboard/billing/subscription":
            return {"object": "billing_subscription", "hard_limit_usd": 10.0}
        if path == "/v1/dashboard/billing/usage":
            return {"object": "list", "total_usage": 200.0}  # 2.00 USD in cents
        return None

    monkeypatch.setattr("app.services.tokenfree_usage._try_tokenfree_get", fake_try_get)
    acc = await fetch_tokenfree_account(api_key="sk-test-valid-token")
    assert acc["quota"] == 4_000_000
    assert acc["used_quota"] == 1_000_000
    assert acc["remain_usd"] == 8.0
    assert acc["remain_fen"] == quota_to_cost_fen(4_000_000)
    assert acc["token_name"] == "tora-main"


@pytest.mark.asyncio
async def test_fetch_tokenfree_account_rejects_invalid_token(monkeypatch):
    async def fake_try_get(path: str, *, params=None, api_key=None):
        return None

    monkeypatch.setattr("app.services.tokenfree_usage._try_tokenfree_get", fake_try_get)
    with pytest.raises(RuntimeError, match="ToraAPI Token ไม่ถูกต้อง"):
        await fetch_tokenfree_account(api_key="sk-invalid")


@pytest.mark.asyncio
async def test_sync_user_toraapi_balance_reconciliation():
    class DummySession:
        def __init__(self):
            self.added = []

        def add(self, obj):
            self.added.append(obj)

        async def flush(self):
            pass

    db = DummySession()
    user = User(
        id=99,
        email="tora_test@toraapi.com",
        nickname="ToraUser",
        hashed_password="x",
        balance_fen=0,
        frozen_fen=0,
        toraapi_token="sk-test-token",
        toraapi_quota_baseline_fen=0,
    )

    # 1. Initial sync: 1000 fen from ToraAPI
    await sync_user_toraapi_balance(
        db,
        user,
        api_key="sk-test-token",
        account={"remain_fen": 1000, "quota": 684931},
        force_reset_baseline=True,
    )
    assert user.balance_fen == 1000
    assert user.toraapi_quota_baseline_fen == 1000

    # 2. Local Colab deduction reduces balance_fen to 600 while remote ToraAPI is still 1000
    user.balance_fen = 600
    await sync_user_toraapi_balance(
        db,
        user,
        api_key="sk-test-token",
        account={"remain_fen": 1000, "quota": 684931},
    )
    assert user.balance_fen == 600  # Local Colab deduction is preserved!

    # 3. User tops up +2000 fen on ToraAPI (remote_fen becomes 3000)
    await sync_user_toraapi_balance(
        db,
        user,
        api_key="sk-test-token",
        account={"remain_fen": 3000, "quota": 2054794},
    )
    assert user.balance_fen == 2600
    assert user.toraapi_quota_baseline_fen == 3000


def test_backblaze_b2_oss_enabled_and_local_path_mapping(monkeypatch):
    from app.services import oss as oss_svc
    from app.services import storage as storage_svc

    monkeypatch.setattr(
        "app.services.oss._b2_get_state",
        lambda force_refresh=False: {
            "api_url": "https://api005.backblazeb2.com",
            "auth_token": "tok",
            "download_url": "https://f005.backblazeb2.com",
            "bucket_id": "b1",
            "bucket_name": "toraapi",
            "dl_auth_token": "dl_tok_123",
            "expires_at": 9999999999,
        },
    )
    assert oss_svc.b2_enabled() is True
    assert oss_svc.oss_enabled() is True
    pub = oss_svc.public_url("kepu/generated/p1/shot_10_test.mp4")
    assert pub.startswith("https://f005.backblazeb2.com/file/toraapi/kepu/generated/p1/shot_10_test.mp4")
    assert "Authorization=dl_tok_123" in pub

    local_resolved = storage_svc.local_path_from_url(pub)
    assert local_resolved is not None
    assert local_resolved.name == "shot_10_test.mp4"
    assert local_resolved.parent.name == "p1"
