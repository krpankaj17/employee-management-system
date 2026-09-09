package com.datansh.EmployeeManagment.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;

public class JsonUtil {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static String toJson(Object obj) {
        if (obj == null) {
            return "[]";
        }
        try {
            return MAPPER.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    public static <T> List<T> fromJsonList(String json, Class<T> clazz) {
        if (json == null || json.isBlank() || json.trim().equals("[]")) {
            return new ArrayList<>();
        }
        try {
            return MAPPER.readValue(json, MAPPER.getTypeFactory().constructCollectionType(List.class, clazz));
        } catch (Exception e) {
            // Fallback: parse comma-separated or bracketed string
            String cleaned = json.replaceAll("[\\[\\]\"\\s]", "");
            if (cleaned.isBlank()) {
                return new ArrayList<>();
            }
            List<T> list = new ArrayList<>();
            for (String item : cleaned.split(",")) {
                if (!item.isBlank()) {
                    list.add((T) item);
                }
            }
            return list;
        }
    }
}
