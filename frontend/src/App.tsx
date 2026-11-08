import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { lazy, Suspense, useLayoutEffect, useSyncExternalStore } from 'react'
import DialogHost from './components/ui/DialogHost'
import BillingAlertHost from './components/billing/BillingAlertHost'
import { DramaGenQueuePanel } from './components/drama/DramaGenQueuePanel'
import WeChatGroupFab from './components/layout/WeChatGroupFab'
import AuthPage from './pages/AuthPage'
import HistoryPage from './pages/HistoryPage'
import HomePage from './pages/HomePage'
import MarketingStudioPage from './pages/MarketingStudioPage'
import MethodPage from './pages/MethodPage'
import GenerationPage from './pages/GenerationPage'
import GenerationTasksPage from './pages/GenerationTasksPage'
import HelpPage from './pages/HelpPage'
import { PrivacyPage, TermsPage } from './pages/LegalDocPage'
import ContactPage from './pages/ContactPage'
import SettingsPage from './pages/SettingsPage'
import PricingPage from './pages/PricingPage'
import StudioPage from './pages/StudioPage'
import TemplatesPage from './pages/TemplatesPage'
import CreateProjectPage from './pages/studio/CreateProjectPage'
import CreationSessionEditorBridge from './pages/studio/CreationSessionEditorBridge'
import StyleConfigPage from './pages/studio/StyleConfigPage'
import StoryboardPage from './pages/studio/StoryboardPage'
import EditorPage from './pages/studio/EditorPage'
import DramaListPage from './pages/drama/DramaListPage'
import CanvasListPage from './pages/drama/CanvasListPage'
import AssetLibraryPage from './pages/drama/AssetLibraryPage'
import ProjectWorkspacePage from './pages/drama/ProjectWorkspacePage'
import EpisodeEditPage from './pages/drama/EpisodeEditPage'
import EpisodesPage from './pages/drama/EpisodesPage'
import CanvasPage from './pages/drama/canvas/CanvasPage'
import EpisodeStoryboardPage from './pages/drama/episodeCanvas/EpisodeStoryboardPage'
import TeamInvitationPage from './features/teams/TeamInvitationPage'
import RequireAuth from './pages/drama/RequireAuth'
import { setWorkspaceTeam, subscribeWorkspace, workspaceScope } from './features/teams/workspaceScope'
import TeamPage from './features/teams/TeamPage'
import { TeamPreviewProvider } from './features/teams/TeamPreviewContext'
import './styles/printfilm.css'
import './App.css'

const Marketplace = lazy(() => import('./features/marketplace/Marketplace'))

/** 生成队列支持个人和团队空间，余额引导仅在个人业务空间展示。 */
function PersonalBusinessOverlays() {
  const { pathname } = useLocation()
  const teamId = useSyncExternalStore(subscribeWorkspace, () => workspaceScope.teamId)
  useLayoutEffect(() => { if (!/^\/teams\/\d+/.test(pathname) && !/^\/drama\/projects\/\d+/.test(pathname)) setWorkspaceTeam(null) }, [pathname])
  const personal = teamId === null && pathname !== '/teams' && !pathname.startsWith('/teams/') && pathname !== '/team-invitations'
  return <><DramaGenQueuePanel />{personal && <BillingAlertHost />}</>
}

/** 用户端路由及全局交互宿主，团队界面使用真实认证服务。 */
export default function App() {
  return (
    <TeamPreviewProvider><BrowserRouter basename={import.meta.env.BASE_URL || '/videostory'}>
      <Routes>
        <Route path="/marketplace/*" element={<Suspense fallback={<p>正在加载作品与招募…</p>}><Marketplace /></Suspense>} />
        <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/marketing-studio" element={<RequireAuth><MarketingStudioPage /></RequireAuth>} />
        <Route path="/marketing" element={<Navigate to="/marketing-studio" replace />} />
        <Route path="/method" element={<MethodPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/templates" element={<RequireAuth><TemplatesPage /></RequireAuth>} />
        <Route path="/tools/video" element={<RequireAuth><GenerationPage kind="video" /></RequireAuth>} />
        <Route path="/tools/image" element={<RequireAuth><GenerationPage kind="image" /></RequireAuth>} />
        <Route path="/tools/audio" element={<RequireAuth><GenerationPage kind="audio" /></RequireAuth>} />
        <Route path="/tasks" element={<RequireAuth><GenerationTasksPage /></RequireAuth>} />
        <Route path="/assets" element={<RequireAuth><AssetLibraryPage /></RequireAuth>} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        <Route path="/teams" element={<RequireAuth><TeamPage /></RequireAuth>} />
        <Route path="/teams/join" element={<TeamInvitationPage />} />
        <Route path="/team-invitations" element={<TeamInvitationPage />} />
        <Route path="/teams/:teamId" element={<RequireAuth><TeamPage /></RequireAuth>} />
        <Route path="/pricing" element={<RequireAuth><PricingPage /></RequireAuth>} />
        <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
        <Route path="/studio/new" element={<RequireAuth><CreateProjectPage /></RequireAuth>} />
        <Route path="/studio/sessions/:sessionId" element={<RequireAuth><CreationSessionEditorBridge /></RequireAuth>} />
        <Route path="/studio/:id/style" element={<RequireAuth><StyleConfigPage /></RequireAuth>} />
        <Route path="/studio/:id/editor" element={<RequireAuth><EditorPage /></RequireAuth>} />
        <Route path="/studio/:id" element={<RequireAuth><StoryboardPage /></RequireAuth>} />
        <Route path="/studio" element={<RequireAuth><StudioPage /></RequireAuth>} />
        {/* Agent home (mirrors novel agent entry) */}
        <Route path="/drama" element={<RequireAuth><DramaListPage /></RequireAuth>} />
        <Route path="/canvas" element={<RequireAuth><CanvasListPage /></RequireAuth>} />
        <Route path="/drama/dramas" element={<RequireAuth><DramaListPage /></RequireAuth>} />
        <Route path="/drama/assets" element={<RequireAuth><AssetLibraryPage /></RequireAuth>} />
        <Route path="/drama/projects/:projectId" element={<RequireAuth><ProjectWorkspacePage /></RequireAuth>} />
        <Route path="/drama/projects/:projectId/episodes" element={<RequireAuth><EpisodesPage /></RequireAuth>} />
        <Route path="/drama/projects/:projectId/episodes/:episodeId" element={<RequireAuth><EpisodeEditPage /></RequireAuth>} />
        <Route
          path="/drama/projects/:projectId/episodes/:episodeId/canvas"
          element={<RequireAuth><EpisodeStoryboardPage /></RequireAuth>}
        />
        <Route path="/drama/projects/:projectId/canvas" element={<RequireAuth><CanvasPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <WeChatGroupFab />
      <PersonalBusinessOverlays />
      <DialogHost />
    </BrowserRouter></TeamPreviewProvider>
  )
}
