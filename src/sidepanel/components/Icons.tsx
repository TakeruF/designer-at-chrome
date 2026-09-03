import {
  Bookmark,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Moon,
  MoreHorizontal,
  ScanSearch,
  Search,
  Settings,
  Video,
  type LucideProps,
} from "lucide-react";

type IconProps = LucideProps;

const defaults = { size: 16, strokeWidth: 1.8, "aria-hidden": true } as const;

export function InspectIcon(props: IconProps) {
  return <ScanSearch {...defaults} {...props} />;
}

export function BookmarkIcon(props: IconProps) {
  return <Bookmark {...defaults} {...props} />;
}

export function ThemeIcon(props: IconProps) {
  return <Moon {...defaults} {...props} />;
}

export function SettingsIcon(props: IconProps) {
  return <Settings {...defaults} {...props} />;
}

export function ChevronIcon(props: IconProps) {
  return <ChevronRight {...defaults} {...props} />;
}

export function CopyIcon(props: IconProps) {
  return <Copy {...defaults} {...props} />;
}

export function ExternalIcon(props: IconProps) {
  return <ExternalLink {...defaults} {...props} />;
}

export function VideoIcon(props: IconProps) {
  return <Video {...defaults} {...props} />;
}

export function SearchIcon(props: IconProps) {
  return <Search {...defaults} {...props} />;
}

export function MoreIcon(props: IconProps) {
  return <MoreHorizontal {...defaults} {...props} />;
}

export function EmptyIcon(props: IconProps) {
  return <FileText {...defaults} {...props} />;
}
