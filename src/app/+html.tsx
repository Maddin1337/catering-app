import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Wurzel-HTML der Web-App (nur Web). Für iPhone und iPad: `viewport-fit=cover` damit die sicheren Bereiche
 * (Notch, Home-Anzeige) als `env(safe-area-inset-*)` ankommen, kein automatisches Vergrößern der Schrift
 * (`text-size-adjust`) und Vollbild beim Hinzufügen zum Home-Bildschirm.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#FFFFFF" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html:
              'html{-webkit-text-size-adjust:100%;text-size-adjust:100%;-webkit-tap-highlight-color:transparent}body{background:#fff;overscroll-behavior-y:none}',
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
