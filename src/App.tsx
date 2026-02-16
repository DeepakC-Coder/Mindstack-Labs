import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import VirtualCAD from "./virtual-cad/VirtualCAD";
import Workspace from "./pages/Workspace";
import Auth from "./pages/Auth";
import Codex from "./pages/Codex";
import Profile from "./pages/Profile";
import ChemistryLab from "./pages/ChemistryLab";
import Graphiqs from "./pages/Graphiqs";
import Circuit from "./pages/Circuit";
import FocusMode from "./pages/FocusMode";

const queryClient = new QueryClient();

function AppLayout() {
  const location = useLocation();
  const isLandingPage = location.pathname === "/";
  const isVirtualCAD = location.pathname === "/virtual-cad";
  const isCodex = location.pathname === "/codex";
  const isAuth = location.pathname === "/auth";
  const isProfile = location.pathname === "/profile";
  const isChemistryLab = location.pathname === "/chemistry-lab";
  const isGraphiqs = location.pathname === "/graphiqs";
  const isCircuit = location.pathname === "/circuit";
  const isFocusMode = location.pathname === "/focus-mode";

  // Hide sidebar on Auth page
  const hideSidebar = isAuth;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {!hideSidebar && <AppSidebar />}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Hide header on landing page, Virtual CAD page, and Codex page */}
          {!isLandingPage && !isVirtualCAD && !isCodex && !isAuth && !isProfile && !isChemistryLab && !isGraphiqs && !isCircuit && !isFocusMode && (
            <header className="h-12 flex items-center border-b border-border px-4 bg-card shrink-0">
              <SidebarTrigger />
            </header>
          )}
          <div className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/workspace" element={<Workspace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/codex" element={<Codex />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/virtual-cad" element={<VirtualCAD />} />
              <Route path="/chemistry-lab" element={<ChemistryLab />} />
              <Route path="/graphiqs" element={<Graphiqs />} />
              <Route path="/circuit" element={<Circuit />} />
              <Route path="/focus-mode" element={<FocusMode />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
