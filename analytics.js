/* ============================================
   HEPHIO ANALYTICS
   Loads Google Analytics across the entire site
   ============================================ */

(function () {

  const GA_ID = "G-XXXXXXXXXX";

  // Create global dataLayer
  window.dataLayer = window.dataLayer || [];

  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;

  // Initialize GA
  gtag("js", new Date());
  gtag("config", GA_ID);

  // Load GA script
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;

  document.head.appendChild(script);

})();