import { initHeroScrollVideo } from "./hero-scroll-video.js";

const siteHeader = document.querySelector(".site-header");
const navLinks = Array.from(document.querySelectorAll(".site-nav a"));
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const updateGlassHighlight = (clientX, clientY) => {
  if (!siteHeader) return;

  const rect = siteHeader.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = ((clientY - rect.top) / rect.height) * 100;

  siteHeader.style.setProperty("--glass-x", `${clamp(x, 0, 100)}%`);
  siteHeader.style.setProperty("--glass-y", `${clamp(y, 0, 100)}%`);
};

const updateActiveSection = () => {
  const currentSection = sections.find((section) => {
    const rect = section.getBoundingClientRect();
    return rect.top <= 140 && rect.bottom >= 140;
  });

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    link.classList.toggle("active", Boolean(currentSection && href === `#${currentSection.id}`));
  });
};

const heroCleanup = initHeroScrollVideo();

const handleScroll = () => {
  updateActiveSection();
};

handleScroll();

window.addEventListener("scroll", handleScroll, { passive: true });
window.addEventListener("resize", handleScroll);

if (siteHeader) {
  siteHeader.addEventListener("pointermove", (event) => {
    updateGlassHighlight(event.clientX, event.clientY);
  });

  siteHeader.addEventListener("pointerleave", () => {
    siteHeader.style.setProperty("--glass-x", "50%");
    siteHeader.style.setProperty("--glass-y", "50%");
  });
}

window.addEventListener("beforeunload", () => {
  heroCleanup();
});

window.addEventListener("pagehide", heroCleanup);
