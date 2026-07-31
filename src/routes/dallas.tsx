import { createFileRoute } from "@tanstack/react-router";
import { MarketPage, marketQuery } from "@/components/market-page";

export const Route = createFileRoute("/dallas")({
  head: () => ({
    meta: [
      { title: "Dallas POP Market — CryptoPOP" },
      { name: "description", content: "CryptoPOP Dallas: HQ community, upcoming events, the DFW merchant map, and the latest market news." },
      { property: "og:title", content: "Dallas POP Market — CryptoPOP" },
      { property: "og:description", content: "Where CryptoPOP started. Events, merchants and POP across DFW." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(marketQuery("dallas")),
  component: () => <MarketPage slug="dallas" />,
  errorComponent: () => <div className="p-10">Couldn't load the Dallas market.</div>,
  notFoundComponent: () => <div className="p-10">Market not found.</div>,
});
