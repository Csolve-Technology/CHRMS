import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import type { MessageKey } from "@/i18n/locales";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3,
  Home,
  Users,
  FileText,
  CreditCard,
  Settings,
  Shield,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { ChiroLogo } from "@/components/chrms/ChiroLogo";

interface SidebarProps {
  isCollapsed: boolean;
}

const menuItems: {
  titleKey: MessageKey;
  icon: typeof BarChart3;
  href: string;
  permission: string;
}[] = [
  {
    titleKey: "nav.dashboard",
    icon: BarChart3,
    href: "/dashboard",
    permission: "dashboard.view",
  },
  {
    titleKey: "nav.properties",
    icon: Home,
    href: "/properties",
    permission: "properties.read",
  },
  {
    titleKey: "nav.tenants",
    icon: Users,
    href: "/tenants",
    permission: "tenants.read",
  },
  {
    titleKey: "nav.rentals",
    icon: FileText,
    href: "/rentals",
    permission: "rentals.read",
  },
  {
    titleKey: "nav.payments",
    icon: CreditCard,
    href: "/payments",
    permission: "payments.read",
  },
  {
    titleKey: "nav.reports",
    icon: BarChart3,
    href: "/reports",
    permission: "reports.view",
  },
];

const adminItems: {
  titleKey: MessageKey;
  icon: typeof Shield;
  href: string;
  permission: string;
}[] = [
  {
    titleKey: "nav.userManagement",
    icon: Shield,
    href: "/admin/users",
    permission: "users.read",
  },
  {
    titleKey: "nav.systemSettings",
    icon: Settings,
    href: "/admin/settings",
    permission: "settings.read",
  },
];

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed }) => {
  const { user, logout, hasPermission } = useAuth();
  const { t } = useI18n();

  const filteredMenuItems = menuItems.filter(
    (item) =>
      hasPermission(item.permission) ||
      (item.href === "/admin/users" && hasPermission("roles.read")),
  );

  const filteredAdminItems = adminItems.filter(
    (item) =>
      hasPermission(item.permission) ||
      (item.href === "/admin/users" && hasPermission("roles.read")),
  );

  return (
    <div
      className={`bg-card border-r border-border transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      } h-full flex flex-col`}
    >
      <div className="p-4 border-b border-border">
        <div
          className={`flex items-center ${isCollapsed ? "justify-center" : "space-x-3"}`}
        >
          <ChiroLogo size={isCollapsed ? 36 : 40} />
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground leading-tight">
                {t("app.title")}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {t("app.subtitle")}
              </p>
            </div>
          )}
        </div>
      </div>

      {!isCollapsed && user && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.designation}
              </p>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 mt-1">
                {user.role.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-500"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  } ${isCollapsed ? "justify-center" : ""}`
                }
              >
                <Icon className={`h-5 w-5 ${!isCollapsed ? "mr-3" : ""}`} />
                {!isCollapsed && (
                  <>
                    {t(item.titleKey)}
                    <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                  </>
                )}
              </NavLink>
            );
          })}

          {filteredAdminItems.length > 0 && (
            <>
              <Separator className="my-3" />
              <div
                className={`px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${
                  isCollapsed ? "text-center" : ""
                }`}
              >
                {!isCollapsed ? t("nav.admin") : "A"}
              </div>
              {filteredAdminItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        isActive
                          ? "bg-red-50 text-red-700 border-r-2 border-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-500"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      } ${isCollapsed ? "justify-center" : ""}`
                    }
                  >
                    <Icon className={`h-5 w-5 ${!isCollapsed ? "mr-3" : ""}`} />
                    {!isCollapsed && (
                      <>
                        {t(item.titleKey)}
                        <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                      </>
                    )}
                  </NavLink>
                );
              })}
            </>
          )}
        </nav>
      </ScrollArea>

      <div className="p-3 border-t border-border">
        <Button
          variant="ghost"
          className={`w-full ${
            isCollapsed ? "px-2" : "justify-start"
          } text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30`}
          onClick={logout}
        >
          <LogOut className={`h-5 w-5 ${!isCollapsed ? "mr-3" : ""}`} />
          {!isCollapsed && t("header.logout")}
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
