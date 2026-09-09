package com.datansh.EmployeeManagment.service;

import com.datansh.EmployeeManagment.dto.*;
import com.datansh.EmployeeManagment.entity.*;
import com.datansh.EmployeeManagment.exception.ResourceNotFoundException;
import com.datansh.EmployeeManagment.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class AddressService {

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private AddressRepository addressRepository;

    @Autowired
    private EmployeeAddressRepository employeeAddressRepository;

    @Autowired
    private EmergencyContactRepository emergencyContactRepository;

    @Transactional(readOnly = true)
    public List<AddressOut> getAddresses(UUID employeePublicId) {
        Employee employee = employeeRepository.findByPublicId(employeePublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee with public_id '" + employeePublicId + "' not found"));

        return employeeAddressRepository.findByEmployeeEmpId(employee.getEmpId()).stream()
                .map(this::mapToAddressOut)
                .collect(Collectors.toList());
    }

    public AddressOut addAddress(UUID employeePublicId, AddressIn payload) {
        Employee employee = employeeRepository.findByPublicId(employeePublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee with public_id '" + employeePublicId + "' not found"));

        if (Boolean.TRUE.equals(payload.getIsPrimary())) {
            List<EmployeeAddress> existing = employeeAddressRepository.findByEmployeeEmpId(employee.getEmpId());
            for (EmployeeAddress ea : existing) {
                if (Boolean.TRUE.equals(ea.getIsPrimary())) {
                    ea.setIsPrimary(false);
                    employeeAddressRepository.save(ea);
                }
            }
        }

        Address address = Address.builder()
                .streetAddress(payload.getStreetAddress())
                .city(payload.getCity())
                .state(payload.getState())
                .country(payload.getCountry() != null ? payload.getCountry() : "India")
                .pincode(payload.getPincode())
                .build();

        address = addressRepository.save(address);

        EmployeeAddress employeeAddress = EmployeeAddress.builder()
                .employee(employee)
                .address(address)
                .addressType(payload.getAddressType() != null ? payload.getAddressType() : "current")
                .isPrimary(payload.getIsPrimary() != null ? payload.getIsPrimary() : false)
                .build();

        employeeAddress = employeeAddressRepository.save(employeeAddress);
        return mapToAddressOut(employeeAddress);
    }

    public void deleteAddress(UUID employeePublicId, UUID addressPublicId) {
        EmployeeAddress ea = employeeAddressRepository.findByEmployeePublicIdAndAddressPublicId(employeePublicId, addressPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Address link not found for employee"));

        Address address = ea.getAddress();
        employeeAddressRepository.delete(ea);
        if (address != null) {
            addressRepository.delete(address);
        }
    }

    @Transactional(readOnly = true)
    public List<EmergencyContactOut> getEmergencyContacts(UUID employeePublicId) {
        Employee employee = employeeRepository.findByPublicId(employeePublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee with public_id '" + employeePublicId + "' not found"));

        return emergencyContactRepository.findByEmployeeEmpId(employee.getEmpId()).stream()
                .map(this::mapToEmergencyContactOut)
                .collect(Collectors.toList());
    }

    public EmergencyContactOut addEmergencyContact(UUID employeePublicId, EmergencyContactIn payload) {
        Employee employee = employeeRepository.findByPublicId(employeePublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee with public_id '" + employeePublicId + "' not found"));

        if (Boolean.TRUE.equals(payload.getIsPrimary())) {
            List<EmergencyContact> existing = emergencyContactRepository.findByEmployeeEmpId(employee.getEmpId());
            for (EmergencyContact ec : existing) {
                if (Boolean.TRUE.equals(ec.getIsPrimary())) {
                    ec.setIsPrimary(false);
                    emergencyContactRepository.save(ec);
                }
            }
        }

        EmergencyContact contact = EmergencyContact.builder()
                .employee(employee)
                .contactName(payload.getContactName())
                .relationship(payload.getRelationship())
                .phone(payload.getPhone())
                .email(payload.getEmail())
                .isPrimary(payload.getIsPrimary() != null ? payload.getIsPrimary() : false)
                .build();

        contact = emergencyContactRepository.save(contact);
        return mapToEmergencyContactOut(contact);
    }

    public void deleteEmergencyContact(UUID employeePublicId, Long contactId) {
        EmergencyContact contact = emergencyContactRepository.findByContactIdAndEmployeePublicId(contactId, employeePublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Emergency contact not found"));

        emergencyContactRepository.delete(contact);
    }

    public AddressOut mapToAddressOut(EmployeeAddress ea) {
        Address addr = ea.getAddress();
        return AddressOut.builder()
                .publicId(addr != null ? addr.getPublicId().toString() : null)
                .streetAddress(addr != null ? addr.getStreetAddress() : null)
                .city(addr != null ? addr.getCity() : null)
                .state(addr != null ? addr.getState() : null)
                .country(addr != null ? addr.getCountry() : null)
                .pincode(addr != null ? addr.getPincode() : null)
                .formattedAddress(addr != null ? addr.getFormattedAddress() : null)
                .addressType(ea.getAddressType())
                .isPrimary(ea.getIsPrimary())
                .build();
    }

    public EmergencyContactOut mapToEmergencyContactOut(EmergencyContact ec) {
        return EmergencyContactOut.builder()
                .contactId(ec.getContactId())
                .contactName(ec.getContactName())
                .relationship(ec.getRelationship())
                .phone(ec.getPhone())
                .email(ec.getEmail())
                .isPrimary(ec.getIsPrimary())
                .build();
    }
}
