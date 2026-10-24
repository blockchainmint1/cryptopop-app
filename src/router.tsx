import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = async () => {
  const queryClient = new QueryClient();
  let nonce: string | undefined;
  if (import.meta.env.SSR) {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    nonce = getRequestHeader("x-cryptopop-csp-nonce");
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    ssr: { nonce },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
