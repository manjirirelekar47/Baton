import { createBrowserRouter, Navigate } from "react-router-dom";
import { EmptyState } from "@/shared/ui";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { featureRoutes } from "./features";
import { Shell } from "./Shell";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      ...featureRoutes,
      { path: "*", element: <EmptyState title="Page not found">Use the navigation above to get back on track.</EmptyState> },
    ],
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
]);
