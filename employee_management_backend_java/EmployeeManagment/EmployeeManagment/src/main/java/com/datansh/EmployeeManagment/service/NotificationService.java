package com.datansh.EmployeeManagment.service;

import com.datansh.EmployeeManagment.dto.NotificationIn;
import com.datansh.EmployeeManagment.dto.NotificationRecipientOut;
import com.datansh.EmployeeManagment.entity.Department;
import com.datansh.EmployeeManagment.entity.Employee;
import com.datansh.EmployeeManagment.entity.Notification;
import com.datansh.EmployeeManagment.entity.NotificationRecipient;
import com.datansh.EmployeeManagment.exception.ResourceNotFoundException;
import com.datansh.EmployeeManagment.repository.DepartmentRepository;
import com.datansh.EmployeeManagment.repository.EmployeeRepository;
import com.datansh.EmployeeManagment.repository.NotificationRecipientRepository;
import com.datansh.EmployeeManagment.repository.NotificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class NotificationService {

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private NotificationRecipientRepository notificationRecipientRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    public void sendNotification(NotificationIn payload, Long creatorEmpId) {
        Employee creator = creatorEmpId != null ? employeeRepository.findById(creatorEmpId).orElse(null) : null;

        Employee targetEmp = null;
        if (payload.getTargetEmployeePublicId() != null && !payload.getTargetEmployeePublicId().isBlank()) {
            targetEmp = employeeRepository.findByPublicId(UUID.fromString(payload.getTargetEmployeePublicId())).orElse(null);
        }

        Department targetDept = null;
        if (payload.getTargetDepartmentPublicId() != null && !payload.getTargetDepartmentPublicId().isBlank()) {
            targetDept = departmentRepository.findByPublicId(UUID.fromString(payload.getTargetDepartmentPublicId())).orElse(null);
        }

        Notification notification = Notification.builder()
                .title(payload.getTitle())
                .message(payload.getMessage())
                .notificationType(payload.getNotificationType() != null ? payload.getNotificationType() : "general")
                .targetType(payload.getTargetType() != null ? payload.getTargetType() : "all")
                .targetEmployee(targetEmp)
                .targetDepartment(targetDept)
                .creator(creator)
                .build();

        notification = notificationRepository.save(notification);

        List<Employee> recipients = new ArrayList<>();
        if ("employee".equalsIgnoreCase(payload.getTargetType()) && targetEmp != null) {
            recipients.add(targetEmp);
        } else if ("department".equalsIgnoreCase(payload.getTargetType()) && targetDept != null) {
            recipients = employeeRepository.findByDepartmentDeptId(targetDept.getDeptId());
        } else {
            recipients = employeeRepository.findAll();
        }

        for (Employee emp : recipients) {
            NotificationRecipient recipient = NotificationRecipient.builder()
                    .notification(notification)
                    .employee(emp)
                    .status("unread")
                    .build();
            notificationRecipientRepository.save(recipient);
        }
    }

    @Transactional(readOnly = true)
    public List<NotificationRecipientOut> getMyNotifications(UUID employeePublicId, String status) {
        if (status != null && !status.isBlank()) {
            return notificationRecipientRepository.findByEmployeePublicIdAndStatus(employeePublicId, status).stream()
                    .map(this::mapToRecipientOut)
                    .collect(Collectors.toList());
        }
        return notificationRecipientRepository.findByEmployeePublicIdOrderByCreatedAtDesc(employeePublicId).stream()
                .map(this::mapToRecipientOut)
                .collect(Collectors.toList());
    }

    public void markAsRead(Long recipientId, UUID employeePublicId) {
        NotificationRecipient recipient = notificationRecipientRepository.findByRecipientIdAndEmployeePublicId(recipientId, employeePublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification recipient not found"));

        recipient.setStatus("read");
        recipient.setReadAt(OffsetDateTime.now());
        notificationRecipientRepository.save(recipient);
    }

    public NotificationRecipientOut mapToRecipientOut(NotificationRecipient nr) {
        Notification n = nr.getNotification();
        return NotificationRecipientOut.builder()
                .recipientId(nr.getRecipientId())
                .notificationPublicId(n != null ? n.getPublicId().toString() : null)
                .title(n != null ? n.getTitle() : "")
                .message(n != null ? n.getMessage() : "")
                .notificationType(n != null ? n.getNotificationType() : "general")
                .status(nr.getStatus())
                .readAt(nr.getReadAt() != null ? nr.getReadAt().toString() : null)
                .build();
    }
}
