package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.Address;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AddressRepository extends JpaRepository<Address, Long> {
    Optional<Address> findByPublicId(UUID publicId);
}
