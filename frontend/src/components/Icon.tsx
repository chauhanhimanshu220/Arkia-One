import React, { SVGProps } from "react";

export type IconName =
  | "dashboard"
  | "message-circle"
  | "timesheet"
  | "approvals"
  | "team"
  | "employees"
  | "projects"
  | "leave"
  | "departments"
  | "reports"
  | "logout"
  | "search"
  | "clock"
  | "bell"
  | "chevrons-left"
  | "chevron-left"
  | "chevron-right"
  | "chevrons-right"
  | "chevron-down"
  | "menu"
  | "plus"
  | "download"
  | "import"
  | "refresh-cw"
  | "edit"
  | "trash"
  | "close"
  | "eye"
  | "eye-off"
  | "sun"
  | "moon"
  | "spinner"
  | "history"
  | "inbox"
  | "file-spreadsheet"
  | "settings"
  | "user-circle"
  | "git-branch"
  | "map-pin"
  | "monitor"
  | "printer"
  | "shield"
  | "globe"
  | "external-link"
  | "paperclip"
  | "send"
  | "check";

const icons: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" fill="currentColor" fillOpacity="0.1" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" fill="currentColor" fillOpacity="0.1" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  "message-circle": (
    <>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" fill="currentColor" fillOpacity="0.1" />
      <path d="M8 12h8" opacity="0.5" />
      <path d="M8 9h6" opacity="0.5" />
    </>
  ),
  timesheet: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" fill="currentColor" fillOpacity="0.1" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M9 14h2v2H9zM13 14h2v2h-2z" opacity="0.6" fill="currentColor" />
    </>
  ),
  approvals: (
    <>
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.1" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  team: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" fill="currentColor" fillOpacity="0.1" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" opacity="0.6" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" opacity="0.6" />
    </>
  ),
  employees: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" fill="currentColor" fillOpacity="0.1" />
      <path d="M19 11h6M22 8v6" />
    </>
  ),
  projects: (
    <>
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" fillOpacity="0.1" />
      <path d="M2 17l10 5 10-5" opacity="0.6" />
      <path d="M2 12l10 5 10-5" opacity="0.6" />
    </>
  ),
  leave: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" fill="currentColor" fillOpacity="0.1" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 16h8" opacity="0.8" />
    </>
  ),
  departments: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" fill="currentColor" fillOpacity="0.1" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </>
  ),
  reports: (
    <>
      <path d="M3 3v18h18" />
      <path d="m18.7 8-5.1 5.2-2.8-2.7L7 14.3" />
      <circle cx="18.7" cy="8" r="1.5" fill="currentColor" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" fill="currentColor" fillOpacity="0.1" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.1" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" fill="currentColor" fillOpacity="0.1" />
      <circle cx="18" cy="6" r="3" fill="#f43f5e" stroke="#f43f5e" strokeWidth="1" />
    </>
  ),
  "chevrons-left": (
    <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
  ),
  "chevron-left": (
    <path d="m15 18-6-6 6-6" />
  ),
  "chevron-right": (
    <path d="m9 18 6-6-6-6" />
  ),
  "chevrons-right": (
    <path d="m13 17 5-5-5-5M6 17l5-5-5-5" />
  ),
  "chevron-down": (
    <path d="m6 9 6 6 6-6" />
  ),
  menu: (
    <path d="M4 12h16M4 6h16M4 18h16" />
  ),
  plus: (
    <path d="M12 5v14M5 12h14" />
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </>
  ),
  import: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </>
  ),
  "refresh-cw": (
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M3 21v-5h5" />
    </>
  ),
  edit: (
    <>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 1 1 3 3L12 15l-4 1 1-4Z" fill="currentColor" fillOpacity="0.1" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="currentColor" fillOpacity="0.1" />
      <path d="M10 11v6M14 11v6" opacity="0.6" />
    </>
  ),
  close: (
    <path d="M18 6 6 18M6 6l12 12" />
  ),
  eye: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="currentColor" fillOpacity="0.1" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.1" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  moon: (
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="currentColor" fillOpacity="0.1" />
  ),
  spinner: (
    <path d="M12 2a10 10 0 1 0 10 10" />
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5M12 7v5l4 2" />
    </>
  ),
  inbox: (
    <>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" fill="currentColor" fillOpacity="0.1" />
    </>
  ),
  "file-spreadsheet": (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="currentColor" fillOpacity="0.1" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h8M8 17h8" opacity="0.6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.1" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  "user-circle": (
    <>
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.1" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
    </>
  ),
  "git-branch": (
    <>
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" fill="currentColor" fillOpacity="0.1" />
      <circle cx="6" cy="18" r="3" fill="currentColor" fillOpacity="0.1" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="currentColor" fillOpacity="0.1" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  monitor: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" fill="currentColor" fillOpacity="0.1" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </>
  ),
  printer: (
    <>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" fill="currentColor" fillOpacity="0.1" />
      <rect x="6" y="14" width="12" height="8" rx="1" fill="currentColor" fillOpacity="0.1" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" fillOpacity="0.1" />
      <path d="m9 11 2 2 4-4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.1" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  "external-link": (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </>
  ),
  paperclip: (
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  ),
  send: (
    <>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" fillOpacity="0.1" />
    </>
  ),
  check: (
    <path d="M20 6 9 17l-5-5" />
  ),
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export const Icon = ({ name, className, ...props }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    {icons[name]}
  </svg>
);
