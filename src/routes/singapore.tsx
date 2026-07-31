import { createFileRoute } from "@tanstack/react-router";
import { MarketPage, marketQuery } from "@/components/market-page";

export const Route = createFileRoute("/singapore")({
  head: () => ({
    meta: [
      { title: "Singapore POP Market — CryptoPOP" },
      { name: "description", content: "CryptoPOP Singapore: our Asia flagship market — events, merchants and the latest news." },
      { property: "og:title", content: "Singapore POP Market — CryptoPOP" },
      { property: "og:description", content: "Our Asia flagship market — events, merchants and POP rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(marketQuery("singapore")),
  component: () => <MarketPage slug="singapore" />,
  errorComponent: () => <div className="p-10">Couldn't load the Singapore market.</div>,
  notFoundComponent: () => <div className="p-10">Market not found.</div>,
});
