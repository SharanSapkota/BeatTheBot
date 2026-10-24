import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/app";
import "./styles/global.css";

const root_element = document.getElementById("root");
if (!root_element) {
  throw new Error("Root element #root not found");
}

createRoot(root_element).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
