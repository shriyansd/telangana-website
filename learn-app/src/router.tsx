// Minimal hash router. Hash routing (\#/lesson/c1-u1-l1) keeps the app fully
// static-host portable — no server rewrite rules needed under /learn/.

import { useEffect, useState } from 'react';

export interface Route {
  path: string; // e.g. "lesson/c1-u1-l1"
  parts: string[];
}

export function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const path = raw.split('?')[0];
  return { path, parts: path.split('/').filter(Boolean) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path: string): void {
  window.location.hash = '#/' + path.replace(/^\/+/, '');
}

export function Link({ to, className, children, ...rest }: { to: string; className?: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={'#/' + to.replace(/^\/+/, '')} className={className} {...rest}>
      {children}
    </a>
  );
}
