import { useState } from "react";
import { RouterProvider } from "react-router";
import { Providers } from "./providers";
import { create_router } from "./router";

export function App() {
  const [router] = useState(create_router);
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
