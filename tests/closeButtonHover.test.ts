import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function buttonContaining(sourceText: string, marker: string, tag = '<Button') {
  const markerIndex = sourceText.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);

  const buttonStart = sourceText.lastIndexOf(tag, markerIndex);
  expect(buttonStart).toBeGreaterThanOrEqual(0);

  const lines = sourceText.slice(buttonStart).split(/\r?\n/);
  let consumedLength = 0;

  for (const line of lines) {
    consumedLength += line.length + 1;
    if (line.trim() === '/>' || line.includes('</Button>')) {
      break;
    }
  }

  expect(consumedLength).toBeGreaterThan(markerIndex - buttonStart);
  return sourceText.slice(buttonStart, buttonStart + consumedLength);
}

const dismissButtons = [
  {
    path: 'src/components/streams/AddStreamDrawer.tsx',
    marker: 'aria-label="Close add stream"',
  },
  {
    path: 'src/components/streams/EditStreamDrawer.tsx',
    marker: 'aria-label="Close edit stream"',
  },
  {
    path: 'src/components/streams/SinglePlayerDrawer.tsx',
    marker: 'aria-label="Close player"',
  },
  {
    path: 'src/components/streams/StreamDetailsDrawer.tsx',
    marker: 'aria-label="Close details"',
  },
  {
    path: 'src/components/streams/StreamReadersDrawer.tsx',
    marker: 'aria-label="Close readers"',
  },
  {
    path: 'src/components/streams/ViewerDetailsDrawer.tsx',
    marker: 'aria-label="Close reader details"',
  },
  {
    path: 'src/pages/DashboardPage.tsx',
    marker: 'aria-label="Close raw JSON"',
  },
  {
    path: 'src/components/streams/MultiPlayerGrid.tsx',
    marker: 'aria-label="Close"',
  },
  {
    path: 'src/components/layout/AppHeader.tsx',
    marker: 'aria-label="Cancel MediaMTX API endpoint edit"',
  },
];

describe('close button hover affordance', () => {
  test('defines a shared red hover style without size or layout changes', () => {
    const styleSource = source('src/components/common/useCloseButtonStyles.ts');

    expect(styleSource).toContain('tokens.colorPaletteRedForeground1');
    expect(styleSource).toContain('buttonClassNames.icon');
    expect(styleSource).toContain("'& svg'");
    expect(styleSource).toContain("':hover'");
    expect(styleSource).toContain("':hover:active'");
    expect(styleSource).not.toMatch(/':hover':\s*{\s*color\s*:/);
    expect(styleSource).not.toMatch(/':hover:active':\s*{\s*color\s*:/);
    expect(styleSource).not.toMatch(/\b(width|height|minWidth|padding|margin|position)\s*:/);
  });

  test('CloseButton centralizes sizes, className, and the red hover affordance', () => {
    const closeSource = source('src/components/common/CloseButton.tsx');

    expect(closeSource).toContain("'sm' | 'md' | 'lg'");
    expect(closeSource).toContain('Dismiss16Regular');
    expect(closeSource).toContain('Dismiss24Regular');
    expect(closeSource).toContain('Dismiss48Regular');
    expect(closeSource).toContain('className,');
    expect(closeSource).toContain('closeButtonStyles.dangerHover');
  });

  test('renders every dismiss or close control through the shared CloseButton', () => {
    for (const { path, marker } of dismissButtons) {
      const componentSource = source(path);
      const buttonSource = buttonContaining(componentSource, marker, '<CloseButton');

      expect(componentSource).toContain(
        "import CloseButton from '@src/components/common/CloseButton'"
      );
      expect(buttonSource).toContain('onClick=');
      expect(buttonSource).toMatch(/aria-label="(?:Close|Cancel)[^"]*"/);
    }
  });

  test('does not apply red hover styling to unrelated icon buttons', () => {
    const appHeader = source('src/components/layout/AppHeader.tsx');
    const dashboardPage = source('src/pages/DashboardPage.tsx');
    const videoPlayer = source('src/components/streams/VideoPlayer.tsx');
    const addDrawer = source('src/components/streams/AddStreamDrawer.tsx');
    const editDrawer = source('src/components/streams/EditStreamDrawer.tsx');

    for (const [sourceText, marker] of [
      [appHeader, 'icon={<Checkmark24Regular />}'],
      [appHeader, 'icon={<Edit24Regular />}'],
      [dashboardPage, 'icon={<Code20Regular />}'],
      [videoPlayer, 'icon={<ArrowClockwise24Regular />}'],
      [videoPlayer, 'icon={<FullScreenMaximize24Regular />}'],
      [videoPlayer, 'icon={isMuted || volume === 0'],
      [addDrawer, 'icon={<Add24Regular />}'],
      [editDrawer, 'icon={<Save24Regular />}'],
    ] as const) {
      expect(buttonContaining(sourceText, marker)).not.toContain('dangerHover');
    }
  });
});
