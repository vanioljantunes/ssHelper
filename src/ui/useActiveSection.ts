import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks which page section is being read: the first section (in page order) that crosses a
 * band 15% to 30% down the viewport. A click on a nav link selects its section directly and holds
 * it until the visitor scrolls by hand (wheel, touch or key), so a short last section that cannot
 * reach the band still shows as current after its link is used.
 */
export function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string | null>(null);
  const heldRef = useRef(false);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const inBand = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) inBand.set(entry.target.id, entry.isIntersecting);
        if (heldRef.current) return;
        const first = ids.find((id) => inBand.get(id) === true);
        if (first !== undefined) setActive(first);
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    const release = () => {
      heldRef.current = false;
    };
    const options = { passive: true } as const;
    window.addEventListener('wheel', release, options);
    window.addEventListener('touchstart', release, options);
    window.addEventListener('keydown', release, options);
    return () => {
      observer.disconnect();
      window.removeEventListener('wheel', release);
      window.removeEventListener('touchstart', release);
      window.removeEventListener('keydown', release);
    };
  }, [ids]);

  const select = useCallback((id: string) => {
    heldRef.current = true;
    setActive(id);
  }, []);

  return { active, select };
}
