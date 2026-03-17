import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { LandingPage } from "./components/pages/LandingPage";
import { Dashboard } from "./components/pages/Dashboard";
import { ResumeUpload } from "./components/pages/ResumeUpload";
import { JobAnalysis } from "./components/pages/JobAnalysis";
import { ResumeOptimization } from "./components/pages/ResumeOptimization";
import { CoverLetter } from "./components/pages/CoverLetter";
import { InterviewPrep } from "./components/pages/InterviewPrep";
import { LinkedInOptimizer } from "./components/pages/LinkedInOptimizer";
import { CareerGap } from "./components/pages/CareerGap";
import { ResumeVersions } from "./components/pages/ResumeVersions";
import { ResumeEditPdf } from "./components/pages/ResumeEditPdf";
import { Pricing } from "./components/pages/Pricing";
import { PaymentSuccess } from "./components/pages/PaymentSuccess";
import { Settings } from "./components/pages/Settings";
import { NotFound } from "./components/pages/NotFound";
import { Login } from "./components/pages/Login";
import { Register } from "./components/pages/Register";
import { ForgotPassword } from "./components/pages/ForgotPassword";
import { ResetPassword } from "./components/pages/ResetPassword";
import { VerifyEmail } from "./components/pages/VerifyEmail";
import { Portfolio } from "./components/pages/Portfolio";
import { PortfolioPublic } from "./components/pages/PortfolioPublic";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "pricing", element: <Pricing /> },
      { path: "login", element: <Login /> },
      { path: "register", element: <Register /> },
      { path: "forgot-password", element: <ForgotPassword /> },
      { path: "reset-password", element: <ResetPassword /> },
      { path: "verify-email", element: <VerifyEmail /> },
      { path: "p/:slug", element: <PortfolioPublic /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "payment-success", element: <PaymentSuccess /> },
          { path: "dashboard", element: <Dashboard /> },
          { path: "resume", element: <ResumeUpload /> },
          { path: "resume/edit/:resumeId", element: <ResumeEditPdf /> },
          { path: "job-analysis", element: <JobAnalysis /> },
          { path: "optimize", element: <ResumeOptimization /> },
          { path: "cover-letter", element: <CoverLetter /> },
          { path: "interview-prep", element: <InterviewPrep /> },
          { path: "linkedin", element: <LinkedInOptimizer /> },
          { path: "career-gap", element: <CareerGap /> },
          { path: "versions", element: <ResumeVersions /> },
          { path: "portfolio", element: <Portfolio /> },
          { path: "settings", element: <Settings /> },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
