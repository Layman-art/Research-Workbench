import {
  Building2,
  Landmark,
  FlaskConical,
  Compass,
  ListChecks,
  NotebookPen,
  Database,
  FolderOpen,
  History,
  Calendar,
  Tag,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  building: Building2,
  landmark: Landmark,
  flask: FlaskConical,
  compass: Compass,
  'list-checks': ListChecks,
  notebook: NotebookPen,
  database: Database,
  folder: FolderOpen,
  history: History,
  calendar: Calendar,
  tag: Tag,
  'book-open': BookOpen,
};

export function typeIcon(icon: string): LucideIcon {
  return Object.hasOwn(ICONS, icon) ? ICONS[icon] : Tag;
}

export function isTypeIcon(icon: unknown): icon is string {
  return typeof icon === 'string' && Object.hasOwn(ICONS, icon);
}
