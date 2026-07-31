import { createFileRoute, redirect } from "@tanstack/react-router";

// /my-pop was merged into /app. Keep the URL as a permanent redirect so
// older shared links still land in the right place.
export const Route = createFileRoute("/my-pop")({
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  },
});
