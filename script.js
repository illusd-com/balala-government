/**
 * BalalaGovernment — subtle interactions
 */

(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        toggle.setAttribute("aria-expanded", "false");
        mobileNav.hidden = true;
        mobileNav.dataset.open = "false";
        document.body.style.overflow = "";
      });
    });
  }

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
        const delay = Math.min(index * 45, 180);

        el.style.transitionDelay = `${delay}ms`;
        el.classList.add("is-visible");
        observer.unobserve(el);
      });
    },
    { rootMargin: "0px 0px -40px 0px", threshold: 0.1 }
  );

  items.forEach((el) => observer.observe(el));
})();
