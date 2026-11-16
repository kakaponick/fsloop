// fsloopUI: the router, the live store over the server's API and its tick stream, and the shell.
import { useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { createLiveStore, httpTransport, LiveProvider } from "./live.tsx";
import { Shell } from "./shell.tsx";

export function App() {
  const [store] = useState(() => createLiveStore(httpTransport));
  return (
    <BrowserRouter>
      <LiveProvider store={store}>
        <Shell />
      </LiveProvider>
    </BrowserRouter>
  );
}
