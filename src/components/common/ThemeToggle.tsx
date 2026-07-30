import { Button } from '@fluentui/react-components';
import { WeatherMoon24Regular, WeatherSunny24Regular } from '@fluentui/react-icons';
import useAppStore from '@src/store/useAppStore';

export default function ThemeToggle() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <Button
      appearance="subtle"
      icon={theme === 'light' ? <WeatherMoon24Regular /> : <WeatherSunny24Regular />}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    />
  );
}
