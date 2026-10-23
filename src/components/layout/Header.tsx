"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export function Header() {
  const { data: session } = useSession();

  const displayName = session?.user?.name || session?.user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6 sticky top-0 z-10 w-full backdrop-blur-md bg-background/80">
      <SidebarTrigger className="hidden md:flex" />

      <div className="w-full flex-1">
        <p className="text-sm text-muted-foreground hidden md:block">
          Welcome back, <span className="font-medium text-foreground capitalize">{displayName}</span>
        </p>
      </div>

      <div className="flex items-center gap-3">
        {session?.user?.email && (
          <span className="text-xs text-muted-foreground hidden lg:block max-w-[160px] truncate">
            {session.user.email}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-full p-0 h-9 w-9 inline-flex items-center justify-center hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            aria-label="User menu"
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium capitalize">{displayName}</span>
                  <span className="text-xs text-muted-foreground font-normal truncate">
                    {session?.user?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="p-0">
              <Link href="/settings" className="flex items-center w-full px-1.5 py-1 cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
