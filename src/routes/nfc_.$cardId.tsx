import { createFileRoute } from "@tanstack/react-router";
import { NfcPage } from "@/components/nfc/nfc-page";

export const Route = createFileRoute("/nfc_/$cardId")({
  head: () => ({
    meta: [
      { title: "Card settings — CryptoPOP Tap to Pay" },
      { name: "description", content: "Balance, PIN and approval settings for one tap-to-pay card." },
      { property: "og:title", content: "Card settings — CryptoPOP" },
      { property: "og:description", content: "Manage one tap-to-pay card." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CardPage,
});

function CardPage() {
  const { cardId } = Route.useParams();
  return <NfcPage cardId={cardId} />;
}
