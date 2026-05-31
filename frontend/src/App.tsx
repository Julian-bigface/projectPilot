import dataProvider from "@refinedev/simple-rest"
import { Refine } from "@refinedev/core"
import routerProvider from "@refinedev/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import { LibraryBrowseFiltersProvider } from "@/context/library-browse-filters"
import { LibraryFeatureDrawerProvider } from "@/context/library-feature-drawer"
import { LibraryProjectsLayoutProvider } from "@/context/library-projects-layout"
import { LibrarySelectionProvider } from "@/context/library-selection"
import { AppLayout } from "@/components/layout/app-layout"
import { SettingsLayout } from "@/components/layout/settings-layout"
import { ProjectBoardPage } from "@/pages/projects/board"
import { LibraryRedirect } from "@/components/routing/library-redirect"
import { LibraryHomePage } from "@/pages/library/home"
import { ProjectLibraryLayout } from "@/pages/library/library-layout"
import { ProjectLibrariesHomePage } from "@/pages/project-libraries/home"
import { ProjectDetailPage } from "@/pages/projects/detail"
import {
  DiscoveryLayout,
  DiscoveryIndexRedirect,
  DiscoveryRoutePlaceholder,
} from "@/pages/discovery/layout"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeAwareToaster } from "@/components/theme-aware-toaster"
import { WelcomeGate } from "@/components/welcome/welcome-gate"
import { GithubSettingsDialogProvider } from "@/context/github-settings-dialog"

const queryClient = new QueryClient()

export default function App() {
  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <ThemeAwareToaster position="top-center" richColors duration={2200} />
        <BrowserRouter>
          <LibrarySelectionProvider>
            <LibraryBrowseFiltersProvider>
            <LibraryFeatureDrawerProvider>
              <LibraryProjectsLayoutProvider>
                <Refine
                routerProvider={routerProvider}
                dataProvider={dataProvider("/api")}
                resources={[
                  {
                    name: "projects",
                    list: "/projects/board",
                    meta: { label: "项目" },
                  },
                ]}
              >
                <GithubSettingsDialogProvider>
                <WelcomeGate>
                <Routes>
                  <Route path="/settings/*" element={<SettingsLayout />} />
                  <Route path="/" element={<AppLayout />}>
                    <Route index element={<LibraryRedirect />} />
                    <Route path="library" element={<LibraryRedirect />} />
                    <Route path="libraries" element={<ProjectLibrariesHomePage />} />
                    <Route path="libraries/:libraryId" element={<ProjectLibraryLayout />}>
                      <Route index element={<LibraryHomePage />} />
                    </Route>
                    <Route path="discovery" element={<DiscoveryLayout />}>
                      <Route index element={<DiscoveryIndexRedirect />} />
                      <Route path="r/:owner/:repo" element={<DiscoveryRoutePlaceholder />} />
                      <Route path=":channelId" element={<DiscoveryRoutePlaceholder />} />
                    </Route>
                    <Route path="projects/board" element={<ProjectBoardPage />} />
                    <Route path="projects/:id" element={<ProjectDetailPage />} />
                    <Route path="projects" element={<Navigate to="/projects/board" replace />} />
                  </Route>
                </Routes>
                </WelcomeGate>
                </GithubSettingsDialogProvider>
                </Refine>
              </LibraryProjectsLayoutProvider>
            </LibraryFeatureDrawerProvider>
            </LibraryBrowseFiltersProvider>
          </LibrarySelectionProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ThemeProvider>
  )
}
