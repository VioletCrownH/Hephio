/* ============================================
   HEPHIO FOOTER TEMPLATE
   Shared across all tools - edit once, updates everywhere
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
  const footerHTML = `
    <footer class="hephio-footer">
      <div class="hephio-footer-container">
        
        <!-- Top Section: Brand/Links + Social Icons -->
        <div class="hephio-footer-top">
          
          <!-- Brand + Links -->
          <div class="hephio-footer-brand">
            <div class="hephio-footer-logo">
              Hephio<span class="hephio-footer-logo-dot">.</span>
            </div>
            
            <!-- Links - Now prominent below logo -->
            <div class="hephio-footer-links">
              <a href="/about/index.html" class="hephio-footer-link">About</a>
              <a href="/opensource/index.html" class="hephio-footer-link">Open Source</a>
              <a href="/privacy/index.html" class="hephio-footer-link">Privacy</a>
              <a href="/terms/index.html" class="hephio-footer-link">Terms</a>
            </div>
          </div>
          
          <!-- Social Icons -->
          <div class="hephio-footer-social">

            <!-- X -->
            <a 
              href="https://x.com/hephio"
              class="hephio-footer-social-link"
              aria-label="Follow on X"
              target="_blank"
              rel="noopener"
            >
              <svg
                class="hephio-footer-social-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                width="32"
                height="32"
                aria-hidden="true"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>

            <!-- Email -->
            <a 
              href="mailto:support@hephio.com"
              class="hephio-footer-social-link"
              aria-label="Email"
            >
              <svg
                class="hephio-footer-social-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                width="32"
                height="32"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="2"/>
                <path d="M3 7l9 6 9-6"/>
              </svg>
            </a>

          </div>
          
        </div>
        
        <!-- Bottom Section: Description + Copyright -->
        <div class="hephio-footer-bottom">
          
          <!-- Privacy description - now less prominent -->
          <p class="hephio-footer-description">
            Privacy-first browser tools for images, PDFs, text, and files. 
            All processing happens locally in your browser.
          </p>
          
          <!-- Copyright -->
          <div class="hephio-footer-copyright">
            © ${new Date().getFullYear()} Hephio. All rights reserved.
          </div>
          
        </div>
        
      </div>
    </footer>
  `;
  
  document.body.insertAdjacentHTML('beforeend', footerHTML);
});


// Trigger footer peek calculation after footer is injected (testing)
if (typeof adjustFooterPeek === 'function') {
  setTimeout(adjustFooterPeek, 50);
}