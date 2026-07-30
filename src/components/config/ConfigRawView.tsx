import { Button, makeStyles, tokens } from '@fluentui/react-components';
import { Copy20Regular } from '@fluentui/react-icons';
import { Highlight, themes } from 'prism-react-renderer';
import type { CompleteServerConfig } from '@src/types/config';
import type { CSSProperties } from 'react';

interface ConfigRawViewProps {
  config: CompleteServerConfig;
}

interface RawConfigClipboard {
  writeText: (value: string) => Promise<void>;
}

function withoutReactKey<T extends object>(props: T): Omit<T, 'key'> {
  const propsWithoutKey = { ...props } as T & { key?: unknown };
  delete propsWithoutKey.key;
  return propsWithoutKey;
}

export function copyRawConfigToClipboard(
  config: CompleteServerConfig,
  clipboard: RawConfigClipboard = navigator.clipboard
) {
  return clipboard.writeText(JSON.stringify(config, null, 2));
}

export function getRawConfigPreStyle(
  style: CSSProperties
): Omit<CSSProperties, 'background' | 'backgroundColor' | 'color'> {
  const { background, backgroundColor, color, ...safeStyle } = style;
  void background;
  void backgroundColor;
  void color;
  return safeStyle;
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    width: '100%',
    minHeight: 0,
    flex: 1,
    flexDirection: 'column',
    alignItems: 'end',
    gap: tokens.spacingVerticalXS,
    paddingBottom: '24px',
  },
  pre: {
    width: '100%',
    minHeight: 0,
    flex: 1,
    overflow: 'auto',
    margin: 0,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    padding: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
  },
  line: {
    minHeight: tokens.lineHeightBase200,
  },
});

export default function ConfigRawView({ config }: ConfigRawViewProps) {
  const styles = useStyles();
  const rawJson = JSON.stringify(config, null, 2);

  return (
    <div className={styles.root}>
      <Button
        appearance="secondary"
        icon={<Copy20Regular />}
        onClick={() => copyRawConfigToClipboard(config)}
        size="small"
      >
        Copy
      </Button>
      <Highlight theme={themes.github} code={rawJson} language="json">
        {({ className, style, tokens: highlightedLines, getLineProps, getTokenProps }) => (
          <pre className={`${className} ${styles.pre}`} style={getRawConfigPreStyle(style)}>
            {highlightedLines.map((line, index) => {
              const lineProps = withoutReactKey(getLineProps({ line }));

              return (
                <div key={index} {...lineProps} className={styles.line}>
                  {line.map((token, tokenIndex) => {
                    const tokenProps = withoutReactKey(getTokenProps({ token }));

                    return <span key={tokenIndex} {...tokenProps} />;
                  })}
                </div>
              );
            })}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
