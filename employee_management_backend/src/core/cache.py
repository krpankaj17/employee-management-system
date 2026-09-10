# src/core/cache.py
"""Valkey-backed Distributed Caching module with resilient in-memory fallback.

Features:
- Isolated Valkey caching on Database 1 with `py:` key namespacing.
- In-memory RAM TTL fallback when Valkey is offline (instant <1ms response times).
- Circuit breaker: checks Valkey availability with a short timeout and avoids blocking threads when down.
- Domain-specific TTL configurations.
- Cache Penetration Defense: Short-lived Negative Caching for non-existent items (60s TTL).
- Cache Stampede Defense: Atomic mutex locks for single-flight compute on cache misses.
- Resilient Fallback: Gracefully falls back to direct DB computation if Valkey is temporarily unreachable.
- Cache Invalidation helpers for write operations.
"""

import json
import logging
import time
import threading
from typing import Any, Callable, TypeVar
import redis
from core.config import settings

logger = logging.getLogger("app.cache")

# Domain TTL Configurations (in seconds)
DOMAIN_TTLS: dict[str, int] = {
    "departments": 3600,       # 1 Hour
    "designations": 3600,      # 1 Hour
    "leave_types": 21600,      # 6 Hours
    "holidays": 21600,         # 6 Hours
    "employee_profiles": 900,  # 15 Minutes
    "employee_lists": 300,     # 5 Minutes
}

DEFAULT_TTL = 300              # 5 Minutes
NEGATIVE_CACHE_TTL = 60        # 60 Seconds
KEY_PREFIX = "py"
NEGATIVE_MARKER = "__VALKEY_NULL_MARKER__"

# Thread-safe partition locks for Cache Stampede Defense
_locks: dict[str, threading.Lock] = {
    "departments": threading.Lock(),
    "designations": threading.Lock(),
    "leave_types": threading.Lock(),
    "holidays": threading.Lock(),
    "employee_profiles": threading.Lock(),
    "employee_lists": threading.Lock(),
}
_default_lock = threading.Lock()

# Global Valkey Client Pool with resilient connection timeouts for cloud environments
_pool = redis.ConnectionPool.from_url(
    settings.VALKEY_URL,
    decode_responses=True,
    max_connections=20,
    socket_timeout=1.0,
    socket_connect_timeout=2.0,
)
_client = redis.Redis(connection_pool=_pool)

# Circuit breaker state for Valkey liveness
_valkey_is_online = False
_last_liveness_check = 0.0
_LIVENESS_CHECK_INTERVAL = 30.0  # seconds between probes when offline

# In-memory RAM cache fallback: key -> (expire_timestamp, value)
_mem_cache: dict[str, tuple[float, Any]] = {}
_mem_lock = threading.Lock()

T = TypeVar("T")


def _is_valkey_alive() -> bool:
    """Probes Valkey liveness without blocking the main event loop."""
    global _valkey_is_online, _last_liveness_check
    now = time.monotonic()
    if now - _last_liveness_check < _LIVENESS_CHECK_INTERVAL:
        return _valkey_is_online

    _last_liveness_check = now
    try:
        _client.ping()
        _valkey_is_online = True
    except Exception:
        _valkey_is_online = False
    return _valkey_is_online


def _get_from_mem_cache(cache_key: str) -> tuple[bool, Any]:
    """Retrieves item from in-memory cache if not expired."""
    with _mem_lock:
        item = _mem_cache.get(cache_key)
        if not item:
            return False, None
        exp_time, val = item
        if time.monotonic() > exp_time:
            _mem_cache.pop(cache_key, None)
            return False, None
        return True, val


def _set_in_mem_cache(cache_key: str, value: Any, ttl: int) -> None:
    """Stores item in in-memory cache with expiry timestamp."""
    with _mem_lock:
        # Keep cache size bounded
        if len(_mem_cache) > 2000:
            now = time.monotonic()
            expired_keys = [k for k, (exp, _) in _mem_cache.items() if now > exp]
            for k in expired_keys:
                _mem_cache.pop(k, None)
            if len(_mem_cache) > 2000:
                _mem_cache.clear()
        _mem_cache[cache_key] = (time.monotonic() + ttl, value)


