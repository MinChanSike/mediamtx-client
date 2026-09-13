import { useEffect, type ReactNode } from 'react';
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import { HashRouter } from 'react-router-dom';
import AppLayout from '@src/components/layout/AppLayout';
import useAppStore from '@src/store/useAppStore';

function ThemedApp() {
  const theme = useAppStore((s) => s.theme);

  // Apply/remove 'dark' class on <html> so Tailwind dark: variants work, and
  // sync color-scheme so native form controls (date/time picker indicators,
  // scrollbars) render for the active theme.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  }, [theme]);

  return (
    <FluentProvider theme={theme === 'dark' ? webDarkTheme : webLightTheme}>
      <AppLayout />
    </FluentProvider>
  );
}

export function AppRouter({ children }: { children: ReactNode }) {
  return <HashRouter>{children}</HashRouter>;
}

function App() {
  return (
    <AppRouter>
      <ThemedApp />
    </AppRouter>
  );
}

export default App;
