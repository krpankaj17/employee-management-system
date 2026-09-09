package com.datansh.EmployeeManagment.service;

import com.datansh.EmployeeManagment.dto.HolidayIn;
import com.datansh.EmployeeManagment.dto.HolidayOut;
import com.datansh.EmployeeManagment.entity.Holiday;
import com.datansh.EmployeeManagment.exception.BadRequestException;
import com.datansh.EmployeeManagment.exception.ResourceNotFoundException;
import com.datansh.EmployeeManagment.repository.HolidayRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class HolidayService {

    @Autowired
    private HolidayRepository holidayRepository;

    @CacheEvict(value = "holidays", allEntries = true)
    public HolidayOut createHoliday(HolidayIn payload) {
        Optional<Holiday> existing = holidayRepository.findByDate(payload.getDate());
        if (existing.isPresent()) {
            throw new BadRequestException("Holiday on date " + payload.getDate() + " already exists ('" + existing.get().getName() + "')");
        }

        Holiday holiday = Holiday.builder()
                .name(payload.getName())
                .date(payload.getDate())
                .holidayType(payload.getHolidayType() != null ? payload.getHolidayType() : "company")
                .year(payload.getYear() != null ? payload.getYear() : payload.getDate().getYear())
                .isOptional(payload.getIsOptional() != null ? payload.getIsOptional() : false)
                .applicableRegion(payload.getApplicableRegion() != null ? payload.getApplicableRegion() : "ALL")
                .build();

        holiday = holidayRepository.save(holiday);
        return mapToDto(holiday);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "holidays", key = "(#year != null ? #year : 'all') + '_' + (#region != null ? #region : 'all') + '_' + #skip + '_' + #limit")
    public com.datansh.EmployeeManagment.dto.PaginatedHolidays listHolidays(Integer year, String region, int skip, Integer limit) {
        org.springframework.data.jpa.domain.Specification<Holiday> spec = (root, query, cb) -> {
            java.util.List<jakarta.persistence.criteria.Predicate> predicates = new java.util.ArrayList<>();

            if (year != null) {
                predicates.add(cb.equal(root.get("year"), year));
            }
            if (region != null && !region.isBlank()) {
                predicates.add(cb.or(
                        cb.equal(cb.lower(root.get("applicableRegion")), region.toLowerCase()),
                        cb.equal(cb.lower(root.get("applicableRegion")), "all")
                ));
            }

            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };

        int pageSize = limit != null && limit > 0 ? limit : 50;
        int pageNumber = skip / pageSize;
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(pageNumber, pageSize, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.ASC, "date"));

        org.springframework.data.domain.Page<Holiday> page = holidayRepository.findAll(spec, pageable);

        List<HolidayOut> items = page.getContent().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());

        return com.datansh.EmployeeManagment.dto.PaginatedHolidays.builder()
                .total(page.getTotalElements())
                .skip(skip)
                .limit(limit)
                .items(items)
                .build();
    }


    @CacheEvict(value = "holidays", allEntries = true)
    public void deleteHoliday(UUID publicId) {
        Holiday holiday = holidayRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Holiday with public_id '" + publicId + "' not found"));
        holidayRepository.delete(holiday);
    }

    public HolidayOut mapToDto(Holiday h) {
        return HolidayOut.builder()
                .publicId(h.getPublicId().toString())
                .name(h.getName())
                .date(h.getDate())
                .holidayType(h.getHolidayType())
                .year(h.getYear())
                .isOptional(h.getIsOptional())
                .applicableRegion(h.getApplicableRegion())
                .build();
    }
}
