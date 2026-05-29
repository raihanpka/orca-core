"use client"

import * as React from "react"
import Link from "next/link"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { SettingsDialog } from "@/components/settings-dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  BellIcon,
  ChartBarIcon,
  MapIcon,
  WaypointsIcon,
  LeafIcon,
  Settings2Icon,
  CircleHelpIcon,
  SearchIcon,
  CommandIcon,
  PlusCircleIcon,
} from "lucide-react"

const data = {
  user: {
    name: "Raihan Putra Kirana",
    email: "me@raihanpk.com",
    avatar: "",
  },
  navMain: [
    {
      title: "Operations (Home)",
      url: "/",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Add Shipment",
      url: "/shipments/new",
      icon: <PlusCircleIcon />,
    },
    {
      title: "Optimizer",
      url: "/optimize",
      icon: <WaypointsIcon />,
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: <ChartBarIcon />,
    },
    {
      title: "Alerts",
      url: "/alerts",
      icon: <BellIcon />,
    },
  ],
  navSecondary: [
    {
      title: "Get Help",
      url: "#",
      icon: <CircleHelpIcon />,
    },
    {
      title: "Search",
      url: "#",
      icon: <SearchIcon />,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/" className="contents">
              <SidebarMenuButton
                className="data-[slot=sidebar-menu-button]:p-1.5!"
                render={<div />}
              >
                <CommandIcon className="size-5!" />
                <span className="text-base font-semibold">ORCA Engine</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
