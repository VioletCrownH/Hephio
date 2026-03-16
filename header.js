// ============================================
// HEPHIO HEADER - INJECTION & BEHAVIOR
// Injects header HTML and handles scroll/dropdown
// ============================================

(function() {
  'use strict';

  // ==========================================
  // INJECT HEADER HTML
  // ==========================================
  
  const headerHTML = `
    <header class="header" id="mainHeader">
      <div class="header-container">
        
        <!-- Navigation -->
        <nav class="header-nav" id="mainNav">
          <button class="nav-item" data-menu="image">Image</button>
          <button class="nav-item" data-menu="pdf">PDF</button>
          <button class="nav-item" data-menu="text">Text</button>
          <button class="nav-item" data-menu="file">File</button>
        </nav>

        <!-- Dropdown Menus -->
        <div class="nav-dropdown" id="imageDropdown" data-dropdown="image">
          <a href="/tools/image/compress/" class="dropdown-item">Compress</a>
          <a href="/tools/image/resize/" class="dropdown-item">Resize</a>
          <a href="/tools/image/convert/" class="dropdown-item">Convert</a>
          <a href="/tools/image/croprotate/" class="dropdown-item">Crop & Rotate</a>
          <a href="/tools/image/metadata/" class="dropdown-item">Metadata</a>
          <a href="/tools/image/info/" class="dropdown-item">Info</a>
        </div>

        <div class="nav-dropdown" id="pdfDropdown" data-dropdown="pdf">
          <a href="/tools/pdf/merge/" class="dropdown-item">Merge</a>
          <a href="/tools/pdf/split/" class="dropdown-item">Split</a>
          <a href="/tools/pdf/rearrange/" class="dropdown-item">Rearrange</a>
          <a href="/tools/pdf/rotate/" class="dropdown-item">Rotate</a>
          <a href="/tools/pdf/extract/" class="dropdown-item">Extract</a>
          <a href="/tools/pdf/convert/" class="dropdown-item">Convert</a>
          <a href="/tools/pdf/images-to-pdf/" class="dropdown-item">Images to PDF</a>
          <a href="/tools/pdf/protect/" class="dropdown-item">Protect</a>
        </div>

        <div class="nav-dropdown" id="textDropdown" data-dropdown="text">
          <a href="/tools/text/changecase/" class="dropdown-item">Change Case</a>
          <a href="/tools/text/cleanup/" class="dropdown-item">Cleanup</a>
          <a href="/tools/text/count/" class="dropdown-item">Word Counter</a>
          <a href="/tools/text/sort/" class="dropdown-item">Sort Lines</a>
          <a href="/tools/text/compare/" class="dropdown-item">Compare Text</a>
          <a href="/tools/text/extract/" class="dropdown-item">Extract Text</a>
          <a href="/tools/text/format/" class="dropdown-item">JSON Formatter</a>
          <a href="/tools/text/password/" class="dropdown-item">Password Generator</a>
        </div>

        <div class="nav-dropdown" id="fileDropdown" data-dropdown="file">
          <a href="/tools/file/zip/" class="dropdown-item">Zip</a>  
          <a href="/tools/file/batchrename/" class="dropdown-item">Batch Rename</a>
          <a href="/tools/file/qr/" class="dropdown-item">QR Codes</a>
          <a href="/tools/file/base64/" class="dropdown-item">Base64</a>
          <a href="/tools/file/uuid/" class="dropdown-item">UUID Generator</a>
          <a href="/tools/file/URLEncoder/" class="dropdown-item">URL Encoder / Decoder</a>
          <a href="/tools/file/hash/" class="dropdown-item">File Hash</a>
        </div>

        <!-- Logo -->
        <a href="/" class="header-logo">
          <div class="logo-text">Hephio<span class="logo-dot">.</span></div>
        </a>

      </div>
    </header>
  `;

  // Check if we're on the homepage (which has header already)
  const existingHeader = document.getElementById('mainHeader');
  
  if (!existingHeader) {
    // Inject header at the beginning of body
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
  }

  // ==========================================
  // HEADER SCROLL BEHAVIOR WITH HYSTERESIS
  // ==========================================
  
  const header = document.getElementById('mainHeader');
  let isScrolled = false;

  function handleScroll() {
    const scrollY = window.scrollY;
    
    // Hysteresis: different thresholds for scrolling down vs up
    if (scrollY > 90 && !isScrolled) {
      header.classList.add('header-scrolled');
      isScrolled = true;
    } else if (scrollY < 70 && isScrolled) {
      header.classList.remove('header-scrolled');
      isScrolled = false;
    }
  }

  window.addEventListener('scroll', handleScroll);

  // ==========================================
  // DROPDOWN MENU BEHAVIOR
  // ==========================================

  const navItems = document.querySelectorAll('.nav-item:not(.nav-item-disabled)');
  const dropdowns = document.querySelectorAll('.nav-dropdown');
  let activeDropdown = null;
  let dropdownTimeout = null;

  navItems.forEach(item => {
    item.addEventListener('mouseenter', function() {
      const menuType = this.getAttribute('data-menu');
      const dropdown = document.querySelector(`[data-dropdown="${menuType}"]`);
      
      // Clear any pending close
      if (dropdownTimeout) {
        clearTimeout(dropdownTimeout);
        dropdownTimeout = null;
      }

      // Hide all dropdowns
      dropdowns.forEach(d => d.classList.remove('nav-dropdown-active'));
      
      // Show this dropdown
      if (dropdown) {
        // Calculate position relative to the nav button
        const buttonRect = this.getBoundingClientRect();
        const headerContainer = document.querySelector('.header-container');
        const containerRect = headerContainer.getBoundingClientRect();
        
        // Position dropdown under the button
        const leftPosition = buttonRect.left - containerRect.left;
        dropdown.style.left = `${leftPosition}px`;
        
        dropdown.classList.add('nav-dropdown-active');
        activeDropdown = dropdown;
      }

      // Highlight active nav item
      navItems.forEach(n => n.classList.remove('nav-item-active'));
      this.classList.add('nav-item-active');
    });
  });

  // Close dropdown when mouse leaves nav area
  const mainNav = document.getElementById('mainNav');
  
  mainNav.addEventListener('mouseleave', function() {
    dropdownTimeout = setTimeout(() => {
      dropdowns.forEach(d => d.classList.remove('nav-dropdown-active'));
      navItems.forEach(n => n.classList.remove('nav-item-active'));
      activeDropdown = null;
    }, 150);
  });

  // Keep dropdown open when hovering over it
  dropdowns.forEach(dropdown => {
    dropdown.addEventListener('mouseenter', function() {
      if (dropdownTimeout) {
        clearTimeout(dropdownTimeout);
        dropdownTimeout = null;
      }
    });

    dropdown.addEventListener('mouseleave', function() {
      this.classList.remove('nav-dropdown-active');
      navItems.forEach(n => n.classList.remove('nav-item-active'));
      activeDropdown = null;
    });
  });

})();