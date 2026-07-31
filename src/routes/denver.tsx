import { createFileRoute } from "@tanstack/react-router";
import { MarketPage, marketQuery } from "@/components/market-page";

export const Route = createFileRoute("/denver")({
  head: () => ({
    meta: [
      { title: "Denver POP Market — CryptoPOP" },
      { name: "description", content: "CryptoPOP Denver: mile-high meetups, merchant love, upcoming events and market news." },
      { property: "og:title", content: "Denver POP Market — CryptoPOP" },
      { property: "og:description", content: "Mile-high meetups and merchant love — earn POP around Denver." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(marketQuery("denver")),
  component: () => <MarketPage slug="denver" />,
  errorComponent: () => <div className="p-10">Couldn't load the Denver market.</div>,
  notFoundComponent: () => <div className="p-10">Market not found.</div>,
});
