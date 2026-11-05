import React from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { ThemeSwitcher } from "@/components/chrms/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/chrms/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  Search,
  Menu,
  Settings,
  User,
  LogOut,
  HelpCircle,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/services/api";
import { formatDistanceToNow } from "date-fns";

interface HeaderProps {
  onToggleSidebar: () => void;
  isCollapsed: boolean;
}

type AppNotification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  entityType?: string | null;
  entityId?: string | null;
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
};

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, isCollapsed }) => {
  const { user, logout, hasPermission } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();

  const notifQ = useQuery({
    queryKey: ["notifications"],
    enabled: hasPermission("dashboard.read"),
    queryFn: async () => {
      const res = await api.get<{
        items: AppNotification[];
        unreadCount: number;
      }>("/notifications");
      return res.data;
    },
    refetchInterval: 60_000,
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await api.patch("/notifications/read-all");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = notifQ.data?.items ?? [];
  const unreadCount = notifQ.data?.unreadCount ?? 0;

  return (
    <header
      className="bg-card border-b border-border px-6 py-4"
      data-id="4rqgu5shv"
      data-path="src/components/layout/Header.tsx"
    >
      <div
        className="flex items-center justify-between"
        data-id="pj9p3bf9m"
        data-path="src/components/layout/Header.tsx"
      >
        {/* Left Section */}
        <div
          className="flex items-center space-x-4"
          data-id="1096b5kw8"
          data-path="src/components/layout/Header.tsx"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className="p-2"
            data-id="gwxruzjrh"
            data-path="src/components/layout/Header.tsx"
          >
            <Menu
              className="h-5 w-5"
              data-id="qa5g654y5"
              data-path="src/components/layout/Header.tsx"
            />
          </Button>

          {/* Search Bar */}
          <div
            className="relative hidden md:block"
            data-id="w9jvayqqi"
            data-path="src/components/layout/Header.tsx"
          >
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
              data-id="m79qgurx4"
              data-path="src/components/layout/Header.tsx"
            />
            <Input
              placeholder={t("header.searchPlaceholder")}
              className="pl-10 w-80"
              data-id="qh5v0ojwx"
              data-path="src/components/layout/Header.tsx"
            />
          </div>
        </div>

        {/* Right Section */}
        <div
          className="flex items-center space-x-4"
          data-id="n5jz4un9t"
          data-path="src/components/layout/Header.tsx"
        >
          <LanguageSwitcher />
          <ThemeSwitcher />

          {/* Notifications */}
          <DropdownMenu
            data-id="thot3m9r0"
            data-path="src/components/layout/Header.tsx"
          >
            <DropdownMenuTrigger
              asChild
              data-id="l81tifwrn"
              data-path="src/components/layout/Header.tsx"
            >
              <Button
                variant="ghost"
                size="sm"
                className="relative p-2"
                data-id="so3n5t70m"
                data-path="src/components/layout/Header.tsx"
              >
                <Bell
                  className="h-5 w-5"
                  data-id="95ltezrv3"
                  data-path="src/components/layout/Header.tsx"
                />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    data-id="fx7ta8pe0"
                    data-path="src/components/layout/Header.tsx"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-80"
              data-id="u4efa1lec"
              data-path="src/components/layout/Header.tsx"
            >
              <DropdownMenuLabel
                className="flex items-center justify-between"
                data-id="8uyhcjndu"
                data-path="src/components/layout/Header.tsx"
              >
                {t("header.notifications")}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  disabled={unreadCount === 0 || markAll.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    markAll.mutate();
                  }}
                  data-id="ms1kqkmqx"
                  data-path="src/components/layout/Header.tsx"
                >
                  {t("header.markAllRead")}
                </Button>
              </DropdownMenuLabel>
              <DropdownMenuSeparator
                data-id="3dt2r6psc"
                data-path="src/components/layout/Header.tsx"
              />
              {notifications.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No rent reminders yet
                </div>
              ) : (
                notifications.slice(0, 8).map((notification) => {
                  const href =
                    notification.entityType === "rental" &&
                    notification.entityId
                      ? `/rentals/${notification.entityId}`
                      : undefined;
                  return (
                    <DropdownMenuItem
                      key={notification.id}
                      className="flex flex-col items-start p-4 cursor-pointer"
                      onSelect={() => {
                        if (!notification.read) markOne.mutate(notification.id);
                      }}
                      asChild={!!href}
                      data-id="gc9a8fb34"
                      data-path="src/components/layout/Header.tsx"
                    >
                      {href ? (
                        <Link
                          to={href}
                          className="flex flex-col items-start w-full"
                        >
                          <div className="flex items-center justify-between w-full gap-2">
                            <p
                              className={`text-sm ${
                                !notification.read
                                  ? "font-medium"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {notification.title}: {notification.message}
                            </p>
                            {!notification.read ? (
                              <div className="h-2 w-2 shrink-0 bg-blue-600 rounded-full" />
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(
                              new Date(notification.createdAt),
                              { addSuffix: true },
                            )}
                          </p>
                        </Link>
                      ) : (
                        <div className="flex flex-col items-start w-full">
                          <div className="flex items-center justify-between w-full gap-2">
                            <p
                              className={`text-sm ${
                                !notification.read
                                  ? "font-medium"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {notification.title}: {notification.message}
                            </p>
                            {!notification.read ? (
                              <div className="h-2 w-2 shrink-0 bg-blue-600 rounded-full" />
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(
                              new Date(notification.createdAt),
                              { addSuffix: true },
                            )}
                          </p>
                        </div>
                      )}
                    </DropdownMenuItem>
                  );
                })
              )}
              <DropdownMenuSeparator
                data-id="mrdrykd8c"
                data-path="src/components/layout/Header.tsx"
              />
              <DropdownMenuItem
                className="text-center text-blue-600 hover:text-blue-700"
                asChild
                data-id="0ay0omfwu"
                data-path="src/components/layout/Header.tsx"
              >
                <Link to="/payments">{t("header.viewAllNotifications")}</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Help */}
          <Button
            variant="ghost"
            size="sm"
            className="p-2"
            data-id="7px4cynoy"
            data-path="src/components/layout/Header.tsx"
          >
            <HelpCircle
              className="h-5 w-5"
              data-id="54ubegnbu"
              data-path="src/components/layout/Header.tsx"
            />
          </Button>

          {/* User Menu */}
          <DropdownMenu
            data-id="bp1vpvywc"
            data-path="src/components/layout/Header.tsx"
          >
            <DropdownMenuTrigger
              asChild
              data-id="aixop2sri"
              data-path="src/components/layout/Header.tsx"
            >
              <Button
                variant="ghost"
                className="h-9 w-9 rounded-full p-0"
                data-id="ghx34a66r"
                data-path="src/components/layout/Header.tsx"
              >
                <Avatar
                  className="h-9 w-9"
                  data-id="6yar2w63i"
                  data-path="src/components/layout/Header.tsx"
                >
                  <AvatarFallback
                    className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                    data-id="qbdfefzyz"
                    data-path="src/components/layout/Header.tsx"
                  >
                    {getInitials(user?.name || "User")}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56"
              data-id="cj5c5uchf"
              data-path="src/components/layout/Header.tsx"
            >
              <DropdownMenuLabel
                data-id="t9e4307iy"
                data-path="src/components/layout/Header.tsx"
              >
                <div
                  className="flex flex-col space-y-1"
                  data-id="6zx3zdgrk"
                  data-path="src/components/layout/Header.tsx"
                >
                  <p
                    className="text-sm font-medium"
                    data-id="evfyz9g2u"
                    data-path="src/components/layout/Header.tsx"
                  >
                    {user?.name}
                  </p>
                  <p
                    className="text-xs text-muted-foreground"
                    data-id="hv2a0ikpb"
                    data-path="src/components/layout/Header.tsx"
                  >
                    {user?.email}
                  </p>
                  <Badge
                    variant="secondary"
                    className="w-fit text-xs"
                    data-id="1jj8sqv3l"
                    data-path="src/components/layout/Header.tsx"
                  >
                    {user?.role.toUpperCase()}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator
                data-id="4h67h1c99"
                data-path="src/components/layout/Header.tsx"
              />
              <DropdownMenuItem
                data-id="z1lqi8gul"
                data-path="src/components/layout/Header.tsx"
              >
                <User
                  className="mr-2 h-4 w-4"
                  data-id="6din92n2g"
                  data-path="src/components/layout/Header.tsx"
                />
                {t("header.profile")}
              </DropdownMenuItem>
              <DropdownMenuItem
                data-id="mrrzdt516"
                data-path="src/components/layout/Header.tsx"
              >
                <Settings
                  className="mr-2 h-4 w-4"
                  data-id="0gwd0i9jx"
                  data-path="src/components/layout/Header.tsx"
                />
                {t("header.settings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator
                data-id="1h8ok00g9"
                data-path="src/components/layout/Header.tsx"
              />
              <DropdownMenuItem
                onClick={logout}
                className="text-red-600"
                data-id="l2rsu9wrv"
                data-path="src/components/layout/Header.tsx"
              >
                <LogOut
                  className="mr-2 h-4 w-4"
                  data-id="ykjkgukap"
                  data-path="src/components/layout/Header.tsx"
                />
                {t("header.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
