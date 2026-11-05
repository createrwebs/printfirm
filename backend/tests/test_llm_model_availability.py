"""Managed text model switches must also block legacy environment requests."""

import json
from unittest.mock import AsyncMock

import httpx
import pytest

from app.config import Settings
from app.schemas_routing import DefaultModels, LogicalModel, LogicalModelBinding, SystemModelChannel
from app.services import llm_client
from app.services.model_settings import RoutingSnapshot


def test_common_gateway_errors_are_actionable():
    auth = llm_client._format_upstream_error(401, '{"error":{"message":"Invalid token"}}')
    timeout = llm_client._format_upstream_error(524, '{"error":{"message":"bad response status code 524"}}')

    assert "API Key" in auth and "重新保存" in auth
    assert "切换到 Kimi K2.6" in timeout and "524" in timeout


@pytest.fixture
def text_client(monkeypatch):
    settings = Settings(_env_file=None, debug=False, openai_api_key="environment-key",
                        openai_base_url="https://environment.test/v1", model_llm="kimi-k2.6")
    monkeypatch.setattr("app.config.get_settings", lambda: settings)
    monkeypatch.setattr(llm_client, "get_settings", lambda: settings)
    requests = []

    def respond(request):
        requests.append(request)
        return httpx.Response(200, json={"choices": [{"message": {"content": "model response"}}]})

    client_type = httpx.AsyncClient
    monkeypatch.setattr(llm_client.httpx, "AsyncClient", lambda **kwargs: client_type(
        transport=httpx.MockTransport(respond), **kwargs))

    def configure(*, managed=True, enabled=True, binding_enabled=True, default=True):
        channel = SystemModelChannel(id="alpha", name="Alpha", base_url="https://channel.test/v1",
            api_key="channel-key", has_api_key=True, models=["kimi-k2.6"])
        model = LogicalModel(id="kimi-k2.6", capability="text", enabled=enabled, bindings=[
            LogicalModelBinding(channel_id=channel.id, upstream_model="kimi-k2.6", enabled=binding_enabled),
        ])
        snapshot = RoutingSnapshot(channels=[channel] if managed else [],
            logical_models=[model] if managed else [],
            default_models=DefaultModels(text_model=model.id if managed and default else ""))
        monkeypatch.setattr("app.services.model_settings._routing_snapshot", snapshot)

    return configure, requests


@pytest.mark.parametrize("options", [
    {"enabled": False},
    {"default": False},
    {"binding_enabled": False},
], ids=["disabled-model", "empty-managed-default", "disabled-bindings"])
async def test_managed_text_unavailable_never_uses_environment_credentials(text_client, options):
    configure, requests = text_client
    configure(**options)

    with pytest.raises(llm_client.LlmUnavailableError):
        await llm_client.chat_completions("system", "user")

    assert requests == []


async def test_unmanaged_text_keeps_environment_compatibility(text_client):
    configure, requests = text_client
    configure(managed=False)

    assert await llm_client.chat_completions("system", "user") == "model response"

    assert len(requests) == 1
    assert str(requests[0].url) == "https://environment.test/v1/chat/completions"
    assert requests[0].headers["Authorization"] == "Bearer environment-key"
    assert json.loads(requests[0].content)["model"] == "kimi-k2.6"


async def test_enabled_managed_text_uses_channel_credentials(text_client):
    configure, requests = text_client
    configure()

    assert await llm_client.chat_completions("system", "user") == "model response"

    assert len(requests) == 1
    assert str(requests[0].url) == "https://channel.test/v1/chat/completions"
    assert requests[0].headers["Authorization"] == "Bearer channel-key"


async def test_transient_claude_failure_can_fall_back_without_name_error(text_client, monkeypatch):
    """暂时不可用时的 fallback 不能因缺少 asyncio import 而变成 NameError。"""
    configure, _ = text_client
    configure(managed=False)
    llm_client.get_settings().model_llm = "claude-sonnet-5-5"
    responses = [
        httpx.Response(403, json={"error": {"type": "model_temporarily_unavailable", "message": "retry later"}}),
        httpx.Response(200, json={"choices": [{"message": {"content": "fallback response"}}]}),
    ]

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, *_args, **_kwargs):
            return responses.pop(0)

    monkeypatch.setattr(
        llm_client.httpx,
        "AsyncClient",
        lambda **_kwargs: FakeClient(),
    )
    sleep = AsyncMock()
    monkeypatch.setattr(llm_client.asyncio, "sleep", sleep)

    assert await llm_client.chat_completions("system", "user") == "fallback response"
    sleep.assert_awaited_once()
