package com.datansh.EmployeeManagment.controller;

import com.datansh.EmployeeManagment.dto.DocumentIn;
import com.datansh.EmployeeManagment.dto.DocumentOut;
import com.datansh.EmployeeManagment.dto.DocumentVerifyIn;
import com.datansh.EmployeeManagment.exception.ForbiddenException;
import com.datansh.EmployeeManagment.security.UserDetailsImpl;
import com.datansh.EmployeeManagment.service.DocumentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/documents")
@Tag(name = "Document Management", description = "Document records and links (Aadhaar, PAN, Passport, Resume, Offer Letters)")
public class DocumentController {


    @Autowired
    private DocumentService documentService;

    @PostMapping("/register")
    @PreAuthorize("hasAuthority('document:upload') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Registers document metadata (e.g., for external S3 / Cloud storage links)")
    public ResponseEntity<DocumentOut> registerDocument(
            @Valid @RequestBody com.datansh.EmployeeManagment.dto.DocumentMetadataIn payload
    ) {
        DocumentOut result = documentService.registerDocument(payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PostMapping(value = "/upload", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Uploads a local document file for an employee")
    public ResponseEntity<DocumentOut> uploadDocument(
            @RequestParam("employee_public_id") String employeePublicId,
            @RequestParam("document_type") String documentType,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser.hasPermission("document:upload") || currentUser.hasPermission("document:create");
        if (!hasPerm && (currentUser.getEmployeePublicId() == null || !currentUser.getEmployeePublicId().toString().equalsIgnoreCase(employeePublicId))) {
            throw new ForbiddenException("Access not granted: You do not have permission to upload documents for other employees.");
        }
        DocumentOut result = documentService.uploadDocumentFile(employeePublicId, documentType, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }


    @GetMapping("/employee/{employee_public_id}")
    @Operation(summary = "Lists all document records for an employee")
    public ResponseEntity<List<DocumentOut>> getEmployeeDocuments(
            @PathVariable("employee_public_id") String employeePublicId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser.hasPermission("document:read") || currentUser.hasPermission("document:view");
        if (!hasPerm && (currentUser.getEmployeePublicId() == null || !currentUser.getEmployeePublicId().toString().equalsIgnoreCase(employeePublicId))) {
            throw new ForbiddenException("Access not granted: You do not have permission to view documents for other employees.");
        }
        return ResponseEntity.ok(documentService.getEmployeeDocuments(UUID.fromString(employeePublicId)));
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAuthority('document:verify') or hasAuthority('document:read') or hasAuthority('role:manage') or hasRole('Admin') or hasRole('HR_Manager')")
    @Operation(summary = "Lists all documents pending verification")
    public ResponseEntity<List<DocumentOut>> getPendingDocuments() {
        return ResponseEntity.ok(documentService.getPendingDocuments());
    }

    @GetMapping("/{public_id}")
    @Operation(summary = "Retrieves a single document record by UUID")
    public ResponseEntity<DocumentOut> getDocumentById(
            @PathVariable("public_id") String publicId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        DocumentOut doc = documentService.getDocumentByPublicId(UUID.fromString(publicId));
        boolean hasPerm = currentUser.hasPermission("document:read") || currentUser.hasPermission("document:view");
        if (!hasPerm) {
            // Employees can only view their own documents
            boolean isOwner = currentUser.getEmployeePublicId() != null
                    && doc.getEmployeePublicId() != null
                    && currentUser.getEmployeePublicId().toString().equalsIgnoreCase(doc.getEmployeePublicId());
            if (!isOwner) {
                throw new ForbiddenException("Access not granted: You do not have permission to view this document.");
            }
        }
        return ResponseEntity.ok(doc);
    }

    @PostMapping("/{public_id}/verify")
    @PreAuthorize("hasAuthority('document:verify') or hasAuthority('role:manage') or hasRole('Admin') or hasRole('HR_Manager')")
    @Operation(summary = "Verifies or rejects a document record (Admin / HR can verify their own documents as well)")
    public ResponseEntity<DocumentOut> verifyDocument(
            @PathVariable("public_id") String publicId,
            @Valid @RequestBody DocumentVerifyIn payload,
            @Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        String verifierId = currentUser.getDisplayName() != null ? currentUser.getDisplayName() : (currentUser.getEmail() != null ? currentUser.getEmail() : currentUser.getPublicId().toString());
        DocumentOut result = documentService.verifyDocument(
                UUID.fromString(publicId),
                payload.getStatus(),
                payload.getVerificationNotes(),
                verifierId
        );
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{public_id}/view")
    @Operation(
        summary = "View document inline in the browser",
        description = "Opens the document inline (PDF/images render in the browser tab). Non-previewable types (DOCX, XLSX) automatically fall back to a download."
    )
    public ResponseEntity<Resource> viewDocument(
            @PathVariable("public_id") String publicId,
            @Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        Object[] payload = resolveDocumentResource(publicId, currentUser);
        Resource resource   = (Resource) payload[0];
        MediaType mediaType = (MediaType) payload[1];
        String fileName     = (String)   payload[2];

        // MIME types browsers can render natively without downloading
        Set<MediaType> inlineTypes = Set.of(
                MediaType.APPLICATION_PDF,
                MediaType.IMAGE_JPEG,
                MediaType.IMAGE_PNG,
                MediaType.IMAGE_GIF,
                MediaType.TEXT_PLAIN,
                MediaType.TEXT_HTML,
                MediaType.valueOf("image/webp"),
                MediaType.valueOf("image/svg+xml")
        );

        // Non-previewable types automatically fall back to attachment
        ContentDisposition disposition = inlineTypes.contains(mediaType)
                ? ContentDisposition.inline().filename(fileName).build()
                : ContentDisposition.attachment().filename(fileName).build();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(disposition);

        return ResponseEntity.ok()
                .headers(headers)
                .contentType(mediaType)
                .body(resource);
    }

    @GetMapping("/{public_id}/download")
    @Operation(
        summary = "Download document as a file",
        description = "Forces a file-save download dialog in the browser regardless of file type."
    )
    public ResponseEntity<Resource> downloadDocument(
            @PathVariable("public_id") String publicId,
            @Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        Object[] payload = resolveDocumentResource(publicId, currentUser);
        Resource resource   = (Resource) payload[0];
        MediaType mediaType = (MediaType) payload[1];
        String fileName     = (String)   payload[2];

        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.attachment().filename(fileName).build());

        return ResponseEntity.ok()
                .headers(headers)
                .contentType(mediaType)
                .body(resource);
    }

    @DeleteMapping("/{public_id}")
    @PreAuthorize("hasAuthority('document:delete') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Deletes a document record")
    public ResponseEntity<Map<String, String>> deleteDocument(@PathVariable("public_id") String publicId) {
        documentService.deleteDocument(UUID.fromString(publicId));
        Map<String, String> res = new HashMap<>();
        res.put("details", "Document record successfully deleted");
        return ResponseEntity.ok(res);
    }

    // -----------------------------------------------------------------------
    // Private helper: shared RBAC check + file resource resolution
    // -----------------------------------------------------------------------
    private Object[] resolveDocumentResource(String publicId, UserDetailsImpl currentUser) {
        DocumentOut doc = documentService.getDocumentByPublicId(UUID.fromString(publicId));

        boolean hasPerm = currentUser.hasPermission("document:read") || currentUser.hasPermission("document:view");
        if (!hasPerm) {
            boolean isOwner = currentUser.getEmployeePublicId() != null
                    && doc.getEmployeePublicId() != null
                    && currentUser.getEmployeePublicId().toString().equalsIgnoreCase(doc.getEmployeePublicId());
            if (!isOwner) {
                throw new ForbiddenException("Access not granted: You do not have permission to access this document.");
            }
        }

        return documentService.loadDocumentResource(UUID.fromString(publicId));
    }
}
