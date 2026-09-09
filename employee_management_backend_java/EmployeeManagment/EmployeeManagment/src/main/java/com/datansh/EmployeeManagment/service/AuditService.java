package com.datansh.EmployeeManagment.service;

import com.datansh.EmployeeManagment.dto.AuditLogOut;
import com.datansh.EmployeeManagment.dto.PaginatedAuditLogs;
import com.datansh.EmployeeManagment.entity.AuditLog;
import com.datansh.EmployeeManagment.entity.User;
import com.datansh.EmployeeManagment.repository.AuditLogRepository;
import com.datansh.EmployeeManagment.repository.UserRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class AuditService {

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private UserRepository userRepository;

    public void logAction(Long userId, String action, String entityName, String entityId, String oldValues, String newValues) {
        User user = userId != null ? userRepository.findById(userId).orElse(null) : null;

        AuditLog log = AuditLog.builder()
                .user(user)
                .action(action)
                .entityName(entityName)
                .entityId(entityId)
                .oldValues(oldValues)
                .newValues(newValues)
                .build();

        auditLogRepository.save(log);
    }

    @Transactional(readOnly = true)
    public PaginatedAuditLogs listAuditLogs(
            String entityName, String action, String userPublicId,
            OffsetDateTime dateFrom, OffsetDateTime dateTo,
            int skip, Integer limit
    ) {
        Specification<AuditLog> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (entityName != null && !entityName.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("entityName")), entityName.toLowerCase()));
            }
            if (action != null && !action.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("action")), action.toLowerCase()));
            }
            if (userPublicId != null && !userPublicId.isBlank()) {
                predicates.add(cb.equal(root.get("user").get("publicId"), UUID.fromString(userPublicId)));
            }
            if (dateFrom != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), dateFrom));
            }
            if (dateTo != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), dateTo));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        int pageSize = limit != null && limit > 0 ? limit : 50;
        int pageNumber = skip / pageSize;
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<AuditLog> page = auditLogRepository.findAll(spec, pageable);

        List<AuditLogOut> items = page.getContent().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());

        return PaginatedAuditLogs.builder()
                .total(page.getTotalElements())
                .skip(skip)
                .limit(limit)
                .items(items)
                .build();
    }

    public AuditLogOut mapToDto(AuditLog l) {
        User u = l.getUser();
        return AuditLogOut.builder()
                .logId(l.getLogId())
                .userEmail(u != null ? u.getEmail() : "System")
                .userPublicId(u != null && u.getPublicId() != null ? u.getPublicId().toString() : null)
                .action(l.getAction())
                .entityName(l.getEntityName())
                .entityId(l.getEntityId())
                .oldValues(l.getOldValues())
                .newValues(l.getNewValues())
                .createdAt(l.getCreatedAt())
                .build();
    }
}

