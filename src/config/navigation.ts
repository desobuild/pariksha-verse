export interface NavItemConfig {
  title: string;
  href: string;
  icon: string;
  desktopOnly?: boolean;
}

export const DESKTOP_NAV_ITEMS: NavItemConfig[] = [
  { title: "Home", href: "/app/home", icon: "Home" },
  { title: "Study", href: "/app/study", icon: "BookOpen" },
  { title: "Planner", href: "/app/planner", icon: "Calendar" },
  { title: "Mock Tests", href: "/app/mock-tests", icon: "FileCheck2" },
  { title: "Progress", href: "/app/progress", icon: "BarChart2" },
  { title: "Resources", href: "/app/resources", icon: "Library" },
  { title: "More", href: "/app/more", icon: "MoreHorizontal" },
];

export const MOBILE_NAV_ITEMS: NavItemConfig[] = [
  { title: "Home", href: "/app/home", icon: "Home" },
  { title: "Study", href: "/app/study", icon: "BookOpen" },
  { title: "Progress", href: "/app/progress", icon: "BarChart2" },
  { title: "Resources", href: "/app/resources", icon: "Library" },
  { title: "More", href: "/app/more", icon: "MoreHorizontal" },
];
