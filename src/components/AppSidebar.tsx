import React from 'react';
import { Home, Code2, Compass, UserCircle, PanelLeftClose, PanelLeft, FlaskConical, LineChart, CircuitBoard, Focus } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const mainItems = [
  { title: 'Home', url: '/', icon: Home },
  { title: 'Codex', url: '/codex', icon: Code2 },
  { title: 'Virtual CAD', url: '/virtual-cad', icon: Compass },
  { title: 'Chemistry Lab', url: '/chemistry-lab', icon: FlaskConical },
  { title: 'Graphiqs', url: '/graphiqs', icon: LineChart },
  { title: 'Circuit Lab', url: '/circuit', icon: CircuitBoard },
  { title: 'Focus Mode', url: '/focus-mode', icon: Focus },
];

const bottomItems = [
  { title: 'Profile', url: '/profile', icon: UserCircle },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        "border-r-0",
        "[&_[data-sidebar=sidebar]]:!bg-transparent"
      )}
    >
      {/* Gradient background layer */}
      <div
        className="absolute inset-0 z-0"
        style={{ background: 'linear-gradient(180deg, hsl(0 0% 10%) 0%, hsl(0 0% 20%) 50%, hsl(0 0% 15%) 100%)' }}
      />

      <SidebarHeader className="relative z-10 flex flex-col items-center border-b border-white/10 px-2 py-2">
        {/* Brand – always shown, big bold shiny centered */}
        <div className="w-full flex items-center justify-center py-3">
          {collapsed ? (
            <span
              className="text-xl font-extrabold text-transparent bg-landing-gradient bg-clip-text drop-shadow-lg"
              title="mindstacklabs"
            >
              M
            </span>
          ) : (
            <span className="text-2xl font-extrabold tracking-tight text-transparent bg-landing-gradient bg-clip-text drop-shadow-lg text-center">
              mindstacklabs
            </span>
          )}
        </div>

        {/* Collapse/Expand toggle - below the brand */}
        <button
          onClick={toggleSidebar}
          className={cn(
            "flex items-center justify-center p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white w-full"
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeft className="w-5 h-5" />
          ) : (
            <PanelLeftClose className="w-5 h-5" />
          )}
        </button>
      </SidebarHeader>
      <SidebarContent className="relative z-10 text-white">
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/50">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    className={cn(
                      "text-white/80 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/20 data-[active=true]:text-white",
                      "py-3"
                    )}
                  >
                    <NavLink to={item.url} end className="flex items-center gap-3 w-full">
                      <item.icon className="w-5 h-5 shrink-0" />
                      {!collapsed && <span className="tracking-wide">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="relative z-10 text-white border-t border-white/10">
        <SidebarMenu>
          {bottomItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                className={cn(
                  "text-white/80 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/20 data-[active=true]:text-white",
                  "py-3"
                )}
              >
                <NavLink to={item.url} end className="flex items-center gap-3 w-full">
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="tracking-wide">{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;