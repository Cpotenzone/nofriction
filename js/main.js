// js/main.js - Page Specific Scripts

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80, // Adjust 80 if your fixed header height is different
                behavior: 'smooth'
            });
        }
    });
});

// Add shadow to navigation on scroll
window.addEventListener('scroll', () => {
    const nav = document.querySelector('nav');
    if (nav) { // Check if nav exists
        if (window.scrollY > 10) {
            nav.classList.add('shadow-2xl'); // Tailwind class for shadow
        } else {
            nav.classList.remove('shadow-2xl');
        }
    }
});

// Dynamic active state for navigation links
document.addEventListener('DOMContentLoaded', function() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('nav .nav-links a.nav-link'); // Target only .nav-link within .nav-links

  navLinks.forEach(link => {
    const linkHref = link.getAttribute('href');

    if (linkHref) {
      // Normalize paths to ensure consistent comparison (e.g. remove trailing slashes if any)
      const normalizedCurrentPath = currentPath.endsWith('/') && currentPath.length > 1 ? currentPath.slice(0, -1) : currentPath;
      const normalizedLinkHref = linkHref.endsWith('/') && linkHref.length > 1 ? linkHref.slice(0, -1) : linkHref;

      // Handle root path explicitly
      if (normalizedLinkHref === '/' || normalizedLinkHref === '/index.html' || normalizedLinkHref === 'index.html') {
        if (normalizedCurrentPath === '/' || normalizedCurrentPath === '/index.html') {
          link.classList.add('active');
        }
      } else if (normalizedCurrentPath.endsWith(normalizedLinkHref)) { 
        // For other paths, check if the current path ends with the link's href
        // This handles cases like /lab.html and /lab
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    }
  });
});