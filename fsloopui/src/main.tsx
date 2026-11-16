import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.tsx";
import "./styles/index.css";
import { Loading } from "./ui/loading.tsx";
import { UiProvider } from "./ui/provider.tsx";

// The kit of shared components lives at /kit in dev only; the production build leaves it out.
const Kit = import.meta.env.DEV ? lazy(() => import("./kit/Kit.tsx").then((m) => ({ default: m.Kit }))) : null;

const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <StrictMode>
      <UiProvider>
        {Kit && window.location.pathname === "/kit" ? (
          <Suspense fallback={<Loading className="h-dvh" />}>
            <Kit />
          </Suspense>
        ) : (
          <App />
        )}
      </UiProvider>
    </StrictMode>,
  );
