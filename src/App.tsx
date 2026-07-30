import { useEffect } from 'react';
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import AppLayout from '@src/components/layout/AppLayout';
import useAppStore from '@src/store/useAppStore';

function ThemedApp() {
  const theme = useAppStore((s) => s.theme);

  // Apply/remove 'dark' class on <html> so Tailwind dark: variants work
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <FluentProvider theme={theme === 'dark' ? webDarkTheme : webLightTheme}>
      <AppLayout />
    </FluentProvider>
  );
}

function App() {
  return <ThemedApp />;
}

export default App;
