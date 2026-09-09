package com.datansh.EmployeeManagment;

import com.datansh.EmployeeManagment.config.CacheConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.core.RedisTemplate;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class ValkeyCacheIntegrationTest {

    @Autowired
    private CacheManager cacheManager;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Test
    @DisplayName("Verify Spring Boot Valkey CacheManager stores and retrieves cached entities in DB 0")
    void testValkeyCacheOperations() {
        assertNotNull(cacheManager, "CacheManager should be loaded");

        Cache departmentCache = cacheManager.getCache(CacheConfig.CACHE_DEPARTMENTS);
        assertNotNull(departmentCache, "Departments cache should exist");

        String cacheKey = "test_dept_999";
        Map<String, Object> deptData = new HashMap<>();
        deptData.put("id", "999");
        deptData.put("name", "Artificial Intelligence");

        // 1. Put into Cache
        departmentCache.put(cacheKey, deptData);

        // 2. Retrieve from Cache
        Cache.ValueWrapper wrapper = departmentCache.get(cacheKey);
        assertNotNull(wrapper, "Value should be cached in Valkey");
        assertNotNull(wrapper.get(), "Cached value should not be null");

        // 3. Verify key format in Valkey RedisTemplate
        String expectedRedisKey = CacheConfig.KEY_PREFIX + CacheConfig.CACHE_DEPARTMENTS + "::" + cacheKey;
        Boolean hasKey = redisTemplate.hasKey(expectedRedisKey);
        assertNotNull(hasKey);
        assertTrue(hasKey, "Redis/Valkey should contain key: " + expectedRedisKey);

        // 4. Evict from Cache
        departmentCache.evict(cacheKey);
        assertNull(departmentCache.get(cacheKey), "Cache should return null after eviction");
    }
}
