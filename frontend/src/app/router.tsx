import { createBrowserRouter, Navigate } from "react-router-dom";
import { EmptyState } from "@/shared/ui";
import { featureRoutes } from "./features";
import { Shell } from "./Shell";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to="/sources" replace /> },
      ...featureRoutes,
      { path: "*", element: <EmptyState title="Page not found">Use the navigation above to get back on track.</EmptyState> },
    ],
  },
]);
