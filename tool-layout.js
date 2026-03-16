/**
 * tool-layout.js
 * Common layout utilities for Hephio tools
 * Footer peek disabled for launch stability.
 */

function adjustFooterPeek() {
  const toolMain = document.getElementById('toolMain');
  if (!toolMain) return;

  toolMain.style.height = 'auto';
  toolMain.style.minHeight = 'calc(100vh - 100px)';
}

window.addEventListener('load', adjustFooterPeek);
window.addEventListener('resize', adjustFooterPeek);