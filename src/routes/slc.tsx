import { createFileRoute } from "@tanstack/react-router";
import { MarketPage, marketQuery } from "@/components/market-page";

export const Route = createFileRoute("/slc")({
  head: () => ({
    meta: [
      { title: "Salt Lake POP Market — CryptoPOP" },
      { name: "description", content: "CryptoPOP Salt Lake: outdoors, indoors and everywhere between — events, merchants and market news." },
      { property: "og:title", content: "Salt Lake POP Market — CryptoPOP" },
      { property: "og:description", content: "Outdoors, indoors, and everywhere between — earn POP around Salt Lake." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(marketQuery("slc")),
  component: () => <MarketPage slug="slc" />,
  errorComponent: () => <div className="p-10">Couldn't load the Salt Lake market.</div>,
  notFoundComponent: () => <div className="p-10">Market not found.</div>,
});
