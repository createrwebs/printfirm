import pytest
from fastapi import HTTPException
from app.models import User
from app.models_drama import DramaProject, DramaEpisode, DramaAsset
from app.services.drama.access import get_owned_drama_project, get_owned_episode, get_owned_asset
from app.services.billing.http import http_exception_for_value_error
from app.services.tokenfree_gateway import current_user_toraapi_token
from app.services.llm_client import resolve_llm_api_key
from app.services.ark import ArkGateway
from app.services.media_models.runtime import restore_route

def test_http_exception_for_value_error_402():
    err1 = ValueError("เครดิตไม่เพียงพอ: ต้องการขั้นต่ำ ¥1.00 กรุณาเติมเครดิตที่ https://www.toraapi.com")
    http_exc1 = http_exception_for_value_error(err1)
    assert http_exc1.status_code == 402
    assert "https://www.toraapi.com" in http_exc1.detail

    err2 = ValueError("余额不足：需要 ¥2.00，请先充值")
    http_exc2 = http_exception_for_value_error(err2)
    assert http_exc2.status_code == 402

    err3 = ValueError("创意文案至少 20 字")
    http_exc3 = http_exception_for_value_error(err3)
    assert http_exc3.status_code == 400


def test_user_toraapi_key_prioritized():
    # User token takes precedence over env or channel keys
    current_user_toraapi_token.set("sk-tora-user-custom-key-12345")
    assert resolve_llm_api_key() == "sk-tora-user-custom-key-12345"

    ark = ArkGateway()
    assert ark._ark_api_key() == "sk-tora-user-custom-key-12345"

    route = restore_route({
        "capability": "image",
        "logical_model_id": "seedance-image",
        "upstream_model": "doubao-seedance",
        "channel_id": "tokenfree",
        "channel_name": "ToraAPI",
        "base_url": "https://www.toraapi.com/v1",
        "protocol": "openai",
        "api_format": "openai",
    })
    assert route.api_key == "sk-tora-user-custom-key-12345"

    # Reset token
    current_user_toraapi_token.set("")


@pytest.mark.asyncio
async def test_tenant_isolation_cross_user_access_blocked():
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        user_a = User(email="user_a@test.com", nickname="User A", hashed_password="x")
        user_b = User(email="user_b@test.com", nickname="User B", hashed_password="x")
        db.add(user_a)
        db.add(user_b)
        await db.flush()
        
        project = DramaProject(user_id=user_a.id, title="User A Secret Project")
        db.add(project)
        await db.flush()

        episode = DramaEpisode(project_id=project.id, name="Episode 1")
        asset = DramaAsset(project_id=project.id, name="Secret Character", type="character")
        db.add(episode)
        db.add(asset)
        await db.flush()

        # User B should NOT be able to access User A's project
        with pytest.raises(HTTPException) as exc_info:
            await get_owned_drama_project(db, project.id, user_b)
        assert exc_info.value.status_code == 404

        # User B should NOT be able to access User A's episode
        with pytest.raises(HTTPException) as exc_info:
            await get_owned_episode(db, episode.id, user_b)
        assert exc_info.value.status_code == 404

        # User B should NOT be able to access User A's asset
        with pytest.raises(HTTPException) as exc_info:
            await get_owned_asset(db, asset.id, user_b)
        assert exc_info.value.status_code == 404

        # Clean up
        await db.rollback()


def test_parse_toraapi_input_and_jwt_sub():
    import json
    from app.services.tokenfree_usage import _jwt_sub_user_id, _parse_toraapi_input

    jwt_tok = (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJzdWIiOiIxIiwiZXhwIjoxNzk0MDUyMDk4fQ."
        "sig"
    )
    assert _jwt_sub_user_id(jwt_tok) == "1"

    login_payload = json.dumps({
        "data": {
            "access_token": jwt_tok,
            "user": {"id": 1, "username": "softcreate", "quota": 15797379, "used_quota": 93735349},
        },
        "success": True,
    })
    parsed_key, udata = _parse_toraapi_input(login_payload)
    assert parsed_key == jwt_tok
    assert udata["username"] == "softcreate"
    assert udata["quota"] == 15797379
