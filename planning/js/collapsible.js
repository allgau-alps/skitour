// Collapsible control sections for planning tool
document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('.control-section');
  sections.forEach(section => {
    const h3 = section.querySelector('h3');
    if (!h3) return;
    const title = h3.textContent.trim().toLowerCase();
    // Initially collapse Overlays and GPX, leave Search expanded
    if (title.includes('overlay') || title.includes('gpx')) {
      section.classList.add('collapsed');
    } else {
      section.classList.remove('collapsed');
    }
    // Toggle on header click
    h3.addEventListener('click', () => {
      section.classList.toggle('collapsed');
    });
  });
});
