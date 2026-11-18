import type { ReactNode, SVGProps } from 'react';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number;
}

function IconBase({ size = 18, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconClock3(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9.2" />
      <polyline points="12 7 12 12 16.2 14.2" />
    </IconBase>
  );
}

export function IconFileText(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </IconBase>
  );
}

export function IconMessageSquareText(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M13 8H7" />
      <path d="M17 12H7" />
    </IconBase>
  );
}

export function IconUtensils(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 2v7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3z" />
      <path d="M21 15v7" />
    </IconBase>
  );
}

export function IconSoup(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9z" />
      <path d="M7 21h10" />
      <path d="M9 7c0-1.2 1-1.8 1-3" />
      <path d="M14 7c0-1.2 1-1.8 1-3" />
    </IconBase>
  );
}

export function IconPencil(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
      <path d="M15 5l4 4" />
    </IconBase>
  );
}

export function IconEye(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}

export function IconEyeOff(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9.9 9.9a3 3 0 1 0 4.2 4.2" />
      <path d="M10.7 5.1c.5 0 1.1-.1 1.3-.1 6.4 0 10 7 10 7a13.5 13.5 0 0 1-2.1 3" />
      <path d="M6.6 6.6C3.4 8.8 2 12 2 12a13.5 13.5 0 0 0 2.1 3" />
      <path d="M2 2l20 20" />
    </IconBase>
  );
}

export function IconTrash2(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </IconBase>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}

export function IconListPlus(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M11 12H3" />
      <path d="M16 6H3" />
      <path d="M16 18H3" />
      <path d="M18 9v6" />
      <path d="M21 12h-6" />
    </IconBase>
  );
}

export function IconUserRound(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="4.6" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </IconBase>
  );
}

export function IconStore(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 9l1.6-5.2A1 1 0 0 1 5.6 3h12.8a1 1 0 0 1 1 0.8L21 9" />
      <path d="M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9" />
      <path d="M9 21v-6h6v6" />
    </IconBase>
  );
}

export function IconWallet(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M19 6.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
      <circle cx="17.5" cy="12.5" r="1" />
    </IconBase>
  );
}

export function IconSettings2(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="17" r="2.6" />
      <circle cx="7" cy="7" r="2.6" />
    </IconBase>
  );
}

export function IconPhone(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </IconBase>
  );
}

export function IconMapPin(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </IconBase>
  );
}

export function IconSquarePen(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
    </IconBase>
  );
}

export function IconCircleCheck(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9.2" />
      <polyline points="8 12.4 10.9 15.2 16.3 9.5" />
    </IconBase>
  );
}

export function IconPackage(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 8.2 12 3 3 8.2v7.6L12 21l9-5.2z" />
      <path d="M3 8.2 12 13.4l9-5.2" />
      <path d="M12 13.4V21" />
    </IconBase>
  );
}

export function IconBookOpen(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M2 3.5h6a4 4 0 0 1 4 4V21a3 3 0 0 0-3-3H2z" />
      <path d="M22 3.5h-6a4 4 0 0 0-4 4V21a3 3 0 0 1 3-3h7z" />
    </IconBase>
  );
}

export function IconCalendarClock(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 12V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h7" />
      <circle cx="17" cy="17" r="4" />
      <path d="M17 15.6V17l1.2 1" />
    </IconBase>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m9 6 6 6-6 6" />
    </IconBase>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 6 9 17l-5-5" />
    </IconBase>
  );
}

export function IconReceiptText(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 2v20l3-2 2.5 2 2.5-2 2.5 2 2.5-2 3 2V2l-3 2-2.5-2L12 4 9.5 2 7 4z" />
      <path d="M8 8h8" />
      <path d="M8 12h6" />
      <path d="M8 16h4" />
    </IconBase>
  );
}

export function IconCheckCircle2(props: IconProps) {
  return <IconCircleCheck {...props} />;
}

export function IconCircleAlert(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 7.8v4.4" />
      <path d="M12 16.2h.01" />
    </IconBase>
  );
}

export function IconAlertTriangle(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </IconBase>
  );
}

export function IconBell(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10.3 21a2 2 0 0 0 3.4 0" />
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    </IconBase>
  );
}

export function IconLogOut(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <path d="M21 12H9" />
    </IconBase>
  );
}

export function IconClipboardList(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </IconBase>
  );
}
export function IconArrowLeft(props: IconProps) {
  return (
    <IconBase {...props}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </IconBase>
  );
}

export function IconListOrdered(props: IconProps) {
  return (
    <IconBase {...props}>
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </IconBase>
  );
}

export function IconGitCommitHorizontal(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="12" r="3" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </IconBase>
  );
}

export function IconHistory(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <polyline points="3 3 3 8 8 8" />
      <path d="M12 7v5l4 2" />
    </IconBase>
  );
}

export function IconCircleX(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </IconBase>
  );
}

export function IconTimer(props: IconProps) {
  return (
    <IconBase {...props}>
      <line x1="10" y1="2" x2="14" y2="2" />
      <line x1="12" y1="14" x2="12" y2="8" />
      <circle cx="12" cy="14" r="8" />
    </IconBase>
  );
}
