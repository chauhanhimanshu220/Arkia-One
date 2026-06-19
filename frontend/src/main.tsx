import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, useLocation, Routes, Route } from "react-router-dom";
import App from "./App";
import { ManagementApp } from "./ManagementApp";
import { applyAppTheme, getStoredAppTheme } from "./hooks/useAppTheme";
import { AuthProvider } from "./hooks/useAuth";
import "./index.css";

applyAppTheme(getStoredAppTheme());

const RootDispatcher = () => {
  const location = useLocation();

  if (location.pathname.startsWith("/management")) {
    return <ManagementApp />;
  }

  return <App />;
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <RootDispatcher />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
