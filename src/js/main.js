document.addEventListener('DOMContentLoaded', () => {
    // Handle navigation
    document.querySelectorAll('nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const path = e.target.getAttribute('href');
            navigateTo(path);
        });
    });

    // Initial page load
    navigateTo(window.location.pathname);
});

async function navigateTo(path) {
    // Update URL without page reload
    history.pushState({}, '', path);
    
    // Update content based on path
    const contentDiv = document.getElementById('content');
    
    try {
        let response;
        if (path === '/') {
            response = await fetch('/content/home');
        } else if (path.startsWith('/blog/')) {
            response = await fetch(path);
        } else {
            response = await fetch(`/content${path}`);
        }

        if (response.ok) {
            const html = await response.text();
            contentDiv.innerHTML = html;
        } else {
            contentDiv.innerHTML = '<h2>404 - Page Not Found</h2>';
        }
    } catch (error) {
        console.error('Error loading content:', error);
        contentDiv.innerHTML = '<h2>Error loading content</h2>';
    }
} 