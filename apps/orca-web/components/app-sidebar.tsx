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
      title: "Analytics (Home)",
      url: "/",
      icon: <ChartBarIcon />,
    },
    {
      title: "Operations",
      url: "/operations",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Add Shipment",
      url: "/shipments/new",
      icon: <PlusCircleIcon />,
    },
    {
      title: "Route Optimizer",
      url: "/optimize",
      icon: <WaypointsIcon />,
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
                className="data-[slot=sidebar-menu-button]:p-2! h-12"
                render={<div />}
              >
                <img src="/logo.svg" alt="Orca Logo" className="size-7" />
                <span className="text-xl font-bold tracking-tight">ORCA</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <div className="px-2 pb-2 mt-1 text-[10px] leading-tight text-slate-500 font-medium">
            AI-Powered Carbon-Aware Logistics Intelligence for Resilient and Sustainable Delivery Networks
          </div>
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
