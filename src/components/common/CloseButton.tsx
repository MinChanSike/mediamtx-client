import {
  Button,
  makeStyles,
  mergeClasses,
  type ButtonProps,
} from "@fluentui/react-components";
import {
  Dismiss16Regular,
  Dismiss24Regular,
  Dismiss48Regular,
} from "@fluentui/react-icons";
import useCloseButtonStyles from "@src/components/common/useCloseButtonStyles";

export type CloseButtonSize = "small" | "medium" | "large";

const SIZE_DETAILS: Record<
  CloseButtonSize,
  { icon: typeof Dismiss24Regular; buttonSize: "small" | "medium" | "large" }
> = {
  small: { icon: Dismiss16Regular, buttonSize: "small" },
  medium: { icon: Dismiss24Regular, buttonSize: "medium" },
  large: { icon: Dismiss48Regular, buttonSize: "large" },
};

const useStyles = makeStyles({
  small: {
    minWidth: "28px",
    width: "28px",
    minHeight: "28px",
    padding: 0,
  },
  medium: {
    minWidth: "32px",
    width: "32px",
    padding: 0,
  },
  large: {
    minWidth: "40px",
    width: "40px",
    minHeight: "40px",
    padding: 0,
  },
});

export type CloseButtonProps = Omit<ButtonProps, "size"> & {
  /** Icon and hit-area size; defaults to `md`. */
  size?: CloseButtonSize;
};

/**
 * Shared icon-only close button with red hover feedback. Pass `className` for
 * positioning or custom coloring; later classes override the size defaults.
 */
export default function CloseButton({
  size = "medium",
  className,
  ...rest
}: CloseButtonProps) {
  const styles = useStyles();
  const closeButtonStyles = useCloseButtonStyles();
  const { icon: Icon, buttonSize } = SIZE_DETAILS[size];

  return (
    <Button
      appearance="subtle"
      size={buttonSize}
      icon={<Icon />}
      className={mergeClasses(
        styles[size],
        closeButtonStyles.dangerHover,
        className,
      )}
      {...(rest as ButtonProps)}
    />
  );
}
