from __future__ import annotations

import json
import mimetypes
import os
import urllib.error
import urllib.request
from typing import Any

from geyma.ai.keystore import KeyStoreError, get_api_key
from geyma.ai.provider_base import AIProvider, ProviderCapabilities
from geyma.utils.config import ConfigStore


class OpenAIProvider(AIProvider):
    def __init__(self) -> None:
        self._config = ConfigStore()
        self._key_error = ""
        self._key = None
        self._reload_key()
        self._model = self._config.get_str("ai_openai_model", "gpt-4o-mini")
        self._image_model = self._config.get_str("ai_openai_image_model", "gpt-image-1")
        self._endpoint = self._config.get_str(
            "ai_openai_endpoint",
            "https://api.openai.com/v1/chat/completions",
        )
        self._image_endpoint = self._config.get_str(
            "ai_openai_image_endpoint",
            "https://api.openai.com/v1/images",
        )
        self._timeout = int(self._config.get("ai_openai_timeout", 30))

    def _reload_key(self) -> None:
        self._key_error = ""
        try:
            self._key = get_api_key("openai")
        except KeyStoreError as exc:
            self._key = None
            self._key_error = str(exc)

    def is_configured(self) -> bool:
        self._reload_key()
        return bool(self._key)

    def validate_key(self) -> tuple[bool, str]:
        self._reload_key()
        if self._key_error:
            return False, self._key_error
        if not self._key:
            return False, "Missing API key"
        return True, "API key set"

    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(text=True, images=True)

    def supports(self, feature: str) -> bool:
        return feature in {
            "text_to_filters",
            "folder_summary",
            "rename_suggestions",
            "image_generation",
            "image_variation",
            "image_edit",
        }

    def estimate_cost(self, feature: str, payload: dict[str, Any]) -> str:
        return "n/a"

    def run(self, feature: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.supports(feature):
            raise RuntimeError(f"OpenAI does not support feature: {feature}")
        if not self._key:
            raise RuntimeError("Missing API key")

        if feature in {"image_generation", "image_variation", "image_edit"}:
            return self._run_image(feature, payload)

        if feature == "rename_suggestions" and payload.get("files"):
            return self._run_rename_with_context(payload)

        prompt = self._build_prompt(feature, payload)
        request_data = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": "You are a precise assistant."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
        }
        expect_json = feature in {"text_to_filters", "rename_suggestions"}
        if expect_json:
            request_data["response_format"] = {"type": "json_object"}

        data = self._post_json(request_data)
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        result: dict[str, Any] = {"text": content}
        if expect_json:
            try:
                result["data"] = json.loads(content)
            except json.JSONDecodeError:
                result["data"] = None
        return result

    def _run_rename_with_context(self, payload: dict[str, Any]) -> dict[str, Any]:
        messages, model = self._build_rename_messages(payload)
        request_data = {
            "model": model,
            "messages": messages,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }
        data = self._post_json(request_data)
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        result: dict[str, Any] = {"text": content}
        try:
            result["data"] = json.loads(content)
        except json.JSONDecodeError:
            result["data"] = None
        return result

    def _run_image(self, feature: str, payload: dict[str, Any]) -> dict[str, Any]:
        prompt = str(payload.get("prompt", "")).strip()
        size = str(payload.get("size", "1024x1024"))
        quality = str(payload.get("quality", "medium")).strip()
        if feature == "image_generation":
            data = {
                "model": self._image_model,
                "prompt": prompt,
                "size": size,
                "quality": quality,
                "n": 1,
            }
            response = self._post_json(data, endpoint=f"{self._image_endpoint}/generations")
        else:
            image_path = payload.get("reference")
            if not image_path:
                raise RuntimeError("Reference image is required.")
            form = {
                "model": self._image_model,
                "prompt": prompt,
                "size": size,
                "quality": quality,
                "n": 1,
            }
            files = {"image": image_path}
            endpoint = f"{self._image_endpoint}/variations"
            if feature == "image_edit":
                endpoint = f"{self._image_endpoint}/edits"
            response = self._post_multipart(form, files, endpoint=endpoint)

        data_list = response.get("data", [])
        if isinstance(data_list, list) and data_list:
            entry = data_list[0]
            if isinstance(entry, dict):
                image_b64 = entry.get("b64_json", "")
                if image_b64:
                    return {"image_base64": image_b64}
                image_url = entry.get("url", "")
                if image_url:
                    return {"image_bytes": self._fetch_image_url(image_url)}
        return {"image_base64": ""}

    def _build_prompt(self, feature: str, payload: dict[str, Any]) -> str:
        if "prompt" in payload:
            return str(payload["prompt"])
        if feature == "text_to_filters":
            query = payload.get("query", "")
            return (
                "Convert this query into JSON with keys: query, filters, notes.\n"
                "filters is a list of {field, op, value}.\n"
                f"Query: {query}"
            )
        if feature == "folder_summary":
            stats = payload.get("stats", {})
            return (
                "Summarize this folder metadata in 2-4 sentences. "
                "Do not guess file contents.\n"
                f"Stats: {json.dumps(stats, sort_keys=True)}"
            )
        if feature == "rename_suggestions":
            items = payload.get("items", [])
            return (
                "Suggest new filenames as JSON with key: suggestions.\n"
                "suggestions is a list of {original, proposed}.\n"
                f"Items: {json.dumps(items)}"
            )
        return str(payload)

    def _build_rename_messages(self, payload: dict[str, Any]) -> tuple[list[dict[str, Any]], str]:
        items = payload.get("items", [])
        files = payload.get("files", [])
        text_parts = [
            "Suggest new filenames as JSON with key: suggestions.",
            "suggestions is a list of {original, proposed}.",
            f"Items: {json.dumps(items)}",
        ]
        content: list[dict[str, Any]] = [{"type": "text", "text": "\n".join(text_parts)}]
        has_images = False
        for entry in files:
            name = entry.get("name", "")
            mime = entry.get("mime", "")
            if entry.get("content_text"):
                content.append(
                    {
                        "type": "text",
                        "text": f"File content ({name}):\n{entry.get('content_text')}",
                    }
                )
            if entry.get("image_base64") and mime:
                has_images = True
                data_uri = f"data:{mime};base64,{entry.get('image_base64')}"
                content.append({"type": "text", "text": f"Image file: {name}"})
                content.append({"type": "image_url", "image_url": {"url": data_uri}})
        model = self._config.get_str("ai_openai_vision_model", self._model)
        if not has_images:
            model = self._model
        return [
            {"role": "system", "content": "You are a precise assistant."},
            {"role": "user", "content": content},
        ], model

    def _post_json(self, data: dict[str, Any], endpoint: str | None = None) -> dict[str, Any]:
        body = json.dumps(data).encode("utf-8")
        request = urllib.request.Request(
            endpoint or self._endpoint,
            data=body,
            headers={
                "Authorization": f"Bearer {self._key}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                payload = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            message = exc.read().decode("utf-8") if exc.fp else str(exc)
            raise RuntimeError(f"OpenAI request failed: {message}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"OpenAI request failed: {exc}") from exc
        try:
            return json.loads(payload)
        except json.JSONDecodeError as exc:
            raise RuntimeError("Invalid response from OpenAI") from exc

    def _post_multipart(self, fields: dict[str, Any], files: dict[str, str], endpoint: str) -> dict[str, Any]:
        boundary = "----geymaboundary"
        body = bytearray()
        for key, value in fields.items():
            body.extend(f"--{boundary}\r\n".encode("utf-8"))
            body.extend(f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode("utf-8"))
            body.extend(str(value).encode("utf-8"))
            body.extend(b"\r\n")
        for key, path in files.items():
            path_str = str(path)
            filename = os.path.basename(path_str)
            mime_type, _ = mimetypes.guess_type(path_str)
            content_type = mime_type or "application/octet-stream"
            with open(path_str, "rb") as handle:
                file_data = handle.read()
            body.extend(f"--{boundary}\r\n".encode("utf-8"))
            body.extend(
                f'Content-Disposition: form-data; name="{key}"; filename="{filename}"\r\n'.encode("utf-8")
            )
            body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
            body.extend(file_data)
            body.extend(b"\r\n")
        body.extend(f"--{boundary}--\r\n".encode("utf-8"))

        request = urllib.request.Request(
            endpoint,
            data=bytes(body),
            headers={
                "Authorization": f"Bearer {self._key}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                payload = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            message = exc.read().decode("utf-8") if exc.fp else str(exc)
            raise RuntimeError(f"OpenAI request failed: {message}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"OpenAI request failed: {exc}") from exc
        try:
            return json.loads(payload)
        except json.JSONDecodeError as exc:
            raise RuntimeError("Invalid response from OpenAI") from exc

    def _fetch_image_url(self, url: str) -> bytes:
        request = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            message = exc.read().decode("utf-8") if exc.fp else str(exc)
            raise RuntimeError(f"OpenAI image download failed: {message}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"OpenAI image download failed: {exc}") from exc
