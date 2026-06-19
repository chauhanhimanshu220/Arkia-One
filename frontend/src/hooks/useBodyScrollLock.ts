import { useEffect } from "react";

let activeScrollLocks = 0;
let originalBodyOverflow = "";
let originalBodyPaddingRight = "";
let originalHtmlOverflow = "";

export const useBodyScrollLock = (locked: boolean) => {
  useEffect(() => {
    if (!locked) {
      return;
    }

    const { body, documentElement } = document;

    if (activeScrollLocks === 0) {
      originalBodyOverflow = body.style.overflow;
      originalBodyPaddingRight = body.style.paddingRight;
      originalHtmlOverflow = documentElement.style.overflow;

      const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
      const computedBodyPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

      body.style.overflow = "hidden";
      documentElement.style.overflow = "hidden";

      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${computedBodyPaddingRight + scrollbarWidth}px`;
      }
    }

    activeScrollLocks += 1;

    return () => {
      activeScrollLocks = Math.max(0, activeScrollLocks - 1);

      if (activeScrollLocks === 0) {
        body.style.overflow = originalBodyOverflow;
        body.style.paddingRight = originalBodyPaddingRight;
        documentElement.style.overflow = originalHtmlOverflow;
      }
    };
  }, [locked]);
};
