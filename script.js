/**
 * BalalaGovernment — subtle interactions
 * - Mobile nav toggle
 * - IntersectionObserver stagger (30–60ms cascade)
 * - Respect prefers-reduced-motion
 */

(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ——— Mobile menu ———
  const toggle = document.getElementById("menu-toggle");
  const mobileNav = document.getElementById("mobile-nav");

  if (toggle && mobileNav) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      mobileNav.hidden = open;
      mobileNav.dataset.open = String(!open);
      document.body.style.overflow = open ? "" : "hidden";
    });

    // Close on link click
    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        toggle.setAttribute("aria-expanded", "false");
        mobileNav.hidden = true;
        mobileNav.dataset.open = "false";
        document.body.style.overflow = "";
      });
    });
  }

  // ——— Stagger reveal ———
  if (reduced) {
    document.querySelectorAll("[data-stagger]").forEach((el) => {
      el.classList.add("is-visible");
    });
    return;
  }

  const items = document.querySelectorAll("[data-stagger]");
  if (!items.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const siblings = [...el.parentElement.querySelectorAll("[data-stagger]")];
        const index = siblings.indexOf(el);
        const delay = Math.min(index * 45, 180); // 45ms stagger, cap 180ms

        el.style.transitionDelay = `${delay}ms`;
        el.classList.add("is-visible");
        observer.unobserve(el);
      });
    },
    { rootMargin: "0px 0px -40px 0px", threshold: 0.1 }
  );

  items.forEach((el) => observer.observe(el));
})();
