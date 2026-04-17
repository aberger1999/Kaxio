import json
import httpx

from server.config import settings


async def get_ollama_response(messages, system_context=""):
    base_url = settings.OLLAMA_BASE_URL
    model = settings.OLLAMA_MODEL
    headers = {}
    if settings.OLLAMA_API_KEY:
        headers[settings.OLLAMA_AUTH_HEADER] = (
            f"{settings.OLLAMA_AUTH_SCHEME} {settings.OLLAMA_API_KEY}".strip()
        )

    ollama_messages = []
    if system_context:
        ollama_messages.append({"role": "system", "content": system_context})

    ollama_messages.extend(messages)

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{base_url}/api/chat",
                headers=headers,
                json={
                    "model": model,
                    "messages": ollama_messages,
                    "stream": False,
                    "options": {"num_predict": settings.CHAT_MAX_OUTPUT_TOKENS},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "No response from AI.")
    except httpx.ConnectError:
        return (
            "Could not connect to Ollama. "
            "Make sure Ollama is running (ollama serve) "
            f"and a model is pulled (ollama pull {model})."
        )
    except Exception as e:
        return f"AI error: {str(e)}"


async def stream_ollama_response(messages, system_context=""):
    """Async generator that yields content tokens from Ollama's streaming API."""
    base_url = settings.OLLAMA_BASE_URL
    model = settings.OLLAMA_MODEL
    headers = {}
    if settings.OLLAMA_API_KEY:
        headers[settings.OLLAMA_AUTH_HEADER] = (
            f"{settings.OLLAMA_AUTH_SCHEME} {settings.OLLAMA_API_KEY}".strip()
        )

    ollama_messages = []
    if system_context:
        ollama_messages.append({"role": "system", "content": system_context})

    ollama_messages.extend(messages)

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{base_url}/api/chat",
                headers=headers,
                json={
                    "model": model,
                    "messages": ollama_messages,
                    "stream": True,
                    "options": {"num_predict": settings.CHAT_MAX_OUTPUT_TOKENS},
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                        content = chunk.get("message", {}).get("content", "")
                        if content:
                            yield content
                        if chunk.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue
    except httpx.ConnectError:
        yield (
            "Could not connect to Ollama. "
            "Make sure Ollama is running (ollama serve) "
            f"and a model is pulled (ollama pull {model})."
        )
    except Exception as e:
        yield f"AI error: {str(e)}"