def _make_key(domain: str, key: str) -> str:
    return f"{KEY_PREFIX}:{domain}:{key}"


def _make_neg_key(domain: str, key: str) -> str:
    return f"{KEY_PREFIX}:neg:{domain}:{key}"


def get_cached_or_compute(domain: str, key: str, compute_func: Callable[[], T]) -> T | None:
    """Thread-safe Cache-Aside retriever with single-flight mutex, negative caching, and memory/Valkey persistence."""
    cache_key = _make_key(domain, key)
    neg_key = _make_neg_key(domain, key)
    lock = _locks.get(domain, _default_lock)
    ttl = DOMAIN_TTLS.get(domain, DEFAULT_TTL)

    # 1. Check in-memory cache first (0ms latency)
    found, val = _get_from_mem_cache(cache_key)
    if found:
        return val

    # 2. Check Valkey Cache if circuit breaker indicates it's alive
    if _is_valkey_alive():
        try:
            if _client.exists(neg_key):
                _set_in_mem_cache(cache_key, None, NEGATIVE_CACHE_TTL)
                return None

            cached_json = _client.get(cache_key)
            if cached_json is not None:
                parsed = json.loads(cached_json)
                _set_in_mem_cache(cache_key, parsed, ttl)
                return parsed
        except Exception as e:
            logger.warning("Valkey cache read error for key '%s': %s", cache_key, e)

    # 3. Cache Miss: Single-flight compute under lock (Stampede Defense)
    with lock:
        # Double check in-memory inside lock
        found, val = _get_from_mem_cache(cache_key)
        if found:
            return val

        # Compute from DB
        result = compute_func()

        # Update in-memory cache
        _set_in_mem_cache(cache_key, result, ttl if result is not None else NEGATIVE_CACHE_TTL)

        # Write to Valkey if online
        if _is_valkey_alive():
            try:
                if result is None:
                    _client.set(neg_key, "1", ex=NEGATIVE_CACHE_TTL)
                else:
                    _client.set(cache_key, json.dumps(result), ex=ttl)
            except Exception as e:
                logger.error("Failed to write to Valkey cache for key '%s': %s", cache_key, e)

        return result


def invalidate_cache(domain: str, key: str | None = None) -> None:
    """Evicts a specific key or purges an entire cache domain from both memory and Valkey."""
    lock = _locks.get(domain, _default_lock)

    # Invalidate in-memory cache
    with _mem_lock:
        if key is not None:
            _mem_cache.pop(_make_key(domain, key), None)
            _mem_cache.pop(_make_neg_key(domain, key), None)
        else:
            prefix = f"{KEY_PREFIX}:{domain}:"
            to_del = [k for k in _mem_cache if k.startswith(prefix)]
            for k in to_del:
                _mem_cache.pop(k, None)

    # Invalidate Valkey if online
    if _is_valkey_alive():
        with lock:
            try:
                if key is not None:
                    _client.delete(_make_key(domain, key))
                    _client.delete(_make_neg_key(domain, key))
                else:
                    cursor = 0
                    pattern = f"{KEY_PREFIX}:{domain}:*"
                    neg_pattern = f"{KEY_PREFIX}:neg:{domain}:*"

                    keys_to_delete = []
                    for p in [pattern, neg_pattern]:
                        for k in _client.scan_iter(match=p, count=100):
                            keys_to_delete.append(k)

                    if keys_to_delete:
                        _client.delete(*keys_to_delete)
            except Exception as e:
                logger.error("Failed to invalidate Valkey cache for domain '%s', key '%s': %s", domain, key, e)


def invalidate_all() -> None:
    """Purges all keys in both in-memory cache and Valkey."""
    with _mem_lock:
        _mem_cache.clear()
    if _is_valkey_alive():
        try:
            _client.flushdb()
        except Exception as e:
            logger.error("Failed to flush Python Valkey database: %s", e)
