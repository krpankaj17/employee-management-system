package com.datansh.EmployeeManagment.security;

import com.datansh.EmployeeManagment.entity.User;
import com.datansh.EmployeeManagment.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User Not Found with email: " + email));

        return UserDetailsImpl.build(user);
    }

    @Transactional(readOnly = true)
    public UserDetails loadUserByPublicId(UUID publicId) throws UsernameNotFoundException {
        User user = userRepository.findByPublicId(publicId)
                .orElseThrow(() -> new UsernameNotFoundException("User Not Found with publicId: " + publicId));

        return UserDetailsImpl.build(user);
    }
}
