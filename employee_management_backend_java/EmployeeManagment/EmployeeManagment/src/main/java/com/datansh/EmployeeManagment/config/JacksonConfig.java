package com.datansh.EmployeeManagment.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JacksonConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer jacksonCustomizer() {
        return builder -> {
            builder.propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE);
            builder.featuresToEnable(
                    MapperFeature.ACCEPT_CASE_INSENSITIVE_PROPERTIES,
                    MapperFeature.ACCEPT_CASE_INSENSITIVE_ENUMS
            );
            builder.featuresToDisable(
                    DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES
            );
            builder.modules(new JavaTimeModule());
        };
    }
}
