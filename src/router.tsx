import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { routeTree } from "./routeTree.gen";

const requestNonce = createIsomorphicFn()
  .server(async (): Promise<string | undefined> => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    return getRequestHeader("x-cryptopop-csp-nonce");
  })
  .client(async (): Promise<string | undefined> => undefined);

export const getRouter = async () => {
  const queryClient = new QueryClient();
  const nonce = await requestNonce();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    ssr: { nonce },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
