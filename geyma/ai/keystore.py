from __future__ import annotations

import logging
from typing import Optional, Tuple

from geyma.utils.config import ConfigStore

_logger = logging.getLogger(__name__)


class KeyStoreError(RuntimeError):
    pass


def set_api_key(provider: str, key: str) -> None:
    _logger.debug("Saving API key for provider=%s", provider)
    if _allow_plaintext():
        _logger.debug("Plaintext storage enabled; saving to config.")
        _set_plaintext_key(provider, key)
        return
    try:
        import keyring
    except ImportError as exc:
        if _allow_plaintext():
            _logger.debug("Keyring missing; falling back to plaintext storage.")
            _set_plaintext_key(provider, key)
            return
        raise KeyStoreError("keyring is not installed") from exc

    if not key:
        raise KeyStoreError("API key is empty")
    try:
        keyring.set_password(_service_name(), _account_name(provider), key)
    except keyring.errors.KeyringError as exc:
        if _allow_plaintext():
            _logger.debug("Keyring error; falling back to plaintext storage: %s", exc)
            _set_plaintext_key(provider, key)
            return
        raise KeyStoreError(str(exc)) from exc


def get_api_key(provider: str) -> Optional[str]:
    key, _, error = get_api_key_info(provider)
    if error and key is None:
        raise KeyStoreError(error)
    return key


def clear_api_key(provider: str) -> None:
    _logger.debug("Clearing API key for provider=%s", provider)
    if _allow_plaintext():
        _clear_plaintext_key(provider)
        return
    try:
        import keyring
    except ImportError as exc:
        if _allow_plaintext():
            _clear_plaintext_key(provider)
            return
        raise KeyStoreError("keyring is not installed") from exc

    try:
        keyring.delete_password(_service_name(), _account_name(provider))
    except keyring.errors.PasswordDeleteError:
        return
    except keyring.errors.KeyringError as exc:
        if _allow_plaintext():
            _clear_plaintext_key(provider)
            return
        raise KeyStoreError(str(exc)) from exc


def _service_name() -> str:
    return "geyma.ai"


def _account_name(provider: str) -> str:
    return f"provider:{provider}"


def _legacy_service_name() -> str:
    return "librefiles.ai"


def _get_legacy_keyring_key(provider: str, keyring) -> Optional[str]:
    try:
        return keyring.get_password(_legacy_service_name(), _account_name(provider))
    except keyring.errors.KeyringError:
        return None


def get_api_key_info(provider: str) -> Tuple[Optional[str], str, str]:
    """Return (key, source, error). Source is keyring, config, or none."""
    source = "none"
    error = ""
    if _allow_plaintext():
        key = _get_plaintext_key(provider)
        if key:
            return key, "config", ""
    try:
        import keyring
    except ImportError as exc:
        error = "keyring is not installed"
        if _allow_plaintext():
            key = _get_plaintext_key(provider)
            return key, "config" if key else "none", error
        return None, source, error

    try:
        key = keyring.get_password(_service_name(), _account_name(provider))
        if key:
            return key, "keyring", ""
    except keyring.errors.KeyringError as exc:
        error = str(exc)
        _logger.debug("Keyring error while loading key: %s", exc)

    legacy = _get_legacy_keyring_key(provider, keyring)
    if legacy:
        _logger.debug("Found legacy keyring entry; attempting migration.")
        try:
            keyring.set_password(_service_name(), _account_name(provider), legacy)
            return legacy, "keyring", ""
        except keyring.errors.KeyringError as exc:
            _logger.debug("Failed to migrate legacy keyring entry: %s", exc)
            return legacy, "keyring (legacy)", error

    if _allow_plaintext():
        key = _get_plaintext_key(provider)
        if key:
            return key, "config", error
    return None, source, error


def _allow_plaintext() -> bool:
    config = ConfigStore()
    return config.get_bool("ai_allow_plaintext_key", False)


def _set_plaintext_key(provider: str, key: str) -> None:
    if not key:
        raise KeyStoreError("API key is empty")
    config = ConfigStore()
    data = dict(config.get("ai_plaintext_keys", {}))
    data[provider] = key
    config.set("ai_plaintext_keys", data)
    config.save()


def _get_plaintext_key(provider: str) -> Optional[str]:
    config = ConfigStore()
    data = dict(config.get("ai_plaintext_keys", {}))
    return data.get(provider)


def _clear_plaintext_key(provider: str) -> None:
    config = ConfigStore()
    data = dict(config.get("ai_plaintext_keys", {}))
    if provider in data:
        del data[provider]
        config.set("ai_plaintext_keys", data)
        config.save()
