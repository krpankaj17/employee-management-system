package com.datansh.EmployeeManagment.controller;

import com.datansh.EmployeeManagment.dto.AnnouncementIn;

import com.datansh.EmployeeManagment.dto.AnnouncementOut;
import com.datansh.EmployeeManagment.dto.NotificationIn;
import com.datansh.EmployeeManagment.dto.NotificationRecipientOut;
import com.datansh.EmployeeManagment.exception.ForbiddenException;
import com.datansh.EmployeeManagment.security.UserDetailsImpl;
import com.datansh.EmployeeManagment.service.AnnouncementService;
import com.datansh.EmployeeManagment.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/announcements")
@Tag(name = "Announcements & Notifications", description = "Company bulletins and real-time user inbox notifications")
public class AnnouncementController {

    @Autowired
    private AnnouncementService announcementService;

    @Autowired
    private NotificationService notificationService;

    @GetMapping
    @PreAuthorize("hasAuthority('announcement:read') or hasAuthority('role:manage') or hasRole('Admin') or hasRole('HR_Manager')")
    @Operation(summary = "Lists active bulletins filtered for current employee or department")
    public ResponseEntity<List<AnnouncementOut>> listAnnouncements(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        return ResponseEntity.ok(announcementService.getActiveAnnouncements(currentUser.getEmployeePublicId()));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('announcement:create') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Publishes a company-wide or department-specific bulletin announcement")
    public ResponseEntity<AnnouncementOut> createAnnouncement(
            @Valid @RequestBody AnnouncementIn payload,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        AnnouncementOut result = announcementService.createAnnouncement(currentUser.getId(), payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }


    @DeleteMapping("/{public_id}")
    @PreAuthorize("hasAuthority('announcement:delete') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Deactivates an announcement")
    public ResponseEntity<Map<String, String>> deactivateAnnouncement(@PathVariable("public_id") String publicId) {
        announcementService.deactivateAnnouncement(UUID.fromString(publicId));
        Map<String, String> res = new HashMap<>();
        res.put("details", "Announcement deactivated");
        return ResponseEntity.ok(res);
    }

    @PostMapping("/notifications/send")
    @PreAuthorize("hasAuthority('announcement:create') or hasAuthority('notification:create') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Sends targeted inbox notifications to an employee, department, or all users")
    public ResponseEntity<Map<String, Object>> sendNotification(
            @Valid @RequestBody NotificationIn payload,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        notificationService.sendNotification(payload, currentUser.getId());
        Map<String, Object> res = new HashMap<>();
        res.put("ok", true);
        res.put("details", "Notifications successfully dispatched");
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    @GetMapping("/notifications/inbox")
    @Operation(summary = "Retrieves inbox notifications for the current employee")
    public ResponseEntity<List<NotificationRecipientOut>> getMyNotifications(
            @RequestParam(required = false) String status,
            @RequestParam(required = false, defaultValue = "false") Boolean unread_only,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        if (currentUser.getEmployeePublicId() == null) {
            throw new ForbiddenException("No employee profile linked to user");
        }
        String filterStatus = status;
        if (filterStatus == null && Boolean.TRUE.equals(unread_only)) {
            filterStatus = "unread";
        }
        return ResponseEntity.ok(notificationService.getMyNotifications(currentUser.getEmployeePublicId(), filterStatus));
    }

    @PostMapping("/notifications/{recipient_id}/read")
    @Operation(summary = "Marks an inbox notification as read")
    public ResponseEntity<Map<String, String>> markNotificationRead(
            @PathVariable("recipient_id") Long recipientId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        if (currentUser.getEmployeePublicId() == null) {
            throw new ForbiddenException("No employee profile linked to user");
        }
        notificationService.markAsRead(recipientId, currentUser.getEmployeePublicId());
        Map<String, String> res = new HashMap<>();
        res.put("details", "Notification marked as read");
        return ResponseEntity.ok(res);
    }
}

