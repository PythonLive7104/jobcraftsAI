import { useEffect } from 'react';
import { useLocation } from 'react-router';

const TAWK_SCRIPT_ID = 'tawk-chat-script';
const TAWK_SRC = 'https://embed.tawk.to/69727f82108a93197a087941/default';

export function TawkChat() {
  const location = useLocation();
  const publicPaths = new Set(['/', '/pricing', '/login', '/register']);
  const shouldEnableChat = publicPaths.has(location.pathname);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const w = window as Window & {
      Tawk_API?: {
        showWidget?: () => void;
        hideWidget?: () => void;
      };
      Tawk_LoadStart?: Date;
    };

    if (!shouldEnableChat) {
      w.Tawk_API?.hideWidget?.();
      return;
    }

    if (document.getElementById(TAWK_SCRIPT_ID)) {
      w.Tawk_API?.showWidget?.();
      return;
    }

    w.Tawk_API = w.Tawk_API || {};
    w.Tawk_LoadStart = new Date();

    const script = document.createElement('script');
    script.id = TAWK_SCRIPT_ID;
    script.async = true;
    script.src = TAWK_SRC;
    script.charset = 'UTF-8';
    script.setAttribute('crossorigin', '*');

    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.body.appendChild(script);
    }
  }, [shouldEnableChat]);

  return null;
}
