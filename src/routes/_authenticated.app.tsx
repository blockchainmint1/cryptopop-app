import { createFileRoute, redirect } from "@tanstack/react-router";

// The wallet now lives on the homepage. Keep /app as a permanent redirect
// so older links and bookmarks still work.
export const Route = createFileRoute("/_authenticated/app")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
