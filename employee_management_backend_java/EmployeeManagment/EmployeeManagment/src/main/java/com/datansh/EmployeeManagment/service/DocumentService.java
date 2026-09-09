package com.datansh.EmployeeManagment.service;

import com.datansh.EmployeeManagment.dto.DocumentIn;
import com.datansh.EmployeeManagment.dto.DocumentMetadataIn;
import com.datansh.EmployeeManagment.dto.DocumentOut;
import com.datansh.EmployeeManagment.entity.Employee;
import com.datansh.EmployeeManagment.entity.EmployeeDocument;
import com.datansh.EmployeeManagment.exception.BadRequestException;
import com.datansh.EmployeeManagment.exception.ResourceNotFoundException;
import com.datansh.EmployeeManagment.repository.EmployeeDocumentRepository;
import com.datansh.EmployeeManagment.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class DocumentService {

    private static final Set<String> VALID_TYPES = Set.of(
            "aadhaar", "pan", "passport", "resume", "offer_letter", "experience_letter", "other"
    );

    private static final Path UPLOAD_DIR = Paths.get("uploads", "documents");

    @Autowired
    private EmployeeDocumentRepository documentRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    public DocumentOut registerDocument(DocumentMetadataIn payload) {
        Employee employee = employeeRepository.findByPublicId(UUID.fromString(payload.getEmployeePublicId()))
                .orElseThrow(() -> new ResourceNotFoundException("Employee '" + payload.getEmployeePublicId() + "' not found"));

        if (!VALID_TYPES.contains(payload.getDocumentType().toLowerCase())) {
            throw new BadRequestException("Invalid document type. Must be one of " + VALID_TYPES);
        }

        EmployeeDocument doc = EmployeeDocument.builder()
                .employee(employee)
                .documentName(payload.getDocumentName().trim())
                .documentType(payload.getDocumentType().toLowerCase())
                .documentUrl(payload.getDocumentUrl().trim())
                .fileSizeBytes(payload.getFileSizeBytes())
                .build();

        doc = documentRepository.save(doc);
        return mapToDto(doc);
    }

    public DocumentOut uploadDocumentFile(String employeePublicId, String documentType, MultipartFile file) {
        Employee employee = employeeRepository.findByPublicId(UUID.fromString(employeePublicId))
                .orElseThrow(() -> new ResourceNotFoundException("Employee '" + employeePublicId + "' not found"));

        if (!VALID_TYPES.contains(documentType.toLowerCase())) {
            throw new BadRequestException("Invalid document type. Must be one of " + VALID_TYPES);
        }

        try {
            if (!Files.exists(UPLOAD_DIR)) {
                Files.createDirectories(UPLOAD_DIR);
            }

            String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document";
            String uniqueFilename = UUID.randomUUID().toString().replace("-", "") + "_" + originalFilename;
            Path filePath = UPLOAD_DIR.resolve(uniqueFilename);

            Files.copy(file.getInputStream(), filePath);

            EmployeeDocument doc = EmployeeDocument.builder()
                    .employee(employee)
                    .documentName(originalFilename)
                    .documentType(documentType.toLowerCase())
                    .documentUrl(filePath.toString().replace("\\", "/"))
                    .fileSizeBytes(file.getSize())
                    .build();

            doc = documentRepository.save(doc);
            return mapToDto(doc);
        } catch (IOException e) {
            throw new BadRequestException("Failed to save uploaded file: " + e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<DocumentOut> getEmployeeDocuments(UUID employeePublicId) {
        return documentRepository.findByEmployeePublicId(employeePublicId).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public DocumentOut getDocumentByPublicId(UUID publicId) {
        EmployeeDocument doc = documentRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Document with public_id '" + publicId + "' not found"));
        return mapToDto(doc);
    }

    public void deleteDocument(UUID publicId) {
        EmployeeDocument doc = documentRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Document with public_id '" + publicId + "' not found"));

        if (doc.getDocumentUrl() != null) {
            try {
                Files.deleteIfExists(Paths.get(doc.getDocumentUrl()));
            } catch (IOException ignored) {}
        }

        documentRepository.delete(doc);
    }

    private Path findFileOnDisk(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return null;
        }
        Path path = Paths.get(rawUrl);
        if (Files.exists(path) && Files.isRegularFile(path)) {
            return path;
        }
        String filename = path.getFileName().toString();
        List<Path> candidateDirs = List.of(
                UPLOAD_DIR,
                Paths.get("uploads/documents"),
                Paths.get("../uploads/documents"),
                Paths.get("c:/Datansh Project/uploads/documents"),
                Paths.get("c:/Datansh Project/Python/uploads/documents"),
                Paths.get("c:/Datansh Project/employee_management_backend_java/EmployeeManagment/EmployeeManagment/uploads/documents")
        );
        for (Path dir : candidateDirs) {
            Path cand = dir.resolve(filename);
            if (Files.exists(cand) && Files.isRegularFile(cand)) {
                return cand;
            }
        }
        return null;
    }

    /**
     * Loads the actual file from disk as a Spring Resource ready for streaming.
     * Returns the Resource and the detected MediaType.
     * Throws ResourceNotFoundException if the document record or file does not exist.
     */
    @Transactional(readOnly = true)
    public Object[] loadDocumentResource(UUID publicId) {
        EmployeeDocument doc = documentRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Document with public_id '" + publicId + "' not found"));

        Path filePath = findFileOnDisk(doc.getDocumentUrl());
        if (filePath == null) {
            throw new ResourceNotFoundException("The document file was not found on the server. It may have been moved or deleted.");
        }

        try {
            Resource resource = new UrlResource(filePath.toUri());
            // Auto-detect media type; fall back to generic binary stream
            MediaType mediaType = MediaTypeFactory.getMediaType(resource)
                    .orElse(MediaType.APPLICATION_OCTET_STREAM);
            String fileName = doc.getDocumentName();
            return new Object[]{resource, mediaType, fileName};
        } catch (MalformedURLException e) {
            throw new BadRequestException("Could not read document file: " + e.getMessage());
        }
    }

    public DocumentOut verifyDocument(UUID publicId, String statusValue, String notes, String verifiedByUserId) {
        EmployeeDocument doc = documentRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Document with public_id '" + publicId + "' not found"));

        String normalized = statusValue != null ? statusValue.trim() : "";
        String targetStatus;
        if (normalized.equalsIgnoreCase("verified")) {
            targetStatus = "Verified";
        } else if (normalized.equalsIgnoreCase("rejected")) {
            targetStatus = "Rejected";
        } else if (normalized.equalsIgnoreCase("pending") || normalized.equalsIgnoreCase("pending_verification")) {
            targetStatus = "Pending_Verification";
        } else {
            throw new BadRequestException("Invalid status '" + statusValue + "'. Must be 'Verified', 'Rejected', or 'Pending_Verification'");
        }

        doc.setStatus(targetStatus);
        doc.setVerificationNotes(notes != null && !notes.isBlank() ? notes.trim() : null);
        doc.setVerifiedByUserId(verifiedByUserId);
        doc.setVerifiedAt(OffsetDateTime.now());

        doc = documentRepository.save(doc);
        return mapToDto(doc);
    }

    @Transactional(readOnly = true)
    public List<DocumentOut> getPendingDocuments() {
        List<String> pendingStatuses = List.of("Pending_Verification", "pending_verification", "Pending", "pending");
        return documentRepository.findByStatusInOrderByUploadedAtDesc(pendingStatuses).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    public DocumentOut mapToDto(EmployeeDocument d) {
        Employee emp = d.getEmployee();
        return DocumentOut.builder()
                .publicId(d.getPublicId().toString())
                .employeePublicId(emp != null && emp.getPublicId() != null ? emp.getPublicId().toString() : null)
                .employeeName(emp != null ? emp.getFullName() : null)
                .documentName(d.getDocumentName())
                .documentType(d.getDocumentType())
                .documentUrl(d.getDocumentUrl())
                .fileSizeBytes(d.getFileSizeBytes())
                .status(d.getStatus() != null ? d.getStatus() : "Pending_Verification")
                .verificationNotes(d.getVerificationNotes())
                .verifiedByUserId(d.getVerifiedByUserId())
                .verifiedAt(d.getVerifiedAt() != null ? d.getVerifiedAt().toString() : null)
                .createdAt(d.getUploadedAt() != null ? d.getUploadedAt().toString() : null)
                .build();
    }
}

