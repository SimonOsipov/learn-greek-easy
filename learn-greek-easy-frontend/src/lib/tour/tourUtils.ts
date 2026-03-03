export function waitForElement(selector: string, timeoutMs = 3000): Promise<Element | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    function check() {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      if (Date.now() - start > timeoutMs) return resolve(null);
      requestAnimationFrame(check);
    }
    check();
  });
}

export function findDeckCardByTitle(titleSubstring: string): Element | null {
  const cards = document.querySelectorAll('[data-testid="deck-card"]');
  for (const card of cards) {
    const titleEl = card.querySelector('[data-testid="deck-card-title"]');
    if (titleEl?.textContent?.includes(titleSubstring)) return card;
  }
  return null;
}

export function getNavElement(): Element | null {
  const desktopNav = document.querySelector('[data-testid="main-nav"]');
  if (desktopNav && desktopNav.getBoundingClientRect().width > 0) {
    return desktopNav;
  }
  const mobileNavs = document.querySelectorAll('nav');
  for (const nav of mobileNavs) {
    if (nav.classList.contains('fixed') && nav.classList.contains('bottom-0')) {
      return nav;
    }
  }
  return null;
}
