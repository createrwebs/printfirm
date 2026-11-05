from types import SimpleNamespace

import pytest


def test_oauth_state_is_provider_bound_and_path_safe():
    from app.services.auth import create_oauth_state, decode_oauth_state

    state = create_oauth_state("google", "/drama/projects/1")
    assert decode_oauth_state(state, "google") == {"next": "/drama/projects/1"}
    assert decode_oauth_state(state, "chatgpt") is None

    unsafe = create_oauth_state("google", "https://evil.example")
    assert decode_oauth_state(unsafe, "google") == {"next": "/"}


@pytest.mark.asyncio
async def test_auth_providers_never_advertises_chatgpt_token_login(monkeypatch):
    from app.api import auth

    monkeypatch.setattr(auth.settings, "google_oauth_client_id", "")
    monkeypatch.setattr(auth.settings, "google_oauth_client_secret", "")
    request = SimpleNamespace(url=SimpleNamespace(hostname="127.0.0.1"))
    result = await auth.auth_providers(request)
    assert result["google"]["enabled"] is False
    assert result["chatgpt"]["enabled"] is False
    assert "token" in result["chatgpt"]["reason"]

    remote = SimpleNamespace(url=SimpleNamespace(hostname="printfilm.com"))
    remote_result = await auth.auth_providers(remote)
    assert remote_result["local_token_debug"] is False
