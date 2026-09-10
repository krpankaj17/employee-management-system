# tests/test_caching.py
import pytest
from core.cache import get_cached_or_compute, invalidate_cache, invalidate_all, _client


def is_valkey_available():
    try:
        return bool(_client.ping())
    except Exception:
        return False


valkey_required = pytest.mark.skipif(
    not is_valkey_available(),
    reason="Valkey/Redis server is not running locally"
)


def test_valkey_caching_hit_and_miss():
    invalidate_all()
    call_count = 0

    def compute():
        nonlocal call_count
        call_count += 1
        return {"id": "dept-1", "name": "Engineering"}

    # 1. First call -> Cache MISS (calls compute)
    res1 = get_cached_or_compute("departments", "dept-1", compute)
    assert res1 == {"id": "dept-1", "name": "Engineering"}
    assert call_count == 1

    # 2. Second call -> Cache HIT (does NOT call compute)
    res2 = get_cached_or_compute("departments", "dept-1", compute)
    assert res2 == {"id": "dept-1", "name": "Engineering"}
    assert call_count == 1  # count did not increase!


@valkey_required
def test_cache_penetration_negative_caching():
    invalidate_all()
    call_count = 0

    def compute_not_found():
        nonlocal call_count
        call_count += 1
        return None  # simulates 404 in DB

    # 1. First query for missing key -> calls compute
    res1 = get_cached_or_compute("departments", "fake-uuid-999", compute_not_found)
    assert res1 is None
    assert call_count == 1
    assert _client.exists("py:neg:departments:fake-uuid-999") == 1

    # 2. Second query for missing key -> hits negative cache, does NOT touch compute!
    res2 = get_cached_or_compute("departments", "fake-uuid-999", compute_not_found)
    assert res2 is None
    assert call_count == 1  # DB was NOT touched again (Penetration prevented!)


def test_cache_eviction_on_invalidation():
    invalidate_all()
    call_count = 0

    def compute():
        nonlocal call_count
        call_count += 1
        return {"id": "dept-1", "name": "Engineering"}

    # Populate cache
    get_cached_or_compute("departments", "dept-1", compute)
    assert call_count == 1

    # Evict cache key
    invalidate_cache("departments", "dept-1")

    # Next call computes fresh from DB
    get_cached_or_compute("departments", "dept-1", compute)
    assert call_count == 2


@valkey_required
def test_defensive_deep_copying_prevents_cache_poisoning():
    invalidate_all()

    def compute():
        return {"name": "Engineering", "tags": ["tech", "core"]}

    res = get_cached_or_compute("departments", "dept-1", compute)
    # Caller attempts to mutate in-memory returned object
    res["tags"].append("HACKED_TAG")
    res["name"] = "HACKED_NAME"

    # Subsequent fetch should be pristine (deserialized from Valkey)
    fresh = get_cached_or_compute("departments", "dept-1", compute)
    assert fresh["name"] == "Engineering"
    assert fresh["tags"] == ["tech", "core"]
    assert "HACKED_TAG" not in fresh["tags"]

