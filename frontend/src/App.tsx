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
import { ProjectListPage } from "@/pages/projects/list"
import { LibraryHomePage } from "@/pages/library/home"
import { ProjectDetailPage } from "@/pages/projects/detail"
import { MockShelfPage } from "@/pages/projects/mock-shelf"
import { SettingsGeneralPage } from "@/pages/settings/general"
import { SettingsGithubPage } from "@/pages/settings/github"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeAwareToaster } from "@/components/theme-aware-toaster"

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
                    list: "/projects",
                    meta: { label: "项目" },
                  },
                ]}
              >
                <Routes>
                  <Route path="/settings" element={<SettingsLayout />}>
                    <Route index element={<SettingsGeneralPage />} />
                    <Route path="github" element={<SettingsGithubPage />} />
                  </Route>
                  <Route path="/" element={<AppLayout />}>
                    <Route index element={<Navigate to="/library" replace />} />
                    <Route path="library" element={<LibraryHomePage />} />
                    <Route path="projects/mock-shelf" element={<MockShelfPage />} />
                    <Route path="projects/board" element={<ProjectBoardPage />} />
                    <Route path="projects/:id" element={<ProjectDetailPage />} />
                    <Route path="projects" element={<ProjectListPage />} />
                  </Route>
                </Routes>
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
