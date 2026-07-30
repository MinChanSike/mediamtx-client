import { buttonClassNames, makeStyles, tokens } from '@fluentui/react-components';

export const closeButtonDangerHoverColor1 = tokens.colorPaletteRedForeground1;
export const closeButtonDangerHoverColor2 = tokens.colorPaletteRedForeground2;

const useCloseButtonStyles = makeStyles({
  dangerHover: {
    ':hover': {
      [`& .${buttonClassNames.icon}`]: {
        color: closeButtonDangerHoverColor1,
      },
      '& svg': {
        color: closeButtonDangerHoverColor1,
      },
    },
    ':hover:active': {
      [`& .${buttonClassNames.icon}`]: {
        color: closeButtonDangerHoverColor2,
      },
      '& svg': {
        color: closeButtonDangerHoverColor2,
      },
    },
  },
});

export default useCloseButtonStyles;
